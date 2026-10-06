import assert from 'node:assert';
import express from 'express';
import http from 'http';
import api from '../src/server/api.ts';

console.log('--- بدء اختبارات استمرارية البيانات ودورة حياة الكيانات (Phase 3 CRUD Persistence Tests) ---');

const app = express();
app.use(express.json());
app.use('/api', api);

const server = http.createServer(app);

server.listen(0, async () => {
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    // -------------------------------------------------------------
    // 1. اختبار دورة حياة المسجد (Mosque CRUD Lifecycle)
    // -------------------------------------------------------------
    const mosqueCode = `TEST-M-${Date.now()}`;
    const createMosqueRes = await fetch(`${baseUrl}/mosques`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'مسجد الاختبار المعياري للتعافي',
        code: mosqueCode,
        region: 'منشأة البكاري',
        address: 'شارع النور، الجيزة',
        managerName: 'أحمد محمود',
        phone: '01012345678',
      }),
    });

    assert.strictEqual(createMosqueRes.status, 201, 'POST /api/mosques must return 201 Created');
    const createdMosque = await createMosqueRes.json();
    assert.ok(createdMosque.id, 'Created mosque must have an ID');
    assert.strictEqual(createdMosque.name, 'مسجد الاختبار المعياري للتعافي');
    console.log('✅ [PASS] 1.1 إنشاء المسجد بنجاح مع تأكيد المعرف ID');

    // 1.2 Update Mosque with extra frontend properties (Verify whitelisting prevents column errors)
    const patchMosqueRes = await fetch(`${baseUrl}/mosques/${createdMosque.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...createdMosque,
        name: 'مسجد الاختبار المعياري المحدث',
        notes: 'ملاحظة محدثة للتأكيد',
        // Extraneous frontend-only fields that previously caused Drizzle to crash:
        rules: [{ id: 1, relationshipType: 'PREFERRED' }],
        fixedImamName: 'غير محدد',
        preferencesCount: 3,
        forbiddenCount: 0,
      }),
    });

    assert.strictEqual(patchMosqueRes.status, 200, 'PATCH /api/mosques/:id must return 200 OK');
    const updatedMosque = await patchMosqueRes.json();
    assert.strictEqual(updatedMosque.name, 'مسجد الاختبار المعياري المحدث');
    assert.strictEqual(updatedMosque.notes, 'ملاحظة محدثة للتأكيد');
    console.log('✅ [PASS] 1.2 تحديث بيانات المسجد مع تصفية الحقول الزائدة بنجاح');

    // 1.3 Read Mosque Details
    const getMosqueRes = await fetch(`${baseUrl}/mosques/${createdMosque.id}`);
    assert.strictEqual(getMosqueRes.status, 200, 'GET /api/mosques/:id must return 200 OK');
    const fetchedMosque = await getMosqueRes.json();
    assert.strictEqual(fetchedMosque.name, 'مسجد الاختبار المعياري المحدث');
    console.log('✅ [PASS] 1.3 استرجاع بيانات المسجد المحدثة وتأكيد مطابقتها');

    // -------------------------------------------------------------
    // 2. اختبار دورة حياة الخطيب (Imam CRUD Lifecycle)
    // -------------------------------------------------------------
    const createImamRes = await fetch(`${baseUrl}/imams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'الشيخ اختبار المعياري',
        type: 'FLEXIBLE',
        minFridays: 1,
        targetFridays: 3,
        maxFridays: 4,
        phone: '01123456789',
        region: 'منشأة البكاري',
      }),
    });

    assert.strictEqual(createImamRes.status, 201, 'POST /api/imams must return 201 Created');
    const createdImam = await createImamRes.json();
    assert.ok(createdImam.id, 'Created imam must have an ID');
    assert.strictEqual(createdImam.name, 'الشيخ اختبار المعياري');
    console.log('✅ [PASS] 2.1 إنشاء الخطيب بنجاح مع تأكيد المعرف ID');

    // 2.2 Update Imam with extra frontend properties
    const patchImamRes = await fetch(`${baseUrl}/imams/${createdImam.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...createdImam,
        name: 'الشيخ اختبار المعياري المحدث',
        targetFridays: 4,
        // Extraneous frontend-only fields:
        assignedFridaysCount: 2,
        preferredMosquesCount: 1,
        forbiddenMosquesCount: 0,
        rules: [],
      }),
    });

    assert.strictEqual(patchImamRes.status, 200, 'PATCH /api/imams/:id must return 200 OK');
    const updatedImam = await patchImamRes.json();
    assert.strictEqual(updatedImam.name, 'الشيخ اختبار المعياري المحدث');
    assert.strictEqual(updatedImam.targetFridays, 4);
    console.log('✅ [PASS] 2.2 تحديث بيانات الخطيب مع تصفية الحقول الزائدة بنجاح');

    // 2.3 Read Imam Details
    const getImamRes = await fetch(`${baseUrl}/imams/${createdImam.id}`);
    assert.strictEqual(getImamRes.status, 200, 'GET /api/imams/:id must return 200 OK');
    const fetchedImam = await getImamRes.json();
    assert.strictEqual(fetchedImam.name, 'الشيخ اختبار المعياري المحدث');
    console.log('✅ [PASS] 2.3 استرجاع بيانات الخطيب وتأكيد استمرارية التعديلات');

    // -------------------------------------------------------------
    // 3. اختبار قواعد التوافق والمفاضلة (Rules Lifecycle)
    // -------------------------------------------------------------
    const createRuleRes = await fetch(`${baseUrl}/mosques/${createdMosque.id}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imamId: createdImam.id,
        relationshipType: 'PREFERRED',
        priority: 1,
        notes: 'قاعدة تفضيل اختبارية',
      }),
    });

    assert.strictEqual(createRuleRes.status, 200, 'POST /api/mosques/:id/rules must return 200 OK');
    const savedRule = await createRuleRes.json();
    assert.ok(savedRule.id, 'Saved rule must have an ID');
    assert.strictEqual(savedRule.relationshipType, 'PREFERRED');
    console.log('✅ [PASS] 3.1 إنشاء وحفظ قاعدة تفضيل بين المسجد والخطيب بنجاح');

    // 3.2 Delete Rule
    const deleteRuleRes = await fetch(`${baseUrl}/mosques/${createdMosque.id}/rules/${savedRule.id}`, {
      method: 'DELETE',
    });
    assert.strictEqual(deleteRuleRes.status, 200, 'DELETE rule must return 200 OK');
    console.log('✅ [PASS] 3.2 حذف قاعدة التفضيل بنجاح');

    // -------------------------------------------------------------
    // 4. اختبار إعدادات الجمعية (Organization Settings)
    // -------------------------------------------------------------
    const updateSettingsRes = await fetch(`${baseUrl}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        associationName: 'جمعية رعاية المساجد - اختبار الاستمرارية',
        branchName: 'فرع الجيزة المعتمد',
        calendarProvider: 'UMM_AL_QURA',
        timezone: 'Africa/Cairo',
      }),
    });

    assert.strictEqual(updateSettingsRes.status, 200, 'PUT /api/settings must return 200 OK');
    const getSettingsRes = await fetch(`${baseUrl}/settings`);
    assert.strictEqual(getSettingsRes.status, 200, 'GET /api/settings must return 200 OK');
    const fetchedSettings = await getSettingsRes.json();
    assert.strictEqual(fetchedSettings.associationName, 'جمعية رعاية المساجد - اختبار الاستمرارية');
    console.log('✅ [PASS] 4. تحديث واسترجاع إعدادات الجمعية وتأكيد استمراريتها');

    // -------------------------------------------------------------
    // 5. تنظيف الكيانات الاختبارية (Cleanup)
    // -------------------------------------------------------------
    const delMosqueRes = await fetch(`${baseUrl}/mosques/${createdMosque.id}`, { method: 'DELETE' });
    assert.strictEqual(delMosqueRes.status, 200, 'DELETE /api/mosques/:id must return 200');

    const delImamRes = await fetch(`${baseUrl}/imams/${createdImam.id}`, { method: 'DELETE' });
    assert.strictEqual(delImamRes.status, 200, 'DELETE /api/imams/:id must return 200');
    console.log('✅ [PASS] 5. تنظيف الكيانات الاختبارية بنجاح');

    console.log('--- اكتملت جميع اختبارات استمرارية البيانات CRUD بنجاح تام (All Passed) ---');
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ [FAIL] فشل في اختبارات استمرارية البيانات:', err);
    server.close();
    process.exit(1);
  }
});
