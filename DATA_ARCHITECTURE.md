# البنية المعمارية للبيانات والمخطط العلائقي (Data Architecture Specification)
**المشروع:** منظّم خطباء الجمعة — Friday Preachers Scheduler  
**المعيار:** PostgreSQL العلائقية مع Drizzle ORM

---

## 1. الكيانات الجوهرية والعلاقات العلائقية (Core Entity Relationship)

```
[ countries ]
      │ 1
      ▼ N
[ administrative_units ] (المحافظات والمراكز والأحياء)
      │ 1
      ├───────────────────────────────┐
      ▼ N                             ▼ N
  [ mosques ]                     [ imams ]
      │ 1                             │ 1
      ├──────────────┐                ├──────────────┐
      ▼ N            ▼ N              ▼ N            ▼ N
[ mosque_rules ] [ fixed_patterns ] [ rules ]  [ imam_availabilities ]
      │              │
      │              ▼ N
      │      [ pattern_items ]
      ▼ N            │
[ assignments ] ◄────┘
      ▲
      │ N
      │ 1
[ monthly_schedules ]
      │ 1
      ▼ N
  [ fridays ]
```

---

## 2. النزاهة الهندسية والقيود الصلبة (Database Invariants & Constraints)

1. **التعيين الفريد في الجمعة الواحدة (No Double Booking):**
   * قيد فريد يمنع إسناد نفس الخطيب في نفس الجمعة لأكثر من مسجد:
     `UNIQUE(schedule_id, friday_index, imam_id)` مع استثناء `imam_id IS NULL`.
2. **تكليف واحد لكل مسجد في الجمعة (One Imam Per Mosque Per Friday):**
   * قيد فريد يمنع وجود أكثر من تكليف لنفس المسجد في نفس الجمعة:
     `UNIQUE(schedule_id, friday_index, mosque_id)`.
3. **تكامل المفاتيح الأجنبية (Cascading Integrity):**
   * عند حذف مسجد أو جدول شهري، تحذف تكليفاته وقواعده المرتبطة تلقائياً (`ON DELETE CASCADE`).
   * عند حذف خطيب، تتحول حقول `imam_id` في جدول التكليفات إلى `NULL` دون حذف سجل التكليف (`ON DELETE SET NULL`) للحفاظ على التكليف شاغراً لإعادة التوزيع.

---
*نهاية وثيقة البنية المعمارية للبيانات.*
