import { db } from './index.ts';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import {
  countries,
  administrativeUnits,
  mosques,
  imams,
  mosqueImamRules,
  monthlySchedules,
  fridays,
  assignments,
  users,
  fixedAssignmentPatterns,
  fixedAssignmentPatternItems,
  conflicts,
  overrides,
  scheduleVersions,
  distributionLogs,
  importExportLogs,
  importSnapshots,
} from './schema.ts';
import {
  EGYPT_GOVERNORATES,
  EGYPT_ADMINISTRATIVE_UNITS,
} from '../services/location/egyptAdministrativeData.ts';

export async function clearAllDatabaseData() {
  console.log('--- تصفير كافة المساجد والخطباء والجداول كحالة افتراضية للنظام ---');
  try {
    await db.delete(assignments);
    await db.delete(conflicts);
    await db.delete(overrides);
    await db.delete(fridays);
    await db.delete(monthlySchedules);
    await db.delete(scheduleVersions);
    await db.delete(distributionLogs);
    await db.delete(mosqueImamRules);
    await db.delete(fixedAssignmentPatternItems);
    await db.delete(fixedAssignmentPatterns);
    await db.delete(mosques);
    await db.delete(imams);
    await db.delete(importSnapshots);
    await db.delete(importExportLogs);
    console.log('تم تصفير قاعدة البيانات بنجاح (0 مساجد، 0 خطباء، 0 جداول).');
  } catch (err: any) {
    console.error('خطأ أثناء تصفير قاعدة البيانات:', err);
  }
}

export async function seedDatabase() {
  console.log('--- بدء تهيئة وتحديث قاعدة البيانات بالتقسيم الإداري والمساجد والخطباء ---');

  // 1. Seed Countries (Egypt)
  const existingCountries = await db.select().from(countries);
  if (existingCountries.length === 0) {
    await db.insert(countries).values({
      code: 'EG',
      nameAr: 'جمهورية مصر العربية',
    }).onConflictDoNothing();
    console.log('تم إدراج جمهورية مصر العربية في جدول الدول.');
  }

  // 2. Seed Administrative Units (Governorates & Districts & Areas)
  const existingUnits = await db.select().from(administrativeUnits);
  if (existingUnits.length === 0) {
    for (const gov of EGYPT_GOVERNORATES) {
      await db.insert(administrativeUnits).values({
        countryId: gov.countryId,
        level: gov.level,
        nameAr: gov.nameAr,
      }).onConflictDoNothing();
    }

    for (const unit of EGYPT_ADMINISTRATIVE_UNITS) {
      await db.insert(administrativeUnits).values({
        countryId: unit.countryId,
        level: unit.level,
        nameAr: unit.nameAr,
      }).onConflictDoNothing();
    }
    console.log(`تم إدراج التقسيمات الإدارية المصرية (${EGYPT_GOVERNORATES.length + EGYPT_ADMINISTRATIVE_UNITS.length} وحدة إدارية).`);
  }

  // 3. Create Default Admin User
  await db.insert(users).values({
    uid: 'admin-default-uid',
    email: 'saudiavisa2023@gmail.com',
    name: 'أمين شؤون المساجد — الجمعية الشرعية',
    role: 'super_admin',
  }).onConflictDoNothing();

  // 4. Auto-Seed Mosques, Imams, Schedules & Assignments from initialSeed.json if DB is empty
  const existingMosques = await db.select().from(mosques);
  if (existingMosques.length === 0) {
    console.log('جدول المساجد فارغ: جاري تحميل واستعادة البيانات المعتمدة من initialSeed.json...');
    const seedFilePath = path.resolve('src/db/initialSeed.json');
    if (fs.existsSync(seedFilePath)) {
      try {
        const rawData = fs.readFileSync(seedFilePath, 'utf8');
        const seedData = JSON.parse(rawData);

        if (Array.isArray(seedData.mosques) && seedData.mosques.length > 0) {
          for (const m of seedData.mosques) {
            await db.insert(mosques).values(m).onConflictDoNothing();
          }
          console.log(`تم استعادة ${seedData.mosques.length} مسجد معتمد.`);
        }

        if (Array.isArray(seedData.imams) && seedData.imams.length > 0) {
          for (const i of seedData.imams) {
            await db.insert(imams).values(i).onConflictDoNothing();
          }
          console.log(`تم استعادة ${seedData.imams.length} خطيب معتمد.`);
        }

        if (Array.isArray(seedData.monthlySchedules) && seedData.monthlySchedules.length > 0) {
          for (const s of seedData.monthlySchedules) {
            await db.insert(monthlySchedules).values(s).onConflictDoNothing();
          }
        }

        if (Array.isArray(seedData.fridays) && seedData.fridays.length > 0) {
          for (const f of seedData.fridays) {
            await db.insert(fridays).values(f).onConflictDoNothing();
          }
        }

        if (Array.isArray(seedData.assignments) && seedData.assignments.length > 0) {
          for (const a of seedData.assignments) {
            await db.insert(assignments).values(a).onConflictDoNothing();
          }
          console.log(`تم استعادة ${seedData.assignments.length} تكليف جمعة.`);
        }

        if (Array.isArray(seedData.mosqueImamRules) && seedData.mosqueImamRules.length > 0) {
          for (const r of seedData.mosqueImamRules) {
            await db.insert(mosqueImamRules).values(r).onConflictDoNothing();
          }
        }

        if (Array.isArray(seedData.fixedAssignmentPatterns) && seedData.fixedAssignmentPatterns.length > 0) {
          for (const p of seedData.fixedAssignmentPatterns) {
            await db.insert(fixedAssignmentPatterns).values(p).onConflictDoNothing();
          }
        }

        if (Array.isArray(seedData.fixedAssignmentPatternItems) && seedData.fixedAssignmentPatternItems.length > 0) {
          for (const pi of seedData.fixedAssignmentPatternItems) {
            await db.insert(fixedAssignmentPatternItems).values(pi).onConflictDoNothing();
          }
        }

        console.log('✅ تم استعادة وتثبيت كافة المعطيات المعتمدة بنجاح!');
      } catch (err) {
        console.error('خطأ أثناء تحميل initialSeed.json:', err);
      }
    } else {
      console.log('لم يتم العثور على ملف initialSeed.json.');
    }
  } else {
    console.log(`قاعدة البيانات تحتوي بالفعل على ${existingMosques.length} مسجد.`);
  }
}
