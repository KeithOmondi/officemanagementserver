import { Pool } from 'pg';
import { env } from './env';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === 'production' || env.DATABASE_URL.includes('neon.tech') 
    ? { rejectUnauthorized: false } 
    : false,
  connectionTimeoutMillis: 20000, 
  idleTimeoutMillis: 30000,
  max: 10,
  // Sets the session timezone as part of the connection handshake itself —
  // no extra query needed, avoids any race with queries fired right after connect.
  options: '-c timezone=Africa/Nairobi',
});

export const connectDB = async (): Promise<void> => {
  try {
    console.log('🐘 Attempting to connect to PostgreSQL...');
    const client = await pool.connect();
    
    const res = await client.query('SELECT NOW()');
    console.log(`✅ PostgreSQL connected! Server time: ${res.rows[0].now}`);
    
    client.release();
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:');
    console.error(error);
    process.exit(1);
  }
};