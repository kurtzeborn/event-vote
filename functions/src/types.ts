// Shared types for Event Vote

// === API / Auth Types ===

export interface AuthUser {
  userId: string;
  userDetails: string; // email or display name
  identityProvider: string;
  userRoles: string[];
}

export interface MeResponse {
  isAuthenticated: boolean;
  isVotekeeper: boolean;
  user?: AuthUser;
}

// === Domain Types ===

export type EventStatus = 'setup' | 'open' | 'closed' | 'revealing' | 'complete';

export interface EventConfig {
  votesPerAttendee: number;     // Default 3, configurable 1-10
  theme?: string;               // Color theme ID (default: 'indigo')
}

export interface VoteEvent {
  id: string;                    // Auto-generated 4-letter code
  name: string;                  // Event title
  createdBy: string;             // Votekeeper's user ID
  createdAt: string;             // ISO date
  status: EventStatus;
  config: EventConfig;
  openedAt?: string;
  closedAt?: string;
  expiresAt?: string;            // Auto-expire after 24 hours
  revealedCount?: number;        // How many results have been revealed
}

export interface VotingOption {
  id: string;
  eventId: string;
  title: string;
  description?: string;
  order: number;
  createdAt: string;
}

export interface Votekeeper {
  userId: string;
  displayName: string;
  addedBy: string;
  addedAt: string;
}

// === Table Storage Entity Types ===

export interface EventEntity {
  partitionKey: string;          // 'event'
  rowKey: string;                // eventId
  name: string;
  createdBy: string;
  createdAt: string;
  status: EventStatus;
  config: string;                // JSON-serialized EventConfig
  openedAt?: string;
  closedAt?: string;
  expiresAt?: string;
  revealedCount?: number;
}

export interface VotingOptionEntity {
  partitionKey: string;          // eventId
  rowKey: string;                // 'option_{optionId}'
  title: string;
  description?: string;
  order: number;
  createdAt: string;
}

export interface VoteEntity {
  partitionKey: string;          // eventId
  rowKey: string;                // 'vote_{voterId}_{optionId}'
  voterId: string;
  voterName: string;
  optionId: string;
  voteCount: number;
  deviceFingerprint: string;
  sessionId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface VotekeeperEntity {
  partitionKey: string;          // 'votekeeper'
  rowKey: string;                // userId
  displayName: string;
  addedBy: string;
  addedAt: string;
}

// === API Request/Response Types ===

export interface CreateEventRequest {
  name: string;
  config?: Partial<EventConfig>;
}

export interface CreateOptionRequest {
  title: string;
  description?: string;
}

export interface UpdateOptionRequest {
  title?: string;
  description?: string;
  order?: number;
}

export interface SubmitVotesRequest {
  voterName: string;
  allocations: Record<string, number>; // optionId -> count
}

export interface OptionResult {
  optionId: string;
  title: string;
  description?: string;
  totalVotes: number;
  uniqueVoters: number;
  rank: number;
}

export interface ResultsResponse {
  eventId: string;
  eventName: string;
  status: EventStatus;
  theme?: string;
  totalVotes: number;
  totalVoters: number;
  revealedCount: number;
  totalOptions: number;
  results: OptionResult[];
}

export interface RevealStatusResponse {
  status: EventStatus;
  revealedCount: number;
  totalOptions: number;
}
