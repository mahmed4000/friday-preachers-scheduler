import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isSupabaseConfigured, getSupabaseConfig } from '../src/lib/supabaseClient.ts';
import { SupabaseSyncService } from '../src/services/supabaseSyncService.ts';
import { memoryStore } from '../src/server/memoryStore.ts';

test('Phase 3 Supabase Cloud Database Integration & Resilience Tests', async (t) => {
  await t.test('1. Supabase Client Configuration & Offline-First Safety', () => {
    const config = getSupabaseConfig();
    assert.ok(typeof config.isConfigured === 'boolean', 'isConfigured must be boolean');
    assert.ok(typeof config.hasKey === 'boolean', 'hasKey must be boolean');

    // Without production env vars, it should safely report unconfigured without crashing
    if (!process.env.SUPABASE_URL) {
      assert.equal(isSupabaseConfigured, false, 'Should safely be false when SUPABASE_URL is not provided');
    }
  });

  await t.test('2. SupabaseSyncService.checkConnection() Resilience', async () => {
    const status = await SupabaseSyncService.checkConnection();
    assert.ok(status, 'Status object must be returned');
    assert.ok(typeof status.configured === 'boolean');
    assert.ok(typeof status.connected === 'boolean');
    assert.ok(typeof status.message === 'string');
    assert.ok(status.message.length > 5, 'Message must be descriptive Arabic explanation');
  });

  await t.test('3. Local Data Schema Preparedness for Supabase Upsert', () => {
    const mosques = memoryStore.getMosques();
    assert.ok(mosques.length > 0, 'Local mosques should exist');

    for (const m of mosques) {
      assert.ok(m.id > 0, 'Mosque must have positive integer id');
      assert.ok(m.name, 'Mosque must have a name');
      assert.ok(m.code, 'Mosque must have a unique code');
    }

    const imams = memoryStore.getImams();
    assert.ok(imams.length > 0, 'Local imams should exist');

    for (const i of imams) {
      assert.ok(i.id > 0, 'Imam must have positive integer id');
      assert.ok(i.name, 'Imam must have a name');
      assert.ok(typeof i.minFridays === 'number', 'minFridays must be numeric');
      assert.ok(typeof i.maxFridays === 'number', 'maxFridays must be numeric');
    }
  });

  await t.test('4. Supabase SQL Schema Completeness', () => {
    const schemaPath = path.resolve(process.cwd(), 'supabase_schema.sql');
    assert.ok(fs.existsSync(schemaPath), 'supabase_schema.sql must exist on disk');

    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    assert.ok(schemaContent.length > 1000, 'Schema should be comprehensive');

    // Verify all 11 core tables are defined
    const requiredTables = [
      'organization_settings',
      'mosques',
      'imams',
      'mosque_imam_rules',
      'monthly_schedules',
      'fridays',
      'assignments',
      'assignment_history',
      'conflicts',
      'overrides',
      'audit_logs',
    ];

    for (const table of requiredTables) {
      assert.ok(
        schemaContent.includes(`CREATE TABLE IF NOT EXISTS ${table}`),
        `Schema must include table "${table}"`
      );
    }

    // Verify Row Level Security (RLS) policies are configured
    assert.ok(schemaContent.includes('ROW LEVEL SECURITY'), 'Schema must enable Row Level Security');
    assert.ok(schemaContent.includes('CREATE POLICY'), 'Schema must configure access policies');
  });
});
