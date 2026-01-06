"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bootstrapTenant = exports.rotatePin = exports.revokeEditSession = exports.verifyPin = void 0;
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const crypto_1 = require("crypto");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
function requireAuthed(context) {
    if (!context.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    }
    return context.auth.uid;
}
function tenantRef(tenantId) {
    return db.collection("tenants").doc(tenantId);
}
function securityRef(tenantId) {
    return tenantRef(tenantId).collection("private").doc("security");
}
function editSessionRef(tenantId, uid) {
    return tenantRef(tenantId).collection("editSessions").doc(uid);
}
async function assertValidSession(tenantId, uid) {
    const snap = await editSessionRef(tenantId, uid).get();
    const data = snap.data();
    if (!data?.expiresAt) {
        throw new https_1.HttpsError("permission-denied", "No active edit session.");
    }
    const expiresAt = data.expiresAt;
    if (expiresAt.toMillis() <= Date.now()) {
        throw new https_1.HttpsError("permission-denied", "Edit session expired.");
    }
}
exports.verifyPin = (0, https_1.onCall)(async (request) => {
    const uid = requireAuthed(request);
    const { tenantId, pin } = request.data;
    if (!tenantId || typeof tenantId !== "string") {
        throw new https_1.HttpsError("invalid-argument", "tenantId is required.");
    }
    if (!pin || typeof pin !== "string") {
        throw new https_1.HttpsError("invalid-argument", "pin is required.");
    }
    const secSnap = await securityRef(tenantId).get();
    const sec = secSnap.data();
    const pinHash = sec?.pinHash;
    if (!pinHash || typeof pinHash !== "string") {
        throw new https_1.HttpsError("failed-precondition", "PIN is not initialized for this tenant.");
    }
    const ok = await bcryptjs_1.default.compare(pin, pinHash);
    if (!ok) {
        throw new https_1.HttpsError("permission-denied", "Invalid PIN.");
    }
    const sessionId = (0, crypto_1.randomUUID)();
    const expiresAt = firestore_1.Timestamp.fromMillis(Date.now() + 12 * 60 * 60 * 1000); // 12h
    await editSessionRef(tenantId, uid).set({
        sessionId,
        expiresAt,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    return {
        sessionId,
        expiresAt: expiresAt.toDate().toISOString(),
    };
});
exports.revokeEditSession = (0, https_1.onCall)(async (request) => {
    const uid = requireAuthed(request);
    const { tenantId } = request.data;
    if (!tenantId || typeof tenantId !== "string") {
        throw new https_1.HttpsError("invalid-argument", "tenantId is required.");
    }
    await editSessionRef(tenantId, uid).delete();
    return { revoked: true };
});
exports.rotatePin = (0, https_1.onCall)(async (request) => {
    const uid = requireAuthed(request);
    const { tenantId, currentPin, newPin } = request.data;
    if (!tenantId || typeof tenantId !== "string") {
        throw new https_1.HttpsError("invalid-argument", "tenantId is required.");
    }
    if (!currentPin || typeof currentPin !== "string") {
        throw new https_1.HttpsError("invalid-argument", "currentPin is required.");
    }
    if (!newPin || typeof newPin !== "string") {
        throw new https_1.HttpsError("invalid-argument", "newPin is required.");
    }
    if (newPin.length < 4) {
        throw new https_1.HttpsError("invalid-argument", "PIN must be at least 4 digits.");
    }
    await assertValidSession(tenantId, uid);
    const secSnap = await securityRef(tenantId).get();
    const sec = secSnap.data();
    const pinHash = sec?.pinHash;
    if (!pinHash || typeof pinHash !== "string") {
        throw new https_1.HttpsError("failed-precondition", "PIN is not initialized for this tenant.");
    }
    const ok = await bcryptjs_1.default.compare(currentPin, pinHash);
    if (!ok) {
        throw new https_1.HttpsError("permission-denied", "Invalid current PIN.");
    }
    const nextHash = await bcryptjs_1.default.hash(newPin, 10);
    await securityRef(tenantId).set({
        pinHash: nextHash,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        updatedByUid: uid,
    }, { merge: true });
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
exports.bootstrapTenant = (0, https_1.onCall)(async (request) => {
    const uid = requireAuthed(request);
    const { tenantId, name, pin, areas, minStaffThreshold } = request.data;
    if (!tenantId || typeof tenantId !== "string") {
        throw new https_1.HttpsError("invalid-argument", "tenantId is required.");
    }
    if (!name || typeof name !== "string") {
        throw new https_1.HttpsError("invalid-argument", "name is required.");
    }
    if (!pin || typeof pin !== "string") {
        throw new https_1.HttpsError("invalid-argument", "pin is required.");
    }
    const safeThreshold = typeof minStaffThreshold === "number" ? minStaffThreshold : 0;
    const safeAreas = Array.isArray(areas) ? areas : [];
    const tRef = tenantRef(tenantId);
    const tSnap = await tRef.get();
    if (tSnap.exists) {
        throw new https_1.HttpsError("already-exists", "Tenant already exists.");
    }
    const pinHash = await bcryptjs_1.default.hash(pin, 10);
    const batch = db.batch();
    batch.set(tRef, {
        name,
        timezone: "Asia/Tokyo",
        minStaffThreshold: safeThreshold,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        createdByUid: uid,
    });
    batch.set(securityRef(tenantId), {
        pinHash,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        createdByUid: uid,
    });
    for (const a of safeAreas) {
        if (!a?.areaId || !a.name)
            continue;
        batch.set(tRef.collection("areas").doc(a.areaId), {
            name: a.name,
            order: a.order ?? 0,
            type: a.type ?? "room",
        });
    }
    await batch.commit();
    return { tenantId };
});
