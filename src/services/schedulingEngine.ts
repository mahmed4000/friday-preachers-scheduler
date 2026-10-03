/**
 * محرك جدولة وتوزيع خطباء الجمعة
 * Friday Preachers Scheduling Engine
 *
 * محرك خوارزمي حتمي وشفاف (Deterministic, Explainable & Testable)
 * يطبق الأولويات الست والقيود الصارمة والتفضيلات وعدالة التوزيع
 */

export type RelationshipType = 'FIXED' | 'PREFERRED' | 'ALLOWED' | 'DISCOURAGED' | 'FORBIDDEN' | 'FLEXIBLE';
export type FixedPattern = 'ALL' | 'FIRST_N' | 'LAST_N' | 'ANY_N' | 'SPECIFIC_FRIDAYS';
export type AssignmentSource = 'FIXED' | 'PREFERENCE' | 'BALANCED' | 'RANDOM' | 'BALANCED_RANDOM' | 'MANUAL' | 'OVERRIDE';
export type ConflictSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface MosqueInput {
  id: number;
  name: string;
  code: string;
  region: string;
  isActive: boolean;
  fixedImamId?: number | null;
  fixedPattern?: FixedPattern | null;
  fixedCount?: number | null;
  specificFridays?: number[] | null; // e.g. [1, 3]
}

export interface ImamInput {
  id: number;
  name: string;
  type: 'FIXED' | 'PARTIAL_FIXED' | 'FLEXIBLE';
  minFridays: number;
  targetFridays: number;
  maxFridays: number;
  isActive: boolean;
  region?: string | null;
}

export interface RuleInput {
  mosqueId: number;
  imamId: number;
  relationshipType: RelationshipType;
  priority: number; // 1 = highest preference
}

export interface AvailabilityInput {
  imamId: number;
  fridayIndex: number; // 1..5
  isAvailable: boolean; // false = unavailable
  reason?: string | null;
}

export interface LockedAssignmentInput {
  fridayIndex: number;
  mosqueId: number;
  imamId: number | null;
  source?: AssignmentSource;
  notes?: string | null;
}

export interface FixedPatternItemInput {
  fridayIndex: number;
  imamId: number;
  sequence?: number;
  notes?: string | null;
}

export interface FixedPatternInput {
  mosqueId: number;
  patternType: 'SAME_ALL' | 'SPLIT_COUNTS' | 'SPECIFIC_FRIDAYS' | 'CUSTOM';
  fridaysCount: number;
  items: FixedPatternItemInput[];
}

export interface SchedulingInput {
  monthName: string;
  hijriYear: number;
  hijriMonth: number;
  fridaysCount: number; // 4 or 5
  mosques: MosqueInput[];
  imams: ImamInput[];
  rules: RuleInput[];
  availabilities: AvailabilityInput[];
  lockedAssignments?: LockedAssignmentInput[];
  fixedPatterns?: FixedPatternInput[];
  seed?: string;
  distributionMethod?: 'Balanced' | 'Random' | 'Balanced Random';
  targetMosqueId?: number; // Optional: redistribute single mosque
  targetFridayIndex?: number; // Optional: redistribute single friday
}

export interface EngineAssignment {
  fridayIndex: number;
  mosqueId: number;
  imamId: number | null;
  source: AssignmentSource;
  isLocked: boolean;
  notes?: string;
}

export interface EngineConflict {
  severity: ConflictSeverity;
  mosqueId?: number;
  fridayIndex?: number;
  imamId?: number;
  ruleCode: string;
  message: string;
  possibleResolutions: string[];
}

export interface SchedulingResult {
  assignments: EngineAssignment[];
  conflicts: EngineConflict[];
  stats: {
    totalAssignments: number;
    filledAssignments: number;
    unfilledAssignments: number;
    fixedCount: number;
    preferenceCount: number;
    balancedCount: number;
    randomCount: number;
    manualCount: number;
    overrideCount: number;
    criticalConflictsCount: number;
    warningConflictsCount: number;
  };
  imamUsage: Record<number, number>; // imamId -> count of assigned fridays
  qualityMetrics: {
    preferenceSatisfactionRate: number; // percentage (0 - 100)
    targetFulfillmentRate: number;
    balanceFairnessScore: number;
  };
}

// Simple seeded pseudo-random number generator for deterministic reproducibility
class SeededRandom {
  private seed: number;

  constructor(seedStr: string = 'FRIDAY-SCHEDULER-V1') {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash << 5) - hash + seedStr.charCodeAt(i);
      hash |= 0;
    }
    this.seed = Math.abs(hash) || 123456789;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

export class SchedulingEngine {
  /**
   * الدالة الرئيسية لتوليد جدول خطباء الجمعة
   */
  public static generate(input: SchedulingInput): SchedulingResult {
    const rng = new SeededRandom(input.seed || `${input.monthName}-${input.hijriYear}-${input.fridaysCount}`);
    const method = input.distributionMethod || 'Balanced Random';

    const activeMosques = input.mosques.filter((m) => m.isActive);
    const activeImams = input.imams.filter((i) => i.isActive);
    const imamMap = new Map<number, ImamInput>(activeImams.map((i) => [i.id, i]));
    const mosqueMap = new Map<number, MosqueInput>(activeMosques.map((m) => [m.id, m]));

    // Quick lookup for unavailability: "imamId:fridayIndex" -> boolean (false = unavailable)
    const unavailableSet = new Set<string>();
    for (const a of input.availabilities) {
      if (!a.isAvailable) {
        unavailableSet.add(`${a.imamId}:${a.fridayIndex}`);
      }
    }

    // Rules map: "mosqueId:imamId" -> RuleInput
    const rulesMap = new Map<string, RuleInput>();
    for (const r of input.rules) {
      rulesMap.set(`${r.mosqueId}:${r.imamId}`, r);
    }

    // Locked map: "mosqueId:fridayIndex" -> LockedAssignmentInput
    const lockedMap = new Map<string, LockedAssignmentInput>();
    if (input.lockedAssignments) {
      for (const l of input.lockedAssignments) {
        lockedMap.set(`${l.mosqueId}:${l.fridayIndex}`, l);
      }
    }

    // Grid state: assignments[fridayIndex][mosqueId] = EngineAssignment
    const assignmentsGrid = new Map<string, EngineAssignment>();
    const imamFridaysCount: Record<number, number> = {};
    for (const imam of activeImams) {
      imamFridaysCount[imam.id] = 0;
    }

    // Track which imam is preaching in which mosque on each friday: "imamId:fridayIndex" -> mosqueId
    const fridayImamBooking = new Map<string, number>();
    const conflicts: EngineConflict[] = [];

    // -------------------------------------------------------------
    // المرحلة 1: معالجة التعيينات المقفولة مسبقاً (Pre-existing Locked)
    // -------------------------------------------------------------
    for (const [key, locked] of lockedMap.entries()) {
      assignmentsGrid.set(key, {
        fridayIndex: locked.fridayIndex,
        mosqueId: locked.mosqueId,
        imamId: locked.imamId,
        source: locked.source || 'MANUAL',
        isLocked: true,
        notes: locked.notes || undefined,
      });

      if (locked.imamId) {
        imamFridaysCount[locked.imamId] = (imamFridaysCount[locked.imamId] || 0) + 1;
        fridayImamBooking.set(`${locked.imamId}:${locked.fridayIndex}`, locked.mosqueId);
      }
    }

    // Helper: is cell targeted for redistribution?
    const isTargetCell = (mosqueId: number, fridayIndex: number): boolean => {
      if (input.targetMosqueId && input.targetMosqueId !== mosqueId) return false;
      if (input.targetFridayIndex && input.targetFridayIndex !== fridayIndex) return false;
      return true;
    };

    // -------------------------------------------------------------
    // المرحلة 2: تطبيق الثوابت والأنماط المخصصة (Fixed Assignment Patterns)
    // -------------------------------------------------------------
    const patternMosqueIds = new Set<number>();

    // 2.1. أنماط التثبيت المعتمدة للشهر الحالي (Fixed Patterns per Month & Mosque)
    if (input.fixedPatterns && input.fixedPatterns.length > 0) {
      for (const pattern of input.fixedPatterns) {
        patternMosqueIds.add(pattern.mosqueId);
        const mosque = mosqueMap.get(pattern.mosqueId);
        if (!mosque || !mosque.isActive) continue;

        for (const item of pattern.items) {
          const f = item.fridayIndex;
          if (f > input.fridaysCount) continue; // Skip fridays beyond actual month count (e.g. 5 in 4-friday month)

          const cellKey = `${pattern.mosqueId}:${f}`;
          if (assignmentsGrid.has(cellKey)) {
            continue; // Already locked or manually set
          }
          if (!isTargetCell(pattern.mosqueId, f)) {
            continue;
          }

          const imam = imamMap.get(item.imamId);
          if (!imam || !imam.isActive) {
            conflicts.push({
              severity: 'CRITICAL',
              mosqueId: pattern.mosqueId,
              fridayIndex: f,
              imamId: item.imamId,
              ruleCode: 'FIXED_IMAM_INACTIVE',
              message: `الخطيب المثبت لمسجد (${mosque.name}) في الجمعة (${f}) غير نشط أو غير موجود.`,
              possibleResolutions: ['تعديل نمط التثبيت واختيار خطيب نشط', 'إلغاء التثبيت مؤقتاً'],
            });
            continue;
          }

          // Hard constraint 1: Unavailability / Leave
          if (unavailableSet.has(`${imam.id}:${f}`)) {
            conflicts.push({
              severity: 'CRITICAL',
              mosqueId: pattern.mosqueId,
              fridayIndex: f,
              imamId: imam.id,
              ruleCode: 'FIXED_UNAVAILABLE',
              message: `تعارض تثبيت: الشيخ (${imam.name}) مثبت لمسجد (${mosque.name}) في الجمعة (${f}) لكنه مسجل باعتذار رسمي / غير متاح.`,
              possibleResolutions: ['تعديل التثبيت لجمعة أخرى', 'تكليف خطيب بديل لهذه الجمعة'],
            });
            continue;
          }

          // Hard constraint 2: Double booking on the same Friday in another mosque
          if (fridayImamBooking.has(`${imam.id}:${f}`)) {
            const bookedMosqueId = fridayImamBooking.get(`${imam.id}:${f}`);
            const bookedMosque = mosqueMap.get(bookedMosqueId!);
            conflicts.push({
              severity: 'CRITICAL',
              mosqueId: pattern.mosqueId,
              fridayIndex: f,
              imamId: imam.id,
              ruleCode: 'FIXED_DOUBLE_BOOKING',
              message: `تعارض تثبيت مزدوج: الشيخ (${imam.name}) مثبت في أكثر من مسجد في الجمعة (${f}) — (${bookedMosque?.name || 'مسجد آخر'}) و (${mosque.name}).`,
              possibleResolutions: ['تدخل مدير الجدول وتعديل أحد المسجدين يدوياً'],
            });
            continue;
          }

          // Hard constraint 3: Forbidden Rule
          const rule = rulesMap.get(`${mosque.id}:${imam.id}`);
          if (rule && rule.relationshipType === 'FORBIDDEN') {
            conflicts.push({
              severity: 'CRITICAL',
              mosqueId: pattern.mosqueId,
              fridayIndex: f,
              imamId: imam.id,
              ruleCode: 'FIXED_FORBIDDEN',
              message: `تعارض قاعدة: الشيخ (${imam.name}) محظور من الخطابة في مسجد (${mosque.name}) حسب مصفوفة القواعد.`,
              possibleResolutions: ['تعديل مصفوفة القواعد أو استبدال الخطيب'],
            });
            continue;
          }

          // All checks passed -> Assign strictly as FIXED & LOCKED
          assignmentsGrid.set(cellKey, {
            fridayIndex: f,
            mosqueId: pattern.mosqueId,
            imamId: imam.id,
            source: 'FIXED',
            isLocked: true,
            notes: item.notes || `مثبت بالنمط (${pattern.patternType}) للجمعة (${f})`,
          });
          imamFridaysCount[imam.id] = (imamFridaysCount[imam.id] || 0) + 1;
          fridayImamBooking.set(`${imam.id}:${f}`, pattern.mosqueId);
        }
      }
    }

    // 2.2. التوافق العكسي مع الثوابت القديمة (Legacy Mosque Fixed Imam)
    for (const mosque of activeMosques) {
      if (patternMosqueIds.has(mosque.id) || !mosque.fixedImamId) continue;
      const fixedImam = imamMap.get(mosque.fixedImamId);
      if (!fixedImam) continue;

      const pattern = mosque.fixedPattern || 'ALL';
      const count = mosque.fixedCount || input.fridaysCount;

      for (let f = 1; f <= input.fridaysCount; f++) {
        const cellKey = `${mosque.id}:${f}`;
        if (assignmentsGrid.has(cellKey)) {
          continue;
        }
        if (!isTargetCell(mosque.id, f)) {
          continue;
        }

        let isFixedThisFriday = false;
        if (pattern === 'ALL') {
          isFixedThisFriday = true;
        } else if (pattern === 'FIRST_N' && f <= count) {
          isFixedThisFriday = true;
        } else if (pattern === 'LAST_N' && f > input.fridaysCount - count) {
          isFixedThisFriday = true;
        } else if (pattern === 'SPECIFIC_FRIDAYS' && mosque.specificFridays?.includes(f)) {
          isFixedThisFriday = true;
        } else if (pattern === 'ANY_N') {
          const currentCount = imamFridaysCount[fixedImam.id] || 0;
          if (currentCount < count) {
            isFixedThisFriday = true;
          }
        }

        if (isFixedThisFriday) {
          const isUnavailable = unavailableSet.has(`${fixedImam.id}:${f}`);
          const isAlreadyBooked = fridayImamBooking.has(`${fixedImam.id}:${f}`);

          if (!isUnavailable && !isAlreadyBooked) {
            assignmentsGrid.set(cellKey, {
              fridayIndex: f,
              mosqueId: mosque.id,
              imamId: fixedImam.id,
              source: 'FIXED',
              isLocked: true,
              notes: `ثابت وفق نمط (${pattern})`,
            });
            imamFridaysCount[fixedImam.id] = (imamFridaysCount[fixedImam.id] || 0) + 1;
            fridayImamBooking.set(`${fixedImam.id}:${f}`, mosque.id);
          }
        }
      }
    }

    // -------------------------------------------------------------
    // المرحلة 3: التوزيع الآلي للمساجد الشاغرة (Flexible & Preference Scheduling)
    // -------------------------------------------------------------
    // Order mosques by number of constraints/preferences (Most constrained first)
    const sortedMosques = [...activeMosques].sort((a, b) => {
      const aRules = input.rules.filter((r) => r.mosqueId === a.id);
      const bRules = input.rules.filter((r) => r.mosqueId === b.id);
      return bRules.length - aRules.length;
    });

    for (let f = 1; f <= input.fridaysCount; f++) {
      for (const mosque of sortedMosques) {
        const cellKey = `${mosque.id}:${f}`;
        if (assignmentsGrid.has(cellKey)) {
          continue; // Already assigned
        }
        if (!isTargetCell(mosque.id, f)) {
          continue;
        }

        // Find candidate imams for this mosque on this friday
        interface CandidateEvaluation {
          imam: ImamInput;
          rule?: RuleInput;
          isPreferred: boolean;
          priority: number;
          isDiscouraged: boolean;
          score: number;
          assignedCount: number;
          deficitToTarget: number;
        }

        const candidates: CandidateEvaluation[] = [];

        for (const imam of activeImams) {
          // Hard constraint 1: Unavailable
          if (unavailableSet.has(`${imam.id}:${f}`)) {
            continue;
          }

          // Hard constraint 2: Already booked on this friday in another mosque
          if (fridayImamBooking.has(`${imam.id}:${f}`)) {
            continue;
          }

          // Check rule with this mosque
          const rule = rulesMap.get(`${mosque.id}:${imam.id}`);

          // Hard constraint 3: FORBIDDEN
          if (rule && rule.relationshipType === 'FORBIDDEN') {
            continue;
          }

          // Hard constraint 4: Maximum fridays reached
          const currentCount = imamFridaysCount[imam.id] || 0;
          if (currentCount >= imam.maxFridays) {
            continue;
          }

          const isPreferred = rule?.relationshipType === 'PREFERRED';
          const isDiscouraged = rule?.relationshipType === 'DISCOURAGED';
          const priority = rule?.priority || 999;
          const deficitToTarget = imam.targetFridays - currentCount;

          // Scoring calculation:
          // Higher score = better candidate
          let score = 0;

          if (isPreferred) {
            // Highly reward preferred imams (bonus inversely proportional to priority rank)
            score += 1000 - Math.min(priority * 20, 500);
          } else if (isDiscouraged) {
            // Strong penalty for discouraged imams
            score -= 800;
          } else {
            // Neutral / Allowed / Flexible
            score += 100;
          }

          if (method === 'Balanced' || method === 'Balanced Random') {
            // Fairness component: Heavily reward imams under target and under minimum
            if (currentCount < imam.minFridays) {
              score += 400 * (imam.minFridays - currentCount);
            }
            score += 150 * deficitToTarget;
          }

          if (method === 'Random' || method === 'Balanced Random') {
            // Small tie-breaking noise from seeded random
            const noise = (rng.next() - 0.5) * (method === 'Random' ? 300 : 25);
            score += noise;
          }

          candidates.push({
            imam,
            rule,
            isPreferred,
            priority,
            isDiscouraged,
            score,
            assignedCount: currentCount,
            deficitToTarget,
          });
        }

        if (candidates.length > 0) {
          // Sort candidates by descending score
          candidates.sort((a, b) => b.score - a.score);
          const best = candidates[0];

          let source: AssignmentSource = 'BALANCED_RANDOM';
          if (best.isPreferred) {
            source = 'PREFERENCE';
          } else if (method === 'Balanced') {
            source = 'BALANCED';
          } else if (method === 'Random') {
            source = 'RANDOM';
          }

          assignmentsGrid.set(cellKey, {
            fridayIndex: f,
            mosqueId: mosque.id,
            imamId: best.imam.id,
            source,
            isLocked: false,
            notes: best.isPreferred ? `تفضيل رقم (${best.priority}) للمسجد` : undefined,
          });

          imamFridaysCount[best.imam.id] = (imamFridaysCount[best.imam.id] || 0) + 1;
          fridayImamBooking.set(`${best.imam.id}:${f}`, mosque.id);
        } else {
          // No candidate found: Unassigned cell
          assignmentsGrid.set(cellKey, {
            fridayIndex: f,
            mosqueId: mosque.id,
            imamId: null,
            source: 'BALANCED_RANDOM',
            isLocked: false,
            notes: 'تعذر إيجاد خطيب مؤهل وفق القيود الحالية',
          });
        }
      }
    }

    // -------------------------------------------------------------
    // المرحلة 4: تدقيق التعارضات والتحذيرات (Conflict Detection)
    // -------------------------------------------------------------
    // 1. Unfilled Mosques
    for (const [key, assignment] of assignmentsGrid.entries()) {
      if (!assignment.imamId) {
        const [mIdStr, fIdxStr] = key.split(':');
        const mosqueId = Number(mIdStr);
        const fridayIndex = Number(fIdxStr);
        const mosque = mosqueMap.get(mosqueId);

        conflicts.push({
          severity: 'CRITICAL',
          mosqueId,
          fridayIndex,
          ruleCode: 'EMPTY_MOSQUE',
          message: `المسجد (${mosque?.name || mosqueId}) بدون خطيب في الجمعة (${fridayIndex})`,
          possibleResolutions: [
            'تجاوز الحد الأقصى لأحد الخطباء المرنين المؤهلين',
            'السماح بخطيب غير مفضل مؤقتاً',
            'تعيين خطيب يدوياً وتأكيد استثناء إداري',
          ],
        });
      }
    }

    // 2. Forbidden Assignments
    for (const assignment of assignmentsGrid.values()) {
      if (!assignment.imamId) continue;
      const rule = rulesMap.get(`${assignment.mosqueId}:${assignment.imamId}`);
      if (rule && rule.relationshipType === 'FORBIDDEN') {
        const mosque = mosqueMap.get(assignment.mosqueId);
        const imam = imamMap.get(assignment.imamId);
        conflicts.push({
          severity: 'CRITICAL',
          mosqueId: assignment.mosqueId,
          fridayIndex: assignment.fridayIndex,
          imamId: assignment.imamId,
          ruleCode: 'FORBIDDEN_IMAM',
          message: `تم تعيين الخطيب (${imam?.name}) في مسجد (${mosque?.name}) في الجمعة (${assignment.fridayIndex}) رغم وجود قيد منع (FORBIDDEN)`,
          possibleResolutions: [
            'استبدال الخطيب بخطيب مسموح أو مفضل',
            'تعديل قاعدة المنع في بروفايل المسجد إذا زال سبب المنع',
          ],
        });
      }
    }

    // 3. Unavailable Imam assigned
    for (const assignment of assignmentsGrid.values()) {
      if (!assignment.imamId) continue;
      if (unavailableSet.has(`${assignment.imamId}:${assignment.fridayIndex}`)) {
        const imam = imamMap.get(assignment.imamId);
        const mosque = mosqueMap.get(assignment.mosqueId);
        conflicts.push({
          severity: 'CRITICAL',
          mosqueId: assignment.mosqueId,
          fridayIndex: assignment.fridayIndex,
          imamId: assignment.imamId,
          ruleCode: 'IMAM_UNAVAILABLE',
          message: `الخطيب (${imam?.name}) غير متاح في الجمعة (${assignment.fridayIndex}) وتم تعيينه في مسجد (${mosque?.name})`,
          possibleResolutions: [
            'إسناد المسجد لخطيب بديل متاح',
            'تحديث جدول عدم التوفر للخطيب في حال أصبح متاحاً',
          ],
        });
      }
    }

    // 4. Over Target / Under Minimum Warnings
    for (const imam of activeImams) {
      const count = imamFridaysCount[imam.id] || 0;
      if (count < imam.minFridays) {
        conflicts.push({
          severity: 'WARNING',
          imamId: imam.id,
          ruleCode: 'UNDER_MINIMUM',
          message: `الخطيب (${imam.name}) حصل على (${count}) جمعات وهو أقل من الحد الأدنى المطلوب (${imam.minFridays})`,
          possibleResolutions: [
            'إعادة توزيع بعض الجمعات الشاغرة لصالحه',
            'تعديل الحد الأدنى للخطيب في بياناته',
          ],
        });
      } else if (count > imam.maxFridays) {
        conflicts.push({
          severity: 'WARNING',
          imamId: imam.id,
          ruleCode: 'OVER_MAXIMUM',
          message: `الخطيب (${imam.name}) تم تعيينه في (${count}) جمعات متجاوزاً حده الأقصى (${imam.maxFridays})`,
          possibleResolutions: [
            'تسجيل استثناء إداري معتمد (Override)',
            'توزيع الجمعات الزائدة على خطباء آخرين',
          ],
        });
      }
    }

    // -------------------------------------------------------------
    // المرحلة 5: حساب المقاييس والإحصائيات
    // -------------------------------------------------------------
    const allAssignmentsList = Array.from(assignmentsGrid.values());
    const totalAssignments = allAssignmentsList.length;
    const filledAssignments = allAssignmentsList.filter((a) => a.imamId !== null).length;
    const unfilledAssignments = totalAssignments - filledAssignments;

    let fixedCount = 0;
    let preferenceCount = 0;
    let balancedCount = 0;
    let randomCount = 0;
    let manualCount = 0;
    let overrideCount = 0;

    let totalPreferredRequests = 0;
    let satisfiedPreferred = 0;

    for (const a of allAssignmentsList) {
      if (a.source === 'FIXED') fixedCount++;
      else if (a.source === 'PREFERENCE') preferenceCount++;
      else if (a.source === 'BALANCED') balancedCount++;
      else if (a.source === 'RANDOM') randomCount++;
      else if (a.source === 'BALANCED_RANDOM') balancedCount++;
      else if (a.source === 'MANUAL') manualCount++;
      else if (a.source === 'OVERRIDE') overrideCount++;

      // Check if mosque has preferences and if this was one
      const mosqueRules = input.rules.filter((r) => r.mosqueId === a.mosqueId && r.relationshipType === 'PREFERRED');
      if (mosqueRules.length > 0) {
        totalPreferredRequests++;
        if (a.imamId && mosqueRules.some((r) => r.imamId === a.imamId)) {
          satisfiedPreferred++;
        }
      }
    }

    const preferenceSatisfactionRate = totalPreferredRequests > 0
      ? Math.round((satisfiedPreferred / totalPreferredRequests) * 100)
      : 100;

    let totalTargetDeficit = 0;
    let totalTargetNeeded = 0;
    for (const imam of activeImams) {
      totalTargetNeeded += imam.targetFridays;
      const assigned = imamFridaysCount[imam.id] || 0;
      totalTargetDeficit += Math.abs(imam.targetFridays - assigned);
    }
    const targetFulfillmentRate = totalTargetNeeded > 0
      ? Math.max(0, Math.round(100 - (totalTargetDeficit / totalTargetNeeded) * 50))
      : 100;

    return {
      assignments: allAssignmentsList,
      conflicts,
      stats: {
        totalAssignments,
        filledAssignments,
        unfilledAssignments,
        fixedCount,
        preferenceCount,
        balancedCount,
        randomCount,
        manualCount,
        overrideCount,
        criticalConflictsCount: conflicts.filter((c) => c.severity === 'CRITICAL').length,
        warningConflictsCount: conflicts.filter((c) => c.severity === 'WARNING').length,
      },
      imamUsage: imamFridaysCount,
      qualityMetrics: {
        preferenceSatisfactionRate,
        targetFulfillmentRate,
        balanceFairnessScore: Math.max(0, 100 - conflicts.length * 5),
      },
    };
  }
}
