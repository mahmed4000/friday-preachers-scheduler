import { AsyncLocalStorage } from 'node:async_hooks';
import { setServerTokenResolver } from '../lib/supabaseClient.ts';

// بيحتفظ بتوكن المسؤول طول مدة الطلب، علشان كل استدعاءات Supabase في الطلب ده تستخدمه.
export const requestContext = new AsyncLocalStorage<{ token: string }>();

setServerTokenResolver(() => requestContext.getStore()?.token);
