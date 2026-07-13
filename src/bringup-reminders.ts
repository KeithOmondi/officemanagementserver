// scripts/test-bringup-reminders.ts
// Run with: npx ts-node src/test-bringup-reminders.ts
import { pool } from '../src/config/db'; // adjust path
import { DocumentService } from '../src/features/documents/documents.service'; // adjust path

async function main() {
    const { rows: docRows } = await pool.query(
        `SELECT id, title FROM documents WHERE is_active = true LIMIT 1`
    );
    const { rows: userRows } = await pool.query(
        `SELECT id, full_name FROM users WHERE is_active = true LIMIT 1`
    );
    const { rows: deptRows } = await pool.query(
        `SELECT id, name FROM departments WHERE is_active = true LIMIT 1`
    );

    if (!docRows.length || !userRows.length || !deptRows.length) {
        console.error('❌ Need at least one active document, one active user, and one active department to seed a test mark.');
        process.exit(1);
    }

    const documentId = docRows[0].id;
    const userId = userRows[0].id;
    const departmentId = deptRows[0].id;

    console.log(`📄 Using document: "${docRows[0].title}" (${documentId})`);
    console.log(`👤 Using user: ${userRows[0].full_name} (${userId})`);
    console.log(`🏢 Using department: ${deptRows[0].name} (${departmentId})`);

    const { rows: todayMark } = await pool.query(
        `INSERT INTO document_marks
            (document_id, marked_by, marked_to_dept, assigned_to, instructions, priority, bring_up_date, is_active)
         VALUES ($1, $2, $3, $2, 'TEST — due today reminder', 'high', CURRENT_DATE, true)
         RETURNING id`,
        [documentId, userId, departmentId]
    );

    const { rows: tomorrowMark } = await pool.query(
        `INSERT INTO document_marks
            (document_id, marked_by, marked_to_dept, assigned_to, instructions, priority, bring_up_date, is_active)
         VALUES ($1, $2, $3, $2, 'TEST — due tomorrow reminder', 'high', (CURRENT_DATE + INTERVAL '1 day')::date, true)
         RETURNING id`,
        [documentId, userId, departmentId]
    );

    console.log(`✅ Seeded mark due today: ${todayMark[0].id}`);
    console.log(`✅ Seeded mark due tomorrow: ${tomorrowMark[0].id}`);

    console.log('\n📨 Running sendBringUpDateReminders()...');
    const result = await DocumentService.sendBringUpDateReminders();
    console.log(`✅ Sent ${result.dueToday} due-today reminder(s), ${result.dueTomorrow} due-tomorrow reminder(s)`);

    await pool.query(`UPDATE document_marks SET is_active = false WHERE id = ANY($1)`, [
        [todayMark[0].id, tomorrowMark[0].id],
    ]);
    console.log('🧹 Test marks deactivated (soft-deleted)');

    await pool.end();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});