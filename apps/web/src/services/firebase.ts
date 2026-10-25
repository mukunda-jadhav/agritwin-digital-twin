import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'firebase/auth';
import { post } from './api';
const config = {
  // Firebase's browser config is public and must be present in the built client bundle.
  // Keep environment overrides for other deployments; these defaults match AgriTwin's Firebase app.
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyB4-jHxYmOe_RjRDhJgBVmSY2mQ9BdYhUY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'agridigitwin.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'agridigitwin',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:268899578497:web:3b7e7b86a2cb10ad9e1380',
};
export const googleConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);
const auth = () => getAuth(getApps()[0] || initializeApp(config));
export async function googleLogin() {
  if (!googleConfigured)
    throw new Error('Google sign-in is not configured yet. Use email access below.');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const result = await signInWithPopup(auth(), provider);
    return post('/auth/firebase', { idToken: await result.user.getIdToken(true) });
  } catch (e) {
    if (
      ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(
        (e as { code: string }).code,
      )
    ) {
      await signInWithRedirect(auth(), provider);
      return null;
    }
    throw e;
  }
}
export async function finishGoogleRedirect() {
  if (!googleConfigured) return null;
  const result = await getRedirectResult(auth());
  return result ? post('/auth/firebase', { idToken: await result.user.getIdToken(true) }) : null;
}
export async function firebaseLogout() {
  if (googleConfigured) await signOut(auth());
}
