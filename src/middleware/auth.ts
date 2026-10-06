import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthRequest extends Request {
  user?: DecodedIdToken | { uid: string; email: string; name?: string; role?: string };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  
  // Allow secret admin header if configured
  const adminSecret = req.headers['x-admin-secret'];
  const expectedSecret = process.env.ADMIN_RESET_SECRET || process.env.ADMIN_SECRET;
  if (expectedSecret && adminSecret === expectedSecret) {
    req.user = { uid: 'secret-admin', email: 'admin@aljameya.org', role: 'admin', name: 'مدير النظام المعتمد' };
    return next();
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // In local development or testing mode, provide fallback admin
    if (process.env.NODE_ENV !== 'production') {
      req.user = { uid: 'dev-admin', email: 'admin@aljameya.org', role: 'admin', name: 'مدير التطوير المحلي' };
      return next();
    }
    return res.status(401).json({ error: 'غير مصرح: يرجى تسجيل الدخول أولاً' });
  }

  const token = authHeader.split('Bearer ')[1];

  // In non-production, accept mock dev-token
  if (process.env.NODE_ENV !== 'production' && token === 'dev-token') {
    req.user = { uid: 'dev-admin', email: 'admin@aljameya.org', role: 'admin', name: 'مدير التطوير المحلي' };
    return next();
  }

  if (!adminAuth) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: 'خدمة المصادقة السحابية غير مهيأة في بيئة الإنتاج' });
    }
    req.user = { uid: 'dev-admin', email: 'admin@aljameya.org', role: 'admin' };
    return next();
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'جلسة العمل غير صالحة أو منتهية' });
  }
};

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const adminSecret = req.headers['x-admin-secret'];
  const expectedSecret = process.env.ADMIN_RESET_SECRET || process.env.ADMIN_SECRET;
  
  if (expectedSecret && adminSecret === expectedSecret) {
    req.user = { uid: 'secret-admin', email: 'admin@aljameya.org', role: 'admin', name: 'مدير النظام' };
    return next();
  }

  // In non-production, check for confirmation header or body
  if (process.env.NODE_ENV !== 'production') {
    const confirmAction = req.headers['x-admin-action'] || req.body?.confirmAction;
    if (confirmAction === 'confirmed' || confirmAction === 'confirm-system-reset') {
      req.user = { uid: 'dev-admin', email: 'admin@aljameya.org', role: 'admin', name: 'مدير التطوير' };
      return next();
    }
  }

  // If in production without secret or valid admin, reject strictly
  if (process.env.NODE_ENV === 'production' && !expectedSecret) {
    return res.status(403).json({
      error: 'محظور: هذه العملية الحساسة معطلة في بيئة الإنتاج لعدم ضبط المفتاح الإداري ADMIN_RESET_SECRET',
    });
  }

  return res.status(403).json({
    error: 'محظور: هذه العملية حساسة وتتطلب تأكيداً إدارياً صريحاً (Header x-admin-action أو مفتاح إداري)',
  });
};

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ') && adminAuth) {
    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      req.user = decodedToken;
    } catch {
      // Continue without error for public read views
    }
  }
  next();
};
