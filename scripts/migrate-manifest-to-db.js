#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createSkin, countSkins } from '../src/db/queries.js';
import { closeConnection } from '../src/db/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MANIFEST_FILE = path.join(__dirname, '..', 'public', 'skins', 'manifest.json');
const SKINS_DIR = path.join(__dirname, '..', 'public', 'skins');

async function getFileSize(filepath) {
  try {
    const stats = await fs.stat(filepath);
    return stats.size;
  } catch (error) {
    return null;
  }
}

async function migrateManifest() {
  console.log('Migrating manifest.json to PostgreSQL database');
  console.log('================================================\n');

  // Check if manifest exists
  try {
    await fs.access(MANIFEST_FILE);
  } catch (error) {
    console.error('❌ manifest.json not found at:', MANIFEST_FILE);
    process.exit(1);
  }

  // Read manifest
  console.log('Reading manifest.json...');
  const manifestData = await fs.readFile(MANIFEST_FILE, 'utf-8');
  const manifest = JSON.parse(manifestData);

  console.log(`Found ${manifest.skins.length} skins in manifest\n`);

  // Check existing database count
  const existingCount = await countSkins();
  console.log(`Current skins in database: ${existingCount}\n`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  console.log('Starting migration...\n');

  for (const skin of manifest.skins) {
    try {
      const { md5, filename, filepath } = skin;

      // Get file size if file exists
      const fullPath = path.join(__dirname, '..', 'public', filepath);
      const file_size = await getFileSize(fullPath);

      // Try to insert (will skip if md5 already exists)
      const result = await createSkin({
        md5,
        filename,
        filepath,
        file_size
      });

      if (result) {
        imported++;
        console.log(`✓ Imported: ${filename}`);
      } else {
        skipped++;
        console.log(`⊘ Skipped (already exists): ${filename}`);
      }
    } catch (error) {
      errors++;
      console.error(`✗ Error importing ${skin.filename}:`, error.message);
    }
  }

  const finalCount = await countSkins();

  console.log('\n✅ Migration completed!');
  console.log(`Imported: ${imported}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total skins in database: ${finalCount}`);

  await closeConnection();
}

migrateManifest().catch(async (error) => {
  console.error('Fatal error:', error);
  await closeConnection();
  process.exit(1);
});
