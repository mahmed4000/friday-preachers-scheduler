async function runApiTests() {
  console.log('--- Starting Import / Export Live API Integration Tests ---\n');
  const baseUrl = 'http://127.0.0.1:3000';

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`✕ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    const timestamp = Date.now();
    const testCode1 = `MOS-RUN-${timestamp}`;
    const testCode2 = `MOS-ERR-${timestamp}`;

    // 1. Test Template Download
    const tmplRes = await fetch(`${baseUrl}/api/import-export/templates/mosques`);
    assert(tmplRes.status === 200, 'GET /api/import-export/templates/mosques returns 200 OK');
    const tmplType = tmplRes.headers.get('content-type');
    assert(Boolean(tmplType?.includes('spreadsheetml')), 'Template returns valid Excel MIME content-type');

    // 2. Test Import Preview
    const sampleRawRows = [
      {
        'كود المسجد': testCode1,
        'اسم المسجد': `مسجد النصر التجريبي ${timestamp}`,
        'المحافظة': 'الجيزة',
        'الحي': 'حي الهرم',
        'المنطقة': 'منشأة البكاري',
        'الشارع': 'شارع العروبة الرئيسي',
        'رقم المبنى': '15',
        'الهاتف': '01012345678',
        'اسم المسؤول': 'أ. حاتم عبد الله',
      },
      {
        'كود المسجد': testCode2,
        'اسم المسجد': '', // Invalid: missing name
        'المحافظة': 'الجيزة',
        'الهاتف': 'invalid-phone-123',
      },
    ];

    const previewRes = await fetch(`${baseUrl}/api/import-export/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'MOSQUES',
        rawRows: sampleRawRows,
        fileName: 'test_mosques.xlsx',
        fileFormat: 'XLSX',
      }),
    });

    const previewData = await previewRes.json();
    assert(previewRes.status === 200, 'POST /api/import-export/preview returns 200');
    assert(previewData.totalRows === 2, 'Total rows in preview = 2');
    assert(previewData.rows[0].status === 'NEW', 'Row 1 identified as NEW');
    assert(previewData.rows[0].adminMatch?.governorateId === 1, 'Row 1 matched Giza Governorate (1)');
    assert(previewData.rows[0].adminMatch?.districtId === 101, 'Row 1 matched Haram District (101)');
    assert(previewData.rows[0].adminMatch?.areaId === 1001, 'Row 1 matched Munshaat Al-Bakkari Area (1001)');
    assert(previewData.rows[1].status === 'ERROR', 'Row 2 identified as ERROR due to missing name & invalid phone');
    assert(previewData.errorCount === 1, 'Error count = 1');

    // 3. Test Import Execution (UPSERT)
    const executeRes = await fetch(`${baseUrl}/api/import-export/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId: previewData.batchId,
        entityType: 'MOSQUES',
        fileName: 'test_mosques.xlsx',
        fileFormat: 'XLSX',
        mode: 'UPSERT',
        rows: previewData.rows,
      }),
    });

    const executeData = await executeRes.json();
    assert(executeRes.status === 200, 'POST /api/import-export/execute returns 200');
    assert(executeData.createdRows === 1, 'Created rows = 1');
    assert(executeData.errorRows === 1, 'Error rows = 1');

    // 4. Test Duplicate & Blank != Delete during Update
    const updateRawRows = [
      {
        'كود المسجد': testCode1,
        'اسم المسجد': `مسجد النصر التجريبي ${timestamp} (محدث)`,
        'المحافظة': 'الجيزة',
        'الهاتف': '', // Empty in update file -> must NOT wipe existing phone '01012345678'!
      },
    ];

    const preview2Res = await fetch(`${baseUrl}/api/import-export/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'MOSQUES',
        rawRows: updateRawRows,
      }),
    });
    const preview2Data = await preview2Res.json();
    assert(preview2Data.rows[0].status === 'UPDATE', 'Identified existing mosque for UPDATE by code');

    const exec2Res = await fetch(`${baseUrl}/api/import-export/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId: preview2Data.batchId,
        entityType: 'MOSQUES',
        mode: 'UPSERT',
        rows: preview2Data.rows,
      }),
    });
    const exec2Data = await exec2Res.json();
    assert(exec2Data.updatedRows === 1, 'Updated rows = 1');

    // Verify in DB that phone was preserved (Blank != Delete)
    const allMosques = await fetch(`${baseUrl}/api/mosques`).then((r) => r.json());
    const targetM = allMosques.find((m: any) => m.code === testCode1);
    assert(targetM && targetM.name.includes('(محدث)'), 'Mosque name was successfully updated');
    assert(targetM && targetM.phone === '01012345678', 'Phone was preserved without deletion (Blank != Delete rule verified)');

    // 5. Test Export API
    const exportRes = await fetch(`${baseUrl}/api/import-export/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'MOSQUES',
        format: 'XLSX',
        scope: 'ALL',
      }),
    });
    assert(exportRes.status === 200, 'POST /api/import-export/export returns 200');
    const exportBuf = await exportRes.arrayBuffer();
    assert(exportBuf.byteLength > 1000, 'Exported Excel buffer has valid size');

    // 6. Test CSV Export with UTF-8 BOM
    const exportCsvRes = await fetch(`${baseUrl}/api/import-export/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'MOSQUES',
        format: 'CSV',
        scope: 'ALL',
      }),
    });
    assert(exportCsvRes.status === 200, 'CSV export returns 200');
    const csvBuf = new Uint8Array(await exportCsvRes.arrayBuffer());
    assert(csvBuf[0] === 0xef && csvBuf[1] === 0xbb && csvBuf[2] === 0xbf, 'Exported CSV contains UTF-8 BOM bytes');

    // 7. Test Operation Logs Endpoint
    const logsRes = await fetch(`${baseUrl}/api/import-export/logs`);
    const logsData = await logsRes.json();
    assert(Array.isArray(logsData) && logsData.length > 0, 'Import/Export logs recorded successfully in database');

    console.log(`\nAPI Integration Tests: ${passed} Passed, ${failed} Failed\n`);
    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('API Test Error:', err);
    process.exit(1);
  }
}

runApiTests();
