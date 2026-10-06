import { sql } from 'drizzle-orm';
import { db } from './index.ts';
import type { AuthUser } from '../server/authService.ts';

/**
 * Phase 6B: Centralized Server-Side Database Identity Propagation Helper.
 * Executes database operations within a trusted, transaction-local authentication context.
 * 
 * 1. Sets transaction-local configuration parameters (app.current_user_id, app.current_user_role)
 *    using set_config(..., true), ensuring parameters automatically revert on transaction end.
 * 2. Switches to the unprivileged application role `scheduler_app` (NOBYPASSRLS, non-owner)
 *    via `SET LOCAL ROLE scheduler_app`, so PostgreSQL RLS policies are strictly enforced.
 * 3. Completely prevents connection pool bleed across pg.Pool clients.
 */
export async function withAuthContext<T>(
  user: AuthUser | null | undefined,
  action: (tx: typeof db) => Promise<T>
): Promise<T> {
  const role = user?.role || 'anon';
  const uid = user?.uid || '';

  return db.transaction(async (tx) => {
    // 1. Transaction-local GUC settings (is_local = true)
    await tx.execute(sql`SELECT set_config('app.current_user_id', ${uid}, true)`);
    await tx.execute(sql`SELECT set_config('app.current_user_role', ${role}, true)`);

    // 2. Switch transaction role to scheduler_app
    await tx.execute(sql`SET LOCAL ROLE scheduler_app`);

    // 3. Execute the protected operations
    return action(tx as any);
  });
}
