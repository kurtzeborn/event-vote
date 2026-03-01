import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext.tsx';
import { api } from '../api.ts';
import type { VoteEvent } from '../types.ts';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  setup: { label: 'Setup', color: 'bg-gray-200 text-gray-700' },
  open: { label: 'Voting Open', color: 'bg-green-100 text-green-700' },
  closed: { label: 'Voting Closed', color: 'bg-yellow-100 text-yellow-700' },
  revealing: { label: 'Revealing', color: 'bg-purple-100 text-purple-700' },
  complete: { label: 'Complete', color: 'bg-blue-100 text-blue-700' },
};

export default function DashboardPage() {
  const { isAuthenticated, isVotekeeper, isLoading: authLoading, login } = useAuth();
  const queryClient = useQueryClient();

  // Seed mutation for first-time setup
  const seedMutation = useMutation({
    mutationFn: api.seedVotekeeper,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  const {
    data: events,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['events'],
    queryFn: api.listEvents,
    enabled: isVotekeeper,
  });

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      login();
    }
  }, [authLoading, isAuthenticated, login]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 animate-pulse">Loading...</div>
      </div>
    );
  }

  // Authenticated but not a votekeeper - offer seed
  if (isAuthenticated && !isVotekeeper) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Welcome!</h1>
          <p className="text-gray-600 mb-6">
            You're signed in but don't have votekeeper access yet.
          </p>
          <button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="bg-indigo-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {seedMutation.isPending ? 'Setting up...' : 'Become First Votekeeper'}
          </button>
          {seedMutation.isError && (
            <p className="text-red-500 text-sm mt-3">
              {seedMutation.error?.message || 'Failed. Votekeepers may already exist.'}
            </p>
          )}
          {seedMutation.isSuccess && (
            <p className="text-green-600 text-sm mt-3">
              You're now a votekeeper! Refreshing...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-indigo-600">
            🗳️ Event Vote
          </Link>
          <Link
            to="/create"
            className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors text-sm"
          >
            + New Event
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">My Events</h2>

        {isLoading && <p className="text-gray-500 animate-pulse">Loading events...</p>}
        {error && <p className="text-red-500">Failed to load events</p>}

        {events && events.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-gray-500 mb-4">No events yet</p>
            <Link
              to="/create"
              className="inline-block bg-indigo-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Create Your First Event
            </Link>
          </div>
        )}

        {events && events.length > 0 && (
          <div className="grid gap-4">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function EventCard({ event }: { event: VoteEvent }) {
  const status = STATUS_LABELS[event.status] ?? STATUS_LABELS.setup;
  const navigate = useNavigate();

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => navigate(`/manage/${event.id}`)}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 text-lg">{event.name}</h3>
          <div className="flex items-center gap-3 mt-1">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
            <span className="text-sm text-gray-400 font-mono">{event.id}</span>
            <span className="text-sm text-gray-400">
              {new Date(event.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        <span className="text-gray-400 text-xl">→</span>
      </div>
    </div>
  );
}
