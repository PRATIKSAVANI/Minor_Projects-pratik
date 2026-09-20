/* =========================================================
   PATEL AUTO GARAGE & SERVICE - CLOUD DATABASE CONFIGURATION
   Firebase Firestore Persistent Shared Backend for Family Access
========================================================= */

// Default shared Firebase project configuration
// You can enter your Firebase project credentials directly here or via the Cloud Settings in the app.
// Once entered here, EVERY device (your PC, brother's phone, laptop) connects to the same cloud database automatically!
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "patel-auto-garage",
  storageBucket: "patel-auto-garage.appspot.com",
  messagingSenderId: "",
  appId: "",
};

const CLOUD_STORAGE_KEYS = {
  firebaseConfig: "patelAutoGarageFirebaseConfig",
  cloudStatus: "patelAutoGarageCloudStatus",
  lastCloudSync: "patelAutoGarageLastCloudSync",
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
    cfg.projectId.trim().length > 0 &&
    cfg.apiKey &&
    cfg.apiKey.trim().length > 0
  );
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
      const decoded = JSON.parse(decodeURIComponent(escape(atob(encodedConfig))));
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
 * Generates a 1-tap setup link to share with family members
 */
function generateFamilyShareLink() {
  const activeCfg = getActiveFirebaseConfig();
  if (!isValidFirebaseConfig(activeCfg)) {
    return null;
  }
  try {
    const jsonStr = JSON.stringify(activeCfg);
    const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
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
 */
async function initializeCloudDatabase(customConfig = null) {
  if (typeof firebase === "undefined") {
    console.warn("Firebase SDK is not loaded. Operating in offline/local mode.");
    isFirestoreOnline = false;
    return { success: false, reason: "sdk_not_loaded" };
  }

  const config = customConfig || getActiveFirebaseConfig();

  // Validate configuration
  if (!isValidFirebaseConfig(config)) {
    isFirestoreOnline = false;
    return {
      success: false,
      reason: "missing_config",
      message: "Firebase API Key & Project ID are required for cloud database."
    };
  }

  try {
    if (firebase.apps && firebase.apps.length > 0) {
      firebaseApp = firebase.apps[0];
    } else {
      firebaseApp = firebase.initializeApp(config);
    }

    firestoreDb = firebase.firestore();

    // Enable offline persistence (IndexedDB cache) so garage works even if internet drops
    try {
      await firestoreDb.enablePersistence({ synchronizeTabs: true });
      console.log("Firestore offline persistence enabled with multi-tab sync.");
    } catch (err) {
      if (err.code === "failed-precondition") {
        console.warn("Firestore persistence notice: Multiple tabs open, using primary tab persistence.");
      } else if (err.code === "unimplemented") {
        console.warn("Firestore persistence is not supported in this browser.");
      }
    }

    isFirestoreInitialized = true;
    isFirestoreOnline = true;
    return { success: true, db: firestoreDb };
  } catch (err) {
    console.error("Error initializing Firebase Firestore:", err);
    isFirestoreOnline = false;
    return { success: false, error: err, reason: "init_error" };
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
  DEFAULT_CONFIG: DEFAULT_FIREBASE_CONFIG,
};
