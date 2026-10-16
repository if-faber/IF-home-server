// admin.js — Główne Zaplecze Administracyjne IF-startpage (Router i Inicjalizacja: mods/admin)

const state = {
  adminPin: null,
  activeTab: "homepage", // helper, alerts, homepage, modules, kiosk, updates, admin-theme
  theme: {},
  settings: {},

  // Admin Theme State (Uproszczony - pojedynczy motyw)
  adminTheme: {}
};

window.state = state;

const TAB_IDS = ["helper", "alerts", "live", "homepage", "modules", "kiosk", "updates", "admin-theme"];

// Zakładki-moduły dostępne wyłącznie przez hub "Moduły" (tab-modules.js) —
// nie mają własnego przycisku w sidebarze, więc podświetlają przycisk "tab-modules".
const MODULE_SUBTAB_IDS = ["kiosk"];

// Tab Switching Router
function switchTab(tabId) {
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
    setTabTitle("settings", "Ustawienia ogólne");
    content.innerHTML = renderHelperTab();
    bindHelperEvents();
  } else if (tabId === "alerts") {
    setTabTitle("alerts", "Centrum Alertów & Diagnostyka");
    content.innerHTML = renderAlertsTab();
    bindAlertsEvents();
  } else if (tabId === "live") {
    setTabTitle("status", "Statystyki Live");
    content.innerHTML = renderLiveTab();
    bindLiveEvents();
  } else if (tabId === "homepage") {
    setTabTitle("page", "Strony i sekcje");
    content.innerHTML = renderHomepageTab();
    bindHomepageEvents();
  } else if (tabId === "modules") {
    setTabTitle("modules", "Moduły");
    content.innerHTML = renderModulesHubTab();
    bindModulesHubEvents();
  } else if (tabId === "kiosk") {
    setTabTitle("modules", "Kiosk Serwera — Ustawienia i Wygląd");
    content.innerHTML = renderKioskTab();
    bindKioskEvents();
  } else if (tabId === "updates") {
    setTabTitle("package", "Aktualizacje Systemu & Docker");
    content.innerHTML = renderUpdatesTab();
    bindUpdatesEvents();
  } else if (tabId === "admin-theme") {
    setTabTitle("appearance", "Wygląd Zaplecza");
    content.innerHTML = renderAdminThemeTab();
    bindAdminThemeEvents();
  }
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
    el.textContent = data.local ? `· tester (${data.version})` : `· ${data.version}`;
    el.title = data.local ? "Obraz lokalny (wersja robocza) — kod z folderu src/" : "Wersja IF-startpage (numer obrazu)";
  }).catch(() => {});
}

function init() {
  renderNavIcons();
  loadAppVersion();
  if (typeof bindAdminModeToggle === "function") bindAdminModeToggle();
  const pinInput = document.querySelector("#adminPinInput");
  if (pinInput) {
    pinInput.value = "";
  }

  document.querySelector("#adminPinForm")?.addEventListener("submit", unlockAdmin);

  TAB_IDS.forEach((id) => {
    document.querySelector(`#tab-${id}`)?.addEventListener("click", () => switchTab(id));
  });

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
  if (requestedTab && TAB_IDS.includes(requestedTab)) {
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
}

window.addEventListener("DOMContentLoaded", init);
