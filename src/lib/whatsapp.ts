export interface MessageTemplateParams {
  recipientName: string;
  recipientType: 'MOSQUE' | 'IMAM';
  monthName: string;
  hijriYear: number;
  fridaysList: { fridayIndex: number; dateStr: string; entityName: string }[];
}

export function generateWhatsAppMessage(params: MessageTemplateParams): string {
  const { recipientName, recipientType, monthName, hijriYear, fridaysList } = params;

  if (recipientType === 'IMAM') {
    const listText = fridaysList
      .map((f) => `• الجمعة ${f.fridayIndex} (${f.dateStr}): ${f.entityName}`)
      .join('\n');

    return `السلام عليكم ورحمة الله وبركاته

فضيلة الشيخ / ${recipientName} حفظكم الله

نرفق لفضيلتكم بيان تكليفات خطب الجمعة لشهر ${monthName} لعام ${hijriYear} هـ:

${listText}

نسأل الله لكم التوفيق والسداد والقبول، وجزاكم الله عنا وعن المسلمين خير الجزاء.

الجمعية الشرعية — أمانة شؤون المساجد والخطباء`;
  } else {
    const listText = fridaysList
      .map((f) => `• الجمعة ${f.fridayIndex} (${f.dateStr}): ${f.entityName}`)
      .join('\n');

    return `السلام عليكم ورحمة الله وبركاته

الإخوة الكرام في إدارة / ${recipientName} المحترمين

نرفق لكم جدول خطباء الجمعة المعتمد لشهر ${monthName} لعام ${hijriYear} هـ:

${listText}

شاكرين لكم حسن تعاونكم الدائم في خدمة بيوت الله.

الجمعية الشرعية — أمانة شؤون المساجد والخطباء`;
  }
}

export function buildWhatsAppLink(phone: string, text: string): string {
  // Normalize phone number (e.g. 0501112233 -> 966501112233 or international format)
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.startsWith('05')) {
    clean = '966' + clean.slice(1);
  } else if (clean.startsWith('00')) {
    clean = clean.slice(2);
  }
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
}
