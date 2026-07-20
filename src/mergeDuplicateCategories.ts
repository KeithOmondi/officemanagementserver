// scripts/mergeDuplicateCategories.ts
import { pool } from '../src/config/db'; // adjust path to match your project

interface CategoryRow {
    id: string;
    name: string;
    parent_id: string | null;
    created_at: string;
}

async function run() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows } = await client.query<CategoryRow>(
            `SELECT id, name, parent_id, created_at FROM categories`
        );

        // Map of old_id -> canonical_id (keeper). Keepers map to themselves.
        const canonicalMap = new Map<string, string>();

        // We process level by level: first rows whose parent_id is null,
        // then rows whose (already-resolved) parent is known, etc.
        // This guarantees we never group children before their parent's
        // canonical id has been decided.
        const remaining = new Set(rows.map(r => r.id));
        const byId = new Map(rows.map(r => [r.id, r]));

        let progress = true;
        while (remaining.size > 0 && progress) {
            progress = false;

            // Find rows whose parent is resolved (null, or already canonicalized)
            const readyIds = [...remaining].filter(id => {
                const row = byId.get(id)!;
                return row.parent_id === null || canonicalMap.has(row.parent_id);
            });

            if (readyIds.length === 0) break; // safety valve against cycles

            // Group ready rows by (name, canonical_parent_id)
            const groups = new Map<string, CategoryRow[]>();
            for (const id of readyIds) {
                const row = byId.get(id)!;
                const canonicalParent = row.parent_id ? canonicalMap.get(row.parent_id)! : null;
                const key = `${row.name}::${canonicalParent ?? 'ROOT'}`;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(row);
            }

            for (const group of groups.values()) {
                // Keeper = oldest created_at (stable, arbitrary but consistent choice)
                const sorted = [...group].sort(
                    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
                const keeper = sorted[0];
                for (const row of sorted) {
                    canonicalMap.set(row.id, keeper.id);
                }
            }

            for (const id of readyIds) remaining.delete(id);
            progress = true;
        }

        if (remaining.size > 0) {
            throw new Error(
                `Could not resolve ${remaining.size} categories — possible parent_id cycle. IDs: ${[...remaining].join(', ')}`
            );
        }

        // Build the list of duplicate ids to remove (those that map to a different id)
        const duplicateIds = [...canonicalMap.entries()]
            .filter(([oldId, keeperId]) => oldId !== keeperId)
            .map(([oldId]) => oldId);

        console.log(`Found ${duplicateIds.length} duplicate categories to merge.`);

        if (duplicateIds.length === 0) {
            console.log('Nothing to do.');
            await client.query('ROLLBACK');
            return;
        }

        // Repoint every table that references categories.id
        for (const [oldId, keeperId] of canonicalMap.entries()) {
            if (oldId === keeperId) continue;

            await client.query(
                `UPDATE inventory_items SET category_id = $1 WHERE category_id = $2`,
                [keeperId, oldId]
            );
            await client.query(
                `UPDATE procurement_requests SET category_id = $1 WHERE category_id = $2`,
                [keeperId, oldId]
            );
            await client.query(
                `UPDATE approved_procurement_items SET category_id = $1 WHERE category_id = $2`,
                [keeperId, oldId]
            );
            // Repoint child categories whose parent_id pointed at a duplicate
            await client.query(
                `UPDATE categories SET parent_id = $1 WHERE parent_id = $2`,
                [keeperId, oldId]
            );
        }

        // Now safe to delete the duplicate category rows themselves
        await client.query(
            `DELETE FROM categories WHERE id = ANY($1::uuid[])`,
            [duplicateIds]
        );

        // Prevent this from happening again
        await client.query(
            `ALTER TABLE categories
             ADD CONSTRAINT categories_name_parent_unique UNIQUE (name, parent_id)`
        ).catch((err) => {
            // Constraint may already exist if you re-run this script; that's fine.
            console.warn('Could not add unique constraint (may already exist):', err.message);
        });

        await client.query('COMMIT');
        console.log(`Merged and removed ${duplicateIds.length} duplicate categories successfully.`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration failed, rolled back:', err);
        throw err;
    } finally {
        client.release();
    }
}

run()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));