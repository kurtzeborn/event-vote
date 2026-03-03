import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { api } from '../api.ts';
import type { VoteEvent } from '../types.ts';
import { MEDAL, STATUS_LABELS, getRankBarColor } from '../constants.ts';
import WinnerBanner from '../components/WinnerBanner.tsx';
import { getTheme } from '../themes.ts';

export default function ManageEventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { isVotekeeper, isLoading: authLoading, login } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showQR, setShowQR] = useState(false);
  const [showPerOption, setShowPerOption] = useState(false);

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

  // Lifecycle mutations (must be before early returns to satisfy React hook rules)
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['event', eventId] });
  const openMutation = useMutation({ mutationFn: () => api.openVoting(eventId!), onSuccess: invalidate });
  const closeMutation = useMutation({ mutationFn: () => api.closeVoting(eventId!), onSuccess: invalidate });
  const revealMutation = useMutation({ mutationFn: () => api.reveal(eventId!), onSuccess: invalidate });

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
  const t = getTheme(event.config.theme);

  // Show projector-friendly reveal view for revealing/complete statuses
  if (event.status === 'revealing' || event.status === 'complete') {
    return (
      <RevealView
        event={event}
        queryClient={queryClient}
        navigate={navigate}
        voterUrl={voterUrl}
        resultsUrl={resultsUrl}
      />
    );
  }

  return (
    <div className={`min-h-screen ${t.pageBg}`}>
      {/* Header */}
      <header className={`${t.headerBg} shadow-sm sticky top-0 z-30`}>
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-white/70 hover:text-white">
              ← Back
            </Link>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white text-center flex-1 mx-4 truncate">{event.name}</h1>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-white/70">{event.id}</span>
              <button
                onClick={() => setShowQR(true)}
                className="p-1 bg-white/20 hover:bg-white/30 text-white rounded transition-colors"
                title="Show QR Code"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="8" height="8" rx="1" /><rect x="14" y="2" width="8" height="8" rx="1" /><rect x="2" y="14" width="8" height="8" rx="1" /><rect x="14" y="14" width="4" height="4" /><line x1="22" y1="14" x2="22" y2="14.01" /><line x1="22" y1="22" x2="22" y2="22.01" /><line x1="18" y1="22" x2="18" y2="22.01" /><line x1="22" y1="18" x2="22" y2="18.01" /></svg>
              </button>
            </div>
            <StatusBadge status={event.status} small />
          </div>
        </div>
        {/* Action bar */}
        <div className="max-w-4xl mx-auto px-4 pb-3 flex items-center justify-center gap-3">
            {event.status === 'setup' && (
              <button
                onClick={() => openMutation.mutate()}
                disabled={openMutation.isPending || (event.options?.length ?? 0) === 0}
                className="bg-white text-green-700 px-4 py-2 rounded-lg hover:bg-white/90 disabled:opacity-50 font-medium text-sm transition-colors"
              >
                {openMutation.isPending ? 'Opening...' : '▶ Open Voting'}
              </button>
            )}
            {event.status === 'open' && (
              <button
                onClick={() => {
                  if (confirm('Close voting? Voters will no longer be able to submit or change votes.')) {
                    closeMutation.mutate();
                  }
                }}
                disabled={closeMutation.isPending}
                className="bg-white text-yellow-700 px-4 py-2 rounded-lg hover:bg-white/90 disabled:opacity-50 font-medium text-sm transition-colors"
              >
                {closeMutation.isPending ? 'Closing...' : '⏸ Close Voting'}
              </button>
            )}
            {event.status === 'closed' && (
              <button
                onClick={() => revealMutation.mutate()}
                disabled={revealMutation.isPending}
                className="bg-white/20 text-white px-4 py-2 rounded-lg hover:bg-white/30 disabled:opacity-50 font-medium text-sm transition-colors"
              >
                {revealMutation.isPending ? 'Revealing...' : '🎭 Reveal Results'}
              </button>
            )}
        </div>
        {/* Live Stats (inside header so it sticks) */}
        {voteCounts.data && (
          <div className="bg-white/15 border-t border-white/20">
            <div className="max-w-4xl mx-auto px-4 py-2 flex items-center gap-6">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-1.5">
                  <span className="text-2xl font-bold text-white">{voteCounts.data.totalVoters}</span>
                  <span className="text-sm text-white/70">Voters</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-2xl font-bold text-white">{voteCounts.data.totalVotes}</span>
                  <span className="text-sm text-white/70">Votes</span>
                </div>
              </div>
              {voteCounts.data.perOption && event.options && (
                <button
                  onClick={() => setShowPerOption((v) => !v)}
                  className="text-sm text-white/70 hover:text-white font-medium transition-colors ml-auto"
                >
                  {showPerOption ? 'Hide' : 'Show'} Per-Option
                </button>
              )}
            </div>
            {showPerOption && voteCounts.data.perOption && event.options && (
              <div className="max-w-4xl mx-auto px-4 pb-2 space-y-1">
                {event.options.map((opt) => (
                  <div key={opt.id} className="flex items-center justify-between text-sm">
                    <span className="text-white/80">{opt.title}</span>
                    <span className="font-semibold text-white">{voteCounts.data!.perOption[opt.id] ?? 0}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {/* QR Code Modal */}
      {showQR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowQR(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Scan to Vote</h2>
            <p className="text-gray-600 text-sm mb-4">
              Event Code: <span className="font-mono font-bold text-lg">{event.id}</span>
            </p>
            <div className="bg-white p-4 rounded-lg inline-block">
              <QRCodeSVG value={voterUrl} size={200} level="M" includeMargin />
            </div>
            <p className="text-gray-500 text-xs mt-4 break-all">{voterUrl}</p>
            <div className="mt-3 space-y-1 text-xs text-gray-400">
              <p>Results: <a href={resultsUrl} className={`${t.accentText.split(' ')[0]} hover:underline`}>{resultsUrl}</a></p>
            </div>
            <button
              onClick={() => setShowQR(false)}
              className="mt-4 px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700 font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Options */}
        <OptionsSection event={event} queryClient={queryClient} />
      </main>
    </div>
  );
}

/* ---- Projector-friendly Reveal View ---- */

function RevealView({
  event,
  queryClient,
  navigate,
  voterUrl,
  resultsUrl,
}: {
  event: VoteEvent;
  queryClient: ReturnType<typeof useQueryClient>;
  navigate: ReturnType<typeof useNavigate>;
  voterUrl: string;
  resultsUrl: string;
}) {
  const [prevRevealed, setPrevRevealed] = useState(event.revealedCount ?? 0);
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['event', event.id] });
    queryClient.invalidateQueries({ queryKey: ['results', event.id] });
  };

  // Fetch results for the reveal
  const { data: results } = useQuery({
    queryKey: ['results', event.id],
    queryFn: () => api.getResults(event.id),
    refetchInterval: event.status === 'revealing' ? 3000 : false,
  });

  const revealMutation = useMutation({ mutationFn: () => api.reveal(event.id), onSuccess: invalidate });
  const completeMutation = useMutation({ mutationFn: () => api.completeEvent(event.id), onSuccess: invalidate });

  const revealedCount = event.revealedCount ?? 0;
  const totalOptions = event.options?.length ?? 0;
  const allRevealed = revealedCount >= totalOptions;
  const isComplete = event.status === 'complete';

  // Track newly-revealed for animation
  useEffect(() => {
    if (revealedCount > prevRevealed) {
      setPrevRevealed(revealedCount);
    }
  }, [revealedCount, prevRevealed]);

  const sorted = results?.results ? [...results.results].sort((a, b) => a.rank - b.rank) : [];
  const maxVotes = Math.max(...(sorted.map((r) => r.totalVotes) || [0]), 1);
  const winner = isComplete ? sorted.find((r) => r.rank === 1) : null;
  const t = getTheme(event.config.theme);

  return (
    <div className="min-h-screen bg-gray-900 p-6 md:p-10 flex flex-col">
      {/* Top bar - event name + controls */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold text-white">{event.name}</h1>
          <p className="text-gray-400 text-sm mt-1">
            {isComplete ? 'Final Results' : `Revealed ${revealedCount} of ${totalOptions}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isComplete && !allRevealed && (
            <button
              onClick={() => revealMutation.mutate()}
              disabled={revealMutation.isPending}
              className={`${t.revealButton} text-white px-6 py-3 rounded-xl disabled:opacity-50 font-bold text-lg transition-colors`}
            >
              {revealMutation.isPending ? 'Revealing...' : '🎭 Reveal Next'}
            </button>
          )}
          {!isComplete && allRevealed && (
            <button
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
              className={`${t.revealButton} text-white px-6 py-3 rounded-xl disabled:opacity-50 font-bold text-lg transition-colors`}
            >
              {completeMutation.isPending ? 'Completing...' : '✓ Complete Event'}
            </button>
          )}
          {isComplete && (
            <div className="flex gap-2">
              <a
                href={api.getPdfUrl(event.id)}
                target="_blank"
                rel="noopener noreferrer"
                className={`${t.buttonPrimary} text-white px-5 py-2.5 rounded-xl font-medium transition-colors`}
              >
                📄 PDF
              </a>
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-gray-700 text-white px-5 py-2.5 rounded-xl hover:bg-gray-600 font-medium transition-colors"
              >
                Dashboard
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {!isComplete && (
        <div className="w-full bg-white/10 rounded-full h-2 mb-8 overflow-hidden">
          <div
            className={`h-full ${t.accentBgDark} rounded-full transition-all duration-700`}
            style={{ width: `${(revealedCount / Math.max(totalOptions, 1)) * 100}%` }}
          />
        </div>
      )}

      {/* Winner banner */}
      {winner && <WinnerBanner winner={winner} large />}

      {/* Results list */}
      <div className="space-y-3 flex-1">
        {sorted.map((result) => {
          const medal = MEDAL[result.rank];
          const barWidth = maxVotes > 0 ? (result.totalVotes / maxVotes) * 100 : 0;
          const isWinner = result.rank === 1 && isComplete;
          const barColor = getRankBarColor(result.rank);

          return (
            <div
              key={result.optionId}
              className={`rounded-xl p-5 transition-all duration-700 ${
                isWinner
                  ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border-2 border-yellow-500/50 shadow-lg shadow-yellow-500/10'
                  : 'bg-white/5 border border-white/10'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                  {medal ? (
                    <span className="text-4xl">{medal}</span>
                  ) : (
                    <span className="text-3xl font-bold text-white/30">#{result.rank}</span>
                  )}
                  <div>
                    <h3 className={`font-bold text-xl ${isWinner ? 'text-yellow-300' : 'text-white'}`}>
                      {result.title}
                    </h3>
                    {result.description && (
                      <p className="text-white/50 text-sm">{result.description}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold text-2xl ${isWinner ? 'text-yellow-300' : 'text-white'}`}>
                    {result.totalVotes}
                  </div>
                  <div className="text-white/40 text-sm">
                    {result.uniqueVoters} voter{result.uniqueVoters !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <div className="bg-white/10 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Share links at bottom */}
      <div className="mt-8 flex items-center justify-between text-sm text-gray-500">
        <span>Results: {resultsUrl}</span>
        <span>Vote: {voterUrl}</span>
      </div>
    </div>
  );
}

function StatusBadge({ status, small }: { status: string; small?: boolean }) {
  const style = STATUS_LABELS[status] || STATUS_LABELS.setup;
  return (
    <span className={`${small ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'} rounded-full font-medium ${style.color}`}>
      {style.label}
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
  const titleRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const canEdit = event.status === 'setup' || event.status === 'open';
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['event', event.id] });
  const t = getTheme(event.config.theme);

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
      // Re-focus title input for next option
      setTimeout(() => titleRef.current?.focus(), 0);
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
                  className={`w-full border border-gray-300 rounded px-2 py-1 text-sm ${t.focusBorder} focus:outline-none`}
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
                  className={`w-full border border-gray-300 rounded px-2 py-1 text-sm ${t.focusBorder} focus:outline-none`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit(option.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(option.id)}
                    disabled={!editTitle.trim() || updateMutation.isPending}
                    className={`${t.accentText} text-sm font-medium`}
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
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(option)}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Edit"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${option.title}"?`)) {
                          deleteMutation.mutate(option.id);
                        }
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
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
        <form
          className="border-t border-gray-200 pt-4 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newTitle.trim()) addMutation.mutate();
          }}
        >
          <input
            ref={titleRef}
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Option title"
            maxLength={200}
            className={`w-full border border-gray-300 rounded-lg px-3 py-2 ${t.focusBorder} focus:outline-none text-sm`}
          />
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Optional description"
            maxLength={500}
            className={`w-full border border-gray-300 rounded-lg px-3 py-2 ${t.focusBorder} focus:outline-none text-sm`}
          />
          <button
            type="submit"
            disabled={!newTitle.trim() || addMutation.isPending}
            className={`${t.buttonPrimary} text-white px-4 py-2 rounded-lg disabled:opacity-50 text-sm font-medium transition-colors`}
          >
            Add
          </button>
        </form>
      )}
    </section>
  );
}


