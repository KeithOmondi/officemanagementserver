// scripts/test-bringup-reminders.ts
// Run with: npx ts-node src/test-bringup-reminders.ts
import { pool } from '../src/config/db';
import { DocumentService } from '../src/features/documents/documents.service';

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

    // ─── Updated: Insert marks with bring_up_date in document_marks ──────────
    const { rows: todayMark } = await pool.query(
        `INSERT INTO document_marks
            (document_id, marked_by, marked_to_dept, assigned_to, instructions, priority, is_active)
         VALUES ($1, $2, $3, $2, 'TEST — due today reminder', 'high', true)
         RETURNING id`,
        [documentId, userId, departmentId]
    );

    const { rows: tomorrowMark } = await pool.query(
        `INSERT INTO document_marks
            (document_id, marked_by, marked_to_dept, assigned_to, instructions, priority, is_active)
         VALUES ($1, $2, $3, $2, 'TEST — due tomorrow reminder', 'high', true)
         RETURNING id`,
        [documentId, userId, departmentId]
    );

    // ─── Updated: Set bring_up_date on documents table ──────────────────────
    await pool.query(
        `UPDATE documents 
         SET bring_up_date = CURRENT_DATE,
             bring_up_set_by = $1,
             bring_up_set_by_name = $2,
             bring_up_set_at = NOW(),
             bring_up_notes = 'TEST — due today reminder'
         WHERE id = $3`,
        [userId, userRows[0].full_name, documentId]
    );

    console.log(`✅ Set bring up date (today) for document: ${documentId}`);

    // ─── Test the sendBringUpReminders method ──────────────────────────────
    console.log('\n📨 Running sendBringUpReminders()...');
    const result = await DocumentService.sendBringUpReminders();
    console.log(`✅ Sent ${result.dueToday} due-today reminder(s), ${result.overdue} overdue reminder(s)`);

    // ─── Clean up ────────────────────────────────────────────────────────────
    await pool.query(
        `UPDATE documents 
         SET bring_up_date = NULL,
             bring_up_set_by = NULL,
             bring_up_set_by_name = NULL,
             bring_up_set_at = NULL,
             bring_up_notes = NULL
         WHERE id = $1`,
        [documentId]
    );

    await pool.query(`UPDATE document_marks SET is_active = false WHERE id = ANY($1)`, [
        [todayMark[0].id, tomorrowMark[0].id],
    ]);
    console.log('🧹 Test data cleaned up');

    await pool.end();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});