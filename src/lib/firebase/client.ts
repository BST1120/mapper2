"use client";

import { initializeApp, type FirebaseApp, getApps } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  type Auth,
} from "firebase/auth";
import {
  initializeFirestore,
  enableIndexedDbPersistence,
  type Firestore,
} from "firebase/firestore";

import { assertClientEnv, env } from "@/lib/env";

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

export function getFirebaseApp(): FirebaseApp {
  assertClientEnv();
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0]!;
    return app;
  }
  app = initializeApp(env.firebase);
  return app;
}

export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  auth = getAuth(getFirebaseApp());
  return auth;
}

export function getFirestoreDb(): Firestore {
  if (db) return db;
  // Enable offline persistence by default (best-effort).
  // Safari/iPad/一部AndroidでWebChannelが不安定なことがあるため、
  // 自動でLong Pollingに切り替えられる設定にする。
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isAmazonTablet = /Silk|Kindle|KF[A-Z0-9]+|AmazonWebAppPlatform/i.test(ua);
  db = initializeFirestore(getFirebaseApp(), {
    experimentalAutoDetectLongPolling: true,
    // Fireタブレットで無限ロードになるケース対策（WebChannelが不安定）
    experimentalForceLongPolling: isAmazonTablet,
  });

  // Persistence is best-effort; allow disabling for troublesome tablets.
  const disablePersistence =
    typeof window !== "undefined" &&
    window.localStorage?.getItem("disableFirestorePersistence") === "1";
  if (!disablePersistence && !isAmazonTablet) {
    enableIndexedDbPersistence(db).catch(() => {
      // Common causes: multiple tabs, unsupported browser.
      // For MVP, we treat this as best-effort.
    });
  }
  return db;
}

export async function ensureAnonymousAuth(): Promise<{ uid: string }> {
  const a = getFirebaseAuth();

  const current = a.currentUser;
  if (current?.uid) return { uid: current.uid };

  // Wait one tick for any existing session restoration.
  const restored = await new Promise<string | null>((resolve) => {
    const unsub = onAuthStateChanged(a, (user) => {
      unsub();
      resolve(user?.uid ?? null);
    });
  });
  if (restored) return { uid: restored };

  const cred = await signInAnonymously(a);
  return { uid: cred.user.uid };
}

