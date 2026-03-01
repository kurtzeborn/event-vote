import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireVotekeeper, AuthError } from '../auth.js';
import { votekeepersTable, initializeTables } from '../storage.js';
import { VotekeeperEntity, Votekeeper } from '../types.js';

let tablesInitialized = false;
async function ensureTables() {
  if (!tablesInitialized) {
    await initializeTables();
    tablesInitialized = true;
  }
}

function entityToVotekeeper(entity: VotekeeperEntity): Votekeeper {
  return {
    userId: entity.rowKey,
    displayName: entity.displayName,
    addedAt: entity.addedAt,
    addedBy: entity.addedBy,
  };
}

// GET /api/votekeepers - List all votekeepers
async function listVotekeepers(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await ensureTables();
    await requireVotekeeper(request);

    const votekeepers: Votekeeper[] = [];
    const entities = votekeepersTable.listEntities<VotekeeperEntity>({
      queryOptions: { filter: `PartitionKey eq 'votekeeper'` },
    });
    for await (const entity of entities) {
      votekeepers.push(entityToVotekeeper(entity));
    }

    return { jsonBody: votekeepers };
  } catch (error) {
    return handleError(error);
  }
}

// POST /api/votekeepers - Add a new votekeeper
async function addVotekeeper(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await ensureTables();
    const user = await requireVotekeeper(request);
    const body = await request.json() as { userId: string; displayName: string };

    if (!body.userId || !body.displayName) {
      return { status: 400, jsonBody: { error: 'userId and displayName are required' } };
    }

    const entity: VotekeeperEntity = {
      partitionKey: 'votekeeper',
      rowKey: body.userId,
      displayName: body.displayName.trim(),
      addedAt: new Date().toISOString(),
      addedBy: user.userId,
    };

    try {
      await votekeepersTable.createEntity(entity);
    } catch (err: any) {
      if (err.statusCode === 409) {
        return { status: 409, jsonBody: { error: 'Votekeeper already exists' } };
      }
      throw err;
    }

    return { status: 201, jsonBody: entityToVotekeeper(entity) };
  } catch (error) {
    return handleError(error);
  }
}

// DELETE /api/votekeepers/{userId} - Remove a votekeeper
async function removeVotekeeper(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await ensureTables();
    const user = await requireVotekeeper(request);
    const userId = request.params.userId;

    if (userId === user.userId) {
      return { status: 400, jsonBody: { error: 'Cannot remove yourself as a votekeeper' } };
    }

    try {
      await votekeepersTable.deleteEntity('votekeeper', userId);
    } catch (err: any) {
      if (err.statusCode === 404) {
        return { status: 404, jsonBody: { error: 'Votekeeper not found' } };
      }
      throw err;
    }

    return { status: 204 };
  } catch (error) {
    return handleError(error);
  }
}

// POST /api/votekeepers/seed - Seed initial votekeeper (first authenticated user)
async function seedVotekeeper(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await ensureTables();

    // This parses auth but doesn't require votekeeper role
    const header = request.headers.get('x-ms-client-principal');
    if (!header) {
      return { status: 401, jsonBody: { error: 'Authentication required' } };
    }
    const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf-8'));
    const userId = decoded.userId;
    const displayName = decoded.userDetails || decoded.userId;

    // Check if any votekeepers exist
    const existing = votekeepersTable.listEntities<VotekeeperEntity>({
      queryOptions: { filter: `PartitionKey eq 'votekeeper'` },
    });
    let count = 0;
    for await (const _ of existing) {
      count++;
      break;
    }
    if (count > 0) {
      return { status: 400, jsonBody: { error: 'Votekeepers already exist. Use POST /api/votekeepers to add more.' } };
    }

    const entity: VotekeeperEntity = {
      partitionKey: 'votekeeper',
      rowKey: userId,
      displayName: displayName,
      addedAt: new Date().toISOString(),
      addedBy: 'system',
    };

    await votekeepersTable.createEntity(entity);

    return { status: 201, jsonBody: entityToVotekeeper(entity) };
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
app.http('listVotekeepers', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'votekeepers',
  handler: listVotekeepers,
});

app.http('addVotekeeper', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'votekeepers',
  handler: addVotekeeper,
});

app.http('removeVotekeeper', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'votekeepers/{userId}',
  handler: removeVotekeeper,
});

app.http('seedVotekeeper', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'votekeepers/seed',
  handler: seedVotekeeper,
});
