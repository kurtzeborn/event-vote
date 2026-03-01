import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.ts';
import type { ResultsResponse, OptionResult } from '../types.ts';

export default function ResultsPage() {
  const { eventId } = useParams<{ eventId: string }>();

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
      // Poll faster during reveal, stop when complete
      return data.status === 'revealing' ? 3000 : data.status === 'complete' ? false : 5000;
    },
  });

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
          <Link to="/" className="text-indigo-400 hover:text-indigo-300">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const isRevealing = results.status === 'revealing';
  const isComplete = results.status === 'complete';
  const maxVotes = Math.max(...results.results.map((r) => r.totalVotes), 1);

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{results.eventName}</h1>
          {isRevealing && (
            <p className="text-indigo-400 text-sm animate-pulse">
              Revealing {results.revealedCount} of {results.totalOptions}...
            </p>
          )}
          {isComplete && (
            <p className="text-green-400 text-sm">
              Final Results — {results.totalVoters} voter{results.totalVoters !== 1 ? 's' : ''}, {results.totalVotes} total votes
            </p>
          )}
        </div>

        {/* Results list - revealed from bottom rank up */}
        <div className="space-y-3">
          {results.results
            .sort((a, b) => b.rank - a.rank) // Show lowest rank (worst) first during revealing
            .map((result, index) => (
              <ResultCard
                key={result.optionId}
                result={result}
                maxVotes={maxVotes}
                isWinner={result.rank === 1 && isComplete}
                animationDelay={index * 100}
              />
            ))}
        </div>

        {/* Wait for more reveals */}
        {isRevealing && results.revealedCount < results.totalOptions && (
          <div className="text-center mt-8">
            <div className="text-white/50 text-sm animate-pulse">
              Waiting for next reveal...
            </div>
          </div>
        )}

        {/* Actions when complete */}
        {isComplete && (
          <div className="flex flex-col items-center gap-3 mt-8">
            <a
              href={api.getPdfUrl(eventId!)}
              className="bg-indigo-600 text-white font-semibold py-2 px-6 rounded-xl hover:bg-indigo-700 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              📄 Download PDF Report
            </a>
            <Link to="/" className="text-gray-400 hover:text-gray-300 text-sm">
              ← Back to Home
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({
  result,
  maxVotes,
  isWinner,
  animationDelay,
}: {
  result: OptionResult;
  maxVotes: number;
  isWinner: boolean;
  animationDelay: number;
}) {
  const barWidth = maxVotes > 0 ? (result.totalVotes / maxVotes) * 100 : 0;

  return (
    <div
      className={`rounded-xl p-4 transition-all duration-500 ${
        isWinner
          ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border-2 border-yellow-500/50'
          : 'bg-white/5 border border-white/10'
      }`}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <span
            className={`text-2xl font-bold ${
              isWinner ? 'text-yellow-400' : 'text-white/60'
            }`}
          >
            #{result.rank}
          </span>
          <div>
            <h3 className={`font-semibold ${isWinner ? 'text-yellow-300 text-lg' : 'text-white'}`}>
              {isWinner && '🏆 '}
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
          <div className="text-white/40 text-xs">{result.uniqueVoters} voter{result.uniqueVoters !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Bar */}
      <div className="bg-white/10 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            isWinner ? 'bg-yellow-400' : 'bg-indigo-400'
          }`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}
