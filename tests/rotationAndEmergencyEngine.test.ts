import test from 'node:test';
import assert from 'node:assert';
import { SchedulingEngine } from '../src/services/schedulingEngine.ts';
import type { MosqueInput, ImamInput, RuleInput } from '../src/services/schedulingEngine.ts';

test('Rotation Smoothing & Emergency Preacher Engine Tests', async (t) => {
  const testMosques: MosqueInput[] = [
    { id: 1, name: 'مسجد الهدى', code: 'HOD', region: 'الوسط', isActive: true },
    { id: 2, name: 'مسجد النور', code: 'NOR', region: 'الوسط', isActive: true },
    { id: 3, name: 'مسجد التقوى', code: 'TAQ', region: 'الشمال', isActive: true },
  ];

  const testImams: ImamInput[] = [
    { id: 1, name: 'الشيخ أحمد', type: 'FLEXIBLE', minFridays: 1, targetFridays: 4, maxFridays: 5, isActive: true, region: 'الوسط' },
    { id: 2, name: 'الشيخ محمد', type: 'FLEXIBLE', minFridays: 1, targetFridays: 4, maxFridays: 5, isActive: true, region: 'الوسط' },
    { id: 3, name: 'الشيخ إبراهيم', type: 'FLEXIBLE', minFridays: 1, targetFridays: 4, maxFridays: 5, isActive: true, region: 'الشمال' },
    { id: 4, name: 'الشيخ عبد الله (احتياط)', type: 'FLEXIBLE', minFridays: 0, targetFridays: 2, maxFridays: 4, isActive: true, region: 'الوسط' },
    { id: 5, name: 'الشيخ يوسف (ممنوع)', type: 'FLEXIBLE', minFridays: 0, targetFridays: 2, maxFridays: 4, isActive: true, region: 'الوسط' },
  ];

  const testRules: RuleInput[] = [
    { mosqueId: 1, imamId: 1, relationshipType: 'PREFERRED', priority: 1 },
    { mosqueId: 1, imamId: 5, relationshipType: 'FORBIDDEN', priority: 1 },
  ];

  await t.test('1. Rotation Smoothing: Non-fixed imam is not assigned to the same mosque on consecutive Fridays', () => {
    const result = SchedulingEngine.generate({
      monthName: 'شوال',
      hijriYear: 1448,
      hijriMonth: 10,
      fridaysCount: 4,
      mosques: testMosques,
      imams: testImams,
      rules: testRules,
      availabilities: [],
      distributionMethod: 'Balanced',
      seed: 'TEST-ROTATION-1',
    });

    assert.ok(result);
    assert.strictEqual(result.assignments.length, 12); // 3 mosques * 4 fridays

    // Check each mosque: no non-fixed imam should preach on consecutive fridays (f and f+1)
    for (const m of testMosques) {
      const mosqueAssigns = result.assignments
        .filter((a) => a.mosqueId === m.id)
        .sort((x, y) => x.fridayIndex - y.fridayIndex);

      for (let i = 0; i < mosqueAssigns.length - 1; i++) {
        const curr = mosqueAssigns[i];
        const next = mosqueAssigns[i + 1];
        if (curr.fridayIndex + 1 === next.fridayIndex && curr.imamId && next.imamId) {
          // If neither is a fixed imam, they should NOT be the exact same imam
          assert.notStrictEqual(
            curr.imamId,
            next.imamId,
            `الخطيب #${curr.imamId} تم تعيينه لجمعتين متتاليتين (${curr.fridayIndex} و ${next.fridayIndex}) في نفس المسجد (#${m.id}) دون أن يكون خطيباً ثابتاً!`
          );
        }
      }
    }
  });

  await t.test('2. Historical Rotation: Preacher who visited mosque recently in history is smoothed out when alternatives exist', () => {
    const history = [
      { mosqueId: 1, imamId: 1, hijriYear: 1448, hijriMonth: 9, fridayIndex: 4 },
      { mosqueId: 1, imamId: 1, hijriYear: 1448, hijriMonth: 9, fridayIndex: 3 },
    ];

    const result = SchedulingEngine.generate({
      monthName: 'شوال',
      hijriYear: 1448,
      hijriMonth: 10,
      fridaysCount: 4,
      mosques: testMosques,
      imams: testImams,
      rules: [], // No fixed rules
      availabilities: [],
      history,
      distributionMethod: 'Balanced',
      seed: 'TEST-HISTORY-ROTATION',
    });

    assert.ok(result);
    // Imam 1 should not monopolize Mosque 1 because of recent historical visits
    const m1Assigns = result.assignments.filter((a) => a.mosqueId === 1 && a.imamId === 1);
    assert.ok(m1Assigns.length <= 2, 'تم التدوير ولم يتم احتكار المسجد لنفس الخطيب بسبب تاريخ الزيارات السابقة');
  });

  await t.test('3. Emergency Replacements: Excludes booked, unavailable, and forbidden preachers', () => {
    const existingAssignments = [
      { fridayIndex: 2, mosqueId: 1, imamId: 1 }, // Imam 1 apologized on Friday 2 for Mosque 1
      { fridayIndex: 2, mosqueId: 2, imamId: 2 }, // Imam 2 is already booked on Friday 2 in Mosque 2
      { fridayIndex: 2, mosqueId: 3, imamId: 3 }, // Imam 3 is already booked on Friday 2 in Mosque 3
    ];

    const unavailabilities = [
      { imamId: 4, fridayIndex: 1, isAvailable: false }, // Imam 4 unavailable on Friday 1 (available on Friday 2)
    ];

    const replacements = SchedulingEngine.findEmergencyReplacements({
      fridayIndex: 2,
      mosqueId: 1,
      currentImamId: 1, // Imam 1 apologized
      allMosques: testMosques,
      allImams: testImams,
      rules: testRules, // Imam 5 is FORBIDDEN in Mosque 1
      existingAssignments,
      unavailabilities,
      standbyImamIds: [4],
    });

    assert.ok(replacements.length > 0);

    // Imam 1 (apologized) must NOT be in replacements
    assert.ok(!replacements.some((r) => r.imam.id === 1));

    // Imam 2 & 3 (booked elsewhere on Friday 2) must NOT be in replacements
    assert.ok(!replacements.some((r) => r.imam.id === 2));
    assert.ok(!replacements.some((r) => r.imam.id === 3));

    // Imam 5 (FORBIDDEN in Mosque 1) must NOT be in replacements
    assert.ok(!replacements.some((r) => r.imam.id === 5));

    // Imam 4 (Standby, available on Friday 2, nearby in 'الوسط') should be the top candidate!
    const top = replacements[0];
    assert.strictEqual(top.imam.id, 4);
    assert.strictEqual(top.isStandby, true);
    assert.strictEqual(top.isNearby, true);
    assert.ok(top.compatibilityScore >= 70);
    assert.ok(top.reason.length > 0);
  });
});
