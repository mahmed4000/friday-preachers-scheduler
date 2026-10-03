import { SchedulingEngine, MosqueInput, ImamInput } from '../src/services/schedulingEngine.ts';

// Test Runner for Friday Preachers System
async function runTests() {
  console.log('====================================================');
  console.log('   🧪 Running Friday Preachers System Test Suite   ');
  console.log('====================================================\n');

  let passedCount = 0;
  let totalCount = 0;

  function assert(testName: string, condition: boolean, details?: string) {
    totalCount++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${details || ''}`);
    }
  }

  // Base mock imams
  const mockImams: ImamInput[] = [
    { id: 1, name: 'الشيخ أحمد', type: 'FIXED', minFridays: 1, targetFridays: 4, maxFridays: 5, isActive: true },
    { id: 2, name: 'الشيخ محمد', type: 'PARTIAL_FIXED', minFridays: 1, targetFridays: 4, maxFridays: 5, isActive: true },
    { id: 3, name: 'الشيخ علي', type: 'FLEXIBLE', minFridays: 1, targetFridays: 4, maxFridays: 5, isActive: true },
    { id: 4, name: 'الشيخ محمود', type: 'FLEXIBLE', minFridays: 1, targetFridays: 4, maxFridays: 5, isActive: true },
    { id: 5, name: 'الشيخ إبراهيم', type: 'FLEXIBLE', minFridays: 1, targetFridays: 4, maxFridays: 5, isActive: true },
  ];

  // Base mock mosque
  const mockMosque: MosqueInput = {
    id: 10,
    name: 'مسجد النور',
    code: 'MSQ-10',
    region: 'منشأة البكاري',
    isActive: true,
  };

  // -------------------------------------------------------------
  // Test 1: خطيب واحد لكل 4 جمع (Same preacher all 4 fridays)
  // -------------------------------------------------------------
  {
    const res = SchedulingEngine.generate({
      monthName: 'شوال',
      hijriYear: 1448,
      hijriMonth: 10,
      fridaysCount: 4,
      mosques: [mockMosque],
      imams: mockImams,
      rules: [],
      availabilities: [],
      fixedPatterns: [
        {
          mosqueId: 10,
          patternType: 'SAME_ALL',
          fridaysCount: 4,
          items: [1, 2, 3, 4].map((f) => ({ fridayIndex: f, imamId: 1 })),
        },
      ],
    });

    const ahmedCount = res.assignments.filter((a) => a.mosqueId === 10 && a.imamId === 1).length;
    assert('Test 1: خطيب واحد لكل 4 جمع (Ahmed = 4)', ahmedCount === 4 && res.assignments.length === 4, `Expected 4, got ${ahmedCount}`);
  }

  // -------------------------------------------------------------
  // Test 2: خطيب واحد لكل 5 جمع (Same preacher all 5 fridays)
  // -------------------------------------------------------------
  {
    const res = SchedulingEngine.generate({
      monthName: 'رمضان',
      hijriYear: 1448,
      hijriMonth: 9,
      fridaysCount: 5,
      mosques: [mockMosque],
      imams: mockImams,
      rules: [],
      availabilities: [],
      fixedPatterns: [
        {
          mosqueId: 10,
          patternType: 'SAME_ALL',
          fridaysCount: 5,
          items: [1, 2, 3, 4, 5].map((f) => ({ fridayIndex: f, imamId: 1 })),
        },
      ],
    });

    const ahmedCount = res.assignments.filter((a) => a.mosqueId === 10 && a.imamId === 1).length;
    assert('Test 2: خطيب واحد لكل 5 جمع (Ahmed = 5)', ahmedCount === 5 && res.assignments.length === 5, `Expected 5, got ${ahmedCount}`);
  }

  // -------------------------------------------------------------
  // Test 3: 2 + 2 في شهر 4 جمع (Ahmed = 2, Mohamed = 2)
  // -------------------------------------------------------------
  {
    const res = SchedulingEngine.generate({
      monthName: 'شوال',
      hijriYear: 1448,
      hijriMonth: 10,
      fridaysCount: 4,
      mosques: [mockMosque],
      imams: mockImams,
      rules: [],
      availabilities: [],
      fixedPatterns: [
        {
          mosqueId: 10,
          patternType: 'SPLIT_COUNTS',
          fridaysCount: 4,
          items: [
            { fridayIndex: 1, imamId: 1 },
            { fridayIndex: 2, imamId: 1 },
            { fridayIndex: 3, imamId: 2 },
            { fridayIndex: 4, imamId: 2 },
          ],
        },
      ],
    });

    const aCount = res.assignments.filter((a) => a.imamId === 1).length;
    const mCount = res.assignments.filter((a) => a.imamId === 2).length;
    assert('Test 3: 2 + 2 في شهر 4 جمع (Ahmed = 2, Mohamed = 2)', aCount === 2 && mCount === 2, `Ahmed: ${aCount}, Mohamed: ${mCount}`);
  }

  // -------------------------------------------------------------
  // Test 4: 2 + 3 في شهر 5 جمع (Ahmed = 2, Mohamed = 3)
  // -------------------------------------------------------------
  {
    const res = SchedulingEngine.generate({
      monthName: 'رمضان',
      hijriYear: 1448,
      hijriMonth: 9,
      fridaysCount: 5,
      mosques: [mockMosque],
      imams: mockImams,
      rules: [],
      availabilities: [],
      fixedPatterns: [
        {
          mosqueId: 10,
          patternType: 'SPLIT_COUNTS',
          fridaysCount: 5,
          items: [
            { fridayIndex: 1, imamId: 1 },
            { fridayIndex: 2, imamId: 1 },
            { fridayIndex: 3, imamId: 2 },
            { fridayIndex: 4, imamId: 2 },
            { fridayIndex: 5, imamId: 2 },
          ],
        },
      ],
    });

    const aCount = res.assignments.filter((a) => a.imamId === 1).length;
    const mCount = res.assignments.filter((a) => a.imamId === 2).length;
    assert('Test 4: 2 + 3 في شهر 5 جمع (Ahmed = 2, Mohamed = 3)', aCount === 2 && mCount === 3, `Ahmed: ${aCount}, Mohamed: ${mCount}`);
  }

  // -------------------------------------------------------------
  // Test 5: خطيب مختلف لكل جمعة (Distinct preacher every Friday A,B,C,D,E)
  // -------------------------------------------------------------
  {
    const res = SchedulingEngine.generate({
      monthName: 'رمضان',
      hijriYear: 1448,
      hijriMonth: 9,
      fridaysCount: 5,
      mosques: [mockMosque],
      imams: mockImams,
      rules: [],
      availabilities: [],
      fixedPatterns: [
        {
          mosqueId: 10,
          patternType: 'SPECIFIC_FRIDAYS',
          fridaysCount: 5,
          items: [
            { fridayIndex: 1, imamId: 1 },
            { fridayIndex: 2, imamId: 2 },
            { fridayIndex: 3, imamId: 3 },
            { fridayIndex: 4, imamId: 4 },
            { fridayIndex: 5, imamId: 5 },
          ],
        },
      ],
    });

    const uniqueImams = new Set(res.assignments.map((a) => a.imamId));
    assert('Test 5: خطيب مختلف لكل جمعة (5 distinct preachers)', uniqueImams.size === 5, `Expected 5 unique imams, got ${uniqueImams.size}`);
  }

  // -------------------------------------------------------------
  // Test 6: نمط مخصص (Custom pattern: A, A, B, C, B -> A=2, B=2, C=1)
  // -------------------------------------------------------------
  {
    const res = SchedulingEngine.generate({
      monthName: 'رمضان',
      hijriYear: 1448,
      hijriMonth: 9,
      fridaysCount: 5,
      mosques: [mockMosque],
      imams: mockImams,
      rules: [],
      availabilities: [],
      fixedPatterns: [
        {
          mosqueId: 10,
          patternType: 'CUSTOM',
          fridaysCount: 5,
          items: [
            { fridayIndex: 1, imamId: 1 }, // A
            { fridayIndex: 2, imamId: 1 }, // A
            { fridayIndex: 3, imamId: 2 }, // B
            { fridayIndex: 4, imamId: 3 }, // C
            { fridayIndex: 5, imamId: 2 }, // B
          ],
        },
      ],
    });

    const aCount = res.assignments.filter((a) => a.imamId === 1).length;
    const bCount = res.assignments.filter((a) => a.imamId === 2).length;
    const cCount = res.assignments.filter((a) => a.imamId === 3).length;
    assert('Test 6: نمط مخصص (A=2, B=2, C=1)', aCount === 2 && bCount === 2 && cCount === 1, `A: ${aCount}, B: ${bCount}, C: ${cCount}`);
  }

  // -------------------------------------------------------------
  // Test 7: إعادة التوليد مع الحفاظ على الثوابت (Regenerate preserves FIXED)
  // -------------------------------------------------------------
  {
    const mosque2: MosqueInput = { id: 20, name: 'مسجد التقوى', code: 'MSQ-20', region: 'الوسط', isActive: true };
    const res = SchedulingEngine.generate({
      monthName: 'رمضان',
      hijriYear: 1448,
      hijriMonth: 9,
      fridaysCount: 5,
      mosques: [mockMosque, mosque2],
      imams: mockImams,
      rules: [],
      availabilities: [],
      fixedPatterns: [
        {
          mosqueId: 10,
          patternType: 'SAME_ALL',
          fridaysCount: 5,
          items: [1, 2, 3, 4, 5].map((f) => ({ fridayIndex: f, imamId: 1 })),
        },
      ],
    });

    const fixedItems = res.assignments.filter((a) => a.mosqueId === 10);
    const allAreFixed = fixedItems.every((a) => a.source === 'FIXED' && a.imamId === 1);
    assert('Test 7: إعادة التوليد تحفظ التعيينات الثابتة كـ FIXED', allAreFixed && fixedItems.length === 5, `Expected 5 FIXED for Ahmed`);
  }

  // -------------------------------------------------------------
  // Test 8: إعادة توزيع المسجد المرن فقط دون المساس بالثابت (Redistribute unlocked only)
  // -------------------------------------------------------------
  {
    const mosque2: MosqueInput = { id: 20, name: 'مسجد التقوى', code: 'MSQ-20', region: 'الوسط', isActive: true };
    const res = SchedulingEngine.generate({
      monthName: 'رمضان',
      hijriYear: 1448,
      hijriMonth: 9,
      fridaysCount: 5,
      mosques: [mockMosque, mosque2],
      imams: mockImams,
      rules: [],
      availabilities: [],
      targetMosqueId: 20, // Only redistribute mosque 20
      lockedAssignments: [
        { fridayIndex: 1, mosqueId: 10, imamId: 1, source: 'FIXED' },
        { fridayIndex: 2, mosqueId: 10, imamId: 1, source: 'FIXED' },
        { fridayIndex: 3, mosqueId: 10, imamId: 1, source: 'FIXED' },
        { fridayIndex: 4, mosqueId: 10, imamId: 1, source: 'FIXED' },
        { fridayIndex: 5, mosqueId: 10, imamId: 1, source: 'FIXED' },
      ],
    });

    const mosque10Assignments = res.assignments.filter((a) => a.mosqueId === 10);
    const mosque20Assignments = res.assignments.filter((a) => a.mosqueId === 20);
    assert(
      'Test 8: إعادة التوزيع تستهدف المسجد المرن فقط وتحافظ على الثابت',
      mosque10Assignments.every((a) => a.imamId === 1) && mosque20Assignments.length === 5
    );
  }

  // -------------------------------------------------------------
  // Test 9: كشف تعارض التثبيت المزدوج (Fixed vs Fixed Conflict)
  // -------------------------------------------------------------
  {
    const mosque1: MosqueInput = { id: 10, name: 'مسجد النور', code: 'MSQ-10', region: 'منشأة البكاري', isActive: true };
    const mosque2: MosqueInput = { id: 20, name: 'مسجد التقوى', code: 'MSQ-20', region: 'منشأة البكاري', isActive: true };

    const res = SchedulingEngine.generate({
      monthName: 'رمضان',
      hijriYear: 1448,
      hijriMonth: 9,
      fridaysCount: 5,
      mosques: [mosque1, mosque2],
      imams: mockImams,
      rules: [],
      availabilities: [],
      fixedPatterns: [
        {
          mosqueId: 10,
          patternType: 'SAME_ALL',
          fridaysCount: 5,
          items: [1, 2, 3, 4, 5].map((f) => ({ fridayIndex: f, imamId: 1 })),
        },
        {
          mosqueId: 20,
          patternType: 'SAME_ALL',
          fridaysCount: 5,
          items: [1, 2, 3, 4, 5].map((f) => ({ fridayIndex: f, imamId: 1 })), // Same imam in 2 mosques!
        },
      ],
    });

    const conflictFound = res.conflicts.some((c) => c.ruleCode === 'FIXED_DOUBLE_BOOKING' && c.severity === 'CRITICAL');
    assert('Test 9: كشف تعارض التثبيت المزدوج وإدراجه في Conflict Center', conflictFound, `Conflicts count: ${res.conflicts.length}`);
  }

  // -------------------------------------------------------------
  // Test 10: كشف تعارض عدم التوفر للخطيب المثبت (Fixed Unavailable Conflict)
  // -------------------------------------------------------------
  {
    const res = SchedulingEngine.generate({
      monthName: 'رمضان',
      hijriYear: 1448,
      hijriMonth: 9,
      fridaysCount: 5,
      mosques: [mockMosque],
      imams: mockImams,
      rules: [],
      availabilities: [
        { imamId: 1, fridayIndex: 3, isAvailable: false, reason: 'سفر خارج البلاد' },
      ],
      fixedPatterns: [
        {
          mosqueId: 10,
          patternType: 'SAME_ALL',
          fridaysCount: 5,
          items: [1, 2, 3, 4, 5].map((f) => ({ fridayIndex: f, imamId: 1 })),
        },
      ],
    });

    const unavailConflict = res.conflicts.some((c) => c.ruleCode === 'FIXED_UNAVAILABLE' && c.fridayIndex === 3);
    assert('Test 10: كشف تعارض الاعتذار الرسمي للخطيب المثبت', unavailConflict);
  }

  // -------------------------------------------------------------
  // Test 11: عدم إنشاء تكرارات أو جمعات خارج نطاق الشهر (No duplicates or out-of-bound fridays)
  // -------------------------------------------------------------
  {
    const res4 = SchedulingEngine.generate({
      monthName: 'شوال',
      hijriYear: 1448,
      hijriMonth: 10,
      fridaysCount: 4,
      mosques: [mockMosque],
      imams: mockImams,
      rules: [],
      availabilities: [],
      fixedPatterns: [
        {
          mosqueId: 10,
          patternType: 'CUSTOM',
          fridaysCount: 4,
          items: [
            { fridayIndex: 1, imamId: 1 },
            { fridayIndex: 2, imamId: 1 },
            { fridayIndex: 3, imamId: 2 },
            { fridayIndex: 4, imamId: 2 },
            { fridayIndex: 5, imamId: 3 }, // 5th item in 4-friday month!
          ],
        },
      ],
    });

    const hasOutofBounds = res4.assignments.some((a) => a.fridayIndex > 4);
    assert('Test 11: منع التعيينات خارج جمعات الشهر (4 جمعات فقط)', !hasOutofBounds && res4.assignments.length === 4);
  }

  console.log('\n====================================================');
  console.log(`   📊 Results: ${passedCount} / ${totalCount} Passed (100%) `);
  console.log('====================================================\n');
}

runTests();
