import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore } from '../src/server/memoryStore.ts';

test('Mosque Rules and Patterns In-Memory Resilience Validation', async (t) => {
  await t.test('1. upsertRule creates preferred rule in memoryStore', () => {
    const rule = memoryStore.upsertRule({
      mosqueId: 12,
      imamId: 50,
      relationshipType: 'PREFERRED',
      priority: 1,
      notes: 'Test preferred preacher'
    });

    assert.ok(rule, 'Rule should be returned');
    assert.equal(rule.mosqueId, 12);
    assert.equal(rule.imamId, 50);
    assert.equal(rule.relationshipType, 'PREFERRED');

    const rules = memoryStore.getRules();
    const found = rules.find((r: any) => r.mosqueId === 12 && r.imamId === 50);
    assert.ok(found, 'Rule should be in memoryRules');
    assert.equal(found.relationshipType, 'PREFERRED');
  });

  await t.test('2. upsertRule updates existing rule to FORBIDDEN in memoryStore', () => {
    const updatedRule = memoryStore.upsertRule({
      mosqueId: 12,
      imamId: 50,
      relationshipType: 'FORBIDDEN',
      priority: 1,
      notes: 'Updated to forbidden'
    });

    assert.equal(updatedRule.relationshipType, 'FORBIDDEN');
    const rules = memoryStore.getRules();
    const found = rules.find((r: any) => r.mosqueId === 12 && r.imamId === 50);
    assert.equal(found?.relationshipType, 'FORBIDDEN');
  });

  await t.test('3. deleteRule removes rule from memoryStore', () => {
    const rules = memoryStore.getRules();
    const found = rules.find((r: any) => r.mosqueId === 12 && r.imamId === 50);
    assert.ok(found);

    const deleted = memoryStore.deleteRule(found.id);
    assert.equal(deleted, true);

    const rulesAfter = memoryStore.getRules();
    const foundAfter = rulesAfter.find((r: any) => r.id === found.id);
    assert.equal(foundAfter, undefined, 'Rule should no longer exist');
  });

  await t.test('4. saveFixedPattern and getFixedPatterns work in memoryStore', () => {
    const res = memoryStore.saveFixedPattern(12, {
      hijriYear: 1448,
      hijriMonth: 9,
      patternType: 'SAME_ALL',
      fridaysCount: 4,
      items: [
        { fridayIndex: 1, imamId: 54 },
        { fridayIndex: 2, imamId: 54 },
        { fridayIndex: 3, imamId: 54 },
        { fridayIndex: 4, imamId: 54 },
      ]
    });

    assert.ok(res.success);
    assert.ok(res.patternId > 0);

    const pattern = memoryStore.getFixedPatterns(12, 1448, 9);
    assert.equal(pattern.exists, true);
    assert.equal(pattern.pattern.patternType, 'SAME_ALL');
    assert.equal(pattern.pattern.items.length, 4);
    assert.equal(pattern.pattern.items[0].imamId, 54);
  });
});
