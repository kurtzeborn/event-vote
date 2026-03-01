import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../api.ts';
import type { ResultsResponse, OptionResult } from '../types.ts';

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const MEDAL_COLORS: Record<number, string> = {
  1: 'text-yellow-400',
  2: 'text-gray-300',
  3: 'text-amber-600',
};

export default function ResultsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [prevCount, setPrevCount] = useState(0);

  const {
    data: results,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['results', eventId],
    queryFn: () => api.getResults(eventId!),
    enabled: !!eventId,
    refetchInterval: (query) => {
      const data = query.state.data as ResultsResponse | undefined;
      if (!data) return 3000;
      return data.status === 'revealing' ? 3000 : data.status === 'complete' ? false : 5000;
    },
  });

  // Track newly-revealed items for animation
  useEffect(() => {
    if (results) setPrevCount((prev) => (results.revealedCount > prev ? results.revealedCount : prev));
  }, [results?.revealedCount]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl animate-pulse">Loading results...</div>
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 p-4">
        <div className="text-white text-center">
          <p className="text-lg mb-4">Results are not yet available</p>
          <Link to="/" className="text-indigo-400 hover:text-indigo-300">← Back to Home</Link>
        </div>
      </div>
    );
  }

  const isRevealing = results.status === 'revealing';
  const isComplete = results.status === 'complete';
  const maxVotes = Math.max(...results.results.map((r) => r.totalVotes), 1);
  const winner = isComplete ? results.results.find((r) => r.rank === 1) : null;

  // Sort: lowest rank first (worst → best, bottom → top)
  const sorted = [...results.results].sort((a, b) => b.rank - a.rank);

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{results.eventName}</h1>
          {isRevealing && (
            <div>
              <p className="text-indigo-400 text-sm animate-pulse mb-2">
                Revealing {results.revealedCount} of {results.totalOptions}...
              </p>
              <div className="w-48 mx-auto bg-white/10 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                  style={{ width: `${(results.revealedCount / results.totalOptions) * 100}%` }}
                />
              </div>
            </div>
          )}
          {isComplete && (
            <p className="text-green-400 text-sm">
              Final Results — {results.totalVoters} voter{results.totalVoters !== 1 ? 's' : ''}, {results.totalVotes} total votes
            </p>
          )}
        </div>

        {/* Winner celebration */}
        {isComplete && winner && <WinnerBanner winner={winner} />}

        {/* Results list */}
        <div className="space-y-3">
          {sorted.map((result, index) => (
            <ResultCard
              key={result.optionId}
              result={result}
              maxVotes={maxVotes}
              isWinner={result.rank === 1 && isComplete}
              isNew={isRevealing && index === 0 && results.revealedCount > prevCount - 1}
            />
          ))}
        </div>

        {/* Wait for more reveals */}
        {isRevealing && results.revealedCount < results.totalOptions && (
          <div className="text-center mt-8">
            <div className="text-white/50 text-sm animate-pulse">Waiting for next reveal...</div>
          </div>
        )}

        {/* Chart + actions when complete */}
        {isComplete && results.results.length > 0 && (
          <>
            <ResultsChart results={results.results} />
            <div className="flex flex-col items-center gap-3 mt-8">
              <a
                href={api.getPdfUrl(eventId!)}
                className="bg-indigo-600 text-white font-semibold py-2 px-6 rounded-xl hover:bg-indigo-700 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                📄 Download PDF Report
              </a>
              <Link to="/" className="text-gray-400 hover:text-gray-300 text-sm">← Back to Home</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---- Winner celebration banner ---- */
function WinnerBanner({ winner }: { winner: OptionResult }) {
  const [show, setShow] = useState(false);
  useEffect(() => { setShow(true); }, []);

  return (
    <div
      className={`relative mb-8 rounded-2xl overflow-hidden transition-all duration-1000 ${
        show ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
      }`}
    >
      {/* Glow background */}
      <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/30 via-amber-400/20 to-yellow-500/30 animate-pulse" />
      <div className="relative text-center py-8 px-4">
        <div className="text-5xl mb-2">🏆</div>
        <h2 className="text-2xl md:text-3xl font-bold text-yellow-300 mb-1">{winner.title}</h2>
        <p className="text-yellow-100/80 text-sm">
          Winner with {winner.totalVotes} vote{winner.totalVotes !== 1 ? 's' : ''} from {winner.uniqueVoters} voter{winner.uniqueVoters !== 1 ? 's' : ''}
        </p>
        {/* Decorative sparkles */}
        <div className="absolute top-2 left-4 text-xl animate-bounce" style={{ animationDelay: '0ms' }}>✨</div>
        <div className="absolute top-4 right-6 text-lg animate-bounce" style={{ animationDelay: '300ms' }}>✨</div>
        <div className="absolute bottom-3 left-1/4 text-sm animate-bounce" style={{ animationDelay: '600ms' }}>✨</div>
        <div className="absolute bottom-2 right-1/3 text-xl animate-bounce" style={{ animationDelay: '150ms' }}>🎉</div>
      </div>
    </div>
  );
}

/* ---- Individual result card ---- */
function ResultCard({
  result,
  maxVotes,
  isWinner,
  isNew,
}: {
  result: OptionResult;
  maxVotes: number;
  isWinner: boolean;
  isNew: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!isNew);
  const barWidth = maxVotes > 0 ? (result.totalVotes / maxVotes) * 100 : 0;

  useEffect(() => {
    if (isNew) {
      // Trigger entrance animation on next frame
      const t = setTimeout(() => setVisible(true), 50);
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return () => clearTimeout(t);
    }
  }, [isNew]);

  const medal = MEDAL[result.rank];
  const medalColor = MEDAL_COLORS[result.rank] ?? 'text-white/60';

  const barColor =
    result.rank === 1 ? 'bg-yellow-400' :
    result.rank === 2 ? 'bg-gray-300' :
    result.rank === 3 ? 'bg-amber-600' :
    'bg-indigo-400';

  return (
    <div
      ref={ref}
      className={`rounded-xl p-4 transition-all duration-700 ${
        isWinner
          ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border-2 border-yellow-500/50 shadow-lg shadow-yellow-500/10'
          : 'bg-white/5 border border-white/10'
      } ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          {medal ? (
            <span className={`text-3xl ${medalColor}`}>{medal}</span>
          ) : (
            <span className="text-2xl font-bold text-white/40">#{result.rank}</span>
          )}
          <div>
            <h3 className={`font-semibold ${isWinner ? 'text-yellow-300 text-lg' : 'text-white'}`}>
              {result.title}
            </h3>
            {result.description && (
              <p className="text-white/50 text-sm">{result.description}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className={`font-bold text-lg ${isWinner ? 'text-yellow-300' : 'text-white'}`}>
            {result.totalVotes}
          </div>
          <div className="text-white/40 text-xs">
            {result.uniqueVoters} voter{result.uniqueVoters !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Bar */}
      <div className="bg-white/10 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}

/* ---- Recharts bar chart for complete results ---- */
function ResultsChart({ results }: { results: OptionResult[] }) {
  const chartData = [...results]
    .sort((a, b) => a.rank - b.rank)
    .map((r) => ({
      name: r.title.length > 20 ? r.title.slice(0, 18) + '…' : r.title,
      votes: r.totalVotes,
      voters: r.uniqueVoters,
      rank: r.rank,
    }));

  const getBarColor = (rank: number) => {
    if (rank === 1) return '#facc15'; // yellow-400
    if (rank === 2) return '#d1d5db'; // gray-300
    if (rank === 3) return '#d97706'; // amber-600
    return '#818cf8'; // indigo-400
  };

  return (
    <section className="mt-10 bg-white/5 rounded-xl border border-white/10 p-6">
      <h2 className="text-lg font-semibold text-white mb-4 text-center">Vote Distribution</h2>
      <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 50)}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
          <XAxis type="number" stroke="#9ca3af" fontSize={12} />
          <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} width={120} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
            labelStyle={{ color: '#d1d5db' }}
            formatter={(value: number, name: string) => [value, name === 'votes' ? 'Votes' : 'Unique Voters']}
          />
          <Bar dataKey="votes" radius={[0, 6, 6, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={getBarColor(entry.rank)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
