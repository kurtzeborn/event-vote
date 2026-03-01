import { eventsTable } from '../storage.js';

/**
 * Offensive word blocklist for 4-letter event codes.
 * Codes matching these patterns are rejected and regenerated.
 */
const BLOCKED_WORDS = new Set([
  'ANUS', 'ARSE', 'CLIT', 'COCK', 'CRAP', 'CUNT', 'DAMN', 'DICK',
  'DUMB', 'DYKE', 'FAGS', 'FUCK', 'GOOK', 'HATE', 'HELL', 'HOMO',
  'JERK', 'JIZZ', 'KILL', 'KIKE', 'KNOB', 'LAME', 'MUFF', 'NAZI',
  'NIGS', 'NUTS', 'ORGY', 'PAKI', 'PISS', 'POOP', 'PORN', 'PUBE',
  'RAPE', 'RUMP', 'SCUM', 'SHIT', 'SLAG', 'SLUT', 'SMEG', 'SPIC',
  'SUCK', 'TITS', 'TURD', 'TWAT', 'WANK', 'WHIG', 'WHOR',
]);

// Use consonant-heavy letters to reduce chance of forming offensive words
// Exclude I, O, U to avoid vowel-heavy combos; keep A and E for readability
const LETTERS = 'ABCDEFGHJKLMNPQRSTVWXYZ';

/**
 * Generate a random 4-letter event code.
 * Checks against blocklist and ensures uniqueness in storage.
 */
export async function generateEventCode(): Promise<string> {
  const maxAttempts = 20;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = Array.from({ length: 4 }, () =>
      LETTERS[Math.floor(Math.random() * LETTERS.length)]
    ).join('');

    // Check blocklist
    if (BLOCKED_WORDS.has(code)) {
      continue;
    }

    // Check uniqueness in storage
    try {
      await eventsTable.getEntity('event', code);
      // Code already exists, try again
      continue;
    } catch (error: any) {
      if (error.statusCode === 404) {
        // Code is available
        return code;
      }
      throw error;
    }
  }

  throw new Error('Failed to generate unique event code after maximum attempts');
}
