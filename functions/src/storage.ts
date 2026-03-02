import { TableClient } from '@azure/data-tables';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';

function getTableClient(tableName: string): TableClient {
  return TableClient.fromConnectionString(connectionString, tableName);
}

export async function initializeTables(): Promise<void> {
  const tableNames = ['events', 'votingoptions', 'votes', 'votekeepers'];
  for (const tableName of tableNames) {
    const client = getTableClient(tableName);
    try {
      await client.createTable();
      console.log(`Created table: ${tableName}`);
    } catch (error: any) {
      if (error.statusCode !== 409) throw error;
    }
  }
}

export const eventsTable = getTableClient('events');
export const votingOptionsTable = getTableClient('votingoptions');
export const votesTable = getTableClient('votes');
export const votekeepersTable = getTableClient('votekeepers');
