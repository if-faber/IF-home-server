// admin.js — Główne Zaplecze Administracyjne IF-startpage (Router i Inicjalizacja: mods/admin)

const state = {
  adminPin: null,
  activeTab: "homepage", // helper, alerts, homepage, modules, kiosk, apps, admin-theme
  theme: {},
  settings: {},

  // Admin Theme State (Uproszczony - pojedynczy motyw)
  adminTheme: {}
};

window.state = state;

const TAB_IDS = ["helper", "alerts", "live", "homepage", "modules", "kiosk", "ports", "language", "apps", "backup", "admin-theme"];

// Zakładki-moduły dostępne wyłącznie przez hub "Moduły" (tab-modules.js) —
// nie mają własnego przycisku w sidebarze, więc podświetlają przycisk "tab-modules".
const MODULE_SUBTAB_IDS = ["kiosk", "ports", "language"];

// Moduł „Tłumacz” (mods/language) — skrypt wczytywany dopiero przy otwarciu karty i tylko gdy moduł jest włączony.
const TRANSLATOR_SCRIPT = "../language/language.js?v=0.5-l3";
let translatorLoading = null;

function loadTranslatorModule() {
  if (typeof renderLanguageTab === "function") return Promise.resolve();
  if (!translatorLoading) {
    translatorLoading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = TRANSLATOR_SCRIPT;
      script.onload = resolve;
      script.onerror = () => { translatorLoading = null; reject(new Error(t("mods.language.load_failed"))); };
      document.head.appendChild(script);
    });
  }
  return translatorLoading;
}

function renderLanguageDisabled() {
  return `
    <div class="admin-tab-container">
      <a href="#" class="button module-back-link" data-modules-back>${escapeHtml(t("mods.language.back"))}</a>
      <section class="admin-section-card">
        <p class="settings-note">${escapeHtml(t("mods.language.disabled"))}</p>
        <button type="button" class="button primary" data-open-general>${uiIcon("settings", 16)} ${escapeHtml(t("mods.language.open_general"))}</button>
      </section>
    </div>`;
}

// Tab Switching Router
function switchTab(tabId) {
  // Dawna zakładka „Aktualizacje” → Aplikacje (Darek 9.11.2026).
  if (tabId === "updates") tabId = "apps";
  // Zakładki mogą uruchamiać własne odpytywanie na żywo (np. Statystyki Live);
  // sprzątamy po poprzedniej zakładce, zanim podmienimy #tabContent.
  if (typeof window.__activeTabCleanup === "function") {
    window.__activeTabCleanup();
  }
  window.__activeTabCleanup = null;

  state.activeTab = tabId;
  sessionStorage.setItem("homedash.admin.activeTab", tabId);

  const activeNavId = MODULE_SUBTAB_IDS.includes(tabId) ? "modules" : tabId;
  TAB_IDS.forEach((id) => {
    const btn = document.querySelector(`#tab-${id}`);
    if (btn) btn.classList.toggle("active", id === activeNavId);
  });

  const content = document.querySelector("#tabContent");
  const title = document.querySelector("#tabTitle");
  // Tytuł zakładki z ikoną Lucide — ta sama, co przy przycisku w menu.
  const setTabTitle = (icon, text) => {
    title.innerHTML = `${typeof uiIcon === "function" ? uiIcon(icon, 24) : ""}<span>${escapeHtml(text)}</span>`;
  };

  if (tabId === "helper") {
    setTabTitle("settings", t("admin.sidebar.title_general"));
    content.innerHTML = renderHelperTab();
    bindHelperEvents();
  } else if (tabId === "alerts") {
    setTabTitle("alerts", t("admin.sidebar.title_alerts"));
    content.innerHTML = renderAlertsTab();
    bindAlertsEvents();
  } else if (tabId === "live") {
    setTabTitle("status", t("admin.sidebar.title_live"));
    content.innerHTML = renderLiveTab();
    bindLiveEvents();
  } else if (tabId === "homepage") {
    setTabTitle("page", t("admin.sidebar.title_homepage"));
    content.innerHTML = renderHomepageTab();
    bindHomepageEvents();
  } else if (tabId === "modules") {
    setTabTitle("modules", t("admin.sidebar.title_modules"));
    content.innerHTML = renderModulesHubTab();
    bindModulesHubEvents();
  } else if (tabId === "kiosk") {
    setTabTitle("modules", t("admin.sidebar.title_kiosk"));
    content.innerHTML = renderKioskTab();
    bindKioskEvents();
  } else if (tabId === "ports") {
    setTabTitle("modules", t("admin.sidebar.title_ports"));
    content.innerHTML = renderPortsTab();
    bindPortsEvents();
  } else if (tabId === "language") {
    setTabTitle("languages", t("admin.sidebar.title_language"));
    if (!state.settings?.translatorEnabled) {
      content.innerHTML = renderLanguageDisabled();
      if (typeof bindModulesBackLink === "function") bindModulesBackLink();
      content.querySelector("[data-open-general]")?.addEventListener("click", () => switchTab("helper"));
    } else if (typeof renderLanguageTab === "function") {
      content.innerHTML = renderLanguageTab();
      bindLanguageEvents();
    } else {
      content.innerHTML = `<div class="admin-tab-container"><div class="empty">${escapeHtml(t("mods.language.loading"))}</div></div>`;
      loadTranslatorModule()
        .then(() => { if (state.activeTab === "language") switchTab("language"); })
        .catch((error) => showToast(error.message));
    }
  } else if (tabId === "apps") {
    setTabTitle("package", t("admin.sidebar.title_apps"));
    content.innerHTML = renderAppsTab();
    bindAppsEvents();
  } else if (tabId === "backup") {
    setTabTitle("save", t("admin.sidebar.title_backup"));
    content.innerHTML = renderBackupTab();
    bindBackupEvents();
  } else if (tabId === "admin-theme") {
    setTabTitle("appearance", t("admin.sidebar.title_admin_theme"));
    content.innerHTML = renderAdminThemeTab();
    bindAdminThemeEvents();
  }
}

// ─── ☰ Chowanie menu Zaplecza (jak na stronie głównej) ───────────────────────
// Komputer: wybór zapamiętany. Telefon / wąski ekran: menu startuje schowane, ☰ je otwiera,
// a wybranie karty chowa je z powrotem (Darek 11.11.2026: „na telefonie nic nie widać”).
const NARROW_SCREEN = "(max-width: 900px)";

function isNarrowScreen() {
  return window.matchMedia(NARROW_SCREEN).matches;
}

function setAdminSidebarHidden(hidden) {
  document.querySelector("#adminDashboard")?.classList.toggle("sidebar-hidden", hidden);
  if (!isNarrowScreen()) {
    try { localStorage.setItem("ifs.adminSidebarHidden", hidden ? "1" : "0"); } catch {}
  }
}

function bindAdminMenuToggle() {
  const button = document.querySelector("#adminMenuToggle");
  if (!button) return;
  if (typeof uiIcon === "function") button.innerHTML = uiIcon("menu", 22);
  let saved = false;
  try { saved = localStorage.getItem("ifs.adminSidebarHidden") === "1"; } catch {}
  setAdminSidebarHidden(isNarrowScreen() || saved);
  button.addEventListener("click", () => {
    const dashboard = document.querySelector("#adminDashboard");
    setAdminSidebarHidden(!dashboard.classList.contains("sidebar-hidden"));
  });
}

// Ikony Lucide w menu Zaplecza (atrybut data-icon przy przycisku).
function renderNavIcons() {
  if (typeof uiIcon !== "function") return;
  document.querySelectorAll(".admin-sidebar [data-icon]").forEach((el) => {
    if (el.querySelector(".ui-icon")) return;
    el.insertAdjacentHTML("afterbegin", uiIcon(el.dataset.icon, 18));
  });
}

// Wersja IF-startpage pod nazwą „Zaplecze” (numer obrazu; obraz lokalny = „tester”).
function loadAppVersion() {
  request("/api/app/version").then((data) => {
    const el = document.querySelector("#adminAppVersion");
    if (!el || !data?.version) return;
    el.textContent = data.local ? `· ${t("admin.sidebar.version_tester")} (${data.version})` : `· ${data.version}`;
    el.title = data.local ? t("admin.sidebar.version_tester_tip") : t("admin.sidebar.version_tip");
  }).catch(() => {});
}

function init() {
  renderNavIcons();
  loadAppVersion();
  if (typeof bindAdminModeToggle === "function") bindAdminModeToggle();
  // Okienko PIN — to samo co na stronie głównej. Zamknięcie bez odblokowania (Anuluj, ×, Esc) = powrót na stronę.
  document.querySelector("#adminApp").insertAdjacentHTML("beforeend", pinDialogHtml());
  const pinDialog = document.querySelector("#pinDialog");
  pinDialog.addEventListener("close", () => {
    if (!getStoredAdminPin()) window.location.href = "../../";
  });
  document.querySelector("#pinForm")?.addEventListener("submit", unlockAdmin);

  TAB_IDS.forEach((id) => {
    document.querySelector(`#tab-${id}`)?.addEventListener("click", () => {
      switchTab(id);
      // Na telefonie po wybraniu karty menu się chowa, żeby było widać treść.
      if (isNarrowScreen()) setAdminSidebarHidden(true);
    });
  });
  bindAdminMenuToggle();

  // Globalna obsługa zamykania modali
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.closest("dialog")?.close();
    });
  });

  document.querySelectorAll("dialog").forEach((dialog) => {
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close();
    });
  });

  // Obsługa bezpośredniego przejścia z URL np. ?tab=alerts lub #alerts
  const urlParams = new URLSearchParams(window.location.search);
  const requestedTab = urlParams.get("tab") || window.location.hash.replace("#", "");
  if (requestedTab && (TAB_IDS.includes(requestedTab) || requestedTab === "updates")) {
    state.activeTab = requestedTab;
    sessionStorage.setItem("homedash.admin.activeTab", requestedTab);
  }

  // Wczytanie motywu dla spójnego wyglądu ekranu blokady i modali
  Promise.all([
    request("/api/dashboard/theme").catch(() => ({ theme: {} })),
    request("/api/admin/theme").catch(() => ({ theme: {} }))
  ]).then(([themeData, adminThemeData]) => {
    state.theme = themeData.theme || {};
    if (typeof useAdminThemes === "function") useAdminThemes(adminThemeData);
  }).catch(() => {});

  if (typeof autoUnlockIfStored === "function") {
    autoUnlockIfStored();
  }

  // Zamek czasowy (Ustawienia ogólne): po braku aktywności — wylogowanie i okienko PIN.
  initIdleLock((minutes) => {
    document.querySelector("#adminDashboard").style.display = "none";
    showPinDialog();
    showToast(t("admin.messages.idle_logged_out", { minutes }));
  });
}

window.addEventListener("DOMContentLoaded", init);
