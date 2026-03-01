import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireVotekeeper } from '../auth.js';
import { eventsTable, votingOptionsTable, votesTable } from '../storage.js';
import { generateEventCode } from '../services/codeGenerator.js';
import { CreateEventRequest, EventEntity, VoteEvent, EventConfig, VotingOptionEntity, VotingOption, VoteEntity } from '../types.js';
import { ensureTables, handleError, entityToEvent, entityToOption, getOwnedEventEntity, isErrorResponse } from '../utils.js';

// POST /api/events - Create new event
async function createEvent(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await ensureTables();
    const user = await requireVotekeeper(request);
    const body = await request.json() as CreateEventRequest;

    if (!body.name || body.name.trim().length === 0) {
      return { status: 400, jsonBody: { error: 'Event name is required' } };
    }
    if (body.name.length > 200) {
      return { status: 400, jsonBody: { error: 'Event name must be 200 characters or less' } };
    }

    const eventId = await generateEventCode();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const config: EventConfig = {
      votesPerAttendee: body.config?.votesPerAttendee ?? 3,
      liveVoteDisplay: body.config?.liveVoteDisplay ?? 'total',
    };

    // Validate config
    if (config.votesPerAttendee < 1 || config.votesPerAttendee > 10) {
      return { status: 400, jsonBody: { error: 'Votes per attendee must be between 1 and 10' } };
    }
    if (!['hidden', 'total', 'per-option'].includes(config.liveVoteDisplay)) {
      return { status: 400, jsonBody: { error: 'Invalid live vote display option' } };
    }

    const entity: EventEntity = {
      partitionKey: 'event',
      rowKey: eventId,
      name: body.name.trim(),
      createdBy: user.userId,
      createdAt: now,
      status: 'setup',
      config: JSON.stringify(config),
      expiresAt,
    };

    await eventsTable.createEntity(entity);

    return {
      status: 201,
      jsonBody: entityToEvent(entity),
    };
  } catch (error) {
    return handleError(error);
  }
}

// GET /api/events - List my events
async function listEvents(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await ensureTables();
    const user = await requireVotekeeper(request);

    const events: VoteEvent[] = [];
    const entities = eventsTable.listEntities<EventEntity>({
      queryOptions: {
        filter: `PartitionKey eq 'event' and createdBy eq '${user.userId}'`,
      },
    });

    for await (const entity of entities) {
      events.push(entityToEvent(entity));
    }

    // Sort by createdAt descending
    events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { jsonBody: events };
  } catch (error) {
    return handleError(error);
  }
}

// GET /api/events/{eventId} - Get event details (Votekeeper view)
async function getEvent(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await ensureTables();
    const user = await requireVotekeeper(request);
    const eventId = request.params.eventId;

    const result = await getOwnedEventEntity(eventId, user.userId);
    if (isErrorResponse(result)) return result;

    const event = entityToEvent(result);

    // Also fetch options
    const options: VotingOption[] = [];
    const optionEntities = votingOptionsTable.listEntities<VotingOptionEntity>({
      queryOptions: { filter: `PartitionKey eq '${eventId}'` },
    });
    for await (const optEntity of optionEntities) {
      options.push(entityToOption(optEntity));
    }
    options.sort((a, b) => a.order - b.order);

    return { jsonBody: { ...event, options } };
  } catch (error) {
    return handleError(error);
  }
}

// PATCH /api/events/{eventId} - Update event config
async function updateEvent(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await ensureTables();
    const user = await requireVotekeeper(request);
    const eventId = request.params.eventId;

    const result = await getOwnedEventEntity(eventId, user.userId);
    if (isErrorResponse(result)) return result;
    const entity = result;

    if (entity.status !== 'setup') {
      return { status: 400, jsonBody: { error: 'Can only update config during setup' } };
    }

    const body = await request.json() as Partial<{ name: string; config: Partial<EventConfig> }>;

    if (body.name !== undefined) {
      if (body.name.trim().length === 0) {
        return { status: 400, jsonBody: { error: 'Event name is required' } };
      }
      entity.name = body.name.trim();
    }

    if (body.config) {
      const currentConfig: EventConfig = JSON.parse(entity.config);
      if (body.config.votesPerAttendee !== undefined) {
        if (body.config.votesPerAttendee < 1 || body.config.votesPerAttendee > 10) {
          return { status: 400, jsonBody: { error: 'Votes per attendee must be between 1 and 10' } };
        }
        currentConfig.votesPerAttendee = body.config.votesPerAttendee;
      }
      if (body.config.liveVoteDisplay !== undefined) {
        if (!['hidden', 'total', 'per-option'].includes(body.config.liveVoteDisplay)) {
          return { status: 400, jsonBody: { error: 'Invalid live vote display option' } };
        }
        currentConfig.liveVoteDisplay = body.config.liveVoteDisplay;
      }
      entity.config = JSON.stringify(currentConfig);
    }

    await eventsTable.updateEntity(entity, 'Merge');

    return { jsonBody: entityToEvent(entity) };
  } catch (error) {
    return handleError(error);
  }
}

// DELETE /api/events/{eventId} - Delete event and all associated data
async function deleteEvent(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await ensureTables();
    const user = await requireVotekeeper(request);
    const eventId = request.params.eventId;

    const result = await getOwnedEventEntity(eventId, user.userId);
    if (isErrorResponse(result)) return result;

    // Delete all voting options
    const optionEntities = votingOptionsTable.listEntities<VotingOptionEntity>({
      queryOptions: { filter: `PartitionKey eq '${eventId}'` },
    });
    for await (const opt of optionEntities) {
      await votingOptionsTable.deleteEntity(opt.partitionKey, opt.rowKey);
    }

    // Delete all votes
    const voteEntities = votesTable.listEntities<VoteEntity>({
      queryOptions: { filter: `PartitionKey eq '${eventId}'` },
    });
    for await (const vote of voteEntities) {
      await votesTable.deleteEntity(vote.partitionKey, vote.rowKey);
    }

    // Delete the event
    await eventsTable.deleteEntity('event', eventId);

    return { status: 204 };
  } catch (error) {
    return handleError(error);
  }
}

// POST /api/events/{eventId}/open - Open voting
async function openVoting(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await ensureTables();
    const user = await requireVotekeeper(request);
    const eventId = request.params.eventId;

    const result = await getOwnedEventEntity(eventId, user.userId);
    if (isErrorResponse(result)) return result;
    const entity = result;

    if (entity.status !== 'setup') {
      return { status: 400, jsonBody: { error: 'Can only open voting from setup status' } };
    }

    // Ensure at least one option exists
    const options = votingOptionsTable.listEntities<VotingOptionEntity>({
      queryOptions: { filter: `PartitionKey eq '${eventId}'` },
    });
    let optionCount = 0;
    for await (const _ of options) {
      optionCount++;
      break; // Just need to know there's at least one
    }
    if (optionCount === 0) {
      return { status: 400, jsonBody: { error: 'Add at least one voting option before opening voting' } };
    }

    entity.status = 'open';
    entity.openedAt = new Date().toISOString();
    await eventsTable.updateEntity(entity, 'Merge');

    return { jsonBody: entityToEvent(entity) };
  } catch (error) {
    return handleError(error);
  }
}

// POST /api/events/{eventId}/close - Close voting
async function closeVoting(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await ensureTables();
    const user = await requireVotekeeper(request);
    const eventId = request.params.eventId;

    const result = await getOwnedEventEntity(eventId, user.userId);
    if (isErrorResponse(result)) return result;
    const entity = result;

    if (entity.status !== 'open') {
      return { status: 400, jsonBody: { error: 'Can only close voting when it is open' } };
    }

    entity.status = 'closed';
    entity.closedAt = new Date().toISOString();
    await eventsTable.updateEntity(entity, 'Merge');

    return { jsonBody: entityToEvent(entity) };
  } catch (error) {
    return handleError(error);
  }
}

// POST /api/events/{eventId}/reveal - Start or advance reveal
async function reveal(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await ensureTables();
    const user = await requireVotekeeper(request);
    const eventId = request.params.eventId;

    const result = await getOwnedEventEntity(eventId, user.userId);
    if (isErrorResponse(result)) return result;
    const entity = result;

    if (entity.status !== 'closed' && entity.status !== 'revealing') {
      return { status: 400, jsonBody: { error: 'Can only reveal results after voting is closed' } };
    }

    // Count total options
    const optionEntities = votingOptionsTable.listEntities<VotingOptionEntity>({
      queryOptions: { filter: `PartitionKey eq '${eventId}'` },
    });
    let totalOptions = 0;
    for await (const _ of optionEntities) {
      totalOptions++;
    }

    const currentRevealed = entity.revealedCount ?? 0;

    if (entity.status === 'closed') {
      // Start revealing
      entity.status = 'revealing';
      entity.revealedCount = 1;
    } else {
      // Advance reveal
      entity.revealedCount = Math.min(currentRevealed + 1, totalOptions);
    }

    await eventsTable.updateEntity(entity, 'Merge');

    return {
      jsonBody: {
        status: entity.status,
        revealedCount: entity.revealedCount,
        totalOptions,
        isComplete: entity.revealedCount! >= totalOptions,
      },
    };
  } catch (error) {
    return handleError(error);
  }
}

// POST /api/events/{eventId}/complete - Finalize event
async function completeEvent(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await ensureTables();
    const user = await requireVotekeeper(request);
    const eventId = request.params.eventId;

    const result = await getOwnedEventEntity(eventId, user.userId);
    if (isErrorResponse(result)) return result;
    const entity = result;

    if (entity.status !== 'revealing') {
      return { status: 400, jsonBody: { error: 'Can only complete event after revealing' } };
    }

    entity.status = 'complete';
    await eventsTable.updateEntity(entity, 'Merge');

    return { jsonBody: entityToEvent(entity) };
  } catch (error) {
    return handleError(error);
  }
}

// Register all event routes
app.http('createEvent', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'events',
  handler: createEvent,
});

app.http('listEvents', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'events',
  handler: listEvents,
});

app.http('getEvent', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'events/{eventId}',
  handler: getEvent,
});

app.http('updateEvent', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'events/{eventId}',
  handler: updateEvent,
});

app.http('deleteEvent', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'events/{eventId}',
  handler: deleteEvent,
});

app.http('openVoting', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'events/{eventId}/open',
  handler: openVoting,
});

app.http('closeVoting', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'events/{eventId}/close',
  handler: closeVoting,
});

app.http('reveal', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'events/{eventId}/reveal',
  handler: reveal,
});

app.http('completeEvent', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'events/{eventId}/complete',
  handler: completeEvent,
});
