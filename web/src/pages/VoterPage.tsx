import { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api.ts';
import { getDeviceFingerprint } from '../utils/fingerprint.ts';
import type { EventPublicResponse, VotingOption, VoterSession, VoteCountsResponse } from '../types.ts';

// --- localStorage session helpers ---
const SESSION_KEY_PREFIX = 'evote_session_';

interface LocalSession {
  voterName: string;
  allocations: Record<string, number>;
  hasVoted: boolean;
}

function loadSession(eventId: string): LocalSession | null {
  try {
    const raw = localStorage.getItem(`${SESSION_KEY_PREFIX}${eventId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(eventId: string, session: LocalSession) {
  try {
    localStorage.setItem(`${SESSION_KEY_PREFIX}${eventId}`, JSON.stringify(session));
  } catch { /* localStorage full or blocked — ignore */ }
}

function clearSession(eventId: string) {
  try { localStorage.removeItem(`${SESSION_KEY_PREFIX}${eventId}`); } catch { /* ignore */ }
}

export default function VoterPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const queryClient = useQueryClient();
  const fingerprint = useMemo(() => getDeviceFingerprint(), []);

  // Fetch public event info
  const {
    data: event,
    isLoading: eventLoading,
    error: eventError,
  } = useQuery({
    queryKey: ['publicEvent', eventId],
    queryFn: () => api.getPublicEvent(eventId!),
    enabled: !!eventId,
    refetchInterval: 5000,
  });

  // Fetch voting options
  const { data: options } = useQuery({
    queryKey: ['options', eventId],
    queryFn: () => api.listOptions(eventId!),
    enabled: !!eventId && event?.status === 'open',
    refetchInterval: 10000,
  });

  // Fetch my votes
  const { data: myVotes } = useQuery({
    queryKey: ['myVotes', eventId],
    queryFn: () => api.getMyVotes(eventId!, fingerprint),
    enabled: !!eventId,
  });

  // Fetch vote counts for live updates
  const { data: voteCounts } = useQuery({
    queryKey: ['voteCounts', eventId],
    queryFn: () => api.getVoteCounts(eventId!),
    enabled: !!eventId && (event?.status === 'open' || event?.status === 'closed'),
    refetchInterval: 3000,
  });

  if (eventLoading) {
    return <LoadingScreen />;
  }

  if (eventError) {
    const isExpired = eventError instanceof ApiError && eventError.status === 410;
    const errMsg = isExpired
      ? 'This event has expired.'
      : eventError instanceof ApiError && eventError.status === 404
        ? 'Event not found. Check your code and try again.'
        : 'Failed to load event. Please try again.';
    return <ErrorScreen message={errMsg} />;
  }

  if (!event) return <ErrorScreen message="Event not found" />;

  // Route based on event status
  switch (event.status) {
    case 'setup':
      return <WaitingScreen event={event} message="Voting hasn't started yet. Hang tight!" />;
    case 'open':
      return (
        <VotingView
          event={event}
          options={options ?? []}
          myVotes={myVotes ?? null}
          voteCounts={voteCounts ?? null}
          fingerprint={fingerprint}
          queryClient={queryClient}
        />
      );
    case 'closed':
      return <WaitingScreen event={event} message="Voting is closed. Results coming soon!" voteCounts={voteCounts} />;
    case 'revealing':
    case 'complete':
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
            <h1 className="text-xl font-bold text-gray-900 mb-2">{event.name}</h1>
            <p className="text-gray-600 mb-4">Results are being revealed!</p>
            <Link
              to={`/results/${eventId}`}
              className="inline-block bg-indigo-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              View Results
            </Link>
          </div>
        </div>
      );
  }
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600">
      <div className="text-white text-xl animate-pulse">Loading...</div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
        <p className="text-red-600 text-lg mb-4">{message}</p>
        <Link to="/" className="text-indigo-600 hover:text-indigo-800 font-medium">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}

function WaitingScreen({
  event,
  message,
  voteCounts,
}: {
  event: EventPublicResponse;
  message: string;
  voteCounts?: VoteCountsResponse | null;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">{event.name}</h1>
        <div className="text-4xl mb-4 animate-pulse">⏳</div>
        <p className="text-gray-600 mb-4">{message}</p>
        {voteCounts?.totalVoters !== undefined && (
          <p className="text-sm text-gray-400">{voteCounts.totalVoters} voters participated</p>
        )}
        <p className="text-xs text-gray-400 mt-4">This page auto-refreshes</p>
      </div>
    </div>
  );
}

function VotingView({
  event,
  options,
  myVotes,
  voteCounts,
  fingerprint,
  queryClient,
}: {
  event: EventPublicResponse;
  options: VotingOption[];
  myVotes: VoterSession | null;
  voteCounts: VoteCountsResponse | null;
  fingerprint: string;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const local = loadSession(event.id);
  const [voterName, setVoterName] = useState(myVotes?.voterName ?? local?.voterName ?? '');
  const [allocations, setAllocations] = useState<Record<string, number>>(
    myVotes?.hasVoted ? myVotes.allocations : local?.allocations ?? {},
  );
  const [submitted, setSubmitted] = useState(myVotes?.hasVoted ?? local?.hasVoted ?? false);
  const [error, setError] = useState('');

  // Persist session to localStorage on changes
  useEffect(() => {
    saveSession(event.id, { voterName, allocations, hasVoted: submitted });
  }, [event.id, voterName, allocations, submitted]);

  const totalAllocated = Object.values(allocations).reduce((sum, v) => sum + v, 0);
  const remaining = event.config.votesPerAttendee - totalAllocated;

  const mutation = useMutation({
    mutationFn: () =>
      api.submitVotes(event.id, { voterName: voterName.trim(), allocations }, fingerprint),
    onSuccess: () => {
      setSubmitted(true);
      setError('');
      queryClient.invalidateQueries({ queryKey: ['myVotes', event.id] });
      queryClient.invalidateQueries({ queryKey: ['voteCounts', event.id] });
    },
    onError: (err: Error) => {
      if (err instanceof ApiError && err.status === 409) {
        setError('Voting has closed. Your votes were not submitted.');
        setSubmitted(false);
      } else if (err instanceof ApiError && err.status === 410) {
        setError('This event has expired.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to submit votes. Check your connection and try again.');
      }
    },
  });

  const addVote = (optionId: string) => {
    if (remaining <= 0) return;
    setAllocations((prev) => ({ ...prev, [optionId]: (prev[optionId] || 0) + 1 }));
    setSubmitted(false);
  };

  const removeVote = (optionId: string) => {
    setAllocations((prev) => {
      const current = prev[optionId] || 0;
      if (current <= 0) return prev;
      const updated = { ...prev, [optionId]: current - 1 };
      if (updated[optionId] === 0) delete updated[optionId];
      return updated;
    });
    setSubmitted(false);
  };

  const handleSubmit = () => {
    if (!voterName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (totalAllocated === 0) {
      setError('Allocate at least one vote');
      return;
    }
    mutation.mutate();
  };

  const nameEntered = voterName.trim().length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 p-4 pb-28">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6 pt-4">
          <h1 className="text-2xl font-bold text-white">{event.name}</h1>
          <p className="text-white/80 text-sm mt-1">
            You have {event.config.votesPerAttendee} vote{event.config.votesPerAttendee !== 1 ? 's' : ''} to allocate
          </p>
        </div>

        {/* Voter name — editable until first submission, then read-only */}
        {submitted || myVotes?.hasVoted ? (
          <div className="bg-indigo-600/30 rounded-xl p-4 mb-4 text-center">
            <h2 className="text-lg font-semibold text-white">{voterName.trim()}'s Votes</h2>
          </div>
        ) : (
          <div className="bg-white rounded-xl p-4 mb-4 shadow-lg">
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
            <input
              type="text"
              value={voterName}
              onChange={(e) => {
                setVoterName(e.target.value);
                setSubmitted(false);
              }}
              placeholder="Enter your name to vote"
              maxLength={100}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        )}

        {/* Vote allocation — only visible after name is entered */}
        {nameEntered ? (
          <>
            <div className="space-y-3 mb-4">
              {options.map((option) => (
                <div key={option.id} className="bg-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 mr-3">
                      <h3 className="font-semibold text-gray-900">{option.title}</h3>
                      {option.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{option.description}</p>
                      )}
                      {/* Live vote counts */}
                      {voteCounts?.displayMode === 'per-option' && voteCounts.perOption && (
                        <p className="text-xs text-indigo-500 mt-1">
                          {voteCounts.perOption[option.id] ?? 0} votes
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => removeVote(option.id)}
                        disabled={!allocations[option.id]}
                        className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 font-bold text-lg flex items-center justify-center hover:bg-gray-200 disabled:opacity-30 transition-colors"
                      >
                        −
                      </button>
                      <span className="w-8 text-center font-bold text-lg tabular-nums">
                        {allocations[option.id] || 0}
                      </span>
                      <button
                        onClick={() => addVote(option.id)}
                        disabled={remaining <= 0}
                        className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-bold text-lg flex items-center justify-center hover:bg-indigo-200 disabled:opacity-30 transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Reset button */}
            {totalAllocated > 0 && (
              <div className="text-center mb-3">
                <button
                  onClick={() => {
                    setAllocations({});
                    setSubmitted(false);
                    clearSession(event.id);
                  }}
                  className="text-white/70 hover:text-white text-sm underline"
                >
                  Reset All Votes
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-white/70 text-lg">Enter your name above to start voting</p>
          </div>
        )}

        {/* Live total counts */}
        {voteCounts?.displayMode === 'total' && voteCounts.totalVoters !== undefined && (
          <p className="text-center text-white/70 text-sm mb-3">
            {voteCounts.totalVoters} voter{voteCounts.totalVoters !== 1 ? 's' : ''} so far
            ({voteCounts.totalVotes} total votes)
          </p>
        )}

        {/* Remaining votes - sticky bottom bar on mobile (only when name entered) */}
        {nameEntered && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-4 py-3 flex items-center justify-between z-40 safe-area-pb">
          <span
            className={`inline-block px-4 py-1 rounded-full text-sm font-medium ${
              remaining > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-green-100 text-green-700'
            }`}
          >
            {remaining > 0 ? `${remaining} vote${remaining !== 1 ? 's' : ''} remaining` : 'All votes allocated!'}
          </span>

          {submitted ? (
            <span className="text-green-600 font-semibold text-sm">✓ Submitted</span>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={mutation.isPending || totalAllocated === 0}
              className="bg-indigo-600 text-white font-bold py-2 px-5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm"
            >
              {mutation.isPending ? 'Submitting...' : myVotes?.hasVoted ? 'Update' : 'Submit'}
            </button>
          )}
        </div>
        )}

        {/* Submit status / change votes */}
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-700 rounded-xl p-3 mb-3 text-center text-sm">
            {error}
          </div>
        )}

        {submitted && (
          <div className="bg-green-500 text-white rounded-xl p-4 text-center shadow-lg">
            <p className="font-semibold text-lg">✓ Votes Submitted!</p>
            <p className="text-sm text-white/80 mt-1">You can change your votes until voting closes</p>
            <button
              onClick={() => setSubmitted(false)}
              className="mt-3 underline text-sm"
            >
              Change Votes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
