import { SchedulingEngine } from '../src/services/schedulingEngine.ts';
import type {
  MosqueInput,
  ImamInput,
  RuleInput,
  AvailabilityInput,
} from '../src/services/schedulingEngine.ts';

function runTests() {
  console.log('--- بدء اختبارات وحدة محرك الجدولة (Scheduling Engine Unit Tests) ---');
  let passed = 0;
  let failed = 0;

  function assert(testName: string, condition: boolean, extraInfo?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${extraInfo ? `-> ${extraInfo}` : ''}`);
      failed++;
    }
  }

  // Base test data
  const baseImams: ImamInput[] = [
    { id: 1, name: 'الشيخ أحمد', type: 'FIXED', minFridays: 4, targetFridays: 4, maxFridays: 5, isActive: true },
    { id: 2, name: 'الشيخ محمد', type: 'PARTIAL_FIXED', minFridays: 2, targetFridays: 3, maxFridays: 4, isActive: true },
    { id: 3, name: 'الشيخ علي', type: 'FLEXIBLE', minFridays: 2, targetFridays: 4, maxFridays: 5, isActive: true },
    { id: 4, name: 'الشيخ محمود', type: 'FLEXIBLE', minFridays: 1, targetFridays: 3, maxFridays: 4, isActive: true },
    { id: 5, name: 'الشيخ عثمان', type: 'FLEXIBLE', minFridays: 1, targetFridays: 2, maxFridays: 4, isActive: true },
  ];

  const baseMosques: MosqueInput[] = [
    { id: 101, name: 'مسجد النور', code: 'M101', region: 'الوسط', isActive: true, fixedImamId: 1, fixedPattern: 'ALL' },
    { id: 102, name: 'مسجد التقوى', code: 'M102', region: 'الشمال', isActive: true, fixedImamId: 2, fixedPattern: 'FIRST_N', fixedCount: 3 },
    { id: 103, name: 'مسجد الفتح', code: 'M103', region: 'الجنوب', isActive: true },
    { id: 104, name: 'مسجد الإيمان', code: 'M104', region: 'الشرق', isActive: true },
  ];

  // 1 & 2: Test 4 fridays vs 5 fridays
  {
    const res4 = SchedulingEngine.generate({
      monthName: 'شعبان',
      hijriYear: 1448,
      hijriMonth: 8,
      fridaysCount: 4,
      mosques: baseMosques,
      imams: baseImams,
      rules: [],
      availabilities: [],
    });
    assert('1. شهر 4 جمعات ينشئ 16 تعيين (4 مساجد × 4 جمعات)', res4.stats.totalAssignments === 16);

    const res5 = SchedulingEngine.generate({
      monthName: 'رمضان',
      hijriYear: 1448,
      hijriMonth: 9,
      fridaysCount: 5,
      mosques: baseMosques,
      imams: baseImams,
      rules: [],
      availabilities: [],
    });
    assert('2. شهر 5 جمعات ينشئ 20 تعيين (4 مساجد × 5 جمعات)', res5.stats.totalAssignments === 20);
  }

  // 3: Fixed ALL month
  {
    const res = SchedulingEngine.generate({
      monthName: 'رمضان',
      hijriYear: 1448,
      hijriMonth: 9,
      fridaysCount: 5,
      mosques: [{ id: 101, name: 'مسجد النور', code: 'M101', region: 'الوسط', isActive: true, fixedImamId: 1, fixedPattern: 'ALL' }],
      imams: baseImams,
      rules: [],
      availabilities: [],
    });
    const m101Assignments = res.assignments.filter((a) => a.mosqueId === 101 && a.imamId === 1);
    assert('3. خطيب ثابت كل الشهر (ALL) يحصل على جميع جمعات الشهر الـ 5', m101Assignments.length === 5);
  }

  // 4 & 5: Fixed FIRST_N (3 fridays)
  {
    const res = SchedulingEngine.generate({
      monthName: 'رمضان',
      hijriYear: 1448,
      hijriMonth: 9,
      fridaysCount: 5,
      mosques: [{ id: 102, name: 'مسجد التقوى', code: 'M102', region: 'الشمال', isActive: true, fixedImamId: 2, fixedPattern: 'FIRST_N', fixedCount: 3 }],
      imams: baseImams,
      rules: [],
      availabilities: [],
    });
    const f123 = res.assignments.filter((a) => a.mosqueId === 102 && a.imamId === 2 && a.fridayIndex <= 3);
    assert('5. نمط FIRST_N لـ 3 جمعات يعيّن الخطيب في أول 3 جمعات بدقة', f123.length === 3);
  }

  // 6: Fixed LAST_N (2 fridays in a 5-friday month)
  {
    const res = SchedulingEngine.generate({
      monthName: 'رمضان',
      hijriYear: 1448,
      hijriMonth: 9,
      fridaysCount: 5,
      mosques: [{ id: 105, name: 'مسجد قباء', code: 'M105', region: 'الشرق', isActive: true, fixedImamId: 2, fixedPattern: 'LAST_N', fixedCount: 2 }],
      imams: baseImams,
      rules: [],
      availabilities: [],
    });
    const last2 = res.assignments.filter((a) => a.mosqueId === 105 && a.imamId === 2 && a.fridayIndex >= 4);
    assert('6. نمط LAST_N لجمعتين يعيّن في الجمعتين 4 و 5', last2.length === 2);
  }

  // 7: Fixed ANY_N
  {
    const res = SchedulingEngine.generate({
      monthName: 'شعبان',
      hijriYear: 1448,
      hijriMonth: 8,
      fridaysCount: 4,
      mosques: [{ id: 106, name: 'مسجد البخاري', code: 'M106', region: 'الغرب', isActive: true, fixedImamId: 4, fixedPattern: 'ANY_N', fixedCount: 2 }],
      imams: baseImams,
      rules: [],
      availabilities: [],
    });
    const any2 = res.assignments.filter((a) => a.mosqueId === 106 && a.imamId === 4);
    assert('7. نمط ANY_N لجمعتين يضمن تعيين الخطيب مرتين', any2.length >= 2);
  }

  // 8: Unavailable Imam (Hard Constraint)
  {
    const avail: AvailabilityInput[] = [
      { imamId: 3, fridayIndex: 2, isAvailable: false, reason: 'سفر' },
    ];
    const res = SchedulingEngine.generate({
      monthName: 'رمضان',
      hijriYear: 1448,
      hijriMonth: 9,
      fridaysCount: 4,
      mosques: [{ id: 103, name: 'مسجد الفتح', code: 'M103', region: 'الجنوب', isActive: true }],
      imams: [{ id: 3, name: 'الشيخ علي', type: 'FLEXIBLE', minFridays: 1, targetFridays: 3, maxFridays: 4, isActive: true }],
      rules: [],
      availabilities: avail,
    });
    const friday2Assign = res.assignments.find((a) => a.fridayIndex === 2);
    assert('8. الخطيب غير المتاح لا يتم تعيينه في جمعة عدم التوفر', friday2Assign?.imamId !== 3);
  }

  // 9: Forbidden Imam (Hard Constraint)
  {
    const rules: RuleInput[] = [
      { mosqueId: 103, imamId: 3, relationshipType: 'FORBIDDEN', priority: 1 },
    ];
    const res = SchedulingEngine.generate({
      monthName: 'رمضان',
      hijriYear: 1448,
      hijriMonth: 9,
      fridaysCount: 4,
      mosques: [{ id: 103, name: 'مسجد الفتح', code: 'M103', region: 'الجنوب', isActive: true }],
      imams: [
        { id: 3, name: 'الشيخ علي (ممنوع)', type: 'FLEXIBLE', minFridays: 1, targetFridays: 4, maxFridays: 4, isActive: true },
        { id: 4, name: 'الشيخ محمود (مسموح)', type: 'FLEXIBLE', minFridays: 1, targetFridays: 4, maxFridays: 4, isActive: true },
      ],
      rules,
      availabilities: [],
    });
    const forbiddenAssigned = res.assignments.some((a) => a.mosqueId === 103 && a.imamId === 3);
    assert('9. الخطيب الممنوع (FORBIDDEN) لا يُعيّن في المسجد مطلقاً', !forbiddenAssigned);
  }

  // 10: Preferred Imam (Soft Constraint)
  {
    const rules: RuleInput[] = [
      { mosqueId: 103, imamId: 4, relationshipType: 'PREFERRED', priority: 1 },
    ];
    const res = SchedulingEngine.generate({
      monthName: 'رمضان',
      hijriYear: 1448,
      hijriMonth: 9,
      fridaysCount: 4,
      mosques: [{ id: 103, name: 'مسجد الفتح', code: 'M103', region: 'الجنوب', isActive: true }],
      imams: [
        { id: 3, name: 'الشيخ علي', type: 'FLEXIBLE', minFridays: 1, targetFridays: 4, maxFridays: 4, isActive: true },
        { id: 4, name: 'الشيخ محمود (مفضل)', type: 'FLEXIBLE', minFridays: 1, targetFridays: 4, maxFridays: 4, isActive: true },
      ],
      rules,
      availabilities: [],
    });
    const preferredCount = res.assignments.filter((a) => a.mosqueId === 103 && a.imamId === 4).length;
    assert('10. الخطيب المفضل (PREFERRED) يحصل على الأولوية في التعيين', preferredCount > 0);
  }

  // 11: Maximum Reached
  {
    const res = SchedulingEngine.generate({
      monthName: 'رمضان',
      hijriYear: 1448,
      hijriMonth: 9,
      fridaysCount: 5,
      mosques: [
        { id: 101, name: 'مسجد 1', code: 'M1', region: 'الوسط', isActive: true },
        { id: 102, name: 'مسجد 2', code: 'M2', region: 'الوسط', isActive: true },
      ],
      imams: [
        { id: 10, name: 'الشيخ الصغير', type: 'FLEXIBLE', minFridays: 1, targetFridays: 2, maxFridays: 2, isActive: true },
        { id: 11, name: 'الشيخ الكبير', type: 'FLEXIBLE', minFridays: 1, targetFridays: 8, maxFridays: 8, isActive: true },
      ],
      rules: [],
      availabilities: [],
    });
    const imam10Count = res.imamUsage[10] || 0;
    assert('11. احترام الحد الأقصى للخطيب وعدم تجاوزه (maxFridays <= 2)', imam10Count <= 2);
  }

  // 14: Locked Assignments are preserved
  {
    const res = SchedulingEngine.generate({
      monthName: 'رمضان',
      hijriYear: 1448,
      hijriMonth: 9,
      fridaysCount: 4,
      mosques: [{ id: 103, name: 'مسجد الفتح', code: 'M103', region: 'الجنوب', isActive: true }],
      imams: baseImams,
      rules: [],
      availabilities: [],
      lockedAssignments: [
        { fridayIndex: 1, mosqueId: 103, imamId: 5, source: 'MANUAL', notes: 'تثبيت يدوي خاص' },
      ],
    });
    const friday1 = res.assignments.find((a) => a.mosqueId === 103 && a.fridayIndex === 1);
    assert('14. التعيين المقفول (Locked) يظل محتفظاً بالخطيب والمصدر دون تغيير', friday1?.imamId === 5 && friday1?.isLocked === true);
  }

  // 16: No possible solution raises Critical Conflict
  {
    const res = SchedulingEngine.generate({
      monthName: 'رمضان',
      hijriYear: 1448,
      hijriMonth: 9,
      fridaysCount: 4,
      mosques: [{ id: 103, name: 'مسجد الفتح', code: 'M103', region: 'الجنوب', isActive: true }],
      imams: [{ id: 99, name: 'الشيخ الممنوع الوحيد', type: 'FLEXIBLE', minFridays: 1, targetFridays: 1, maxFridays: 1, isActive: true }],
      rules: [{ mosqueId: 103, imamId: 99, relationshipType: 'FORBIDDEN', priority: 1 }],
      availabilities: [],
    });
    const hasCritical = res.conflicts.some((c) => c.severity === 'CRITICAL');
    assert('16. عدم وجود حل ممكن يولد تعارضاً حرجاً واضحاً واقتراحات حلول', hasCritical);
  }

  // 18: No double-booking of same imam on same Friday
  {
    const res = SchedulingEngine.generate({
      monthName: 'رمضان',
      hijriYear: 1448,
      hijriMonth: 9,
      fridaysCount: 5,
      mosques: baseMosques,
      imams: baseImams,
      rules: [],
      availabilities: [],
    });
    let doubleBookingDetected = false;
    for (let f = 1; f <= 5; f++) {
      const assignedThisFriday = res.assignments
        .filter((a) => a.fridayIndex === f && a.imamId !== null)
        .map((a) => a.imamId);
      const unique = new Set(assignedThisFriday);
      if (unique.size !== assignedThisFriday.length) {
        doubleBookingDetected = true;
      }
    }
    assert('18. منع تعيين نفس الخطيب في أكثر من مسجد في نفس الجمعة منعاً باتاً', !doubleBookingDetected);
  }

  console.log(`\nنتائج الاختبارات: ${passed} نجح / ${failed} فشل`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
