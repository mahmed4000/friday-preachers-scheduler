import { db } from '../src/db/index.ts';
import * as schema from '../src/db/schema.ts';
import fs from 'fs';
import path from 'path';

export async function exportCurrentDatabaseToSeedJson() {
  console.log('--- جاري استخراج كافة البيانات الحالية لحفظها كملف الأساس (Initial Seed) ---');
  try {
    const mosquesData = await db.select().from(schema.mosques);
    const imamsData = await db.select().from(schema.imams);
    const schedulesData = await db.select().from(schema.monthlySchedules);
    const fridaysData = await db.select().from(schema.fridays);
    const assignmentsData = await db.select().from(schema.assignments);
    const rulesData = await db.select().from(schema.mosqueImamRules);
    const fixedPatternsData = await db.select().from(schema.fixedAssignmentPatterns);
    const fixedPatternItemsData = await db.select().from(schema.fixedAssignmentPatternItems);
    const usersData = await db.select().from(schema.users);

    const dump = {
      exportDate: new Date().toISOString(),
      counts: {
        mosques: mosquesData.length,
        imams: imamsData.length,
        schedules: schedulesData.length,
        assignments: assignmentsData.length,
        rules: rulesData.length,
        patterns: fixedPatternsData.length,
      },
      mosques: mosquesData,
      imams: imamsData,
      monthlySchedules: schedulesData,
      fridays: fridaysData,
      assignments: assignmentsData,
      mosqueImamRules: rulesData,
      fixedAssignmentPatterns: fixedPatternsData,
      fixedAssignmentPatternItems: fixedPatternItemsData,
      users: usersData,
    };

    const filePath = path.resolve('src/db/initialSeed.json');
    fs.writeFileSync(filePath, JSON.stringify(dump, null, 2), 'utf8');
    console.log('تم حفظ كافة البيانات بنجاح في ملف:', filePath);
    console.log('إحصائيات الملف المحفوظ:', dump.counts);
    return dump;
  } catch (err) {
    console.error('خطأ أثناء تصدير ملف البيانات الأساسي:', err);
    throw err;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  exportCurrentDatabaseToSeedJson()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
