/* =========================================================
   PATEL AUTO GARAGE & SERVICE - CLOUD DATABASE CONFIGURATION
   Firebase Firestore Persistent Shared Backend for Multi-Device Access
   (PC, Phone, Laptop & Family Devices)
========================================================= */

// Default shared Firebase project configuration
// To automatically connect EVERY device (your PC, brother's phone, laptop) that opens your Vercel URL,
// enter your Firebase project credentials directly here.
// You can also paste your configuration inside the app UI under Cloud Settings.
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDT4IfMfp6gS36h0Y7bVt_BIY-vhW6eqts",
  authDomain: "patel-auto-garage-90427.firebaseapp.com",
  projectId: "patel-auto-garage-90427",
  storageBucket: "patel-auto-garage-90427.firebasestorage.app",
  messagingSenderId: "25532106701",
  appId: "1:25532106701:web:0475c1048c6de07a5de684",
  measurementId: "G-YQ9TNRCFC3",
};

const CLOUD_STORAGE_KEYS = {
  firebaseConfig: "patelAutoGarageFirebaseConfig",
  cloudStatus: "patelAutoGarageCloudStatus",
  lastCloudSync: "patelAutoGarageLastCloudSync",
  pendingDeletions: "patelAutoGaragePendingDeletions",
};

let firebaseApp = null;
let firestoreDb = null;
let isFirestoreInitialized = false;
let isFirestoreOnline = false;

/**
 * Check if a config object has the minimum required fields to connect to Firebase
 */
function isValidFirebaseConfig(cfg) {
  return Boolean(
    cfg &&
    typeof cfg === "object" &&
    cfg.projectId &&
    String(cfg.projectId).trim().length > 0 &&
    cfg.apiKey &&
    String(cfg.apiKey).trim().length > 0
  );
}

/**
 * Parse any pasted Firebase configuration snippet (JS code, JSON, or key-value format)
 * Allows 1-click paste of "const firebaseConfig = { ... }" directly from Firebase Console
 */
function parseFirebaseConfigSnippet(snippet) {
  if (!snippet || typeof snippet !== "string") return null;

  const text = snippet.trim();
  const config = {};

  // Try JSON parse first
  try {
    const parsed = JSON.parse(text);
    if (isValidFirebaseConfig(parsed)) {
      return {
        apiKey: String(parsed.apiKey || "").trim(),
        authDomain: String(parsed.authDomain || "").trim(),
        projectId: String(parsed.projectId || "").trim(),
        storageBucket: String(parsed.storageBucket || "").trim(),
        messagingSenderId: String(parsed.messagingSenderId || "").trim(),
        appId: String(parsed.appId || "").trim(),
      };
    }
  } catch (_) {
    // Not valid JSON, continue with regex parsing
  }

  // Regex extraction for JavaScript snippet
  const patterns = {
    apiKey: /(?:apiKey|api_key)\s*[:=]\s*["'`]?([A-Za-z0-9_\-]+)["'`]?/i,
    authDomain: /(?:authDomain|auth_domain)\s*[:=]\s*["'`]?([A-Za-z0-9_\-\.]+)["'`]?/i,
    projectId: /(?:projectId|project_id)\s*[:=]\s*["'`]?([A-Za-z0-9_\-]+)["'`]?/i,
    storageBucket: /(?:storageBucket|storage_bucket)\s*[:=]\s*["'`]?([A-Za-z0-9_\-\.]+)["'`]?/i,
    messagingSenderId: /(?:messagingSenderId|messaging_sender_id)\s*[:=]\s*["'`]?([A-Za-z0-9_\-]+)["'`]?/i,
    appId: /(?:appId|app_id)\s*[:=]\s*["'`]?([A-Za-z0-9_\-:]+)["'`]?/i,
  };

  Object.entries(patterns).forEach(([key, regex]) => {
    const match = text.match(regex);
    if (match && match[1]) {
      config[key] = match[1].trim();
    } else {
      config[key] = "";
    }
  });

  return isValidFirebaseConfig(config) ? config : null;
}

/**
 * Checks for ?fb_cfg= parameter in the URL.
 * Allows the owner to send a 1-tap setup link to their brother or family member via WhatsApp/message,
 * which instantly configures the cloud database on their device without typing anything!
 */
function checkForUrlFirebaseConfig() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const encodedConfig = urlParams.get("fb_cfg");
    if (encodedConfig) {
      let jsonStr = "";
      try {
        jsonStr = decodeURIComponent(escape(atob(encodedConfig)));
      } catch (_) {
        jsonStr = atob(encodedConfig);
      }
      const decoded = JSON.parse(jsonStr);
      if (isValidFirebaseConfig(decoded)) {
        saveCustomFirebaseConfig(decoded);
        console.log("Auto-configured Firebase Cloud credentials from share link!");
        // Clean URL without reloading
        urlParams.delete("fb_cfg");
        const newSearch = urlParams.toString();
        const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
        window.history.replaceState({}, document.title, newUrl);
        return decoded;
      }
    }
  } catch (e) {
    console.warn("Could not parse Firebase config from URL param:", e);
  }
  return null;
}

/**
 * Generates a 1-tap setup link to share with family members (WhatsApp / SMS)
 */
function generateFamilyShareLink() {
  const activeCfg = getActiveFirebaseConfig();
  if (!isValidFirebaseConfig(activeCfg)) {
    return null;
  }
  try {
    const jsonStr = JSON.stringify(activeCfg);
    let encoded = "";
    try {
      encoded = btoa(unescape(encodeURIComponent(jsonStr)));
    } catch (_) {
      encoded = btoa(jsonStr);
    }
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?fb_cfg=${encoded}`;
  } catch (e) {
    console.warn("Could not encode config for share link:", e);
    return null;
  }
}

/**
 * Retrieves the active Firebase configuration (custom from localStorage, URL, or default)
 */
function getActiveFirebaseConfig() {
  // 1. Check URL param first
  const urlCfg = checkForUrlFirebaseConfig();
  if (urlCfg) return urlCfg;

  // 2. Check localStorage custom config
  try {
    const saved = localStorage.getItem(CLOUD_STORAGE_KEYS.firebaseConfig);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (isValidFirebaseConfig(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Could not read custom Firebase config from localStorage", e);
  }

  // 3. Fallback to hardcoded default config
  return DEFAULT_FIREBASE_CONFIG;
}

/**
 * Saves a custom Firebase configuration to localStorage
 */
function saveCustomFirebaseConfig(config) {
  if (!config || typeof config !== "object") return;
  localStorage.setItem(CLOUD_STORAGE_KEYS.firebaseConfig, JSON.stringify(config));
}

/**
 * Clears custom Firebase config and reverts to default
 */
function clearCustomFirebaseConfig() {
  localStorage.removeItem(CLOUD_STORAGE_KEYS.firebaseConfig);
}

/**
 * Initializes the Firebase App and Cloud Firestore with multi-tab offline persistence
 * and Anonymous Authentication (satisfies request.auth != null security rules)
 */
async function initializeCloudDatabase(customConfig = null) {
  if (typeof firebase === "undefined") {
    console.warn("Firebase SDK is not loaded. Operating in offline/local mode.");
    isFirestoreOnline = false;
    return { success: false, reason: "sdk_not_loaded", message: "Firebase SDK not loaded." };
  }

  const config = customConfig || getActiveFirebaseConfig();

  // Validate configuration
  if (!isValidFirebaseConfig(config)) {
    isFirestoreOnline = false;
    return {
      success: false,
      reason: "missing_config",
      message: "Firebase API Key & Project ID are required for multi-device cloud database."
    };
  }

  try {
    if (firebase.apps && firebase.apps.length > 0) {
      firebaseApp = firebase.apps[0];
    } else {
      firebaseApp = firebase.initializeApp(config);
    }

    firestoreDb = firebase.firestore();

    // Enable offline persistence (IndexedDB cache) so garage works seamlessly offline
    try {
      await firestoreDb.enablePersistence({ synchronizeTabs: true });
      console.log("Firestore offline persistence enabled with multi-tab sync.");
    } catch (err) {
      if (err.code === "failed-precondition") {
        console.warn("Firestore persistence notice: Multiple tabs open, primary tab active.");
      } else if (err.code === "unimplemented") {
        console.warn("Firestore persistence is not supported in this browser.");
      }
    }

    // Anonymous Firebase Authentication (Requirement 7 & 8)
    // Allows Firestore security rules with 'allow read, write: if request.auth != null'
    if (typeof firebase.auth === "function") {
      try {
        const auth = firebase.auth();
        if (!auth.currentUser) {
          const authResult = await auth.signInAnonymously();
          console.log("Firebase anonymous authentication succeeded (UID:", authResult.user ? authResult.user.uid : "anon", ")");
        } else {
          console.log("Firebase auth session active (UID:", auth.currentUser.uid, ")");
        }
      } catch (authErr) {
        console.warn("Firebase Anonymous Auth warning (enable Anonymous Sign-In in Firebase Console):", authErr);
      }
    }

    isFirestoreInitialized = true;
    isFirestoreOnline = true;
    return { success: true, db: firestoreDb };
  } catch (err) {
    console.error("Error initializing Firebase Firestore:", err);
    isFirestoreOnline = false;
    return {
      success: false,
      error: err,
      reason: "init_error",
      message: err.message || "Could not connect to Firebase Firestore."
    };
  }
}

/**
 * Checks if Firestore is active and ready
 */
function isCloudActive() {
  return isFirestoreInitialized && firestoreDb !== null;
}

/**
 * Returns the active Firestore instance or null
 */
function getFirestoreInstance() {
  return firestoreDb;
}

window.GarageCloud = {
  initialize: initializeCloudDatabase,
  getDb: getFirestoreInstance,
  isActive: isCloudActive,
  isConfigured: () => isValidFirebaseConfig(getActiveFirebaseConfig()),
  getConfig: getActiveFirebaseConfig,
  saveConfig: saveCustomFirebaseConfig,
  clearConfig: clearCustomFirebaseConfig,
  generateShareLink: generateFamilyShareLink,
  parseSnippet: parseFirebaseConfigSnippet,
  DEFAULT_CONFIG: DEFAULT_FIREBASE_CONFIG,
};
