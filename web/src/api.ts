const API_BASE = '/api';
const isDev = import.meta.env.DEV;

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Get auth headers for dev mode mock auth.
 * In production, SWA automatically injects x-ms-client-principal
 * for managed API functions — no manual forwarding needed.
 */
function getAuthHeaders(): Record<string, string> {
  if (isDev) {
    const stored = localStorage.getItem('mockAuthPrincipal');
    return stored ? { 'x-ms-client-principal': btoa(stored) } : {};
  }
  return {};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const authHeaders = getAuthHeaders();
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options?.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'Network error — check your connection');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error || res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Auth
export const api = {
  // Auth
  getMe: () => request<import('./types.ts').MeResponse>('/me'),

  // Events (votekeeper)
  listEvents: () => request<import('./types.ts').VoteEvent[]>('/events'),
  getEvent: (eventId: string) =>
    request<import('./types.ts').VoteEvent>(`/events/${eventId}`),
  createEvent: (data: { name: string; config?: Partial<import('./types.ts').EventConfig> }) =>
    request<import('./types.ts').VoteEvent>('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateEvent: (eventId: string, data: { name?: string; config?: Partial<import('./types.ts').EventConfig> }) =>
    request<import('./types.ts').VoteEvent>(`/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteEvent: (eventId: string) =>
    request<void>(`/events/${eventId}`, { method: 'DELETE' }),
  openVoting: (eventId: string) =>
    request<import('./types.ts').VoteEvent>(`/events/${eventId}/open`, { method: 'POST' }),
  closeVoting: (eventId: string) =>
    request<import('./types.ts').VoteEvent>(`/events/${eventId}/close`, { method: 'POST' }),
  reveal: (eventId: string) =>
    request<{ status: string; revealedCount: number; totalOptions: number; isComplete: boolean }>(
      `/events/${eventId}/reveal`,
      { method: 'POST' },
    ),
  completeEvent: (eventId: string) =>
    request<import('./types.ts').VoteEvent>(`/events/${eventId}/complete`, { method: 'POST' }),

  // Options (votekeeper)
  listOptions: (eventId: string) =>
    request<import('./types.ts').VotingOption[]>(`/events/${eventId}/options`),
  addOption: (eventId: string, data: { title: string; description?: string }) =>
    request<import('./types.ts').VotingOption>(`/events/${eventId}/options`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateOption: (eventId: string, optionId: string, data: { title?: string; description?: string; order?: number }) =>
    request<import('./types.ts').VotingOption>(`/events/${eventId}/options/${optionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteOption: (eventId: string, optionId: string) =>
    request<void>(`/events/${eventId}/options/${optionId}`, { method: 'DELETE' }),
  reorderOptions: (eventId: string, optionIds: string[]) =>
    request<{ success: boolean }>(`/events/${eventId}/options/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ optionIds }),
    }),

  // Voting (public)
  getPublicEvent: (eventId: string) =>
    request<import('./types.ts').EventPublicResponse>(`/events/${eventId}/public`),
  submitVotes: (
    eventId: string,
    data: { voterName: string; allocations: Record<string, number> },
    deviceFingerprint: string,
  ) =>
    request<{ success: boolean; sessionId: string; allocations: Record<string, number>; voterName: string }>(
      `/events/${eventId}/vote`,
      {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
          'x-device-fingerprint': deviceFingerprint,
        },
      },
    ),
  getMyVotes: (eventId: string, deviceFingerprint: string) =>
    request<import('./types.ts').VoterSession>(`/events/${eventId}/vote`, {
      headers: {
        'Content-Type': 'application/json',
        'x-device-fingerprint': deviceFingerprint,
      },
    }),
  getVoteCounts: (eventId: string) =>
    request<import('./types.ts').VoteCountsResponse>(`/events/${eventId}/vote/count`),

  // Results
  getResults: (eventId: string) =>
    request<import('./types.ts').ResultsResponse>(`/events/${eventId}/results`),
  getRevealStatus: (eventId: string) =>
    request<import('./types.ts').RevealStatusResponse>(`/events/${eventId}/results/status`),
  getPdfUrl: (eventId: string) => `${API_BASE}/events/${eventId}/results/pdf`,

  // Votekeepers
  seedVotekeeper: () =>
    request<{ userId: string; displayName: string }>('/votekeepers/seed', { method: 'POST' }),
};

export { ApiError };
