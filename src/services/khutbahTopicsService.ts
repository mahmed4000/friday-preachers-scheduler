/**
 * خدمة موضوعات خطب الجمعة والتوجيه الدعوي المركزي
 * Khutbah Topics Service
 */

export interface KhutbahTopicItem {
  fridayIndex: number;
  title: string;
  elements: string;
  hadithReference: string;
  durationMinutes: number;
}

export const DEFAULT_KHUTBAH_TOPICS: Record<number, { title: string; elements: string; hadith: string }> = {
  1: {
    title: 'بر الوالدين وأثره في تماسك الأسرة واستقرار المجتمع',
    elements: 'مكانة الوالدين في القرآن والسنة · صور الإحسان العملي في زماننا · عواقب العقوق الدنيوية والأخروية',
    hadith: 'رِضَى الرَّبِّ فِي رِضَى الْوَالِدِ، وَسَخَطُ الرَّبِّ فِي سَخَطِ الْوَالِدِ (رواه الترمذي)',
  },
  2: {
    title: 'الأمانة في المعاملات والمسؤوليات الوظيفية والمجتمعية',
    elements: 'مفهوم الأمانة الشامل في الإسلام · التحذير من الغش والتطفيف وخيانة العهد · ثمار الأمانة في بركة الرزق',
    hadith: 'لا إِيمَانَ لِمَنْ لا أَمَانَةَ لَهُ، وَلا دِينَ لِمَنْ لا عَهْدَ لَهُ (رواه أحمد)',
  },
  3: {
    title: 'الاستقامة وحسن الخلق: مفتاح القلوب وأثقل ما في الميزان',
    elements: 'حقيقة الاستقامة على أمر الله · أثر الكلمة الطيبة وحسن الجوار · كيف يجسد المسلم أخلاقه في الشارع والعمل',
    hadith: 'إِنَّ مِنْ أَحَبِّكُمْ إِلَيَّ وَأَقْرَبِكُمْ مِنِّي مَجْلِسًا يَوْمَ الْقِيَامَةِ أَحَاسِنَكُمْ أَخْلاقًا (رواه الترمذي)',
  },
  4: {
    title: 'أهمية الوقت وقيمة العمر والتحذير من التسويف والغفلة',
    elements: 'نعمة الفراغ والصحة · اغتنام مواسم الطاعات · محاسبة النفس والمبادرة بالعمل الصالح قبل فوات الأوان',
    hadith: 'نِعْمَتَانِ مَغْبُونٌ فِيهِمَا كَثِيرٌ مِنَ النَّاسِ: الصِّحَّةُ وَالْفَرَاغُ (رواه البخاري)',
  },
  5: {
    title: 'التكافل المجتمعي ورعاية الفقراء والأيتام وإغاثة الملهوف',
    elements: 'المسلم للمسلم كالبنيان يشد بعضه بعضاً · فضل الصدقة الخفية وإطعام الطعام · ثواب كفالة اليتيم في الجنة',
    hadith: 'أَنَا وَكَافِلُ الْيَتِيمِ فِي الْجَنَّةِ هَكَذَا (وأشار بالسبابة والوسطى)',
  },
};

export const POPULAR_SUGGESTED_TOPICS = [
  'بر الوالدين وأثره في تماسك الأسرة واستقرار المجتمع',
  'الأمانة في المعاملات والمسؤوليات الوظيفية والمجتمعية',
  'الاستقامة وحسن الخلق: مفتاح القلوب وأثقل ما في الميزان',
  'أهمية الوقت وقيمة العمر والتحذير من التسويف والغفلة',
  'التكافل المجتمعي ورعاية الفقراء والأيتام وإغاثة الملهوف',
  'فضل الصلاة في بيوت الله وآداب المسجد',
  'نعمة الأمن والأمان وواجب المحافظة على الوطن',
  'الوسطية والاعتدال في الإسلام ومحاربة الغلو والتشدد',
  'حقوق الجار وصلة الأرحام في ضوء الكتاب والسنة',
  'أثر الكلمة الطيبة والتحذير من آفات اللسان والغيبة',
];

export function loadScheduleKhutbahTopics(
  scheduleId?: number,
  hijriYear?: number,
  hijriMonth?: number,
  fridaysList?: { fridayIndex: number; ordinalName?: string }[]
): Record<number, KhutbahTopicItem> {
  const result: Record<number, KhutbahTopicItem> = {};

  // Try loading from scheduleId
  let stored: Record<number, any> | null = null;
  if (scheduleId) {
    try {
      const raw = localStorage.getItem(`sharia_khutbah_topics_${scheduleId}`);
      if (raw) stored = JSON.parse(raw);
    } catch {}
  }

  // Try fallback to year_month
  if (!stored && hijriYear && hijriMonth) {
    try {
      const raw = localStorage.getItem(`sharia_khutbah_topics_${hijriYear}_${hijriMonth}`);
      if (raw) stored = JSON.parse(raw);
    } catch {}
  }

  const indices = fridaysList ? fridaysList.map((f) => f.fridayIndex) : [1, 2, 3, 4, 5];

  indices.forEach((fIndex) => {
    if (stored && stored[fIndex]) {
      result[fIndex] = {
        fridayIndex: fIndex,
        title: stored[fIndex].title || DEFAULT_KHUTBAH_TOPICS[fIndex]?.title || `خطبة الجمعة ${fIndex}`,
        elements: stored[fIndex].elements || DEFAULT_KHUTBAH_TOPICS[fIndex]?.elements || '',
        hadithReference: stored[fIndex].hadithReference || DEFAULT_KHUTBAH_TOPICS[fIndex]?.hadith || '',
        durationMinutes: stored[fIndex].durationMinutes || 20,
      };
    } else {
      const def = DEFAULT_KHUTBAH_TOPICS[fIndex] || {
        title: `خطبة الجمعة المباركة (${fIndex})`,
        elements: 'عناصر الخطبة والتوجيه الدعوي المعتمد',
        hadith: 'حديث شريف في فضائل العمل الصالح',
      };
      result[fIndex] = {
        fridayIndex: fIndex,
        title: def.title,
        elements: def.elements,
        hadithReference: def.hadith,
        durationMinutes: 20,
      };
    }
  });

  return result;
}

export function saveScheduleKhutbahTopics(
  scheduleId?: number,
  hijriYear?: number,
  hijriMonth?: number,
  topics?: Record<number, KhutbahTopicItem>
) {
  if (!topics) return;
  try {
    if (scheduleId) {
      localStorage.setItem(`sharia_khutbah_topics_${scheduleId}`, JSON.stringify(topics));
    }
    if (hijriYear && hijriMonth) {
      localStorage.setItem(`sharia_khutbah_topics_${hijriYear}_${hijriMonth}`, JSON.stringify(topics));
    }
    window.dispatchEvent(new Event('khutbah_topics_updated'));
  } catch (err) {
    console.error('Error saving khutbah topics:', err);
  }
}

export function getKhutbahTopic(
  fridayIndex: number,
  scheduleId?: number,
  assignmentId?: number,
  hijriYear?: number,
  hijriMonth?: number
): string {
  // 1. Assignment specific custom topic
  if (assignmentId) {
    try {
      const custom = localStorage.getItem(`sharia_assignment_topic_${assignmentId}`);
      if (custom && custom.trim()) return custom.trim();
    } catch {}
  }

  // 2. Schedule specific topic
  if (scheduleId) {
    try {
      const raw = localStorage.getItem(`sharia_khutbah_topics_${scheduleId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed[fridayIndex]?.title) return parsed[fridayIndex].title;
      }
    } catch {}
  }

  // 3. Year / Month topic
  if (hijriYear && hijriMonth) {
    try {
      const raw = localStorage.getItem(`sharia_khutbah_topics_${hijriYear}_${hijriMonth}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed[fridayIndex]?.title) return parsed[fridayIndex].title;
      }
    } catch {}
  }

  // 4. Default
  return DEFAULT_KHUTBAH_TOPICS[fridayIndex]?.title || 'فضل الاستقامة ورعاية الأمانة في المعاملات';
}

export function setAssignmentCustomKhutbahTopic(assignmentId: number, topic: string) {
  try {
    localStorage.setItem(`sharia_assignment_topic_${assignmentId}`, topic.trim());
    window.dispatchEvent(new Event('khutbah_topics_updated'));
  } catch (err) {
    console.error('Error saving assignment custom topic:', err);
  }
}
