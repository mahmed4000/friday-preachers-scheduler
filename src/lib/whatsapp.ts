// رسائل واتساب: بنفتح محادثة جاهزة بالنص، والمسؤول يدوس إرسال.

/** 01xxxxxxxxx → 201xxxxxxxxx */
export function normalizePhone(phone: string): string {
  let p = (phone || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
  p = p.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('0') && p.length === 11) p = `2${p}`;
  if (p.length === 10 && p.startsWith('1')) p = `20${p}`;
  return p;
}

export function isValidPhone(phone: string): boolean {
  return /^20(10|11|12|15)\d{8}$/.test(normalizePhone(phone)) || /^\d{10,15}$/.test(normalizePhone(phone));
}

export function waLink(phone: string, text: string): string {
  const p = normalizePhone(phone);
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}

export function portalUrl(token: string): string {
  return `${location.origin}/p/${token}`;
}
