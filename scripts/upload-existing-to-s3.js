#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';
import { getSkinsWithoutS3, updateSkinS3, countSkins } from '../src/db/queries.js';
import { closeConnection } from '../src/db/client.js';
import { uploadFileToS3, getS3Config } from '../src/services/s3.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LIMIT = parseInt(process.env.LIMIT) || null; // null = upload all

async function uploadToS3() {
  console.log('Uploading existing skins to S3');
  console.log('==============================\n');

  // Show S3 configuration
  const s3Config = getS3Config();
  console.log(`S3 Bucket: ${s3Config.bucket}`);
  console.log(`S3 Region: ${s3Config.region}`);
  console.log(`S3 Prefix: ${s3Config.prefix}\n`);

  // Get counts
  const totalSkins = await countSkins();
  const skinsToUpload = await getSkinsWithoutS3();

  console.log(`Total skins in database: ${totalSkins}`);
  console.log(`Skins without S3: ${skinsToUpload.length}`);

  if (skinsToUpload.length === 0) {
    console.log('\n✅ All skins already uploaded to S3!');
    await closeConnection();
    return;
  }

  const limit = LIMIT || skinsToUpload.length;
  const skinsToProcess = skinsToUpload.slice(0, limit);

  console.log(`\nUploading: ${skinsToProcess.length} skins\n`);

  let uploaded = 0;
  let errors = 0;

  for (const skin of skinsToProcess) {
    try {
      // Build local file path
      const localPath = path.join(__dirname, '..', 'public', skin.filepath);

      // Extract filename from filepath (e.g., "skins/abc123.wsz" -> "abc123.wsz")
      const filename = path.basename(skin.filepath);

      console.log(`Uploading: ${skin.filename} (${filename})`);

      // Upload to S3 (will be stored as webamp-skins/abc123.wsz)
      const s3Key = await uploadFileToS3(localPath, filename);

      // Update database
      await updateSkinS3(skin.id, s3Key);

      uploaded++;
      console.log(`✓ Uploaded (${uploaded}/${skinsToProcess.length})\n`);
    } catch (error) {
      errors++;
      console.error(`✗ Failed to upload ${skin.filename}:`, error.message);
      console.log('');
    }
  }

  console.log('✅ Upload completed!');
  console.log(`Uploaded: ${uploaded}`);
  console.log(`Errors: ${errors}`);

  await closeConnection();
}

uploadToS3().catch(async (error) => {
  console.error('Fatal error:', error);
  await closeConnection();
  process.exit(1);
});
