import dotenv from 'dotenv';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import SignedUrlCache from '../models/signedUrlCache.model.js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

dotenv.config();

const awsAccessKey = process.env.AWS_ACCESS_KEY;
const hasAwsConfig = process.env.AWS_REGION && awsAccessKey && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET_NAME;

let s3Client;
if (hasAwsConfig) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: awsAccessKey,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
} else {
  console.warn("[aws.config] Missing AWS configuration; S3 features will be disabled until env vars are set.");
}

export { s3Client };

export async function generateSignedUrl(key, expires = 172800) {
  if (!s3Client) {
    throw new Error("AWS S3 is not configured. Set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME.");
  }

  const existing = await SignedUrlCache.findOne({ key });
  if (existing && existing.expiresAt > new Date()) {
    return existing.url;
  }

  const urlParts = key?.split('/');
  const s3Key = urlParts.slice(3).join('/');
  if (!s3Key) throw new Error("Invalid S3 key");

  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: s3Key,
  });

  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: expires });

  const expiresAt = new Date(Date.now() + expires * 1000);

  await SignedUrlCache.findOneAndUpdate(
    { key },
    { key, url: signedUrl, expiresAt },
    { upsert: true, new: true }
  );

  return signedUrl;
}
