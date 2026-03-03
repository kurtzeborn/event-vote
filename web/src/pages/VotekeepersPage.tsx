import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext.tsx';
import { api, ApiError } from '../api.ts';
import type { VotekeeperWithStats } from '../types.ts';

export default function VotekeepersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');

  const { data: votekeepers, isLoading, error } = useQuery({
    queryKey: ['votekeepers'],
    queryFn: api.listVotekeepers,
  });

  const addMutation = useMutation({
    mutationFn: api.addVotekeeper,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['votekeepers'] });
      setEmail('');
      setDisplayName('');
      setShowInvite(false);
    },
  });

  const removeMutation = useMutation({
    mutationFn: api.removeVotekeeper,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['votekeepers'] });
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = displayName.trim() || trimmedEmail;
    if (!trimmedEmail) return;
    addMutation.mutate({ userId: trimmedEmail, displayName: trimmedName });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-indigo-600">
            🗳️ Event Vote
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Votekeepers</h2>
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors text-sm"
          >
            {showInvite ? 'Cancel' : '+ Invite'}
          </button>
        </div>

        {/* Invite Form */}
        {showInvite && (
          <form onSubmit={handleInvite} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Invite a Votekeeper</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text"
                placeholder="Display name (optional)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={addMutation.isPending}
                className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors text-sm disabled:opacity-50 whitespace-nowrap"
              >
                {addMutation.isPending ? 'Inviting...' : 'Send Invite'}
              </button>
            </div>
            {addMutation.isError && (
              <p className="text-red-500 text-sm mt-2">
                {(addMutation.error as ApiError)?.message || 'Failed to invite votekeeper'}
              </p>
            )}
          </form>
        )}

        {/* List */}
        {isLoading && <p className="text-gray-500 animate-pulse">Loading votekeepers...</p>}
        {error && <p className="text-red-500">Failed to load votekeepers</p>}

        {votekeepers && votekeepers.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">👤</div>
            <p className="text-gray-500">No votekeepers yet</p>
          </div>
        )}

        {votekeepers && votekeepers.length > 0 && (
          <div className="grid gap-3">
            {votekeepers.map((vk) => (
              <VotekeeperCard
                key={vk.userId}
                votekeeper={vk}
                isSelf={vk.userId === user?.userDetails?.toLowerCase()}
                onRemove={() => removeMutation.mutate(vk.userId)}
                isRemoving={removeMutation.isPending}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function VotekeeperCard({
  votekeeper,
  isSelf,
  onRemove,
  isRemoving,
}: {
  votekeeper: VotekeeperWithStats;
  isSelf: boolean;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      return;
    }
    onRemove();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{votekeeper.displayName}</h3>
            {isSelf && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                You
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{votekeeper.userId}</p>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-xs text-gray-400">
              <span className="font-medium text-green-600">{votekeeper.completedEvents}</span> completed
            </span>
            <span className="text-xs text-gray-400">
              <span className="font-medium text-blue-600">{votekeeper.activeEvents}</span> active
            </span>
            <span className="text-xs text-gray-400">
              Added {new Date(votekeeper.addedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-3">
          {!isSelf && (
            confirming ? (
              <>
                <button
                  onClick={handleRemove}
                  disabled={isRemoving}
                  className="text-xs text-white bg-red-500 hover:bg-red-600 rounded-lg px-2 py-1 transition-colors disabled:opacity-50"
                >
                  {isRemoving ? '...' : 'Confirm'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirming(false); }}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={handleRemove}
                className="p-2 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                title="Remove votekeeper"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
