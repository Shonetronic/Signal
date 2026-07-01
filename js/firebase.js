import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase, ref, set, get, onValue, update } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

// Paste your Firebase project config here (from Firebase Console → Project Settings)
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDmLHLBwzuc4g54Cs8UIXUVGzLefLmmkFk",
  authDomain: "signal-prototype-1eead.firebaseapp.com",
  databaseURL: "https://signal-prototype-1eead-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "signal-prototype-1eead",
  storageBucket: "signal-prototype-1eead.firebasestorage.app",
  messagingSenderId: "969963486327",
  appId: "1:969963486327:web:045b7848084335ffbb5a72",
};

const app = initializeApp(FIREBASE_CONFIG);
const db  = getDatabase(app);

export function generateGameCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function pushState(gameId, state) {
  await set(ref(db, `games/${gameId}`), state);
}

export async function fetchState(gameId) {
  const snap = await get(ref(db, `games/${gameId}`));
  return snap.exists() ? snap.val() : null;
}

// Returns the unsubscribe function.
export function subscribeState(gameId, callback) {
  const r = ref(db, `games/${gameId}`);
  return onValue(r, snap => {
    if (snap.exists()) callback(snap.val());
  });
}

export async function setPlayerLeft(gameId, role) {
  await update(ref(db, `games/${gameId}`), { _playerLeft: role });
}

// Lobby: pre-game coordination (deck choices, map). Uses update() so both
// players can write their own fields without overwriting each other's.
export async function updateLobby(gameId, data) {
  await update(ref(db, `lobbies/${gameId}`), data);
}

export function subscribeLobby(gameId, callback) {
  return onValue(ref(db, `lobbies/${gameId}`), snap => {
    if (snap.exists()) callback(snap.val());
  });
}
