import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
export const firebaseEnabled = () =>
  Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    ((process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS),
  );
export async function verifiedGoogleIdentity(token: string) {
  if (!firebaseEnabled())
    throw new Error('Google authentication has not been configured on this server.');
  const app =
    getApps()[0] ||
    initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
      credential: process.env.FIREBASE_PRIVATE_KEY
        ? cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          })
        : applicationDefault(),
    });
  const claims = await getAuth(app).verifyIdToken(token, true);
  if (!claims.email || !claims.email_verified || claims.firebase.sign_in_provider !== 'google.com')
    throw new Error('A verified Google identity is required.');
  if (Date.now() / 1000 - claims.auth_time > 600)
    throw new Error('Please sign in with Google again before linking your account.');
  return {
    uid: claims.uid,
    email: claims.email.toLowerCase(),
    name: claims.name || claims.email.split('@')[0],
  };
}
