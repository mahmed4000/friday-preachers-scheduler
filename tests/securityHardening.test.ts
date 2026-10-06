import { describe, it } from 'node:test';
import assert from 'node:assert';
import { requireAdmin, requireAuth, AuthRequest } from '../src/middleware/auth.ts';
import { isSupabaseConfigured, getSupabaseClient } from '../src/lib/supabaseClient.ts';

// Test mock Express Request & Response helpers
function createMockReqRes(headers: Record<string, string> = {}, body: any = {}) {
  const req = {
    headers,
    body,
  } as unknown as AuthRequest;

  let statusCode = 200;
  let jsonResponse: any = null;

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: any) {
      jsonResponse = data;
      return this;
    },
  } as any;

  return { req, res, getStatus: () => statusCode, getJson: () => jsonResponse };
}

console.log('--- بدء اختبارات تشديد الأمان والمصادقة (Phase 2 Security Hardening) ---');

// 1. Test requireAdmin blocks empty/unauthenticated requests
{
  const { req, res, getStatus, getJson } = createMockReqRes();
  let nextCalled = false;
  requireAdmin(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, false, 'requireAdmin must not call next() without confirmation or secret');
  assert.strictEqual(getStatus(), 403, 'requireAdmin must respond with 403 Forbidden');
  assert.ok(getJson()?.error, 'requireAdmin must return error message');
  console.log('✅ [PASS] 1. requireAdmin يرفض الطلبات غير المصرحة برمز 403 Forbidden');
}

// 2. Test requireAdmin accepts x-admin-action confirmation in dev
{
  const { req, res } = createMockReqRes({ 'x-admin-action': 'confirmed' });
  let nextCalled = false;
  requireAdmin(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true, 'requireAdmin must call next() when x-admin-action is confirmed');
  assert.strictEqual(req.user?.role, 'admin', 'requireAdmin must assign admin role to confirmed request');
  console.log('✅ [PASS] 2. requireAdmin يقبل طلبات التطوير المؤكدة إدارياً عبر x-admin-action');
}

// 3. Test requireAdmin accepts ADMIN_RESET_SECRET
{
  process.env.ADMIN_RESET_SECRET = 'test-secret-12345';
  const { req, res } = createMockReqRes({ 'x-admin-secret': 'test-secret-12345' });
  let nextCalled = false;
  requireAdmin(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true, 'requireAdmin must call next() with valid ADMIN_RESET_SECRET');
  delete process.env.ADMIN_RESET_SECRET;
  console.log('✅ [PASS] 3. requireAdmin يقبل المفتاح السري الإداري ADMIN_RESET_SECRET');
}

// 4. Test Supabase Client does not leak or use hardcoded credentials
{
  // When no environment variables are set
  const client = getSupabaseClient();
  assert.strictEqual(client, null, 'getSupabaseClient must return null when no credentials configured in env');
  assert.strictEqual(isSupabaseConfigured, false, 'isSupabaseConfigured must be false when no credentials in env');
  console.log('✅ [PASS] 4. عميل Supabase محمي ولا يحتوي على مفاتيح سرية مدمجة بالشيفرة');
}

console.log('--- اكتملت جميع اختبارات تشديد الأمان بنجاح 4/4 ---');
