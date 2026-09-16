/* =========================================
   PATEL AUTO GARAGE
========================================= */

const STORAGE_KEYS = {
  records: "patelAutoGarageData",
  session: "patelAutoGarageDaySession",
  owner: "patelAutoGarageOwner",
  loginSession: "patelAutoGarageLoginSession",
  loginLock: "patelAutoGarageLoginLock",
};

const AUTH_SALT = "patel-auto-garage-v1";
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MS = 60 * 1000;
const REMEMBER_MS = 12 * 60 * 60 * 1000;

let currentItems = [];
let garageData = [];
let daySession = { date: "", startedAt: 0 };
let selectedVehicleType = "Bike";
let toastTimer;
let confirmResolver = null;
let dashboardReady = false;
let isAuthenticated = false;
let verifiedSessionToken = "";
let loginBusy = false;

document.addEventListener("DOMContentLoaded", initializeApp);

async function initializeApp() {
  setupAuth();
  if (await restoreLoginSession()) {
    openDashboard();
    return;
  }
  showLoginScreen(false);
}

function setupAuth() {
  document.getElementById("loginForm").addEventListener("submit", handleLoginSubmit);
  document.getElementById("togglePasswordBtn").addEventListener("click", toggleLoginPassword);
  document.getElementById("logoutBtn").addEventListener("click", logout);
  document.getElementById("changePasswordBtn").addEventListener("click", openPasswordModal);
  document.getElementById("passwordCancel").addEventListener("click", closePasswordModal);
  document.getElementById("passwordSave").addEventListener("click", saveNewPassword);
  document.getElementById("passwordModal").addEventListener("click", (event) => {
    if (event.target.id === "passwordModal") closePasswordModal();
  });
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
    ? "Create your private owner login. Only this username and password will open the dashboard."
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
      showToast("Owner login created. Dashboard is now locked to your password.");
      openDashboard();
      return;
    }

    const owner = getOwnerAccount();
    const passwordHash = await hashCredential(username, password);
    const usernameOk = username.toLowerCase() === String(owner.username || "").toLowerCase();
    const passwordOk = timingSafeEqual(passwordHash, owner.passwordHash);

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

  const expectedToken = await hashText(
    `${AUTH_SALT}|session|${owner.username}|${owner.passwordHash}`,
  );
  const usernameOk =
    String(session.username || "").toLowerCase() ===
    String(owner.username || "").toLowerCase();

  if (!usernameOk || !timingSafeEqual(session.token, expectedToken)) {
    clearLoginSession();
    return false;
  }

  sessionStorage.setItem(STORAGE_KEYS.loginSession, JSON.stringify(session));
  verifiedSessionToken = expectedToken;
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
  currentItems = [];
  selectedVehicleType = "Bike";

  const recordsBody = document.getElementById("recordsBody");
  const partsBody = document.getElementById("partsTableBody");
  const printDetails = document.getElementById("printDetails");
  const printItems = document.getElementById("printItemsBody");

  if (recordsBody) recordsBody.innerHTML = "";
  if (partsBody) partsBody.innerHTML = "";
  if (printDetails) printDetails.innerHTML = "";
  if (printItems) printItems.innerHTML = "";
}

function logout() {
  askConfirm(
    "Log out?",
    "The dashboard will lock. Records stay saved, but nobody can use the app without your password.",
  ).then((ok) => {
    if (!ok) return;
    clearLoginSession();
    wipeDashboardState();
    showLoginScreen(true);
    showToast("Logged out.");
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

  if (!dashboardReady) {
    dashboardReady = true;
    loadData();
    ensureDaySession();
    setupVehicleSelector();
    setupPaymentOptions();
    setupButtons();
    setupKeyboardShortcuts();
    setupInputGuards();
  } else {
    loadData();
  }

  renderPartsTable();
  updateBalanceDue();
  refreshRecordsView();
  updateDashboard();
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

  const currentHash = await hashCredential(owner.username, currentPassword);
  if (!timingSafeEqual(currentHash, owner.passwordHash)) {
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
  showToast("Password updated.");
}

async function hashCredential(username, password) {
  return hashText(`${AUTH_SALT}|${String(username).trim().toLowerCase()}|${password}`);
}

async function hashText(text) {
  if (window.crypto?.subtle) {
    const data = new TextEncoder().encode(text);
    const buffer = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
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

function loadData() {
  if (!requireAuth()) {
    garageData = [];
    daySession = { date: "", startedAt: 0 };
    return;
  }
  garageData = normalizeRecords(readJSON(STORAGE_KEYS.records, []));
  daySession = readJSON(STORAGE_KEYS.session, { date: "", startedAt: 0 });
}

function saveRecords() {
  if (!requireAuth()) return;
  localStorage.setItem(STORAGE_KEYS.records, JSON.stringify(garageData));
}

function saveSession() {
  if (!requireAuth()) return;
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(daySession));
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

    return {
      id: Number(record.id) || Date.now(),
      date: record.date || getLocalDate(),
      time: record.time || "",
      name: String(record.name || "").trim(),
      phone: String(record.phone || "").replace(/\D/g, "").slice(0, 10),
      vehicleType: record.vehicleType || "Other",
      vehicleNo: String(record.vehicleNo || record.bikeNo || "")
        .trim()
        .toUpperCase(),
      vehicleModel: String(record.vehicleModel || record.bikeModel || "").trim(),
      items,
      totalAmount,
      paidAmount,
      pendingAmount,
      paymentStatus: pendingAmount > 0 ? (isPending ? "Pending" : status) : status,
    };
  });
}

function ensureDaySession() {
  const today = getLocalDate();

  if (daySession.date !== today || !daySession.startedAt) {
    daySession = {
      date: today,
      startedAt: startOfLocalDay().getTime(),
    };
    saveSession();
  }

  updateTodayLabel();
}

function startNewDay() {
  if (!requireAuth()) return;
  askConfirm(
    "Start a new day?",
    "Today's dashboard counters will reset to zero. All saved job cards stay in history unless you delete them.",
  ).then((ok) => {
    if (!ok) return;

    daySession = {
      date: getLocalDate(),
      startedAt: Date.now(),
    };
    saveSession();
    updateTodayLabel();
    updateDashboard();
    showToast("New day started. Previous records are still saved.");
  });
}

function setupButtons() {
  document.getElementById("addItemBtn").addEventListener("click", addPartRow);
  document.getElementById("saveJobBtn").addEventListener("click", saveJobCard);
  document.getElementById("clearFormBtn").addEventListener("click", () => clearForm(true));
  document.getElementById("exportBtn").addEventListener("click", exportToCSV);
  document.getElementById("newDayBtn").addEventListener("click", startNewDay);
  document.getElementById("searchInput").addEventListener("input", refreshRecordsView);
  document.getElementById("periodFilter").addEventListener("change", onPeriodChange);
  document.getElementById("dateFilter").addEventListener("change", onDateChange);
  document.getElementById("resetFiltersBtn").addEventListener("click", resetFilters);
  document.getElementById("amountReceived").addEventListener("input", updateBalanceDue);

  ["partName", "partQty", "partPrice"].forEach((id) => {
    document.getElementById(id).addEventListener("keydown", handleItemEnter);
  });

  document.getElementById("confirmCancel").addEventListener("click", () => closeConfirm(false));
  document.getElementById("confirmOk").addEventListener("click", () => closeConfirm(true));
  document.getElementById("confirmModal").addEventListener("click", (event) => {
    if (event.target.id === "confirmModal") closeConfirm(false);
  });
}

function setupInputGuards() {
  document.getElementById("custPhone").addEventListener("input", (event) => {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 10);
  });

  document.getElementById("vehicleNo").addEventListener("input", (event) => {
    event.target.value = event.target.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 15);
  });
}

function handleItemEnter(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    if (!requireAuth()) return;
    addPartRow();
  }
}

function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeConfirm(false);
      closePasswordModal();
      return;
    }

    if (!isSessionActive()) return;

    if (event.ctrlKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
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

  if (!Number.isFinite(price) || price <= 0) {
    showToast("Please enter a valid unit price greater than 0.", "error");
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
  const name = document.getElementById("custName").value.trim();
  const phone = document.getElementById("custPhone").value.trim();
  const vehicleNo = document.getElementById("vehicleNo").value.trim().toUpperCase();
  const vehicleModel = document.getElementById("vehicleModel").value.trim();
  const paymentStatus = getPaymentStatus();

  if (!name) {
    showToast("Please enter customer name.", "error");
    document.getElementById("custName").focus();
    return;
  }

  if (name.length < 2) {
    showToast("Customer name must be at least 2 characters.", "error");
    document.getElementById("custName").focus();
    return;
  }

  const cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.length !== 10) {
    showToast("Please enter a valid 10-digit mobile number.", "error");
    document.getElementById("custPhone").focus();
    return;
  }

  if (!vehicleNo) {
    showToast("Please enter vehicle number.", "error");
    document.getElementById("vehicleNo").focus();
    return;
  }

  if (vehicleNo.length < 4) {
    showToast("Please enter a valid vehicle number.", "error");
    document.getElementById("vehicleNo").focus();
    return;
  }

  if (currentItems.length === 0) {
    showToast("Please add at least one service or part.", "error");
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
    id: Date.now(),
    date: getLocalDate(),
    time: now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    name,
    phone: cleanPhone,
    vehicleType: selectedVehicleType,
    vehicleNo,
    vehicleModel,
    items: currentItems.map((item) => ({ ...item })),
    totalAmount,
    paidAmount,
    pendingAmount,
    paymentStatus: pendingAmount > 0 ? "Pending" : paymentStatus,
  };

  garageData.unshift(record);
  saveRecords();
  refreshRecordsView();
  updateDashboard();
  clearForm(false);
  showToast("Job card saved successfully.");
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

  currentItems = [];
  selectedVehicleType = "Bike";
  document.getElementById("vehicleType").value = "Bike";

  document.querySelectorAll(".vehicle-option").forEach((button) => {
    button.classList.toggle("active", button.dataset.vehicle === "Bike");
  });

  const cashRadio = document.querySelector(
    "input[name='paymentStatus'][value='Paid (Cash)']",
  );
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

function isInCurrentDaySession(record) {
  return (
    record.date === getLocalDate() &&
    Number(record.id) >= Number(daySession.startedAt || 0)
  );
}

function updateDashboard() {
  ensureDaySession();

  let todayVehicles = 0;
  let todayIncome = 0;
  let todayBilled = 0;
  let pendingAmount = 0;

  garageData.forEach((record) => {
    pendingAmount += Number(record.pendingAmount) || 0;

    if (isInCurrentDaySession(record)) {
      todayVehicles += 1;
      todayIncome += Number(record.paidAmount) || 0;
      todayBilled += Number(record.totalAmount) || 0;
    }
  });

  document.getElementById("statTodayVehicles").textContent = todayVehicles;
  document.getElementById("statTodayIncome").textContent = money(todayIncome);
  document.getElementById("statTodayBilled").textContent = money(todayBilled);
  document.getElementById("statPendingAmount").textContent = money(pendingAmount);
  document.getElementById("recordCount").textContent = garageData.length;
}

function updateTodayLabel() {
  const today = new Date();
  document.getElementById("todayLabel").textContent = today.toLocaleDateString(
    "en-IN",
    {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );
}

function onPeriodChange() {
  if (document.getElementById("periodFilter").value !== "all") {
    document.getElementById("dateFilter").value = "";
  }
  refreshRecordsView();
}

function onDateChange() {
  if (document.getElementById("dateFilter").value) {
    document.getElementById("periodFilter").value = "all";
  }
  refreshRecordsView();
}

function resetFilters() {
  document.getElementById("searchInput").value = "";
  document.getElementById("periodFilter").value = "all";
  document.getElementById("dateFilter").value = "";
  refreshRecordsView();
}

function getFilteredRecords() {
  const search = document.getElementById("searchInput").value.trim().toLowerCase();
  const period = document.getElementById("periodFilter").value;
  const selectedDate = document.getElementById("dateFilter").value;
  const today = getLocalDate();
  const currentMonth = getLocalMonth();

  return garageData.filter((record) => {
    const haystack = [
      record.name,
      record.phone,
      record.vehicleNo,
      record.vehicleModel,
      record.vehicleType,
      record.paymentStatus,
    ]
      .join(" ")
      .toLowerCase();

    if (search && !haystack.includes(search)) return false;
    if (period === "today") return record.date === today;
    if (period === "month") return String(record.date).startsWith(currentMonth);
    if (selectedDate) return record.date === selectedDate;
    return true;
  });
}

function refreshRecordsView() {
  if (!requireAuth()) return;
  renderRecords(getFilteredRecords());
  updateDashboard();
}

function renderRecords(data) {
  const tbody = document.getElementById("recordsBody");
  const empty = document.getElementById("emptyRecords");
  tbody.innerHTML = "";

  updateFilterSummary(data);

  if (data.length === 0) {
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";

  data.forEach((record) => {
    const partsSummary = record.items
      .map((item) => `${item.name} × ${item.qty}`)
      .join(", ");
    const statusClass = (record.pendingAmount || 0) > 0 ? "pending" : "paid";
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>
        <strong>${formatDate(record.date)}</strong>
        <br>
        <small>${escapeHTML(record.time || "")}</small>
      </td>
      <td>
        <div class="vehicle-cell">
          <strong>${getVehicleIcon(record.vehicleType)} ${escapeHTML(record.vehicleNo)}</strong>
          <span>${escapeHTML(record.vehicleType || "Vehicle")}</span>
          <br>
          <small>${escapeHTML(record.vehicleModel || "Model not added")}</small>
        </div>
      </td>
      <td>
        <div class="customer-cell">
          <strong>${escapeHTML(record.name)}</strong>
          <span>${escapeHTML(record.phone)}</span>
        </div>
      </td>
      <td>
        <div class="service-summary" title="${escapeHTML(partsSummary)}">
          ${escapeHTML(partsSummary)}
        </div>
      </td>
      <td class="amount-cell">
        ${money(record.totalAmount)}
        <small>Paid ${money(record.paidAmount)}</small>
      </td>
      <td>
        <span class="status ${statusClass}">
          <i class="fa-solid ${(record.pendingAmount || 0) > 0 ? "fa-clock" : "fa-circle-check"}"></i>
          ${escapeHTML(record.paymentStatus)}
        </span>
      </td>
      <td>
        <div class="action-buttons">
          <button type="button" class="action-btn action-whatsapp" title="Send WhatsApp bill" data-action="whatsapp" data-id="${record.id}">
            <i class="fa-brands fa-whatsapp"></i>
          </button>
          <button type="button" class="action-btn action-print" title="Print invoice" data-action="print" data-id="${record.id}">
            <i class="fa-solid fa-print"></i>
          </button>
          <button type="button" class="action-btn action-delete" title="Delete record" data-action="delete" data-id="${record.id}">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(row);
  });

  setupRecordActions();
}

function setupRecordActions() {
  document.querySelectorAll("[data-action='whatsapp']").forEach((button) => {
    button.addEventListener("click", () => sendWhatsApp(Number(button.dataset.id)));
  });

  document.querySelectorAll("[data-action='print']").forEach((button) => {
    button.addEventListener("click", () => printInvoice(Number(button.dataset.id)));
  });

  document.querySelectorAll("[data-action='delete']").forEach((button) => {
    button.addEventListener("click", () => deleteRecord(Number(button.dataset.id)));
  });
}

function deleteRecord(id) {
  if (!requireAuth()) return;
  const record = garageData.find((item) => item.id === id);
  if (!record) {
    showToast("Record not found.", "error");
    return;
  }

  askConfirm(
    "Delete this record?",
    `This will permanently remove the job card for ${record.name} (${record.vehicleNo}).`,
  ).then((ok) => {
    if (!ok) return;

    garageData = garageData.filter((item) => item.id !== id);
    saveRecords();
    refreshRecordsView();
    showToast("Record deleted.");
  });
}

function sendWhatsApp(id) {
  if (!requireAuth()) return;
  const record = garageData.find((item) => item.id === id);
  if (!record) {
    showToast("Record not found.", "error");
    return;
  }

  if (!record.phone) {
    showToast("Customer mobile number is missing.", "error");
    return;
  }

  const itemText = record.items
    .map((item) => `• ${item.name} × ${item.qty} - ${money(item.total)}`)
    .join("\n");

  const message = `*PATEL AUTO GARAGE*
━━━━━━━━━━━━━━━━━━

Hello ${record.name},

Here is your vehicle service bill.

Vehicle: ${record.vehicleNo}
Type: ${record.vehicleType}
Model: ${record.vehicleModel || "N/A"}
Date: ${formatDate(record.date)}

*Services / Parts*
${itemText}

━━━━━━━━━━━━━━━━━━
*Total Bill: ${money(record.totalAmount)}*
Amount Received: ${money(record.paidAmount)}
Balance Due: ${money(record.pendingAmount)}
Payment: ${record.paymentStatus}

Thank you for choosing Patel Auto Garage.
Please visit again.`;

  const phone = record.phone.startsWith("91") ? record.phone : `91${record.phone}`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
}

function printInvoice(id) {
  if (!requireAuth()) return;
  const record = garageData.find((item) => item.id === id);
  if (!record) {
    showToast("Record not found.", "error");
    return;
  }

  document.getElementById("printDetails").innerHTML = `
    <div><strong>Customer</strong><br>${escapeHTML(record.name)}</div>
    <div><strong>Mobile</strong><br>${escapeHTML(record.phone)}</div>
    <div><strong>Vehicle</strong><br>${escapeHTML(record.vehicleNo)}</div>
    <div><strong>Type / Model</strong><br>${escapeHTML(record.vehicleType)} / ${escapeHTML(record.vehicleModel || "N/A")}</div>
    <div><strong>Date</strong><br>${formatDate(record.date)} ${escapeHTML(record.time || "")}</div>
    <div><strong>Payment</strong><br>${escapeHTML(record.paymentStatus)}</div>
  `;

  const tbody = document.getElementById("printItemsBody");
  tbody.innerHTML = "";

  record.items.forEach((item) => {
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

function exportToCSV() {
  if (!requireAuth()) return;
  if (garageData.length === 0) {
    showToast("No records available for export.", "error");
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
    "Mobile",
    "Total Amount",
    "Amount Received",
    "Balance Due",
    "Payment Status",
    "Services / Parts",
  ];

  const rows = garageData.map((record) => {
    const items = record.items
      .map((item) => `${item.name} (${item.qty} x ${item.price})`)
      .join(" | ");

    return [
      record.id,
      record.date,
      record.time || "",
      record.vehicleType,
      record.vehicleNo,
      record.vehicleModel || "",
      record.name,
      record.phone,
      record.totalAmount,
      record.paidAmount,
      record.pendingAmount,
      record.paymentStatus,
      items,
    ];
  });

  let csv = headers.map(csvEscape).join(",") + "\n";
  rows.forEach((row) => {
    csv += row.map(csvEscape).join(",") + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Patel_Auto_Garage_${getLocalDate()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast("Accounting data exported successfully.");
}

function updateFilterSummary(data) {
  const summary = document.getElementById("filterSummary");
  const billed = data.reduce((sum, record) => sum + (Number(record.totalAmount) || 0), 0);
  const collected = data.reduce((sum, record) => sum + (Number(record.paidAmount) || 0), 0);
  const pending = data.reduce((sum, record) => sum + (Number(record.pendingAmount) || 0), 0);

  summary.innerHTML = `
    <span>Showing <strong>${data.length}</strong> record${data.length !== 1 ? "s" : ""}</span>
    <span>Billed: <strong>${money(billed)}</strong></span>
    <span>Collected: <strong>${money(collected)}</strong></span>
    <span>Pending: <strong>${money(pending)}</strong></span>
  `;
}

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
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return number;
}

function formatDate(dateString) {
  if (!dateString) return "N/A";
  const parts = String(dateString).split("-");
  if (parts.length !== 3) return dateString;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
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

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
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
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

function getLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLocalMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function startOfLocalDay() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}