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
    name: "Kiosk Serwera",
    desc: "Tablet ze statusem serwera — temperatury, dyski, alerty, żywy podgląd kontenerów (styl ctop), status kontenerów i radio internetowe."
  }
];

function renderModulesHubTab() {
  const tiles = MODULES_REGISTRY.map((mod) => `
    <button type="button" class="module-tile" data-module="${escapeHtml(mod.id)}">
      <span class="module-tile-icon">${uiIcon(mod.icon, 28)}</span>
      <span class="module-tile-name">${escapeHtml(mod.name)}</span>
      <span class="module-tile-desc">${escapeHtml(mod.desc)}</span>
    </button>
  `).join("");

  return `
    <div class="admin-tab-container">
      <section class="admin-section-card">
        <h2>${uiIcon("modules", 22)} Moduły</h2>
        <p class="settings-note">Nakładki na usługi self-hosted, dopracowane pod kątem prostoty dla domowników. Wybierz moduł, aby zmienić jego ustawienia.</p>
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
