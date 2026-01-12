#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSkinsWithS3 } from '../src/db/queries.js';
import { closeConnection } from '../src/db/client.js';
import { fileExistsInS3, getS3PublicUrl } from '../src/services/s3.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRY_RUN = process.env.DRY_RUN !== 'false'; // Default to dry run for safety
const LIMIT = parseInt(process.env.LIMIT) || null;

async function deleteLocalFiles() {
  console.log('Delete Local Files After S3 Verification');
  console.log('=========================================\n');

  if (DRY_RUN) {
    console.log('🔒 DRY RUN MODE (no files will be deleted)');
    console.log('   Set DRY_RUN=false to actually delete files\n');
  } else {
    console.log('⚠️  LIVE MODE - FILES WILL BE DELETED!');
    console.log('   Waiting 5 seconds... Press Ctrl+C to cancel\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Get skins that have been uploaded to S3
  const skinsWithS3 = await getSkinsWithS3();

  console.log(`Found ${skinsWithS3.length} skins with S3 uploads\n`);

  if (skinsWithS3.length === 0) {
    console.log('No skins with S3 uploads found. Upload files first.');
    await closeConnection();
    return;
  }

  const limit = LIMIT || skinsWithS3.length;
  const skinsToProcess = skinsWithS3.slice(0, limit);

  console.log(`Processing: ${skinsToProcess.length} skins\n`);

  let verified = 0;
  let deleted = 0;
  let notFound = 0;
  let errors = 0;

  for (const skin of skinsToProcess) {
    try {
      // Check if file exists in S3
      console.log(`Checking: ${skin.filename}`);
      const existsInS3 = await fileExistsInS3(skin.s3_key);

      if (!existsInS3) {
        notFound++;
        console.log(`⚠️  NOT FOUND in S3: ${skin.s3_key}`);
        console.log('   Skipping deletion for safety\n');
        continue;
      }

      verified++;
      const s3Url = getS3PublicUrl(skin.s3_key);
      console.log(`✓ Verified in S3: ${s3Url}`);

      // Check if local file exists
      const localPath = path.join(__dirname, '..', 'public', skin.filepath);
      try {
        await fs.access(localPath);
      } catch (error) {
        console.log(`  Local file already deleted: ${skin.filepath}\n`);
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would delete: ${skin.filepath}\n`);
      } else {
        // Delete local file
        await fs.unlink(localPath);
        deleted++;
        console.log(`  ✓ Deleted local file: ${skin.filepath}\n`);
      }
    } catch (error) {
      errors++;
      console.error(`✗ Error processing ${skin.filename}:`, error.message);
      console.log('');
    }
  }

  console.log('✅ Processing completed!');
  console.log(`Verified in S3: ${verified}`);
  console.log(`Deleted locally: ${deleted}`);
  console.log(`Not found in S3: ${notFound}`);
  console.log(`Errors: ${errors}`);

  if (DRY_RUN) {
    console.log('\n💡 To actually delete files, run:');
    console.log('   DRY_RUN=false npx tsx scripts/delete-local-after-s3.js');
  }

  await closeConnection();
}

deleteLocalFiles().catch(async (error) => {
  console.error('Fatal error:', error);
  await closeConnection();
  process.exit(1);
});
