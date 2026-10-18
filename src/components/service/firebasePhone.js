// Firebase Phone Auth, used only to SMS the completion code to the customer and
// check it. The CRM itself stays on Supabase: Firebase is loaded only on the
// technician's job screen, and the signed result goes to the service-otp function.
// Google bills per SMS after the first 10 a day (Blaze plan).
import { FIREBASE_CONFIG } from '../../constants';

export const firebaseReady = () => Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.appId);

let loading = null;
// Loaded on first use only, so other screens never download Firebase. A failed load is retried.
function loadAuth() {
    if (!loading) {
        loading = Promise.all([import('firebase/app'), import('firebase/auth')])
            .then(([appModule, authModule]) => {
                const app = appModule.initializeApp(FIREBASE_CONFIG, 'watersun-otp');
                const auth = authModule.getAuth(app);
                auth.languageCode = 'en';
                return { auth, authModule };
            })
            .catch(error => { loading = null; throw error; });
    }
    return loading;
}

// Sends the SMS. containerId: an empty element on the page for the invisible reCAPTCHA.
// Returns the confirmation to pass to confirmFirebaseCode.
export async function sendFirebaseCode(phone, containerId) {
    const { auth, authModule } = await loadAuth();
    const verifier = new authModule.RecaptchaVerifier(auth, containerId, { size: 'invisible' });
    try {
        return await authModule.signInWithPhoneNumber(auth, phone, verifier);
    } finally {
        // A fresh reCAPTCHA for every send; a used one cannot be sent again.
        verifier.clear();
    }
}

// Checks the code with Google and returns the signed ID token for service-otp.
// Signs out at once: the browser must not stay signed in to Firebase.
export async function confirmFirebaseCode(confirmation, code) {
    const { auth, authModule } = await loadAuth();
    const result = await confirmation.confirm(code);
    try {
        return await result.user.getIdToken();
    } finally {
        await authModule.signOut(auth).catch(() => {});
    }
}

// Firebase error codes in words a technician at the site can act on.
export function firebaseErrorText(error) {
    const code = String(error?.code || '');
    if (code === 'auth/invalid-verification-code') return 'Wrong code. Check with the customer and try again.';
    if (code === 'auth/code-expired') return 'This code has expired. Press Send code again.';
    if (code === 'auth/too-many-requests') return 'Too many codes from this phone. Wait a while, or ask the office to close this job.';
    if (code === 'auth/quota-exceeded') return 'The SMS limit for today is used up. Ask the office to close this job.';
    if (code === 'auth/invalid-phone-number') return 'The customer\'s mobile number is not valid. Ask the office to close this job.';
    if (code === 'auth/network-request-failed') return 'No internet. Check the connection and try again.';
    if (['auth/operation-not-allowed', 'auth/unauthorized-domain', 'auth/billing-not-enabled', 'auth/invalid-api-key', 'auth/captcha-check-failed'].includes(code)) {
        return `Completion codes are not set up correctly (${code}). Ask the office to close this job.`;
    }
    return `The code could not be sent or checked${code ? ` (${code})` : ''}. Try again, or ask the office to close this job.`;
}
