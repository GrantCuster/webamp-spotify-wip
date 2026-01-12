import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// S3 Configuration
const REGION = process.env.AWS_REGION || 'us-east-2';
const BUCKET_NAME = process.env.S3_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME;
const S3_PREFIX = 'webamp-skins/';

if (!BUCKET_NAME) {
  throw new Error('S3_BUCKET_NAME or AWS_S3_BUCKET_NAME environment variable is required');
}

// Create S3 client
export const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

/**
 * Upload a file to S3
 * @param localFilePath - Path to the local file
 * @param s3Key - S3 key (will be prefixed with webamp-skins/)
 * @returns The full S3 key
 */
export async function uploadFileToS3(
  localFilePath: string,
  s3Key: string
): Promise<string> {
  try {
    // Read the file
    const fileContent = await fs.readFile(localFilePath);

    // Add prefix to key
    const fullKey = `${S3_PREFIX}${s3Key}`;

    // Determine content type
    const contentType = s3Key.endsWith('.wsz') || s3Key.endsWith('.zip')
      ? 'application/zip'
      : s3Key.endsWith('.wal')
      ? 'application/octet-stream'
      : 'application/octet-stream';

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fullKey,
      Body: fileContent,
      ContentType: contentType,
    });

    await s3Client.send(command);

    console.log(`✓ Uploaded to S3: ${fullKey}`);
    return fullKey;
  } catch (error) {
    console.error(`Failed to upload ${s3Key} to S3:`, error);
    throw error;
  }
}

/**
 * Check if a file exists in S3
 * @param s3Key - Full S3 key (including prefix)
 * @returns true if file exists, false otherwise
 */
export async function fileExistsInS3(s3Key: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });

    await s3Client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Delete a file from S3
 * @param s3Key - Full S3 key (including prefix)
 */
export async function deleteFileFromS3(s3Key: string): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });

    await s3Client.send(command);
    console.log(`✓ Deleted from S3: ${s3Key}`);
  } catch (error) {
    console.error(`Failed to delete ${s3Key} from S3:`, error);
    throw error;
  }
}

/**
 * Get the public URL for an S3 object
 * @param s3Key - Full S3 key (including prefix)
 * @returns Public URL
 */
export function getS3PublicUrl(s3Key: string): string {
  return `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${s3Key}`;
}

/**
 * Get S3 configuration info
 */
export function getS3Config() {
  return {
    bucket: BUCKET_NAME,
    region: REGION,
    prefix: S3_PREFIX,
  };
}
