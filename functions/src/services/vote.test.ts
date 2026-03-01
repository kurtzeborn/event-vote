import { describe, it, expect } from 'vitest';

/**
 * Tests for vote validation logic.
 * These test the pure validation rules that the vote API enforces,
 * extracted from the handler so they can be tested without Azure dependencies.
 */

interface VoteAllocation {
  [optionId: string]: number;
}

/** Validate vote allocations against the rules */
function validateAllocations(
  allocations: VoteAllocation,
  votesPerAttendee: number,
  validOptionIds: string[],
): { valid: boolean; error?: string } {
  // Must have at least one allocation
  const entries = Object.entries(allocations);
  if (entries.length === 0) {
    return { valid: false, error: 'Must allocate at least one vote' };
  }

  let totalVotes = 0;
  for (const [optionId, count] of entries) {
    // No negative allocations
    if (count < 0) {
      return { valid: false, error: 'Vote allocations cannot be negative' };
    }
    // Skip zero allocations
    if (count === 0) continue;
    // Validate option exists
    if (!validOptionIds.includes(optionId)) {
      return { valid: false, error: `Invalid option: ${optionId}` };
    }
    totalVotes += count;
  }

  if (totalVotes === 0) {
    return { valid: false, error: 'Must allocate at least one vote' };
  }

  if (totalVotes > votesPerAttendee) {
    return { valid: false, error: `You can allocate a maximum of ${votesPerAttendee} votes` };
  }

  return { valid: true };
}

/** Validate voter name */
function validateVoterName(name: string | undefined | null): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Voter name is required' };
  }
  if (name.length > 100) {
    return { valid: false, error: 'Voter name must be 100 characters or less' };
  }
  return { valid: true };
}

/** Build voterId from device fingerprint and session */
function buildVoterId(fingerprint: string, sessionId: string): string {
  return `${fingerprint}_${sessionId}`;
}

describe('Vote Validation', () => {
  const validOptions = ['opt1', 'opt2', 'opt3'];

  describe('validateAllocations', () => {
    it('accepts valid allocation within limit', () => {
      expect(validateAllocations({ opt1: 2, opt2: 1 }, 3, validOptions)).toEqual({ valid: true });
    });

    it('accepts all votes on one option', () => {
      expect(validateAllocations({ opt1: 3 }, 3, validOptions)).toEqual({ valid: true });
    });

    it('accepts partial allocation (fewer than max)', () => {
      expect(validateAllocations({ opt1: 1 }, 3, validOptions)).toEqual({ valid: true });
    });

    it('rejects total exceeding votesPerAttendee', () => {
      const result = validateAllocations({ opt1: 2, opt2: 2 }, 3, validOptions);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('maximum of 3');
    });

    it('rejects negative allocations', () => {
      const result = validateAllocations({ opt1: -1 }, 3, validOptions);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('negative');
    });

    it('rejects empty allocations', () => {
      const result = validateAllocations({}, 3, validOptions);
      expect(result.valid).toBe(false);
    });

    it('rejects all-zero allocations', () => {
      const result = validateAllocations({ opt1: 0, opt2: 0 }, 3, validOptions);
      expect(result.valid).toBe(false);
    });

    it('rejects invalid option IDs', () => {
      const result = validateAllocations({ bogus: 1 }, 3, validOptions);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid option');
    });

    it('skips zero-value allocations when checking option validity', () => {
      // bogus has 0 votes so it's skipped
      const result = validateAllocations({ opt1: 1, bogus: 0 }, 3, validOptions);
      expect(result.valid).toBe(true);
    });

    it('handles single vote configuration', () => {
      expect(validateAllocations({ opt1: 1 }, 1, validOptions)).toEqual({ valid: true });
      const result = validateAllocations({ opt1: 1, opt2: 1 }, 1, validOptions);
      expect(result.valid).toBe(false);
    });

    it('handles max allocation (10 votes)', () => {
      expect(validateAllocations({ opt1: 5, opt2: 3, opt3: 2 }, 10, validOptions)).toEqual({ valid: true });
    });
  });

  describe('validateVoterName', () => {
    it('accepts valid names', () => {
      expect(validateVoterName('Alice')).toEqual({ valid: true });
      expect(validateVoterName('Bob Smith')).toEqual({ valid: true });
    });

    it('rejects empty or missing names', () => {
      expect(validateVoterName('')).toEqual({ valid: false, error: 'Voter name is required' });
      expect(validateVoterName(null)).toEqual({ valid: false, error: 'Voter name is required' });
      expect(validateVoterName(undefined)).toEqual({ valid: false, error: 'Voter name is required' });
      expect(validateVoterName('   ')).toEqual({ valid: false, error: 'Voter name is required' });
    });

    it('rejects names over 100 characters', () => {
      const longName = 'A'.repeat(101);
      const result = validateVoterName(longName);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('100 characters');
    });

    it('accepts names at exactly 100 characters', () => {
      expect(validateVoterName('A'.repeat(100))).toEqual({ valid: true });
    });
  });

  describe('Voter Identity', () => {
    it('builds voterId from fingerprint and session', () => {
      expect(buildVoterId('abc123', 'sess-456')).toBe('abc123_sess-456');
    });

    it('different fingerprints produce different voterIds', () => {
      const id1 = buildVoterId('fp1', 'session');
      const id2 = buildVoterId('fp2', 'session');
      expect(id1).not.toBe(id2);
    });

    it('different sessions produce different voterIds', () => {
      const id1 = buildVoterId('fingerprint', 'sess1');
      const id2 = buildVoterId('fingerprint', 'sess2');
      expect(id1).not.toBe(id2);
    });
  });
});

describe('Anti-Fraud Behavior', () => {
  it('session cookie parsing extracts session ID', () => {
    const cookie = 'other=value; evote_session=abc-123-def; another=test';
    const match = cookie.match(/evote_session=([^;]+)/);
    expect(match?.[1]).toBe('abc-123-def');
  });

  it('session cookie parsing returns undefined when missing', () => {
    const cookie = 'other=value; something=else';
    const match = cookie.match(/evote_session=([^;]+)/);
    expect(match).toBeNull();
  });

  it('empty cookie string returns null', () => {
    const cookie = '';
    const match = cookie.match(/evote_session=([^;]+)/);
    expect(match).toBeNull();
  });

  it('device fingerprint header extraction', () => {
    // Simulates getDeviceFingerprint logic
    const getFingerprint = (header: string | null) => header || 'unknown';
    expect(getFingerprint('abc123')).toBe('abc123');
    expect(getFingerprint(null)).toBe('unknown');
    expect(getFingerprint('')).toBe('unknown');
  });
});

describe('Vote Count Tallying', () => {
  interface VoteRecord {
    optionId: string;
    voterId: string;
    voteCount: number;
  }

  function tallyVotes(votes: VoteRecord[]) {
    let totalVotes = 0;
    const uniqueVoters = new Set<string>();
    const perOption: Record<string, { votes: number; uniqueVoters: Set<string> }> = {};

    for (const vote of votes) {
      totalVotes += vote.voteCount;
      uniqueVoters.add(vote.voterId);
      if (!perOption[vote.optionId]) {
        perOption[vote.optionId] = { votes: 0, uniqueVoters: new Set() };
      }
      perOption[vote.optionId].votes += vote.voteCount;
      perOption[vote.optionId].uniqueVoters.add(vote.voterId);
    }

    return { totalVotes, totalVoters: uniqueVoters.size, perOption };
  }

  function rankResults(perOption: Record<string, { votes: number; uniqueVoters: Set<string> }>) {
    // Sort by votes desc, then by unique voters desc (tiebreaker)
    return Object.entries(perOption)
      .map(([optionId, data]) => ({
        optionId,
        totalVotes: data.votes,
        uniqueVoters: data.uniqueVoters.size,
      }))
      .sort((a, b) => {
        if (b.totalVotes !== a.totalVotes) return b.totalVotes - a.totalVotes;
        return b.uniqueVoters - a.uniqueVoters; // tiebreaker: more unique voters wins
      });
  }

  it('tallies votes correctly', () => {
    const votes: VoteRecord[] = [
      { optionId: 'A', voterId: 'user1', voteCount: 2 },
      { optionId: 'B', voterId: 'user1', voteCount: 1 },
      { optionId: 'A', voterId: 'user2', voteCount: 1 },
      { optionId: 'B', voterId: 'user2', voteCount: 2 },
    ];
    const result = tallyVotes(votes);
    expect(result.totalVotes).toBe(6);
    expect(result.totalVoters).toBe(2);
    expect(result.perOption['A'].votes).toBe(3);
    expect(result.perOption['B'].votes).toBe(3);
  });

  it('counts unique voters per option', () => {
    const votes: VoteRecord[] = [
      { optionId: 'A', voterId: 'user1', voteCount: 3 },
      { optionId: 'A', voterId: 'user2', voteCount: 1 },
      { optionId: 'B', voterId: 'user3', voteCount: 3 },
    ];
    const result = tallyVotes(votes);
    expect(result.perOption['A'].uniqueVoters.size).toBe(2);
    expect(result.perOption['B'].uniqueVoters.size).toBe(1);
  });

  it('breaks ties by unique voter count', () => {
    const perOption = {
      A: { votes: 6, uniqueVoters: new Set(['u1', 'u2']) },       // 6 votes, 2 unique
      B: { votes: 6, uniqueVoters: new Set(['u3', 'u4', 'u5', 'u6']) }, // 6 votes, 4 unique
    };
    const ranked = rankResults(perOption);
    expect(ranked[0].optionId).toBe('B'); // B wins tiebreaker (4 unique > 2 unique)
    expect(ranked[1].optionId).toBe('A');
  });

  it('ranks by vote count first', () => {
    const perOption = {
      A: { votes: 10, uniqueVoters: new Set(['u1']) },
      B: { votes: 5, uniqueVoters: new Set(['u2', 'u3', 'u4']) },
    };
    const ranked = rankResults(perOption);
    expect(ranked[0].optionId).toBe('A'); // A wins on votes despite fewer unique voters
  });

  it('handles empty votes', () => {
    const result = tallyVotes([]);
    expect(result.totalVotes).toBe(0);
    expect(result.totalVoters).toBe(0);
  });
});
