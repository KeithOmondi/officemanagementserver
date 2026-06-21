import { pool } from "./config/db";

async function seedAdmin() {
  const full_name = 'Ken Ogutu';
  const pj_number = '57285';
  const email = 'kenoogutu@gmail.com';
  const role = 'admin';

  console.log('🌱 Starting admin user seeding process via DB Pool...');

  // Updated query strings to capture full_name parameters
  const query = `
    INSERT INTO users (full_name, pj_number, email, role)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (pj_number) 
    DO UPDATE SET 
      full_name = EXCLUDED.full_name,
      email = EXCLUDED.email, 
      role = EXCLUDED.role
    RETURNING id, full_name, pj_number, email, role;
  `;

  try {
    // Passed all 4 elements in matching sequential order
    const result = await pool.query(query, [full_name, pj_number, email, role]);
    const admin = result.rows[0];

    console.log('✅ Admin user successfully seeded:');
    console.dir(admin);
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  } finally {
    // Shuts down the pool connection so the script exits completely
    await pool.end();
  }
}

seedAdmin();