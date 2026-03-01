import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { AuthError } from '../auth.js';
import { eventsTable, votingOptionsTable, votesTable, initializeTables } from '../storage.js';
import { SubmitVotesRequest, EventEntity, VoteEntity, VotingOptionEntity } from '../types.js';
import { v4 as uuidv4 } from 'uuid';

let tablesInitialized = false;
async function ensureTables() {
  if (!tablesInitialized) {
    await initializeTables();
    tablesInitialized = true;
  }
}

function getDeviceFingerprint(request: HttpRequest): string {
  return request.headers.get('x-device-fingerprint') || 'unknown';
}

function getSessionId(request: HttpRequest): string | undefined {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/evote_session=([^;]+)/);
  return match?.[1];
}

// POST /api/events/{eventId}/vote - Submit or update votes
async function submitVotes(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await ensureTables();
    const eventId = request.params.eventId;

    // Verify event exists and is open
    let event: EventEntity;
    try {
      event = await eventsTable.getEntity<EventEntity>('event', eventId);
    } catch (err: any) {
      if (err.statusCode === 404) {
        return { status: 404, jsonBody: { error: 'Event not found' } };
      }
      throw err;
    }

    if (event.status !== 'open') {
      return { status: 409, jsonBody: { error: 'Voting is not currently open for this event' } };
    }

    // Check expiration
    if (event.expiresAt) {
      const expiresAt = new Date(event.expiresAt);
      if (expiresAt < new Date()) {
        return { status: 410, jsonBody: { error: 'This event has expired' } };
      }
    }

    const body = await request.json() as SubmitVotesRequest;

    // Validate voter name
    if (!body.voterName || body.voterName.trim().length === 0) {
      return { status: 400, jsonBody: { error: 'Voter name is required' } };
    }
    if (body.voterName.length > 100) {
      return { status: 400, jsonBody: { error: 'Voter name must be 100 characters or less' } };
    }

    // Validate allocations
    const config = JSON.parse(event.config);
    const totalVotes = Object.values(body.allocations).reduce((sum: number, v: number) => sum + v, 0);
    if (totalVotes > config.votesPerAttendee) {
      return { status: 400, jsonBody: { error: `You can allocate a maximum of ${config.votesPerAttendee} votes` } };
    }
    if (totalVotes === 0) {
      return { status: 400, jsonBody: { error: 'Must allocate at least one vote' } };
    }

    // Validate all option IDs exist
    for (const optionId of Object.keys(body.allocations)) {
      if (body.allocations[optionId] < 0) {
        return { status: 400, jsonBody: { error: 'Vote allocations cannot be negative' } };
      }
      if (body.allocations[optionId] === 0) continue;
      try {
        await votingOptionsTable.getEntity(eventId, `option_${optionId}`);
      } catch (err: any) {
        if (err.statusCode === 404) {
          return { status: 400, jsonBody: { error: `Invalid option: ${optionId}` } };
        }
        throw err;
      }
    }

    // Determine voter identity
    const deviceFingerprint = getDeviceFingerprint(request);
    let sessionId = getSessionId(request);
    const isNewSession = !sessionId;
    if (!sessionId) {
      sessionId = uuidv4();
    }

    const voterId = `${deviceFingerprint}_${sessionId}`;
    const now = new Date().toISOString();

    // Check if voter already voted - delete previous votes
    const existingVotes = votesTable.listEntities<VoteEntity>({
      queryOptions: { filter: `PartitionKey eq '${eventId}' and voterId eq '${voterId}'` },
    });
    for await (const existing of existingVotes) {
      await votesTable.deleteEntity(existing.partitionKey, existing.rowKey);
    }

    // Create new vote entries for each allocation
    for (const [optionId, count] of Object.entries(body.allocations)) {
      if (count <= 0) continue;
      const voteEntity: VoteEntity = {
        partitionKey: eventId,
        rowKey: `vote_${voterId}_${optionId}`,
        optionId,
        voterId,
        voterName: body.voterName.trim(),
        voteCount: count as number,
        deviceFingerprint,
        sessionId,
        createdAt: now,
        updatedAt: now,
      };
      await votesTable.upsertEntity(voteEntity, 'Replace');
    }

    // Build response with cookie
    const headers: Record<string, string> = {};
    if (isNewSession) {
      headers['Set-Cookie'] = `evote_session=${sessionId}; Path=/; SameSite=Lax; Max-Age=86400`;
    }

    return {
      status: 200,
      headers,
      jsonBody: {
        success: true,
        sessionId,
        allocations: body.allocations,
        voterName: body.voterName.trim(),
      },
    };
  } catch (error) {
    return handleError(error);
  }
}

// GET /api/events/{eventId}/vote - Get current voter's session/allocations
async function getMyVotes(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await ensureTables();
    const eventId = request.params.eventId;

    const deviceFingerprint = getDeviceFingerprint(request);
    const sessionId = getSessionId(request);

    if (!sessionId) {
      return { jsonBody: { hasVoted: false, allocations: {}, voterName: null } };
    }

    const voterId = `${deviceFingerprint}_${sessionId}`;
    const votes = votesTable.listEntities<VoteEntity>({
      queryOptions: { filter: `PartitionKey eq '${eventId}' and voterId eq '${voterId}'` },
    });

    const allocations: Record<string, number> = {};
    let voterName: string | null = null;
    for await (const vote of votes) {
      allocations[vote.optionId] = vote.voteCount;
      voterName = vote.voterName;
    }

    const hasVoted = Object.keys(allocations).length > 0;

    return {
      jsonBody: { hasVoted, allocations, voterName },
    };
  } catch (error) {
    return handleError(error);
  }
}

// GET /api/events/{eventId}/vote/count - Get total vote count or per-option counts
async function getVoteCounts(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await ensureTables();
    const eventId = request.params.eventId;

    // Get event to check display mode
    let event: EventEntity;
    try {
      event = await eventsTable.getEntity<EventEntity>('event', eventId);
    } catch (err: any) {
      if (err.statusCode === 404) {
        return { status: 404, jsonBody: { error: 'Event not found' } };
      }
      throw err;
    }

    const config = JSON.parse(event.config);

    // Count votes
    const votes = votesTable.listEntities<VoteEntity>({
      queryOptions: { filter: `PartitionKey eq '${eventId}'` },
    });

    let totalVotes = 0;
    const uniqueVoters = new Set<string>();
    const perOption: Record<string, number> = {};

    for await (const vote of votes) {
      totalVotes += vote.voteCount;
      uniqueVoters.add(vote.voterId);
      perOption[vote.optionId] = (perOption[vote.optionId] || 0) + vote.voteCount;
    }

    const response: any = {
      displayMode: config.liveVoteDisplay,
    };

    if (config.liveVoteDisplay === 'hidden' && event.status === 'open') {
      response.totalVoters = uniqueVoters.size;
    } else if (config.liveVoteDisplay === 'total') {
      response.totalVotes = totalVotes;
      response.totalVoters = uniqueVoters.size;
    } else if (config.liveVoteDisplay === 'per-option') {
      response.totalVotes = totalVotes;
      response.totalVoters = uniqueVoters.size;
      response.perOption = perOption;
    }

    // Always show full counts when not open (post-voting)
    if (event.status !== 'open') {
      response.totalVotes = totalVotes;
      response.totalVoters = uniqueVoters.size;
      response.perOption = perOption;
    }

    return { jsonBody: response };
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error: any): HttpResponseInit {
  if (error instanceof AuthError) {
    return { status: error.statusCode, jsonBody: { error: error.message } };
  }
  console.error('Unexpected error:', error);
  return { status: 500, jsonBody: { error: 'Internal server error' } };
}

// Register routes
app.http('submitVotes', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'events/{eventId}/vote',
  handler: submitVotes,
});

app.http('getMyVotes', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'events/{eventId}/vote',
  handler: getMyVotes,
});

app.http('getVoteCounts', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'events/{eventId}/vote/count',
  handler: getVoteCounts,
});
