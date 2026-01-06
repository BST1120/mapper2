import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

initializeApp();

const db = getFirestore();

function requireAuthed(context: { auth?: { uid: string } }) {
  if (!context.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  return context.auth.uid;
}

function tenantRef(tenantId: string) {
  return db.collection("tenants").doc(tenantId);
}

function securityRef(tenantId: string) {
  return tenantRef(tenantId).collection("private").doc("security");
}

function editSessionRef(tenantId: string, uid: string) {
  return tenantRef(tenantId).collection("editSessions").doc(uid);
}

async function assertValidSession(tenantId: string, uid: string) {
  const snap = await editSessionRef(tenantId, uid).get();
  const data = snap.data();
  if (!data?.expiresAt) {
    throw new HttpsError("permission-denied", "No active edit session.");
  }
  const expiresAt: Timestamp = data.expiresAt;
  if (expiresAt.toMillis() <= Date.now()) {
    throw new HttpsError("permission-denied", "Edit session expired.");
  }
}

export const verifyPin = onCall(async (request) => {
  const uid = requireAuthed(request);
  const { tenantId, pin } = request.data as { tenantId?: string; pin?: string };

  if (!tenantId || typeof tenantId !== "string") {
    throw new HttpsError("invalid-argument", "tenantId is required.");
  }
  if (!pin || typeof pin !== "string") {
    throw new HttpsError("invalid-argument", "pin is required.");
  }

  const secSnap = await securityRef(tenantId).get();
  const sec = secSnap.data();
  const pinHash = sec?.pinHash;
  if (!pinHash || typeof pinHash !== "string") {
    throw new HttpsError(
      "failed-precondition",
      "PIN is not initialized for this tenant.",
    );
  }

  const ok = await bcrypt.compare(pin, pinHash);
  if (!ok) {
    throw new HttpsError("permission-denied", "Invalid PIN.");
  }

  const sessionId = randomUUID();
  const expiresAt = Timestamp.fromMillis(Date.now() + 12 * 60 * 60 * 1000); // 12h

  await editSessionRef(tenantId, uid).set(
    {
      sessionId,
      expiresAt,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return {
    sessionId,
    expiresAt: expiresAt.toDate().toISOString(),
  };
});

export const revokeEditSession = onCall(async (request) => {
  const uid = requireAuthed(request);
  const { tenantId } = request.data as { tenantId?: string };

  if (!tenantId || typeof tenantId !== "string") {
    throw new HttpsError("invalid-argument", "tenantId is required.");
  }

  await editSessionRef(tenantId, uid).delete();
  return { revoked: true };
});

export const rotatePin = onCall(async (request) => {
  const uid = requireAuthed(request);
  const { tenantId, currentPin, newPin } = request.data as {
    tenantId?: string;
    currentPin?: string;
    newPin?: string;
  };

  if (!tenantId || typeof tenantId !== "string") {
    throw new HttpsError("invalid-argument", "tenantId is required.");
  }
  if (!currentPin || typeof currentPin !== "string") {
    throw new HttpsError("invalid-argument", "currentPin is required.");
  }
  if (!newPin || typeof newPin !== "string") {
    throw new HttpsError("invalid-argument", "newPin is required.");
  }
  if (newPin.length < 4) {
    throw new HttpsError("invalid-argument", "PIN must be at least 4 digits.");
  }

  await assertValidSession(tenantId, uid);

  const secSnap = await securityRef(tenantId).get();
  const sec = secSnap.data();
  const pinHash = sec?.pinHash;
  if (!pinHash || typeof pinHash !== "string") {
    throw new HttpsError(
      "failed-precondition",
      "PIN is not initialized for this tenant.",
    );
  }

  const ok = await bcrypt.compare(currentPin, pinHash);
  if (!ok) {
    throw new HttpsError("permission-denied", "Invalid current PIN.");
  }

  const nextHash = await bcrypt.hash(newPin, 10);
  await securityRef(tenantId).set(
    {
      pinHash: nextHash,
      updatedAt: FieldValue.serverTimestamp(),
      updatedByUid: uid,
    },
    { merge: true },
  );

  return { updated: true };
});

/**
 * bootstrapTenant (開発用)
 * - 初期テナントとPIN、初期エリアを作成
 * - MVP導入時の最初の1回だけ使う想定
 *
 * NOTE: 現時点では「誰でも作れる」状態になるため、運用では無効化するか、
 *       セットアップ用の別キー導入を推奨。
 */
export const bootstrapTenant = onCall(async (request) => {
  const uid = requireAuthed(request);
  const { tenantId, name, pin, areas, minStaffThreshold } = request.data as {
    tenantId?: string;
    name?: string;
    pin?: string;
    minStaffThreshold?: number;
    areas?: Array<{ areaId: string; name: string; order: number; type: string }>;
  };

  if (!tenantId || typeof tenantId !== "string") {
    throw new HttpsError("invalid-argument", "tenantId is required.");
  }
  if (!name || typeof name !== "string") {
    throw new HttpsError("invalid-argument", "name is required.");
  }
  if (!pin || typeof pin !== "string") {
    throw new HttpsError("invalid-argument", "pin is required.");
  }
  const safeThreshold =
    typeof minStaffThreshold === "number" ? minStaffThreshold : 0;
  const safeAreas = Array.isArray(areas) ? areas : [];

  const tRef = tenantRef(tenantId);
  const tSnap = await tRef.get();
  if (tSnap.exists) {
    throw new HttpsError("already-exists", "Tenant already exists.");
  }

  const pinHash = await bcrypt.hash(pin, 10);

  const batch = db.batch();
  batch.set(tRef, {
    name,
    timezone: "Asia/Tokyo",
    minStaffThreshold: safeThreshold,
    createdAt: FieldValue.serverTimestamp(),
    createdByUid: uid,
  });
  batch.set(securityRef(tenantId), {
    pinHash,
    createdAt: FieldValue.serverTimestamp(),
    createdByUid: uid,
  });
  for (const a of safeAreas) {
    if (!a?.areaId || !a.name) continue;
    batch.set(tRef.collection("areas").doc(a.areaId), {
      name: a.name,
      order: a.order ?? 0,
      type: a.type ?? "room",
    });
  }
  await batch.commit();

  return { tenantId };
});

