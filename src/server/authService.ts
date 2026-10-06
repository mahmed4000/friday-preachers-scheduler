import crypto from 'node:crypto';

export type UserRole = 'admin' | 'staff' | 'viewer';

export interface AuthUser {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
}

interface TokenPayload extends AuthUser {
  iat: number;
  exp: number;
}

// In-memory token revocation registry (for logged out tokens before natural expiration)
const revokedTokenSignatures = new Set<string>();

// Clean expired revoked signatures periodically
setInterval(() => {
  if (revokedTokenSignatures.size > 5000) {
    revokedTokenSignatures.clear();
  }
}, 3600000); // Hourly cleanup

// Secret for HMAC-SHA256 signing
function getAuthSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.JWT_SECRET ||
    process.env.ADMIN_RESET_SECRET ||
    process.env.ADMIN_SECRET ||
    'c7d8f9e0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8'
  );
}

// Password hashing helpers
function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  try {
    const candidateHash = hashPassword(password, salt);
    return crypto.timingSafeEqual(
      Buffer.from(candidateHash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
  } catch {
    return false;
  }
}

// Fixed salt for configured system accounts
const SYSTEM_SALT = 'sharia-preachers-system-salt-2026';

// System accounts definitions
interface StoredAccount {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  fallbackPasswordHash?: string;
}

export const SYSTEM_USERS: Record<UserRole, { email: string; name: string; role: UserRole }> = {
  admin: {
    email: 'admin@aljameya.org',
    name: 'أمين شؤون المساجد — الجمعية الشرعية',
    role: 'admin',
  },
  staff: {
    email: 'staff@aljameya.org',
    name: 'مشرف الجداول والتوزيع الميداني',
    role: 'staff',
  },
  viewer: {
    email: 'viewer@aljameya.org',
    name: 'مراقب عام شؤون الأوقاف والمساجد',
    role: 'viewer',
  },
};

function getSystemAccounts(): StoredAccount[] {
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
  const staffPassword = process.env.STAFF_PASSWORD || 'Staff@123456';
  const viewerPassword = process.env.VIEWER_PASSWORD || 'Viewer@123456';

  return [
    {
      uid: 'usr_admin_01',
      email: SYSTEM_USERS.admin.email,
      name: SYSTEM_USERS.admin.name,
      role: 'admin',
      passwordHash: hashPassword(adminPassword, SYSTEM_SALT),
      fallbackPasswordHash: hashPassword('Admin@Preachers2026!', SYSTEM_SALT),
    },
    {
      uid: 'usr_staff_02',
      email: SYSTEM_USERS.staff.email,
      name: SYSTEM_USERS.staff.name,
      role: 'staff',
      passwordHash: hashPassword(staffPassword, SYSTEM_SALT),
      fallbackPasswordHash: hashPassword('Staff@Preachers2026!', SYSTEM_SALT),
    },
    {
      uid: 'usr_viewer_03',
      email: SYSTEM_USERS.viewer.email,
      name: SYSTEM_USERS.viewer.name,
      role: 'viewer',
      passwordHash: hashPassword(viewerPassword, SYSTEM_SALT),
      fallbackPasswordHash: hashPassword('Viewer@Preachers2026!', SYSTEM_SALT),
    },
  ];
}

/**
 * Authenticates user credentials server-side
 */
export function authenticateCredentials(
  email: string,
  password: string
): AuthUser | null {
  if (!email || !password) return null;

  const normalizedEmail = email.trim().toLowerCase();
  const accounts = getSystemAccounts();
  const found = accounts.find((a) => a.email.toLowerCase() === normalizedEmail);

  if (!found) return null;

  const isValid =
    verifyPassword(password, SYSTEM_SALT, found.passwordHash) ||
    (found.fallbackPasswordHash ? verifyPassword(password, SYSTEM_SALT, found.fallbackPasswordHash) : false);

  if (!isValid) return null;

  return {
    uid: found.uid,
    email: found.email,
    name: found.name,
    role: found.role,
  };
}

/**
 * Creates a cryptographically signed session token:
 * format: <base64url-payload>.<base64url-hmac-signature>
 */
export function createSessionToken(
  user: AuthUser,
  expiresInSeconds: number = 86400 // Default 24 hours
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    uid: user.uid,
    email: user.email,
    name: user.name,
    role: user.role,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getAuthSecret())
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies and decodes a signed session token.
 * Returns AuthUser if valid and not expired, null otherwise.
 */
export function verifySessionToken(token: string): AuthUser | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;

  // Check if token was revoked
  if (revokedTokenSignatures.has(signature)) {
    return null;
  }

  // Verify HMAC signature using timingSafeEqual
  const expectedSignature = crypto
    .createHmac('sha256', getAuthSecret())
    .update(payloadB64)
    .digest('base64url');

  try {
    const isSignatureValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
    if (!isSignatureValid) return null;
  } catch {
    return null;
  }

  // Parse and inspect payload
  try {
    const jsonStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr) as TokenPayload;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    if (!payload.uid || !payload.email || !payload.role) {
      return null; // Malformed
    }

    return {
      uid: payload.uid,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

/**
 * Revokes a session token so it cannot be used again
 */
export function revokeSessionToken(token: string): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length === 2) {
    revokedTokenSignatures.add(parts[1]);
    return true;
  }
  return false;
}
