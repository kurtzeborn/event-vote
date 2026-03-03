import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext.tsx';
import { api } from '../api.ts';
import type { VoteEvent } from '../types.ts';
import { STATUS_LABELS } from '../constants.ts';

export default function DashboardPage() {
  const { isAuthenticated, isVotekeeper, isLoading: authLoading, login, logout, user } = useAuth();
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
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Required</h1>
          <p className="text-gray-600 mb-2">
            You're signed in as:
          </p>
          <p className="font-mono text-indigo-600 font-semibold mb-4 break-all">
            {user?.userDetails || 'Unknown'}
          </p>
          <p className="text-gray-600 mb-6">
            You don't have votekeeper access yet. Ask an existing votekeeper to invite your email address.
          </p>
          <button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl hover:bg-gray-300 transition-colors disabled:opacity-50 text-sm"
          >
            {seedMutation.isPending ? 'Setting up...' : 'Or become first votekeeper'}
          </button>
          {seedMutation.isError && (
            <p className="text-red-500 text-sm mt-3">
              {seedMutation.error?.message || 'Votekeepers already exist. Ask to be invited.'}
            </p>
          )}
          {seedMutation.isSuccess && (
            <p className="text-green-600 text-sm mt-3">
              You're now a votekeeper! Refreshing...
            </p>
          )}
          <button
            onClick={logout}
            className="mt-4 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Sign out
          </button>
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
          <div className="flex items-center gap-4">
            {user && (
              <span className="text-sm text-gray-500 hidden sm:inline">{user.userDetails}</span>
            )}
            <Link
              to="/votekeepers"
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Votekeepers
            </Link>
            <Link
              to="/create"
              className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors text-sm"
            >
              + New Event
            </Link>
            <button
              onClick={logout}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Sign Out
            </button>
          </div>
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
              <EventCard key={event.id} event={event} onDeleted={() => queryClient.invalidateQueries({ queryKey: ['events'] })} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function EventCard({ event, onDeleted }: { event: VoteEvent; onDeleted: () => void }) {
  const status = STATUS_LABELS[event.status] ?? STATUS_LABELS.setup;
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteEvent(event.id),
    onSuccess: onDeleted,
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      return;
    }
    deleteMutation.mutate();
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirming(false);
  };

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => navigate(`/manage/${event.id}`)}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
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
        <div className="flex items-center gap-2 ml-3">
          {confirming ? (
            <>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="text-xs text-white bg-red-500 hover:bg-red-600 rounded-lg px-2 py-1 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? '...' : 'Confirm'}
              </button>
              <button
                onClick={cancelDelete}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={handleDelete}
              className="p-2 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
              title="Delete event"
            >
              {/* Trash can icon (Heroicons outline) */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          )}
          <span className="text-gray-400 text-xl">→</span>
        </div>
      </div>
    </div>
  );
}
