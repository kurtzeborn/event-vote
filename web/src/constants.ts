/** Shared UI constants used across multiple pages */

export const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export const MEDAL_COLORS: Record<number, string> = {
  1: 'text-yellow-400',
  2: 'text-gray-300',
  3: 'text-amber-600',
};

export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  setup: { label: 'Setup', color: 'bg-gray-200 text-gray-700' },
  open: { label: 'Voting Open', color: 'bg-green-100 text-green-700' },
  closed: { label: 'Voting Closed', color: 'bg-yellow-100 text-yellow-700' },
  revealing: { label: 'Revealing', color: 'bg-purple-100 text-purple-700' },
  complete: { label: 'Complete', color: 'bg-blue-100 text-blue-700' },
};

export function getRankBarColor(rank: number): string {
  if (rank === 1) return 'bg-yellow-400';
  if (rank === 2) return 'bg-gray-300';
  if (rank === 3) return 'bg-amber-600';
  return 'bg-indigo-400';
}

export function getRankChartColor(rank: number): string {
  if (rank === 1) return '#facc15'; // yellow-400
  if (rank === 2) return '#d1d5db'; // gray-300
  if (rank === 3) return '#d97706'; // amber-600
  return '#818cf8'; // indigo-400
}
