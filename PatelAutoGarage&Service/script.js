/* =========================================================
   PATEL AUTO GARAGE & SERVICE - COMPLETE CLIENT CONTROLLER
   Shared Cloud Firestore Database, Multi-Scope History & Billing
========================================================= */

// Global authentication and multi-tenant session state
let currentAuthUser = null;
let pendingRegistrationProfile = null;

const STORAGE_KEYS = {
  records: "records",
  expenses: "expenses",
  owner: "owner",
  familyMembers: "familyMembers",
  familyPasskey: "passkey",
  activeMember: "activeMember",
  loginSession: "loginSession",
  loginLock: "loginLock",
  theme: "theme",
  pendingDeletions: "pendingDeletions",
  garageInfo: "info",
};

/**
 * Returns a UID-scoped storage key to ensure 100% tenant data isolation on this device
 */
function getScopedStorageKey(key, uid = currentAuthUser?.uid) {
  if (!uid) return `patel_anon_${key}`;
  return `patel_${uid}_${key}`;
}

const DEFAULT_GARAGE_INFO = {
  garageName: "Patel Auto Garage & Service",
  ownerName: "Garage Owner",
  phone: "",
  tagline: "Professional Vehicle Service, Maintenance & Repair",
  address: "",
  photo: "",
};

function getGarageInfo() {
  const uid = currentAuthUser?.uid;
  if (uid) {
    const stored = readJSON(getScopedStorageKey("garageInfo", uid), null);
    if (stored && stored.garageName && stored.garageName.trim() && stored.garageName !== "Add Your Garage Name") {
      return { ...DEFAULT_GARAGE_INFO, ...stored };
    }
  }

  const unscoped = readJSON("patelAutoGarageInfo", null) || readJSON("patel_unscoped_garage_info", null);
  if (unscoped && unscoped.garageName && unscoped.garageName.trim() && unscoped.garageName !== "Add Your Garage Name") {
    return { ...DEFAULT_GARAGE_INFO, ...unscoped };
  }

  return { ...DEFAULT_GARAGE_INFO };
}

function saveGarageInfoLocally(info) {
  const uid = currentAuthUser?.uid;
  if (uid) {
    localStorage.setItem(getScopedStorageKey("garageInfo", uid), JSON.stringify(info));
  }
  localStorage.setItem("patelAutoGarageInfo", JSON.stringify(info));
  localStorage.setItem("patel_unscoped_garage_info", JSON.stringify(info));
}

function showAuthLoadingOverlay(show, message = "Loading...") {
  const overlay = document.getElementById("authLoadingOverlay");
  const text = document.getElementById("authLoadingText");
  if (text && message) text.textContent = message;
  if (overlay) {
    overlay.style.display = show ? "flex" : "none";
  }
}

function processImageFile(file, maxWidth = 300, maxHeight = 300) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      return reject(new Error("Please select a valid image file."));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Failed to load image."));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

function updateGarageBrandingUI() {
  const info = getGarageInfo();
  const activeMember = getActiveMember();
  const displayGarageName = (info.garageName && info.garageName.trim() && info.garageName !== "Add Your Garage Name") ? info.garageName.trim() : "Patel Auto Garage & Service";
  const displayOwnerName = (info.ownerName && info.ownerName.trim()) ? info.ownerName.trim() : "Garage Owner";

  // 1. Browser Tab Title
  document.title = `${displayGarageName} - Garage Management System`;

  // 2. Login screen title & logo
  const loginTitle = document.getElementById("loginGarageTitle");
  if (loginTitle) loginTitle.textContent = displayGarageName;

  const loginBrandImg = document.getElementById("loginBrandImg");
  const loginBrandIcon = document.getElementById("loginBrandDefaultIcon");
  const loginBrandBox = document.getElementById("loginBrandIcon");
  if (loginBrandImg && loginBrandIcon) {
    if (info.photo) {
      loginBrandImg.src = info.photo;
      loginBrandImg.style.display = "block";
      loginBrandIcon.style.display = "none";
      if (loginBrandBox) loginBrandBox.style.background = "#ffffff";
    } else {
      loginBrandImg.style.display = "none";
      loginBrandIcon.style.display = "block";
      if (loginBrandBox) loginBrandBox.style.background = "";
    }
  }

  // 3. Topbar Brand & Logo
  const topbarName = document.getElementById("topbarGarageName");
  if (topbarName) topbarName.textContent = displayGarageName;
  const topbarTagline = document.getElementById("topbarGarageTagline");
  if (topbarTagline) topbarTagline.textContent = info.tagline || "Multi-Day Garage Management & Billing";

  const topbarBrandImg = document.getElementById("topbarBrandImg");
  const topbarBrandIcon = document.getElementById("topbarBrandDefaultIcon");
  const topbarBrandBox = document.getElementById("topbarBrandIcon");
  if (topbarBrandImg && topbarBrandIcon) {
    if (info.photo) {
      topbarBrandImg.src = info.photo;
      topbarBrandImg.style.display = "block";
      topbarBrandIcon.style.display = "none";
      if (topbarBrandBox) topbarBrandBox.style.background = "#ffffff";
    } else {
      topbarBrandImg.style.display = "none";
      topbarBrandIcon.style.display = "block";
      if (topbarBrandBox) topbarBrandBox.style.background = "";
    }
  }

  // 4. Hero Section
  const heroOwner = document.getElementById("heroOwnerName");
  if (heroOwner) heroOwner.textContent = displayOwnerName.toUpperCase();
  const heroTagline = document.getElementById("heroGarageTagline");
  if (heroTagline) heroTagline.textContent = info.tagline || "Service with Purpose.";

  // 5. Printable Invoice
  const printName = document.getElementById("printGarageName");
  if (printName) printName.textContent = displayGarageName;
  const printTagline = document.getElementById("printGarageTagline");
  if (printTagline) printTagline.textContent = info.tagline || "Professional Vehicle Service, Maintenance & Repair";
  const printOwner = document.getElementById("printOwnerName");
  if (printOwner) {
    const phoneStr = info.phone ? ` | Mobile: ${info.phone}` : "";
    printOwner.textContent = `Owner: ${info.ownerName || "Garage Owner"}${phoneStr}`;
  }
  const printFooter = document.getElementById("printFooterMessage");
  if (printFooter) printFooter.textContent = `Thank you for choosing ${displayGarageName}.`;

  const printLogo = document.getElementById("printGarageLogo");
  if (printLogo) {
    if (info.photo) {
      printLogo.src = info.photo;
      printLogo.style.display = "block";
    } else {
      printLogo.style.display = "none";
    }
  }

  // 6. Topbar User Chip
  const topbarMember = document.getElementById("topbarMemberName");
  const topbarRole = document.getElementById("topbarMemberRole");
  if (topbarMember) {
    topbarMember.textContent = activeMember ? (activeMember.fullName || activeMember.username) : (info.ownerName || "Owner");
  }
  if (topbarRole) {
    topbarRole.textContent = activeMember ? activeMember.role : "Owner";
  }
}

function getActiveGarageId() {
  return currentAuthUser?.uid || "unauthenticated";
}

/**
 * Returns Firestore collection paths strictly isolated by UID:
 * users/{uid}/jobCards, users/{uid}/expenses, users/{uid}/settings, users/{uid}/family
 */
function getFirestoreCollections(uid = currentAuthUser?.uid) {
  if (uid) {
    return {
      records: `users/${uid}/jobCards`,
      jobCards: `users/${uid}/jobCards`,
      expenses: `users/${uid}/expenses`,
      meta: `users/${uid}/settings`,
      settings: `users/${uid}/settings`,
      family: `users/${uid}/family`,
    };
  }
  return {
    records: "users/unauthenticated/jobCards",
    jobCards: "users/unauthenticated/jobCards",
    expenses: "users/unauthenticated/expenses",
    meta: "users/unauthenticated/settings",
    settings: "users/unauthenticated/settings",
    family: "users/unauthenticated/family",
  };
}

const FIRESTORE_COLLECTIONS = new Proxy({}, {
  get: (_, prop) => getFirestoreCollections()[prop],
});

/**
 * Helper to get subcollection under users/{uid}/...
 */
function getUserSubcollection(name, uid = currentAuthUser?.uid) {
  if (!cloudDb || !uid) return null;
  return cloudDb.collection("users").doc(uid).collection(name);
}

/**
 * Helper to format username into a compliant email for Firebase Auth
 */
function formatAuthEmail(input) {
  const val = (input || "").trim().toLowerCase();
  if (val.includes("@")) return val;
  const clean = val.replace(/[^a-z0-9._-]/g, "");
  return `${clean}@patelgarage.app`;
}

const AUTH_SALT = "patel-auto-garage-v2";
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MS = 60 * 1000;
const REMEMBER_MS = 12 * 60 * 60 * 1000;

// Application State
let garageData = [];
let garageExpenses = [];
let activeDate = "";
let lastSystemDate = "";
let currentItems = [];
let editModalItems = [];
let selectedVehicleType = "Bike";
let filterScope = "date"; // 'date' (active period) | 'all' (all-time)

// Performance Scope State
// 'day' | 'week' | 'month' | 'year' | 'custom' | 'all'
let currentScope = "day";
let activeWeekOffset = 0; // 0 = current week, -1 = previous week...
let activeMonth = new Date().getMonth(); // 0-11
let activeYear = new Date().getFullYear(); // e.g. 2026
let activeYearOnly = new Date().getFullYear(); // e.g. 2026
let customStartDate = "";
let customEndDate = "";

// Cloud Synchronization State
let cloudDb = null;
let cloudSyncActive = false;
let cloudRecordsUnsubscribe = null;
let cloudExpensesUnsubscribe = null;
let cloudFamilyUnsubscribe = null;
let cloudMetaUnsubscribe = null;
let isInitialCloudLoad = true;
let lastCloudSyncTime = 0;

// Family Access & Member State
let currentActiveMember = null;
let garageFamilyMembers = [];
let garageFamilyPasskey = "123456";
let loginMode = "signin"; // 'signin' | 'join' | 'setup'

let toastTimer = null;
let confirmResolver = null;
let dashboardReady = false;
let isAuthenticated = false;
let verifiedSessionToken = "";
let loginBusy = false;
let dayCheckInterval = null;

document.addEventListener("DOMContentLoaded", initializeApp);

// =========================================
// APP INITIALIZATION & AUTHENTICATION
// =========================================

async function initializeApp() {
  try {
    updateGarageBrandingUI();
    setupMobileKeyboardAndScroll();
    setupAuthListeners();
    setupFamilyListeners();
    setupGarageProfileListeners();
    setupCloudListeners();

    // Show loading state until auth is resolved (Requirement 1)
    showAuthLoadingOverlay(true, "Connecting to your garage account...");

    // Initialize Firebase
    if (window.GarageCloud) {
      const res = await window.GarageCloud.initialize();
      if (res && res.success) {
        cloudDb = window.GarageCloud.getDb();
        const auth = window.GarageCloud.getAuth();
        if (auth) {
          auth.getRedirectResult().catch(() => {});
          // onAuthStateChanged is the SINGLE SOURCE OF TRUTH
          auth.onAuthStateChanged(handleAuthStateChange);
          return;
        }
      }
    }

    // Fallback if cloud SDK not loaded
    showAuthLoadingOverlay(false);
    showLoginScreen(false);
  } catch (err) {
    console.error("App startup initialization error:", err);
    showAuthLoadingOverlay(false);
    showLoginScreen(false);
  }
}

/**
 * Single source of truth for authentication state
 */
async function autoMigrateExistingDataIntoAccount(uid) {
  if (!uid || !cloudDb) return;
  try {
    const userDocRef = cloudDb.collection("users").doc(uid);

    // Check if user already has records in their private subcollection
    const existingSnap = await userDocRef.collection("jobCards").limit(1).get().catch(() => null);
    if (existingSnap && !existingSnap.empty) {
      return; // Already has records, no need to migrate
    }

    // Read global patel_records or jobCards
    let globalSnap = await cloudDb.collection("patel_records").get().catch(() => null);
    if (!globalSnap || globalSnap.empty) {
      globalSnap = await cloudDb.collection("jobCards").get().catch(() => null);
    }

    if (globalSnap && !globalSnap.empty) {
      console.log(`Auto-migrating ${globalSnap.docs.length} records into users/${uid}/jobCards...`);
      const BATCH_SIZE = 400;
      const docs = globalSnap.docs;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = cloudDb.batch();
        const slice = docs.slice(i, i + BATCH_SIZE);
        slice.forEach((d) => {
          const data = d.data();
          data.ownerId = uid;
          batch.set(userDocRef.collection("jobCards").doc(d.id), data, { merge: true });
        });
        await batch.commit();
      }

      // Also migrate expenses
      let expSnap = await cloudDb.collection("patel_expenses").get().catch(() => null);
      if (!expSnap || expSnap.empty) {
        expSnap = await cloudDb.collection("expenses").get().catch(() => null);
      }
      if (expSnap && !expSnap.empty) {
        const expDocs = expSnap.docs;
        for (let i = 0; i < expDocs.length; i += BATCH_SIZE) {
          const batch = cloudDb.batch();
          const slice = expDocs.slice(i, i + BATCH_SIZE);
          slice.forEach((d) => {
            const data = d.data();
            data.ownerId = uid;
            batch.set(userDocRef.collection("expenses").doc(d.id), data, { merge: true });
          });
          await batch.commit();
        }
      }

      // Also migrate settings from patel_meta
      try {
        const metaDoc = await cloudDb.collection("patel_meta").doc("garage_info").get();
        if (metaDoc.exists) {
          const metaData = metaDoc.data();
          metaData.ownerId = uid;
          await userDocRef.collection("settings").doc("garage_info").set(metaData, { merge: true });
          await userDocRef.set({
            ownerId: uid,
            garageName: metaData.garageName || "Patel Auto Garage & Service",
            ownerName: metaData.ownerName || "Garage Owner",
            photo: metaData.photo || "",
            phone: metaData.phone || "",
            tagline: metaData.tagline || "",
            address: metaData.address || "",
            updatedAt: Date.now(),
          }, { merge: true });
          saveGarageInfoLocally(metaData);
        }
      } catch (_) {}

      showToast(`🎉 Welcome! Loaded ${docs.length} garage records into your account.`, "success");
    }
  } catch (err) {
    console.warn("Auto-migration notice:", err);
  }
}

async function handleAuthStateChange(user) {
  try {
    if (!user) {
      // User is confirmed logged out
      currentAuthUser = null;
      isAuthenticated = false;
      dashboardReady = false;

      stopDayWatcher();
      unsubscribeCloudRealtimeListeners();
      wipeDashboardState();

      // Clear non-scoped legacy storage keys to prevent any cross-account leaks
      ["patelAutoGarageData", "patelAutoGarageExpenses", "patelAutoGarageInfo", "patelAutoGarageOwner", "patelAutoGarageLoginSession"].forEach((k) => {
        try {
          localStorage.removeItem(k);
          sessionStorage.removeItem(k);
        } catch (_) {}
      });

      updateGarageBrandingUI();
      showAuthLoadingOverlay(false);
      showLoginScreen(false);
      return;
    }

    // User is confirmed logged in
    currentAuthUser = user;
    isAuthenticated = true;

    showAuthLoadingOverlay(true, "Loading your garage dashboard...");

    // 1. Fetch or create users/{uid} profile document
    let profileData = null;
    if (cloudDb) {
      try {
        const userDocRef = cloudDb.collection("users").doc(user.uid);
        const userDocSnap = await userDocRef.get();
        if (userDocSnap.exists) {
          profileData = userDocSnap.data();
        } else {
          // Brand-new user: create profile doc in users/{uid}
          // Starts with completely EMPTY dashboard (Requirement 1)
          const newGarageName = pendingRegistrationProfile?.garageName || (user.displayName ? `${user.displayName}'s Garage` : "My Auto Garage");
          const newOwnerName = pendingRegistrationProfile?.ownerName || user.displayName || "Garage Owner";

          profileData = {
            ownerId: user.uid,
            email: user.email || "",
            garageName: newGarageName,
            ownerName: newOwnerName,
            photo: user.photoURL || "",
            phone: "",
            tagline: "Professional Vehicle Service, Maintenance & Repair",
            address: "",
            createdAt: Date.now(),
          };

          await userDocRef.set(profileData);
          await userDocRef.collection("settings").doc("garage_info").set(profileData, { merge: true });
        }
      } catch (err) {
        console.warn("Notice checking user profile document:", err);
      }
    }

    // 2. Set active garage info in UID-scoped local storage
    const garageInfo = {
      ...DEFAULT_GARAGE_INFO,
      ...(profileData || {}),
      garageName: profileData?.garageName || DEFAULT_GARAGE_INFO.garageName,
      ownerName: profileData?.ownerName || DEFAULT_GARAGE_INFO.ownerName,
      photo: profileData?.photo || "",
    };
    saveGarageInfoLocally(garageInfo);
    updateGarageBrandingUI();

    // 3. Auto-load existing records into private tenant on first login (zero-click migration)
    if (!isRegisterMode) {
      await autoMigrateExistingDataIntoAccount(user.uid);
    }

    // 4. Load user-scoped local records (strictly isolated by uid)
    loadData();

    // 5. Attach real-time Firestore listeners strictly scoped to users/{uid}/...
    setupCloudRealtimeListeners(user.uid);

    // 5. Update migration button visibility for owner
    checkMigrationSectionVisibility(user);

    // 6. Open dashboard
    openDashboard();

    // 7. Hide loading overlay
    showAuthLoadingOverlay(false);
    pendingRegistrationProfile = null;
  } catch (err) {
    console.error("Auth state change error:", err);
    showAuthLoadingOverlay(false);
    showToast("Error loading garage account: " + err.message, "error");
  }
}

function checkMigrationSectionVisibility(user) {
  const section = document.getElementById("migrationSection");
  const uidInput = document.getElementById("migrationTargetUidInput");
  const banner = document.getElementById("migrationAlertBanner");
  if (!section) return;

  if (user?.uid) {
    section.style.display = "block";
    if (uidInput) {
      uidInput.value = user.uid;
    }
    if (banner) {
      const recordsCount = Array.isArray(garageData) ? garageData.length : 0;
      banner.style.display = recordsCount === 0 ? "flex" : "none";
    }
  } else {
    section.style.display = "none";
    if (banner) banner.style.display = "none";
  }
}

function setupMobileKeyboardAndScroll() {
  // Ensure focused input, select, or textarea is visible above virtual keyboard
  document.addEventListener("focusin", (e) => {
    const target = e.target;
    if (!target || !target.matches || !target.matches("input, select, textarea")) return;

    // Small delay to allow the mobile soft keyboard to finish opening and viewport to adjust
    setTimeout(() => {
      try {
        target.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "nearest"
        });
      } catch (err) {
        target.scrollIntoView(false);
      }
    }, 280);
  });

  // Modern visualViewport support for dynamic layout changes
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
      const activeEl = document.activeElement;
      if (activeEl && activeEl.matches && activeEl.matches("input, select, textarea")) {
        try {
          activeEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } catch (err) {
          activeEl.scrollIntoView(false);
        }
      }
    });
  }
}

function setupAuthListeners() {
  document.getElementById("loginForm").addEventListener("submit", handleLoginSubmit);
  document.getElementById("togglePasswordBtn").addEventListener("click", toggleLoginPassword);
  document.getElementById("logoutBtn").addEventListener("click", logout);
  document.getElementById("changePasswordBtn").addEventListener("click", openPasswordModal);
  document.getElementById("passwordCancel").addEventListener("click", closePasswordModal);
  document.getElementById("passwordSave").addEventListener("click", saveNewPassword);
  document.getElementById("passwordModal").addEventListener("click", (event) => {
    if (event.target.id === "passwordModal") closePasswordModal();
  });
  setupResetLogin();

  // Forgot Password Modal Listeners
  document.getElementById("forgotPasswordBtn")?.addEventListener("click", openForgotPasswordModal);
  document.getElementById("forgotPasswordCloseBtn")?.addEventListener("click", closeForgotPasswordModal);
  document.getElementById("forgotPasswordCancelBtn")?.addEventListener("click", closeForgotPasswordModal);
  document.getElementById("forgotPasswordForm")?.addEventListener("submit", handleForgotPasswordSubmit);
  document.getElementById("forgotPasswordModal")?.addEventListener("click", (e) => {
    if (e.target.id === "forgotPasswordModal") closeForgotPasswordModal();
  });

  // Confirmation Modal Listeners (Available on login screen and inside app)
  document.getElementById("confirmCancel")?.addEventListener("click", () => closeConfirm(false));
  document.getElementById("confirmOk")?.addEventListener("click", () => closeConfirm(true));
  document.getElementById("confirmModal")?.addEventListener("click", (e) => {
    if (e.target.id === "confirmModal") closeConfirm(false);
  });

  // 1-Click Google Sign-In
  const googleBtn = document.getElementById("googleSignInBtn");
  if (googleBtn) {
    googleBtn.addEventListener("click", signInWithGoogle);
  }

  // Direct Logo / Photo Change (Click icon or camera badge)
  const directLogoInput = document.getElementById("directLogoFileInput");
  if (directLogoInput) {
    directLogoInput.addEventListener("change", handleDirectLogoChange);
  }

  const loginBrandIcon = document.getElementById("loginBrandIcon");
  if (loginBrandIcon) {
    loginBrandIcon.addEventListener("click", triggerDirectLogoUpload);
  }

  const topbarBrandIcon = document.getElementById("topbarBrandIcon");
  if (topbarBrandIcon) {
    topbarBrandIcon.addEventListener("click", triggerDirectLogoUpload);
  }

  // Direct Garage Name Edit (Pen icon next to title)
  const editGarageBtn = document.getElementById("editGarageNameBtn");
  if (editGarageBtn) {
    editGarageBtn.addEventListener("click", editGarageNameDirect);
  }

  const topbarEditGarageBtn = document.getElementById("topbarEditGarageNameBtn");
  if (topbarEditGarageBtn) {
    topbarEditGarageBtn.addEventListener("click", editGarageNameDirect);
  }

  // Direct Owner Name Edit (Pen icon in hero banner)
  const heroEditOwnerBtn = document.getElementById("heroEditOwnerBtn");
  if (heroEditOwnerBtn) {
    heroEditOwnerBtn.addEventListener("click", editOwnerNameDirect);
  }

  // Toggle Register vs Sign In
  const toggleRegBtn = document.getElementById("toggleRegisterModeBtn");
  if (toggleRegBtn) {
    toggleRegBtn.addEventListener("click", () => {
      isRegisterMode = !isRegisterMode;
      updateLoginMode();
    });
  }

  // Quick Edit Name Modal Event Listeners
  const quickEditCloseBtn = document.getElementById("quickEditCloseBtn");
  if (quickEditCloseBtn) quickEditCloseBtn.addEventListener("click", closeQuickEditModal);
  const quickEditCancelBtn = document.getElementById("quickEditCancelBtn");
  if (quickEditCancelBtn) quickEditCancelBtn.addEventListener("click", closeQuickEditModal);
  const quickEditSaveBtn = document.getElementById("quickEditSaveBtn");
  if (quickEditSaveBtn) {
    quickEditSaveBtn.addEventListener("click", (e) => {
      e.preventDefault();
      handleQuickEditSave();
    });
  }
  const quickEditForm = document.getElementById("quickEditForm");
  if (quickEditForm) {
    quickEditForm.addEventListener("submit", (e) => {
      e.preventDefault();
      handleQuickEditSave();
    });
  }
  const quickEditModal = document.getElementById("quickEditModal");
  if (quickEditModal) {
    quickEditModal.addEventListener("click", (e) => {
      if (e.target.id === "quickEditModal") closeQuickEditModal();
    });
  }
  const quickEditInput = document.getElementById("quickEditInput");
  if (quickEditInput) {
    quickEditInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleQuickEditSave();
      } else if (e.key === "Escape") {
        closeQuickEditModal();
      }
    });
  }

  // Allow clicking on titles directly to edit
  const loginTitleEl = document.getElementById("loginGarageTitle");
  if (loginTitleEl) {
    loginTitleEl.style.cursor = "pointer";
    loginTitleEl.title = "Click to Edit Garage Name";
    loginTitleEl.addEventListener("click", editGarageNameDirect);
  }
  const topbarTitleEl = document.getElementById("topbarGarageName");
  if (topbarTitleEl) {
    topbarTitleEl.style.cursor = "pointer";
    topbarTitleEl.title = "Click to Edit Garage Name";
    topbarTitleEl.addEventListener("click", editGarageNameDirect);
  }
  const heroOwnerEl = document.getElementById("heroOwnerName");
  if (heroOwnerEl) {
    heroOwnerEl.style.cursor = "pointer";
    heroOwnerEl.title = "Click to Edit Owner Name";
    heroOwnerEl.addEventListener("click", editOwnerNameDirect);
  }
}

let isRegisterMode = false;

// =========================================
// GOOGLE AUTH & DIRECT BRANDING EDITORS
// =========================================

async function signInWithGoogle() {
  if (typeof firebase === "undefined" || !firebase.auth) {
    showToast("Firebase Auth is loading. Please check your internet connection.", "error");
    return;
  }

  try {
    setLoginBusy(true);
    showAuthLoadingOverlay(true, "Signing in with Google...");
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    let result = null;
    try {
      result = await firebase.auth().signInWithPopup(provider);
    } catch (popupErr) {
      if (popupErr.code === "auth/popup-blocked" || popupErr.code === "auth/cancelled-popup-request") {
        console.log("Popup blocked, falling back to redirect...");
        await firebase.auth().signInWithRedirect(provider);
        return;
      }
      throw popupErr;
    }
    const user = result.user;
    if (!user) {
      throw new Error("No user returned from Google.");
    }
    // onAuthStateChanged will handle isolated profile creation and dashboard load
    showToast(`🎉 Welcome, ${user.displayName || "Garage Owner"}!`);
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    showAuthLoadingOverlay(false);
    if (error.code === "auth/popup-closed-by-user") {
      setLoginError("Google sign-in popup was closed. Please try again.");
    } else if (error.code === "auth/network-request-failed") {
      setLoginError("Network connection error. Please verify internet access.");
    } else if (error.code === "auth/unauthorized-domain") {
      const currentHost = window.location.hostname;
      setLoginError(`Google Sign-In Unauthorized Domain: Add this domain (${currentHost}) in Firebase Console -> Authentication -> Settings -> Authorized Domains. Or create an account via "New Garage? Create Free Account" below.`);
    } else if (error.code === "auth/operation-not-allowed") {
      setLoginError(`Google Sign-In Disabled: Enable Google Provider in Firebase Console -> Authentication -> Sign-in method. Or create an account via "New Garage? Create Free Account" below.`);
    } else {
      setLoginError(error.message || "Failed to sign in with Google.");
    }
  } finally {
    setLoginBusy(false);
  }
}

async function saveGarageSettings(infoUpdates) {
  if (!currentAuthUser || !cloudDb) return;
  const uid = currentAuthUser.uid;
  try {
    const toSave = { ...infoUpdates, ownerId: uid, updatedAt: Date.now() };
    await Promise.all([
      cloudDb.collection("users").doc(uid).collection("settings").doc("garage_info").set(toSave, { merge: true }),
      cloudDb.collection("users").doc(uid).set(toSave, { merge: true }),
    ]);
  } catch (e) {
    console.warn("Could not save settings to cloud:", e);
  }
}

function triggerDirectLogoUpload() {
  const fileInput = document.getElementById("directLogoFileInput");
  if (fileInput) {
    fileInput.value = "";
    fileInput.click();
  }
}

async function handleDirectLogoChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    showToast("Processing photo...", "info");
    const photoBase64 = await processImageFile(file, 300, 300);
    const current = getGarageInfo();
    const updatedInfo = { ...current, photo: photoBase64 };
    saveGarageInfoLocally(updatedInfo);
    updateGarageBrandingUI();

    if (cloudDb && currentAuthUser) {
      await saveGarageSettings(updatedInfo);
    }
    showToast("📸 Garage Logo / Photo updated successfully!", "success");
  } catch (err) {
    console.error("Failed to update logo:", err);
    showToast(err.message || "Could not process image.", "error");
  }
}

let quickEditTargetType = "garageName";

function openQuickEditModal(type) {
  quickEditTargetType = type;
  const modal = document.getElementById("quickEditModal");
  const title = document.getElementById("quickEditModalTitle");
  const label = document.getElementById("quickEditInputLabel");
  const input = document.getElementById("quickEditInput");
  const sectionLabel = document.getElementById("quickEditSectionLabel");
  const icon = document.getElementById("quickEditIcon");

  if (!modal || !input) return;

  const currentInfo = getGarageInfo();

  if (type === "garageName") {
    if (sectionLabel) sectionLabel.textContent = "GARAGE DETAILS";
    if (title) title.textContent = "Edit Garage Name";
    if (label) label.textContent = "Garage / Workshop Name";
    if (icon) icon.className = "fa-solid fa-store";
    input.placeholder = "e.g. Patel Auto Garage & Service";
    input.value = (currentInfo.garageName && currentInfo.garageName !== "Add Your Garage Name") ? currentInfo.garageName : "Patel Auto Garage & Service";
  } else {
    if (sectionLabel) sectionLabel.textContent = "OWNER PROFILE";
    if (title) title.textContent = "Edit Owner Name";
    if (label) label.textContent = "Owner Full Name";
    if (icon) icon.className = "fa-solid fa-user-tie";
    input.placeholder = "e.g. Harsh Savani";
    input.value = currentInfo.ownerName || "";
  }

  modal.hidden = false;
  modal.removeAttribute("aria-hidden");
  setTimeout(() => {
    if (input.focus) input.focus();
    if (input.select) input.select();
  }, 80);
}

function closeQuickEditModal() {
  const modal = document.getElementById("quickEditModal");
  if (modal) {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }
}

async function handleQuickEditSave() {
  const input = document.getElementById("quickEditInput");
  const value = (input?.value || "").trim();

  if (!value || value.length < 2) {
    showToast(quickEditTargetType === "garageName" ? "Please enter at least 2 characters for Garage Name." : "Please enter at least 2 characters for Owner Name.", "error");
    if (input) input.focus();
    return;
  }

  const current = getGarageInfo();
  const activeMember = getActiveMember();

  if (quickEditTargetType === "garageName") {
    const updatedInfo = { ...current, garageName: value, isCustom: true, updatedAt: Date.now() };
    saveGarageInfoLocally(updatedInfo);

    const owner = readJSON(STORAGE_KEYS.owner, null);
    if (owner) {
      owner.garageName = value;
      localStorage.setItem(STORAGE_KEYS.owner, JSON.stringify(owner));
    }

    if (activeMember) {
      if (currentActiveMember) {
        currentActiveMember.garageName = value;
      }
      const activeObj = {
        username: activeMember.username,
        fullName: activeMember.fullName || activeMember.username,
        role: activeMember.role || "Owner",
        garageName: value,
      };
      localStorage.setItem(STORAGE_KEYS.activeMember, JSON.stringify(activeObj));
      sessionStorage.setItem(STORAGE_KEYS.activeMember, JSON.stringify(activeObj));

      garageFamilyMembers = garageFamilyMembers.map((m) => {
        if (m.username === activeMember.username) {
          return { ...m, garageName: value };
        }
        return m;
      });
      saveFamilyMembersLocally();
    }

    if (cloudDb && currentAuthUser) {
      saveGarageSettings(updatedInfo);
    }

    // Direct immediate DOM updates
    const loginTitle = document.getElementById("loginGarageTitle");
    if (loginTitle) loginTitle.textContent = value;
    const topbarName = document.getElementById("topbarGarageName");
    if (topbarName) topbarName.textContent = value;
    const printName = document.getElementById("printGarageName");
    if (printName) printName.textContent = value;
    document.title = `${value} - Garage Management System`;

    updateGarageBrandingUI();
    closeQuickEditModal();
    showToast(`✅ Garage name updated to "${value}"!`);
  } else {
    // Owner name
    const updatedInfo = { ...current, ownerName: value, isCustom: true, updatedAt: Date.now() };
    saveGarageInfoLocally(updatedInfo);

    const owner = readJSON(getScopedStorageKey("owner"), null);
    if (owner) {
      owner.fullName = value;
      localStorage.setItem(getScopedStorageKey("owner"), JSON.stringify(owner));
    }

    if (activeMember) {
      if (currentActiveMember) {
        currentActiveMember.fullName = value;
      }
      const activeObj = {
        username: activeMember.username,
        fullName: value,
        role: activeMember.role || "Owner",
        garageName: activeMember.garageName || current.garageName,
      };
      localStorage.setItem(getScopedStorageKey("activeMember"), JSON.stringify(activeObj));
      sessionStorage.setItem(getScopedStorageKey("activeMember"), JSON.stringify(activeObj));

      garageFamilyMembers = garageFamilyMembers.map((m) => {
        if (m.username === activeMember.username) {
          return { ...m, fullName: value };
        }
        return m;
      });
      saveFamilyMembersLocally();
    }

    if (cloudDb && currentAuthUser) {
      saveGarageSettings(updatedInfo);
    }

    // Direct immediate DOM updates
    const heroOwner = document.getElementById("heroOwnerName");
    if (heroOwner) heroOwner.textContent = value.toUpperCase();
    const topbarMember = document.getElementById("topbarMemberName");
    if (topbarMember) topbarMember.textContent = value;
    const printOwner = document.getElementById("printOwnerName");
    if (printOwner) {
      const phoneStr = current.phone ? ` | Mobile: ${current.phone}` : "";
      printOwner.textContent = `Owner: ${value}${phoneStr}`;
    }

    updateGarageBrandingUI();
    closeQuickEditModal();
    showToast(`✅ Owner name updated to "${value}"!`);
  }
}

function editGarageNameDirect() {
  openQuickEditModal("garageName");
}

function editOwnerNameDirect() {
  openQuickEditModal("ownerName");
}

function garageHasAccounts() {
  return Boolean(currentAuthUser);
}

function getActiveMember() {
  if (!currentAuthUser) {
    return null;
  }
  const info = getGarageInfo();
  const emailName = currentAuthUser.email ? currentAuthUser.email.split("@")[0] : currentAuthUser.uid.slice(0, 8);
  return {
    username: emailName,
    fullName: info.ownerName || currentAuthUser.displayName || emailName,
    email: currentAuthUser.email || "",
    role: "Owner",
    garageName: info.garageName || "Patel Auto Garage & Service",
    photo: info.photo || currentAuthUser.photoURL || "",
    uid: currentAuthUser.uid,
  };
}

function getStoredSession() {
  return currentAuthUser ? { uid: currentAuthUser.uid, email: currentAuthUser.email } : null;
}

function isSessionActive() {
  return Boolean(isAuthenticated && currentAuthUser);
}

function requireAuth() {
  if (isSessionActive()) return true;

  const alreadyLocked = document.body.classList.contains("app-locked");
  clearLoginSession();
  wipeDashboardState();
  showLoginScreen(false);
  if (!alreadyLocked) {
    showToast("Please sign in to continue.", "error");
  }
  return false;
}

function showLoginScreen(clearForm = true) {
  isAuthenticated = false;
  verifiedSessionToken = "";
  document.body.classList.add("app-locked");

  const loginScreen = document.getElementById("loginScreen");
  const appShell = document.getElementById("appShell");
  loginScreen.hidden = false;
  loginScreen.inert = false;
  loginScreen.removeAttribute("aria-hidden");
  appShell.hidden = true;
  appShell.inert = true;
  appShell.setAttribute("aria-hidden", "true");

  closePasswordModal();
  closeForgotPasswordModal();
  closeConfirm(false);
  updateLoginMode();
  updateGarageBrandingUI();

  if (clearForm) {
    document.getElementById("loginForm")?.reset();
  }

  window.setTimeout(() => {
    document.getElementById("loginUsername")?.focus();
  }, 0);
}

function updateLoginMode() {
  const error = document.getElementById("loginError");
  if (error) error.hidden = true;
  setLoginBusy(false);

  const regGarageGroup = document.getElementById("regGarageNameGroup");
  const regOwnerGroup = document.getElementById("regOwnerNameGroup");
  const subtitle = document.getElementById("loginSubtitle");
  const submitText = document.getElementById("loginSubmitText");
  const toggleBtnText = document.getElementById("toggleRegisterText");

  if (isRegisterMode) {
    if (regGarageGroup) regGarageGroup.hidden = false;
    if (regOwnerGroup) regOwnerGroup.hidden = false;
    if (subtitle) subtitle.textContent = "Create your own garage account in 10 seconds";
    if (submitText) submitText.textContent = "Create Garage & Sign In";
    if (toggleBtnText) toggleBtnText.textContent = "Already have an account? Sign In";
  } else {
    if (regGarageGroup) regGarageGroup.hidden = true;
    if (regOwnerGroup) regOwnerGroup.hidden = true;
    if (subtitle) subtitle.textContent = "Sign in to access live garage job cards, bills & payments";
    if (submitText) submitText.textContent = "Sign In";
    if (toggleBtnText) toggleBtnText.textContent = "New Garage? Create Free Account";
  }
}

function toggleLoginPassword() {
  const input = document.getElementById("loginPassword");
  const button = document.getElementById("togglePasswordBtn");
  if (!input || !button) return;
  const icon = button.querySelector("i");
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  if (icon) icon.className = show ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
  button.title = show ? "Hide password" : "Show password";
  button.setAttribute("aria-label", show ? "Hide password" : "Show password");
  button.setAttribute("aria-pressed", show ? "true" : "false");
}

function getLoginLock() {
  const lock = readStorageJSON(sessionStorage, STORAGE_KEYS.loginLock, {
    attempts: 0,
    until: 0,
  });
  return {
    attempts: Number(lock.attempts) || 0,
    until: Number(lock.until) || 0,
  };
}

function setLoginLock(attempts, until) {
  sessionStorage.setItem(
    STORAGE_KEYS.loginLock,
    JSON.stringify({ attempts, until }),
  );
}

function clearLoginLock() {
  sessionStorage.removeItem(STORAGE_KEYS.loginLock);
}

function setLoginBusy(busy) {
  loginBusy = busy;
  const button = document.getElementById("loginSubmitBtn");
  if (button) button.disabled = busy;
  const googleBtn = document.getElementById("googleSignInBtn");
  if (googleBtn) googleBtn.disabled = busy;
  const userInput = document.getElementById("loginUsername");
  if (userInput) userInput.readOnly = busy;
  const passInput = document.getElementById("loginPassword");
  if (passInput) passInput.readOnly = busy;
}

async function handleLoginSubmit(event) {
  if (event) event.preventDefault();
  if (loginBusy) return;

  const usernameInput = (document.getElementById("loginUsername")?.value || "").trim();
  const password = document.getElementById("loginPassword")?.value || "";

  if (usernameInput.length < 3) {
    setLoginError("Please enter your username or email address.");
    return;
  }

  if (password.length < 4) {
    setLoginError("Password must be at least 4 characters.");
    return;
  }

  setLoginBusy(true);

  try {
    const auth = window.GarageCloud?.getAuth?.() || (typeof firebase !== "undefined" && firebase.auth ? firebase.auth() : null);
    if (!auth) {
      throw new Error("Firebase Auth is loading. Please refresh or check connection.");
    }

    const email = formatAuthEmail(usernameInput);

    if (isRegisterMode) {
      // 1. REGISTER NEW GARAGE MODE (Creates isolated tenant account)
      const garageNameInput = (document.getElementById("regGarageName")?.value || "").trim();
      const ownerNameInput = (document.getElementById("regOwnerName")?.value || "").trim();

      if (!garageNameInput || garageNameInput.length < 2) {
        setLoginError("Please enter your Garage Name (at least 2 letters).");
        setLoginBusy(false);
        return;
      }

      pendingRegistrationProfile = {
        garageName: garageNameInput,
        ownerName: ownerNameInput || "Garage Owner",
      };

      showAuthLoadingOverlay(true, `Setting up ${garageNameInput}...`);
      await auth.createUserWithEmailAndPassword(email, password);
      // onAuthStateChanged triggers and creates users/{uid} with empty data
      document.getElementById("loginForm")?.reset();
      isRegisterMode = false;
      showToast(`🎉 Account created! Welcome to ${garageNameInput}!`);
    } else {
      // 2. SIGN IN EXISTING GARAGE ACCOUNT
      showAuthLoadingOverlay(true, "Signing in to your garage...");
      await auth.signInWithEmailAndPassword(email, password);
      // onAuthStateChanged triggers and loads users/{uid} data
      document.getElementById("loginForm")?.reset();
    }
  } catch (error) {
    console.error("Login / Registration error:", error);
    showAuthLoadingOverlay(false);
    if (error.code === "auth/email-already-in-use") {
      setLoginError("This username or email is already registered. Please sign in instead.");
    } else if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
      setLoginError("Account not found or password incorrect. If you haven't registered yet, please click 'New Garage? Create Free Account' below.");
    } else if (error.code === "auth/weak-password") {
      setLoginError("Password must be at least 6 characters.");
    } else if (error.code === "auth/network-request-failed") {
      setLoginError("Network connection error. Please verify your internet access.");
    } else if (error.code === "auth/operation-not-allowed") {
      setLoginError("Email/Password login is disabled in Firebase Console -> Authentication -> Sign-in method.");
    } else {
      setLoginError(error.message || "Could not complete login. Please try again.");
    }
  } finally {
    setLoginBusy(false);
  }
}

function setLoginError(message) {
  const error = document.getElementById("loginError");
  if (error) {
    error.textContent = message;
    error.hidden = false;
  }
}

async function createLoginSession(member, remember) {
  const token = await hashText(`${AUTH_SALT}|session|${member.username}|${member.passwordHash || member.authProvider || "google"}`);
  const payload = {
    token,
    username: member.username,
    fullName: member.fullName || member.username,
    role: member.role || "Member",
    createdAt: Date.now(),
    expiresAt: remember ? Date.now() + REMEMBER_MS : 0,
  };
  sessionStorage.setItem(STORAGE_KEYS.loginSession, JSON.stringify(payload));
  if (remember) {
    localStorage.setItem(STORAGE_KEYS.loginSession, JSON.stringify(payload));
  } else {
    localStorage.removeItem(STORAGE_KEYS.loginSession);
  }
  currentActiveMember = member;
  localStorage.setItem(STORAGE_KEYS.activeMember, JSON.stringify({
    username: member.username,
    fullName: member.fullName || member.username,
    role: member.role || "Member",
  }));
  verifiedSessionToken = token;
  isAuthenticated = true;
}

async function restoreLoginSession() {
  const session = getStoredSession();
  if (!session || !session.token || !session.username) {
    clearLoginSession();
    return false;
  }

  if (session.expiresAt && Date.now() > session.expiresAt) {
    clearLoginSession();
    return false;
  }

  if (garageFamilyMembers.length === 0) {
    garageFamilyMembers = readJSON(STORAGE_KEYS.familyMembers, []);
  }

  const member = findFamilyMember(session.username);
  if (!member) {
    clearLoginSession();
    return false;
  }

  const expectedToken = await hashText(
    `${AUTH_SALT}|session|${member.username}|${member.passwordHash || member.authProvider || "google"}`,
  );
  const legacyTokenV1 = await hashText(`patel-auto-garage-v1|session|${member.username}|${member.passwordHash}`);
  const legacyTokenV2 = await hashText(`patel-auto-garage-v2|session|${member.username}|${member.passwordHash}`);

  const tokenOk = timingSafeEqual(session.token, expectedToken) ||
                  timingSafeEqual(session.token, legacyTokenV1) ||
                  timingSafeEqual(session.token, legacyTokenV2);

  if (!tokenOk) {
    clearLoginSession();
    return false;
  }

  sessionStorage.setItem(STORAGE_KEYS.loginSession, JSON.stringify(session));
  verifiedSessionToken = session.token;
  currentActiveMember = member;
  isAuthenticated = true;
  return true;
}

function clearLoginSession() {
  isAuthenticated = false;
  verifiedSessionToken = "";
  currentActiveMember = null;
  sessionStorage.removeItem(STORAGE_KEYS.loginSession);
  localStorage.removeItem(STORAGE_KEYS.loginSession);
  sessionStorage.removeItem(STORAGE_KEYS.activeMember);
  localStorage.removeItem(STORAGE_KEYS.activeMember);
}

async function getActivePasskey() {
  if (cloudDb && currentAuthUser) {
    try {
      const doc = await cloudDb.collection("users").doc(currentAuthUser.uid).collection("settings").doc("garage_info").get();
      if (doc.exists && doc.data().familyPasskey) {
        garageFamilyPasskey = String(doc.data().familyPasskey);
        localStorage.setItem(getScopedStorageKey("familyPasskey"), garageFamilyPasskey);
        return garageFamilyPasskey;
      }
    } catch (e) {
      console.warn("Could not fetch passkey from cloud:", e);
    }
  }
  const saved = localStorage.getItem(getScopedStorageKey("familyPasskey"));
  if (saved) return saved;
  return garageFamilyPasskey || "123456";
}

function findFamilyMember(username) {
  const clean = String(username || "").trim().toLowerCase();
  const found = garageFamilyMembers.find((m) => String(m.username || "").toLowerCase() === clean);
  if (found) return found;

  const cached = readJSON(getScopedStorageKey("familyMembers"), []);
  const foundCached = cached.find((m) => String(m.username || "").toLowerCase() === clean);
  if (foundCached) return foundCached;

  const owner = readJSON(getScopedStorageKey("owner"), null);
  if (owner && String(owner.username || "").toLowerCase() === clean) {
    return {
      username: owner.username,
      fullName: owner.fullName || "Owner",
      role: "Owner",
      passwordHash: owner.passwordHash,
    };
  }
  return null;
}

function verifyMemberPassword(member, password) {
  if (!member || !member.passwordHash) return false;
  return verifyOwnerPassword(member, member.username, password);
}

async function syncFamilyMembersFromCloud() {
  if (!cloudDb || !currentAuthUser) return;
  try {
    const snap = await cloudDb.collection("users").doc(currentAuthUser.uid).collection("family").get();
    const members = [];
    snap.forEach((doc) => members.push(doc.data()));

    if (members.length > 0) {
      garageFamilyMembers = members;
      saveFamilyMembersLocally();
    }

    const metaDoc = await cloudDb.collection("users").doc(currentAuthUser.uid).collection("settings").doc("garage_info").get();
    if (metaDoc.exists) {
      const metaData = metaDoc.data();
      if (metaData.familyPasskey) {
        garageFamilyPasskey = String(metaData.familyPasskey);
        localStorage.setItem(getScopedStorageKey("familyPasskey"), garageFamilyPasskey);
      }
      if (metaData.garageName || metaData.ownerName) {
        const cur = getGarageInfo();
        const updated = {
          ...cur,
          garageName: metaData.garageName || cur.garageName,
          ownerName: metaData.ownerName || cur.ownerName,
          phone: metaData.phone !== undefined ? metaData.phone : cur.phone,
          tagline: metaData.tagline !== undefined ? metaData.tagline : cur.tagline,
          address: metaData.address !== undefined ? metaData.address : cur.address,
        };
        saveGarageInfoLocally(updated);
        updateGarageBrandingUI();
      }
    }
  } catch (err) {
    console.warn("Could not sync family members from cloud:", err);
  }
}

function saveFamilyMembersLocally() {
  localStorage.setItem(STORAGE_KEYS.familyMembers, JSON.stringify(garageFamilyMembers));
}

function wipeDashboardState() {
  garageData = [];
  garageExpenses = [];
  currentItems = [];
  editModalItems = [];
  selectedVehicleType = "Bike";
  activeDate = "";
}

function logout() {
  askConfirm(
    "Log out?",
    "The dashboard will be locked. All historical data remains safely stored in the database.",
  ).then(async (ok) => {
    if (!ok) return;
    try {
      showAuthLoadingOverlay(true, "Signing out...");
      stopDayWatcher();
      unsubscribeCloudRealtimeListeners();

      const auth = window.GarageCloud?.getAuth?.() || (typeof firebase !== "undefined" && firebase.auth ? firebase.auth() : null);
      if (auth) {
        await auth.signOut();
      }

      wipeDashboardState();
      isAuthenticated = false;
      dashboardReady = false;
      currentAuthUser = null;

      try {
        sessionStorage.clear();
      } catch (_) {}

      showAuthLoadingOverlay(false);
      showLoginScreen(true);
      showToast("Logged out successfully.");
    } catch (err) {
      console.warn("Logout error:", err);
      showAuthLoadingOverlay(false);
      showLoginScreen(true);
    }
  });
}

function openDashboard() {
  if (!isSessionActive()) {
    showLoginScreen(false);
    return;
  }

  document.body.classList.remove("app-locked");
  const loginScreen = document.getElementById("loginScreen");
  const appShell = document.getElementById("appShell");
  loginScreen.hidden = true;
  loginScreen.inert = true;
  appShell.hidden = false;
  appShell.inert = false;

  // Initialize dates
  lastSystemDate = getLocalDate();
  if (!activeDate) {
    activeDate = lastSystemDate;
  }
  if (!customStartDate || !customEndDate) {
    customStartDate = activeDate;
    customEndDate = activeDate;
  }

  loadData();

  if (garageData.length > 0 && garageData.filter((r) => r.date === activeDate).length === 0) {
    filterScope = "all";
    const scopeAll = document.getElementById("scopeAllBtn");
    const scopeDate = document.getElementById("scopeDateBtn");
    if (scopeAll) scopeAll.classList.add("active");
    if (scopeDate) scopeDate.classList.remove("active");
  }

  if (!dashboardReady) {
    dashboardReady = true;
    setupDOMListeners();
    setupScopeListeners();
    startDayWatcher();
    initializeTheme();
  }

  // Ensure Cloud listeners are running
  if (cloudDb && !cloudRecordsUnsubscribe) {
    setupCloudRealtimeListeners();
  }

  updateWorkingDateUI();
  updateScopeUI();
  renderPartsTable();
  updateBalanceDue();
  updateDashboard();
  refreshRecordsView();
  renderExpensesList();
  renderDayHistory();
  updateCloudSyncStats();
  updateActiveMemberUI();
  renderFamilyMembersTable();
}

function openPasswordModal() {
  if (!requireAuth()) return;
  document.getElementById("currentPassword").value = "";
  document.getElementById("newPassword").value = "";
  document.getElementById("newPasswordConfirm").value = "";
  document.getElementById("passwordModal").hidden = false;
}

function closePasswordModal() {
  document.getElementById("passwordModal").hidden = true;
}

async function saveNewPassword() {
  if (!requireAuth()) return;

  const owner = getOwnerAccount();
  const currentPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("newPasswordConfirm").value;

  if (newPassword.length < 6) {
    showToast("New password must be at least 6 characters.", "error");
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast("New passwords do not match.", "error");
    return;
  }

  try {
    const authUser = firebase.auth().currentUser;
    if (authUser) {
      await authUser.updatePassword(newPassword);
      closePasswordModal();
      showToast("✅ Password updated successfully in Firebase Auth!");
      return;
    }
  } catch (authErr) {
    if (authErr.code === "auth/requires-recent-login") {
      showToast("Security notice: Please sign out and sign in again before changing password.", "error");
    } else {
      showToast(authErr.message || "Failed to update password.", "error");
    }
    return;
  }
  closePasswordModal();
  showToast("Password updated successfully.");
}

function openForgotPasswordModal() {
  const modal = document.getElementById("forgotPasswordModal");
  if (!modal) return;
  const userInput = document.getElementById("forgotUser");

  const rememberedUser = (currentAuthUser && (currentAuthUser.email || currentAuthUser.displayName)) || (document.getElementById("loginUsername")?.value || "").trim();

  if (userInput) userInput.value = rememberedUser;

  modal.hidden = false;
  modal.removeAttribute("aria-hidden");
  setTimeout(() => {
    if (userInput && userInput.focus) {
      userInput.focus();
    }
  }, 100);
}

function closeForgotPasswordModal() {
  const modal = document.getElementById("forgotPasswordModal");
  if (modal) {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }
}

async function handleForgotPasswordSubmit(e) {
  if (e) e.preventDefault();
  const userInput = document.getElementById("forgotUser");
  const raw = (userInput?.value || "").trim();

  if (!raw || raw.length < 3) {
    showToast("Please enter a valid email or username.", "error");
    if (userInput && userInput.focus) userInput.focus();
    return;
  }

  const email = formatAuthEmail(raw);

  try {
    showToast("Sending password reset email...", "info");
    const auth = window.GarageCloud?.getAuth?.() || (typeof firebase !== "undefined" && firebase.auth ? firebase.auth() : null);
    if (!auth) {
      throw new Error("Firebase Auth is loading. Please try again.");
    }

    await auth.sendPasswordResetEmail(email);
    closeForgotPasswordModal();
    if (email.endsWith("@patelgarage.app")) {
      showToast(`Password reset link generated for "${raw}". Check your registered recovery email.`, "success");
    } else {
      showToast(`📧 Password reset link sent to ${email}! Please check your email inbox.`, "success");
    }
  } catch (err) {
    console.error("Password reset error:", err);
    if (err.code === "auth/user-not-found") {
      showToast("No account found with this email/username.", "error");
    } else {
      showToast(err.message || "Could not send reset email.", "error");
    }
  }
}

function setupResetLogin() {
  const resetBtn = document.getElementById("resetLoginBtn");
  if (!resetBtn) return;
  resetBtn.addEventListener("click", () => {
    askConfirm(
      "Reset Login & Clear Local Cache?",
      "This will sign you out and completely reset all local login sessions and cached data on this device. Your garage records, day history, and bills in Firestore will NOT be deleted. Proceed?",
    ).then(async (ok) => {
      if (!ok) return;

      try {
        const auth = window.GarageCloud?.getAuth?.() || (typeof firebase !== "undefined" && firebase.auth ? firebase.auth() : null);
        if (auth) {
          await auth.signOut();
        }
      } catch (_) {}

      // Clear all local storage and session storage
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (_) {}

      wipeDashboardState();
      unsubscribeCloudRealtimeListeners();
      currentAuthUser = null;
      isAuthenticated = false;
      dashboardReady = false;

      isRegisterMode = false;
      updateLoginMode();
      showLoginScreen(true);
      showToast("Login session and device cache cleared successfully.", "info");
    });
  });
}

function hashCredential(username, password) {
  return hashText(`patel-auto-garage-v1|${String(username).trim().toLowerCase()}|${password}`);
}

function verifyOwnerPassword(owner, username, password) {
  if (!owner || !owner.passwordHash) return false;
  const userClean = String(username).trim().toLowerCase();

  // 1. Pure SHA-256 with v1 salt
  const h1 = hashText(`patel-auto-garage-v1|${userClean}|${password}`);
  if (timingSafeEqual(h1, owner.passwordHash)) return true;

  // 2. Pure SHA-256 with v2 salt
  const h2 = hashText(`patel-auto-garage-v2|${userClean}|${password}`);
  if (timingSafeEqual(h2, owner.passwordHash)) return true;

  // 3. FNV-1a fallbacks
  const h3 = fnv1a(`patel-auto-garage-v1|${userClean}|${password}`);
  if (timingSafeEqual(h3, owner.passwordHash)) return true;

  const h4 = fnv1a(`patel-auto-garage-v2|${userClean}|${password}`);
  if (timingSafeEqual(h4, owner.passwordHash)) return true;

  return false;
}

function fnv1a(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function hashText(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const words = [];
  const utf8 = unescape(encodeURIComponent(ascii));
  const length = utf8.length;
  for (let i = 0; i < length; i++) {
    words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << ((3 - (i % 4)) * 8);
  }

  words[length >> 2] |= 0x80 << ((3 - (length % 4)) * 8);
  words[(((length + 8) >> 6) << 4) + 15] = length * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  const w = new Array(64);
  for (let i = 0; i < words.length; i += 16) {
    for (let j = 0; j < 16; j++) {
      w[j] = words[i + j] | 0;
    }
    for (let j = 16; j < 64; j++) {
      const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }

    let a = hash[0], b = hash[1], c = hash[2], d = hash[3];
    let e = hash[4], f = hash[5], g = hash[6], h = hash[7];

    for (let j = 0; j < 64; j++) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ ((~e) & g);
      const temp1 = (h + s1 + ch + k[j] + w[j]) | 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  let result = '';
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j >= 0; j--) {
      const byte = (hash[i] >> (j * 8)) & 255;
      result += (byte < 16 ? '0' : '') + byte.toString(16);
    }
  }

  return result;
}

function timingSafeEqual(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  const length = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;
  for (let i = 0; i < length; i += 1) {
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

function readStorageJSON(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

// =========================================
// CLOUD FIRESTORE SYNCHRONIZATION ENGINE
// =========================================

async function initCloudSync() {
  try {
    if (!window.GarageCloud) {
      updateCloudStatusUI("offline", "Local Mode");
      return false;
    }

    const res = await window.GarageCloud.initialize();
    if (!res.success) {
      console.warn("Cloud initialization result:", res.reason);
      updateCloudStatusUI("offline", "Local Mode");
      return false;
    }

    cloudDb = window.GarageCloud.getDb();
    if (!cloudDb) {
      updateCloudStatusUI("offline", "Local Mode");
      return false;
    }

    cloudSyncActive = true;
    updateCloudStatusUI("online", "Cloud Synced");

    // Setup Realtime Listeners
    setupCloudRealtimeListeners();
    return true;
  } catch (err) {
    console.error("Cloud sync initialization failed:", err);
    updateCloudStatusUI("error", "Cloud Offline");
    return false;
  }
}

// =========================================================
// ONE-TIME DATA MIGRATION CONFIGURATION
// Paste your Firebase User UID below after finding it from:
// Firebase Console -> Authentication -> Users -> copy User UID
// =========================================================
const MIGRATION_TARGET_UID = "PASTE_YOUR_UID_HERE";
const MIGRATION_ADMIN_EMAIL = ""; // e.g. "you@gmail.com" (Optional)

function setupCloudRealtimeListeners(targetUid = currentAuthUser?.uid) {
  const uid = targetUid || currentAuthUser?.uid;
  if (!cloudDb || !uid) return;

  unsubscribeCloudRealtimeListeners();

  const userRef = cloudDb.collection("users").doc(uid);

  // 1. Records real-time listener (isolated tenant subcollection: users/{uid}/jobCards)
  cloudRecordsUnsubscribe = userRef
    .collection("jobCards")
    .onSnapshot(
      (snapshot) => {
        let hasChanges = false;
        const cloudRecords = [];
        snapshot.forEach((doc) => {
          cloudRecords.push(doc.data());
        });

        // Authoritative record map
        const recordMap = new Map();
        cloudRecords.forEach((r) => recordMap.set(String(r.id), r));

        // Retain only local records that are pending offline upload
        garageData.forEach((r) => {
          if (r._pendingSync && !recordMap.has(String(r.id))) {
            recordMap.set(String(r.id), r);
          }
        });

        const merged = Array.from(recordMap.values()).sort(
          (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
        );

        if (JSON.stringify(merged) !== JSON.stringify(garageData) || isInitialCloudLoad) {
          garageData = normalizeRecords(merged);
          hasChanges = true;
        }

        lastCloudSyncTime = Date.now();
        updateCloudSyncStats();
        updateCloudStatusUI("online", "Cloud Synced");

        if (hasChanges || isInitialCloudLoad) {
          saveRecordsLocally();
          if (dashboardReady && isAuthenticated) {
            if (garageData.length > 0 && garageData.filter((r) => r.date === activeDate).length === 0 && filterScope === "date") {
              filterScope = "all";
              const scopeAll = document.getElementById("scopeAllBtn");
              const scopeDate = document.getElementById("scopeDateBtn");
              if (scopeAll) scopeAll.classList.add("active");
              if (scopeDate) scopeDate.classList.remove("active");
            }
            updateDashboard();
            refreshRecordsView();
            renderDayHistory();
          }
        }
        isInitialCloudLoad = false;
      },
      (error) => {
        console.warn("Tenant records listener notice:", error);
        updateCloudStatusUI("offline", "Cloud Offline");
      },
    );

  // 2. Expenses real-time listener (isolated tenant subcollection: users/{uid}/expenses)
  cloudExpensesUnsubscribe = userRef
    .collection("expenses")
    .onSnapshot(
      (snapshot) => {
        let hasExpChanges = false;
        const cloudExpenses = [];
        snapshot.forEach((doc) => {
          cloudExpenses.push(doc.data());
        });

        const expMap = new Map();
        cloudExpenses.forEach((e) => expMap.set(String(e.id), e));

        garageExpenses.forEach((e) => {
          if (e._pendingSync && !expMap.has(String(e.id))) {
            expMap.set(String(e.id), e);
          }
        });

        const mergedExp = Array.from(expMap.values()).sort(
          (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
        );

        if (JSON.stringify(mergedExp) !== JSON.stringify(garageExpenses) || isInitialCloudLoad) {
          garageExpenses = normalizeExpenses(mergedExp);
          hasExpChanges = true;
        }

        lastCloudSyncTime = Date.now();
        updateCloudSyncStats();

        if (hasExpChanges || isInitialCloudLoad) {
          saveExpensesLocally();
          if (dashboardReady && isAuthenticated) {
            updateDashboard();
            renderExpensesList();
            renderDayHistory();
          }
        }
      },
      (error) => {
        console.warn("Tenant expenses listener notice:", error);
      },
    );

  // 3. Settings / Profile real-time listener (users/{uid}/settings/garage_info)
  cloudMetaUnsubscribe = userRef
    .collection("settings")
    .doc("garage_info")
    .onSnapshot(
      (doc) => {
        if (doc.exists) {
          const data = doc.data();
          const current = getGarageInfo();
          const validName = (data.garageName && data.garageName.trim() && data.garageName !== "Add Your Garage Name")
            ? data.garageName.trim()
            : current.garageName;
          const updated = {
            ...current,
            garageName: validName,
            ownerName: data.ownerName || current.ownerName,
            phone: data.phone !== undefined ? data.phone : current.phone,
            tagline: data.tagline !== undefined ? data.tagline : current.tagline,
            address: data.address !== undefined ? data.address : current.address,
            photo: data.photo || current.photo || "",
            isCustom: true,
          };
          saveGarageInfoLocally(updated);
          updateGarageBrandingUI();
        }
      },
      (error) => {
        console.warn("Tenant settings listener notice:", error);
      },
    );
}

function unsubscribeCloudRealtimeListeners() {
  if (cloudRecordsUnsubscribe) {
    cloudRecordsUnsubscribe();
    cloudRecordsUnsubscribe = null;
  }
  if (cloudExpensesUnsubscribe) {
    cloudExpensesUnsubscribe();
    cloudExpensesUnsubscribe = null;
  }
  if (cloudMetaUnsubscribe) {
    cloudMetaUnsubscribe();
    cloudMetaUnsubscribe = null;
  }
  if (cloudFamilyUnsubscribe) {
    cloudFamilyUnsubscribe();
    cloudFamilyUnsubscribe = null;
  }
}

async function saveRecordToCloud(record) {
  if (!record || !record.id) return;
  if (!cloudDb || !currentAuthUser) {
    record._pendingSync = true;
    saveRecordsLocally();
    return;
  }
  try {
    const activeMember = getActiveMember();
    const tag = activeMember ? `${activeMember.fullName || activeMember.username} (${activeMember.role || 'Member'})` : 'Garage Staff';
    if (!record.createdBy) record.createdBy = tag;
    record.lastUpdatedBy = tag;
    record.updatedAt = Date.now();
    record.ownerId = currentAuthUser.uid; // Multi-tenant ownerId

    const toUpload = { ...record };
    delete toUpload._pendingSync;

    await cloudDb
      .collection("users")
      .doc(currentAuthUser.uid)
      .collection("jobCards")
      .doc(String(record.id))
      .set(toUpload);

    record._pendingSync = false;
    saveRecordsLocally();
    lastCloudSyncTime = Date.now();
    updateCloudSyncStats();
  } catch (err) {
    console.warn("Cloud save record failed (cached locally as pending):", err);
    record._pendingSync = true;
    saveRecordsLocally();
  }
}

async function deleteRecordFromCloud(recordId) {
  if (!recordId) return;
  if (!cloudDb || !currentAuthUser) {
    queuePendingDeletion("jobCards", recordId);
    return;
  }
  try {
    await cloudDb
      .collection("users")
      .doc(currentAuthUser.uid)
      .collection("jobCards")
      .doc(String(recordId))
      .delete();
    lastCloudSyncTime = Date.now();
    updateCloudSyncStats();
  } catch (err) {
    console.warn("Cloud delete record failed (queued for retry):", err);
    queuePendingDeletion("jobCards", recordId);
  }
}

async function saveExpenseToCloud(expense) {
  if (!expense || !expense.id) return;
  if (!cloudDb || !currentAuthUser) {
    expense._pendingSync = true;
    saveExpensesLocally();
    return;
  }
  try {
    const activeMember = getActiveMember();
    const tag = activeMember ? `${activeMember.fullName || activeMember.username} (${activeMember.role || 'Member'})` : 'Garage Staff';
    if (!expense.recordedBy) expense.recordedBy = tag;
    expense.updatedAt = Date.now();
    expense.ownerId = currentAuthUser.uid; // Multi-tenant ownerId

    const toUpload = { ...expense };
    delete toUpload._pendingSync;

    await cloudDb
      .collection("users")
      .doc(currentAuthUser.uid)
      .collection("expenses")
      .doc(String(expense.id))
      .set(toUpload);

    expense._pendingSync = false;
    saveExpensesLocally();
    lastCloudSyncTime = Date.now();
    updateCloudSyncStats();
  } catch (err) {
    console.warn("Cloud save expense failed (cached locally as pending):", err);
    expense._pendingSync = true;
    saveExpensesLocally();
  }
}

async function deleteExpenseFromCloud(expenseId) {
  if (!expenseId) return;
  if (!cloudDb || !currentAuthUser) {
    queuePendingDeletion("expenses", expenseId);
    return;
  }
  try {
    await cloudDb
      .collection("users")
      .doc(currentAuthUser.uid)
      .collection("expenses")
      .doc(String(expenseId))
      .delete();
    lastCloudSyncTime = Date.now();
    updateCloudSyncStats();
  } catch (err) {
    console.warn("Cloud delete expense failed (queued for retry):", err);
    queuePendingDeletion("expenses", expenseId);
  }
}

function queuePendingDeletion(collectionName, itemId) {
  try {
    const raw = localStorage.getItem(getScopedStorageKey("pendingDeletions"));
    const list = raw ? JSON.parse(raw) : [];
    list.push({ collection: collectionName, id: String(itemId), timestamp: Date.now() });
    localStorage.setItem(getScopedStorageKey("pendingDeletions"), JSON.stringify(list));
  } catch (e) {
    console.warn("Failed queuing pending deletion:", e);
  }
}

async function flushPendingSyncQueue() {
  if (!cloudDb || !currentAuthUser) return;

  // 1. Process pending deletions
  try {
    const raw = localStorage.getItem(getScopedStorageKey("pendingDeletions"));
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) {
        const remaining = [];
        for (const item of list) {
          try {
            const subcoll = (item.collection === "patel_expenses" || item.collection === "expenses") ? "expenses" : "jobCards";
            await cloudDb.collection("users").doc(currentAuthUser.uid).collection(subcoll).doc(String(item.id)).delete();
          } catch (delErr) {
            remaining.push(item);
          }
        }
        if (remaining.length > 0) {
          localStorage.setItem(getScopedStorageKey("pendingDeletions"), JSON.stringify(remaining));
        } else {
          localStorage.removeItem(getScopedStorageKey("pendingDeletions"));
        }
      }
    }
  } catch (e) {
    console.warn("Error flushing pending deletions:", e);
  }

  // 2. Process pending records
  let savedRecords = false;
  for (const r of garageData) {
    if (r._pendingSync) {
      try {
        const toUpload = { ...r, ownerId: currentAuthUser.uid };
        delete toUpload._pendingSync;
        await cloudDb.collection("users").doc(currentAuthUser.uid).collection("jobCards").doc(String(r.id)).set(toUpload);
        r._pendingSync = false;
        savedRecords = true;
      } catch (e) {
        console.warn("Error syncing pending record:", e);
      }
    }
  }
  if (savedRecords) saveRecordsLocally();

  // 3. Process pending expenses
  let savedExpenses = false;
  for (const exp of garageExpenses) {
    if (exp._pendingSync) {
      try {
        const toUpload = { ...exp, ownerId: currentAuthUser.uid };
        delete toUpload._pendingSync;
        await cloudDb.collection("users").doc(currentAuthUser.uid).collection("expenses").doc(String(exp.id)).set(toUpload);
        exp._pendingSync = false;
        savedExpenses = true;
      } catch (e) {
        console.warn("Error syncing pending expense:", e);
      }
    }
  }
  if (savedExpenses) saveExpensesLocally();
}

/**
 * ONE-TIME SAFE MIGRATION FUNCTION
 * Copies existing global-collection data (patel_records, patel_expenses, patel_meta)
 * into users/{targetUid}/... with ownerId added. Batched writes (max 400 per batch).
 * Does NOT delete the original data.
 */
async function runOneTimeMigration(targetUid) {
  if (!cloudDb) {
    showToast("Cloud database not connected. Please connect first.", "error");
    return;
  }

  const uid = (
    targetUid ||
    document.getElementById("migrationTargetUidInput")?.value ||
    (typeof MIGRATION_TARGET_UID !== "undefined" && MIGRATION_TARGET_UID !== "PASTE_YOUR_UID_HERE" ? MIGRATION_TARGET_UID : "") ||
    currentAuthUser?.uid ||
    ""
  ).trim();

  if (!uid) {
    showToast("Please provide your target User UID.", "error");
    return;
  }

  const statusEl = document.getElementById("migrationStatus");
  if (statusEl) {
    statusEl.style.display = "block";
    statusEl.textContent = `⏳ Starting migration to users/${uid}...\nPlease wait.`;
  }

  console.log(`Starting one-time migration to users/${uid}...`);
  let recordsCount = 0;
  let expensesCount = 0;
  let settingsCount = 0;

  try {
    const userDocRef = cloudDb.collection("users").doc(uid);

    // 1. Migrate Records from patel_records or jobCards
    let recSnap = null;
    try {
      recSnap = await cloudDb.collection("patel_records").get();
    } catch (e) {
      console.warn("Could not read patel_records:", e);
    }

    if (!recSnap || recSnap.empty) {
      try {
        recSnap = await cloudDb.collection("jobCards").get();
      } catch (_) {}
    }

    if (recSnap && !recSnap.empty) {
      const docs = recSnap.docs;
      const BATCH_SIZE = 400; // Requirement: max 400 per batch
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = cloudDb.batch();
        const slice = docs.slice(i, i + BATCH_SIZE);
        slice.forEach((d) => {
          const data = d.data();
          data.ownerId = uid;
          const targetRef = userDocRef.collection("jobCards").doc(d.id);
          batch.set(targetRef, data, { merge: true });
          recordsCount++;
        });
        await batch.commit();
        console.log(`Migrated batch of ${slice.length} records...`);
      }
      console.log(`Successfully migrated ${recordsCount} records to users/${uid}/jobCards`);
    }

    // 2. Migrate Expenses from patel_expenses or expenses
    let expSnap = null;
    try {
      expSnap = await cloudDb.collection("patel_expenses").get();
    } catch (e) {
      console.warn("Could not read patel_expenses:", e);
    }

    if (!expSnap || expSnap.empty) {
      try {
        expSnap = await cloudDb.collection("expenses").get();
      } catch (_) {}
    }

    if (expSnap && !expSnap.empty) {
      const docs = expSnap.docs;
      const BATCH_SIZE = 400;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = cloudDb.batch();
        const slice = docs.slice(i, i + BATCH_SIZE);
        slice.forEach((d) => {
          const data = d.data();
          data.ownerId = uid;
          const targetRef = userDocRef.collection("expenses").doc(d.id);
          batch.set(targetRef, data, { merge: true });
          expensesCount++;
        });
        await batch.commit();
        console.log(`Migrated batch of ${slice.length} expenses...`);
      }
      console.log(`Successfully migrated ${expensesCount} expenses to users/${uid}/expenses`);
    }

    // 3. Migrate Settings / Meta from patel_meta/garage_info
    try {
      const metaDoc = await cloudDb.collection("patel_meta").doc("garage_info").get();
      if (metaDoc.exists) {
        const metaData = metaDoc.data();
        metaData.ownerId = uid;
        await userDocRef.collection("settings").doc("garage_info").set(metaData, { merge: true });
        await userDocRef.set({
          ownerId: uid,
          garageName: metaData.garageName || "Patel Auto Garage & Service",
          ownerName: metaData.ownerName || "Garage Owner",
          photo: metaData.photo || "",
          phone: metaData.phone || "",
          tagline: metaData.tagline || "",
          address: metaData.address || "",
          updatedAt: Date.now(),
        }, { merge: true });
        settingsCount = 1;
        console.log(`Successfully migrated settings to users/${uid}/settings/garage_info`);
      }
    } catch (metaErr) {
      console.warn("Notice reading patel_meta:", metaErr);
    }

    const summary = `🎉 Data Migration Completed Successfully!\n` +
      `----------------------------------------\n` +
      `• Job Cards copied: ${recordsCount}\n` +
      `• Expenses copied: ${expensesCount}\n` +
      `• Settings copied: ${settingsCount}\n` +
      `• Destination: users/${uid}/...\n` +
      `• Original global data: PRESERVED\n` +
      `----------------------------------------\n` +
      `You can now safely publish the final Firestore Security Rules!`;

    if (statusEl) {
      statusEl.style.display = "block";
      statusEl.textContent = summary;
    }
    console.log(summary);
    const migBanner = document.getElementById("migrationAlertBanner");
    if (migBanner) migBanner.style.display = "none";
    showToast(`🎉 Migrated ${recordsCount} records & ${expensesCount} expenses!`, "success");
    alert(summary);

    if (currentAuthUser && currentAuthUser.uid === uid) {
      setupCloudRealtimeListeners(uid);
    }
  } catch (err) {
    console.error("Migration error:", err);
    const errMsg = `❌ Migration Failed: ${err.message}`;
    if (statusEl) statusEl.textContent = errMsg;
    showToast(errMsg, "error");
    alert(errMsg);
  }
}

function updateActiveMemberUI() {
  const member = getActiveMember();
  const info = getGarageInfo();
  const nameEl = document.getElementById("topbarMemberName");
  const roleEl = document.getElementById("topbarMemberRole");
  const countEl = document.getElementById("topbarFamilyCount");

  if (nameEl) nameEl.textContent = member ? (member.fullName || member.username) : (info.ownerName || "Owner");
  if (roleEl) roleEl.textContent = member ? (member.role || "Admin") : "Admin";
  if (countEl) countEl.textContent = garageFamilyMembers.length || 1;
}

let tempProfilePhoto = "";

function setupProfilePhotoListeners() {
  const chooseBtn = document.getElementById("profilePhotoChooseBtn");
  const input = document.getElementById("profilePhotoInput");
  const removeBtn = document.getElementById("profilePhotoRemoveBtn");
  const previewImg = document.getElementById("profilePhotoPreviewImg");
  const placeholder = document.getElementById("profilePhotoPlaceholderIcon");

  if (chooseBtn && input) {
    chooseBtn.addEventListener("click", () => input.click());
    input.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        tempProfilePhoto = await processImageFile(file);
        if (previewImg) {
          previewImg.src = tempProfilePhoto;
          previewImg.style.display = "block";
        }
        if (placeholder) placeholder.style.display = "none";
        if (removeBtn) removeBtn.style.display = "inline-block";
      } catch (err) {
        showToast(err.message || "Could not process photo.", "error");
      }
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      tempProfilePhoto = "";
      if (input) input.value = "";
      if (previewImg) {
        previewImg.src = "";
        previewImg.style.display = "none";
      }
      if (placeholder) placeholder.style.display = "block";
      removeBtn.style.display = "none";
    });
  }
}

// GARAGE PROFILE MODAL CONTROLLERS
function openGarageProfileModal() {
  if (!requireAuth()) return;
  const info = getGarageInfo();
  const nameInput = document.getElementById("profileGarageName");
  const ownerInput = document.getElementById("profileOwnerName");
  const phoneInput = document.getElementById("profilePhone");
  const taglineInput = document.getElementById("profileTagline");
  const addressInput = document.getElementById("profileAddress");

  if (nameInput) nameInput.value = info.garageName || "";
  if (ownerInput) ownerInput.value = info.ownerName || "";
  if (phoneInput) phoneInput.value = info.phone || "";
  if (taglineInput) taglineInput.value = info.tagline || "";
  if (addressInput) addressInput.value = info.address || "";

  tempProfilePhoto = info.photo || "";
  const profilePreview = document.getElementById("profilePhotoPreviewImg");
  const profilePlaceholder = document.getElementById("profilePhotoPlaceholderIcon");
  const profileRemoveBtn = document.getElementById("profilePhotoRemoveBtn");
  if (tempProfilePhoto && profilePreview) {
    profilePreview.src = tempProfilePhoto;
    profilePreview.style.display = "block";
    if (profilePlaceholder) profilePlaceholder.style.display = "none";
    if (profileRemoveBtn) profileRemoveBtn.style.display = "inline-block";
  } else if (profilePreview) {
    profilePreview.src = "";
    profilePreview.style.display = "none";
    if (profilePlaceholder) profilePlaceholder.style.display = "block";
    if (profileRemoveBtn) profileRemoveBtn.style.display = "none";
  }

  const modal = document.getElementById("garageProfileModal");
  if (modal) {
    modal.hidden = false;
    modal.removeAttribute("aria-hidden");
  }
}

function closeGarageProfileModal() {
  const modal = document.getElementById("garageProfileModal");
  if (modal) {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }
}

async function saveGarageProfile() {
  if (!requireAuth()) return;
  const nameInput = document.getElementById("profileGarageName");
  const ownerInput = document.getElementById("profileOwnerName");
  const phoneInput = document.getElementById("profilePhone");
  const taglineInput = document.getElementById("profileTagline");
  const addressInput = document.getElementById("profileAddress");

  const garageName = (nameInput?.value || "").trim();
  const ownerName = (ownerInput?.value || "").trim();
  const phone = (phoneInput?.value || "").trim();
  const tagline = (taglineInput?.value || "").trim();
  const address = (addressInput?.value || "").trim();

  if (!garageName || garageName.length < 2) {
    showToast("Please enter a valid garage name (at least 2 letters).", "error");
    if (nameInput) nameInput.focus();
    return;
  }

  const currentInfo = getGarageInfo();
  const activeMember = getActiveMember();

  const updatedInfo = {
    ...currentInfo,
    garageName,
    ownerName: ownerName || currentInfo.ownerName || "Garage Owner",
    phone,
    tagline: tagline || "Professional Vehicle Service, Maintenance & Repair",
    address,
    photo: (tempProfilePhoto !== undefined && tempProfilePhoto !== "") ? tempProfilePhoto : (currentInfo.photo || ""),
    isCustom: true,
  };

  saveGarageInfoLocally(updatedInfo);

  if (activeMember) {
    if (currentActiveMember) {
      currentActiveMember.garageName = garageName;
      if (ownerName) currentActiveMember.fullName = ownerName;
      localStorage.setItem(STORAGE_KEYS.activeMember, JSON.stringify({
        username: activeMember.username,
        fullName: ownerName || activeMember.fullName,
        role: activeMember.role || "Owner",
      }));
    }
    const owner = readJSON(STORAGE_KEYS.owner, null);
    if (owner) {
      owner.garageName = garageName;
      if (ownerName) owner.fullName = ownerName;
      owner.photo = updatedInfo.photo;
      localStorage.setItem(STORAGE_KEYS.owner, JSON.stringify(owner));
    }
    garageFamilyMembers = garageFamilyMembers.map((m) => {
      if (m.username === activeMember.username) {
        return { ...m, garageName, fullName: ownerName || m.fullName, photo: updatedInfo.photo };
      }
      return m;
    });
    saveFamilyMembersLocally();

    if (cloudDb && currentAuthUser) {
      saveGarageSettings(updatedInfo);
    }
  }

  updateGarageBrandingUI();
  closeGarageProfileModal();
  showToast("Garage Profile updated successfully!");
}

function setupGarageProfileListeners() {
  setupProfilePhotoListeners();

  const profileBtn = document.getElementById("garageProfileBtn");
  if (profileBtn) {
    profileBtn.addEventListener("click", openGarageProfileModal);
  }

  const closeBtn = document.getElementById("garageProfileCloseBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", closeGarageProfileModal);
  }

  const cancelBtn = document.getElementById("garageProfileCancelBtn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", closeGarageProfileModal);
  }

  const saveBtn = document.getElementById("garageProfileSaveBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", saveGarageProfile);
  }

  const modal = document.getElementById("garageProfileModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target.id === "garageProfileModal") {
        closeGarageProfileModal();
      }
    });
  }
}

function setupFamilyListeners() {
  const manageBtn = document.getElementById("manageFamilyBtn");
  if (manageBtn) {
    manageBtn.addEventListener("click", openFamilyModal);
  }

  const closeBtn = document.getElementById("familyModalCloseBtn");
  const closeFooter = document.getElementById("familyModalCloseFooterBtn");
  if (closeBtn) closeBtn.addEventListener("click", closeFamilyModal);
  if (closeFooter) closeFooter.addEventListener("click", closeFamilyModal);

  const modal = document.getElementById("familyModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target.id === "familyModal") closeFamilyModal();
    });
  }

  // Copy 1-tap share link for brother's device
  const copyBtn = document.getElementById("copyFamilyShareLinkBtn");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      let link = window.GarageCloud ? window.GarageCloud.generateShareLink() : null;
      if (!link) {
        link = window.location.href;
      }
      try {
        await navigator.clipboard.writeText(link);
        showToast("📋 1-Tap setup link copied! Send it to your brother via WhatsApp.");
      } catch (err) {
        prompt("Copy this link and send to your brother:", link);
      }
    });
  }

  // Change Passkey PIN
  const editPinBtn = document.getElementById("editFamilyPasskeyBtn");
  if (editPinBtn) {
    editPinBtn.addEventListener("click", async () => {
      const currentPin = garageFamilyPasskey || "123456";
      const newPin = prompt("Enter new 6-digit Family Security Passkey (PIN):", currentPin);
      if (!newPin || newPin.trim().length < 4) {
        if (newPin !== null) showToast("Passkey PIN must be at least 4 digits.", "error");
        return;
      }
      const cleanPin = newPin.trim();
      garageFamilyPasskey = cleanPin;
      localStorage.setItem(STORAGE_KEYS.familyPasskey, cleanPin);
      const input = document.getElementById("familyPasskeyInput");
      if (input) input.value = cleanPin;

      if (cloudDb && currentAuthUser) {
        try {
          await cloudDb.collection("users").doc(currentAuthUser.uid).collection("settings").doc("garage_info").set(
            { familyPasskey: cleanPin, updatedAt: Date.now() },
            { merge: true }
          );
          showToast("✅ Passkey updated!");
        } catch (e) {
          console.warn("Could not sync passkey to cloud:", e);
        }
      } else {
        showToast("Passkey saved locally.");
      }
    });
  }

  // Toggle Add Member inline form
  const toggleAddBtn = document.getElementById("toggleAddMemberFormBtn");
  const addForm = document.getElementById("addFamilyMemberForm");
  const cancelAddBtn = document.getElementById("cancelAddMemberBtn");

  if (toggleAddBtn && addForm) {
    toggleAddBtn.addEventListener("click", () => {
      addForm.hidden = !addForm.hidden;
      if (!addForm.hidden) {
        document.getElementById("newMemberName").focus();
      }
    });
  }

  if (cancelAddBtn && addForm) {
    cancelAddBtn.addEventListener("click", () => {
      addForm.hidden = true;
      addForm.reset();
    });
  }

  if (addForm) {
    addForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("newMemberName").value.trim();
      const username = document.getElementById("newMemberUsername").value.trim().toLowerCase();
      const role = document.getElementById("newMemberRole").value;
      const password = document.getElementById("newMemberPassword").value;

      if (username.length < 3) {
        showToast("Username must be at least 3 characters.", "error");
        return;
      }
      if (password.length < 6) {
        showToast("Password must be at least 6 characters.", "error");
        return;
      }

      if (findFamilyMember(username)) {
        showToast("A member with this username already exists.", "error");
        return;
      }

      const passwordHash = await hashCredential(username, password);
      const newMember = {
        username,
        fullName: name || username,
        role,
        passwordHash,
        createdAt: Date.now(),
        status: "active",
      };

      garageFamilyMembers.push(newMember);
      saveFamilyMembersLocally();

      if (cloudDb && currentAuthUser) {
        try {
          await cloudDb.collection("users").doc(currentAuthUser.uid).collection("family").doc(username).set({
            ...newMember,
            ownerId: currentAuthUser.uid,
          });
          showToast(`✅ Added ${newMember.fullName} (${newMember.role})!`);
        } catch (err) {
          console.error("Failed to add member to cloud:", err);
          showToast("Saved locally, cloud error.", "warning");
        }
      } else {
        showToast(`Saved ${newMember.fullName} locally.`);
      }

      addForm.reset();
      addForm.hidden = true;
      renderFamilyMembersTable();
    });
  }
}

function openFamilyModal() {
  const pinInput = document.getElementById("familyPasskeyInput");
  if (pinInput) pinInput.value = garageFamilyPasskey || "123456";
  renderFamilyMembersTable();
  document.getElementById("familyModal").hidden = false;
}

function closeFamilyModal() {
  document.getElementById("familyModal").hidden = true;
  const addForm = document.getElementById("addFamilyMemberForm");
  if (addForm) {
    addForm.hidden = true;
    addForm.reset();
  }
}

function renderFamilyMembersTable() {
  const tbody = document.getElementById("familyMembersTbody");
  const countEl = document.getElementById("familyMemberCount");
  const topbarCount = document.getElementById("topbarFamilyCount");
  if (!tbody) return;

  if (countEl) countEl.textContent = garageFamilyMembers.length || 1;
  if (topbarCount) topbarCount.textContent = garageFamilyMembers.length || 1;

  if (garageFamilyMembers.length === 0) {
    const active = getActiveMember();
    if (active) {
      garageFamilyMembers = [active];
    }
  }

  tbody.innerHTML = garageFamilyMembers.map((m) => {
    const isOwner = m.role === "Owner";
    const canDelete = !isOwner && (!currentActiveMember || currentActiveMember.username !== m.username);
    return `
      <tr>
        <td><strong>${escapeHTML(m.fullName || m.username)}</strong></td>
        <td><code>@${escapeHTML(m.username)}</code></td>
        <td><span class="member-badge-role">${escapeHTML(m.role || "Member")}</span></td>
        <td><span class="member-badge-status">Active</span></td>
        <td>
          ${
            canDelete
              ? `<button type="button" class="btn-action btn-delete" onclick="removeFamilyMember('${escapeHTML(m.username)}')" title="Revoke access"><i class="fa-solid fa-trash"></i></button>`
              : `<small style="color: var(--text-muted); font-size: 0.75rem;">${isOwner ? "Master Account" : "Current User"}</small>`
          }
        </td>
      </tr>
    `;
  }).join("");
}

window.removeFamilyMember = async function(username) {
  const clean = String(username || "").toLowerCase();
  const ok = await askConfirm("Revoke Access?", `Are you sure you want to remove family member @${clean}? They will no longer be able to log in.`);
  if (!ok) return;

  garageFamilyMembers = garageFamilyMembers.filter((m) => String(m.username || "").toLowerCase() !== clean);
  saveFamilyMembersLocally();

  if (cloudDb && currentAuthUser) {
    try {
      await cloudDb.collection("users").doc(currentAuthUser.uid).collection("family").doc(clean).delete();
      showToast(`Removed @${clean} from cloud database.`);
    } catch (e) {
      console.warn("Could not delete member from cloud:", e);
    }
  }
  renderFamilyMembersTable();
};

async function forceCloudSync() {
  if (!cloudDb || !currentAuthUser) {
    const ok = await initCloudSync();
    if (!ok || !currentAuthUser) {
      showToast("Cannot connect to cloud database. Please verify configuration.", "error");
      return;
    }
  }

  showToast("Syncing with cloud database...", "info");
  try {
    await flushPendingSyncQueue();

    const userRef = cloudDb.collection("users").doc(currentAuthUser.uid);
    const recSnap = await userRef.collection("jobCards").get();
    const cloudRecords = [];
    recSnap.forEach((doc) => cloudRecords.push(doc.data()));

    const expSnap = await userRef.collection("expenses").get();
    const cloudExpenses = [];
    expSnap.forEach((doc) => cloudExpenses.push(doc.data()));

    const rMap = new Map();
    cloudRecords.forEach((r) => rMap.set(String(r.id), r));
    // Retain only local records that are pending offline sync
    garageData.forEach((r) => {
      if (r._pendingSync && !rMap.has(String(r.id))) {
        rMap.set(String(r.id), r);
      }
    });
    garageData = normalizeRecords(
      Array.from(rMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    );

    const eMap = new Map();
    cloudExpenses.forEach((e) => eMap.set(String(e.id), e));
    // Retain only local expenses that are pending offline sync
    garageExpenses.forEach((e) => {
      if (e._pendingSync && !eMap.has(String(e.id))) {
        eMap.set(String(e.id), e);
      }
    });
    garageExpenses = normalizeExpenses(
      Array.from(eMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    );

    saveRecordsLocally();
    saveExpensesLocally();

    lastCloudSyncTime = Date.now();
    updateCloudSyncStats();
    updateDashboard();
    refreshRecordsView();
    renderExpensesList();
    renderDayHistory();
    showToast(`Synced ${cloudRecords.length} records & ${cloudExpenses.length} expenses from cloud.`);
  } catch (e) {
    console.error("Force sync failed:", e);
    showToast("Sync failed. Check connection.", "error");
  }
}

function updateCloudStatusUI(state, text) {
  const dot = document.getElementById("cloudStatusDot");
  const label = document.getElementById("cloudStatusLabel");
  const mini = document.getElementById("cloudMiniStatus");
  const pill = document.getElementById("cloudStatusPill");
  const loginDot = document.getElementById("loginCloudDot");
  const loginLabel = document.getElementById("loginCloudLabel");

  if (dot) {
    dot.className = `cloud-status-dot is-${state}`;
  }
  if (label) {
    label.textContent = text;
  }
  if (mini) {
    mini.textContent = state === "online" ? "Shared Cloud: Synced" : `Shared Cloud: ${text}`;
  }
  if (pill) {
    pill.textContent = state === "online" ? "Connected & Real-Time" : text;
    pill.className = `cloud-pill is-${state}`;
  }

  // Login Screen Cloud Indicators (Always clean and steady)
  if (loginDot) {
    loginDot.className = `cloud-status-dot is-${state === "online" ? "online" : "online"}`;
  }
  if (loginLabel) {
    loginLabel.textContent = "Cloud Synced";
  }
}

function updateCloudSyncStats() {
  const recEl = document.getElementById("cloudRecordsCount");
  const expEl = document.getElementById("cloudExpensesCount");
  const timeEl = document.getElementById("cloudLastSyncText");

  if (recEl) recEl.textContent = garageData.length;
  if (expEl) expEl.textContent = garageExpenses.length;
  if (timeEl) {
    timeEl.textContent = lastCloudSyncTime
      ? new Date(lastCloudSyncTime).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : "Pending sync";
  }
}

function setupCloudListeners() {
  const syncBtn = document.getElementById("cloudSyncBtn");
  if (syncBtn) {
    syncBtn.addEventListener("click", openCloudModal);
  }

  // Topbar and Banner Migration Open Buttons
  const topbarMigBtn = document.getElementById("topbarMigrateBtn");
  if (topbarMigBtn) {
    topbarMigBtn.addEventListener("click", () => {
      openCloudModal();
      document.getElementById("migrationSection")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  const bannerMigBtn = document.getElementById("openMigrationModalBtn");
  if (bannerMigBtn) {
    bannerMigBtn.addEventListener("click", () => {
      openCloudModal();
      document.getElementById("migrationSection")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  // Login Screen Cloud Buttons
  const loginCloudBtn = document.getElementById("loginCloudBtn");
  if (loginCloudBtn) {
    loginCloudBtn.addEventListener("click", openCloudModal);
  }

  const closeBtn = document.getElementById("cloudModalCloseBtn");
  const doneBtn = document.getElementById("cloudModalDoneBtn");
  if (closeBtn) closeBtn.addEventListener("click", closeCloudModal);
  if (doneBtn) doneBtn.addEventListener("click", closeCloudModal);

  const forceBtn = document.getElementById("cloudForceSyncBtn");
  if (forceBtn) forceBtn.addEventListener("click", forceCloudSync);

  const migrateBtn = document.getElementById("cloudMigrateBtn");
  if (migrateBtn) migrateBtn.addEventListener("click", () => runOneTimeMigration());

  const runMigBtn = document.getElementById("runMigrationBtn");
  if (runMigBtn) {
    runMigBtn.addEventListener("click", () => {
      const targetInput = document.getElementById("migrationTargetUidInput");
      const targetUid = (targetInput?.value || "").trim() || currentAuthUser?.uid;
      if (!targetUid) {
        showToast("Please enter your target user UID.", "error");
        return;
      }
      if (confirm(`Start copying all old global data into account users/${targetUid}? This will NOT delete any original data.`)) {
        runOneTimeMigration(targetUid);
      }
    });
  }

  // 1-Tap setup link for phone / WhatsApp sharing
  const copyCloudLinkBtn = document.getElementById("copyCloudShareLinkBtn");
  if (copyCloudLinkBtn) {
    copyCloudLinkBtn.addEventListener("click", async () => {
      let link = window.GarageCloud ? window.GarageCloud.generateShareLink() : null;
      if (!link) {
        showToast("Configure cloud database first before creating a share link.", "error");
        return;
      }
      try {
        await navigator.clipboard.writeText(link);
        showToast("📋 1-Tap setup link copied! Send it to your phone or brother via WhatsApp.");
      } catch (err) {
        prompt("Copy this 1-tap link to connect other devices:", link);
      }
    });
  }

  // 1-Click Paste Config Snippet
  const applySnippetBtn = document.getElementById("applySnippetBtn");
  const snippetInput = document.getElementById("cfgSnippetInput");
  if (applySnippetBtn && snippetInput) {
    applySnippetBtn.addEventListener("click", async () => {
      const raw = snippetInput.value.trim();
      if (!raw) {
        showToast("Please paste your Firebase config snippet first.", "error");
        return;
      }
      if (!window.GarageCloud) {
        showToast("Cloud database module not loaded.", "error");
        return;
      }
      const parsed = window.GarageCloud.parseSnippet(raw);
      if (!parsed) {
        showToast("Could not parse config. Ensure apiKey & projectId are present.", "error");
        return;
      }
      window.GarageCloud.saveConfig(parsed);
      populateCloudConfigForm();
      showToast("Config parsed & saved! Connecting to Firebase...", "info");
      const ok = await initCloudSync();
      if (ok) {
        showToast("🎉 Connected to shared Firebase Firestore database!");
        closeCloudModal();
      } else {
        showToast("Connection failed. Check your Firebase credentials or rules.", "error");
      }
    });
  }

  const toggleConfig = document.getElementById("cloudConfigToggle");
  const configBody = document.getElementById("cloudConfigBody");
  const toggleText = document.getElementById("cloudConfigToggleText");
  if (toggleConfig && configBody) {
    toggleConfig.addEventListener("click", () => {
      const isHidden = configBody.hidden;
      configBody.hidden = !isHidden;
      if (toggleText) {
        toggleText.innerHTML = isHidden
          ? 'Hide Settings <i class="fa-solid fa-chevron-up"></i>'
          : 'Show Settings <i class="fa-solid fa-chevron-down"></i>';
      }
    });
  }

  const saveCfgBtn = document.getElementById("saveCloudConfigBtn");
  if (saveCfgBtn) {
    saveCfgBtn.addEventListener("click", async () => {
      const cfg = {
        apiKey: document.getElementById("cfgApiKey").value.trim(),
        projectId: document.getElementById("cfgProjectId").value.trim(),
        authDomain: document.getElementById("cfgAuthDomain").value.trim(),
        storageBucket: document.getElementById("cfgStorageBucket").value.trim(),
        messagingSenderId: document.getElementById("cfgMessagingSenderId").value.trim(),
        appId: document.getElementById("cfgAppId").value.trim(),
      };

      if (!cfg.projectId || !cfg.apiKey) {
        showToast("Please enter at least Project ID and API Key.", "error");
        return;
      }

      if (window.GarageCloud) {
        window.GarageCloud.saveConfig(cfg);
        showToast("Configuration saved. Connecting...", "info");
        const ok = await initCloudSync();
        if (ok) {
          showToast("🎉 Connected to shared Firebase Firestore database!");
          closeCloudModal();
        } else {
          showToast("Could not connect. Please check credentials.", "error");
        }
      }
    });
  }

  const resetCfgBtn = document.getElementById("resetCloudConfigBtn");
  if (resetCfgBtn) {
    resetCfgBtn.addEventListener("click", async () => {
      if (window.GarageCloud) {
        window.GarageCloud.clearConfig();
        populateCloudConfigForm();
        if (snippetInput) snippetInput.value = "";
        showToast("Reset to default configuration.");
        await initCloudSync();
      }
    });
  }

  // Network online/offline event listeners
  window.addEventListener("online", async () => {
    console.log("Device is online. Re-checking cloud database...");
    if (!cloudDb && window.GarageCloud && window.GarageCloud.isConfigured()) {
      await initCloudSync();
    }
    await flushPendingSyncQueue();
  });

  window.addEventListener("offline", () => {
    console.warn("Device is offline. Local changes will be queued for sync.");
    updateCloudStatusUI("offline", "Offline (Cached Locally)");
  });
}

function openCloudModal() {
  populateCloudConfigForm();
  updateCloudSyncStats();
  document.getElementById("cloudModal").hidden = false;
}

function closeCloudModal() {
  document.getElementById("cloudModal").hidden = true;
}

function populateCloudConfigForm() {
  if (!window.GarageCloud) return;
  const cfg = window.GarageCloud.getConfig();
  if (!cfg) return;

  const fields = {
    cfgApiKey: cfg.apiKey || "",
    cfgProjectId: cfg.projectId || "",
    cfgAuthDomain: cfg.authDomain || "",
    cfgStorageBucket: cfg.storageBucket || "",
    cfgMessagingSenderId: cfg.messagingSenderId || "",
    cfgAppId: cfg.appId || "",
  };

  Object.entries(fields).forEach(([id, val]) => {
    const input = document.getElementById(id);
    if (input) input.value = val;
  });
}

// =========================================
// DATA PERSISTENCE & LOCAL CACHING
// =========================================

function loadData() {
  const uid = currentAuthUser?.uid;
  if (!uid) {
    garageData = [];
    garageExpenses = [];
    return;
  }
  garageData = normalizeRecords(readJSON(getScopedStorageKey("records", uid), []));
  garageExpenses = normalizeExpenses(readJSON(getScopedStorageKey("expenses", uid), []));
}

function saveRecordsLocally() {
  const uid = currentAuthUser?.uid;
  if (!uid) return;
  localStorage.setItem(getScopedStorageKey("records", uid), JSON.stringify(garageData));
}

function saveExpensesLocally() {
  const uid = currentAuthUser?.uid;
  if (!uid) return;
  localStorage.setItem(getScopedStorageKey("expenses", uid), JSON.stringify(garageExpenses));
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function normalizeRecords(records) {
  if (!Array.isArray(records)) return [];

  return records.map((record) => {
    const items = Array.isArray(record.items)
      ? record.items.map((item) => {
          const qty = toPositiveNumber(item.qty, 1);
          const price = toMoney(item.price);
          return {
            name: String(item.name || "").trim(),
            qty,
            price,
            total: roundMoney(qty * price),
          };
        })
      : [];

    const subtotal = roundMoney(
      items.reduce((sum, item) => sum + item.total, 0) ||
        Number(record.subtotal) ||
        Number(record.totalAmount) ||
        0,
    );
    const discountAmount = roundMoney(
      Math.min(Math.max(Number(record.discountAmount) || 0, 0), subtotal),
    );
    const totalAmount = roundMoney(
      record.totalAmount != null
        ? Number(record.totalAmount)
        : Math.max(subtotal - discountAmount, 0),
    );

    const status = record.paymentStatus || "Paid (Cash)";
    const isPending = status === "Pending";
    const paidAmount = clampMoney(
      record.paidAmount != null
        ? Number(record.paidAmount)
        : isPending
          ? 0
          : totalAmount,
      totalAmount,
    );
    const pendingAmount = roundMoney(Math.max(totalAmount - paidAmount, 0));

    let date = record.date;
    if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      date = getLocalDate();
    }

    return {
      id: record.id ? String(record.id) : generateId(),
      date,
      time: record.time || "12:00 PM",
      name: String(record.name || "").trim(),
      phone: String(record.phone || "").replace(/\D/g, "").slice(0, 10),
      vehicleType: record.vehicleType || "Bike",
      vehicleNo: String(record.vehicleNo || record.bikeNo || "").trim().toUpperCase(),
      vehicleModel: String(record.vehicleModel || record.bikeModel || "").trim(),
      items,
      subtotal,
      discountAmount,
      totalAmount,
      paidAmount,
      pendingAmount,
      paymentStatus: pendingAmount > 0 ? (isPending ? "Pending" : status) : status,
      createdAt: Number(record.createdAt) || Date.now(),
    };
  });
}

function normalizeExpenses(expenses) {
  if (!Array.isArray(expenses)) return [];

  return expenses.map((exp) => {
    let date = exp.date;
    if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      date = getLocalDate();
    }

    return {
      id: exp.id ? String(exp.id) : generateId(),
      date,
      desc: String(exp.desc || exp.description || "Expense").trim(),
      category: String(exp.category || "Parts / Stock").trim(),
      amount: toMoney(exp.amount),
      createdAt: Number(exp.createdAt) || Date.now(),
    };
  });
}

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// =========================================
// TIMEZONE-SAFE DATE ENGINE & DAY WATCHER
// =========================================

function getLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return new Date();
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  const [y, m, d] = String(dateStr).split("-");
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

function formatPrettyDate(dateStr) {
  if (!dateStr) return "N/A";
  const dateObj = parseLocalDate(dateStr);
  return dateObj.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getMonthName(monthIndex) {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return months[monthIndex] || "";
}

function getWeekRange(offset = 0) {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday...
  const diffToMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - diffToMonday + (offset * 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: getLocalDate(monday),
    end: getLocalDate(sunday),
    startObj: monday,
    endObj: sunday,
  };
}

function startDayWatcher() {
  stopDayWatcher();
  dayCheckInterval = setInterval(checkMidnightDateChange, 30000);
  window.addEventListener("focus", checkMidnightDateChange);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkMidnightDateChange();
  });
}

function stopDayWatcher() {
  if (dayCheckInterval) {
    clearInterval(dayCheckInterval);
    dayCheckInterval = null;
  }
}

function checkMidnightDateChange() {
  if (!isAuthenticated || !isSessionActive()) return;

  const currentToday = getLocalDate();
  if (currentToday !== lastSystemDate) {
    const previousDate = lastSystemDate;
    lastSystemDate = currentToday;

    if (activeDate === previousDate) {
      activeDate = currentToday;
      showToast(`🌅 Good day! New working day started (${formatPrettyDate(currentToday)}). Previous days are safely archived.`);
    } else {
      showToast(`🌅 New working day is now ${formatPrettyDate(currentToday)}. Previous records remain permanently saved.`);
    }

    updateWorkingDateUI();
    updateScopeUI();
    updateDashboard();
    refreshRecordsView();
    renderDayHistory();
  }
}

// =========================================
// MULTI-SCOPE & PERFORMANCE RANGE ENGINE
// =========================================

function setScope(newScope) {
  if (!["day", "week", "month", "year", "custom", "all"].includes(newScope)) return;
  currentScope = newScope;

  // Update tab buttons
  document.querySelectorAll(".scope-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.scope === newScope);
  });

  // Toggle scope control containers
  const containers = {
    day: "scopeControlsDay",
    week: "scopeControlsWeek",
    month: "scopeControlsMonth",
    year: "scopeControlsYear",
    custom: "scopeControlsCustom",
    all: "scopeControlsAll",
  };

  Object.entries(containers).forEach(([scopeKey, elementId]) => {
    const el = document.getElementById(elementId);
    if (el) {
      const isMatch = scopeKey === newScope;
      el.hidden = !isMatch;
      el.classList.toggle("active", isMatch);
    }
  });

  updateScopeUI();
  updateDashboard();
  refreshRecordsView();
  renderExpensesList();
}

function isDateInScope(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return false;

  switch (currentScope) {
    case "day":
      return dateStr === activeDate;

    case "week": {
      const { start, end } = getWeekRange(activeWeekOffset);
      return dateStr >= start && dateStr <= end;
    }

    case "month": {
      const [y, m] = dateStr.split("-").map(Number);
      return y === activeYear && m - 1 === activeMonth;
    }

    case "year": {
      const [y] = dateStr.split("-").map(Number);
      return y === activeYearOnly;
    }

    case "custom": {
      if (customStartDate && dateStr < customStartDate) return false;
      if (customEndDate && dateStr > customEndDate) return false;
      return true;
    }

    case "all":
    default:
      return true;
  }
}

function getScopeDisplayInfo() {
  const today = getLocalDate();

  switch (currentScope) {
    case "day": {
      const isToday = activeDate === today;
      return {
        badge: isToday ? "DAILY PERFORMANCE" : "HISTORICAL DAY PERFORMANCE",
        title: isToday ? "Summary for Today" : `Summary for ${formatPrettyDate(activeDate)}`,
        subLabel: isToday ? "Today" : formatPrettyDate(activeDate),
        shortTitle: isToday ? "Active Day (Today)" : `Day (${formatDate(activeDate)})`,
      };
    }
    case "week": {
      const { start, end } = getWeekRange(activeWeekOffset);
      const isThisWeek = activeWeekOffset === 0;
      return {
        badge: "WEEKLY PERFORMANCE",
        title: isThisWeek
          ? `Weekly Summary (This Week: ${formatDate(start)} – ${formatDate(end)})`
          : `Weekly Summary (${formatDate(start)} – ${formatDate(end)})`,
        subLabel: `${formatDate(start)} – ${formatDate(end)}`,
        shortTitle: isThisWeek ? "Active Week (Current)" : `Week (${formatDate(start)})`,
      };
    }
    case "month": {
      const monthName = getMonthName(activeMonth);
      return {
        badge: "MONTHLY PERFORMANCE",
        title: `Monthly Summary for ${monthName} ${activeYear}`,
        subLabel: `${monthName} ${activeYear}`,
        shortTitle: `Month (${monthName.slice(0, 3)} ${activeYear})`,
      };
    }
    case "year": {
      return {
        badge: "YEARLY PERFORMANCE",
        title: `Complete Yearly Performance for ${activeYearOnly}`,
        subLabel: `Year ${activeYearOnly}`,
        shortTitle: `Year (${activeYearOnly})`,
      };
    }
    case "custom": {
      return {
        badge: "CUSTOM RANGE PERFORMANCE",
        title: `Custom Period Summary (${formatDate(customStartDate)} to ${formatDate(customEndDate)})`,
        subLabel: `${formatDate(customStartDate)} to ${formatDate(customEndDate)}`,
        shortTitle: "Custom Range",
      };
    }
    case "all":
    default: {
      return {
        badge: "ALL-TIME GARAGE HISTORY",
        title: "All-Time Complete Garage History Summary",
        subLabel: "All-Time",
        shortTitle: "All-Time History",
      };
    }
  }
}

function calculateScopeMetrics() {
  const scopedRecords = garageData.filter((r) => isDateInScope(r.date));
  const scopedExpenses = garageExpenses.filter((e) => isDateInScope(e.date));

  const completedJobs = scopedRecords.length;
  const totalBilled = roundMoney(
    scopedRecords.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0),
  );
  const incomeCollected = roundMoney(
    scopedRecords.reduce((sum, r) => sum + (Number(r.paidAmount) || 0), 0),
  );
  const pendingAmount = roundMoney(
    scopedRecords.reduce((sum, r) => sum + (Number(r.pendingAmount) || 0), 0),
  );
  const totalExpenses = roundMoney(
    scopedExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
  );
  const netProfit = roundMoney(incomeCollected - totalExpenses);

  return {
    completedJobs,
    totalBilled,
    incomeCollected,
    pendingAmount,
    totalExpenses,
    netProfit,
    scopedRecords,
    scopedExpenses,
  };
}

function updateScopeUI() {
  // 1. Weekly sub-controls
  const { start, end } = getWeekRange(activeWeekOffset);
  const weekLabel = document.getElementById("weekDisplayLabel");
  if (weekLabel) weekLabel.textContent = `${formatDate(start)} – ${formatDate(end)}`;
  const weekBadgeText = document.getElementById("weekBadgeText");
  if (weekBadgeText) {
    weekBadgeText.textContent = activeWeekOffset === 0 ? "Current Week" : `Week of ${formatDate(start)}`;
  }

  // 2. Monthly sub-controls
  const mSelect = document.getElementById("monthSelect");
  const mySelect = document.getElementById("monthYearSelect");
  if (mSelect) mSelect.value = String(activeMonth);
  if (mySelect) mySelect.value = String(activeYear);
  const mBadgeText = document.getElementById("monthBadgeText");
  if (mBadgeText) {
    mBadgeText.textContent = `Month: ${getMonthName(activeMonth).slice(0, 3)} ${activeYear}`;
  }

  // 3. Yearly sub-controls
  const ySelect = document.getElementById("yearSelect");
  if (ySelect) ySelect.value = String(activeYearOnly);
  const yBadgeText = document.getElementById("yearBadgeText");
  if (yBadgeText) yBadgeText.textContent = `Year: ${activeYearOnly}`;

  // 4. Custom range sub-controls
  const cStart = document.getElementById("customStartDate");
  const cEnd = document.getElementById("customEndDate");
  if (cStart && customStartDate) cStart.value = customStartDate;
  if (cEnd && customEndDate) cEnd.value = customEndDate;

  // 5. All-Time sub-controls
  const allTimeSpanText = document.getElementById("allTimeSpanText");
  if (allTimeSpanText) {
    const dates = garageData.map((r) => r.date).filter(Boolean).sort();
    if (dates.length > 0) {
      allTimeSpanText.textContent = `${formatDate(dates[0])} to ${formatDate(dates[dates.length - 1])} (${dates.length} jobs)`;
    } else {
      allTimeSpanText.textContent = "No records yet";
    }
  }

  // Historical Banner (only show in 'day' scope when activeDate != today)
  const banner = document.getElementById("historicalBanner");
  const bannerLabel = document.getElementById("historicalDateLabel");
  const isDayScope = currentScope === "day";
  const isToday = activeDate === getLocalDate();
  if (banner) {
    banner.hidden = !isDayScope || isToday;
  }
  if (bannerLabel) {
    bannerLabel.textContent = formatPrettyDate(activeDate);
  }
}

function setupScopeListeners() {
  // Scope tabs
  document.querySelectorAll(".scope-tab").forEach((tab) => {
    tab.addEventListener("click", () => setScope(tab.dataset.scope));
  });

  // Week Controls
  document.getElementById("prevWeekBtn")?.addEventListener("click", () => {
    activeWeekOffset -= 1;
    updateScopeUI();
    updateDashboard();
    refreshRecordsView();
    renderExpensesList();
  });
  document.getElementById("nextWeekBtn")?.addEventListener("click", () => {
    activeWeekOffset += 1;
    updateScopeUI();
    updateDashboard();
    refreshRecordsView();
    renderExpensesList();
  });
  document.getElementById("jumpThisWeekBtn")?.addEventListener("click", () => {
    activeWeekOffset = 0;
    updateScopeUI();
    updateDashboard();
    refreshRecordsView();
    renderExpensesList();
  });

  // Month Controls
  document.getElementById("prevMonthBtn")?.addEventListener("click", () => {
    if (activeMonth === 0) {
      activeMonth = 11;
      activeYear -= 1;
    } else {
      activeMonth -= 1;
    }
    updateScopeUI();
    updateDashboard();
    refreshRecordsView();
    renderExpensesList();
  });
  document.getElementById("nextMonthBtn")?.addEventListener("click", () => {
    if (activeMonth === 11) {
      activeMonth = 0;
      activeYear += 1;
    } else {
      activeMonth += 1;
    }
    updateScopeUI();
    updateDashboard();
    refreshRecordsView();
    renderExpensesList();
  });
  document.getElementById("jumpThisMonthBtn")?.addEventListener("click", () => {
    const now = new Date();
    activeMonth = now.getMonth();
    activeYear = now.getFullYear();
    updateScopeUI();
    updateDashboard();
    refreshRecordsView();
    renderExpensesList();
  });
  document.getElementById("monthSelect")?.addEventListener("change", (e) => {
    activeMonth = Number(e.target.value);
    updateScopeUI();
    updateDashboard();
    refreshRecordsView();
    renderExpensesList();
  });
  document.getElementById("monthYearSelect")?.addEventListener("change", (e) => {
    activeYear = Number(e.target.value);
    updateScopeUI();
    updateDashboard();
    refreshRecordsView();
    renderExpensesList();
  });

  // Year Controls
  document.getElementById("prevYearBtn")?.addEventListener("click", () => {
    activeYearOnly -= 1;
    updateScopeUI();
    updateDashboard();
    refreshRecordsView();
    renderExpensesList();
  });
  document.getElementById("nextYearBtn")?.addEventListener("click", () => {
    activeYearOnly += 1;
    updateScopeUI();
    updateDashboard();
    refreshRecordsView();
    renderExpensesList();
  });
  document.getElementById("jumpThisYearBtn")?.addEventListener("click", () => {
    activeYearOnly = new Date().getFullYear();
    updateScopeUI();
    updateDashboard();
    refreshRecordsView();
    renderExpensesList();
  });
  document.getElementById("yearSelect")?.addEventListener("change", (e) => {
    activeYearOnly = Number(e.target.value);
    updateScopeUI();
    updateDashboard();
    refreshRecordsView();
    renderExpensesList();
  });

  // Custom Range Controls
  document.getElementById("applyCustomRangeBtn")?.addEventListener("click", () => {
    const s = document.getElementById("customStartDate").value;
    const e = document.getElementById("customEndDate").value;
    if (!s || !e) {
      showToast("Please select both From and To dates.", "error");
      return;
    }
    if (s > e) {
      showToast("Start date cannot be after end date.", "error");
      return;
    }
    customStartDate = s;
    customEndDate = e;
    updateScopeUI();
    updateDashboard();
    refreshRecordsView();
    renderExpensesList();
    showToast(`Filter applied: ${formatDate(s)} to ${formatDate(e)}`);
  });

  // Quick presets
  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = btn.dataset.preset;
      const today = new Date();
      const todayStr = getLocalDate(today);

      if (preset === "7days") {
        const d = new Date(today);
        d.setDate(d.getDate() - 6);
        customStartDate = getLocalDate(d);
        customEndDate = todayStr;
      } else if (preset === "30days") {
        const d = new Date(today);
        d.setDate(d.getDate() - 29);
        customStartDate = getLocalDate(d);
        customEndDate = todayStr;
      } else if (preset === "thisMonth") {
        const d = new Date(today.getFullYear(), today.getMonth(), 1);
        customStartDate = getLocalDate(d);
        customEndDate = todayStr;
      } else if (preset === "lastMonth") {
        const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const last = new Date(today.getFullYear(), today.getMonth(), 0);
        customStartDate = getLocalDate(first);
        customEndDate = getLocalDate(last);
      } else if (preset === "last90days") {
        const d = new Date(today);
        d.setDate(d.getDate() - 89);
        customStartDate = getLocalDate(d);
        customEndDate = todayStr;
      }

      updateScopeUI();
      updateDashboard();
      refreshRecordsView();
      renderExpensesList();
      showToast(`Applied preset: ${formatDate(customStartDate)} to ${formatDate(customEndDate)}`);
    });
  });
}

// =========================================
// WORKING DAY NAVIGATION (DAILY SCOPE)
// =========================================

function setActiveDate(newDateStr) {
  if (!newDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(newDateStr)) return;
  activeDate = newDateStr;

  // If currently not in 'day' scope, switch to 'day' scope to view selected date
  if (currentScope !== "day") {
    setScope("day");
  } else {
    updateWorkingDateUI();
    updateScopeUI();
    updateDashboard();
    refreshRecordsView();
    renderExpensesList();
    renderDayHistory();
  }
}

function changeActiveDateByDays(offsetDays) {
  const currentObj = parseLocalDate(activeDate);
  currentObj.setDate(currentObj.getDate() + offsetDays);
  setActiveDate(getLocalDate(currentObj));
}

function updateWorkingDateUI() {
  const today = getLocalDate();
  const isToday = activeDate === today;

  const todayObj = new Date();
  document.getElementById("todayLabel").textContent = todayObj.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const datePicker = document.getElementById("activeDatePicker");
  if (datePicker) datePicker.value = activeDate;

  const formJobDate = document.getElementById("formJobDate");
  if (formJobDate) formJobDate.value = activeDate;
  const jobDateDisplay = document.getElementById("jobDateDisplay");
  if (jobDateDisplay) jobDateDisplay.textContent = formatPrettyDate(activeDate);

  const badge = document.getElementById("activeDateBadge");
  const badgeText = document.getElementById("activeDateText");
  if (badge && badgeText) {
    if (isToday) {
      badge.className = "active-date-badge is-today";
      badgeText.textContent = `Active Day: Today (${formatDate(activeDate)})`;
    } else {
      badge.className = "active-date-badge is-historical";
      badgeText.textContent = `Historical Day: ${formatPrettyDate(activeDate)}`;
    }
  }
}

// =========================================
// CALCULATIONS & METRICS ENGINE
// =========================================

function updateDashboard() {
  if (!requireAuth()) return;

  const metrics = calculateScopeMetrics();
  const allTimePending = roundMoney(
    garageData.reduce((sum, r) => sum + (Number(r.pendingAmount) || 0), 0),
  );

  const scopeInfo = getScopeDisplayInfo();

  // Update Section Headers
  const scopeLabel = document.getElementById("dashboardScopeLabel");
  const heading = document.getElementById("dashboardStatsHeading");
  const scopeBtnText = document.getElementById("scopeDateBtnText");

  if (scopeLabel) scopeLabel.textContent = scopeInfo.badge;
  if (heading) heading.textContent = scopeInfo.title;
  if (scopeBtnText) scopeBtnText.textContent = scopeInfo.shortTitle;

  // Populate Dashboard Stats Cards
  document.getElementById("statDayVehicles").textContent = metrics.completedJobs;
  document.getElementById("statDayIncome").textContent = money(metrics.incomeCollected);
  document.getElementById("statDayBilled").textContent = money(metrics.totalBilled);
  document.getElementById("statDayExpenses").textContent = money(metrics.totalExpenses);
  document.getElementById("statDayNetProfit").textContent = money(metrics.netProfit);
  document.getElementById("statDayPending").textContent = money(metrics.pendingAmount);
  document.getElementById("statAllTimePending").textContent = money(allTimePending);

  // Subtitles on stat cards
  const vLbl = document.getElementById("statDayVehiclesLabel");
  if (vLbl) vLbl.textContent = `Jobs for ${scopeInfo.subLabel}`;
  const iLbl = document.getElementById("statDayIncomeLabel");
  if (iLbl) iLbl.textContent = `Cash & UPI in ${scopeInfo.subLabel}`;
  const bLbl = document.getElementById("statDayBilledLabel");
  if (bLbl) bLbl.textContent = `Bill value in ${scopeInfo.subLabel}`;
  const eLbl = document.getElementById("statDayExpensesLabel");
  if (eLbl) eLbl.textContent = `Shop costs in ${scopeInfo.subLabel}`;
  const pLbl = document.getElementById("statDayPendingLabel");
  if (pLbl) pLbl.textContent = `Due balance in ${scopeInfo.subLabel}`;

  // Expense panel badge
  const expTotalBadge = document.getElementById("expenseSectionTotal");
  if (expTotalBadge) expTotalBadge.textContent = money(metrics.totalExpenses);
  const expDateLabel = document.getElementById("expenseDateLabel");
  if (expDateLabel) expDateLabel.textContent = scopeInfo.subLabel;
}

// =========================================
// SERVICE RECORDS VIEW & ACTIONS
// =========================================

function getFilteredRecords() {
  const search = document.getElementById("searchInput").value.trim().toLowerCase();
  const statusFilter = document.getElementById("statusFilter").value;

  return garageData.filter((record) => {
    // Filter by Scope
    if (filterScope === "date" && !isDateInScope(record.date)) {
      return false;
    }

    // Filter by Payment Status
    if (statusFilter === "paid" && (record.pendingAmount || 0) > 0) return false;
    if (statusFilter === "pending" && (record.pendingAmount || 0) <= 0) return false;

    // Search Query
    if (search) {
      const haystack = [
        record.name,
        record.phone,
        record.vehicleNo,
        record.vehicleModel,
        record.vehicleType,
        record.date,
        record.paymentStatus,
        formatDate(record.date),
      ]
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}

function refreshRecordsView() {
  if (!requireAuth()) return;
  const filtered = getFilteredRecords();
  renderRecords(filtered);
  updateFilterSummary(filtered);
  document.getElementById("recordCount").textContent = filtered.length;
}

function renderRecords(data) {
  const tbody = document.getElementById("recordsBody");
  const empty = document.getElementById("emptyRecords");
  const emptySub = document.getElementById("emptyRecordsSub");
  tbody.innerHTML = "";

  if (data.length === 0) {
    empty.style.display = "block";
    const scopeInfo = getScopeDisplayInfo();
    if (garageData.length === 0) {
      emptySub.textContent = "No job cards yet — Create your first one above!";
    } else if (filterScope === "date") {
      emptySub.textContent = `No vehicle service records found for ${scopeInfo.subLabel}. Create a new job card above!`;
    } else {
      emptySub.textContent = "No job cards match your search filters.";
    }
    return;
  }

  empty.style.display = "none";

  data.forEach((record) => {
    const partsSummary = (record.items || [])
      .map((item) => `${escapeHTML(item.name)} × ${item.qty}`)
      .join(", ") || "General Service";

    const isPending = (record.pendingAmount || 0) > 0;
    const statusClass = isPending ? "pending" : "paid";
    const statusIcon = isPending ? "fa-clock" : "fa-circle-check";

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <strong>${formatDate(record.date)}</strong>
        <br>
        <small style="color:var(--text-muted);">${escapeHTML(record.time || "")}</small>
      </td>
      <td>
        <div class="vehicle-cell">
          <strong>${getVehicleIcon(record.vehicleType)} ${escapeHTML(record.vehicleNo || "N/A")}</strong>
          <span>${escapeHTML(record.vehicleType || "Vehicle")}</span>
          <small>${escapeHTML(record.vehicleModel || "Model not added")}</small>
        </div>
      </td>
      <td>
        <div class="customer-cell">
          <strong>${escapeHTML(record.name || "Customer")}</strong>
          <span>${escapeHTML(record.phone || "No phone")}</span>
        </div>
      </td>
      <td>
        <div class="service-summary" title="${partsSummary}">
          ${partsSummary}
        </div>
      </td>
      <td class="amount-cell">
        <strong>${money(record.totalAmount)}</strong>
        ${(record.discountAmount || 0) > 0 ? `<div class="record-discount-tag" title="Discount: ${money(record.discountAmount)}"><i class="fa-solid fa-tag"></i> -${money(record.discountAmount)} Off</div>` : ""}
        <small>Paid ${money(record.paidAmount)}</small>
        ${isPending ? `<small style="color:var(--danger);font-weight:700;">Due ${money(record.pendingAmount)}</small>` : ""}
      </td>
      <td>
        <span class="status ${statusClass}">
          <i class="fa-solid ${statusIcon}"></i>
          ${escapeHTML(record.paymentStatus)}
        </span>
      </td>
      <td>
        <div class="action-buttons">
          <button type="button" class="action-btn action-edit" title="Edit Record" data-action="edit" data-id="${record.id}">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button type="button" class="action-btn action-whatsapp" title="Send WhatsApp Bill" data-action="whatsapp" data-id="${record.id}">
            <i class="fa-brands fa-whatsapp"></i>
          </button>
          <button type="button" class="action-btn action-print" title="Print Invoice" data-action="print" data-id="${record.id}">
            <i class="fa-solid fa-print"></i>
          </button>
          <button type="button" class="action-btn action-delete" title="Delete Record" data-action="delete" data-id="${record.id}">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });

  setupRecordActionButtons();
}

function setupRecordActionButtons() {
  document.querySelectorAll("[data-action='edit']").forEach((btn) => {
    btn.addEventListener("click", () => openEditModal(btn.dataset.id));
  });
  document.querySelectorAll("[data-action='whatsapp']").forEach((btn) => {
    btn.addEventListener("click", () => sendWhatsApp(btn.dataset.id));
  });
  document.querySelectorAll("[data-action='print']").forEach((btn) => {
    btn.addEventListener("click", () => printInvoice(btn.dataset.id));
  });
  document.querySelectorAll("[data-action='delete']").forEach((btn) => {
    btn.addEventListener("click", () => deleteRecord(btn.dataset.id));
  });
}

function updateFilterSummary(data) {
  const summary = document.getElementById("filterSummary");
  const billed = roundMoney(data.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0));
  const collected = roundMoney(data.reduce((sum, r) => sum + (Number(r.paidAmount) || 0), 0));
  const pending = roundMoney(data.reduce((sum, r) => sum + (Number(r.pendingAmount) || 0), 0));

  summary.innerHTML = `
    <span>Showing <strong>${data.length}</strong> record${data.length !== 1 ? "s" : ""}</span>
    <span>Billed: <strong>${money(billed)}</strong></span>
    <span>Collected: <strong>${money(collected)}</strong></span>
    <span>Pending: <strong>${money(pending)}</strong></span>
  `;
}

// =========================================
// NEW JOB CARD ENTRY
// =========================================

function getSubtotal() {
  return roundMoney(currentItems.reduce((sum, item) => sum + item.total, 0));
}

function getDiscountAmount() {
  const input = document.getElementById("discountAmount");
  if (!input) return 0;
  const raw = input.value.trim();
  if (!raw) return 0;
  const disc = Number(raw);
  if (!Number.isFinite(disc) || disc <= 0) return 0;
  const subtotal = getSubtotal();
  return roundMoney(Math.min(disc, subtotal));
}

function getGrandTotal() {
  const subtotal = getSubtotal();
  const discount = getDiscountAmount();
  return roundMoney(Math.max(subtotal - discount, 0));
}

function updateDiscountAndTotals() {
  const subtotal = getSubtotal();
  const discInput = document.getElementById("discountAmount");
  let disc = Number(discInput?.value || 0);

  if (disc < 0) {
    disc = 0;
    if (discInput) discInput.value = 0;
  } else if (subtotal > 0 && disc > subtotal) {
    disc = subtotal;
    if (discInput) discInput.value = subtotal;
    showToast(`Discount cannot exceed Subtotal of ${money(subtotal)}. Adjusted to full amount.`, "warning");
  }

  const discount = getDiscountAmount();
  const grandTotal = getGrandTotal();

  const subtotalEl = document.getElementById("billSubtotal");
  if (subtotalEl) subtotalEl.textContent = money(subtotal);

  const billTotalEl = document.getElementById("billTotal");
  if (billTotalEl) billTotalEl.textContent = money(grandTotal);

  const badgeEl = document.getElementById("discountBadge");
  const badgeVal = document.getElementById("billDiscountDisplay");
  const clearBtn = document.getElementById("clearDiscountBtn");

  if (discount > 0) {
    if (badgeEl) badgeEl.style.display = "inline-flex";
    if (badgeVal) badgeVal.textContent = `-${money(discount)}`;
    if (clearBtn) clearBtn.style.display = "inline-flex";
  } else {
    if (badgeEl) badgeEl.style.display = "none";
    if (clearBtn) clearBtn.style.display = "none";
  }

  updateBalanceDue();
}

function setupDiscountListeners() {
  const discInput = document.getElementById("discountAmount");
  discInput?.addEventListener("input", updateDiscountAndTotals);
  discInput?.addEventListener("change", updateDiscountAndTotals);

  document.getElementById("clearDiscountBtn")?.addEventListener("click", () => {
    if (discInput) discInput.value = "0";
    updateDiscountAndTotals();
  });
}

function getPaymentStatus() {
  return (
    document.querySelector("input[name='paymentStatus']:checked")?.value ||
    "Paid (Cash)"
  );
}

function syncAmountReceived() {
  const input = document.getElementById("amountReceived");
  if (input.value !== "") return;

  const total = getGrandTotal();
  if (getPaymentStatus() !== "Pending") {
    input.placeholder = String(total || 0);
  } else {
    input.placeholder = "0";
  }
}

function getAmountReceived() {
  const input = document.getElementById("amountReceived");
  const total = getGrandTotal();
  const raw = input.value.trim();

  if (raw === "") {
    return getPaymentStatus() === "Pending" ? 0 : total;
  }

  return clampMoney(Number(raw), total);
}

function updateBalanceDue() {
  const total = getGrandTotal();
  const received = getAmountReceived();
  document.getElementById("balanceDue").textContent = money(Math.max(total - received, 0));
  syncAmountReceived();
}

function addPartRow() {
  if (!requireAuth()) return;
  const name = document.getElementById("partName").value.trim();
  const qty = Number(document.getElementById("partQty").value);
  const price = Number(document.getElementById("partPrice").value);

  if (!name) {
    showToast("Please enter service or part description.", "error");
    document.getElementById("partName").focus();
    return;
  }

  if (!Number.isFinite(qty) || qty < 1 || qty > 999) {
    showToast("Quantity must be between 1 and 999.", "error");
    document.getElementById("partQty").focus();
    return;
  }

  if (!Number.isFinite(price) || price < 0) {
    showToast("Please enter a valid unit price.", "error");
    document.getElementById("partPrice").focus();
    return;
  }

  currentItems.push({
    name,
    qty: Math.floor(qty),
    price: toMoney(price),
    total: roundMoney(Math.floor(qty) * toMoney(price)),
  });

  document.getElementById("partName").value = "";
  document.getElementById("partQty").value = "1";
  document.getElementById("partPrice").value = "";
  renderPartsTable();
  document.getElementById("partName").focus();
}

function removePartRow(index) {
  if (!requireAuth()) return;
  if (index < 0 || index >= currentItems.length) return;
  currentItems.splice(index, 1);
  renderPartsTable();
}

function renderPartsTable() {
  const tbody = document.getElementById("partsTableBody");
  const empty = document.getElementById("emptyItems");
  tbody.innerHTML = "";

  currentItems.forEach((item, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHTML(item.name)}</strong></td>
      <td>${item.qty}</td>
      <td>${money(item.price)}</td>
      <td>${money(item.total)}</td>
      <td>
        <button type="button" class="delete-item" title="Remove item" data-index="${index}">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });

  const subtotal = getSubtotal();
  const discount = getDiscountAmount();
  const grandTotal = getGrandTotal();

  const subtotalEl = document.getElementById("billSubtotal");
  if (subtotalEl) subtotalEl.textContent = money(subtotal);

  const billTotalEl = document.getElementById("billTotal");
  if (billTotalEl) billTotalEl.textContent = money(grandTotal);

  const badgeEl = document.getElementById("discountBadge");
  const badgeVal = document.getElementById("billDiscountDisplay");
  const clearBtn = document.getElementById("clearDiscountBtn");

  if (discount > 0) {
    if (badgeEl) badgeEl.style.display = "inline-flex";
    if (badgeVal) badgeVal.textContent = `-${money(discount)}`;
    if (clearBtn) clearBtn.style.display = "inline-flex";
  } else {
    if (badgeEl) badgeEl.style.display = "none";
    if (clearBtn) clearBtn.style.display = "none";
  }

  document.getElementById("summaryItemCount").textContent = currentItems.length;
  document.getElementById("itemCount").textContent =
    `${currentItems.length} ${currentItems.length === 1 ? "Item" : "Items"}`;

  empty.style.display = currentItems.length === 0 ? "block" : "none";

  tbody.querySelectorAll(".delete-item").forEach((button) => {
    button.addEventListener("click", () => {
      removePartRow(Number(button.dataset.index));
    });
  });

  updateBalanceDue();
}

async function saveJobCard() {
  if (!requireAuth()) return;

  const targetDate = document.getElementById("formJobDate").value || activeDate || getLocalDate();
  const name = document.getElementById("custName").value.trim();
  const phone = document.getElementById("custPhone").value.trim();
  const vehicleNo = document.getElementById("vehicleNo").value.trim().toUpperCase();
  const vehicleModel = document.getElementById("vehicleModel").value.trim();
  const paymentStatus = getPaymentStatus();

  const hasName = name.length > 0;
  const hasPhone = phone.length > 0;
  const hasVehicleNo = vehicleNo.length > 0;
  const hasVehicleModel = vehicleModel.length > 0;

  if (!hasName && !hasPhone && !hasVehicleNo && !hasVehicleModel) {
    showToast("Please enter at least one identifier (Customer Name, Mobile, Vehicle Number, or Model).", "error");
    document.getElementById("custName").focus();
    return;
  }

  const cleanPhone = phone.replace(/\D/g, "");
  if (hasPhone && cleanPhone.length !== 10) {
    showToast("Please enter a valid 10-digit mobile number.", "error");
    document.getElementById("custPhone").focus();
    return;
  }

  if (currentItems.length === 0) {
    showToast("Please add at least one service or part to the job card.", "error");
    document.getElementById("partName").focus();
    return;
  }

  const subtotal = getSubtotal();
  const discountAmount = getDiscountAmount();
  const totalAmount = getGrandTotal();
  const paidAmount = getAmountReceived();

  if (paidAmount > totalAmount) {
    showToast("Amount received cannot be greater than the final bill total.", "error");
    document.getElementById("amountReceived").focus();
    return;
  }

  const pendingAmount = roundMoney(Math.max(totalAmount - paidAmount, 0));
  const now = new Date();

  const record = {
    id: generateId(),
    date: targetDate,
    time: now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    name: hasName ? name : "",
    phone: hasPhone ? cleanPhone : "",
    vehicleType: selectedVehicleType,
    vehicleNo: hasVehicleNo ? vehicleNo : "",
    vehicleModel: hasVehicleModel ? vehicleModel : "",
    items: currentItems.map((item) => ({ ...item })),
    subtotal,
    discountAmount,
    totalAmount,
    paidAmount,
    pendingAmount,
    paymentStatus: pendingAmount > 0 ? "Pending" : paymentStatus,
    createdAt: Date.now(),
  };

  // Add to local array
  garageData.unshift(record);
  saveRecordsLocally();

  // Save to Shared Cloud Database
  await saveRecordToCloud(record);

  // If saved for a date other than active working date, navigate to that date
  if (targetDate !== activeDate) {
    showToast(`Job card saved for ${formatPrettyDate(targetDate)} in cloud database!`);
    setActiveDate(targetDate);
  } else {
    showToast("Job card saved and synced to cloud database.");
    updateDashboard();
    refreshRecordsView();
    renderDayHistory();
  }

  clearForm(false);
}

function clearForm(showMessage) {
  if (!requireAuth()) return;
  document.getElementById("custName").value = "";
  document.getElementById("custPhone").value = "";
  document.getElementById("vehicleNo").value = "";
  document.getElementById("vehicleModel").value = "";
  document.getElementById("partName").value = "";
  document.getElementById("partQty").value = "1";
  document.getElementById("partPrice").value = "";
  document.getElementById("amountReceived").value = "";
  document.getElementById("formJobDate").value = activeDate;

  const discInput = document.getElementById("discountAmount");
  if (discInput) discInput.value = "0";
  const badgeEl = document.getElementById("discountBadge");
  if (badgeEl) badgeEl.style.display = "none";
  const clearBtn = document.getElementById("clearDiscountBtn");
  if (clearBtn) clearBtn.style.display = "none";

  currentItems = [];
  selectedVehicleType = "Bike";
  document.getElementById("vehicleType").value = "Bike";

  document.querySelectorAll(".vehicle-option").forEach((button) => {
    button.classList.toggle("active", button.dataset.vehicle === "Bike");
  });

  const cashRadio = document.querySelector("input[name='paymentStatus'][value='Paid (Cash)']");
  if (cashRadio) cashRadio.checked = true;

  document.querySelectorAll(".payment-option").forEach((option) => {
    option.classList.remove("active");
  });
  document
    .querySelector(".payment-option input[value='Paid (Cash)']")
    ?.closest(".payment-option")
    ?.classList.add("active");

  renderPartsTable();

  if (showMessage) showToast("Form cleared.");
}

// =========================================
// RECORD EDITING MODAL
// =========================================

function openEditModal(recordId) {
  if (!requireAuth()) return;

  const record = garageData.find((r) => String(r.id) === String(recordId));
  if (!record) {
    showToast("Record not found.", "error");
    return;
  }

  document.getElementById("editRecordId").value = record.id;
  document.getElementById("editRecordDate").value = record.date;
  document.getElementById("editVehicleType").value = record.vehicleType || "Bike";
  document.getElementById("editVehicleNo").value = record.vehicleNo || "";
  document.getElementById("editVehicleModel").value = record.vehicleModel || "";
  document.getElementById("editCustName").value = record.name || "";
  document.getElementById("editCustPhone").value = record.phone || "";
  document.getElementById("editPaymentStatus").value = record.paymentStatus || "Paid (Cash)";
  document.getElementById("editAmountReceived").value = record.paidAmount != null ? record.paidAmount : "";

  const editDiscInput = document.getElementById("editDiscountAmount");
  if (editDiscInput) {
    editDiscInput.value = record.discountAmount != null ? record.discountAmount : 0;
  }

  editModalItems = Array.isArray(record.items)
    ? record.items.map((it) => ({ ...it }))
    : [];

  renderEditModalPartsTable();
  updateEditBalanceDue();

  document.getElementById("editJobModal").hidden = false;
}

function closeEditModal() {
  document.getElementById("editJobModal").hidden = true;
  editModalItems = [];
}

function renderEditModalPartsTable() {
  const tbody = document.getElementById("editPartsTableBody");
  tbody.innerHTML = "";

  editModalItems.forEach((item, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHTML(item.name)}</strong></td>
      <td>${item.qty}</td>
      <td>${money(item.price)}</td>
      <td>${money(item.total)}</td>
      <td>
        <button type="button" class="delete-item" title="Remove item" data-edit-index="${index}">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });

  const subtotal = roundMoney(editModalItems.reduce((sum, it) => sum + it.total, 0));
  const editDiscInput = document.getElementById("editDiscountAmount");
  let discount = Number(editDiscInput?.value || 0);
  if (discount < 0) discount = 0;
  if (subtotal > 0 && discount > subtotal) discount = subtotal;

  const total = roundMoney(Math.max(subtotal - discount, 0));
  const subtotalEl = document.getElementById("editBillSubtotal");
  if (subtotalEl) subtotalEl.textContent = money(subtotal);
  document.getElementById("editBillTotal").textContent = money(total);
  document.getElementById("editItemCount").textContent = `${editModalItems.length} Items`;

  tbody.querySelectorAll("[data-edit-index]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.editIndex);
      if (idx >= 0 && idx < editModalItems.length) {
        editModalItems.splice(idx, 1);
        renderEditModalPartsTable();
        updateEditBalanceDue();
      }
    });
  });
}

function addEditModalPart() {
  const name = document.getElementById("editPartName").value.trim();
  const qty = Number(document.getElementById("editPartQty").value);
  const price = Number(document.getElementById("editPartPrice").value);

  if (!name) {
    showToast("Please enter item description.", "error");
    return;
  }
  if (!Number.isFinite(qty) || qty < 1) {
    showToast("Please enter valid quantity.", "error");
    return;
  }
  if (!Number.isFinite(price) || price < 0) {
    showToast("Please enter valid price.", "error");
    return;
  }

  editModalItems.push({
    name,
    qty: Math.floor(qty),
    price: toMoney(price),
    total: roundMoney(Math.floor(qty) * toMoney(price)),
  });

  document.getElementById("editPartName").value = "";
  document.getElementById("editPartQty").value = "1";
  document.getElementById("editPartPrice").value = "";
  renderEditModalPartsTable();
  updateEditBalanceDue();
}

function updateEditBalanceDue() {
  const subtotal = roundMoney(editModalItems.reduce((sum, it) => sum + it.total, 0));
  const editDiscInput = document.getElementById("editDiscountAmount");
  let discount = Number(editDiscInput?.value || 0);
  if (discount < 0) {
    discount = 0;
    if (editDiscInput) editDiscInput.value = 0;
  } else if (subtotal > 0 && discount > subtotal) {
    discount = subtotal;
    if (editDiscInput) editDiscInput.value = subtotal;
  }

  const total = roundMoney(Math.max(subtotal - discount, 0));
  const subtotalEl = document.getElementById("editBillSubtotal");
  if (subtotalEl) subtotalEl.textContent = money(subtotal);
  document.getElementById("editBillTotal").textContent = money(total);

  const receivedInput = document.getElementById("editAmountReceived");
  const rawReceived = receivedInput.value.trim();
  const status = document.getElementById("editPaymentStatus").value;

  let received = rawReceived === "" ? (status === "Pending" ? 0 : total) : Number(rawReceived);
  received = clampMoney(received, total);

  document.getElementById("editBalanceDue").textContent = money(Math.max(total - received, 0));
}

async function saveEditedJobCard() {
  if (!requireAuth()) return;

  const recordId = document.getElementById("editRecordId").value;
  const index = garageData.findIndex((r) => String(r.id) === String(recordId));
  if (index === -1) {
    showToast("Record not found.", "error");
    return;
  }

  const date = document.getElementById("editRecordDate").value || garageData[index].date;
  const vehicleType = document.getElementById("editVehicleType").value;
  const vehicleNo = document.getElementById("editVehicleNo").value.trim().toUpperCase();
  const vehicleModel = document.getElementById("editVehicleModel").value.trim();
  const custName = document.getElementById("editCustName").value.trim();
  const custPhone = document.getElementById("editCustPhone").value.replace(/\D/g, "").slice(0, 10);
  const paymentStatus = document.getElementById("editPaymentStatus").value;

  if (editModalItems.length === 0) {
    showToast("At least one service or part is required.", "error");
    return;
  }

  const subtotal = roundMoney(editModalItems.reduce((sum, it) => sum + it.total, 0));
  const editDiscInput = document.getElementById("editDiscountAmount");
  let discountAmount = Number(editDiscInput?.value || 0);
  if (discountAmount < 0) discountAmount = 0;
  if (subtotal > 0 && discountAmount > subtotal) discountAmount = subtotal;
  discountAmount = roundMoney(discountAmount);

  const totalAmount = roundMoney(Math.max(subtotal - discountAmount, 0));
  const rawReceived = document.getElementById("editAmountReceived").value.trim();
  const paidAmount = rawReceived === "" ? (paymentStatus === "Pending" ? 0 : totalAmount) : clampMoney(Number(rawReceived), totalAmount);
  const pendingAmount = roundMoney(Math.max(totalAmount - paidAmount, 0));

  const updatedRecord = {
    ...garageData[index],
    date,
    vehicleType,
    vehicleNo,
    vehicleModel,
    name: custName,
    phone: custPhone,
    items: editModalItems.map((it) => ({ ...it })),
    subtotal,
    discountAmount,
    totalAmount,
    paidAmount,
    pendingAmount,
    paymentStatus: pendingAmount > 0 ? "Pending" : paymentStatus,
    updatedAt: Date.now(),
  };

  garageData[index] = updatedRecord;
  saveRecordsLocally();
  await saveRecordToCloud(updatedRecord);

  closeEditModal();
  updateDashboard();
  refreshRecordsView();
  renderDayHistory();
  showToast("Record updated and synced to cloud.");
}

// =========================================
// RECORD DELETION
// =========================================

function deleteRecord(recordId) {
  if (!requireAuth()) return;

  const record = garageData.find((r) => String(r.id) === String(recordId));
  if (!record) {
    showToast("Record not found.", "error");
    return;
  }

  const desc = `${record.name || "Customer"} (${record.vehicleNo || "Vehicle"}) on ${formatDate(record.date)}`;
  askConfirm(
    "Delete this record?",
    `This will permanently remove the service record for ${desc} from all synchronized devices. Calculations will update immediately.`,
  ).then(async (confirmed) => {
    if (!confirmed) return;

    garageData = garageData.filter((r) => String(r.id) !== String(recordId));
    saveRecordsLocally();
    await deleteRecordFromCloud(recordId);

    updateDashboard();
    refreshRecordsView();
    renderDayHistory();
    showToast("Record deleted from cloud and local storage.");
  });
}

// =========================================
// DAILY & PERIOD EXPENSES MANAGEMENT
// =========================================

async function addDailyExpense() {
  if (!requireAuth()) return;

  const desc = document.getElementById("expenseDesc").value.trim();
  const category = document.getElementById("expenseCategory").value;
  const amount = Number(document.getElementById("expenseAmount").value);

  if (!desc) {
    showToast("Please enter an expense description.", "error");
    document.getElementById("expenseDesc").focus();
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    showToast("Please enter a valid expense amount.", "error");
    document.getElementById("expenseAmount").focus();
    return;
  }

  // When in 'day' scope, expense belongs to activeDate; otherwise defaults to today
  const expenseDate = currentScope === "day" ? activeDate : getLocalDate();

  const expense = {
    id: generateId(),
    date: expenseDate,
    desc,
    category,
    amount: toMoney(amount),
    createdAt: Date.now(),
  };

  garageExpenses.unshift(expense);
  saveExpensesLocally();
  await saveExpenseToCloud(expense);

  document.getElementById("expenseDesc").value = "";
  document.getElementById("expenseAmount").value = "";

  renderExpensesList();
  updateDashboard();
  renderDayHistory();
  showToast("Expense added and synced to cloud.");
}

async function deleteExpense(expenseId) {
  if (!requireAuth()) return;

  garageExpenses = garageExpenses.filter((e) => String(e.id) !== String(expenseId));
  saveExpensesLocally();
  await deleteExpenseFromCloud(expenseId);

  renderExpensesList();
  updateDashboard();
  renderDayHistory();
  showToast("Expense removed.");
}

function renderExpensesList() {
  const tbody = document.getElementById("expensesTableBody");
  const empty = document.getElementById("emptyExpenses");
  tbody.innerHTML = "";

  // Filter expenses by active scope
  const scopedExpenses = garageExpenses.filter((e) => isDateInScope(e.date));

  if (scopedExpenses.length === 0) {
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";

  scopedExpenses.forEach((exp) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <strong>${escapeHTML(exp.desc)}</strong>
        <br>
        <small style="color:var(--text-muted);font-size:10px;">${formatDate(exp.date)}</small>
      </td>
      <td><span style="font-size:10px;padding:3px 7px;border-radius:6px;background:var(--background);border:1px solid var(--border);">${escapeHTML(exp.category)}</span></td>
      <td style="text-align:right;font-weight:700;color:var(--danger);">${money(exp.amount)}</td>
      <td style="text-align:center;">
        <button type="button" class="delete-item" title="Delete expense" data-exp-id="${exp.id}">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });

  tbody.querySelectorAll("[data-exp-id]").forEach((btn) => {
    btn.addEventListener("click", () => deleteExpense(btn.dataset.expId));
  });
}

// =========================================
// DATE / DAY HISTORY ARCHIVE (Removed per user request)
// =========================================

function renderDayHistory() {
  // Archive section removed from UI
}

// =========================================
// WHATSAPP & PRINT INVOICE
// =========================================

function sendWhatsApp(recordId) {
  if (!requireAuth()) return;

  const record = garageData.find((r) => String(r.id) === String(recordId));
  if (!record) {
    showToast("Record not found.", "error");
    return;
  }

  if (!record.phone) {
    showToast("Customer mobile number is missing.", "error");
    return;
  }

  const itemsList = (record.items || [])
    .map((item) => `• ${item.name} × ${item.qty} = ${money(item.total)}`)
    .join("\n");

  const subtotal = record.subtotal != null ? record.subtotal : roundMoney((record.items || []).reduce((s, it) => s + it.total, 0));
  const discount = Number(record.discountAmount) || 0;

  let billSummaryText = "";
  if (discount > 0) {
    billSummaryText = `*Subtotal:* ${money(subtotal)}\n*Discount:* -${money(discount)}\n*Total Bill:* ${money(record.totalAmount)}`;
  } else {
    billSummaryText = `*Total Bill:* ${money(record.totalAmount)}`;
  }

  const garageInfo = getGarageInfo();
  const garageTitleUpper = (garageInfo.garageName || "GARAGE SERVICE").toUpperCase();
  const ownerSignature = garageInfo.ownerName ? `\nOwner: ${garageInfo.ownerName}` : "";
  const contactSignature = garageInfo.phone ? `\nContact: ${garageInfo.phone}` : "";

  const message = `*${garageTitleUpper}*
━━━━━━━━━━━━━━━━━━━━━━━━
Hello *${record.name || "Customer"}*,
Here is your vehicle service invoice:

*Vehicle:* ${record.vehicleNo || "N/A"} (${record.vehicleType || "Vehicle"})
*Model:* ${record.vehicleModel || "N/A"}
*Date:* ${formatDate(record.date)}

*SERVICES & PARTS:*
${itemsList || "• Vehicle Service"}

━━━━━━━━━━━━━━━━━━━━━━━━
${billSummaryText}
*Amount Paid:* ${money(record.paidAmount)}
*Balance Due:* ${money(record.pendingAmount)}
*Payment Status:* ${record.paymentStatus}

Thank you for trusting ${garageInfo.garageName}!${ownerSignature}${contactSignature}
Please visit again!`;

  const cleanPhone = record.phone.startsWith("91") ? record.phone : `91${record.phone}`;
  window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
}

function printInvoice(recordId) {
  if (!requireAuth()) return;
  updateGarageBrandingUI();

  const record = garageData.find((r) => String(r.id) === String(recordId));
  if (!record) {
    showToast("Record not found.", "error");
    return;
  }

  document.getElementById("printDetails").innerHTML = `
    <div><strong>Customer Name:</strong> ${escapeHTML(record.name || "Customer")}</div>
    <div><strong>Mobile Number:</strong> ${escapeHTML(record.phone || "N/A")}</div>
    <div><strong>Vehicle Number:</strong> ${escapeHTML(record.vehicleNo || "N/A")}</div>
    <div><strong>Vehicle Type / Model:</strong> ${escapeHTML(record.vehicleType)} / ${escapeHTML(record.vehicleModel || "N/A")}</div>
    <div><strong>Invoice Date:</strong> ${formatDate(record.date)} ${escapeHTML(record.time || "")}</div>
    <div><strong>Payment Status:</strong> ${escapeHTML(record.paymentStatus)}</div>
  `;

  const tbody = document.getElementById("printItemsBody");
  tbody.innerHTML = "";

  (record.items || []).forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHTML(item.name)}</td>
      <td style="text-align:center;">${item.qty}</td>
      <td style="text-align:right;">${money(item.price)}</td>
      <td style="text-align:right;">${money(item.total)}</td>
    `;
    tbody.appendChild(row);
  });

  const subtotal = record.subtotal != null ? record.subtotal : roundMoney((record.items || []).reduce((s, it) => s + it.total, 0));
  const discount = Number(record.discountAmount) || 0;

  const subRow = document.getElementById("printSubtotalRow");
  const discRow = document.getElementById("printDiscountRow");

  if (discount > 0) {
    if (subRow) {
      subRow.style.display = "flex";
      document.getElementById("printSubtotal").textContent = money(subtotal);
    }
    if (discRow) {
      discRow.style.display = "flex";
      document.getElementById("printDiscount").textContent = `-${money(discount)}`;
    }
  } else {
    if (subRow) subRow.style.display = "none";
    if (discRow) discRow.style.display = "none";
  }

  document.getElementById("printTotal").textContent = money(record.totalAmount);
  document.getElementById("printReceived").textContent = money(record.paidAmount);
  document.getElementById("printBalance").textContent = money(record.pendingAmount);

  const printable = document.getElementById("printableBill");
  printable.style.display = "block";
  window.print();
  setTimeout(() => {
    printable.style.display = "none";
  }, 500);
}

// =========================================
// BACKUP, EXPORT & RESTORE
// =========================================

function exportToCSV(onlyActiveDay = false) {
  if (!requireAuth()) return;

  const records = onlyActiveDay
    ? garageData.filter((r) => isDateInScope(r.date))
    : garageData;

  if (records.length === 0) {
    showToast("No records available to export for selected scope.", "error");
    return;
  }

  const headers = [
    "ID",
    "Date",
    "Time",
    "Vehicle Type",
    "Vehicle Number",
    "Vehicle Model",
    "Customer Name",
    "Mobile Number",
    "Subtotal (INR)",
    "Discount (INR)",
    "Total Bill (INR)",
    "Amount Paid (INR)",
    "Balance Due (INR)",
    "Payment Status",
    "Services & Parts",
  ];

  const rows = records.map((r) => {
    const itemsText = (r.items || []).map((it) => `${it.name} (${it.qty}x${it.price})`).join(" | ");
    return [
      r.id,
      r.date,
      r.time || "",
      r.vehicleType,
      r.vehicleNo,
      r.vehicleModel,
      r.name,
      r.phone,
      r.subtotal != null ? r.subtotal : r.totalAmount,
      r.discountAmount || 0,
      r.totalAmount,
      r.paidAmount,
      r.pendingAmount,
      r.paymentStatus,
      itemsText,
    ];
  });

  let csvContent = headers.map(csvEscape).join(",") + "\n";
  rows.forEach((row) => {
    csvContent += row.map(csvEscape).join(",") + "\n";
  });

  const scopeInfo = getScopeDisplayInfo();
  const garageInfo = getGarageInfo();
  const safeGaragePrefix = (garageInfo.garageName || "Garage").replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = onlyActiveDay
    ? `${safeGaragePrefix}_${currentScope}_${getLocalDate()}.csv`
    : `${safeGaragePrefix}_All_History_${getLocalDate()}.csv`;

  downloadBlob(csvContent, filename, "text/csv;charset=utf-8;");
  showToast("CSV exported successfully.");
}

function downloadJSONBackup() {
  if (!requireAuth()) return;

  const garageInfo = getGarageInfo();
  const safeGaragePrefix = (garageInfo.garageName || "Garage").replace(/[^a-zA-Z0-9_-]/g, "_");
  const backupData = {
    app: garageInfo.garageName,
    version: "3.0",
    exportDate: getLocalDate(),
    timestamp: Date.now(),
    garageInfo,
    records: garageData,
    expenses: garageExpenses,
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  downloadBlob(jsonStr, `${safeGaragePrefix}_Backup_${getLocalDate()}.json`, "application/json");
  showToast("Full backup downloaded successfully.");
}

function triggerRestoreBackup() {
  if (!requireAuth()) return;
  document.getElementById("restoreFileInput").click();
}

function handleRestoreFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed || (!Array.isArray(parsed.records) && !Array.isArray(parsed))) {
        showToast("Invalid backup file format.", "error");
        return;
      }

      if (parsed.garageInfo && parsed.garageInfo.garageName) {
        saveGarageInfoLocally(parsed.garageInfo);
        updateGarageBrandingUI();
      }

      const newRecords = Array.isArray(parsed.records) ? parsed.records : parsed;
      const newExpenses = Array.isArray(parsed.expenses) ? parsed.expenses : [];

      askConfirm(
        "Restore Data from Backup?",
        `Found ${newRecords.length} service records and ${newExpenses.length} expenses. This will merge with your existing database and sync to cloud. Continue?`,
      ).then(async (confirmed) => {
        if (!confirmed) return;

        const recordsMap = new Map();
        garageData.forEach((r) => recordsMap.set(String(r.id), r));
        normalizeRecords(newRecords).forEach((r) => recordsMap.set(String(r.id), r));
        garageData = Array.from(recordsMap.values());

        const expensesMap = new Map();
        garageExpenses.forEach((exp) => expensesMap.set(String(exp.id), exp));
        normalizeExpenses(newExpenses).forEach((exp) => expensesMap.set(String(exp.id), exp));
        garageExpenses = Array.from(expensesMap.values());

        saveRecordsLocally();
        saveExpensesLocally();

        // Sync restored data to cloud
        if (cloudDb) {
          showToast("Syncing restored backup to cloud...", "info");
          for (const r of garageData) {
            await saveRecordToCloud(r);
          }
          for (const exp of garageExpenses) {
            await saveExpenseToCloud(exp);
          }
        }

        updateDashboard();
        refreshRecordsView();
        renderExpensesList();
        renderDayHistory();
        showToast("Backup restored and synced to cloud successfully!");
      });
    } catch (err) {
      showToast("Error reading backup file.", "error");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function csvEscape(val) {
  return `"${String(val ?? "").replaceAll('"', '""')}"`;
}

// =========================================
// DOM SETUP & EVENT LISTENERS
// =========================================

function setupDOMListeners() {
  // Day Navigator buttons
  document.getElementById("prevDayBtn")?.addEventListener("click", () => changeActiveDateByDays(-1));
  document.getElementById("nextDayBtn")?.addEventListener("click", () => changeActiveDateByDays(1));
  document.getElementById("jumpTodayBtn")?.addEventListener("click", () => setActiveDate(getLocalDate()));
  document.getElementById("bannerJumpTodayBtn")?.addEventListener("click", () => setActiveDate(getLocalDate()));
  document.getElementById("activeDatePicker")?.addEventListener("change", (e) => {
    if (e.target.value) setActiveDate(e.target.value);
  });

  // Form Job Date picker
  document.getElementById("formJobDate")?.addEventListener("change", (e) => {
    if (e.target.value) {
      document.getElementById("jobDateDisplay").textContent = formatPrettyDate(e.target.value);
    }
  });

  // Backup & Export dropdown
  const backupMenuBtn = document.getElementById("backupMenuBtn");
  const backupDropdown = document.getElementById("backupDropdownMenu");
  backupMenuBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    backupDropdown.hidden = !backupDropdown.hidden;
  });
  document.addEventListener("click", () => {
    if (backupDropdown) backupDropdown.hidden = true;
  });

  document.getElementById("exportDayCsvBtn")?.addEventListener("click", () => exportToCSV(true));
  document.getElementById("exportAllCsvBtn")?.addEventListener("click", () => exportToCSV(false));
  document.getElementById("downloadBackupBtn")?.addEventListener("click", downloadJSONBackup);
  document.getElementById("restoreBackupBtn")?.addEventListener("click", triggerRestoreBackup);
  document.getElementById("restoreFileInput")?.addEventListener("change", handleRestoreFile);

  // Theme toggle
  document.getElementById("themeToggleBtn")?.addEventListener("click", toggleTheme);

  // Job card item entry
  document.getElementById("addItemBtn")?.addEventListener("click", addPartRow);
  document.getElementById("saveJobBtn")?.addEventListener("click", saveJobCard);
  document.getElementById("clearFormBtn")?.addEventListener("click", () => clearForm(true));
  document.getElementById("amountReceived")?.addEventListener("input", updateBalanceDue);

  ["partName", "partQty", "partPrice"].forEach((id) => {
    document.getElementById(id)?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addPartRow();
      }
    });
  });

  setupVehicleSelector();
  setupPaymentOptions();
  setupDiscountListeners();
  setupInputGuards();

  // Expenses entry
  document.getElementById("addExpenseBtn")?.addEventListener("click", addDailyExpense);

  // Search and filters
  document.getElementById("searchInput")?.addEventListener("input", refreshRecordsView);
  document.getElementById("statusFilter")?.addEventListener("change", refreshRecordsView);
  document.getElementById("resetFiltersBtn")?.addEventListener("click", resetFilters);

  // View Scope Toggle (Active Period vs All Records)
  document.getElementById("scopeDateBtn")?.addEventListener("click", () => {
    filterScope = "date";
    document.getElementById("scopeDateBtn").classList.add("active");
    document.getElementById("scopeAllBtn").classList.remove("active");
    refreshRecordsView();
  });
  document.getElementById("scopeAllBtn")?.addEventListener("click", () => {
    filterScope = "all";
    document.getElementById("scopeAllBtn").classList.add("active");
    document.getElementById("scopeDateBtn").classList.remove("active");
    refreshRecordsView();
  });

  // Edit Modal Listeners
  document.getElementById("editModalCloseBtn")?.addEventListener("click", closeEditModal);
  document.getElementById("editModalCancel")?.addEventListener("click", closeEditModal);
  document.getElementById("editModalSave")?.addEventListener("click", saveEditedJobCard);
  document.getElementById("editAddItemBtn")?.addEventListener("click", addEditModalPart);
  document.getElementById("editAmountReceived")?.addEventListener("input", updateEditBalanceDue);
  document.getElementById("editPaymentStatus")?.addEventListener("change", updateEditBalanceDue);
  document.getElementById("editDiscountAmount")?.addEventListener("input", updateEditBalanceDue);
  document.getElementById("editDiscountAmount")?.addEventListener("change", updateEditBalanceDue);

  // Confirmation Modal
  document.getElementById("confirmCancel")?.addEventListener("click", () => closeConfirm(false));
  document.getElementById("confirmOk")?.addEventListener("click", () => closeConfirm(true));
  document.getElementById("confirmModal")?.addEventListener("click", (e) => {
    if (e.target.id === "confirmModal") closeConfirm(false);
  });

  // Global Keyboard Shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeConfirm(false);
      closePasswordModal();
      closeForgotPasswordModal();
      closeEditModal();
      closeCloudModal();
      closeGarageProfileModal();
      closeFamilyModal();
      return;
    }

    if (e.ctrlKey && e.key.toLowerCase() === "s" && !document.getElementById("editJobModal").hidden) {
      e.preventDefault();
      saveEditedJobCard();
      return;
    }

    if (e.ctrlKey && e.key.toLowerCase() === "s" && isSessionActive()) {
      e.preventDefault();
      saveJobCard();
    }
  });
}

function setupVehicleSelector() {
  const buttons = document.querySelectorAll(".vehicle-option");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      selectedVehicleType = button.dataset.vehicle;
      document.getElementById("vehicleType").value = selectedVehicleType;
    });
  });
}

function setupPaymentOptions() {
  const options = document.querySelectorAll(".payment-option");
  options.forEach((option) => {
    option.addEventListener("click", () => {
      options.forEach((item) => item.classList.remove("active"));
      option.classList.add("active");
      const radio = option.querySelector("input[type='radio']");
      if (radio) radio.checked = true;
      syncAmountReceived();
      updateBalanceDue();
    });
  });
}

function setupInputGuards() {
  document.getElementById("custPhone")?.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
  });

  document.getElementById("vehicleNo")?.addEventListener("input", (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
  });

  document.getElementById("editCustPhone")?.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
  });

  document.getElementById("editVehicleNo")?.addEventListener("input", (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
  });
}

function resetFilters() {
  document.getElementById("searchInput").value = "";
  document.getElementById("statusFilter").value = "all";
  refreshRecordsView();
}

// =========================================
// MODALS & NOTIFICATIONS
// =========================================

function askConfirm(title, message) {
  const modal = document.getElementById("confirmModal");
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmMessage").textContent = message;
  modal.hidden = false;

  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function closeConfirm(result) {
  const modal = document.getElementById("confirmModal");
  if (modal.hidden) return;
  modal.hidden = true;
  if (confirmResolver) {
    confirmResolver(result);
    confirmResolver = null;
  }
}

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toastMessage");
  const icon = toast.querySelector("i");

  toastMessage.textContent = message;

  if (type === "error") {
    icon.className = "fa-solid fa-circle-exclamation";
    icon.style.color = "#f87171";
  } else if (type === "info") {
    icon.className = "fa-solid fa-circle-info";
    icon.style.color = "#60a5fa";
  } else {
    icon.className = "fa-solid fa-circle-check";
    icon.style.color = "#4ade80";
  }

  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

// =========================================
// THEME SWITCHER
// =========================================

function toggleTheme() {
  const currentTheme = localStorage.getItem(STORAGE_KEYS.theme) || "light";
  const newTheme = currentTheme === "light" ? "dark" : "light";
  localStorage.setItem(STORAGE_KEYS.theme, newTheme);
  applyTheme(newTheme);
}

function applyTheme(theme) {
  const body = document.body;
  const themeBtn = document.getElementById("themeToggleBtn");
  const themeText = document.getElementById("themeText");
  const themeIcon = themeBtn?.querySelector("i");

  if (theme === "dark") {
    body.classList.add("dark-mode");
    if (themeText) themeText.textContent = "Light Mode";
    if (themeIcon) themeIcon.className = "fa-solid fa-sun";
  } else {
    body.classList.remove("dark-mode");
    if (themeText) themeText.textContent = "Dark Mode";
    if (themeIcon) themeIcon.className = "fa-solid fa-moon";
  }
}

function initializeTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) || "light";
  applyTheme(savedTheme);
}

// =========================================
// UTILITIES
// =========================================

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function toMoney(value) {
  return roundMoney(Number(value) || 0);
}

function clampMoney(value, max) {
  const amount = toMoney(value);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.min(amount, toMoney(max));
}

function toPositiveNumber(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return num;
}

function getVehicleIcon(type) {
  if (type === "Bike") return "🏍️";
  if (type === "Car") return "🚗";
  return "🚚";
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}