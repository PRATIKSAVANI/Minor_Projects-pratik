/* =========================================================
   PATEL AUTO GARAGE & SERVICE - COMPLETE CLIENT CONTROLLER
   Multi-Day Garage Management, Historical Editing & Billing
========================================================= */

const STORAGE_KEYS = {
  records: "patelAutoGarageData",
  expenses: "patelAutoGarageExpenses",
  owner: "patelAutoGarageOwner",
  loginSession: "patelAutoGarageLoginSession",
  loginLock: "patelAutoGarageLoginLock",
  theme: "patelAutoGarageTheme",
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
let filterScope = "date"; // 'date' | 'all'

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
}

function ownerAccountExists() {
  const owner = readJSON(STORAGE_KEYS.owner, null);
  return Boolean(owner && owner.username && owner.passwordHash);
}

function getOwnerAccount() {
  const owner = readJSON(STORAGE_KEYS.owner, null);
  if (!owner || !owner.username || !owner.passwordHash) return null;
  return owner;
}

function getStoredSession() {
  return (
    readStorageJSON(sessionStorage, STORAGE_KEYS.loginSession, null) ||
    readStorageJSON(localStorage, STORAGE_KEYS.loginSession, null)
  );
}

function isSessionActive() {
  if (!isAuthenticated || !verifiedSessionToken) return false;
  if (!ownerAccountExists()) return false;

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
  const isSetup = !ownerAccountExists();
  const confirmInput = document.getElementById("loginPasswordConfirm");

  document.getElementById("loginSubtitle").textContent = isSetup
    ? "Create your private owner login. Only this username and password will open the garage dashboard."
    : "Sign in to open the garage dashboard";
  document.getElementById("confirmPasswordGroup").hidden = !isSetup;
  document.getElementById("rememberRow").hidden = isSetup;
  document.getElementById("loginSubmitText").textContent = isSetup
    ? "Create Login & Continue"
    : "Sign In";
  document.getElementById("loginPassword").autocomplete = isSetup
    ? "new-password"
    : "current-password";
  confirmInput.disabled = !isSetup;
  confirmInput.required = isSetup;
  document.getElementById("loginError").hidden = true;
  setLoginBusy(false);
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

  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;
  const confirmPassword = document.getElementById("loginPasswordConfirm").value;

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
    if (!ownerAccountExists()) {
      if (!/^[A-Za-z0-9._-]+$/.test(username)) {
        setLoginError("Username can only contain letters, numbers, dot, underscore and hyphen.");
        return;
      }

      if (password !== confirmPassword) {
        setLoginError("Passwords do not match.");
        return;
      }

      const passwordHash = await hashCredential(username, password);
      localStorage.setItem(
        STORAGE_KEYS.owner,
        JSON.stringify({
          username,
          passwordHash,
          createdAt: Date.now(),
        }),
      );

      await createLoginSession(username, passwordHash, false);
      document.getElementById("loginForm").reset();
      showToast("Owner login created. Dashboard is locked to your password.");
      openDashboard();
      return;
    }

    const owner = getOwnerAccount();
    const usernameOk = username.toLowerCase() === String(owner.username || "").toLowerCase();
    const passwordOk = verifyOwnerPassword(owner, username, password);

    if (!usernameOk || !passwordOk) {
      const nextAttempts = lock.attempts + 1;
      if (nextAttempts >= MAX_LOGIN_ATTEMPTS) {
        setLoginLock(0, Date.now() + LOCK_MS);
        setLoginError("Too many failed attempts. Login is locked for 1 minute.");
        return;
      }
      setLoginLock(nextAttempts, 0);
      setLoginError("Incorrect username or password.");
      document.getElementById("loginPassword").value = "";
      document.getElementById("loginPassword").focus();
      return;
    }

    clearLoginLock();
    await createLoginSession(
      owner.username,
      owner.passwordHash,
      document.getElementById("rememberMe").checked,
    );
    document.getElementById("loginForm").reset();
    showToast("Welcome back.");
    openDashboard();
  } catch (error) {
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

async function createLoginSession(username, passwordHash, remember) {
  const token = await hashText(`${AUTH_SALT}|session|${username}|${passwordHash}`);
  const payload = {
    token,
    username,
    createdAt: Date.now(),
    expiresAt: remember ? Date.now() + REMEMBER_MS : 0,
  };
  sessionStorage.setItem(STORAGE_KEYS.loginSession, JSON.stringify(payload));
  if (remember) {
    localStorage.setItem(STORAGE_KEYS.loginSession, JSON.stringify(payload));
  } else {
    localStorage.removeItem(STORAGE_KEYS.loginSession);
  }
  verifiedSessionToken = token;
  isAuthenticated = true;
}

async function restoreLoginSession() {
  const session = getStoredSession();
  const owner = getOwnerAccount();

  if (!session || !session.token || !owner) {
    clearLoginSession();
    return false;
  }

  if (session.expiresAt && Date.now() > session.expiresAt) {
    clearLoginSession();
    return false;
  }

  const expectedTokenV1 = hashText(
    `patel-auto-garage-v1|session|${owner.username}|${owner.passwordHash}`,
  );
  const expectedTokenV2 = hashText(
    `patel-auto-garage-v2|session|${owner.username}|${owner.passwordHash}`,
  );
  const usernameOk =
    String(session.username || "").toLowerCase() ===
    String(owner.username || "").toLowerCase();
  const tokenOk =
    timingSafeEqual(session.token, expectedTokenV1) ||
    timingSafeEqual(session.token, expectedTokenV2);

  if (!usernameOk || !tokenOk) {
    clearLoginSession();
    return false;
  }

  sessionStorage.setItem(STORAGE_KEYS.loginSession, JSON.stringify(session));
  verifiedSessionToken = session.token;
  isAuthenticated = true;
  return true;
}

function clearLoginSession() {
  isAuthenticated = false;
  verifiedSessionToken = "";
  sessionStorage.removeItem(STORAGE_KEYS.loginSession);
  localStorage.removeItem(STORAGE_KEYS.loginSession);
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
    "The dashboard will be locked. All historical data remains safely stored.",
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

  loadData();

  if (!dashboardReady) {
    dashboardReady = true;
    setupDOMListeners();
    startDayWatcher();
    initializeTheme();
  }

  updateWorkingDateUI();
  renderPartsTable();
  updateBalanceDue();
  updateDashboard();
  refreshRecordsView();
  renderExpensesList();
  renderDayHistory();
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
  localStorage.setItem(
    STORAGE_KEYS.owner,
    JSON.stringify({
      ...owner,
      passwordHash,
      updatedAt: Date.now(),
    }),
  );

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
    ).then((ok) => {
      if (!ok) return;
      localStorage.removeItem(STORAGE_KEYS.owner);
      sessionStorage.removeItem(STORAGE_KEYS.loginSession);
      localStorage.removeItem(STORAGE_KEYS.loginSession);
      sessionStorage.removeItem(STORAGE_KEYS.loginLock);
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
// DATA PERSISTENCE & MIGRATION
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

function saveRecords() {
  if (!requireAuth()) return;
  localStorage.setItem(STORAGE_KEYS.records, JSON.stringify(garageData));
}

function saveExpenses() {
  if (!requireAuth()) return;
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

    // Ensure valid string date
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

    // If user was on previous 'today', automatically advance active working day to new today
    if (activeDate === previousDate) {
      activeDate = currentToday;
      showToast(`🌅 Good day! New working day started (${formatPrettyDate(currentToday)}). Previous days are safely archived.`);
    } else {
      showToast(`🌅 New working day is now ${formatPrettyDate(currentToday)}. Previous records remain permanently saved.`);
    }

    updateWorkingDateUI();
    updateDashboard();
    refreshRecordsView();
    renderDayHistory();
  }
}

// =========================================
// WORKING DAY NAVIGATION
// =========================================

function setActiveDate(newDateStr) {
  if (!newDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(newDateStr)) return;
  activeDate = newDateStr;

  updateWorkingDateUI();
  updateDashboard();
  refreshRecordsView();
  renderExpensesList();
  renderDayHistory();
}

function changeActiveDateByDays(offsetDays) {
  const currentObj = parseLocalDate(activeDate);
  currentObj.setDate(currentObj.getDate() + offsetDays);
  setActiveDate(getLocalDate(currentObj));
}

function updateWorkingDateUI() {
  const today = getLocalDate();
  const isToday = activeDate === today;

  // Topbar today label
  const todayObj = new Date();
  document.getElementById("todayLabel").textContent = todayObj.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Active date picker input
  const datePicker = document.getElementById("activeDatePicker");
  if (datePicker) datePicker.value = activeDate;

  // New Job Card form date input
  const formJobDate = document.getElementById("formJobDate");
  if (formJobDate) formJobDate.value = activeDate;
  const jobDateDisplay = document.getElementById("jobDateDisplay");
  if (jobDateDisplay) jobDateDisplay.textContent = formatPrettyDate(activeDate);

  // Active Date Badge
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

  // Historical Warning Banner
  const banner = document.getElementById("historicalBanner");
  const bannerLabel = document.getElementById("historicalDateLabel");
  if (banner && bannerLabel) {
    banner.hidden = isToday;
    bannerLabel.textContent = formatPrettyDate(activeDate);
  }

  // Section labels
  const heading = document.getElementById("dashboardStatsHeading");
  if (heading) {
    heading.textContent = isToday ? "Daily Summary for Today" : `Daily Summary for ${formatPrettyDate(activeDate)}`;
  }
  const expLabel = document.getElementById("expenseDateLabel");
  if (expLabel) {
    expLabel.textContent = isToday ? "Today" : formatPrettyDate(activeDate);
  }
}

// =========================================
// CALCULATIONS & METRICS ENGINE
// =========================================

function calculateDayMetrics(dateStr) {
  const dayRecords = garageData.filter((r) => r.date === dateStr);
  const dayExpenses = garageExpenses.filter((e) => e.date === dateStr);

  const completedJobs = dayRecords.length;
  const totalBilled = roundMoney(dayRecords.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0));
  const incomeCollected = roundMoney(dayRecords.reduce((sum, r) => sum + (Number(r.paidAmount) || 0), 0));
  const pendingAmount = roundMoney(dayRecords.reduce((sum, r) => sum + (Number(r.pendingAmount) || 0), 0));
  const totalExpenses = roundMoney(dayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0));
  const netProfit = roundMoney(incomeCollected - totalExpenses);

  return {
    date: dateStr,
    completedJobs,
    totalBilled,
    incomeCollected,
    pendingAmount,
    totalExpenses,
    netProfit,
  };
}

function updateDashboard() {
  if (!requireAuth()) return;

  const metrics = calculateDayMetrics(activeDate);

  // All time pending
  const allTimePending = roundMoney(garageData.reduce((sum, r) => sum + (Number(r.pendingAmount) || 0), 0));

  // Populate Dashboard Stats Cards
  document.getElementById("statDayVehicles").textContent = metrics.completedJobs;
  document.getElementById("statDayIncome").textContent = money(metrics.incomeCollected);
  document.getElementById("statDayBilled").textContent = money(metrics.totalBilled);
  document.getElementById("statDayExpenses").textContent = money(metrics.totalExpenses);
  document.getElementById("statDayNetProfit").textContent = money(metrics.netProfit);
  document.getElementById("statDayPending").textContent = money(metrics.pendingAmount);
  document.getElementById("statAllTimePending").textContent = money(allTimePending);

  // Expense panel badge
  const expTotalBadge = document.getElementById("expenseSectionTotal");
  if (expTotalBadge) expTotalBadge.textContent = money(metrics.totalExpenses);
}

// =========================================
// SERVICE RECORDS VIEW & ACTIONS
// =========================================

function getFilteredRecords() {
  const search = document.getElementById("searchInput").value.trim().toLowerCase();
  const statusFilter = document.getElementById("statusFilter").value;

  return garageData.filter((record) => {
    // Filter by Scope
    if (filterScope === "date" && record.date !== activeDate) {
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
    if (filterScope === "date") {
      emptySub.textContent = `No vehicle service records found for ${formatPrettyDate(activeDate)}. Create a new job card above!`;
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

function saveJobCard() {
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

  garageData.unshift(record);
  saveRecords();

  // If the record was saved for a date other than activeDate, offer to view that date
  if (targetDate !== activeDate) {
    showToast(`Job card saved for ${formatPrettyDate(targetDate)}!`);
    setActiveDate(targetDate);
  } else {
    showToast("Job card saved successfully.");
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
// RECORD EDITING MODAL (FULL EDIT CAPABILITY)
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

  // Clone items
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

function saveEditedJobCard() {
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

  garageData[index] = {
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

  saveRecords();
  closeEditModal();
  updateDashboard();
  refreshRecordsView();
  renderDayHistory();
  showToast("Record updated successfully.");
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
    `This will permanently remove the service record for ${desc}. Daily calculations will update immediately.`,
  ).then((confirmed) => {
    if (!confirmed) return;

    garageData = garageData.filter((r) => String(r.id) !== String(recordId));
    saveRecords();
    updateDashboard();
    refreshRecordsView();
    renderDayHistory();
    showToast("Record deleted.");
  });
}

// =========================================
// DAILY EXPENSES MANAGEMENT
// =========================================

function addDailyExpense() {
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

  const expense = {
    id: generateId(),
    date: activeDate,
    desc,
    category,
    amount: toMoney(amount),
    createdAt: Date.now(),
  };

  garageExpenses.unshift(expense);
  saveExpenses();

  document.getElementById("expenseDesc").value = "";
  document.getElementById("expenseAmount").value = "";

  renderExpensesList();
  updateDashboard();
  renderDayHistory();
  showToast("Expense added.");
}

function deleteExpense(expenseId) {
  if (!requireAuth()) return;

  garageExpenses = garageExpenses.filter((e) => e.id !== String(expenseId));
  saveExpenses();
  renderExpensesList();
  updateDashboard();
  renderDayHistory();
  showToast("Expense removed.");
}

function renderExpensesList() {
  const tbody = document.getElementById("expensesTableBody");
  const empty = document.getElementById("emptyExpenses");
  tbody.innerHTML = "";

  const dayExpenses = garageExpenses.filter((e) => e.date === activeDate);

  if (dayExpenses.length === 0) {
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";

  dayExpenses.forEach((exp) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHTML(exp.desc)}</strong></td>
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

  // Collect all unique dates from records and expenses
  const datesSet = new Set();
  garageData.forEach((r) => datesSet.add(r.date));
  garageExpenses.forEach((e) => datesSet.add(e.date));

  // Also include today and activeDate
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
    const metrics = calculateDayMetrics(dateStr);
    const isSelected = dateStr === activeDate;
    const isToday = dateStr === getLocalDate();
    const isPending = metrics.pendingAmount > 0;

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
            ${isPending ? `Pending ${money(metrics.pendingAmount)}` : "Fully Paid"}
          </span>
        </div>

        <div class="card-metrics-grid">
          <div class="metric-item">
            <span>Vehicles</span>
            <strong>${metrics.completedJobs}</strong>
          </div>
          <div class="metric-item">
            <span>Billed</span>
            <strong>${money(metrics.totalBilled)}</strong>
          </div>
          <div class="metric-item">
            <span>Collected</span>
            <strong style="color:var(--success);">${money(metrics.incomeCollected)}</strong>
          </div>
          <div class="metric-item">
            <span>Expenses</span>
            <strong style="color:var(--purple);">${money(metrics.totalExpenses)}</strong>
          </div>
        </div>
      </div>

      <button type="button" class="btn-open-day" data-open-date="${dateStr}">
        ${isSelected ? '<i class="fa-solid fa-check"></i> Currently Viewing' : '<i class="fa-solid fa-folder-open"></i> Open Day & Manage'}
      </button>
    `;

    grid.appendChild(card);
  });

  grid.querySelectorAll("[data-open-date]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setActiveDate(btn.dataset.openDate);
      filterScope = "date";
      document.getElementById("scopeDateBtn").classList.add("active");
      document.getElementById("scopeAllBtn").classList.remove("active");
      refreshRecordsView();
      // Scroll smoothly to dashboard
      document.getElementById("dayNavigatorBar")?.scrollIntoView({ behavior: "smooth" });
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
    ? garageData.filter((r) => r.date === activeDate)
    : garageData;

  if (records.length === 0) {
    showToast("No records available to export.", "error");
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

  const filename = onlyActiveDay
    ? `Patel_Garage_${activeDate}.csv`
    : `Patel_Garage_All_History_${getLocalDate()}.csv`;

  downloadBlob(csvContent, filename, "text/csv;charset=utf-8;");
  showToast("CSV exported successfully.");
}

function downloadJSONBackup() {
  if (!requireAuth()) return;

  const backupData = {
    app: "PatelAutoGarage&Service",
    version: "2.0",
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
        `Found ${newRecords.length} service records and ${newExpenses.length} expenses. This will merge with your existing database. Continue?`,
      ).then((confirmed) => {
        if (!confirmed) return;

        // Merge records with deduplication by ID
        const recordsMap = new Map();
        garageData.forEach((r) => recordsMap.set(String(r.id), r));
        normalizeRecords(newRecords).forEach((r) => recordsMap.set(String(r.id), r));
        garageData = Array.from(recordsMap.values());

        // Merge expenses with deduplication by ID
        const expensesMap = new Map();
        garageExpenses.forEach((exp) => expensesMap.set(String(exp.id), exp));
        normalizeExpenses(newExpenses).forEach((exp) => expensesMap.set(String(exp.id), exp));
        garageExpenses = Array.from(expensesMap.values());

        saveRecords();
        saveExpenses();
        updateDashboard();
        refreshRecordsView();
        renderExpensesList();
        renderDayHistory();
        showToast("Backup restored successfully!");
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
  document.getElementById("prevDayBtn").addEventListener("click", () => changeActiveDateByDays(-1));
  document.getElementById("nextDayBtn").addEventListener("click", () => changeActiveDateByDays(1));
  document.getElementById("jumpTodayBtn").addEventListener("click", () => setActiveDate(getLocalDate()));
  document.getElementById("bannerJumpTodayBtn").addEventListener("click", () => setActiveDate(getLocalDate()));
  document.getElementById("activeDatePicker").addEventListener("change", (e) => {
    if (e.target.value) setActiveDate(e.target.value);
  });

  // Form Job Date picker
  document.getElementById("formJobDate").addEventListener("change", (e) => {
    if (e.target.value) {
      document.getElementById("jobDateDisplay").textContent = formatPrettyDate(e.target.value);
    }
  });

  // Backup & Export dropdown
  const backupMenuBtn = document.getElementById("backupMenuBtn");
  const backupDropdown = document.getElementById("backupDropdownMenu");
  backupMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    backupDropdown.hidden = !backupDropdown.hidden;
  });
  document.addEventListener("click", () => {
    if (backupDropdown) backupDropdown.hidden = true;
  });

  document.getElementById("exportDayCsvBtn").addEventListener("click", () => exportToCSV(true));
  document.getElementById("exportAllCsvBtn").addEventListener("click", () => exportToCSV(false));
  document.getElementById("downloadBackupBtn").addEventListener("click", downloadJSONBackup);
  document.getElementById("restoreBackupBtn").addEventListener("click", triggerRestoreBackup);
  document.getElementById("restoreFileInput").addEventListener("change", handleRestoreFile);

  // Theme toggle
  document.getElementById("themeToggleBtn").addEventListener("click", toggleTheme);

  // Job card item entry
  document.getElementById("addItemBtn").addEventListener("click", addPartRow);
  document.getElementById("saveJobBtn").addEventListener("click", saveJobCard);
  document.getElementById("clearFormBtn").addEventListener("click", () => clearForm(true));
  document.getElementById("amountReceived").addEventListener("input", updateBalanceDue);

  ["partName", "partQty", "partPrice"].forEach((id) => {
    document.getElementById(id).addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addPartRow();
      }
    });
  });

  // Vehicle selector
  setupVehicleSelector();

  // Payment selector
  setupPaymentOptions();

  // Input guards (numbers only)
  setupInputGuards();

  // Expenses entry
  document.getElementById("addExpenseBtn").addEventListener("click", addDailyExpense);

  // Search and filters
  document.getElementById("searchInput").addEventListener("input", refreshRecordsView);
  document.getElementById("statusFilter").addEventListener("change", refreshRecordsView);
  document.getElementById("resetFiltersBtn").addEventListener("click", resetFilters);

  // View Scope Toggle (Selected Date vs All Records)
  document.getElementById("scopeDateBtn").addEventListener("click", () => {
    filterScope = "date";
    document.getElementById("scopeDateBtn").classList.add("active");
    document.getElementById("scopeAllBtn").classList.remove("active");
    refreshRecordsView();
  });
  document.getElementById("scopeAllBtn").addEventListener("click", () => {
    filterScope = "all";
    document.getElementById("scopeAllBtn").classList.add("active");
    document.getElementById("scopeDateBtn").classList.remove("active");
    refreshRecordsView();
  });

  // Edit Modal Listeners
  document.getElementById("editModalCloseBtn").addEventListener("click", closeEditModal);
  document.getElementById("editModalCancel").addEventListener("click", closeEditModal);
  document.getElementById("editModalSave").addEventListener("click", saveEditedJobCard);
  document.getElementById("editAddItemBtn").addEventListener("click", addEditModalPart);
  document.getElementById("editAmountReceived").addEventListener("input", updateEditBalanceDue);
  document.getElementById("editPaymentStatus").addEventListener("change", updateEditBalanceDue);

  // Confirmation Modal
  document.getElementById("confirmCancel").addEventListener("click", () => closeConfirm(false));
  document.getElementById("confirmOk").addEventListener("click", () => closeConfirm(true));
  document.getElementById("confirmModal").addEventListener("click", (e) => {
    if (e.target.id === "confirmModal") closeConfirm(false);
  });

  // Global Keyboard Shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeConfirm(false);
      closePasswordModal();
      closeEditModal();
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
  document.getElementById("custPhone").addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
  });

  document.getElementById("vehicleNo").addEventListener("input", (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
  });

  document.getElementById("editCustPhone").addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
  });

  document.getElementById("editVehicleNo").addEventListener("input", (e) => {
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
  const themeIcon = themeBtn.querySelector("i");

  if (theme === "dark") {
    body.classList.add("dark-mode");
    themeText.textContent = "Light Mode";
    themeIcon.className = "fa-solid fa-sun";
  } else {
    body.classList.remove("dark-mode");
    themeText.textContent = "Dark Mode";
    themeIcon.className = "fa-solid fa-moon";
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