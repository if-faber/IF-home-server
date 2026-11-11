// secure.js — Logowanie i autoryzacja Zaplecza IF-startpage (mods/admin)

async function unlockAdmin(e) {
  if (e && e.preventDefault) e.preventDefault();
  const input = document.querySelector("#adminPinInput");
  const pin = String(input?.value || "").trim();
  
  if (!pin) {
    return showToast(t("admin.messages.login_enter_pin"));
  }

  try {
    await request("/api/admin/unlock", {
      method: "POST",
      body: JSON.stringify({ pin })
    });

    setStoredAdminPin(pin);

    const [settingsData, themeData, adminThemeData] = await Promise.all([
      request("/api/dashboard/settings").catch(() => ({ settings: {} })),
      request("/api/dashboard/theme").catch(() => ({ theme: {} })),
      request("/api/admin/theme").catch(() => ({ theme: {} }))
    ]);

    state.settings = settingsData.settings || {};
    state.theme = themeData.theme || {};
    if (typeof useAdminThemes === "function") useAdminThemes(adminThemeData);

    hidePinDialog();
    document.querySelector("#adminDashboard").style.display = "grid";

    const savedTab = sessionStorage.getItem("homedash.admin.activeTab") || state.activeTab || "homepage";
    if (typeof switchTab === "function") {
      switchTab(savedTab);
    }
    showToast(t("admin.messages.login_ok"));
  } catch (error) {
    clearStoredAdminPin();
    if (input) {
      input.value = "";
      input.focus();
    }
    showToast(error.message || t("admin.messages.login_bad_pin"));
  }
}

// Okienko PIN Zaplecza (wspólne ze stroną): pokazanie i schowanie.
function showPinDialog() {
  const dialog = document.querySelector("#pinDialog");
  const input = document.querySelector("#adminPinInput");
  if (input) input.value = "";
  if (dialog && !dialog.open) dialog.showModal();
  input?.focus();
}

function hidePinDialog() {
  const dialog = document.querySelector("#pinDialog");
  if (dialog?.open) dialog.close();
}

async function autoUnlockIfStored() {
  const storedPin = getStoredAdminPin();
  if (!storedPin) return showPinDialog();

  try {
    await request("/api/admin/unlock", {
      method: "POST",
      body: JSON.stringify({ pin: storedPin })
    });

    setStoredAdminPin(storedPin);

    const [settingsData, themeData, adminThemeData] = await Promise.all([
      request("/api/dashboard/settings").catch(() => ({ settings: {} })),
      request("/api/dashboard/theme").catch(() => ({ theme: {} })),
      request("/api/admin/theme").catch(() => ({ theme: {} }))
    ]);

    state.settings = settingsData.settings || {};
    state.theme = themeData.theme || {};
    if (typeof useAdminThemes === "function") useAdminThemes(adminThemeData);

    hidePinDialog();
    document.querySelector("#adminDashboard").style.display = "grid";

    const savedTab = sessionStorage.getItem("homedash.admin.activeTab") || state.activeTab || "homepage";
    if (typeof switchTab === "function") {
      switchTab(savedTab);
    }
  } catch {
    clearStoredAdminPin();
    showPinDialog();
  }
}

function logoutAdmin() {
  clearStoredAdminPin();
  document.querySelector("#adminDashboard").style.display = "none";
  showPinDialog();
  showToast(t("admin.messages.logged_out"));
}

window.unlockAdmin = unlockAdmin;
window.autoUnlockIfStored = autoUnlockIfStored;
window.logoutAdmin = logoutAdmin;
