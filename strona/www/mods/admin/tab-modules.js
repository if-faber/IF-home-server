// tab-modules.js — Zakładka "Moduły": hub z kafelkami modułów IF-startpage (mods/admin)
// Wprowadzone w v0.4.2. Każdy kafelek to nakładka na usługę self-hosted, opisana
// w Claude-Docs/WIZJA-ARCHITEKTURA-MYHOME.md. Kliknięcie kafelka otwiera pełne
// ustawienia danego modułu (istniejący routing switchTab), z przyciskiem powrotu.

// Rejestr modułów widocznych w hubie. Nowe moduły (Mój Garaż, HomeOffice, ...)
// dopisujemy tutaj dopiero gdy faktycznie powstaną w kodzie — do tego czasu
// nie pokazujemy dla nich kafelków/placeholderów (ustalone z użytkownikiem).
const MODULES_REGISTRY = [
  {
    id: "kiosk",
    icon: "monitor",
    name: "Kiosk Serwera",   // zapas; napis z admin.modules.kiosk_name / _desc
    desc: "Tablet ze statusem serwera — temperatury, dyski, alerty, żywy podgląd kontenerów (styl ctop), status kontenerów i radio internetowe."
  },
  {
    id: "language",
    icon: "languages",
    name: "Tłumacz",
    desc: "Tłumaczenie strony i Zaplecza, nowe języki, eksport i wgrywanie plików języka.",
    // Włącznik w Ustawieniach ogólnych (Darek 11.11.2026); wyłączony — kafel z dopiskiem, karta podpowiada, gdzie włączyć.
    isOff: () => !state.settings?.translatorEnabled
  },
  {
    id: "ports",
    icon: "search",
    name: "Tester portów",
    desc: "Pule portów według rodzaju aplikacji i sprawdzenie, czy port na serwerze jest wolny."
  }
];

function renderModulesHubTab() {
  const tiles = MODULES_REGISTRY.map((mod) => `
    <button type="button" class="module-tile" data-module="${escapeHtml(mod.id)}">
      <span class="module-tile-icon">${uiIcon(mod.icon, 28)}</span>
      <span class="module-tile-name">${escapeHtml(IF_I18N.has(`admin.modules.${mod.id}_name`) ? t(`admin.modules.${mod.id}_name`) : mod.name)}</span>
      <span class="module-tile-desc">${escapeHtml(IF_I18N.has(`admin.modules.${mod.id}_desc`) ? t(`admin.modules.${mod.id}_desc`) : mod.desc)}</span>
      ${mod.isOff?.() ? `<span class="backup-badge">${escapeHtml(t("admin.modules.off"))}</span>` : ""}
    </button>
  `).join("");

  return `
    <div class="admin-tab-container">
      <section class="admin-section-card">
        <h2>${uiIcon("modules", 22)} ${escapeHtml(t("admin.modules.title"))}</h2>
        <p class="settings-note">${escapeHtml(t("admin.modules.intro"))}</p>
        <div class="modules-hub-grid" style="margin-top: 18px;">
          ${tiles}
        </div>
      </section>
    </div>
  `;
}

function bindModulesHubEvents() {
  document.querySelectorAll(".module-tile").forEach((tile) => {
    tile.addEventListener("click", () => {
      const moduleId = tile.dataset.module;
      if (moduleId && typeof switchTab === "function") {
        switchTab(moduleId);
      }
    });
  });
}

// Wywoływane przez zakładki modułów (np. Kiosk) aby wrócić do huba.
function bindModulesBackLink() {
  document.querySelectorAll("[data-modules-back]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      if (typeof switchTab === "function") {
        switchTab("modules");
      }
    });
  });
}
