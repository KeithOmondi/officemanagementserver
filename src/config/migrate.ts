// src/config/migrate.ts
import { pool } from './db';
import fs from 'fs';
import path from 'path';

async function migrate() {
  const sql = fs.readFileSync(
    path.join(__dirname, '../../migrations/001_initial_schema.sql'),
    'utf8'
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();