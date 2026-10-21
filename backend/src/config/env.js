import dotenv from 'dotenv';
dotenv.config();

const required = ['JWT_SECRET'];

for (const key of required) {
  if (!process.env[key]) {
    console.warn(`[Config] Warning: Missing environment variable ${key}. Default fallback will be used if in dev.`);
  }
}

export const env = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || '',
  DIRECT_URL: process.env.DIRECT_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  STUDENT_DOMAIN: process.env.STUDENT_DOMAIN || 'vitstudent.ac.in',
  STAFF_DOMAIN: process.env.STAFF_DOMAIN || 'vit.ac.in',
  BOOTSTRAP_ADMIN_EMAILS: (process.env.BOOTSTRAP_ADMIN_EMAILS || 'admin@vit.ac.in')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean),
  BOOTSTRAP_FACULTY_EMAILS: (process.env.BOOTSTRAP_FACULTY_EMAILS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean),
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',
  CORS_ORIGIN: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:8080')
    .split(',')
    .map(s => s.trim()),
  APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:5173',
  EMAIL_ENABLED: process.env.EMAIL_ENABLED === 'true',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  ENABLE_APP_CRON: process.env.ENABLE_APP_CRON === 'true'
};
