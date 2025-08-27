import * as admin from "firebase-admin";

let app: admin.app.App | undefined;

export function getAdminApp() {
  if (!app) {
    const sa = JSON.parse(process.env.GCP_SA_KEY as string);
    app = admin.initializeApp({
      credential: admin.credential.cert(sa as admin.ServiceAccount),
    });
  }
  return app;
}