/** Shared types between web and functions (matching functions/src/types.ts) */

export type EventStatus = 'setup' | 'open' | 'closed' | 'revealing' | 'complete';

export interface AuthUser {
  userId: string;
  userDetails: string;
  identityProvider: string;
}

export interface MeResponse {
  isAuthenticated: boolean;
  isVotekeeper: boolean;
  user: AuthUser | null;
}

export interface EventConfig {
  votesPerAttendee: number;
  theme?: string;
}

export interface VoteEvent {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  status: EventStatus;
  config: EventConfig;
  openedAt?: string;
  closedAt?: string;
  expiresAt?: string;
  revealedCount?: number;
  options?: VotingOption[];
}

export interface VotingOption {
  id: string;
  eventId: string;
  title: string;
  description?: string;
  order: number;
  createdAt: string;
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

export interface VoterSession {
  hasVoted: boolean;
  allocations: Record<string, number>;
  voterName: string | null;
}

export interface VoteCountsResponse {
  totalVotes: number;
  totalVoters: number;
  perOption: Record<string, number>;
}

export interface EventPublicResponse {
  id: string;
  name: string;
  status: EventStatus;
  config: {
    votesPerAttendee: number;
    theme?: string;
  };
}
