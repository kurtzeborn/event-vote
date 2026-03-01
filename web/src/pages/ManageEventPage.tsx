import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { api } from '../api.ts';
import type { VoteEvent } from '../types.ts';

export default function ManageEventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { isVotekeeper, isLoading: authLoading, login } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const {
    data: event,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api.getEvent(eventId!),
    enabled: !!eventId && isVotekeeper,
    refetchInterval: 5000,
  });

  const voteCounts = useQuery({
    queryKey: ['voteCounts', eventId],
    queryFn: () => api.getVoteCounts(eventId!),
    enabled: !!eventId && (event?.status === 'open' || event?.status === 'closed'),
    refetchInterval: 3000,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!isVotekeeper) {
    login();
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 animate-pulse">Loading event...</div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <p className="text-red-500 mb-4">Failed to load event</p>
        <Link to="/dashboard" className="text-indigo-600 hover:text-indigo-800">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  const voterUrl = `${window.location.origin}/join/${event.id}`;
  const resultsUrl = `${window.location.origin}/results/${event.id}`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-gray-400 hover:text-gray-600">
              ← Back
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{event.name}</h1>
              <span className="text-sm font-mono text-gray-400">Code: {event.id}</span>
            </div>
          </div>
          <StatusBadge status={event.status} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* QR Code & Links */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Share with Voters</h2>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <QRCodeSVG value={voterUrl} size={160} level="M" />
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">Vote URL:</span>{' '}
                <a href={voterUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline break-all">
                  {voterUrl}
                </a>
              </div>
              <div>
                <span className="text-gray-500">Results URL:</span>{' '}
                <a href={resultsUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline break-all">
                  {resultsUrl}
                </a>
              </div>
              <div>
                <span className="text-gray-500">Event Code:</span>{' '}
                <span className="font-mono text-2xl font-bold text-gray-900">{event.id}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Live Stats */}
        {voteCounts.data && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Live Stats</h2>
            <div className="flex gap-8">
              {voteCounts.data.totalVoters !== undefined && (
                <div>
                  <div className="text-3xl font-bold text-indigo-600">{voteCounts.data.totalVoters}</div>
                  <div className="text-sm text-gray-500">Voters</div>
                </div>
              )}
              {voteCounts.data.totalVotes !== undefined && (
                <div>
                  <div className="text-3xl font-bold text-indigo-600">{voteCounts.data.totalVotes}</div>
                  <div className="text-sm text-gray-500">Total Votes</div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Options */}
        <OptionsSection event={event} queryClient={queryClient} />

        {/* Lifecycle Actions */}
        <LifecycleActions event={event} queryClient={queryClient} navigate={navigate} />
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    setup: 'bg-gray-200 text-gray-700',
    open: 'bg-green-100 text-green-700',
    closed: 'bg-yellow-100 text-yellow-700',
    revealing: 'bg-purple-100 text-purple-700',
    complete: 'bg-blue-100 text-blue-700',
  };
  const labels: Record<string, string> = {
    setup: 'Setup',
    open: 'Voting Open',
    closed: 'Voting Closed',
    revealing: 'Revealing',
    complete: 'Complete',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status] || styles.setup}`}>
      {labels[status] || status}
    </span>
  );
}

function OptionsSection({
  event,
  queryClient,
}: {
  event: VoteEvent;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const canEdit = event.status === 'setup' || event.status === 'open';
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['event', event.id] });

  const addMutation = useMutation({
    mutationFn: () =>
      api.addOption(event.id, {
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
      }),
    onSuccess: () => {
      setNewTitle('');
      setNewDesc('');
      invalidate();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ optionId, data }: { optionId: string; data: { title?: string; description?: string } }) =>
      api.updateOption(event.id, optionId, data),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (optionId: string) => api.deleteOption(event.id, optionId),
    onSuccess: invalidate,
  });

  const reorderMutation = useMutation({
    mutationFn: (optionIds: string[]) => api.reorderOptions(event.id, optionIds),
    onSuccess: invalidate,
  });

  const options = event.options ?? [];

  const moveOption = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= options.length) return;
    const ids = options.map((o) => o.id);
    [ids[index], ids[newIndex]] = [ids[newIndex], ids[index]];
    reorderMutation.mutate(ids);
  };

  const startEdit = (option: { id: string; title: string; description?: string }) => {
    setEditingId(option.id);
    setEditTitle(option.title);
    setEditDesc(option.description ?? '');
  };

  const saveEdit = (optionId: string) => {
    if (!editTitle.trim()) return;
    updateMutation.mutate({
      optionId,
      data: { title: editTitle.trim(), description: editDesc.trim() || undefined },
    });
  };

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Voting Options ({options.length})
      </h2>

      {/* Existing options */}
      <div className="space-y-2 mb-4">
        {options.map((option, index) => (
          <div
            key={option.id}
            className="flex items-center gap-2 bg-gray-50 rounded-lg px-4 py-3"
          >
            {/* Reorder buttons */}
            {canEdit && options.length > 1 && (
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => moveOption(index, -1)}
                  disabled={index === 0 || reorderMutation.isPending}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-20 text-xs leading-none"
                  title="Move up"
                >▲</button>
                <button
                  onClick={() => moveOption(index, 1)}
                  disabled={index === options.length - 1 || reorderMutation.isPending}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-20 text-xs leading-none"
                  title="Move down"
                >▼</button>
              </div>
            )}

            {editingId === option.id ? (
              /* Inline edit form */
              <div className="flex-1 space-y-1">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={200}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit(option.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  maxLength={500}
                  placeholder="Description (optional)"
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit(option.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(option.id)}
                    disabled={!editTitle.trim() || updateMutation.isPending}
                    className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                  >Save</button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-gray-400 hover:text-gray-600 text-sm"
                  >Cancel</button>
                </div>
              </div>
            ) : (
              /* Display mode */
              <>
                <div className="flex-1">
                  <span className="text-gray-400 text-sm mr-2">{index + 1}.</span>
                  <span className="font-medium text-gray-900">{option.title}</span>
                  {option.description && (
                    <span className="text-sm text-gray-500 ml-2">— {option.description}</span>
                  )}
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(option)}
                      className="text-gray-400 hover:text-indigo-600 text-sm"
                    >Edit</button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${option.title}"?`)) {
                          deleteMutation.mutate(option.id);
                        }
                      }}
                      className="text-red-400 hover:text-red-600 text-sm"
                    >Delete</button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {options.length === 0 && (
          <p className="text-gray-400 text-sm py-2">No options yet. Add your first option below.</p>
        )}
      </div>

      {/* Add option form */}
      {canEdit && (
        <div className="border-t border-gray-200 pt-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Option title"
                maxLength={200}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-indigo-500 focus:outline-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTitle.trim()) {
                    e.preventDefault();
                    addMutation.mutate();
                  }
                }}
              />
            </div>
            <button
              onClick={() => addMutation.mutate()}
              disabled={!newTitle.trim() || addMutation.isPending}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              Add
            </button>
          </div>
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Optional description"
            maxLength={500}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-2 focus:border-indigo-500 focus:outline-none text-sm"
          />
        </div>
      )}
    </section>
  );
}

function LifecycleActions({
  event,
  queryClient,
  navigate,
}: {
  event: VoteEvent;
  queryClient: ReturnType<typeof useQueryClient>;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['event', event.id] });

  const openMutation = useMutation({ mutationFn: () => api.openVoting(event.id), onSuccess: invalidate });
  const closeMutation = useMutation({ mutationFn: () => api.closeVoting(event.id), onSuccess: invalidate });
  const revealMutation = useMutation({ mutationFn: () => api.reveal(event.id), onSuccess: invalidate });
  const completeMutation = useMutation({ mutationFn: () => api.completeEvent(event.id), onSuccess: invalidate });
  const deleteMutation = useMutation({
    mutationFn: () => api.deleteEvent(event.id),
    onSuccess: () => navigate('/dashboard'),
  });

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Event Controls</h2>
      <div className="flex flex-wrap gap-3">
        {event.status === 'setup' && (
          <>
            <button
              onClick={() => openMutation.mutate()}
              disabled={openMutation.isPending || (event.options?.length ?? 0) === 0}
              className="bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium transition-colors"
            >
              {openMutation.isPending ? 'Opening...' : '▶ Open Voting'}
            </button>
            <button
              onClick={() => {
                if (confirm('Delete this event?')) deleteMutation.mutate();
              }}
              className="bg-red-100 text-red-700 px-5 py-2.5 rounded-lg hover:bg-red-200 font-medium transition-colors"
            >
              Delete Event
            </button>
          </>
        )}

        {event.status === 'open' && (
          <button
            onClick={() => {
              if (confirm('Close voting? Voters will no longer be able to submit or change votes.')) {
                closeMutation.mutate();
              }
            }}
            disabled={closeMutation.isPending}
            className="bg-yellow-600 text-white px-5 py-2.5 rounded-lg hover:bg-yellow-700 disabled:opacity-50 font-medium transition-colors"
          >
            {closeMutation.isPending ? 'Closing...' : '⏸ Close Voting'}
          </button>
        )}

        {(event.status === 'closed' || event.status === 'revealing') && (
          <button
            onClick={() => revealMutation.mutate()}
            disabled={revealMutation.isPending}
            className="bg-purple-600 text-white px-5 py-2.5 rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium transition-colors"
          >
            {revealMutation.isPending ? 'Revealing...' : '🎭 Reveal Next'}
          </button>
        )}

        {event.status === 'revealing' && (
          <button
            onClick={() => completeMutation.mutate()}
            disabled={completeMutation.isPending}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
          >
            {completeMutation.isPending ? 'Completing...' : '✓ Complete Event'}
          </button>
        )}

        {event.status === 'complete' && (
          <>
            <a
              href={api.getPdfUrl(event.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 font-medium transition-colors"
            >
              📄 Download PDF
            </a>
            <Link
              to={`/results/${event.id}`}
              className="bg-gray-100 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-200 font-medium transition-colors"
            >
              View Results
            </Link>
          </>
        )}
      </div>

      {/* Show reveal progress */}
      {event.status === 'revealing' && event.revealedCount !== undefined && event.options && (
        <p className="text-sm text-gray-500 mt-3">
          Revealed {event.revealedCount} of {event.options.length} options
        </p>
      )}
    </section>
  );
}
