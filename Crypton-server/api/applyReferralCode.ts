import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminApp } from "./_admin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).send("Method not allowed");

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return res.status(401).send("Missing token");

    const app = getAdminApp();
    const decoded = await app.auth().verifyIdToken(token);
    const uid = decoded.uid;

    const { referralCode } = (req.body || {}) as { referralCode?: string };
    if (!referralCode) return res.status(400).send("Missing code");

    const db = app.firestore();
    const codes = db.collection("referralcodes");
    const users = db.collection("users");

    const codeSnap = await codes.doc(referralCode).get();
    if (!codeSnap.exists) return res.status(404).send("Invalid code");

    const referrerUid = (codeSnap.get("uid") as string) || "";
    if (!referrerUid || referrerUid === uid) return res.status(400).send("Invalid referrer");

    const userRef = users.doc(uid);
    const referrerRef = users.doc(referrerUid);

    await db.runTransaction(async (tx) => {
      const [userSnap, referrerSnap] = await Promise.all([tx.get(userRef), tx.get(referrerRef)]);
      if (!userSnap.exists || !referrerSnap.exists) throw new Error("User missing");
      if (userSnap.get("referralCodeApplied") === true) throw new Error("Already applied");

      const inviteePoints = ((userSnap.get("points") as number) || 0) + 1000;
      const inviterPoints = ((referrerSnap.get("points") as number) || 0) + 2000;
      const newCount = ((referrerSnap.get("referralCount") as number) || 0) + 1;

      tx.update(userRef, { referralCodeApplied: true, referredBy: referralCode, points: inviteePoints } as any);
      tx.update(referrerRef, { points: inviterPoints, referralCount: newCount } as any);
    });

    res.status(200).json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Error" });
  }
}