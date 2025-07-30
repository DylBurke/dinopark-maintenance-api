import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Create postgres client
export const sql = postgres(connectionString);

// Create drizzle database instance
export const db = drizzle(sql, { schema });

// Helper function to close connection (for testing)
export const closeConnection = async () => {
  await sql.end();
};