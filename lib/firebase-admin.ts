import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

function firebaseEnv() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || "";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim() || "";
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY?.trim() || "";
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
  return { projectId, clientEmail, privateKey };
}

export function isFirebaseAdminConfigured(): boolean {
  const { projectId, clientEmail, privateKey } = firebaseEnv();
  return Boolean(projectId && clientEmail && privateKey);
}

export function getFirebaseAdminApp(): App | null {
  if (!isFirebaseAdminConfigured()) return null;

  const existing = getApps();
  if (existing.length > 0) {
    return getApp();
  }

  const { projectId, clientEmail, privateKey } = firebaseEnv();
  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export function getFirebaseMessaging(): Messaging | null {
  const app = getFirebaseAdminApp();
  if (!app) return null;
  return getMessaging(app);
}
