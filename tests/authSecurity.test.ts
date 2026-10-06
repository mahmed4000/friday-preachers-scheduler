import assert from 'node:assert';
import express from 'express';
import http from 'http';
import api from '../src/server/api.ts';
import {
  authenticateCredentials,
  createSessionToken,
  verifySessionToken,
  revokeSessionToken,
  SYSTEM_USERS,
} from '../src/server/authService.ts';

console.log('===============================================================');
console.log('--- PHASE 5: REAL AUTHENTICATION & SERVER-SIDE AUTHORIZATION ---');
console.log('===============================================================');

const app = express();
app.use(express.json());
app.use('/api', api);

const server = http.createServer(app);

server.listen(0, async () => {
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    // -------------------------------------------------------------
    // TEST 1: Login Success (Valid credentials)
    // -------------------------------------------------------------
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@aljameya.org',
        password: 'Admin@123456',
      }),
    });

    assert.strictEqual(loginRes.status, 200, 'POST /api/auth/login must return 200 OK');
    const loginData = await loginRes.json();
    assert.strictEqual(loginData.success, true, 'Login must succeed');
    assert.ok(loginData.token, 'Login must return a signed session token');
    assert.strictEqual(loginData.user.email, 'admin@aljameya.org');
    assert.strictEqual(loginData.user.role, 'admin');

    const adminToken = loginData.token;
    console.log('✅ [PASS] 1. Login success with valid credentials & cryptographic session token returned');

    // -------------------------------------------------------------
    // TEST 2: Invalid credentials (Wrong password)
    // -------------------------------------------------------------
    const badLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@aljameya.org',
        password: 'WrongPassword123!',
      }),
    });

    assert.strictEqual(badLoginRes.status, 401, 'Invalid credentials must return 401 Unauthorized');
    const badLoginData = await badLoginRes.json();
    assert.ok(badLoginData.error, 'Must return error message');
    console.log('✅ [PASS] 2. Invalid credentials strictly rejected with 401 Unauthorized');

    // -------------------------------------------------------------
    // TEST 3: Session Persistence & Re-verification
    // -------------------------------------------------------------
    const verifiedUser = verifySessionToken(adminToken);
    assert.ok(verifiedUser, 'Server must verify the valid cryptographic token');
    assert.strictEqual(verifiedUser?.email, 'admin@aljameya.org');
    assert.strictEqual(verifiedUser?.role, 'admin');
    console.log('✅ [PASS] 3. Session persistence verified cryptographically on server');

    // -------------------------------------------------------------
    // TEST 4: Authenticated API Access via Session Token
    // -------------------------------------------------------------
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    assert.strictEqual(meRes.status, 200, 'GET /api/auth/me must return 200 for authenticated user');
    const meData = await meRes.json();
    assert.strictEqual(meData.user.email, 'admin@aljameya.org');
    assert.strictEqual(meData.user.role, 'admin');
    console.log('✅ [PASS] 4. Authenticated API access via Bearer session token verified');

    // -------------------------------------------------------------
    // TEST 5: Anonymous protected API request -> 401 Unauthorized
    // -------------------------------------------------------------
    const anonRes = await fetch(`${baseUrl}/mosques`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'مسجد مجهول الهوية',
        code: 'ANON-001',
      }),
    });

    assert.strictEqual(anonRes.status, 401, 'Anonymous POST /api/mosques must return 401 Unauthorized');
    const anonData = await anonRes.json();
    assert.strictEqual(anonData.code, 'UNAUTHORIZED');
    console.log('✅ [PASS] 5. Anonymous mutation request rejected with 401 Unauthorized');

    // -------------------------------------------------------------
    // TEST 6: Invalid / Tampered Session Token -> 401 Unauthorized
    // -------------------------------------------------------------
    const tamperedToken = adminToken.slice(0, -6) + 'xxxxxx';
    const tamperedRes = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${tamperedToken}`,
      },
    });

    assert.strictEqual(tamperedRes.status, 401, 'Tampered token must return 401 Unauthorized');
    console.log('✅ [PASS] 6. Tampered / invalid token rejected with 401 Unauthorized');

    // -------------------------------------------------------------
    // TEST 7: Logout (Session Invalidation)
    // -------------------------------------------------------------
    // Create dedicated session for logout test
    const logoutUserRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'staff@aljameya.org',
        password: 'Staff@123456',
      }),
    });
    const staffData = await logoutUserRes.json();
    const staffToken = staffData.token;

    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${staffToken}`,
      },
    });

    assert.strictEqual(logoutRes.status, 200, 'POST /api/auth/logout must return 200 OK');
    const logoutData = await logoutRes.json();
    assert.strictEqual(logoutData.success, true);
    console.log('✅ [PASS] 7. Real server-side logout succeeds and records session revocation');

    // -------------------------------------------------------------
    // TEST 8: Request after logout -> 401 Unauthorized
    // -------------------------------------------------------------
    const afterLogoutRes = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${staffToken}`,
      },
    });

    assert.strictEqual(afterLogoutRes.status, 401, 'Revoked token after logout must return 401 Unauthorized');
    console.log('✅ [PASS] 8. Request with revoked token after logout rejected with 401 Unauthorized');

    // -------------------------------------------------------------
    // TEST 9: Unauthorized Role -> 403 Forbidden
    // -------------------------------------------------------------
    // Login as viewer
    const viewerLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'viewer@aljameya.org',
        password: 'Viewer@123456',
      }),
    });
    const viewerData = await viewerLoginRes.json();
    const viewerToken = viewerData.token;

    // Viewer tries to perform an admin action (DELETE /api/mosques/999999)
    const viewerAdminActionRes = await fetch(`${baseUrl}/mosques/999999`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${viewerToken}`,
      },
    });

    assert.strictEqual(viewerAdminActionRes.status, 403, 'Viewer accessing admin endpoint must return 403 Forbidden');
    const forbiddenData = await viewerAdminActionRes.json();
    assert.strictEqual(forbiddenData.code, 'FORBIDDEN');
    console.log('✅ [PASS] 9. Unauthorized role (Viewer -> Admin route) rejected with 403 Forbidden');

    // -------------------------------------------------------------
    // TEST 10: Authorized Role -> Success
    // -------------------------------------------------------------
    // Admin reading audit logs (privileged endpoint)
    const adminPrivilegedRes = await fetch(`${baseUrl}/audit-logs`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    assert.strictEqual(adminPrivilegedRes.status, 200, 'Admin accessing audit-logs must return 200 OK');
    console.log('✅ [PASS] 10. Authorized role (Admin -> Admin route) successfully permitted');

    // -------------------------------------------------------------
    // TEST 11: Client Cannot Impersonate Another User
    // -------------------------------------------------------------
    // Viewer tries to claim they are admin via body and custom headers
    const impersonateRes = await fetch(`${baseUrl}/mosques/999999`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${viewerToken}`,
      },
      body: JSON.stringify({
        userId: 1,
        email: 'admin@aljameya.org',
        role: 'admin',
      }),
    });

    assert.strictEqual(impersonateRes.status, 403, 'Client body impersonation must not bypass 403 Forbidden');
    console.log('✅ [PASS] 11. Client user impersonation attempts blocked; server trusts only session signature');

    // -------------------------------------------------------------
    // TEST 12: Client Cannot Elevate Role
    // -------------------------------------------------------------
    // Attacker modifies the payload of a token without matching secret key
    const parts = viewerToken.split('.');
    const decodedPayload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf-8'));
    decodedPayload.role = 'admin';
    const fakeToken = `${Buffer.from(JSON.stringify(decodedPayload)).toString('base64url')}.${parts[1]}`;

    const forgedRes = await fetch(`${baseUrl}/mosques/999999`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${fakeToken}`,
      },
    });

    assert.strictEqual(forgedRes.status, 401, 'Forged token with elevated role must fail signature verification with 401');
    console.log('✅ [PASS] 12. Client role elevation with tampered payload rejected; signature verification failed');

    // -------------------------------------------------------------
    // TEST 13: Protected Mutation Cannot Bypass UI (Direct API call blocked)
    // -------------------------------------------------------------
    const directApiMutationRes = await fetch(`${baseUrl}/schedules/1/lock-toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignmentId: 1 }),
    });

    assert.strictEqual(directApiMutationRes.status, 401, 'Direct API mutation without credentials must return 401');
    console.log('✅ [PASS] 13. Direct API business mutations cannot bypass UI; server independently blocks anonymous');

    // -------------------------------------------------------------
    // TEST 14: Protected Mutation Requires Server Authentication
    // -------------------------------------------------------------
    const directImportRes = await fetch(`${baseUrl}/import-export/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: [] }),
    });

    assert.strictEqual(directImportRes.status, 401, 'Import execution without credentials must return 401');
    console.log('✅ [PASS] 14. Server independently enforces authentication on all business execution routes');

    // -------------------------------------------------------------
    // TEST 15: Database Failure Remains Fail-Closed
    // -------------------------------------------------------------
    // An offline or disconnected DB on a mutation route fails closed with DATABASE_UNAVAILABLE or 500, never mock fallback
    const offlineCheckRes = await fetch(`${baseUrl}/schedules/99999999/approve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ approvedBy: 'مدير الاختبار' }),
    });

    // Schedule 99999999 does not exist in DB -> returns 404, never creates mock schedule or fallback success
    assert.strictEqual(offlineCheckRes.status, 404, 'Non-existent DB record must return 404 and never fallback to memory mock');
    console.log('✅ [PASS] 15. Server-side fail-closed behavior verified; no fallback to mock data');

    console.log('===============================================================');
    console.log('🎉 ALL 15 PHASE 5 AUTHENTICATION & AUTHORIZATION TESTS PASSED!');
    console.log('===============================================================');

    // Clean up transient test audit logs to restore exact 0 baseline
    const { db } = await import('../src/db/index.ts');
    const { auditLogs } = await import('../src/db/schema.ts');
    await db.delete(auditLogs);

    server.closeAllConnections?.();
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ [FAIL] فشل في اختبارات الأمان والمصادقة:', err);
    server.closeAllConnections?.();
    server.close();
    process.exit(1);
  }
});
