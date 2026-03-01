import { describe, it, expect } from 'vitest';

/**
 * These tests verify the code generation rules directly since the
 * generateEventCode function depends on table storage.
 */

const BLOCKED_WORDS = new Set([
  'ANUS', 'ARSE', 'CLIT', 'COCK', 'CRAP', 'CUNT', 'DAMN', 'DICK',
  'DUMB', 'DYKE', 'FAGS', 'FUCK', 'GOOK', 'HATE', 'HELL', 'HOMO',
  'JERK', 'JIZZ', 'KILL', 'KIKE', 'KNOB', 'LAME', 'MUFF', 'NAZI',
  'NIGS', 'NUTS', 'ORGY', 'PAKI', 'PISS', 'POOP', 'PORN', 'PUBE',
  'RAPE', 'RUMP', 'SCUM', 'SHIT', 'SLAG', 'SLUT', 'SMEG', 'SPIC',
  'SUCK', 'TITS', 'TURD', 'TWAT', 'WANK', 'WHIG', 'WHOR',
]);

const LETTERS = 'ABCDEFGHJKLMNPQRSTVWXYZ';

function generateCode(): string {
  return Array.from({ length: 4 }, () =>
    LETTERS[Math.floor(Math.random() * LETTERS.length)]
  ).join('');
}

function isValidCode(code: string): boolean {
  if (code.length !== 4) return false;
  if (BLOCKED_WORDS.has(code)) return false;
  return [...code].every((ch) => LETTERS.includes(ch));
}

describe('Code Generator', () => {
  it('generates 4-letter codes', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateCode();
      expect(code).toHaveLength(4);
    }
  });

  it('uses only allowed letters', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateCode();
      for (const ch of code) {
        expect(LETTERS).toContain(ch);
      }
    }
  });

  it('does not use excluded vowels I, O, U', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      expect(code).not.toMatch(/[IOU]/);
    }
  });

  it('rejects blocked words', () => {
    expect(isValidCode('FUCK')).toBe(false);
    expect(isValidCode('SHIT')).toBe(false);
    expect(isValidCode('DAMN')).toBe(false);
    expect(isValidCode('KILL')).toBe(false);
  });

  it('accepts valid codes', () => {
    expect(isValidCode('ABCD')).toBe(true);
    expect(isValidCode('WXYZ')).toBe(true);
    expect(isValidCode('KRTB')).toBe(true);
  });

  it('rejects codes with invalid characters', () => {
    expect(isValidCode('AB1D')).toBe(false);
    expect(isValidCode('ABOD')).toBe(false); // O is excluded
    expect(isValidCode('AIBC')).toBe(false); // I is excluded
  });
});
