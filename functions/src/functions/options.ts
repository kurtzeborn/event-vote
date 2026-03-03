import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireVotekeeper } from '../auth.js';
import { votingOptionsTable } from '../storage.js';
import { CreateOptionRequest, UpdateOptionRequest, VotingOptionEntity, VotingOption } from '../types.js';
import { ensureTables, handleError, entityToOption, getOwnedEventEntity, isErrorResponse } from '../utils.js';
import { v4 as uuidv4 } from 'uuid';

// POST /api/events/{eventId}/options - Add a voting option
async function addOption(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await ensureTables();
    const user = await requireVotekeeper(request);
    const eventId = request.params.eventId;

    const result = await getOwnedEventEntity(eventId, user.userDetails.toLowerCase());
    if (isErrorResponse(result)) return result;
    const event = result;

    // Can add options during setup or open
    if (event.status !== 'setup' && event.status !== 'open') {
      return { status: 400, jsonBody: { error: 'Can only add options during setup or while voting is open' } };
    }

    const body = await request.json() as CreateOptionRequest;
    if (!body.title || body.title.trim().length === 0) {
      return { status: 400, jsonBody: { error: 'Option title is required' } };
    }
    if (body.title.length > 200) {
      return { status: 400, jsonBody: { error: 'Option title must be 200 characters or less' } };
    }

    // Determine next order
    let maxOrder = 0;
    const existingOptions = votingOptionsTable.listEntities<VotingOptionEntity>({
      queryOptions: { filter: `PartitionKey eq '${eventId}'` },
    });
    for await (const opt of existingOptions) {
      if (opt.order > maxOrder) maxOrder = opt.order;
    }

    const optionId = uuidv4();
    const entity: VotingOptionEntity = {
      partitionKey: eventId,
      rowKey: `option_${optionId}`,
      title: body.title.trim(),
      description: body.description?.trim(),
      order: maxOrder + 1,
      createdAt: new Date().toISOString(),
    };

    await votingOptionsTable.createEntity(entity);

    return { status: 201, jsonBody: entityToOption(entity) };
  } catch (error) {
    return handleError(error);
  }
}

// GET /api/events/{eventId}/options - List options for an event
async function listOptions(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await ensureTables();
    const eventId = request.params.eventId;

    // Public endpoint - anyone with the event code can see options
    const options: VotingOption[] = [];
    const entities = votingOptionsTable.listEntities<VotingOptionEntity>({
      queryOptions: { filter: `PartitionKey eq '${eventId}'` },
    });
    for await (const entity of entities) {
      options.push(entityToOption(entity));
    }

    options.sort((a, b) => a.order - b.order);

    return { jsonBody: options };
  } catch (error) {
    return handleError(error);
  }
}

// PATCH /api/events/{eventId}/options/{optionId} - Update an option
async function updateOption(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await ensureTables();
    const user = await requireVotekeeper(request);
    const eventId = request.params.eventId;
    const optionId = request.params.optionId;

    const result = await getOwnedEventEntity(eventId, user.userDetails.toLowerCase());
    if (isErrorResponse(result)) return result;
    const event = result;

    // Can update during setup or open
    if (event.status !== 'setup' && event.status !== 'open') {
      return { status: 400, jsonBody: { error: 'Can only update options during setup or while voting is open' } };
    }

    const body = await request.json() as UpdateOptionRequest;

    let entity: VotingOptionEntity;
    try {
      entity = await votingOptionsTable.getEntity<VotingOptionEntity>(eventId, `option_${optionId}`);
    } catch (err: any) {
      if (err.statusCode === 404) {
        return { status: 404, jsonBody: { error: 'Option not found' } };
      }
      throw err;
    }

    if (body.title !== undefined) {
      if (body.title.trim().length === 0) {
        return { status: 400, jsonBody: { error: 'Option title is required' } };
      }
      entity.title = body.title.trim();
    }
    if (body.description !== undefined) {
      entity.description = body.description?.trim();
    }
    if (body.order !== undefined) {
      entity.order = body.order;
    }

    await votingOptionsTable.updateEntity(entity, 'Merge');

    return { jsonBody: entityToOption(entity) };
  } catch (error) {
    return handleError(error);
  }
}

// DELETE /api/events/{eventId}/options/{optionId} - Delete an option
async function deleteOption(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await ensureTables();
    const user = await requireVotekeeper(request);
    const eventId = request.params.eventId;
    const optionId = request.params.optionId;

    const result = await getOwnedEventEntity(eventId, user.userDetails.toLowerCase());
    if (isErrorResponse(result)) return result;
    const event = result;

    // Can delete during setup or open
    if (event.status !== 'setup' && event.status !== 'open') {
      return { status: 400, jsonBody: { error: 'Can only delete options during setup or while voting is open' } };
    }

    try {
      await votingOptionsTable.deleteEntity(eventId, `option_${optionId}`);
    } catch (err: any) {
      if (err.statusCode === 404) {
        return { status: 404, jsonBody: { error: 'Option not found' } };
      }
      throw err;
    }

    return { status: 204 };
  } catch (error) {
    return handleError(error);
  }
}

// PATCH /api/events/{eventId}/options/reorder - Reorder options
async function reorderOptions(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await ensureTables();
    const user = await requireVotekeeper(request);
    const eventId = request.params.eventId;

    const result = await getOwnedEventEntity(eventId, user.userDetails.toLowerCase());
    if (isErrorResponse(result)) return result;
    const event = result;

    if (event.status !== 'setup' && event.status !== 'open') {
      return { status: 400, jsonBody: { error: 'Can only reorder options during setup or while voting is open' } };
    }

    const body = await request.json() as { optionIds: string[] };
    if (!Array.isArray(body.optionIds) || body.optionIds.length === 0) {
      return { status: 400, jsonBody: { error: 'optionIds array is required' } };
    }

    // Update each option's order based on position in array
    const updates: Promise<any>[] = [];
    for (let i = 0; i < body.optionIds.length; i++) {
      updates.push(
        votingOptionsTable.updateEntity(
          { partitionKey: eventId, rowKey: `option_${body.optionIds[i]}`, order: i + 1 },
          'Merge',
        ),
      );
    }
    await Promise.all(updates);

    return { jsonBody: { success: true } };
  } catch (error) {
    return handleError(error);
  }
}

// Register routes
app.http('addOption', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'events/{eventId}/options',
  handler: addOption,
});

app.http('listOptions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'events/{eventId}/options',
  handler: listOptions,
});

app.http('updateOption', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'events/{eventId}/options/{optionId}',
  handler: updateOption,
});

app.http('deleteOption', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'events/{eventId}/options/{optionId}',
  handler: deleteOption,
});

app.http('reorderOptions', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'events/{eventId}/options/reorder',
  handler: reorderOptions,
});
