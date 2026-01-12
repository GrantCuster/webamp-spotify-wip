#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { createSkin, getSkinByMd5, countSkins } from '../src/db/queries.js';
import { closeConnection } from '../src/db/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GRAPHQL_ENDPOINT = 'https://api.webamp.org/graphql';
const SKINS_DIR = path.join(__dirname, '..', 'public', 'skins');
const MANIFEST_FILE = path.join(SKINS_DIR, 'manifest.json');
const LIMIT = parseInt(process.env.LIMIT) || 1000;

// Ensure skins directory exists
if (!fs.existsSync(SKINS_DIR)) {
  fs.mkdirSync(SKINS_DIR, { recursive: true });
}

// GraphQL query to fetch skin data using bulkDownload
async function fetchSkins(offset = 0, limit = 50) {
  const query = `
    query BulkDownload($first: Int!, $offset: Int!) {
      bulkDownload(first: $first, offset: $offset) {
        nodes {
          md5
          filename
          download_url
          nsfw
          tweeted
          average_color
          screenshot_url
          museum_url
        }
      }
    }
  `;

  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { first: limit, offset },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      throw new Error('GraphQL query failed');
    }

    // Extract nodes
    return data.data?.bulkDownload?.nodes || [];
  } catch (error) {
    console.error('Error fetching skins:', error);
    throw error;
  }
}

// Download a skin file
async function downloadSkin(url, filepath) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(filepath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err) => {
        fs.promises.unlink(filepath).catch(() => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

// Get file size
async function getFileSize(filepath) {
  try {
    const stats = await fs.promises.stat(filepath);
    return stats.size;
  } catch (error) {
    return null;
  }
}

// Main function
async function main() {
  console.log('Winamp Skin Scraper');
  console.log('===================');
  console.log(`Target: ${LIMIT} skins`);
  console.log(`Directory: ${SKINS_DIR}`);
  console.log('');

  // Get count of existing skins from database
  const existingCount = await countSkins();
  console.log(`Existing skins in database: ${existingCount}\n`);

  let offset = 0;
  const batchSize = 50;
  let totalDownloaded = 0;
  let skipped = 0;
  let skippedNsfw = 0;
  let skippedNotTweeted = 0;
  let errors = 0;

  while (totalDownloaded < LIMIT) {
    console.log(`\nFetching skins ${offset}-${offset + batchSize}...`);

    try {
      const skins = await fetchSkins(offset, batchSize);

      if (skins.length === 0) {
        console.log('No more skins available');
        break;
      }

      for (const skin of skins) {
        if (totalDownloaded >= LIMIT) break;

        const {
          md5,
          filename,
          download_url: downloadUrl,
          nsfw,
          tweeted,
          average_color,
          screenshot_url,
          museum_url
        } = skin;

        // Skip NSFW skins
        if (nsfw) {
          skippedNsfw++;
          continue;
        }

        // Skip skins that haven't been tweeted (only download tweeted/approved skins)
        if (!tweeted) {
          skippedNotTweeted++;
          continue;
        }

        // Check if already in database
        const existing = await getSkinByMd5(md5);
        if (existing) {
          skipped++;
          continue;
        }

        // Download the skin
        const filepath = path.join(SKINS_DIR, `${md5}.wsz`);

        try {
          console.log(`Downloading: ${filename} (${md5})`);
          await downloadSkin(downloadUrl, filepath);

          // Get file size
          const file_size = await getFileSize(filepath);

          // Add to database
          await createSkin({
            md5,
            filename,
            filepath: `skins/${md5}.wsz`,
            nsfw,
            tweeted,
            average_color,
            screenshot_url,
            museum_url,
            file_size
          });

          totalDownloaded++;

          console.log(`✓ Downloaded (${totalDownloaded}/${LIMIT})`);
        } catch (error) {
          console.error(`✗ Failed to download ${filename}:`, error.message);
          errors++;
        }

        // Small delay to avoid hammering the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      offset += batchSize;

      // Log progress periodically
      if (totalDownloaded % 100 === 0 || totalDownloaded >= LIMIT) {
        const currentCount = await countSkins();
        console.log(`\n📦 Database updated (${currentCount} total skins)`);
      }
    } catch (error) {
      console.error('Error fetching batch:', error);
      break;
    }
  }

  // Final count
  const finalCount = await countSkins();

  console.log('\n✅ Done!');
  console.log(`Downloaded: ${totalDownloaded}`);
  console.log(`Skipped (already downloaded): ${skipped}`);
  console.log(`Skipped (NSFW): ${skippedNsfw}`);
  console.log(`Skipped (not tweeted): ${skippedNotTweeted}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total skins in database: ${finalCount}`);

  // Close database connection
  await closeConnection();
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await closeConnection();
  process.exit(1);
});
