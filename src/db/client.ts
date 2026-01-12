import postgres from 'postgres';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get DATABASE_URL from environment
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create PostgreSQL connection
export const sql = postgres(databaseUrl, {
  // Connection pool settings
  max: 10,
  idle_timeout: 20,
  connect_timeout: 30,
});

// Type definitions for our schema
export interface Skin {
  id: number;
  md5: string;
  filename: string;
  filepath: string;
  liked: boolean;
  flagged: boolean;
  created_at: Date;
  nsfw: boolean;
  tweeted: boolean;
  average_color: string | null;
  screenshot_url: string | null;
  museum_url: string | null;
  downloaded_at: Date;
  last_used_at: Date | null;
  use_count: number;
  tags: string[];
  notes: string | null;
  rating: number | null;
  file_size: number | null;
  s3_key: string | null;
  s3_uploaded_at: Date | null;
  updated_at: Date;
}

export interface CreateSkinInput {
  md5: string;
  filename: string;
  filepath: string;
  nsfw?: boolean;
  tweeted?: boolean;
  average_color?: string;
  screenshot_url?: string;
  museum_url?: string;
  file_size?: number;
}

export interface UpdateSkinInput {
  liked?: boolean;
  flagged?: boolean;
  tags?: string[];
  notes?: string;
  rating?: number;
  last_used_at?: Date;
  use_count?: number;
}

// Helper to test database connection
export async function testConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Helper to close the connection
export async function closeConnection(): Promise<void> {
  await sql.end();
}
