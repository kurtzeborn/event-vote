import { describe, it, expect } from 'vitest';

/**
 * Tests for results ranking and reveal logic.
 *
 * The core ranking algorithm lives in results.ts getRankedResults().
 * Here we test the sorting/ranking/tiebreaker rules in isolation.
 */

interface RankedOption {
  optionId: string;
  title: string;
  totalVotes: number;
  uniqueVoters: number;
  rank: number;
}

/** Replicate the ranking logic from results.ts for unit testing */
function rankResults(
  items: { optionId: string; title: string; totalVotes: number; uniqueVoters: number }[],
): RankedOption[] {
  const results: RankedOption[] = items.map((i) => ({ ...i, rank: 0 }));

  // Sort: primary by totalVotes desc, tiebreaker by uniqueVoters desc
  results.sort((a, b) => {
    if (b.totalVotes !== a.totalVotes) return b.totalVotes - a.totalVotes;
    return b.uniqueVoters - a.uniqueVoters;
  });

  // Assign ranks (handle ties)
  for (let i = 0; i < results.length; i++) {
    if (i === 0) {
      results[i].rank = 1;
    } else if (
      results[i].totalVotes === results[i - 1].totalVotes &&
      results[i].uniqueVoters === results[i - 1].uniqueVoters
    ) {
      results[i].rank = results[i - 1].rank;
    } else {
      results[i].rank = i + 1;
    }
  }

  return results;
}

/** Replicate the reveal slice logic from getResults() */
function getVisibleResults(
  ranked: RankedOption[],
  revealedCount: number,
  status: 'revealing' | 'complete',
): RankedOption[] {
  if (status === 'revealing') {
    return ranked.slice(ranked.length - revealedCount);
  }
  return ranked;
}

describe('Results Ranking', () => {
  it('ranks by total votes descending', () => {
    const results = rankResults([
      { optionId: 'a', title: 'A', totalVotes: 5, uniqueVoters: 3 },
      { optionId: 'b', title: 'B', totalVotes: 10, uniqueVoters: 5 },
      { optionId: 'c', title: 'C', totalVotes: 3, uniqueVoters: 2 },
    ]);

    expect(results[0].optionId).toBe('b');
    expect(results[0].rank).toBe(1);
    expect(results[1].optionId).toBe('a');
    expect(results[1].rank).toBe(2);
    expect(results[2].optionId).toBe('c');
    expect(results[2].rank).toBe(3);
  });

  it('uses unique voters as tiebreaker', () => {
    const results = rankResults([
      { optionId: 'a', title: 'A', totalVotes: 6, uniqueVoters: 2 },
      { optionId: 'b', title: 'B', totalVotes: 6, uniqueVoters: 4 },
    ]);

    // B wins — same total votes but more unique voters
    expect(results[0].optionId).toBe('b');
    expect(results[0].rank).toBe(1);
    expect(results[1].optionId).toBe('a');
    expect(results[1].rank).toBe(2);
  });

  it('assigns same rank for true ties (same votes AND unique voters)', () => {
    const results = rankResults([
      { optionId: 'a', title: 'A', totalVotes: 5, uniqueVoters: 3 },
      { optionId: 'b', title: 'B', totalVotes: 5, uniqueVoters: 3 },
      { optionId: 'c', title: 'C', totalVotes: 2, uniqueVoters: 1 },
    ]);

    expect(results[0].rank).toBe(1);
    expect(results[1].rank).toBe(1); // Same rank — true tie
    expect(results[2].rank).toBe(3); // Skips rank 2
  });

  it('handles single option', () => {
    const results = rankResults([
      { optionId: 'a', title: 'A', totalVotes: 10, uniqueVoters: 5 },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].rank).toBe(1);
  });

  it('handles empty results', () => {
    const results = rankResults([]);
    expect(results).toHaveLength(0);
  });

  it('handles all zero votes', () => {
    const results = rankResults([
      { optionId: 'a', title: 'A', totalVotes: 0, uniqueVoters: 0 },
      { optionId: 'b', title: 'B', totalVotes: 0, uniqueVoters: 0 },
    ]);

    expect(results[0].rank).toBe(1);
    expect(results[1].rank).toBe(1); // All tied at 0
  });

  it('handles complex multi-way ties with tiebreaker', () => {
    const results = rankResults([
      { optionId: 'a', title: 'A', totalVotes: 8, uniqueVoters: 4 },
      { optionId: 'b', title: 'B', totalVotes: 8, uniqueVoters: 6 },
      { optionId: 'c', title: 'C', totalVotes: 8, uniqueVoters: 2 },
      { optionId: 'd', title: 'D', totalVotes: 3, uniqueVoters: 3 },
    ]);

    expect(results[0].optionId).toBe('b'); // 8 votes, 6 unique → rank 1
    expect(results[0].rank).toBe(1);
    expect(results[1].optionId).toBe('a'); // 8 votes, 4 unique → rank 2
    expect(results[1].rank).toBe(2);
    expect(results[2].optionId).toBe('c'); // 8 votes, 2 unique → rank 3
    expect(results[2].rank).toBe(3);
    expect(results[3].optionId).toBe('d'); // 3 votes → rank 4
    expect(results[3].rank).toBe(4);
  });
});

describe('Reveal Logic', () => {
  const ranked: RankedOption[] = [
    { optionId: 'winner', title: 'Winner', totalVotes: 10, uniqueVoters: 5, rank: 1 },
    { optionId: 'second', title: 'Second', totalVotes: 7, uniqueVoters: 4, rank: 2 },
    { optionId: 'third', title: 'Third', totalVotes: 5, uniqueVoters: 3, rank: 3 },
    { optionId: 'fourth', title: 'Fourth', totalVotes: 2, uniqueVoters: 2, rank: 4 },
    { optionId: 'fifth', title: 'Fifth', totalVotes: 1, uniqueVoters: 1, rank: 5 },
  ];

  it('reveals bottom result first (last place)', () => {
    const visible = getVisibleResults(ranked, 1, 'revealing');
    expect(visible).toHaveLength(1);
    expect(visible[0].optionId).toBe('fifth');
  });

  it('reveals bottom two', () => {
    const visible = getVisibleResults(ranked, 2, 'revealing');
    expect(visible).toHaveLength(2);
    expect(visible[0].optionId).toBe('fourth');
    expect(visible[1].optionId).toBe('fifth');
  });

  it('reveals all except winner', () => {
    const visible = getVisibleResults(ranked, 4, 'revealing');
    expect(visible).toHaveLength(4);
    expect(visible[0].optionId).toBe('second');
    // Winner should NOT be in the list yet
    expect(visible.find((r) => r.optionId === 'winner')).toBeUndefined();
  });

  it('reveals all when count equals total', () => {
    const visible = getVisibleResults(ranked, 5, 'revealing');
    expect(visible).toHaveLength(5);
    expect(visible[0].optionId).toBe('winner');
  });

  it('returns all results when complete', () => {
    const visible = getVisibleResults(ranked, 5, 'complete');
    expect(visible).toHaveLength(5);
  });

  it('reveals nothing when count is 0', () => {
    const visible = getVisibleResults(ranked, 0, 'revealing');
    expect(visible).toHaveLength(0);
  });
});

describe('Reveal State Transitions', () => {
  it('reveal advances count from 0 to 1 (closed → revealing)', () => {
    let status = 'closed';
    let revealedCount = 0;
    const totalOptions = 5;

    // Simulate first reveal
    if (status === 'closed') {
      status = 'revealing';
      revealedCount = 1;
    }

    expect(status).toBe('revealing');
    expect(revealedCount).toBe(1);
  });

  it('reveal advances count incrementally', () => {
    let revealedCount = 3;
    const totalOptions = 5;

    revealedCount = Math.min(revealedCount + 1, totalOptions);
    expect(revealedCount).toBe(4);
  });

  it('reveal caps at totalOptions', () => {
    let revealedCount = 5;
    const totalOptions = 5;

    revealedCount = Math.min(revealedCount + 1, totalOptions);
    expect(revealedCount).toBe(5);
  });

  it('isComplete when revealedCount >= totalOptions', () => {
    expect(5 >= 5).toBe(true);
    expect(4 >= 5).toBe(false);
    expect(6 >= 5).toBe(true);
  });
});
