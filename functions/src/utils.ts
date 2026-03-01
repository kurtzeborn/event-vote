import { HttpResponseInit } from '@azure/functions';
import { AuthError } from './auth.js';
import { eventsTable, initializeTables } from './storage.js';
import { EventEntity, EventConfig, VoteEvent, VotingOption, VotingOptionEntity } from './types.js';

// --- Table initialization (shared across all function files) ---

let tablesInitialized = false;

export async function ensureTables(): Promise<void> {
  if (!tablesInitialized) {
    await initializeTables();
    tablesInitialized = true;
  }
}

// --- Shared error handler ---

export function handleError(error: unknown): HttpResponseInit {
  if (error instanceof AuthError) {
    return { status: error.statusCode, jsonBody: { error: error.message } };
  }
  console.error('Unexpected error:', error);
  return { status: 500, jsonBody: { error: 'Internal server error' } };
}

// --- Entity conversion helpers ---

export function entityToEvent(entity: EventEntity): VoteEvent {
  return {
    id: entity.rowKey,
    name: entity.name,
    createdBy: entity.createdBy,
    createdAt: entity.createdAt,
    status: entity.status,
    config: JSON.parse(entity.config) as EventConfig,
    openedAt: entity.openedAt,
    closedAt: entity.closedAt,
    expiresAt: entity.expiresAt,
    revealedCount: entity.revealedCount,
  };
}

export function entityToOption(entity: VotingOptionEntity): VotingOption {
  return {
    id: entity.rowKey.replace('option_', ''),
    eventId: entity.partitionKey,
    title: entity.title,
    description: entity.description,
    order: entity.order,
    createdAt: entity.createdAt,
  };
}

// --- Config parsing helper ---

export function parseEventConfig(entity: EventEntity): EventConfig {
  return JSON.parse(entity.config) as EventConfig;
}

// --- Common event fetch + ownership check ---

export async function getEventEntity(eventId: string): Promise<EventEntity | HttpResponseInit> {
  try {
    return await eventsTable.getEntity<EventEntity>('event', eventId);
  } catch (err: any) {
    if (err.statusCode === 404) {
      return { status: 404, jsonBody: { error: 'Event not found' } };
    }
    throw err;
  }
}

export async function getOwnedEventEntity(eventId: string, userId: string): Promise<EventEntity | HttpResponseInit> {
  const result = await getEventEntity(eventId);
  if (isErrorResponse(result)) return result;
  if (result.createdBy !== userId) {
    return { status: 403, jsonBody: { error: 'You are not the votekeeper for this event' } };
  }
  return result;
}

export function isErrorResponse(result: unknown): result is HttpResponseInit {
  return typeof result === 'object' && result !== null && 'status' in result && typeof (result as any).status === 'number';
}
