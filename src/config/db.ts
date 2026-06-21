import { Pool } from 'pg';
import { env } from './env';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // 1. Loosen SSL for cloud instances like Neon/Render
  ssl: env.NODE_ENV === 'production' || env.DATABASE_URL.includes('neon.tech') 
    ? { rejectUnauthorized: false } 
    : false,
  // 2. Increase timeouts to give serverless DBs time to "wake up"
  connectionTimeoutMillis: 20000, 
  idleTimeoutMillis: 30000,
  max: 10,
});

export const connectDB = async (): Promise<void> => {
  try {
    console.log('🐘 Attempting to connect to PostgreSQL...');
    const client = await pool.connect();
    
    // Test the live connection hook
    const res = await client.query('SELECT NOW()');
    console.log(`✅ PostgreSQL connected! Server time: ${res.rows[0].now}`);
    
    client.release();
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:');
    console.error(error);
    process.exit(1);
  }
};