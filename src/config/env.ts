// src/config/env.ts
import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load raw env strings before schema validation
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  // Server
  PORT:     z.coerce.number().default(8000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // URLs
  API_URL:    z.string().min(1, { message: 'API_URL is required (e.g. http://localhost:8000)' }),
  CLIENT_URL: z.string().min(1, { message: 'CLIENT_URL is required (e.g. http://localhost:5173)' }),

  // Database
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid connection string' }),

  // JWT
  JWT_SECRET:         z.string().min(8, { message: 'JWT_SECRET must be at least 8 characters long' }),
  JWT_REFRESH_SECRET: z.string().min(8),

  // Brevo (email)
  BREVO_API_KEY:  z.string().min(1, { message: 'BREVO_API_KEY is required' }),
  SENDER_NAME:    z.string().min(1, { message: 'SENDER_NAME is required' }),
  SENDER_EMAIL:   z.string().email({ message: 'SENDER_EMAIL must be a valid email address' }),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME:  z.string().min(1, { message: 'CLOUDINARY_CLOUD_NAME is required' }),
  CLOUDINARY_API_KEY:     z.string().min(1, { message: 'CLOUDINARY_API_KEY is required' }),
  CLOUDINARY_API_SECRET:  z.string().min(1, { message: 'CLOUDINARY_API_SECRET is required' }),

  // Google Calendar
  GOOGLE_CLIENT_ID:     z.string().min(1, { message: 'GOOGLE_CLIENT_ID is required for Google Calendar integration' }),
  GOOGLE_CLIENT_SECRET: z.string().min(1, { message: 'GOOGLE_CLIENT_SECRET is required for Google Calendar integration' }),
  GOOGLE_REDIRECT_URI:  z.string().min(1, { message: 'GOOGLE_REDIRECT_URI is required (e.g. http://localhost:8000/api/v1/calendar/google/callback)' }),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Environment variable validation failed:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }

  return result.data;
};

export const env = parseEnv();

export type Env = z.infer<typeof envSchema>;