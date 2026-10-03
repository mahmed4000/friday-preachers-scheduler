import test from 'node:test';
import assert from 'node:assert';
import { memoryStore } from '../src/server/memoryStore.ts';

test('memoryStore database engine resilience tests', async (t) => {
  await t.test('1. createSchedule creates a draft schedule and fridays correctly', () => {
    // Pick Dhul-Hijjah 1449
    const res = memoryStore.createSchedule(1449, 12, 'UMM_AL_QURA', 'Asia/Riyadh');
    const sched = res.schedule || res;
    assert.ok(sched);
    assert.strictEqual(sched.hijriYear, 1449);
    assert.strictEqual(sched.hijriMonth, 12);
    assert.ok(sched.fridaysCount >= 4);
    assert.ok(sched.id > 0);
  });

  await t.test('2. generateSchedule runs scheduling engine and creates assignments without error', () => {
    // Find or create a schedule
    const schedules = memoryStore.getSchedules();
    assert.ok(schedules.length > 0);
    const targetSchedule = schedules[0];

    const genResult = memoryStore.generateSchedule(targetSchedule.id, 'Balanced Random', 'test-seed');
    assert.ok(genResult);
    assert.strictEqual(genResult.success, true);
    assert.ok(genResult.result);
    assert.ok(genResult.result.assignments.length > 0);
  });

  await t.test('3. updateAssignment and toggleLock update in-memory state', () => {
    const schedules = memoryStore.getSchedules();
    const targetSchedule = schedules[0];
    const details = memoryStore.getScheduleDetails(targetSchedule.id);
    assert.ok(details);
    assert.ok(details.assignments.length > 0);

    const firstAssign = details.assignments[0];
    const initialLocked = !!firstAssign.isLocked;
    const locked = memoryStore.toggleLock(targetSchedule.id, firstAssign.id);
    assert.ok(locked);
    assert.strictEqual(locked.isLocked, !initialLocked);

    const updated = memoryStore.updateAssignment(targetSchedule.id, firstAssign.id, 1, 'تعديل اختباري');
    assert.ok(updated);
    assert.strictEqual(updated.imamId, 1);
  });

  await t.test('4. approveSchedule and publishSchedule update schedule status', () => {
    const schedules = memoryStore.getSchedules();
    const targetSchedule = schedules[0];

    const approved = memoryStore.approveSchedule(targetSchedule.id);
    assert.ok(approved);
    assert.strictEqual(approved.status, 'APPROVED');

    const published = memoryStore.publishSchedule(targetSchedule.id);
    assert.ok(published);
    assert.strictEqual(published.status, 'PUBLISHED');
  });
});
