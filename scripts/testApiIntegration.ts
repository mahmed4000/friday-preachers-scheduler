// Live API Integration Test for Friday Preachers System
async function testApi() {
  console.log('--- Testing API Fixed Preacher Endpoints ---');

  // 1. Get Mosques
  const mosques = await fetch('http://127.0.0.1:3000/api/mosques').then((r) => r.json());
  console.log(`Fetched ${mosques.length} mosques. First mosque: ${mosques[0]?.name} (ID ${mosques[0]?.id})`);
  const targetMosqueId = mosques[0]?.id;

  const imams = await fetch('http://127.0.0.1:3000/api/imams').then((r) => r.json());
  console.log(`Fetched ${imams.length} imams. Sample: ${imams[0]?.name} (ID ${imams[0]?.id})`);

  // 2. Save Fixed Pattern for Ramadan 1448 (5 Fridays: Custom A, A, B, C, B)
  const patternSaveRes = await fetch(`http://127.0.0.1:3000/api/mosques/${targetMosqueId}/fixed-patterns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hijriYear: 1448,
      hijriMonth: 9,
      patternType: 'CUSTOM',
      fridaysCount: 5,
      items: [
        { fridayIndex: 1, imamId: imams[0].id },
        { fridayIndex: 2, imamId: imams[0].id },
        { fridayIndex: 3, imamId: imams[1].id },
        { fridayIndex: 4, imamId: imams[2].id },
        { fridayIndex: 5, imamId: imams[1].id },
      ],
    }),
  }).then((r) => r.json());
  console.log('Saved Custom Pattern for Ramadan:', patternSaveRes);

  // 3. Fetch Pattern to verify persistence
  const fetchedPattern = await fetch(`http://127.0.0.1:3000/api/mosques/${targetMosqueId}/fixed-patterns?year=1448&month=9`).then((r) => r.json());
  console.log(`Fetched Pattern: Exists=${fetchedPattern.exists}, Items=${fetchedPattern.pattern?.items?.length}, Type=${fetchedPattern.pattern?.patternType}`);

  // 4. Copy pattern to Shawwal 1448
  const copyRes = await fetch(`http://127.0.0.1:3000/api/mosques/${targetMosqueId}/fixed-patterns/copy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceYear: 1448,
      sourceMonth: 9,
      targetYear: 1448,
      targetMonth: 10,
    }),
  }).then((r) => r.json());
  console.log('Copy Pattern Response:', copyRes);

  // 5. Test Conflict detection: Try fixing the same imam in Mosque #2 on the same Friday
  if (mosques.length > 1) {
    const mosque2Id = mosques[1].id;
    const conflictRes = await fetch(`http://127.0.0.1:3000/api/mosques/${mosque2Id}/fixed-patterns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hijriYear: 1448,
        hijriMonth: 9,
        patternType: 'SAME_ALL',
        fridaysCount: 5,
        items: [
          { fridayIndex: 1, imamId: imams[0].id }, // Conflict with Mosque 1 on Friday 1!
        ],
      }),
    });
    const conflictJson = await conflictRes.json();
    console.log('Double Booking Conflict Status:', conflictRes.status, 'Message:', conflictJson.error);
  }

  console.log('--- API Tests Completed Successfully ---');
}

testApi();
