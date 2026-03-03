import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../api.ts';
import type { ResultsResponse, OptionResult } from '../types.ts';
import { MEDAL, MEDAL_COLORS, getRankBarColor, getRankChartColor } from '../constants.ts';
import WinnerBanner from '../components/WinnerBanner.tsx';
import { getTheme } from '../themes.ts';

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
  const t = getTheme(results.theme);

  // Sort: best rank first (top → bottom)
  const sorted = [...results.results].sort((a, b) => a.rank - b.rank);

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8 relative">
      {/* Themed accent gradient at top */}
      <div className={`absolute inset-x-0 top-0 h-1 ${t.accentBgDark}`} />
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{results.eventName}</h1>
          {isRevealing && (
            <div>
              <p className={`${t.accentText} text-sm animate-pulse mb-2`}>
                Revealing {results.revealedCount} of {results.totalOptions}...
              </p>
              <div className="w-48 mx-auto bg-white/10 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full ${t.votePlus} rounded-full transition-all duration-700`}
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
            <div className={`text-white/50 text-sm animate-pulse ${t.accentTextDark}`}>Waiting for next reveal...</div>
          </div>
        )}

        {/* Chart + actions when complete */}
        {isComplete && results.results.length > 0 && (
          <>
            <ResultsChart results={results.results} />
            <div className="flex flex-col items-center gap-3 mt-8">
              <a
                href={api.getPdfUrl(eventId!)}
                className={`${t.buttonPrimary} text-white font-semibold py-2 px-6 rounded-xl transition-colors`}
                target="_blank"
                rel="noopener noreferrer"
              >
                📄 Download PDF Report
              </a>
              <Link to="/" className={`${t.accentTextDark} hover:text-gray-300 text-sm`}>← Back to Home</Link>
            </div>
          </>
        )}
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

  const barColor = getRankBarColor(result.rank);

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
              <Cell key={i} fill={getRankChartColor(entry.rank)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
