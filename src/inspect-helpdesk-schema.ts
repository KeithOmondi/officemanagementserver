// scripts/inspect-helpdesk-schema.ts
// Run with: npx ts-node scripts/inspect-helpdesk-schema.ts
// Adjust the import path to match your project structure.
import { pool } from '../src/config/db';

const PARENT_TABLES = [
    'circuits',
    'special_benches',
    'part_heards',
    'service_weeks',
    'other_payments',
];

const DSA_TABLES = [
    'circuit_dsa_details',
    'special_bench_dsa_details',
    'part_heard_dsa_details',
    'service_week_dsa_details',
    'other_payment_dsa_details',
];

const JOIN_CONFIG: Record<string, { parent: string; fk: string; parentCols: string }> = {
    circuit_dsa_details: { parent: 'circuits', fk: 'circuit_id', parentCols: 'name, location, start_date, end_date, status' },
    special_bench_dsa_details: { parent: 'special_benches', fk: 'bench_id', parentCols: 'name, case_reference, start_date, end_date, status' },
    part_heard_dsa_details: { parent: 'part_heards', fk: 'part_heard_id', parentCols: 'case_reference, approved_by, start_date, end_date, status' },
    service_week_dsa_details: { parent: 'service_weeks', fk: 'service_week_id', parentCols: 'name, week_number, year, start_date, end_date, status' },
    other_payment_dsa_details: { parent: 'other_payments', fk: 'other_payment_id', parentCols: 'name, description, start_date, end_date, status' },
};

async function main() {
    // 1. Schema
    console.log('\n\n########## SCHEMA ##########');
    const { rows: schemaRows } = await pool.query(
        `SELECT table_name, column_name, data_type, character_maximum_length, is_nullable, column_default, ordinal_position
         FROM information_schema.columns
         WHERE table_name = ANY($1)
         ORDER BY table_name, ordinal_position`,
        [[...PARENT_TABLES, ...DSA_TABLES]]
    );
    const grouped: Record<string, typeof schemaRows> = {};
    for (const row of schemaRows) {
        grouped[row.table_name] = grouped[row.table_name] || [];
        grouped[row.table_name].push(row);
    }
    for (const [table, cols] of Object.entries(grouped)) {
        console.log(`\n=== ${table} ===`);
        console.table(cols.map((c) => ({
            column: c.column_name,
            type: c.data_type,
            maxLen: c.character_maximum_length,
            nullable: c.is_nullable,
            default: c.column_default,
        })));
    }

    // 2. Row counts
    console.log('\n\n########## ROW COUNTS ##########');
    const counts: Record<string, number> = {};
    for (const table of [...PARENT_TABLES, ...DSA_TABLES]) {
        const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
        counts[table] = rows[0].count;
    }
    console.table(counts);

    // 3. Sample joined data
    console.log('\n\n########## SAMPLE DATA (3 rows per module) ##########');
    for (const dsaTable of DSA_TABLES) {
        const { parent, fk, parentCols } = JOIN_CONFIG[dsaTable];
        const parentColsAliased = parentCols
            .split(',')
            .map((c) => `p.${c.trim()} AS parent_${c.trim()}`)
            .join(', ');

        const { rows } = await pool.query(`
            SELECT ${parentColsAliased},
                   d.judge_name, d.pj_number, d.designation, d.dsa_per_day, d.days, d.total
            FROM ${parent} p
            LEFT JOIN ${dsaTable} d ON d.${fk} = p.id AND d.is_active = true
            WHERE p.is_active = true
            LIMIT 3
        `);
        console.log(`\n=== ${dsaTable} (joined with ${parent}) ===`);
        console.table(rows);
    }

    await pool.end();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});