// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBOwCdoll01KOJeezqQeNYWWXWRfFa6RaA",
    authDomain: "hawa-dennis-website-c1be1.firebaseapp.com",
    projectId: "hawa-dennis-website-c1be1",
    storageBucket: "hawa-dennis-website-c1be1.firebasestorage.app",
    messagingSenderId: "671199562888",
    appId: "1:671199562888:web:90c758e53004f40f32e33d"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

async function getUserProfile(firebaseUser) {
    if (!firebaseUser) return null;
    const snapshot = await db.collection('users').doc(firebaseUser.uid).get();
    return snapshot.exists ? { uid: firebaseUser.uid, ...snapshot.data() } : null;
}

async function getCurrentUserProfile() {
    return getUserProfile(auth.currentUser);
}

function waitForAuthUser() {
    return new Promise(resolve => {
        const unsubscribe = auth.onAuthStateChanged(firebaseUser => {
            unsubscribe();
            resolve(firebaseUser);
        });
    });
}

async function redirectByRole(defaultPage = 'index.html') {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return false;
    const profile = await getUserProfile(firebaseUser);
    const destination = profile && (profile.role === 'admin' || profile.role === 'superadmin')
        ? 'admin.html'
        : defaultPage;
    if (!location.pathname.endsWith(destination)) location.href = destination;
    return true;
}

async function requireAdmin() {
    const firebaseUser = auth.currentUser || await waitForAuthUser();
    const profile = await getUserProfile(firebaseUser);
    if (!profile || !['admin', 'superadmin'].includes(profile.role) || profile.status !== 'active') {
        location.href = firebaseUser ? 'index.html' : 'user-auth.html?next=admin.html';
        return null;
    }
    return profile;
}