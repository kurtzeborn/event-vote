/**
 * Seed script for local development.
 * Creates tables and adds a default votekeeper so mock auth works.
 *
 * Usage: npx tsx tools/seed-dev.ts
 */

import { TableClient } from '@azure/data-tables';

const connectionString = 'UseDevelopmentStorage=true';
const DEV_EMAIL = 'scott@kurtzeborn.org';

async function seed() {
  // Create all tables
  const tableNames = ['events', 'votingoptions', 'votes', 'votekeepers'];
  for (const name of tableNames) {
    const client = TableClient.fromConnectionString(connectionString, name);
    try {
      await client.createTable();
      console.log(`Created table: ${name}`);
    } catch (error: any) {
      if (error.statusCode === 409) {
        console.log(`Table already exists: ${name}`);
      } else {
        throw error;
      }
    }
  }

  // Seed default votekeeper
  const votekeepers = TableClient.fromConnectionString(connectionString, 'votekeepers');
  try {
    await votekeepers.upsertEntity({
      partitionKey: 'votekeeper',
      rowKey: DEV_EMAIL,
      displayName: 'Dev User',
      addedBy: 'seed-script',
      addedAt: new Date().toISOString(),
    }, 'Merge');
    console.log(`\nSeeded votekeeper: ${DEV_EMAIL}`);
  } catch (error) {
    console.error('Failed to seed votekeeper:', error);
    throw error;
  }

  console.log('\nDone! You can now sign in with the mock auth page.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
