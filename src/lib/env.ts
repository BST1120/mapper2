export const env = {
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "",
  },
  tenantId: process.env.NEXT_PUBLIC_TENANT_ID ?? "",
} as const;

export function assertClientEnv() {
  const missing: string[] = [];
  const cfg = env.firebase;
  if (!cfg.apiKey) missing.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!cfg.authDomain) missing.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  if (!cfg.projectId) missing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  if (!cfg.storageBucket) missing.push("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
  if (!cfg.messagingSenderId)
    missing.push("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
  if (!cfg.appId) missing.push("NEXT_PUBLIC_FIREBASE_APP_ID");
  if (!env.tenantId) missing.push("NEXT_PUBLIC_TENANT_ID");

  if (missing.length) {
    throw new Error(
      `Missing client env vars: ${missing.join(
        ", ",
      )}. Create .env.local from .env.example.`,
    );
  }
}

