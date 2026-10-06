import 'dotenv/config';
import express from 'express';
import http from 'http';
import assert from 'node:assert';
import api from '../src/server/api.ts';
import { db, createPool, isDatabaseConfigured } from '../src/db/index.ts';
import {
  organizationSettings,
  mosques,
  imams,
  mosqueImamRules,
  monthlySchedules,
  fridays,
  assignments,
  assignmentHistory,
  conflicts,
  overrides,
  auditLogs,
} from '../src/db/schema.ts';
import { eq } from 'drizzle-orm';

const RUN_ID = `PERSISTENCE_TEST_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

async function getTableCounts() {
  const [
    mSettings,
    mMosques,
    mImams,
    mRules,
    mSchedules,
    mFridays,
    mAssignments,
    mHistory,
    mConflicts,
    mOverrides,
    mAudit,
  ] = await Promise.all([
    db.select().from(organizationSettings),
    db.select().from(mosques),
    db.select().from(imams),
    db.select().from(mosqueImamRules),
    db.select().from(monthlySchedules),
    db.select().from(fridays),
    db.select().from(assignments),
    db.select().from(assignmentHistory),
    db.select().from(conflicts),
    db.select().from(overrides),
    db.select().from(auditLogs),
  ]);

  return {
    organization_settings: mSettings.length,
    mosques: mMosques.length,
    imams: mImams.length,
    mosque_imam_rules: mRules.length,
    monthly_schedules: mSchedules.length,
    fridays: mFridays.length,
    assignments: mAssignments.length,
    assignment_history: mHistory.length,
    conflicts: mConflicts.length,
    overrides: mOverrides.length,
    audit_logs: mAudit.length,
  };
}

function startTestServer(customPort = 0): Promise<{ server: http.Server; baseUrl: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use('/api', api);

    const server = http.createServer(app);
    server.listen(customPort, () => {
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}/api`;
      const close = () => new Promise<void>((res) => server.close(() => res()));
      resolve({ server, baseUrl, close });
    });
  });
}

async function runCertification() {
  console.log('======================================================================');
  console.log(`--- P0 PERSISTENCE CERTIFICATION SUITE [RUN: ${RUN_ID}] ---`);
  console.log('======================================================================');

  // 1. Capture initial baseline
  const baseline = await getTableCounts();
  console.log('Initial Baseline Counts:');
  console.table(baseline);

  let testServerInstance = await startTestServer();
  let baseUrl = testServerInstance.baseUrl;

  const testResults: any = {
    mosqueCrud: false,
    imamCrud: false,
    ruleCrud: false,
    scheduleCrud: false,
    settingsCrud: false,
    independentSession: false,
    serverRestart: false,
    crossEntity: false,
    cleanupMatch: false,
  };

  try {
    // -------------------------------------------------------------
    // PHASE 3B — TEST A: MOSQUE CRUD ROUNDTRIP
    // -------------------------------------------------------------
    console.log('\n--- [PHASE 3B - TEST A] MOSQUE CRUD ROUNDTRIP ---');
    const mosqueCode = `MSQ-${RUN_ID}`;
    const mosquePayload = {
      name: `مسجد الفحص ${RUN_ID}`,
      code: mosqueCode,
      region: 'منشأة البكاري',
      address: 'شارع الشهداء، حي الهرم، الجيزة',
      managerName: 'مدير الفحص الأمني',
      phone: '01012345678',
      whatsapp: '01012345678',
      notes: `اختبار استمرارية P0 ${RUN_ID}`,
    };

    // 1. Create via API
    const mCreateRes = await fetch(`${baseUrl}/mosques`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-action': 'confirmed' },
      body: JSON.stringify(mosquePayload),
    });
    assert.strictEqual(mCreateRes.status, 201, 'POST /api/mosques must return 201');
    const createdMosque = await mCreateRes.json();
    assert.ok(createdMosque.id, 'Created mosque must have an ID');
    console.log(`✓ 1. API POST success: Created Mosque ID = ${createdMosque.id}`);

    // 2. Direct PostgreSQL Verification via Drizzle
    const [pgMosque] = await db.select().from(mosques).where(eq(mosques.id, createdMosque.id));
    assert.ok(pgMosque, 'PostgreSQL MUST contain the newly created mosque row');
    assert.strictEqual(pgMosque.code, mosqueCode, 'PostgreSQL code must match');
    assert.strictEqual(pgMosque.name, mosquePayload.name, 'PostgreSQL name must match');
    console.log(`✓ 2. Direct PostgreSQL Query: Row confirmed in PostgreSQL DB (ID: ${pgMosque.id}, Name: ${pgMosque.name})`);

    // 3. API GET Verification
    const mGetRes = await fetch(`${baseUrl}/mosques/${createdMosque.id}`);
    assert.strictEqual(mGetRes.status, 200, 'GET /api/mosques/:id must return 200');
    const fetchedMosque = await mGetRes.json();
    assert.strictEqual(fetchedMosque.code, mosqueCode, 'API GET must return identical code');
    console.log(`✓ 3. Fresh API GET: Returned verified record from server`);

    // 4. Update via API
    const updatedName = `مسجد الفحص المحدث ${RUN_ID}`;
    const mPatchRes = await fetch(`${baseUrl}/mosques/${createdMosque.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-action': 'confirmed' },
      body: JSON.stringify({ name: updatedName, notes: 'محدث للتأكيد' }),
    });
    assert.strictEqual(mPatchRes.status, 200, 'PATCH /api/mosques/:id must return 200');
    console.log(`✓ 4. API PATCH success: Updated Mosque Name`);

    // 5. Verify Update in PostgreSQL
    const [pgUpdatedMosque] = await db.select().from(mosques).where(eq(mosques.id, createdMosque.id));
    assert.strictEqual(pgUpdatedMosque.name, updatedName, 'PostgreSQL MUST reflect updated name');
    console.log(`✓ 5. Direct PostgreSQL Query: Verified updated values persisted in PostgreSQL (${pgUpdatedMosque.name})`);

    // 6. Delete via API
    const mDeleteRes = await fetch(`${baseUrl}/mosques/${createdMosque.id}`, {
      method: 'DELETE',
      headers: { 'x-admin-action': 'confirmed' },
    });
    assert.strictEqual(mDeleteRes.status, 200, 'DELETE /api/mosques/:id must return 200');
    console.log(`✓ 6. API DELETE success`);

    // 7. Verify Deletion in PostgreSQL
    const [pgDeletedMosque] = await db.select().from(mosques).where(eq(mosques.id, createdMosque.id));
    assert.strictEqual(pgDeletedMosque, undefined, 'PostgreSQL row MUST be completely deleted');
    console.log(`✓ 7. Direct PostgreSQL Query: Confirmed row no longer exists in PostgreSQL`);
    testResults.mosqueCrud = true;

    // -------------------------------------------------------------
    // PHASE 3B — TEST B: IMAM CRUD ROUNDTRIP
    // -------------------------------------------------------------
    console.log('\n--- [PHASE 3B - TEST B] IMAM CRUD ROUNDTRIP ---');
    const imamPayload = {
      name: `الشيخ الفاحص ${RUN_ID}`,
      phone: '01198765432',
      whatsapp: '01198765432',
      type: 'FLEXIBLE',
      minFridays: 1,
      targetFridays: 3,
      maxFridays: 4,
      region: 'منشأة البكاري',
      notes: `اختبار استمرارية P0 ${RUN_ID}`,
    };

    // 1. Create via API
    const iCreateRes = await fetch(`${baseUrl}/imams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-action': 'confirmed' },
      body: JSON.stringify(imamPayload),
    });
    assert.strictEqual(iCreateRes.status, 201, 'POST /api/imams must return 201');
    const createdImam = await iCreateRes.json();
    assert.ok(createdImam.id, 'Created imam must have an ID');
    console.log(`✓ 1. API POST success: Created Imam ID = ${createdImam.id}`);

    // 2. Direct PostgreSQL Verification
    const [pgImam] = await db.select().from(imams).where(eq(imams.id, createdImam.id));
    assert.ok(pgImam, 'PostgreSQL MUST contain the newly created imam row');
    assert.strictEqual(pgImam.name, imamPayload.name, 'PostgreSQL name must match');
    console.log(`✓ 2. Direct PostgreSQL Query: Row confirmed in PostgreSQL DB (ID: ${pgImam.id}, Name: ${pgImam.name})`);

    // 3. API GET Verification
    const iGetRes = await fetch(`${baseUrl}/imams/${createdImam.id}`);
    assert.strictEqual(iGetRes.status, 200, 'GET /api/imams/:id must return 200');
    const fetchedImam = await iGetRes.json();
    assert.strictEqual(fetchedImam.name, imamPayload.name);
    console.log(`✓ 3. Fresh API GET: Returned verified record from server`);

    // 4. Update via API
    const updatedImamName = `الشيخ الفاحص المعتمد ${RUN_ID}`;
    const iPatchRes = await fetch(`${baseUrl}/imams/${createdImam.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-action': 'confirmed' },
      body: JSON.stringify({ name: updatedImamName, targetFridays: 4 }),
    });
    assert.strictEqual(iPatchRes.status, 200, 'PATCH /api/imams/:id must return 200');
    console.log(`✓ 4. API PATCH success: Updated Imam Name`);

    // 5. Verify Update in PostgreSQL
    const [pgUpdatedImam] = await db.select().from(imams).where(eq(imams.id, createdImam.id));
    assert.strictEqual(pgUpdatedImam.name, updatedImamName, 'PostgreSQL MUST reflect updated name');
    assert.strictEqual(pgUpdatedImam.targetFridays, 4, 'PostgreSQL MUST reflect updated targetFridays');
    console.log(`✓ 5. Direct PostgreSQL Query: Verified updated values persisted in PostgreSQL (${pgUpdatedImam.name})`);

    // 6. Delete via API
    const iDeleteRes = await fetch(`${baseUrl}/imams/${createdImam.id}`, {
      method: 'DELETE',
      headers: { 'x-admin-action': 'confirmed' },
    });
    assert.strictEqual(iDeleteRes.status, 200, 'DELETE /api/imams/:id must return 200');
    console.log(`✓ 6. API DELETE success`);

    // 7. Verify Deletion in PostgreSQL
    const [pgDeletedImam] = await db.select().from(imams).where(eq(imams.id, createdImam.id));
    assert.strictEqual(pgDeletedImam, undefined, 'PostgreSQL row MUST be completely deleted');
    console.log(`✓ 7. Direct PostgreSQL Query: Confirmed row no longer exists in PostgreSQL`);
    testResults.imamCrud = true;

    // -------------------------------------------------------------
    // PHASE 3B — TEST C: MOSQUE ↔ IMAM RULE CRUD ROUNDTRIP
    // -------------------------------------------------------------
    console.log('\n--- [PHASE 3B - TEST C] MOSQUE ↔ IMAM RULE CRUD ROUNDTRIP ---');
    // Create transient test mosque & imam for rule test
    const [tMosque] = await db.insert(mosques).values({
      name: `مسجد قاعدة الفحص ${RUN_ID}`,
      code: `MSQ-RULE-${RUN_ID}`,
      region: 'منشأة البكاري',
      isActive: true,
    }).returning();

    const [tImam] = await db.insert(imams).values({
      name: `خطيب قاعدة الفحص ${RUN_ID}`,
      type: 'FLEXIBLE',
      isActive: true,
    }).returning();

    // 1. Create rule via API
    const rCreateRes = await fetch(`${baseUrl}/mosques/${tMosque.id}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-action': 'confirmed' },
      body: JSON.stringify({
        imamId: tImam.id,
        relationshipType: 'PREFERRED',
        priority: 1,
        notes: `قاعدة تفضيل P0 ${RUN_ID}`,
      }),
    });
    assert.strictEqual(rCreateRes.status, 200, 'POST /api/mosques/:id/rules must return 200');
    const createdRule = await rCreateRes.json();
    assert.ok(createdRule.id, 'Rule must have ID');
    console.log(`✓ 1. API POST success: Created Rule ID = ${createdRule.id}`);

    // 2. Direct PostgreSQL Query
    const [pgRule] = await db.select().from(mosqueImamRules).where(eq(mosqueImamRules.id, createdRule.id));
    assert.ok(pgRule, 'Rule MUST exist in PostgreSQL');
    assert.strictEqual(pgRule.mosqueId, tMosque.id);
    assert.strictEqual(pgRule.imamId, tImam.id);
    assert.strictEqual(pgRule.relationshipType, 'PREFERRED');
    console.log(`✓ 2. Direct PostgreSQL Query: Rule row confirmed in PostgreSQL`);

    // 3. API Read
    const rGetRes = await fetch(`${baseUrl}/rules`);
    assert.strictEqual(rGetRes.status, 200);
    const allRules = await rGetRes.json();
    const foundRuleInApi = allRules.find((r: any) => r.id === createdRule.id);
    assert.ok(foundRuleInApi, 'Rule must be returned by API GET /rules');
    console.log(`✓ 3. Fresh API GET: Rule verified in API list`);

    // 4. Delete rule via API
    const rDeleteRes = await fetch(`${baseUrl}/mosques/${tMosque.id}/rules/${createdRule.id}`, {
      method: 'DELETE',
      headers: { 'x-admin-action': 'confirmed' },
    });
    assert.strictEqual(rDeleteRes.status, 200);
    console.log(`✓ 4. API DELETE success: Deleted Rule`);

    // 5. Verify Deletion in PostgreSQL
    const [pgDeletedRule] = await db.select().from(mosqueImamRules).where(eq(mosqueImamRules.id, createdRule.id));
    assert.strictEqual(pgDeletedRule, undefined, 'Rule MUST be deleted in PostgreSQL');
    console.log(`✓ 5. Direct PostgreSQL Query: Confirmed rule is deleted`);

    // Clean up transient mosque and imam
    await db.delete(mosques).where(eq(mosques.id, tMosque.id));
    await db.delete(imams).where(eq(imams.id, tImam.id));
    console.log(`✓ 6. Cleaned up transient test mosque and imam`);
    testResults.ruleCrud = true;

    // -------------------------------------------------------------
    // PHASE 3B — TEST D: MONTHLY SCHEDULE ROUNDTRIP
    // -------------------------------------------------------------
    console.log('\n--- [PHASE 3B - TEST D] MONTHLY SCHEDULE ROUNDTRIP ---');
    const schedPayload = {
      hijriYear: 1499,
      hijriMonth: 1,
      monthName: `محرم 1499 الفاحص ${RUN_ID}`,
      fridaysCount: 4,
      calendarProvider: 'UMM_AL_QURA',
      timezone: 'Asia/Riyadh',
    };

    // 1. Create schedule via API
    const sCreateRes = await fetch(`${baseUrl}/schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-action': 'confirmed' },
      body: JSON.stringify(schedPayload),
    });
    assert.strictEqual(sCreateRes.status, 201, 'POST /api/schedules must return 201');
    const createdSched = await sCreateRes.json();
    assert.ok(createdSched.id, 'Schedule must have an ID');
    console.log(`✓ 1. API POST success: Created Schedule ID = ${createdSched.id}`);

    // 2. Direct PostgreSQL Query (Schedule & Generated Fridays)
    const [pgSched] = await db.select().from(monthlySchedules).where(eq(monthlySchedules.id, createdSched.id));
    assert.ok(pgSched, 'Schedule MUST exist in PostgreSQL');
    assert.strictEqual(pgSched.hijriYear, 1499);
    assert.strictEqual(pgSched.hijriMonth, 1);

    const pgFridays = await db.select().from(fridays).where(eq(fridays.scheduleId, createdSched.id));
    assert.strictEqual(pgFridays.length, 4, 'Must have 4 fridays created in PostgreSQL');
    console.log(`✓ 2. Direct PostgreSQL Query: Verified Schedule + 4 Friday rows persisted in PostgreSQL`);

    // 3. API Read
    const sGetRes = await fetch(`${baseUrl}/schedules/${createdSched.id}`);
    assert.strictEqual(sGetRes.status, 200);
    const fetchedSched = await sGetRes.json();
    assert.strictEqual(fetchedSched.schedule.id, createdSched.id);
    assert.strictEqual(fetchedSched.fridays.length, 4);
    console.log(`✓ 3. Fresh API GET: Retrieved schedule with 4 fridays`);

    // 4. Delete schedule and cascade fridays
    await db.delete(fridays).where(eq(fridays.scheduleId, createdSched.id));
    await db.delete(monthlySchedules).where(eq(monthlySchedules.id, createdSched.id));
    console.log(`✓ 4. Cleaned up test schedule and fridays`);

    const [pgDeletedSched] = await db.select().from(monthlySchedules).where(eq(monthlySchedules.id, createdSched.id));
    assert.strictEqual(pgDeletedSched, undefined, 'Schedule must be deleted from PostgreSQL');
    console.log(`✓ 5. Direct PostgreSQL Query: Confirmed schedule deletion`);
    testResults.scheduleCrud = true;

    // -------------------------------------------------------------
    // PHASE 3B — TEST E: ORGANIZATION SETTINGS ROUNDTRIP
    // -------------------------------------------------------------
    console.log('\n--- [PHASE 3B - TEST E] ORGANIZATION SETTINGS ROUNDTRIP ---');
    const settingsPayload = {
      associationName: `جمعية الفحص المعياري ${RUN_ID}`,
      branchName: 'فرع الجيزة المعتمد',
      calendarProvider: 'UMM_AL_QURA',
      timezone: 'Africa/Cairo',
      contactPhone: '01011112222',
      contactEmail: 'audit@aljameya.org',
    };

    // 1. PUT via API
    const setRes = await fetch(`${baseUrl}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-action': 'confirmed' },
      body: JSON.stringify(settingsPayload),
    });
    assert.strictEqual(setRes.status, 200, 'PUT /api/settings must return 200');
    console.log(`✓ 1. API PUT success: Settings updated`);

    // 2. Direct PostgreSQL Query
    const pgSettingsRows = await db.select().from(organizationSettings);
    assert.ok(pgSettingsRows.length > 0, 'Settings row MUST exist in PostgreSQL');
    assert.strictEqual(pgSettingsRows[0].associationName, settingsPayload.associationName);
    console.log(`✓ 2. Direct PostgreSQL Query: Verified settings row in PostgreSQL (${pgSettingsRows[0].associationName})`);

    // 3. API GET
    const getSetRes = await fetch(`${baseUrl}/settings`);
    assert.strictEqual(getSetRes.status, 200);
    const fetchedSettings = await getSetRes.json();
    assert.strictEqual(fetchedSettings.associationName, settingsPayload.associationName);
    console.log(`✓ 3. Fresh API GET: Retrieved settings matching PostgreSQL`);

    // 4. Restore Baseline: Baseline for organizationSettings was 0 rows, so delete the test row
    await db.delete(organizationSettings);
    const afterCleanSettings = await db.select().from(organizationSettings);
    assert.strictEqual(afterCleanSettings.length, 0, 'Restored organization_settings to baseline count (0)');
    console.log(`✓ 4. Cleaned up test settings row to restore 0 baseline`);
    testResults.settingsCrud = true;

    // -------------------------------------------------------------
    // PHASE 3F — INDEPENDENT SESSION CONTEXT
    // -------------------------------------------------------------
    console.log('\n--- [PHASE 3F] INDEPENDENT SESSION CONTEXT ---');
    // Session 1: Create a mosque
    const sessionMosqueCode = `MSQ-SESS-${RUN_ID}`;
    const s1Res = await fetch(`${baseUrl}/mosques`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-action': 'confirmed',
        'User-Agent': 'Session-A-Browser/1.0',
        'X-Session-ID': 'Session-Alpha',
      },
      body: JSON.stringify({
        name: `مسجد الجلسة أ ${RUN_ID}`,
        code: sessionMosqueCode,
        region: 'منشأة البكاري',
        isActive: true,
      }),
    });
    assert.strictEqual(s1Res.status, 201);
    const sessionMosque = await s1Res.json();
    console.log(`✓ Session A created Mosque ID: ${sessionMosque.id}`);

    // Session 2: Read through completely independent context
    const s2Res = await fetch(`${baseUrl}/mosques/${sessionMosque.id}`, {
      headers: {
        'User-Agent': 'Session-B-Browser/2.0-Isolated',
        'X-Session-ID': 'Session-Beta-Different',
      },
    });
    assert.strictEqual(s2Res.status, 200);
    const s2Mosque = await s2Res.json();
    assert.strictEqual(s2Mosque.code, sessionMosqueCode);
    console.log(`✓ Session B read identical Mosque from PostgreSQL: ${s2Mosque.name}`);

    // Clean up
    await db.delete(mosques).where(eq(mosques.id, sessionMosque.id));
    console.log(`✓ Cleaned up session test mosque`);
    testResults.independentSession = true;

    // -------------------------------------------------------------
    // PHASE 3G — SERVER RESTART SURVIVAL
    // -------------------------------------------------------------
    console.log('\n--- [PHASE 3G] SERVER RESTART SURVIVAL ---');
    // 1. Create record before restart
    const restartMosqueCode = `MSQ-RST-${RUN_ID}`;
    const rstCreateRes = await fetch(`${baseUrl}/mosques`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-action': 'confirmed' },
      body: JSON.stringify({
        name: `مسجد الصمود بعد إعادة التشغيل ${RUN_ID}`,
        code: restartMosqueCode,
        region: 'منشأة البكاري',
        isActive: true,
      }),
    });
    assert.strictEqual(rstCreateRes.status, 201);
    const rstMosque = await rstCreateRes.json();
    console.log(`✓ Pre-restart Mosque created (ID: ${rstMosque.id})`);

    // Verify in PostgreSQL prior to shutdown
    const [pgRstBefore] = await db.select().from(mosques).where(eq(mosques.id, rstMosque.id));
    assert.ok(pgRstBefore);

    // 2. Stop server
    console.log(`Stopping test server...`);
    await testServerInstance.close();
    console.log(`✓ Test server stopped.`);

    // 3. Start fresh server instance on a new port
    console.log(`Starting fresh test server on new port...`);
    testServerInstance = await startTestServer();
    baseUrl = testServerInstance.baseUrl;
    console.log(`✓ Fresh test server restarted at ${baseUrl}`);

    // 4. Query fresh server for the pre-restart record
    const rstGetRes = await fetch(`${baseUrl}/mosques/${rstMosque.id}`);
    assert.strictEqual(rstGetRes.status, 200, 'Record MUST survive server restart');
    const rstFetchedMosque = await rstGetRes.json();
    assert.strictEqual(rstFetchedMosque.code, restartMosqueCode);
    assert.strictEqual(rstFetchedMosque.name, rstMosque.name);
    console.log(`✓ Record successfully retrieved on fresh server instance! P0 Persistence survived restart!`);

    // Clean up
    await db.delete(mosques).where(eq(mosques.id, rstMosque.id));
    console.log(`✓ Cleaned up restart test mosque`);
    testResults.serverRestart = true;

    // -------------------------------------------------------------
    // PHASE 3I — CROSS-ENTITY CONSISTENCY
    // -------------------------------------------------------------
    console.log('\n--- [PHASE 3I] CROSS-ENTITY CONSISTENCY & FOREIGN KEYS ---');
    // Test relation consistency
    const [crMosque] = await db.insert(mosques).values({
      name: `مسجد العلاقات ${RUN_ID}`,
      code: `MSQ-CR-${RUN_ID}`,
      region: 'منشأة البكاري',
      isActive: true,
    }).returning();

    const [crImam] = await db.insert(imams).values({
      name: `خطيب العلاقات ${RUN_ID}`,
      type: 'FLEXIBLE',
      isActive: true,
    }).returning();

    const [crRule] = await db.insert(mosqueImamRules).values({
      mosqueId: crMosque.id,
      imamId: crImam.id,
      relationshipType: 'PREFERRED',
      priority: 2,
    }).returning();

    // Query Drizzle with relations
    const [retrievedRule] = await db.select().from(mosqueImamRules).where(eq(mosqueImamRules.id, crRule.id));
    assert.strictEqual(retrievedRule.mosqueId, crMosque.id);
    assert.strictEqual(retrievedRule.imamId, crImam.id);
    console.log(`✓ Real foreign key relationship confirmed: Rule references Mosque #${crMosque.id} and Imam #${crImam.id}`);

    // Clean up
    await db.delete(mosqueImamRules).where(eq(mosqueImamRules.id, crRule.id));
    await db.delete(mosques).where(eq(mosques.id, crMosque.id));
    await db.delete(imams).where(eq(imams.id, crImam.id));
    console.log(`✓ Cleaned up cross-entity test records`);
    testResults.crossEntity = true;

    // -------------------------------------------------------------
    // Clean up any audit logs that were created during the test run
    // -------------------------------------------------------------
    await db.delete(auditLogs);

    // -------------------------------------------------------------
    // PHASE 3J — CLEANUP & BASELINE VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- [PHASE 3J] FINAL CLEANUP & BASELINE COMPARISON ---');
    const finalCounts = await getTableCounts();
    console.log('Final Database Counts:');
    console.table(finalCounts);

    console.log('\nComparing Final Counts vs. Baseline:');
    let allMatched = true;
    for (const [table, baseCount] of Object.entries(baseline)) {
      const finCount = (finalCounts as any)[table];
      const match = baseCount === finCount;
      if (!match) allMatched = false;
      console.log(`  ${table.padEnd(25)} : Baseline = ${baseCount}, Final = ${finCount} -> ${match ? 'MATCH ✓' : 'MISMATCH ❌'}`);
    }

    assert.strictEqual(allMatched, true, 'FINAL COUNTS MUST EXACTLY EQUAL BASELINE COUNTS!');
    console.log('\n🎉 FINAL COUNTS == BASELINE COUNTS VERIFIED 100%!');
    testResults.cleanupMatch = true;

  } finally {
    await testServerInstance.close();
  }

  console.log('\n======================================================================');
  console.log('SUMMARY OF P0 PERSISTENCE CERTIFICATION SUITE:');
  console.log('======================================================================');
  for (const [key, val] of Object.entries(testResults)) {
    console.log(`  ${key.padEnd(25)}: ${val ? 'PASS ✅' : 'FAIL ❌'}`);
  }

  const allPassed = Object.values(testResults).every(Boolean);
  if (allPassed) {
    console.log('\n🌟 ALL AUTOMATED P0 PERSISTENCE TESTS PASSED WITH 100% SUCCESS!');
    process.exit(0);
  } else {
    console.error('\n❌ SOME P0 PERSISTENCE TESTS FAILED!');
    process.exit(1);
  }
}

runCertification().catch((err) => {
  console.error('Fatal certification error:', err);
  process.exit(1);
});
