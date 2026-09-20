/* =========================================================
   PATEL AUTO GARAGE & SERVICE - COMPLETE CLIENT CONTROLLER
   Shared Cloud Firestore Database, Multi-Scope History & Billing
========================================================= */

const STORAGE_KEYS = {
  records: "patelAutoGarageData",
  expenses: "patelAutoGarageExpenses",
  owner: "patelAutoGarageOwner",
  familyMembers: "patelAutoGarageFamilyMembers",
  familyPasskey: "patelAutoGaragePasskey",
  activeMember: "patelAutoGarageActiveMember",
  loginSession: "patelAutoGarageLoginSession",
  loginLock: "patelAutoGarageLoginLock",
  theme: "patelAutoGarageTheme",
};

const FIRESTORE_COLLECTIONS = {
  records: "patel_records",
  expenses: "patel_expenses",
  meta: "patel_meta",
  family: "patel_family",
};

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
    setupAuthListeners();
    setupFamilyListeners();
    setupCloudListeners();

    // Check if configuration exists and initialize Cloud Database
    await initCloudSync();

    // Sync active family members and passkey from cloud
    await syncFamilyMembersFromCloud();

    if (await restoreLoginSession()) {
      openDashboard();
      return;
    }
    showLoginScreen(false);
  } catch (err) {
    console.error("App startup initialization error:", err);
    showLoginScreen(false);
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

  // Mode switching tabs & button
  const tabSignIn = document.getElementById("tabSignInBtn");
  const tabJoin = document.getElementById("tabJoinFamilyBtn");
  const switchBtn = document.getElementById("switchLoginModeBtn");

  if (tabSignIn) {
    tabSignIn.addEventListener("click", () => {
      loginMode = "signin";
      updateLoginMode();
    });
  }
  if (tabJoin) {
    tabJoin.addEventListener("click", () => {
      loginMode = "join";
      updateLoginMode();
    });
  }
  if (switchBtn) {
    switchBtn.addEventListener("click", () => {
      loginMode = loginMode === "signin" ? "join" : "signin";
      updateLoginMode();
    });
  }
}

function garageHasAccounts() {
  if (Array.isArray(garageFamilyMembers) && garageFamilyMembers.length > 0) {
    return true;
  }
  const cachedMembers = readJSON(STORAGE_KEYS.familyMembers, []);
  if (Array.isArray(cachedMembers) && cachedMembers.length > 0) {
    return true;
  }
  const owner = readJSON(STORAGE_KEYS.owner, null);
  if (owner && owner.username && owner.passwordHash) {
    return true;
  }
  return false;
}

function getActiveMember() {
  if (currentActiveMember && currentActiveMember.username) {
    return currentActiveMember;
  }
  const stored = readStorageJSON(sessionStorage, STORAGE_KEYS.activeMember, null) ||
                 readStorageJSON(localStorage, STORAGE_KEYS.activeMember, null);
  if (stored && stored.username) {
    currentActiveMember = stored;
    return stored;
  }
  const owner = readJSON(STORAGE_KEYS.owner, null);
  if (owner && owner.username) {
    return {
      username: owner.username,
      fullName: owner.fullName || "Owner",
      role: "Owner",
    };
  }
  return null;
}

function getStoredSession() {
  return (
    readStorageJSON(sessionStorage, STORAGE_KEYS.loginSession, null) ||
    readStorageJSON(localStorage, STORAGE_KEYS.loginSession, null)
  );
}

function isSessionActive() {
  if (!isAuthenticated || !verifiedSessionToken) return false;
  if (!garageHasAccounts()) return false;

  const session = getStoredSession();
  if (!session || !session.token) return false;
  if (!timingSafeEqual(session.token, verifiedSessionToken)) return false;
  if (session.expiresAt && Date.now() > session.expiresAt) return false;
  return true;
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
  closeConfirm(false);
  updateLoginMode();

  if (clearForm) {
    document.getElementById("loginForm").reset();
  }

  window.setTimeout(() => {
    document.getElementById("loginUsername").focus();
  }, 0);
}

function updateLoginMode() {
  const hasAccounts = garageHasAccounts();
  const tabs = document.getElementById("loginTabs");
  const tabSignIn = document.getElementById("tabSignInBtn");
  const tabJoin = document.getElementById("tabJoinFamilyBtn");
  const switchBtn = document.getElementById("switchLoginModeBtn");
  const subtitle = document.getElementById("loginSubtitle");
  const joinNameGroup = document.getElementById("joinNameGroup");
  const joinRoleGroup = document.getElementById("joinRoleGroup");
  const confirmGroup = document.getElementById("confirmPasswordGroup");
  const passkeyGroup = document.getElementById("familyPasskeyGroup");
  const passkeyLabel = document.getElementById("familyPasskeyLabel");
  const passkeyHint = document.getElementById("familyPasskeyHint");
  const passkeyInput = document.getElementById("loginFamilyPasskey");
  const submitText = document.getElementById("loginSubmitText");
  const rememberRow = document.getElementById("rememberRow");
  const passwordInput = document.getElementById("loginPassword");
  const confirmInput = document.getElementById("loginPasswordConfirm");
  const fullNameInput = document.getElementById("loginFullName");

  document.getElementById("loginError").hidden = true;
  setLoginBusy(false);

  if (!hasAccounts) {
    // Initial Setup Mode: Create Master Account & PIN
    loginMode = "setup";
    if (tabs) tabs.hidden = true;
    if (switchBtn) switchBtn.hidden = true;
    if (subtitle) {
      subtitle.textContent = "Create Master Owner login & set 6-digit family passkey for your garage.";
    }
    if (joinNameGroup) joinNameGroup.hidden = false;
    if (joinRoleGroup) joinRoleGroup.hidden = true;
    if (confirmGroup) confirmGroup.hidden = false;
    if (passkeyGroup) passkeyGroup.hidden = false;
    if (passkeyLabel) passkeyLabel.textContent = "Create Garage Family Passkey (6-digit PIN)";
    if (passkeyHint) passkeyHint.textContent = "You will share this PIN with your brother so he can join from his device.";
    if (rememberRow) rememberRow.hidden = true;
    if (submitText) submitText.textContent = "Create Owner & Setup Cloud Garage";

    confirmInput.disabled = false;
    confirmInput.required = true;
    passkeyInput.disabled = false;
    passkeyInput.required = true;
    if (fullNameInput) fullNameInput.required = true;
    passwordInput.autocomplete = "new-password";
  } else {
    // Garage already exists: allow Sign In or Join Family
    if (tabs) tabs.hidden = false;
    if (switchBtn) switchBtn.hidden = false;

    if (loginMode === "join") {
      if (tabJoin) tabJoin.classList.add("is-active");
      if (tabSignIn) tabSignIn.classList.remove("is-active");
      if (subtitle) subtitle.textContent = "Authorize your device to join the Patel Auto Garage family database";
      if (joinNameGroup) joinNameGroup.hidden = false;
      if (joinRoleGroup) joinRoleGroup.hidden = false;
      if (confirmGroup) confirmGroup.hidden = false;
      if (passkeyGroup) passkeyGroup.hidden = false;
      if (passkeyLabel) passkeyLabel.textContent = "Garage Family Passkey (PIN)";
      if (passkeyHint) passkeyHint.textContent = "Enter the 6-digit PIN given to you by the garage owner.";
      if (rememberRow) rememberRow.hidden = false;
      if (submitText) submitText.textContent = "Join Family & Sign In";
      if (switchBtn) switchBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Already registered? Sign In';

      confirmInput.disabled = false;
      confirmInput.required = true;
      passkeyInput.disabled = false;
      passkeyInput.required = true;
      if (fullNameInput) fullNameInput.required = true;
      passwordInput.autocomplete = "new-password";
    } else {
      // Default: Sign In
      loginMode = "signin";
      if (tabSignIn) tabSignIn.classList.add("is-active");
      if (tabJoin) tabJoin.classList.remove("is-active");
      if (subtitle) subtitle.textContent = "Sign in to access live garage job cards, bills & payments";
      if (joinNameGroup) joinNameGroup.hidden = true;
      if (joinRoleGroup) joinRoleGroup.hidden = true;
      if (confirmGroup) confirmGroup.hidden = true;
      if (passkeyGroup) passkeyGroup.hidden = true;
      if (rememberRow) rememberRow.hidden = false;
      if (submitText) submitText.textContent = "Sign In";
      if (switchBtn) switchBtn.innerHTML = '<i class="fa-solid fa-users"></i> Join Family Device with Passkey';

      confirmInput.disabled = true;
      confirmInput.required = false;
      passkeyInput.disabled = true;
      passkeyInput.required = false;
      if (fullNameInput) fullNameInput.required = false;
      passwordInput.autocomplete = "current-password";
    }
  }
}

function toggleLoginPassword() {
  const input = document.getElementById("loginPassword");
  const button = document.getElementById("togglePasswordBtn");
  const icon = button.querySelector("i");
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  icon.className = show ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
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
  button.disabled = busy;
  document.getElementById("loginUsername").readOnly = busy;
  document.getElementById("loginPassword").readOnly = busy;
  document.getElementById("loginPasswordConfirm").readOnly = busy;
  const passkeyInput = document.getElementById("loginFamilyPasskey");
  if (passkeyInput) passkeyInput.readOnly = busy;
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  if (loginBusy) return;

  const lock = getLoginLock();
  if (Date.now() < lock.until) {
    const seconds = Math.ceil((lock.until - Date.now()) / 1000);
    setLoginError(`Too many failed attempts. Try again in ${seconds} seconds.`);
    return;
  }

  const username = document.getElementById("loginUsername").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;
  const confirmPassword = document.getElementById("loginPasswordConfirm").value;
  const fullName = (document.getElementById("loginFullName")?.value || "").trim();
  const role = document.getElementById("loginRole")?.value || "Brother / Partner";
  const passkey = (document.getElementById("loginFamilyPasskey")?.value || "").trim();
  const remember = document.getElementById("rememberMe")?.checked || false;

  if (username.length < 3 || username.length > 30) {
    setLoginError("Username must be between 3 and 30 characters.");
    return;
  }

  if (password.length < 6) {
    setLoginError("Password must be at least 6 characters.");
    return;
  }

  setLoginBusy(true);

  try {
    // 1. If cloud is available, refresh family data
    if (cloudDb) {
      await syncFamilyMembersFromCloud();
    }

    // 2. Handle Initial Setup Mode
    if (loginMode === "setup") {
      if (!/^[a-z0-9._-]+$/.test(username)) {
        setLoginError("Username can only contain letters, numbers, dot, underscore and hyphen.");
        return;
      }
      if (password !== confirmPassword) {
        setLoginError("Passwords do not match.");
        return;
      }
      if (!passkey || passkey.length < 4) {
        setLoginError("Please create a family passkey PIN (at least 4-6 digits).");
        return;
      }

      const passwordHash = await hashCredential(username, password);
      const ownerMember = {
        username,
        fullName: fullName || "Owner",
        role: "Owner",
        passwordHash,
        createdAt: Date.now(),
        status: "active",
      };

      garageFamilyPasskey = passkey;
      garageFamilyMembers = [ownerMember];
      saveFamilyMembersLocally();
      localStorage.setItem(STORAGE_KEYS.familyPasskey, passkey);
      localStorage.setItem(STORAGE_KEYS.owner, JSON.stringify(ownerMember));

      if (cloudDb) {
        try {
          await cloudDb.collection(FIRESTORE_COLLECTIONS.family).doc(username).set(ownerMember);
          await cloudDb.collection(FIRESTORE_COLLECTIONS.meta).doc("garage_info").set({
            garageName: "Patel Auto Garage & Service",
            familyPasskey: passkey,
            ownerUsername: username,
            createdAt: Date.now(),
          });
          await cloudDb.collection(FIRESTORE_COLLECTIONS.meta).doc("owner").set(ownerMember);
          console.log("Master Owner & Family Passkey initialized in shared Cloud Firestore.");
        } catch (e) {
          console.warn("Could not save initial owner/passkey to cloud:", e);
        }
      }

      await createLoginSession(ownerMember, false);
      document.getElementById("loginForm").reset();
      showToast("🎉 Master Owner account created & saved to shared Cloud Database!");
      openDashboard();
      return;
    }

    // 3. Handle Join Family with Passkey
    if (loginMode === "join") {
      if (password !== confirmPassword) {
        setLoginError("Passwords do not match.");
        return;
      }

      const activePin = await getActivePasskey();
      if (passkey !== activePin) {
        setLoginError("Incorrect Family Passkey PIN. Ask the garage owner for the PIN.");
        return;
      }

      const existing = findFamilyMember(username);
      if (existing) {
        setLoginError("This username is already registered. Please choose another username or Sign In.");
        return;
      }

      const passwordHash = await hashCredential(username, password);
      const newMember = {
        username,
        fullName: fullName || username,
        role: role || "Brother / Partner",
        passwordHash,
        createdAt: Date.now(),
        status: "active",
      };

      garageFamilyMembers.push(newMember);
      saveFamilyMembersLocally();

      if (cloudDb) {
        try {
          await cloudDb.collection(FIRESTORE_COLLECTIONS.family).doc(username).set(newMember);
          console.log("New family member registered to Cloud Firestore:", username);
        } catch (e) {
          console.warn("Could not save new family member to cloud:", e);
        }
      }

      await createLoginSession(newMember, remember);
      document.getElementById("loginForm").reset();
      showToast(`Welcome to the family database, ${newMember.fullName}!`);
      openDashboard();
      return;
    }

    // 4. Default: Sign In
    const member = findFamilyMember(username);
    if (!member) {
      const nextAttempts = lock.attempts + 1;
      if (nextAttempts >= MAX_LOGIN_ATTEMPTS) {
        setLoginLock(0, Date.now() + LOCK_MS);
        setLoginError("Too many failed attempts. Login is locked for 1 minute.");
        return;
      }
      setLoginLock(nextAttempts, 0);
      setLoginError("Username not found. Check spelling or choose 'Join Family' if this is your first time.");
      return;
    }

    const passwordOk = verifyMemberPassword(member, password);
    if (!passwordOk) {
      const nextAttempts = lock.attempts + 1;
      if (nextAttempts >= MAX_LOGIN_ATTEMPTS) {
        setLoginLock(0, Date.now() + LOCK_MS);
        setLoginError("Too many failed attempts. Login is locked for 1 minute.");
        return;
      }
      setLoginLock(nextAttempts, 0);
      setLoginError("Incorrect password.");
      document.getElementById("loginPassword").value = "";
      document.getElementById("loginPassword").focus();
      return;
    }

    clearLoginLock();
    await createLoginSession(member, remember);
    document.getElementById("loginForm").reset();
    showToast(`Welcome back, ${member.fullName || member.username}!`);
    openDashboard();
  } catch (error) {
    console.error("Login error:", error);
    setLoginError("Could not complete login. Please try again.");
  } finally {
    setLoginBusy(false);
  }
}

function setLoginError(message) {
  const error = document.getElementById("loginError");
  error.textContent = message;
  error.hidden = false;
}

async function createLoginSession(member, remember) {
  const token = await hashText(`${AUTH_SALT}|session|${member.username}|${member.passwordHash}`);
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
    `${AUTH_SALT}|session|${member.username}|${member.passwordHash}`,
  );
  const legacyTokenV1 = hashText(`patel-auto-garage-v1|session|${member.username}|${member.passwordHash}`);
  const legacyTokenV2 = hashText(`patel-auto-garage-v2|session|${member.username}|${member.passwordHash}`);

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
  if (cloudDb) {
    try {
      const doc = await cloudDb.collection(FIRESTORE_COLLECTIONS.meta).doc("garage_info").get();
      if (doc.exists && doc.data().familyPasskey) {
        garageFamilyPasskey = String(doc.data().familyPasskey);
        localStorage.setItem(STORAGE_KEYS.familyPasskey, garageFamilyPasskey);
        return garageFamilyPasskey;
      }
    } catch (e) {
      console.warn("Could not fetch passkey from cloud:", e);
    }
  }
  const saved = localStorage.getItem(STORAGE_KEYS.familyPasskey);
  if (saved) return saved;
  return garageFamilyPasskey || "123456";
}

function findFamilyMember(username) {
  const clean = String(username || "").trim().toLowerCase();
  const found = garageFamilyMembers.find((m) => String(m.username || "").toLowerCase() === clean);
  if (found) return found;

  const cached = readJSON(STORAGE_KEYS.familyMembers, []);
  const foundCached = cached.find((m) => String(m.username || "").toLowerCase() === clean);
  if (foundCached) return foundCached;

  const owner = readJSON(STORAGE_KEYS.owner, null);
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
  if (!cloudDb) return;
  try {
    const snap = await cloudDb.collection(FIRESTORE_COLLECTIONS.family).get();
    const members = [];
    snap.forEach((doc) => members.push(doc.data()));

    if (members.length === 0) {
      const ownerDoc = await cloudDb.collection(FIRESTORE_COLLECTIONS.meta).doc("owner").get();
      if (ownerDoc.exists) {
        const ownerData = ownerDoc.data();
        members.push({
          username: ownerData.username,
          fullName: ownerData.fullName || "Owner",
          role: "Owner",
          passwordHash: ownerData.passwordHash,
          createdAt: ownerData.createdAt || Date.now(),
          status: "active",
        });
      }
    }

    if (members.length > 0) {
      garageFamilyMembers = members;
      saveFamilyMembersLocally();
    }

    const metaDoc = await cloudDb.collection(FIRESTORE_COLLECTIONS.meta).doc("garage_info").get();
    if (metaDoc.exists && metaDoc.data().familyPasskey) {
      garageFamilyPasskey = String(metaDoc.data().familyPasskey);
      localStorage.setItem(STORAGE_KEYS.familyPasskey, garageFamilyPasskey);
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
  ).then((ok) => {
    if (!ok) return;
    stopDayWatcher();
    clearLoginSession();
    wipeDashboardState();
    showLoginScreen(true);
    showToast("Logged out successfully.");
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

  if (!owner) {
    showToast("Owner account not found.", "error");
    return;
  }

  const currentPasswordOk = verifyOwnerPassword(owner, owner.username, currentPassword);
  if (!currentPasswordOk) {
    showToast("Current password is incorrect.", "error");
    return;
  }

  if (newPassword.length < 6) {
    showToast("New password must be at least 6 characters.", "error");
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast("New passwords do not match.", "error");
    return;
  }

  const passwordHash = await hashCredential(owner.username, newPassword);
  const updatedOwner = {
    ...owner,
    passwordHash,
    updatedAt: Date.now(),
  };

  localStorage.setItem(STORAGE_KEYS.owner, JSON.stringify(updatedOwner));

  // Sync to Cloud
  if (cloudDb) {
    try {
      await cloudDb.collection(FIRESTORE_COLLECTIONS.meta).doc("owner").set(updatedOwner);
      console.log("Updated password synced to Cloud Firestore.");
    } catch (e) {
      console.warn("Could not sync updated password to cloud:", e);
    }
  }

  const storedSession = getStoredSession();
  const remember = Boolean(storedSession && storedSession.expiresAt);
  await createLoginSession(owner.username, passwordHash, remember);
  closePasswordModal();
  showToast("Password updated successfully.");
}

function setupResetLogin() {
  const resetBtn = document.getElementById("resetLoginBtn");
  if (!resetBtn) return;
  resetBtn.addEventListener("click", () => {
    const hasOwner = ownerAccountExists();
    if (!hasOwner) {
      showToast("No owner login exists yet. Create one using the form above.");
      return;
    }

    askConfirm(
      "Reset Owner Login?",
      "This will reset your login username and password so you can set a new one. Your garage service records and history will NOT be deleted. Proceed?",
    ).then(async (ok) => {
      if (!ok) return;
      localStorage.removeItem(STORAGE_KEYS.owner);
      sessionStorage.removeItem(STORAGE_KEYS.loginSession);
      localStorage.removeItem(STORAGE_KEYS.loginSession);
      sessionStorage.removeItem(STORAGE_KEYS.loginLock);

      if (cloudDb) {
        try {
          await cloudDb.collection(FIRESTORE_COLLECTIONS.meta).doc("owner").delete();
        } catch (e) {
          console.warn("Could not delete owner from cloud:", e);
        }
      }

      updateLoginMode();
      showToast("Owner login has been reset. You can now create a new login.");
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
  updateCloudStatusUI("connecting", "Connecting Cloud...");
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

function setupCloudRealtimeListeners() {
  if (!cloudDb) return;

  // 1. Records real-time listener
  if (cloudRecordsUnsubscribe) cloudRecordsUnsubscribe();
  cloudRecordsUnsubscribe = cloudDb
    .collection(FIRESTORE_COLLECTIONS.records)
    .onSnapshot(
      (snapshot) => {
        let hasChanges = false;
        const cloudRecords = [];
        snapshot.forEach((doc) => {
          cloudRecords.push(doc.data());
        });

        const recordMap = new Map();
        cloudRecords.forEach((r) => recordMap.set(String(r.id), r));

        // Also keep local records that might not have synced yet
        garageData.forEach((r) => {
          if (!recordMap.has(String(r.id))) {
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
            updateDashboard();
            refreshRecordsView();
            renderDayHistory();
            if (!isInitialCloudLoad) {
              showToast("🔄 Synced latest records from shared cloud database!");
            }
          }
        }
        if (isInitialCloudLoad && cloudRecords.length === 0 && garageData.length > 0) {
          console.log("Local records detected while cloud is empty. Auto-migrating to cloud...");
          migrateLocalDataToCloud();
        }
        isInitialCloudLoad = false;
      },
      (error) => {
        console.warn("Cloud records listener error:", error);
        updateCloudStatusUI("offline", "Cloud Offline");
      },
    );

  // 2. Expenses real-time listener
  if (cloudExpensesUnsubscribe) cloudExpensesUnsubscribe();
  cloudExpensesUnsubscribe = cloudDb
    .collection(FIRESTORE_COLLECTIONS.expenses)
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
          if (!expMap.has(String(e.id))) {
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
        console.warn("Cloud expenses listener error:", error);
      },
    );

  // 3. Family members real-time listener
  if (cloudFamilyUnsubscribe) cloudFamilyUnsubscribe();
  cloudFamilyUnsubscribe = cloudDb
    .collection(FIRESTORE_COLLECTIONS.family)
    .onSnapshot(
      (snapshot) => {
        const members = [];
        snapshot.forEach((doc) => members.push(doc.data()));
        if (members.length > 0) {
          garageFamilyMembers = members;
          saveFamilyMembersLocally();
          renderFamilyMembersTable();
          updateActiveMemberUI();
        }
      },
      (error) => {
        console.warn("Cloud family listener error:", error);
      }
    );

  // 4. Meta / Garage Info real-time listener (for live passkey changes)
  if (cloudMetaUnsubscribe) cloudMetaUnsubscribe();
  cloudMetaUnsubscribe = cloudDb
    .collection(FIRESTORE_COLLECTIONS.meta)
    .doc("garage_info")
    .onSnapshot(
      (doc) => {
        if (doc.exists && doc.data().familyPasskey) {
          garageFamilyPasskey = String(doc.data().familyPasskey);
          localStorage.setItem(STORAGE_KEYS.familyPasskey, garageFamilyPasskey);
          const pinInput = document.getElementById("familyPasskeyInput");
          if (pinInput) pinInput.value = garageFamilyPasskey;
        }
      },
      (error) => {
        console.warn("Cloud meta listener error:", error);
      }
    );
}

async function saveRecordToCloud(record) {
  if (!cloudDb) return;
  try {
    const activeMember = getActiveMember();
    const tag = activeMember ? `${activeMember.fullName || activeMember.username} (${activeMember.role || 'Member'})` : 'Garage Staff';
    if (!record.createdBy) record.createdBy = tag;
    record.lastUpdatedBy = tag;
    record.updatedAt = Date.now();
    await cloudDb.collection(FIRESTORE_COLLECTIONS.records).doc(String(record.id)).set(record);
    lastCloudSyncTime = Date.now();
    updateCloudSyncStats();
  } catch (err) {
    console.warn("Cloud save record failed (cached locally):", err);
  }
}

async function deleteRecordFromCloud(recordId) {
  if (!cloudDb) return;
  try {
    await cloudDb.collection(FIRESTORE_COLLECTIONS.records).doc(String(recordId)).delete();
    lastCloudSyncTime = Date.now();
    updateCloudSyncStats();
  } catch (err) {
    console.warn("Cloud delete record failed:", err);
  }
}

async function saveExpenseToCloud(expense) {
  if (!cloudDb) return;
  try {
    const activeMember = getActiveMember();
    const tag = activeMember ? `${activeMember.fullName || activeMember.username} (${activeMember.role || 'Member'})` : 'Garage Staff';
    if (!expense.recordedBy) expense.recordedBy = tag;
    await cloudDb.collection(FIRESTORE_COLLECTIONS.expenses).doc(String(expense.id)).set(expense);
    lastCloudSyncTime = Date.now();
    updateCloudSyncStats();
  } catch (err) {
    console.warn("Cloud save expense failed:", err);
  }
}

async function deleteExpenseFromCloud(expenseId) {
  if (!cloudDb) return;
  try {
    await cloudDb.collection(FIRESTORE_COLLECTIONS.expenses).doc(String(expenseId)).delete();
    lastCloudSyncTime = Date.now();
    updateCloudSyncStats();
  } catch (err) {
    console.warn("Cloud delete expense failed:", err);
  }
}

async function migrateLocalDataToCloud() {
  if (!cloudDb) {
    showToast("Cloud database is not connected. Connect first.", "error");
    return;
  }

  showToast("Uploading local records to shared cloud database...", "info");
  const migrateBtn = document.getElementById("cloudMigrateBtn");
  if (migrateBtn) migrateBtn.disabled = true;

  try {
    let uploadedRecords = 0;
    let uploadedExpenses = 0;

    for (const record of garageData) {
      await cloudDb.collection(FIRESTORE_COLLECTIONS.records).doc(String(record.id)).set(record);
      uploadedRecords++;
    }

    for (const expense of garageExpenses) {
      await cloudDb.collection(FIRESTORE_COLLECTIONS.expenses).doc(String(expense.id)).set(expense);
      uploadedExpenses++;
    }

    // Migrate family members and master owner
    const owner = getActiveMember();
    if (owner) {
      await cloudDb.collection(FIRESTORE_COLLECTIONS.family).doc(owner.username).set({
        ...owner,
        status: "active",
        createdAt: Date.now(),
      });
      await cloudDb.collection(FIRESTORE_COLLECTIONS.meta).doc("garage_info").set({
        garageName: "Patel Auto Garage & Service",
        familyPasskey: garageFamilyPasskey || "123456",
        ownerUsername: owner.username,
        updatedAt: Date.now(),
      }, { merge: true });
    }

    lastCloudSyncTime = Date.now();
    updateCloudSyncStats();
    updateCloudStatusUI("online", "Cloud Synced");
    showToast(`✅ Uploaded ${uploadedRecords} records & ${uploadedExpenses} expenses to cloud database!`);
  } catch (err) {
    console.error("Migration failed:", err);
    showToast("Cloud upload encountered an error. Check settings.", "error");
  } finally {
    if (migrateBtn) migrateBtn.disabled = false;
  }
}

function updateActiveMemberUI() {
  const member = getActiveMember();
  const nameEl = document.getElementById("topbarMemberName");
  const roleEl = document.getElementById("topbarMemberRole");
  const countEl = document.getElementById("topbarFamilyCount");

  if (nameEl) nameEl.textContent = member ? (member.fullName || member.username) : "Owner";
  if (roleEl) roleEl.textContent = member ? (member.role || "Admin") : "Admin";
  if (countEl) countEl.textContent = garageFamilyMembers.length || 1;
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

      if (cloudDb) {
        try {
          await cloudDb.collection(FIRESTORE_COLLECTIONS.meta).doc("garage_info").set(
            { familyPasskey: cleanPin, updatedAt: Date.now() },
            { merge: true }
          );
          showToast("✅ Family Passkey updated & synced to all devices!");
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

      if (cloudDb) {
        try {
          await cloudDb.collection(FIRESTORE_COLLECTIONS.family).doc(username).set(newMember);
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

  if (cloudDb) {
    try {
      await cloudDb.collection(FIRESTORE_COLLECTIONS.family).doc(clean).delete();
      showToast(`Removed @${clean} from cloud database.`);
    } catch (e) {
      console.warn("Could not delete member from cloud:", e);
    }
  }
  renderFamilyMembersTable();
};

async function forceCloudSync() {
  if (!cloudDb) {
    const ok = await initCloudSync();
    if (!ok) {
      showToast("Cannot connect to cloud database. Please verify configuration.", "error");
      return;
    }
  }

  showToast("Syncing with shared cloud database...", "info");
  try {
    const recSnap = await cloudDb.collection(FIRESTORE_COLLECTIONS.records).get();
    const cloudRecords = [];
    recSnap.forEach((doc) => cloudRecords.push(doc.data()));

    const expSnap = await cloudDb.collection(FIRESTORE_COLLECTIONS.expenses).get();
    const cloudExpenses = [];
    expSnap.forEach((doc) => cloudExpenses.push(doc.data()));

    const rMap = new Map();
    garageData.forEach((r) => rMap.set(String(r.id), r));
    cloudRecords.forEach((r) => rMap.set(String(r.id), r));
    garageData = normalizeRecords(
      Array.from(rMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    );

    const eMap = new Map();
    garageExpenses.forEach((e) => eMap.set(String(e.id), e));
    cloudExpenses.forEach((e) => eMap.set(String(e.id), e));
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

  const closeBtn = document.getElementById("cloudModalCloseBtn");
  const doneBtn = document.getElementById("cloudModalDoneBtn");
  if (closeBtn) closeBtn.addEventListener("click", closeCloudModal);
  if (doneBtn) doneBtn.addEventListener("click", closeCloudModal);

  const forceBtn = document.getElementById("cloudForceSyncBtn");
  if (forceBtn) forceBtn.addEventListener("click", forceCloudSync);

  const migrateBtn = document.getElementById("cloudMigrateBtn");
  if (migrateBtn) migrateBtn.addEventListener("click", migrateLocalDataToCloud);

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

      if (!cfg.projectId && !cfg.apiKey) {
        showToast("Please enter at least Project ID or API Key.", "error");
        return;
      }

      if (window.GarageCloud) {
        window.GarageCloud.saveConfig(cfg);
        showToast("Configuration saved. Connecting...", "info");
        await initCloudSync();
        closeCloudModal();
      }
    });
  }

  const resetCfgBtn = document.getElementById("resetCloudConfigBtn");
  if (resetCfgBtn) {
    resetCfgBtn.addEventListener("click", async () => {
      if (window.GarageCloud) {
        window.GarageCloud.clearConfig();
        populateCloudConfigForm();
        showToast("Reset to default configuration.");
        await initCloudSync();
      }
    });
  }
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
  if (!requireAuth()) {
    garageData = [];
    garageExpenses = [];
    return;
  }
  garageData = normalizeRecords(readJSON(STORAGE_KEYS.records, []));
  garageExpenses = normalizeExpenses(readJSON(STORAGE_KEYS.expenses, []));
}

function saveRecordsLocally() {
  localStorage.setItem(STORAGE_KEYS.records, JSON.stringify(garageData));
}

function saveExpensesLocally() {
  localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(garageExpenses));
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

    const totalAmount = roundMoney(
      items.reduce((sum, item) => sum + item.total, 0) ||
        Number(record.totalAmount) ||
        0,
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
    if (filterScope === "date") {
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
        ${money(record.totalAmount)}
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

function getGrandTotal() {
  return roundMoney(currentItems.reduce((sum, item) => sum + item.total, 0));
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

  const total = getGrandTotal();
  document.getElementById("billTotal").textContent = money(total);
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

  const totalAmount = getGrandTotal();
  const paidAmount = getAmountReceived();

  if (paidAmount > totalAmount) {
    showToast("Amount received cannot be greater than the bill total.", "error");
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

  const total = roundMoney(editModalItems.reduce((sum, it) => sum + it.total, 0));
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
  const total = roundMoney(editModalItems.reduce((sum, it) => sum + it.total, 0));
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

  const totalAmount = roundMoney(editModalItems.reduce((sum, it) => sum + it.total, 0));
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

function deleteExpense(expenseId) {
  if (!requireAuth()) return;

  garageExpenses = garageExpenses.filter((e) => String(e.id) !== String(expenseId));
  saveExpensesLocally();
  deleteExpenseFromCloud(expenseId);

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
// DATE / DAY HISTORY ARCHIVE
// =========================================

function renderDayHistory() {
  const grid = document.getElementById("dayHistoryGrid");
  const empty = document.getElementById("emptyDayHistory");
  const daysCountLabel = document.getElementById("historyDaysCount");
  grid.innerHTML = "";

  const datesSet = new Set();
  garageData.forEach((r) => datesSet.add(r.date));
  garageExpenses.forEach((e) => datesSet.add(e.date));
  datesSet.add(getLocalDate());
  if (activeDate) datesSet.add(activeDate);

  const sortedDates = Array.from(datesSet).sort().reverse();

  daysCountLabel.textContent = `${sortedDates.length} Day${sortedDates.length !== 1 ? "s" : ""} Recorded`;

  if (sortedDates.length === 0) {
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";

  sortedDates.forEach((dateStr) => {
    const dayRecords = garageData.filter((r) => r.date === dateStr);
    const dayExpenses = garageExpenses.filter((e) => e.date === dateStr);

    const completedJobs = dayRecords.length;
    const totalBilled = roundMoney(dayRecords.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0));
    const incomeCollected = roundMoney(dayRecords.reduce((sum, r) => sum + (Number(r.paidAmount) || 0), 0));
    const pendingAmount = roundMoney(dayRecords.reduce((sum, r) => sum + (Number(r.pendingAmount) || 0), 0));
    const totalExp = roundMoney(dayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0));

    const isSelected = dateStr === activeDate && currentScope === "day";
    const isToday = dateStr === getLocalDate();
    const isPending = pendingAmount > 0;

    const card = document.createElement("div");
    card.className = `day-history-card ${isSelected ? "is-selected" : ""}`;

    card.innerHTML = `
      <div>
        <div class="card-date-row">
          <div>
            <strong>${formatPrettyDate(dateStr)}</strong>
            ${isToday ? '<span style="font-size:10px;margin-left:6px;color:var(--primary);font-weight:800;">(Today)</span>' : ""}
          </div>
          <span class="card-status-pill ${isPending ? "pending" : "paid"}">
            ${isPending ? `Pending ${money(pendingAmount)}` : "Fully Paid"}
          </span>
        </div>

        <div class="card-metrics-grid">
          <div class="metric-item">
            <span>Vehicles</span>
            <strong>${completedJobs}</strong>
          </div>
          <div class="metric-item">
            <span>Billed</span>
            <strong>${money(totalBilled)}</strong>
          </div>
          <div class="metric-item">
            <span>Collected</span>
            <strong style="color:var(--success);">${money(incomeCollected)}</strong>
          </div>
          <div class="metric-item">
            <span>Expenses</span>
            <strong style="color:var(--purple);">${money(totalExp)}</strong>
          </div>
        </div>
      </div>

      <button type="button" class="btn-open-day" data-open-date="${dateStr}">
        ${isSelected ? '<i class="fa-solid fa-check"></i> Currently Viewing' : '<i class="fa-solid fa-folder-open"></i> Open Day &amp; Manage'}
      </button>
    `;

    grid.appendChild(card);
  });

  grid.querySelectorAll("[data-open-date]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setActiveDate(btn.dataset.openDate);
      filterScope = "date";
      document.getElementById("scopeDateBtn")?.classList.add("active");
      document.getElementById("scopeAllBtn")?.classList.remove("active");
      refreshRecordsView();
      document.getElementById("performanceNavigator")?.scrollIntoView({ behavior: "smooth" });
    });
  });
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

  const message = `*PATEL AUTO GARAGE & SERVICE*
━━━━━━━━━━━━━━━━━━━━━━━━
Hello *${record.name || "Customer"}*,
Here is your vehicle service invoice:

*Vehicle:* ${record.vehicleNo || "N/A"} (${record.vehicleType || "Vehicle"})
*Model:* ${record.vehicleModel || "N/A"}
*Date:* ${formatDate(record.date)}

*SERVICES & PARTS:*
${itemsList || "• Vehicle Service"}

━━━━━━━━━━━━━━━━━━━━━━━━
*Total Bill:* ${money(record.totalAmount)}
*Amount Paid:* ${money(record.paidAmount)}
*Balance Due:* ${money(record.pendingAmount)}
*Payment Status:* ${record.paymentStatus}

Thank you for trusting Patel Auto Garage!
Owner: Harsh Savani
Please visit again!`;

  const cleanPhone = record.phone.startsWith("91") ? record.phone : `91${record.phone}`;
  window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
}

function printInvoice(recordId) {
  if (!requireAuth()) return;

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
  const filename = onlyActiveDay
    ? `Patel_Garage_${currentScope}_${getLocalDate()}.csv`
    : `Patel_Garage_All_History_${getLocalDate()}.csv`;

  downloadBlob(csvContent, filename, "text/csv;charset=utf-8;");
  showToast("CSV exported successfully.");
}

function downloadJSONBackup() {
  if (!requireAuth()) return;

  const backupData = {
    app: "PatelAutoGarage&Service",
    version: "3.0",
    exportDate: getLocalDate(),
    timestamp: Date.now(),
    records: garageData,
    expenses: garageExpenses,
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  downloadBlob(jsonStr, `Patel_Garage_Backup_${getLocalDate()}.json`, "application/json");
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
      closeEditModal();
      closeCloudModal();
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