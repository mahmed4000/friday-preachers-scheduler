import 'dotenv/config';
import { db } from '../src/db/index.ts';
import { mosques, imams, monthlySchedules, assignments, mosqueImamRules, fridays } from '../src/db/schema.ts';

async function main() {
  console.log('--- DRIZZLE READ-ONLY COUNT VERIFICATION ---');
  const allMosques = await db.select().from(mosques);
  const allImams = await db.select().from(imams);
  const allSchedules = await db.select().from(monthlySchedules);
  const allAssignments = await db.select().from(assignments);
  const allRules = await db.select().from(mosqueImamRules);
  const allFridays = await db.select().from(fridays);

  console.log(`mosques count: ${allMosques.length}`);
  console.log(`imams count: ${allImams.length}`);
  console.log(`monthly_schedules count: ${allSchedules.length}`);
  console.log(`assignments count: ${allAssignments.length}`);
  console.log(`mosque_imam_rules count: ${allRules.length}`);
  console.log(`fridays count: ${allFridays.length}`);

  // Sample data check
  console.log('\n--- SAMPLE DATA READ VIA DRIZZLE ---');
  if (allMosques.length > 0) {
    console.log('Sample Mosque:', { id: allMosques[0].id, name: allMosques[0].name, code: allMosques[0].code, region: allMosques[0].region });
  }
  if (allImams.length > 0) {
    console.log('Sample Imam:', { id: allImams[0].id, name: allImams[0].name, phone: allImams[0].phone, type: allImams[0].type });
  }
  if (allSchedules.length > 0) {
    console.log('Sample Schedule:', { id: allSchedules[0].id, year: allSchedules[0].hijriYear, month: allSchedules[0].hijriMonth, monthName: allSchedules[0].monthName });
  }
}

main().catch(err => {
  console.error('Drizzle count verification error:', err);
  process.exit(1);
});
