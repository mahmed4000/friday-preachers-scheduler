import { Request, Response, NextFunction } from 'express';
import { getSupabaseClient } from '../lib/supabaseClient.ts';
import { requestContext } from '../server/requestContext.ts';

export interface AuthRequest extends Request {
  user?: { uid: string; email: string; name?: string };
}

// قائمة اختيارية بإيميلات المسؤولين (مفصولة بفاصلة). لو فاضية، أي حساب مسجّل في Supabase Auth يعتبر مسؤول،
// ولذلك لازم التسجيل الذاتي يكون مقفول في إعدادات Supabase.
const allowedEmails = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// كاش قصير للتوكنات اللي اتأكدنا منها علشان ما نسألش Supabase مع كل طلب
const verified = new Map<string, { user: AuthRequest['user']; expires: number }>();

export async function verifyToken(token: string): Promise<AuthRequest['user'] | null> {
  const cached = verified.get(token);
  if (cached && cached.expires > Date.now()) return cached.user;

  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  const email = (data.user.email || '').toLowerCase();
  if (allowedEmails.length && !allowedEmails.includes(email)) return null;

  const user = { uid: data.user.id, email, name: (data.user.user_metadata as any)?.name };
  verified.set(token, { user, expires: Date.now() + 60_000 });
  if (verified.size > 200) verified.clear();
  return user;
}

/** يمنع أي طلب من غير جلسة مسؤول صالحة. */
export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: 'غير مصرح: يرجى تسجيل الدخول أولاً' });
  }
  try {
    const user = await verifyToken(token);
    if (!user) return res.status(401).json({ error: 'جلسة العمل غير صالحة أو منتهية' });
    req.user = user;
    requestContext.run({ token }, () => next());
  } catch (err) {
    console.error('Auth verification failed:', err);
    return res.status(401).json({ error: 'تعذر التحقق من جلسة العمل' });
  }
};
