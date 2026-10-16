// secure.js — Logowanie i autoryzacja Zaplecza IF-startpage (mods/admin)

async function unlockAdmin(e) {
  if (e && e.preventDefault) e.preventDefault();
  const input = document.querySelector("#adminPinInput");
  const pin = String(input?.value || "").trim();
  
  if (!pin) {
    return showToast("Wpisz kod PIN administratora.");
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

    document.querySelector("#pinScreen").style.display = "none";
    document.querySelector("#adminDashboard").style.display = "grid";

    const savedTab = sessionStorage.getItem("homedash.admin.activeTab") || state.activeTab || "homepage";
    if (typeof switchTab === "function") {
      switchTab(savedTab);
    }
    showToast("Zalogowano do Zaplecza.");
  } catch (error) {
    clearStoredAdminPin();
    if (input) {
      input.value = "";
      input.focus();
    }
    showToast(error.message || "Niepoprawny PIN administratora.");
  }
}

async function autoUnlockIfStored() {
  const storedPin = getStoredAdminPin();
  if (!storedPin) return;

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

    document.querySelector("#pinScreen").style.display = "none";
    document.querySelector("#adminDashboard").style.display = "grid";

    const savedTab = sessionStorage.getItem("homedash.admin.activeTab") || state.activeTab || "homepage";
    if (typeof switchTab === "function") {
      switchTab(savedTab);
    }
  } catch {
    clearStoredAdminPin();
    const input = document.querySelector("#adminPinInput");
    if (input) input.value = "";
  }
}

function logoutAdmin() {
  clearStoredAdminPin();
  const input = document.querySelector("#adminPinInput");
  if (input) {
    input.value = "";
    input.focus();
  }
  document.querySelector("#adminDashboard").style.display = "none";
  document.querySelector("#pinScreen").style.display = "flex";
  showToast("Wylogowano z Zaplecza.");
}

window.unlockAdmin = unlockAdmin;
window.autoUnlockIfStored = autoUnlockIfStored;
window.logoutAdmin = logoutAdmin;
