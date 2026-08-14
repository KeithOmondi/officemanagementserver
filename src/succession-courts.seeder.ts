// ============================================================
// src/features/succession-courts/succession-courts.seeder.ts
// ============================================================

import { pool } from './config/db';

export interface SeedCourt {
  name: string;
  station: string;
  category: 'A' | 'B' | 'C' | 'D';
}

export function getSuccessionCourtSeedData(): SeedCourt[] {
  return [
    // ─── Category A ──────────────────────────────────────────────────
    {
      name: "Milimani CM's Family Division",
      station: "Milimani CM's Family Division",
      category: 'A',
    },
    {
      name: 'Mombasa Law Courts',
      station: 'Mombasa Law Courts',
      category: 'A',
    },
    {
      name: 'Kwale Law Courts',
      station: 'Kwale Law Courts',
      category: 'A',
    },
    {
      name: 'Kisumu Law Courts',
      station: 'Kisumu Law Courts',
      category: 'A',
    },
    {
      name: 'Kitale Law Courts',
      station: 'Kitale Law Courts',
      category: 'A',
    },
    {
      name: 'Naivasha Law Courts',
      station: 'Naivasha Law Courts',
      category: 'A',
    },
    {
      name: 'Kakamega Law Courts',
      station: 'Kakamega Law Courts',
      category: 'A',
    },
    {
      name: 'Kapenguria Law Courts',
      station: 'Kapenguria Law Courts',
      category: 'A',
    },
    {
      name: 'Maua Law Courts',
      station: 'Maua Law Courts',
      category: 'A',
    },
    {
      name: 'Nanyuki Law Courts',
      station: 'Nanyuki Law Courts',
      category: 'A',
    },
    {
      name: 'Machakos Law Courts',
      station: 'Machakos Law Courts',
      category: 'A',
    },
    {
      name: 'Thika Law Courts',
      station: 'Thika Law Courts',
      category: 'A',
    },
    {
      name: 'Busia Law Courts',
      station: 'Busia Law Courts',
      category: 'A',
    },
    {
      name: 'Kajiado Law Courts',
      station: 'Kajiado Law Courts',
      category: 'A',
    },
    {
      name: 'Malindi Law Courts',
      station: 'Malindi Law Courts',
      category: 'A',
    },
    {
      name: 'Kilifi Law Courts',
      station: 'Kilifi Law Courts',
      category: 'A',
    },
    {
      name: 'Kaloleni Law Courts',
      station: 'Kaloleni Law Courts',
      category: 'A',
    },
    {
      name: 'Mariakani Law Courts',
      station: 'Mariakani Law Courts',
      category: 'A',
    },
    {
      name: 'Mombasa Kadhis Court',
      station: 'Mombasa Kadhis Court',
      category: 'A',
    },
    {
      name: 'Tigania Law Courts',
      station: 'Tigania Law Courts',
      category: 'A',
    },
    {
      name: 'Githongo Law Courts',
      station: 'Githongo Law Courts',
      category: 'A',
    },
    {
      name: 'Lamu Law Courts',
      station: 'Lamu Law Courts',
      category: 'A',
    },
    {
      name: 'Mpeketoni Law Courts',
      station: 'Mpeketoni Law Courts',
      category: 'A',
    },
    {
      name: 'Kapsabet Law Courts',
      station: 'Kapsabet Law Courts',
      category: 'A',
    },
    {
      name: 'Tinderet Law Court',
      station: 'Tinderet Law Court',
      category: 'A',
    },
    {
      name: 'Narok Law Courts',
      station: 'Narok Law Courts',
      category: 'A',
    },
    {
      name: 'Othaya Law Courts',
      station: 'Othaya Law Courts',
      category: 'A',
    },
    {
      name: 'Nkubu Law Courts',
      station: 'Nkubu Law Courts',
      category: 'A',
    },
    {
      name: 'Maralal Law Courts',
      station: 'Maralal Law Courts',
      category: 'A',
    },
    {
      name: 'Kabarnet Law Courts',
      station: 'Kabarnet Law Courts',
      category: 'A',
    },
    {
      name: 'Iten Law Courts',
      station: 'Iten Law Courts',
      category: 'A',
    },
    {
      name: 'Kitui Law Courts',
      station: 'Kitui Law Courts',
      category: 'A',
    },
    {
      name: 'Kilgoris Law Courts',
      station: 'Kilgoris Law Courts',
      category: 'A',
    },
    {
      name: 'Siakago Law Courts',
      station: 'Siakago Law Courts',
      category: 'A',
    },

    // ─── Category B ──────────────────────────────────────────────────
    {
      name: 'Upperhill Kadhis Court',
      station: 'Upperhill Kadhis Court',
      category: 'B',
    },
    {
      name: 'Runyenjes Law Courts',
      station: 'Runyenjes Law Courts',
      category: 'B',
    },
    {
      name: 'Rongo Law Courts',
      station: 'Rongo Law Courts',
      category: 'B',
    },
    {
      name: 'Kehancha Law Courts',
      station: 'Kehancha Law Courts',
      category: 'B',
    },
    {
      name: 'Voi Law Courts',
      station: 'Voi Law Courts',
      category: 'B',
    },
    {
      name: 'Engineer Law Court',
      station: 'Engineer Law Court',
      category: 'B',
    },
    {
      name: 'Ol Kalou Law Court',
      station: 'Ol Kalou Law Court',
      category: 'B',
    },
    {
      name: 'Kithimani Law Courts',
      station: 'Kithimani Law Courts',
      category: 'B',
    },
    {
      name: 'Taveta Law Courts',
      station: 'Taveta Law Courts',
      category: 'B',
    },
    {
      name: 'Shanzu Law Courts',
      station: 'Shanzu Law Courts',
      category: 'B',
    },
    {
      name: 'Wundanyi Law Courts',
      station: 'Wundanyi Law Courts',
      category: 'B',
    },
    {
      name: 'Webuye Law Courts',
      station: 'Webuye Law Courts',
      category: 'B',
    },
    {
      name: 'Kimiliki Law Courts',
      station: 'Kimiliki Law Courts',
      category: 'B',
    },
    {
      name: 'Sirisia Law Court',
      station: 'Sirisia Law Court',
      category: 'B',
    },
    {
      name: 'Mandera Law Courts',
      station: 'Mandera Law Courts',
      category: 'B',
    },
    {
      name: 'Elwak Kadhis Court',
      station: 'Elwak Kadhis Court',
      category: 'B',
    },
    {
      name: 'Msabweni Law Courts',
      station: 'Msabweni Law Courts',
      category: 'B',
    },
    {
      name: 'Tononoka Law Courts',
      station: 'Tononoka Law Courts',
      category: 'B',
    },
    {
      name: 'Garsen Law Courts',
      station: 'Garsen Law Courts',
      category: 'B',
    },
    {
      name: 'Hola Law Courts',
      station: 'Hola Law Courts',
      category: 'B',
    },
    {
      name: 'Bura/Fafi Kadhis Court',
      station: 'Bura/Fafi Kadhis Court',
      category: 'B',
    },
    {
      name: 'Witu Kadhis Court',
      station: 'Witu Kadhis Court',
      category: 'B',
    },
    {
      name: 'Marsabit Law Courts',
      station: 'Marsabit Law Courts',
      category: 'B',
    },
    {
      name: 'Moyale Law Courts',
      station: 'Moyale Law Courts',
      category: 'B',
    },
    {
      name: 'Isiolo Law Courts',
      station: 'Isiolo Law Courts',
      category: 'B',
    },
    {
      name: 'Ijara Kadhis Court',
      station: 'Ijara Kadhis Court',
      category: 'B',
    },
    {
      name: 'Garbatulla Law Courts',
      station: 'Garbatulla Law Courts',
      category: 'B',
    },
    {
      name: 'Garbatulla Kadhis Court',
      station: 'Garbatulla Kadhis Court',
      category: 'B',
    },
    {
      name: 'Merti Kadhis Court',
      station: 'Merti Kadhis Court',
      category: 'B',
    },
    {
      name: 'Lodwar Law Courts',
      station: 'Lodwar Law Courts',
      category: 'B',
    },
    {
      name: 'Kakuma Law Courts',
      station: 'Kakuma Law Courts',
      category: 'B',
    },
    {
      name: 'Marigat Law Courts',
      station: 'Marigat Law Courts',
      category: 'B',
    },

    // ─── Category C ──────────────────────────────────────────────────
    {
      name: 'Milimani Family Division',
      station: 'Milimani Family Division',
      category: 'C',
    },
    {
      name: 'Makueni Law Courts',
      station: 'Makueni Law Courts',
      category: 'C',
    },
    {
      name: 'Madiany Law Courts',
      station: 'Madiany Law Courts',
      category: 'C',
    },
    {
      name: 'Mwingi Law Courts',
      station: 'Mwingi Law Courts',
      category: 'C',
    },
    {
      name: 'Kyuso Law Courts',
      station: 'Kyuso Law Courts',
      category: 'C',
    },
    {
      name: 'Ukwala Law Courts',
      station: 'Ukwala Law Courts',
      category: 'C',
    },
    {
      name: 'Mutomo Law Courts',
      station: 'Mutomo Law Courts',
      category: 'C',
    },
    {
      name: 'Sotik Law Courts',
      station: 'Sotik Law Courts',
      category: 'C',
    },
    {
      name: 'Mbita Law Courts',
      station: 'Mbita Law Courts',
      category: 'C',
    },
    {
      name: 'Oyugis Law Courts',
      station: 'Oyugis Law Courts',
      category: 'C',
    },
    {
      name: 'Kangundo Law Courts',
      station: 'Kangundo Law Courts',
      category: 'C',
    },
    {
      name: 'Ruiru Law Courts',
      station: 'Ruiru Law Courts',
      category: 'C',
    },
    {
      name: 'Mavoko Law Courts',
      station: 'Mavoko Law Courts',
      category: 'C',
    },
    {
      name: 'Tawa Law Courts',
      station: 'Tawa Law Courts',
      category: 'C',
    },
    {
      name: 'Kilungu Law Courts',
      station: 'Kilungu Law Courts',
      category: 'C',
    },
    {
      name: 'Makindu Law Courts',
      station: 'Makindu Law Courts',
      category: 'C',
    },
    {
      name: 'Loitoktok Law Courts',
      station: 'Loitoktok Law Courts',
      category: 'C',
    },
    {
      name: 'Ngong Law Courts',
      station: 'Ngong Law Courts',
      category: 'C',
    },
    {
      name: 'Hamisi Law Courts',
      station: 'Hamisi Law Courts',
      category: 'C',
    },
    {
      name: 'Kabiyet Law Courts',
      station: 'Kabiyet Law Courts',
      category: 'C',
    },
    {
      name: 'Garissa Law Courts',
      station: 'Garissa Law Courts',
      category: 'C',
    },
    {
      name: 'Othaya Law Courts',
      station: 'Othaya Law Courts',
      category: 'C',
    },
    {
      name: 'Mukurwe-ini Law Courts',
      station: 'Mukurwe-ini Law Courts',
      category: 'C',
    },
    {
      name: 'Dadaab Law Court',
      station: 'Dadaab Law Court',
      category: 'C',
    },
    {
      name: 'Balambala Kadhis Court',
      station: 'Balambala Kadhis Court',
      category: 'C',
    },
    {
      name: 'Bute Kadhis Court',
      station: 'Bute Kadhis Court',
      category: 'C',
    },
    {
      name: 'Eldas Kadhis Court',
      station: 'Eldas Kadhis Court',
      category: 'C',
    },
    {
      name: 'Modogashe Kadhis Court',
      station: 'Modogashe Kadhis Court',
      category: 'C',
    },
    {
      name: 'Takaba Kadhis Court',
      station: 'Takaba Kadhis Court',
      category: 'C',
    },
    {
      name: 'Molo Law Courts',
      station: 'Molo Law Courts',
      category: 'C',
    },
    {
      name: 'Eldama Ravine Law Court',
      station: 'Eldama Ravine Law Court',
      category: 'C',
    },
    {
      name: 'Kibiyet Law Court',
      station: 'Kibiyet Law Court',
      category: 'C',
    },

    // ─── Category D ──────────────────────────────────────────────────
    {
      name: 'Nakuru Law Courts',
      station: 'Nakuru Law Courts',
      category: 'D',
    },
    {
      name: 'Gatundu Law Courts',
      station: 'Gatundu Law Courts',
      category: 'D',
    },
    {
      name: 'Embu Law Courts',
      station: 'Embu Law Courts',
      category: 'D',
    },
    {
      name: 'Meru Law Courts',
      station: 'Meru Law Courts',
      category: 'D',
    },
    {
      name: 'Karatina Law Courts',
      station: 'Karatina Law Courts',
      category: 'D',
    },
  ];
}

// ─── Seeder Class ──────────────────────────────────────────────────────────

export class SuccessionCourtSeeder {
  /**
   * Get a valid user ID to use for seeding
   * Tries to find a super_admin, then any admin, then any active user
   *
   * NOTE: This is intentionally public (not private) — the CLI entry point
   * at the bottom of this file calls it from outside the class body, and a
   * private static member is not accessible there.
   */
  static async getValidUserId(providedUserId?: string): Promise<string> {
    // If a user ID was provided, verify it exists
    if (providedUserId) {
      const { rows } = await pool.query(
        `SELECT id FROM users WHERE id = $1 AND is_active = true`,
        [providedUserId]
      );
      if (rows.length > 0) {
        return providedUserId;
      }
      console.warn(`⚠️  Provided user ID "${providedUserId}" not found or inactive. Searching for alternative...`);
    }

    // Try to find a super admin
    const { rows: superAdminRows } = await pool.query(
      `SELECT id FROM users WHERE role = 'super_admin' AND is_active = true LIMIT 1`
    );
    if (superAdminRows.length > 0) {
      console.log(`👤 Using super_admin: ${superAdminRows[0].id}`);
      return superAdminRows[0].id;
    }

    // Try to find any admin
    const { rows: adminRows } = await pool.query(
      `SELECT id FROM users WHERE role = 'admin' AND is_active = true LIMIT 1`
    );
    if (adminRows.length > 0) {
      console.log(`👤 Using admin: ${adminRows[0].id}`);
      return adminRows[0].id;
    }

    // Try to find any active user
    const { rows: userRows } = await pool.query(
      `SELECT id FROM users WHERE is_active = true LIMIT 1`
    );
    if (userRows.length > 0) {
      console.log(`👤 Using active user: ${userRows[0].id}`);
      return userRows[0].id;
    }

    // No users found - throw error
    throw new Error(
      'No active users found in the database. Please create a user first or provide a valid user ID.'
    );
  }

  /**
   * Seed the database with the initial list of succession courts
   */
  static async seed(
    userId: string,
    options?: { dryRun?: boolean; force?: boolean }
  ): Promise<{ inserted: number; skipped: number; errors: string[] }> {
    const courts = getSuccessionCourtSeedData();
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    console.log(`📋 Seeding ${courts.length} courts...`);

    for (const court of courts) {
      try {
        // Check if already exists
        const { rows } = await pool.query(
          `SELECT id FROM succession_courts WHERE station = $1 AND category = $2`,
          [court.station, court.category]
        );

        if (rows.length > 0) {
          skipped++;
          continue;
        }

        // Skip insert if dry run
        if (options?.dryRun) {
          inserted++;
          continue;
        }

        await pool.query(
          `INSERT INTO succession_courts (
            name, station, category, created_by
          ) VALUES ($1, $2, $3, $4)`,
          [court.name, court.station, court.category, userId]
        );
        inserted++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to seed "${court.name}": ${errorMessage}`);

        // If force mode is disabled, stop on first error
        if (!options?.force) {
          throw new Error(`Seeding failed at "${court.name}": ${errorMessage}`);
        }
      }
    }

    return { inserted, skipped, errors };
  }

  /**
   * Clear all succession courts from the database
   */
  static async clear(): Promise<{ deleted: number }> {
    const { rows } = await pool.query(`DELETE FROM succession_courts RETURNING id`);
    return { deleted: rows.length };
  }

  /**
   * Count total succession courts in the database
   */
  static async count(): Promise<number> {
    const { rows } = await pool.query(`SELECT COUNT(*) as count FROM succession_courts`);
    return parseInt(rows[0].count, 10);
  }

  /**
   * Validate that all seed data is valid before attempting to seed
   */
  static validate(): { valid: boolean; errors: string[] } {
    const courts = getSuccessionCourtSeedData();
    const errors: string[] = [];
    const seen = new Set<string>();

    courts.forEach((court, index) => {
      const key = `${court.station}|${court.category}`;

      // Check for duplicates
      if (seen.has(key)) {
        errors.push(
          `Duplicate entry at index ${index}: "${court.station}" (Category ${court.category})`
        );
      }
      seen.add(key);

      // Validate required fields
      if (!court.name || court.name.trim().length === 0) {
        errors.push(`Invalid name at index ${index}: Name is required`);
      }
      if (!court.station || court.station.trim().length === 0) {
        errors.push(`Invalid station at index ${index}: Station is required`);
      }
      if (!['A', 'B', 'C', 'D'].includes(court.category)) {
        errors.push(`Invalid category at index ${index}: Must be A, B, C, or D`);
      }
    });

    return { valid: errors.length === 0, errors };
  }
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────

if (require.main === module) {
  (async () => {
    console.log('\n🌱 =========================================');
    console.log('   SUCCESSION COURTS SEEDER');
    console.log('   =========================================\n');

    try {
      // Parse command line arguments
      const args = process.argv.slice(2);
      const providedUserId = args[0] || undefined;
      const isDryRun = args.includes('--dry-run');
      const isForce = args.includes('--force');
      const shouldClear = args.includes('--clear');

      // Validate data first
      console.log('📋 Validating seed data...');
      const validation = SuccessionCourtSeeder.validate();
      if (!validation.valid) {
        console.error('❌ Validation failed:');
        validation.errors.forEach((err) => console.error(`  - ${err}`));
        process.exit(1);
      }
      console.log('✅ Data validation passed\n');

      // Get a valid user ID
      console.log('🔍 Looking for a valid user...');
      let userId: string;
      try {
        userId = await SuccessionCourtSeeder.getValidUserId(providedUserId);
        console.log(`✅ Found user: ${userId}\n`);
      } catch (error) {
        console.error('❌ No valid user found:', error instanceof Error ? error.message : error);
        console.log('\n💡 To fix this:');
        console.log('   1. Create a user in the database');
        console.log('   2. Or provide a valid user ID:');
        console.log('      npx ts-node src/features/succession-courts/succession-courts.seeder.ts <user-uuid>');
        process.exit(1);
      }

      // Check current count
      const currentCount = await SuccessionCourtSeeder.count();
      console.log(`📊 Current courts in database: ${currentCount}\n`);

      // Handle clear flag
      if (shouldClear) {
        console.log('⚠️  WARNING: You are about to delete ALL succession courts!');
        console.log('   This action cannot be undone.\n');
        console.log('   Press Ctrl+C to cancel or wait 5 seconds to continue...');
        await new Promise((resolve) => setTimeout(resolve, 5000));

        console.log('🗑️  Clearing all courts...');
        const clearResult = await SuccessionCourtSeeder.clear();
        console.log(`✅ Cleared ${clearResult.deleted} courts\n`);
      }

      // Handle dry run
      if (isDryRun) {
        console.log('🔍 DRY RUN MODE - No data will be inserted');
        console.log(`   Would insert ${getSuccessionCourtSeedData().length} courts\n`);
        const result = await SuccessionCourtSeeder.seed(userId, { dryRun: true, force: isForce });
        console.log('📊 Dry run results:');
        console.log(`   ✅ Would insert: ${result.inserted}`);
        console.log(`   ⏭️  Would skip: ${result.skipped} (already exist)`);
        if (result.errors.length > 0) {
          console.log(`   ❌ Errors: ${result.errors.length}`);
          result.errors.forEach((err) => console.log(`      - ${err}`));
        }
        console.log('\n✅ Dry run completed successfully!');
        process.exit(0);
      }

      // Run the seed
      console.log('🔄 Seeding courts...');
      const result = await SuccessionCourtSeeder.seed(userId, { dryRun: false, force: isForce });

      console.log('\n📊 Results:');
      console.log(`   ✅ Inserted: ${result.inserted}`);
      console.log(`   ⏭️  Skipped: ${result.skipped} (already exist)`);
      if (result.errors.length > 0) {
        console.log(`   ❌ Errors: ${result.errors.length}`);
        result.errors.forEach((err) => console.log(`      - ${err}`));
      }

      const newCount = await SuccessionCourtSeeder.count();
      console.log(`\n📊 Total courts now: ${newCount}`);

      console.log('\n✅ Seeding completed successfully!');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Seeding failed:', error instanceof Error ? error.message : error);
      console.error('\n💡 Tips:');
      console.error('   - Make sure your database is running');
      console.error('   - Check your .env file for correct database credentials');
      console.error('   - Run with --dry-run to preview changes');
      console.error('   - Run with --force to continue on errors');
      process.exit(1);
    }
  })();
}