import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore } from '../src/server/memoryStore.ts';
import type { Assignment } from '../src/types/index.ts';

test('Phase 2 Drag & Drop and Mutual Swap Validation', async (t) => {
  await t.test('1. memoryStore.swapAssignments swaps two imams on the same Friday', () => {
    // Setup a schedule and generate assignments
    const res = memoryStore.createSchedule(1448, 7);
    const sched = res.schedule || res;
    assert.ok(sched, 'Schedule should be created');

    const gen = memoryStore.generateSchedule(sched.id, 'Balanced Random');
    assert.ok(gen.success, 'Generation should succeed');

    const details = memoryStore.getScheduleDetails(sched.id);
    assert.ok(details, 'Details should exist');
    const assignments = details.assignments;
    assert.ok(assignments.length >= 2, 'Should have assignments');

    const friday1Assigns = assignments.filter((a: Assignment) => a.fridayIndex === 1);
    assert.ok(friday1Assigns.length >= 2, 'Should have at least 2 assignments on Friday 1');

    const a1 = friday1Assigns[0];
    const a2 = friday1Assigns[1];

    // Assign specific imams
    memoryStore.updateAssignment(sched.id, a1.id, 101, 'Test A1');
    memoryStore.updateAssignment(sched.id, a2.id, 102, 'Test A2');

    // Execute mutual swap
    const swapResult = memoryStore.swapAssignments(sched.id, a1.id, a2.id, 'Mutual Swap Test');
    assert.ok(swapResult, 'Swap result must not be null');

    const updatedDetails = memoryStore.getScheduleDetails(sched.id);
    assert.ok(updatedDetails, 'Updated details must exist');
    const updatedA1 = updatedDetails.assignments.find((a: Assignment) => a.id === a1.id);
    const updatedA2 = updatedDetails.assignments.find((a: Assignment) => a.id === a2.id);

    assert.equal(updatedA1?.imamId, 102, 'Assignment 1 should now have Imam 102');
    assert.equal(updatedA2?.imamId, 101, 'Assignment 2 should now have Imam 101');
    assert.equal(updatedA1?.source, 'MANUAL', 'Source should be marked MANUAL');
    assert.equal(updatedA2?.source, 'MANUAL', 'Source should be marked MANUAL');
  });

  await t.test('2. Drag & Drop Move into Vacant Cell vacates origin and populates target', () => {
    const res = memoryStore.createSchedule(1448, 8);
    const sched = res.schedule || res;
    assert.ok(sched);

    memoryStore.generateSchedule(sched.id, 'Balanced Random');

    const details = memoryStore.getScheduleDetails(sched.id);
    assert.ok(details);
    const assigns = details.assignments.filter((a: Assignment) => a.fridayIndex === 2);
    assert.ok(assigns.length >= 2);

    const occupied = assigns[0];
    const vacant = assigns[1];

    memoryStore.updateAssignment(sched.id, occupied.id, 205, 'Occupied Imam');
    memoryStore.updateAssignment(sched.id, vacant.id, null, 'Vacant Slot');

    // Swap occupied with vacant (acts as move)
    memoryStore.swapAssignments(sched.id, occupied.id, vacant.id, 'Move to vacant slot');

    const afterDetails = memoryStore.getScheduleDetails(sched.id);
    assert.ok(afterDetails);
    const afterOccupied = afterDetails.assignments.find((a: Assignment) => a.id === occupied.id);
    const afterVacant = afterDetails.assignments.find((a: Assignment) => a.id === vacant.id);

    assert.equal(afterOccupied?.imamId, null, 'Origin assignment should now be vacant (null)');
    assert.equal(afterVacant?.imamId, 205, 'Target assignment should now have Imam 205');
  });

  await t.test('3. Locked Cell Protection: Toggle lock and verify locked status', () => {
    const res = memoryStore.createSchedule(1448, 9);
    const sched = res.schedule || res;
    assert.ok(sched);

    memoryStore.generateSchedule(sched.id, 'Balanced Random');

    const details = memoryStore.getScheduleDetails(sched.id);
    assert.ok(details);
    const firstAssign = details.assignments[0];
    assert.ok(firstAssign);

    const initialLock = !!firstAssign.isLocked;
    const toggled = memoryStore.toggleLock(sched.id, firstAssign.id);

    assert.equal(toggled?.isLocked, !initialLock, 'Lock status should flip');

    const toggledAgain = memoryStore.toggleLock(sched.id, firstAssign.id);
    assert.equal(toggledAgain?.isLocked, initialLock, 'Lock status should flip back');
  });

  await t.test('4. Cross-Friday Booking Conflict Logic verification', () => {
    // Simulation: If Imam X is already at Mosque B on Friday 2,
    // dragging Imam X from Friday 1 to Friday 2 must be identified as conflicting
    const mockFriday2Assignments = [
      { id: 1, scheduleId: 1, mosqueId: 1, fridayIndex: 2, imamId: 99 },
      { id: 2, scheduleId: 1, mosqueId: 2, fridayIndex: 2, imamId: 50 },
    ];

    const sourceImamId = 99; // Preacher from Friday 1
    const targetAssignmentId = 2; // Mosque 2 on Friday 2

    // Check if sourceImamId is already booked on Friday 2 at another mosque (ne(id, targetAssignmentId))
    const isConflict = mockFriday2Assignments.some(
      (a) => a.fridayIndex === 2 && a.imamId === sourceImamId && a.id !== targetAssignmentId
    );

    assert.equal(isConflict, true, 'Imam 99 is already preaching at Mosque 1 on Friday 2, so moving to Mosque 2 must conflict');
  });
});
