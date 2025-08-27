import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminApp } from "./_admin";
import * as admin from "firebase-admin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).send("Method not allowed");

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return res.status(401).send("Missing token");

    const app = getAdminApp();
    const decoded = await app.auth().verifyIdToken(token);
    const uid = decoded.uid;

    const { amount, reason } = (req.body || {}) as { amount?: number; reason?: string };
    if (!amount || typeof amount !== "number" || amount <= 0 || amount > 5000) {
      return res.status(400).send("Invalid amount");
    }

    const db = app.firestore();
    const userRef = db.collection("users").doc(uid);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new Error("User missing");
      const current = (snap.get("points") as number) || 0;
      tx.update(userRef, {
        points: current + amount,
        lastPointsReason: reason || "generic",
        lastPointsAt: admin.firestore.FieldValue.serverTimestamp(),
      } as any);
    });

    res.status(200).json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Error" });
  }
}