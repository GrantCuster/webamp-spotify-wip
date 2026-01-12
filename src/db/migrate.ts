#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { sql, testConnection, closeConnection } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('Running database migration...\n');

  // Test connection first
  console.log('Testing database connection...');
  const connected = await testConnection();

  if (!connected) {
    console.error('❌ Failed to connect to database');
    process.exit(1);
  }

  console.log('✓ Database connection successful\n');

  // Read schema file
  const schemaPath = path.join(__dirname, 'schema.sql');
  console.log(`Reading schema from ${schemaPath}...`);

  try {
    const schemaSQL = await fs.readFile(schemaPath, 'utf-8');
    console.log('✓ Schema file loaded\n');

    // Execute schema
    console.log('Executing schema...');
    await sql.unsafe(schemaSQL);
    console.log('✓ Schema executed successfully\n');

    // Verify table was created
    const result = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'skins'
    `;

    if (result.length > 0) {
      console.log('✓ Skins table verified\n');

      // Get count
      const count = await sql`SELECT COUNT(*) as count FROM skins`;
      console.log(`Current skins in database: ${count[0].count}\n`);

      console.log('✅ Migration completed successfully!');
    } else {
      console.error('❌ Failed to verify skins table');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await closeConnection();
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration().catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

export { runMigration };
