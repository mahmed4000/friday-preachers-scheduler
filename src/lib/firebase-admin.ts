import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { firebaseConfig } from './firebaseConfig.ts';

let adminAuthInstance: Auth | null = null;

try {
  if (!getApps().length) {
    initializeApp({
      projectId: firebaseConfig.projectId,
    });
  }
  adminAuthInstance = getAuth();
} catch (err) {
  console.warn('Firebase Admin SDK initialization warning:', err);
}

export const adminAuth = adminAuthInstance;

