const dashboard = document.documentElement.dataset.dashboard;
const dashboardConfig = {
  apiUrl: window.location.origin,
  title: "Serwer domowy",
  subtitle: "Usługi, narzędzia i administracja serwera",
  logo: "./images/logo.png",
  defaultHost: window.location.hostname || "localhost"
};
const state = {
  data: null,
  theme: {},
  activeSectionId: null,
  activePageId: (() => { try { return localStorage.getItem("ifs.page") || "home"; } catch { return "home"; } })(),
  view: "links",
  query: "",
  systemStatsTimer: null,
  editingLink: null,
  adminPin: null,
  pendingAdminPanel: null,
  alertsData: null,
  sidebarHidden: localStorage.getItem("homedash.nas.sidebarHidden") === "true"
};

function getStoredAdminPin() {
  try {
    return localStorage.getItem("myhome.admin.pin") 
      || sessionStorage.getItem("homedash.admin.pin") 
      || state.adminPin 
      || "";
  } catch {
    return state.adminPin || "";
  }
}

function setStoredAdminPin(pin) {
  const clean = String(pin || "").trim();
  try {
    if (clean) {
      localStorage.setItem("myhome.admin.pin", clean);
      sessionStorage.setItem("homedash.admin.pin", clean);
    } else {
      clearStoredAdminPin();
    }
  } catch {}
  state.adminPin = clean || null;
}

function clearStoredAdminPin() {
  try {
    localStorage.removeItem("myhome.admin.pin");
    sessionStorage.removeItem("homedash.admin.pin");
  } catch {}
  state.adminPin = null;
}

const fontOptions = [
  ["system", "Systemowa"],
  ["Inter", "Inter"],
  ["Poppins", "Poppins"],
  ["Montserrat", "Montserrat"],
  ["Nunito", "Nunito"],
  ["Lato", "Lato"],
  ["Roboto", "Roboto"],
  ["Source Sans 3", "Source Sans 3"]
];

function renderFontOptions() {
  return fontOptions.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
}

function fontStack(value) {
  if (!value || value === "system") return "ui-sans-serif, system-ui, sans-serif";
  return `"${value}", ui-sans-serif, system-ui, sans-serif`;
}

function fontValueFromStack(value) {
  const normalized = String(value || "").replaceAll('"', "").trim();
  const match = fontOptions.find(([font]) => font !== "system" && normalized.startsWith(font));
  return match?.[0] || "system";
}

const PORT_HINTS = {
  system: { label: "System & Sieć", range: "2000-2099", typicalPorts: [2022, 2080, 2443], description: "Usługi bazowe i sieciowe" },
  dashboard: { label: "Dashboard & Aplikacje", range: "3000-3099", typicalPorts: [3000, 3010, 3100], description: "Gitea Web, IF-startpage, Homebox" },
  media: { label: "Media & Galeria", range: "4000-4099", typicalPorts: [4000, 4080, 2283], description: "Immich, strumieniowanie, odtwarzacze" },
  administracja: { label: "Administracja & Narzędzia", range: "5000-5099", typicalPorts: [5000, 5001, 5090], description: "Gitea Registry, Dockge, Cockpit" },
  monitoring: { label: "Monitoring & ESP", range: "6000-6099", typicalPorts: [6052, 6090, 6100], description: "ESPHome, telemetria, sensory" },
  ha_iot: { label: "Smart Home & IoT", range: "7000-7099", typicalPorts: [7000, 7123, 8123], description: "Home Assistant, MQTT, automatyzacje" },
  ai_testy: { label: "Dokumentacja & Usługi", range: "8000-8099", typicalPorts: [8000, 8010, 8080, 8085, 8090], description: "DokuWiki, Paperless, Memos, Stirling" }
};

function brandIcon() {
  return `<img src="${dashboardConfig.logo}" alt="" loading="eager">`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function request(url, options = {}) {
  let targetUrl = url;
  if (targetUrl.startsWith("http://") || targetUrl.startsWith("https://")) {
    try {
      const parsed = new URL(targetUrl);
      if (parsed.hostname === window.location.hostname || parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" || parsed.port === "3010") {
        targetUrl = parsed.pathname + parsed.search;
      }
    } catch {}
  }
  const adminPin = getStoredAdminPin();
  const headers = {
    "content-type": "application/json",
    ...(adminPin ? { "x-admin-pin": adminPin } : {}),
    ...(options.headers || {})
  };
  const response = await fetch(targetUrl, {
    ...options,
    headers
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!response.ok) throw new Error(data.message || data.error || `HTTP ${response.status}`);
  return data;
}

async function reloadData() {
  const response = await request(`${dashboardConfig.apiUrl}/api/services`);
  state.data = {
    title: dashboardConfig.title,
    subtitle: dashboardConfig.subtitle,
    pages: (response.pages && response.pages.length ? response.pages : [{ id: "home", name: "Home" }]).map((page) => ({
      id: page.id,
      name: page.name,
      icon: page.icon || ""
    })),
    sections: (response.sections || []).map((section) => ({
      id: section.id,
      name: section.name,
      icon: section.icon || "",
      pageId: section.pageId || "home",
      links: (section.groups || []).flatMap((group) => group.items || []).map((item) => ({
        sectionId: section.id,
        id: item.id,
        name: item.name,
        url: item.url,
        description: item.description || "",
        icon: item.icon || "",
        openMode: item.kind === "iframe" ? "iframe" : "new-tab"
      }))
    }))
  };
  if (!state.data.pages.some((page) => page.id === state.activePageId)) {
    state.activePageId = "home";
  }
  const pageSections = sectionsOfPage(state.activePageId);
  if (!pageSections.some((item) => item.id === state.activeSectionId)) {
    state.activeSectionId = pageSections[0]?.id || null;
  }
}

function appShell() {
  document.querySelector("#app").innerHTML = `
    <div class="shell${state.sidebarHidden ? " sidebar-hidden" : ""}" id="shell">
      <button class="menu-toggle" id="menuToggle" type="button" aria-label="Pokaż lub ukryj menu" title="Pokaż lub ukryj menu">${uiIcon("menu", 22)}</button>
      <aside class="sidebar">
        <div class="brand">
          <div><strong>${escapeHtml(state.data.title)}</strong></div>
        </div>
        <nav id="navigation"></nav>
        <div class="sidebar-actions">
          <div class="sidebar-menu" id="sidebarMenu" role="menu" hidden>
            <button type="button" role="menuitem" data-menu-action="appearance">${uiIcon("appearance", 18)} Wygląd (na żywo)</button>
            <a href="./mods/admin/" role="menuitem">${uiIcon("admin", 18)} Zaplecze</a>
            <div class="sidebar-menu-sep" role="separator"></div>
            <button type="button" role="menuitem" data-menu-action="lock" id="sidebarMenuLock">${uiIcon("lock", 18)} <span>Zablokuj edycję</span></button>
          </div>
          <div class="sidebar-tools">
            <button type="button" class="sidebar-icon-btn" id="sidebarIconMode" title="Tryb dzień / noc" aria-label="Przełącz tryb dzień / noc">${modeToggleIcon()}</button>
            <button type="button" class="sidebar-icon-btn" id="sidebarMenuButton" title="Ustawienia" aria-label="Ustawienia" aria-haspopup="menu" aria-expanded="false">${uiIcon("settings", 20)}</button>
          </div>
          <div class="sidebar-footer">created by <strong>Idea Forge</strong></div>
        </div>
      </aside>
      <main class="main">
        <header class="toolbar">
          <div class="page-title">
            <div class="system-title">
              <span class="system-logo">${brandIcon()}</span>
              <div><strong>${escapeHtml(state.data.title)}</strong><p>${escapeHtml(state.data.subtitle)}</p></div>
            </div>
            <h1 id="viewTitle"></h1>
          </div>
          <div class="header-stats" id="systemStatsWidget" aria-label="Statystyki systemu">
            <div class="header-stat is-loading"><span>CPU</span><strong>--</strong></div>
            <div class="header-stat is-loading"><span>RAM</span><strong>--</strong></div>
          </div>
          <div class="toolbar-actions" id="toolbarActions"></div>
          <button type="button" class="sidebar-icon-btn header-bell" id="sidebarIconAlerts" title="Powiadomienia i alerty" aria-label="Powiadomienia i alerty">${uiIcon("alerts", 20)}<span class="sidebar-alert-badge" id="sidebarAlertBadge" style="display:none;">0</span></button>
        </header>
        <div id="headerAlert" class="header-alert-box" style="display: none;"></div>
        <section id="content"></section>
      </main>
    </div>
    <dialog id="linkDialog" class="wide-dialog">
      <form id="linkForm" class="modal-panel">
        <header class="modal-heading">
          <div><span class="eyebrow">Zarządzanie</span><h2 id="linkDialogTitle">Nowy link</h2></div>
          <button type="button" data-close aria-label="Zamknij">×</button>
        </header>
        <div class="settings-grid">
          <label>Sekcja<select id="linkSection"></select></label>
          <label>Nazwa<input id="linkName" required></label>
          <label style="grid-column: 1 / -1;">URL<input id="linkUrl" type="url" required placeholder="https://..."></label>
          <label style="grid-column: 1 / -1;">Opis<input id="linkDescription"></label>
          <label>Ikona<input id="linkIcon" placeholder="Plik z folderu icons (immich.png), ikona Lucide (printer), litera albo URL"></label>
          <label>Otwieranie<select id="linkOpenMode"><option value="new-tab">Nowa karta</option><option value="iframe">W dashboardzie</option></select></label>
        </div>
        <menu><button type="button" data-close>Anuluj</button><button class="primary">Zapisz link</button></menu>
      </form>
    </dialog>
    <dialog id="pinDialog">
      <form id="pinForm" class="modal-panel">
        <header class="modal-heading">
          <div><span class="eyebrow">Autoryzacja</span><h2>Dostęp do Zaplecza</h2></div>
          <button type="button" data-close aria-label="Zamknij">×</button>
        </header>
        <label>Kod PIN<input id="adminPinInput" type="password" inputmode="numeric" autocomplete="current-password" required placeholder="Podaj PIN"></label>
        <menu><button type="button" data-close>Anuluj</button><button class="primary">Odblokuj</button></menu>
      </form>
    </dialog>
    <dialog id="settingsDialog" class="wide-dialog">
      <form id="settingsForm" class="modal-panel">
        <header class="modal-heading">
          <div><span class="eyebrow">Zaplecze</span><h2>Ustawienia strony</h2></div>
          <button type="button" data-close aria-label="Zamknij">×</button>
        </header>
        <div class="settings-grid">
          <label>Nazwa<input id="settingTitle" required></label>
          <label>Opis<input id="settingSubtitle" required></label>
          <label>Adres helpera<input id="settingApiUrl" required></label>
          <label>Domyślny host<input id="settingDefaultHost" required></label>
          <label>Nowy PIN backendu<input id="settingNewPin" type="password" inputmode="numeric" placeholder="Puste = bez zmiany"></label>
          <label>Upload logo<input id="settingLogo" type="file" accept="image/png,image/jpeg,image/webp"></label>
        </div>
        <p class="settings-note">Statystyki systemu pobierane są lokalnie z helpera.</p>
        <menu><button type="button" data-close>Anuluj</button><button class="primary">Zapisz ustawienia</button></menu>
      </form>
    </dialog>
    <dialog id="appearanceDialog" class="wide-dialog preview-dialog">
      <form id="appearanceForm" class="modal-panel">
        <header class="modal-heading">
          <div><span class="eyebrow">Zaplecze</span><h2>Wygląd i Style CSS</h2></div>
          <button type="button" data-close aria-label="Zamknij">×</button>
        </header>
        <div class="appearance-mode-bar">
          <label>Edytujesz wygląd dla trybu
            <select id="themeEditMode">
              <option value="d">Dzień (custom-d.css)</option>
              <option value="n">Noc (custom-n.css)</option>
            </select>
          </label>
          <p>Zmiany widać od razu. „Zapisz wygląd” zapisuje plik wybranego trybu. „Anuluj” odrzuca niezapisane zmiany.</p>
        </div>
        <div class="appearance-sections">
          <!-- 1. Ogólne i tło -->
          <section class="appearance-section">
            <div class="appearance-section-title">${uiIcon("appearance", 16)} Ogólne i Tło</div>
            <div class="appearance-section-grid">
              <label>Akcent<input id="themeAccent" type="color"></label>
              <label><span class="field-title">Kolor nagłówków (Akcent 2) ${infoTip("Nagłówki na kafelkach i w okienkach: tytuły okien, tytuły kart (np. na stronach Status i Narzędzia). Napisy leżące wprost na tle strony mają własne kontrolki w części „Nagłówek i napisy na tle”.")}</span><input id="themeAccentAlt" type="color"></label>
              <label>Tło strony<input id="themeBg" type="color"></label>
              <label>Kolor motywu<input id="themeSurfaceColor" type="color"></label>
              <label>Kolor tekstu<input id="themeTextColor" type="color"></label>
              <label>Kolor tekstu pomocniczego<input id="themeMutedColor" type="color"></label>
              <label>Tekst na przyciskach w kolorze akcentu<input id="themeOnAccentColor" type="color"></label>
              <label><span class="field-title">Kolor tekstu w polach ${infoTip("Tekst wpisywany w polach formularzy i listach wyboru (np. nazwa linku, adres, wyszukiwarka). Podpowiedź w pustym polu ma jaśniejszą wersję tego koloru.")}</span><input id="themeInputTextColor" type="color"></label>
              <label>Obraz tła<select id="themeBackgroundImage"><option value="">Wyłączony</option><option value="default">./images/background.jpg</option><option value="custom">Własny obraz</option></select></label>
              <label>Upload tła<input id="themeBackgroundUpload" type="file" accept="image/png,image/jpeg,image/webp"></label>
              <label>Przyciemnienie tła<input id="themeBackgroundDim" type="range" min="0" max="85" step="1"><span></span></label>
              <label>Blur obrazu<input id="themeBackgroundBlur" type="range" min="0" max="40" step="1"><span></span></label>
              <label>Widoczność obrazu<input id="themeBackgroundOpacity" type="range" min="0" max="100" step="1"><span></span></label>
            </div>
          </section>

          <!-- 2. Header / Nagłówek -->
          <section class="appearance-section">
            <div class="appearance-section-title">${uiIcon("tag", 16)} Nagłówek i napisy na tle ${infoTip("Napisy, które leżą wprost na tle strony (obraz lub kolor tła), a nie na kafelku. Każdy ma własny kolor, bo tło i kafelki mogą być bardzo różne.")}</div>
            <div class="appearance-section-grid">
              <label>Kolor nazwy serwisu<input id="themeTitleColor" type="color"></label>
              <label>Wielkość nazwy serwisu<input id="themeTitleSize" type="range" min="16" max="52" step="1"><span></span></label>
              <label>Cień nazwy serwisu<input id="themeTitleShadowBlur" type="range" min="0" max="30" step="1"><span></span></label>
              <label>Kolor sloganu<input id="themeSubtitleColor" type="color"></label>
              <label>Wielkość sloganu<input id="themeSubtitleSize" type="range" min="11" max="28" step="1"><span></span></label>
              <label>Cień sloganu<input id="themeSubtitleShadowBlur" type="range" min="0" max="30" step="1"><span></span></label>
              <label>Rozmiar logo (do 260px)<input id="themeLogoSize" type="range" min="32" max="260" step="2"><span></span></label>
              <label><span class="field-title">Kolor tytułu strony ${infoTip("Duży napis nad treścią, np. „Narzędzia”, „Top (procesy)”.")}</span><input id="themePageTitleColor" type="color"></label>
              <label>Wielkość tytułu strony<input id="themePageTitleSize" type="range" min="16" max="52" step="1"><span></span></label>
              <label>Cień tytułu strony<input id="themePageTitleShadowBlur" type="range" min="0" max="30" step="1"><span></span></label>
              <label><span class="field-title">Kolor tytułów sekcji ${infoTip("Napisy nad grupami kafelków na stronach, np. ADMINISTRACJA SERWERA.")}</span><input id="themeSectionTitleColor" type="color"></label>
              <label>Wielkość tytułów sekcji<input id="themeSectionTitleSize" type="range" min="10" max="28" step="1"><span></span></label>
              <label>Cień tytułów sekcji<input id="themeSectionTitleShadowBlur" type="range" min="0" max="30" step="1"><span></span></label>
            </div>
          </section>

          <!-- 3. Sidebar / Pasek boczny -->
          <section class="appearance-section">
            <div class="appearance-section-title">${uiIcon("tabs", 16)} Pasek boczny (Sidebar)</div>
            <div class="appearance-section-grid">
              <label>Kolor tła menu<input id="themeSidebarPanelColor" type="color"></label>
              <label>Glass / Krycie menu<input id="themeSidebarPanelAlpha" type="range" min="0" max="95" step="1"><span></span></label>
              <label>Szerokość menu<input id="themeSidebarWidth" type="range" min="240" max="360" step="5"><span></span></label>
              <label><span class="field-title">Kolor ikon menu ${infoTip("Ikony pozycji w menu, przycisk ☰ i ikony w stopce menu (☀️/🌙, ⚙️). Aktywna pozycja i najechanie mają własne kolory.")}</span><input id="themeSidebarToggleColor" type="color"></label>
              <label><span class="field-title">Wielkość ikon menu ${infoTip("Wielkość ikon pozycji w menu.")}</span><input id="themeSidebarToggleSize" type="range" min="16" max="44" step="1"><span></span></label>
              <label>Czcionka menu<select id="themeFontMenu">${renderFontOptions()}</select></label>
              <label><span class="field-title">Glass paska z nazwą ${infoTip("Przezroczyste tło pod każdą pozycją menu. 0% = bez tła. Najechanie i aktywna pozycja mają to samo szkło, tylko w swoim kolorze.")}</span><input id="themeLolliGlass" type="range" min="0" max="95" step="1"><span></span></label>
              <label><span class="field-title">Blur paska z nazwą ${infoTip("Rozmycie tego, co jest pod pozycją menu (efekt szkła). Działa razem z „Glass paska z nazwą”.")}</span><input id="themeLolliBlur" type="range" min="0" max="30" step="1"><span></span></label>
              <label><span class="field-title">Menu: kolor napisów ${infoTip("Nazwy pozycji w menu (Home, strony, Status…).")}</span><input id="themeLolliTextColor" type="color"></label>
              <label><span class="field-title">Menu: ikona po najechaniu ${infoTip("Kolor ikony pozycji menu, gdy najedziesz na nią myszą. Pozycja dostaje też delikatne tło w tym kolorze.")}</span><input id="themeLolliHoverColor" type="color"></label>
              <label><span class="field-title">Aktywna pozycja: tło ${infoTip("Zaokrąglone, półprzezroczyste tło pozycji strony, na której jesteś.")}</span><input id="themeLolliActiveBg" type="color"></label>
              <label><span class="field-title">Aktywna pozycja: ikona ${infoTip("Kolor ikony pozycji strony, na której jesteś.")}</span><input id="themeLolliActiveIcon" type="color"></label>
            </div>
          </section>

          <!-- 4. Kafelki i Strona -->
          <section class="appearance-section">
            <div class="appearance-section-title">${uiIcon("page", 16)} Kafelki i Zawartość Strony</div>
            <div class="appearance-section-grid">
              <label>Kolor kafelków linków<input id="themePanelColor" type="color"></label>
              <label>Glass kafelków linków<input id="themePanelAlpha" type="range" min="5" max="85" step="1"><span></span></label>
              <label>Wysokość kafelków<input id="themeTileHeight" type="range" min="108" max="180" step="2"><span></span></label>
              <label>Kolor kart statusu/admin<input id="themeAdminPanelColor" type="color"></label>
              <label>Krycie kart statusu/admin<input id="themeAdminPanelAlpha" type="range" min="5" max="90" step="1"><span></span></label>
              <label>Obramowanie kart<input id="themeBorderAlpha" type="range" min="0" max="35" step="1"><span></span></label>
              <label>Zaokrąglenie kart<input id="themeCardRadius" type="range" min="8" max="34" step="1"><span></span></label>
              <label>Odstęp kart<input id="themeCardGap" type="range" min="8" max="28" step="1"><span></span></label>
              <label>Blur glass<input id="themeGlassBlur" type="range" min="0" max="60" step="1"><span></span></label>
              <label>Saturacja glass<input id="themeGlassSaturation" type="range" min="60" max="260" step="1"><span></span></label>
              <label>Czcionka kafelków<select id="themeFontCard">${renderFontOptions()}</select></label>
              <label>Czcionka opisów<select id="themeFontDescription">${renderFontOptions()}</select></label>
            </div>
          </section>

          <!-- 5. Okna modalne (Modale) -->
          <section class="appearance-section">
            <div class="appearance-section-title">${uiIcon("window", 16)} Okna Modalne (Modale)</div>
            <div class="appearance-section-grid">
              <label>Kolor modali<input id="themeModalBg" type="color"></label>
              <label>Krycie modali<input id="themeModalAlpha" type="range" min="10" max="100" step="1"><span></span></label>
              <label>Blur modali<input id="themeModalGlassBlur" type="range" min="0" max="60" step="1"><span></span></label>
              <label>Zaokrąglenie modali<input id="themeModalRadius" type="range" min="8" max="36" step="1"><span></span></label>
              <label>Przyciemnienie tła modali<input id="themeModalBackdropAlpha" type="range" min="0" max="95" step="1"><span></span></label>
              <label>Blur przyciemnienia tła<input id="themeModalBackdropBlur" type="range" min="0" max="25" step="1"><span></span></label>
            </div>
          </section>
        </div>
        <menu><button id="resetAppearance" type="button">Wygląd startowy trybu</button><button type="button" data-close>Anuluj</button><button class="primary">Zapisz wygląd</button></menu>
      </form>
    </dialog>
    <dialog id="alertsQuickModal" class="wide-dialog">
      <div class="modal-panel">
        <header class="modal-heading">
          <div><span class="eyebrow">Diagnostyka</span><h2>${uiIcon("alerts", 22)} Szybki Podgląd Alertów</h2></div>
          <button type="button" data-close aria-label="Zamknij">×</button>
        </header>
        <div id="quickAlertsContent" style="display: grid; gap: 10px; max-height: 50vh; overflow-y: auto; padding-right: 4px;">
          <div class="empty">Pobieranie stanu alertów...</div>
        </div>
        <menu>
          <button type="button" data-close>Zamknij</button>
          <button type="button" id="btnQuickRefresh" class="button">${uiIcon("refresh", 16)} Odśwież</button>
          <a href="./mods/admin/?tab=alerts" class="button primary" style="display: inline-flex; align-items: center; text-decoration: none;">Centrum Alertów & Narzędzia →</a>
        </menu>
      </div>
    </dialog>
    <dialog id="helperDialog" class="wide-dialog">
      <div class="modal-panel">
        <header class="modal-heading">
          <div><span class="eyebrow">Pomoc</span><h2>Helper i komendy</h2></div>
          <button type="button" data-close aria-label="Zamknij">×</button>
        </header>
        <div class="command-list">
          <article><strong>Status helpera</strong><code>sudo systemctl status www-helper.service</code></article>
          <article><strong>Restart helpera</strong><code>sudo systemctl restart www-helper.service</code></article>
          <article><strong>Logi helpera</strong><code>sudo journalctl -u www-helper.service -n 50 --no-pager</code></article>
          <article><strong>Status strony nginx</strong><code>docker ps --filter name=homepage</code></article>
          <article><strong>Restart strony nginx</strong><code>docker restart homepage</code></article>
          <article><strong>Pliki strony</strong><code>ls -l /home/darek/www/index.html /home/darek/www/app.js /home/darek/www/styles.css</code></article>
          <article><strong>Uprawnienia strony</strong><code>chmod 644 /home/darek/www/index.html /home/darek/www/app.js /home/darek/www/styles.css</code></article>
          <article><strong>Port helpera</strong><code>sudo ss -lptn 'sport = :3010'</code></article>
        </div>
      </div>
    </dialog>
    <dialog id="sectionAddDialog">
      <div class="modal-panel">
        <header class="modal-heading">
          <div><span class="eyebrow">Strona: <span id="sectionAddPage"></span></span><h2>Dodaj sekcję</h2></div>
          <button type="button" data-close aria-label="Zamknij">×</button>
        </header>
        <form id="sectionAddForm" class="inline-form">
          <label>Nazwa sekcji<input id="sectionAddName" required maxlength="60" placeholder="np. Usługi serwera"></label>
          <button class="primary" type="submit">Dodaj</button>
        </form>
      </div>
    </dialog>
    <div class="toast" id="toast"></div>
  `;
  bindShell();
  render();
}

function bindShell() {
  document.querySelector("#menuToggle")?.addEventListener("click", toggleSidebar);
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => button.closest("dialog")?.close()));
  document.querySelector("#pinForm")?.addEventListener("submit", unlockAdminPanel);
  document.querySelector("#settingsForm")?.addEventListener("submit", saveDashboardSettings);
  document.querySelector("#appearanceForm")?.addEventListener("submit", saveThemeSettings);
  const onAppearanceEdit = (event) => {
    if (!event.target || event.target.id === "themeEditMode" || event.target.id === "themeBackgroundUpload") return;
    if (event.target.matches("input[type=range]")) updateRangeValue(event.target);
    state.appearanceDirty = true;
    previewTheme();
  };
  document.querySelector("#appearanceForm")?.addEventListener("input", onAppearanceEdit);
  document.querySelector("#appearanceForm")?.addEventListener("change", onAppearanceEdit);
  document.querySelector("#themeBackgroundUpload")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      state.pendingBackground = await readFileAsDataUrl(file);
      const bgSelect = document.querySelector("#themeBackgroundImage");
      if (bgSelect) bgSelect.value = "custom";
      state.appearanceDirty = true;
      previewTheme();
    } catch (err) {
      showToast("Nie udało się odczytać pliku tła.");
    }
  });
  document.querySelector("#themeEditMode")?.addEventListener("change", async (event) => {
    const mode = event.target.value;
    if (state.appearanceDirty && !(await ifConfirm("Masz niezapisane zmiany. Przełączyć tryb i je odrzucić?", { okLabel: "Przełącz", danger: true }))) {
      event.target.value = currentMode();
      return;
    }
    discardThemePreview();
    setMode(mode);
    openAppearancePanel();
  });
  document.querySelector("#appearanceDialog")?.addEventListener("close", () => {
    // Zamknięcie bez zapisu = powrót do tego, co jest w plikach custom-d/n.css.
    discardThemePreview();
  });
  document.querySelector("#sidebarIconMode")?.addEventListener("click", () => {
    setMode(currentMode() === "n" ? "d" : "n");
  });
  document.querySelector("#resetAppearance")?.addEventListener("click", resetThemeSettings);
  document.querySelector("#sectionAddForm")?.addEventListener("submit", saveQuickSection);
  document.querySelector("#linkForm")?.addEventListener("submit", saveLink);
  document.querySelector("#sidebarIconAlerts")?.addEventListener("click", openQuickAlertsModal);
  document.querySelector("#btnQuickRefresh")?.addEventListener("click", renderQuickAlertsContent);
  document.querySelector("#systemStatsWidget")?.addEventListener("click", () => {
    // Bez modala: kliknięcie widżetu przenosi na Status Serwera i rozwija
    // panel „Szczegółowa Diagnostyka (Top)”.
    state.view = "top";
    render();
  });
  // Menu ⚙️ na dole paska bocznego (otwiera się w górę).
  const menu = document.querySelector("#sidebarMenu");
  const menuButton = document.querySelector("#sidebarMenuButton");
  const closeMenu = () => {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    menuButton?.setAttribute("aria-expanded", "false");
  };
  menuButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    const opening = menu.hidden;
    menu.hidden = !opening;
    menuButton.setAttribute("aria-expanded", String(opening));
    const lock = document.querySelector("#sidebarMenuLock");
    if (lock) lock.innerHTML = getStoredAdminPin() ? `${uiIcon("lock", 18)} <span>Zablokuj edycję</span>` : `${uiIcon("unlock", 18)} <span>Odblokuj edycję</span>`;
  });
  document.addEventListener("click", (event) => {
    if (menu && !menu.hidden && !menu.contains(event.target)) closeMenu();
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMenu(); });
  menu?.addEventListener("click", (event) => {
    const action = event.target.closest("[data-menu-action]")?.dataset.menuAction;
    if (!action) return;
    closeMenu();
    if (action === "appearance") {
      if (getStoredAdminPin()) openAppearancePanel(); else requestAdminPin("appearance");
    } else if (action === "lock") {
      if (getStoredAdminPin()) {
        clearStoredAdminPin();
        showToast("Edycja zablokowana.");
        if (state.view === "admin") {
          state.view = "links";
          render();
        }
      } else {
        requestAdminPin(null);
      }
    }
  });
  document.addEventListener("visibilitychange", syncSystemStatsPolling);
  window.addEventListener("storage", (e) => {
    if (e.key === "homedash_services_updated") {
      reloadData().then(() => render());
    }
  });
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const syncChannel = new BroadcastChannel("homedash_sync");
      syncChannel.onmessage = (event) => {
        if (event.data?.type === "services_updated") {
          reloadData().then(() => render());
        }
      };
    }
  } catch {}
}

function toggleSidebar() {
  state.sidebarHidden = !state.sidebarHidden;
  document.querySelector("#shell").classList.toggle("sidebar-hidden", state.sidebarHidden);
  localStorage.setItem("homedash.nas.sidebarHidden", String(state.sidebarHidden));
}

function render() {
  renderNavigation();
  if (state.view === "admin" || state.view === "status") renderServerStatus();
  else if (state.view === "top") renderTopPage();
  else if (state.view === "tools") renderToolsPage();
  else if (state.view === "alerts") renderAlertsPage();
  else renderLinks();
  syncSystemStatsPolling();
}

// Stałe strony serwera — pod kreską w menu.
const SERVER_VIEWS = [
  { view: "status", label: "Status serwera", icon: "status" },
  { view: "top", label: "Top (procesy)", icon: "top" },
  { view: "tools", label: "Narzędzia", icon: "tools" },
  { view: "alerts", label: "Alerty", icon: "alerts" }
];

function sectionsOfPage(pageId) {
  return (state.data?.sections || []).filter((section) => section.pageId === pageId);
}

function activePage() {
  return state.data.pages.find((page) => page.id === state.activePageId) || state.data.pages[0];
}

function setActivePage(pageId) {
  state.activePageId = pageId;
  try { localStorage.setItem("ifs.page", pageId); } catch {}
  state.activeSectionId = sectionsOfPage(pageId)[0]?.id || null;
  state.view = "links";
  state.query = "";
  render();
}

// Przycisk „lizak”: okrągła główka z ikoną + patyczek z nazwą (jak w Kiosku).
function lollipopButton({ icon, label, active, badge = "" }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "lolli";
  button.dataset.active = String(Boolean(active));
  button.innerHTML = `<span class="lolli-head">${uiIcon(icon, 18)}</span><span class="lolli-stem"><span>${escapeHtml(label)}</span>${badge ? `<small>${escapeHtml(badge)}</small>` : ""}</span>`;
  return button;
}

function renderNavigation() {
  const nav = document.querySelector("#navigation");
  nav.innerHTML = "";

  state.data.pages.forEach((page) => {
    const count = sectionsOfPage(page.id).reduce((sum, section) => sum + section.links.length, 0);
    const button = lollipopButton({
      icon: page.icon || (page.id === "home" ? "house" : "page"),
      label: page.name,
      active: state.view === "links" && page.id === state.activePageId,
      badge: count ? String(count) : ""
    });
    button.addEventListener("click", () => setActivePage(page.id));
    nav.appendChild(button);
  });

  const separator = document.createElement("div");
  separator.className = "nav-separator";
  nav.appendChild(separator);

  SERVER_VIEWS.forEach((item) => {
    const button = lollipopButton({ icon: item.icon, label: item.label, active: state.view === item.view });
    button.addEventListener("click", () => {
      state.view = item.view;
      render();
    });
    nav.appendChild(button);
  });
}

// Menu ⚙️ na dole strony: szybkie dodawanie sekcji i linków, „Zarządzanie”
// prowadzi do Zaplecza → Homepage od razu na bieżącej stronie.
function bindContentMenu() {
  const menu = document.querySelector("#contentMenu");
  const button = document.querySelector("#contentMenuButton");
  if (!menu || !button) return;
  const close = () => {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", onOutside);
    document.removeEventListener("keydown", onKey);
  };
  const onOutside = (event) => { if (!menu.contains(event.target) && event.target !== button) close(); };
  const onKey = (event) => { if (event.key === "Escape") close(); };
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!menu.hidden) return close();
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    document.addEventListener("click", onOutside);
    document.addEventListener("keydown", onKey);
  });
  menu.addEventListener("click", (event) => {
    const action = event.target.closest("[data-content-action]")?.dataset.contentAction;
    if (!action) return;
    close();
    if (action === "link") withAdminPin(() => openLinkDialog());
    else if (action === "section") withAdminPin(openSectionAddDialog);
    else if (action === "manage") {
      try { localStorage.setItem("ifs.adminPage", state.activePageId); } catch {}
    }
  });
}

function openSectionAddDialog() {
  const dialog = document.querySelector("#sectionAddDialog");
  dialog.querySelector("#sectionAddPage").textContent = activePage().name;
  dialog.querySelector("form").reset();
  dialog.showModal();
  dialog.querySelector("#sectionAddName").focus();
}

async function saveQuickSection(event) {
  event.preventDefault();
  const name = document.querySelector("#sectionAddName").value.trim();
  if (!name) return showToast("Podaj nazwę sekcji.");
  try {
    await request(`${dashboardConfig.apiUrl}/api/services/section`, {
      method: "POST",
      body: JSON.stringify({ name, pageId: state.activePageId })
    });
    document.querySelector("#sectionAddDialog").close();
    await reloadData();
    render();
    showToast(`Dodano sekcję „${name}”.`);
  } catch (error) {
    showToast(error.message);
  }
}

function activeSection() {
  return state.data.sections.find((item) => item.id === state.activeSectionId);
}

function renderLinks() {
  stopStatusTopDiagnostics();
  const page = activePage();
  const sections = sectionsOfPage(page.id);
  document.querySelector("#viewTitle").textContent = page.name;
  document.querySelector("#toolbarActions").innerHTML = `
    <input id="search" type="search" value="${escapeHtml(state.query)}" placeholder="Szukaj linku...">
  `;
  document.querySelector("#content").innerHTML = `
    <div class="page-sections" id="pageSections"></div>
    <div class="content-actions">
      <div class="content-menu-wrap">
        <div class="sidebar-menu content-menu" id="contentMenu" role="menu" hidden>
          ${sections.length ? `<button type="button" role="menuitem" data-content-action="link">${uiIcon("plus", 18)} Dodaj link</button>` : ""}
          <button type="button" role="menuitem" data-content-action="section">${uiIcon("plus", 18)} Dodaj sekcję</button>
          <div class="sidebar-menu-sep" role="separator"></div>
          <a href="./mods/admin/?tab=homepage" role="menuitem" data-content-action="manage">${uiIcon("admin", 18)} Zarządzanie</a>
        </div>
        <button type="button" class="sidebar-icon-btn content-menu-btn" id="contentMenuButton" title="Sekcje i linki" aria-label="Sekcje i linki" aria-haspopup="menu" aria-expanded="false">${uiIcon("settings", 22)}</button>
      </div>
    </div>
  `;
  document.querySelector("#search").addEventListener("input", (event) => {
    state.query = event.target.value;
    renderLinkCards();
  });
  bindContentMenu();
  renderLinkCards();
}

function linkIconHtml(link) {
  if (/^https?:\/\//i.test(link.icon)) return `<img src="${escapeHtml(link.icon)}" alt="">`;
  if (/\.(svg|png|jpe?g|webp|gif|ico)$/i.test(link.icon)) return `<img src="./icons/${escapeHtml(link.icon.replace(/^[/\\]+/, ""))}" alt="">`;
  // Nazwa ikony z Lucide (lucide.dev/icons), np. „printer” — w kolorze kafelka.
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/i.test(link.icon || "") && link.icon.length > 1) return uiIcon(link.icon.toLowerCase(), 26);
  return escapeHtml(link.icon || link.name.slice(0, 1).toUpperCase());
}

function buildLinkCard(link) {
  const card = document.createElement("article");
  card.className = "link-card";
  card.innerHTML = `
    <button class="link-main" type="button">
      <span class="link-icon">${linkIconHtml(link)}</span>
      <span class="link-copy"><strong>${escapeHtml(link.name)}</strong><span>${escapeHtml(link.description || link.url)}</span></span>
      <span class="open-mark">${uiIcon("external", 14)}</span>
    </button>
    <div class="card-actions"><button data-edit type="button" aria-label="Edytuj link" title="Edytuj">${uiIcon("edit", 15)}</button><button data-delete type="button" aria-label="Usuń link" title="Usuń">${uiIcon("trash", 15)}</button></div>
  `;
  card.querySelector(".link-main").addEventListener("click", () => openLink(link));
  card.querySelector("[data-edit]").addEventListener("click", () => withAdminPin(() => openLinkDialog(link)));
  card.querySelector("[data-delete]").addEventListener("click", () => withAdminPin(() => deleteLink(link)));
  card.querySelector(".link-icon img")?.addEventListener("error", (event) => {
    event.currentTarget.replaceWith(document.createTextNode(link.name.slice(0, 1).toUpperCase()));
  });
  return card;
}

function renderLinkCards() {
  const target = document.querySelector("#pageSections");
  if (!target) return;
  const sections = sectionsOfPage(state.activePageId);
  if (!sections.length) {
    target.innerHTML = '<div class="empty"><p style="margin:0">Na tej stronie nie ma jeszcze kafelków.<br>Kliknij <strong>+ Dodaj sekcję</strong> na dole, a potem dodaj w niej pierwsze linki.</p></div>';
    return;
  }
  const query = state.query.trim().toLowerCase();
  target.innerHTML = "";
  let shown = 0;
  sections.forEach((section) => {
    const links = section.links.filter((link) => `${link.name} ${link.url} ${link.description}`.toLowerCase().includes(query));
    if (query && !links.length) return;
    const block = document.createElement("section");
    block.className = "page-section";
    block.innerHTML = `<h2 class="page-section-title">${section.icon ? uiIcon(section.icon, 16) : ""}${escapeHtml(section.name)}</h2><div class="link-grid"></div>`;
    const grid = block.querySelector(".link-grid");
    links.forEach((link) => grid.appendChild(buildLinkCard(link)));
    if (!links.length) grid.innerHTML = '<div class="empty empty-small">Pusta sekcja — dodaj link przyciskiem na dole.</div>';
    shown += links.length;
    target.appendChild(block);
  });
  if (query && !shown) target.innerHTML = '<div class="empty">Nic nie znaleziono.</div>';
}

function openLink(link) {
  if (link.openMode === "iframe") {
    state.view = "iframe";
    document.querySelector("#content").innerHTML = `
      <div class="frame-panel">
        <div>
          <strong>${escapeHtml(link.name)}</strong>
          <button id="closeFrame" type="button">Zamknij</button>
          <a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">Otwórz w karcie ${uiIcon("external", 14)}</a>
        </div>
        <iframe src="${escapeHtml(link.url)}" title="${escapeHtml(link.name)}"></iframe>
      </div>
    `;
    document.querySelector("#closeFrame").addEventListener("click", () => {
      state.view = "links";
      render();
    });
    return;
  }
  window.open(link.url, "_blank", "noreferrer");
}

function openLinkDialog(link = null) {
  state.editingLink = link;
  const dialog = document.querySelector("#linkDialog");
  const sectionSelect = document.querySelector("#linkSection");
  const pageSections = sectionsOfPage(state.activePageId);
  sectionSelect.innerHTML = pageSections.map((section) => `<option value="${section.id}">${escapeHtml(section.name)}</option>`).join("");
  sectionSelect.value = link?.sectionId || state.activeSectionId || pageSections[0]?.id || "";
  document.querySelector("#linkDialogTitle").textContent = link ? "Edytuj link" : "Nowy link";
  document.querySelector("#linkName").value = link?.name || "";
  document.querySelector("#linkUrl").value = link?.url || "";
  document.querySelector("#linkDescription").value = link?.description || "";
  document.querySelector("#linkIcon").value = link?.icon || "";
  document.querySelector("#linkOpenMode").value = link?.openMode || "new-tab";
  dialog.showModal();
}

async function saveLink(event) {
  event.preventDefault();
  const sectionId = document.querySelector("#linkSection").value;
  const payload = {
    sectionId,
    name: document.querySelector("#linkName").value.trim(),
    url: document.querySelector("#linkUrl").value.trim(),
    description: document.querySelector("#linkDescription").value.trim(),
    icon: document.querySelector("#linkIcon").value.trim(),
    openMode: document.querySelector("#linkOpenMode").value
  };
  const isEditing = Boolean(state.editingLink);
  const endpoint = isEditing
    ? `${dashboardConfig.apiUrl}/api/services/link/${state.editingLink.id}`
    : `${dashboardConfig.apiUrl}/api/services/link`;
  try {
    await request(endpoint, {
      method: isEditing ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    document.querySelector("#linkDialog").close();
    await reloadData();
    state.activeSectionId = sectionId;
    render();
    showToast(isEditing ? "Link zaktualizowany." : "Link dodany.");
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteLink(link) {
  if (!(await ifConfirm(`Usunąć link „${link.name}”?`, { okLabel: "Usuń", danger: true }))) return;
  try {
    await request(`${dashboardConfig.apiUrl}/api/services/link/${link.id}`, { method: "DELETE" });
    await reloadData();
    render();
    showToast("Link usunięty.");
  } catch (error) {
    showToast(error.message);
  }
}

// Uruchamia akcję od razu, jeśli edycja jest odblokowana; inaczej najpierw pyta o PIN.
function withAdminPin(action) {
  if (getStoredAdminPin()) {
    action();
    return;
  }
  state.pendingAction = action;
  requestAdminPin("action");
}

function requestAdminPin(panel) {
  state.pendingAdminPanel = panel;
  document.querySelector("#adminPinInput").value = "";
  document.querySelector("#pinDialog").showModal();
}

async function unlockAdminPanel(event) {
  event.preventDefault();
  const pin = document.querySelector("#adminPinInput").value.trim();
  try {
    await request(`${dashboardConfig.apiUrl}/api/admin/unlock`, {
      method: "POST",
      body: JSON.stringify({ pin })
    });
    setStoredAdminPin(pin);
    document.querySelector("#pinDialog").close();
    showToast("Edycja odblokowana.");
    if (state.pendingAdminPanel === "settings") openSettingsPanel();
    else if (state.pendingAdminPanel === "appearance") openAppearancePanel();
    else if (state.pendingAdminPanel === "action" && typeof state.pendingAction === "function") {
      const action = state.pendingAction;
      state.pendingAction = null;
      action();
    }
    else if (state.pendingAdminPanel === "admin-view") {
      state.view = "admin";
      render();
    }
  } catch (error) {
    showToast("Błędny kod PIN.");
  }
}

function openSettingsPanel() {
  document.querySelector("#settingTitle").value = dashboardConfig.title;
  document.querySelector("#settingSubtitle").value = dashboardConfig.subtitle;
  document.querySelector("#settingApiUrl").value = dashboardConfig.apiUrl;
  document.querySelector("#settingDefaultHost").value = dashboardConfig.defaultHost;
  document.querySelector("#settingNewPin").value = "";
  document.querySelector("#settingLogo").value = "";
  document.querySelector("#settingsDialog").showModal();
}

async function saveDashboardSettings(event) {
  event.preventDefault();
  const logoFile = document.querySelector("#settingLogo").files[0];
  const logoData = logoFile ? await readFileAsDataUrl(logoFile) : null;
  const payload = {
    title: document.querySelector("#settingTitle").value.trim(),
    subtitle: document.querySelector("#settingSubtitle").value.trim(),
    apiUrl: document.querySelector("#settingApiUrl").value.trim(),
    defaultHost: document.querySelector("#settingDefaultHost").value.trim(),
    newPin: document.querySelector("#settingNewPin").value.trim(),
    logoData
  };
  try {
    const data = await request(`${dashboardConfig.apiUrl}/api/dashboard/settings`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    applyDashboardSettings(data.settings);
    document.querySelector("#settingsDialog").close();
    // Po zmianie PIN-u wylogowanie — przy następnej edycji strona zapyta o nowy PIN.
    if (payload.newPin) {
      clearStoredAdminPin();
      showToast("PIN zmieniony. Przy następnej edycji wpisz nowy PIN.");
      return;
    }
    showToast("Ustawienia zapisane.");
  } catch (error) {
    showToast(error.message);
  }
}

async function loadDashboardSettings() {
  try {
    const data = await request(`${dashboardConfig.apiUrl}/api/dashboard/settings`);
    applyDashboardSettings(data.settings);
  } catch {}
}

function applyDashboardSettings(settings) {
  if (!settings) return;
  if (settings.title) dashboardConfig.title = settings.title;
  if (settings.subtitle) dashboardConfig.subtitle = settings.subtitle;
  if (settings.apiUrl) dashboardConfig.apiUrl = settings.apiUrl;
  if (settings.defaultHost) dashboardConfig.defaultHost = settings.defaultHost;
  if (settings.logo) dashboardConfig.logo = settings.logo;
  if (state.data) {
    state.data.title = dashboardConfig.title;
    state.data.subtitle = dashboardConfig.subtitle;
  }
}

function openAppearancePanel() {
  const backgroundCss = cssValue("--background-image");
  const backgroundImageValue = backgroundCss.includes("background-custom") ? "custom" : backgroundCss.includes("background.jpg") ? "default" : "";
  state.appearanceDirty = false;
  state.pendingBackground = null;
  const bgMatch = backgroundCss.match(/url\(["']?([^"')]+)["']?\)/);
  state.currentBackgroundUrl = bgMatch && !bgMatch[1].startsWith("data:") ? bgMatch[1] : "";
  const modeSelect = document.querySelector("#themeEditMode");
  if (modeSelect) modeSelect.value = currentMode();
  const uploadInput = document.querySelector("#themeBackgroundUpload");
  if (uploadInput) uploadInput.value = "";
  const fields = {
    themeTextColor: rgbToHex(cssValue("--text")),
    themeMutedColor: rgbToHex(cssValue("--muted")),
    themeOnAccentColor: rgbToHex(cssValue("--on-accent") || "#052016"),
    themeAccent: rgbToHex(cssValue("--accent")),
    themeAccentAlt: rgbToHex(cssValue("--accent-alt")),
    themeInputTextColor: rgbToHex(cssValue("--input-text") || cssValue("--text")),
    themeLolliGlass: Math.round(Number(cssValue("--lolli-glass") || "0") * 100),
    themeLolliBlur: parseInt(cssValue("--lolli-blur") || "0", 10) || 0,
    themeLolliTextColor: rgbToHex(cssValue("--lolli-text") || cssValue("--text")),
    themeLolliHoverColor: rgbToHex(cssValue("--lolli-hover") || cssValue("--accent")),
    themeLolliActiveBg: rgbToHex(cssValue("--lolli-active-bg") || cssValue("--accent")),
    themeLolliActiveIcon: rgbToHex(cssValue("--lolli-active-icon") || cssValue("--on-accent") || "#052016"),
    themeSurfaceColor: rgbToHex(`rgb(${cssValue("--surface-base-rgb").replaceAll(" ", ", ")})`),
    themeSidebarPanelColor: rgbToHex(`rgb(${cssValue("--sidebar-panel-rgb").replaceAll(" ", ", ") || cssValue("--surface-base-rgb").replaceAll(" ", ", ")})`),
    themeSidebarPanelAlpha: Math.round(Number(cssValue("--sidebar-panel-alpha") || "0.16") * 100),
    themeSidebarToggleColor: rgbToHex(cssValue("--sidebar-toggle-color") || cssValue("--accent")),
    themeSidebarToggleSize: parseInt(cssValue("--sidebar-toggle-size") || "20", 10),
    themeFontMenu: fontValueFromStack(cssValue("--font-menu")),
    themeFontCard: fontValueFromStack(cssValue("--font-card")),
    themeFontDescription: fontValueFromStack(cssValue("--font-description")),
    themeBg: rgbToHex(cssValue("--page-bg")),
    themeBackgroundImage: backgroundImageValue,
    themeBackgroundBlur: backgroundImageValue ? (parseInt(cssValue("--background-image-blur"), 10) || 10) : 10,
    themeBackgroundOpacity: backgroundImageValue ? (Math.round(Number(cssValue("--background-image-opacity")) * 100) || 55) : 55,
    themeBackgroundDim: backgroundImageValue ? (Math.round(Number(cssValue("--background-image-dim")) * 100) || 34) : 34,
    themeSidebarWidth: parseInt(cssValue("--sidebar-width") || "300", 10),
    themeLogoSize: parseInt(cssValue("--logo-size") || "71", 10),
    themeTitleSize: parseInt(cssValue("--title-size") || "29", 10),
    themeTitleColor: rgbToHex(cssValue("--title-color") || cssValue("--text")),
    themeTitleShadowBlur: parseInt(cssValue("--title-shadow-blur") || "0", 10),
    themeSubtitleSize: parseInt(cssValue("--subtitle-size") || "13", 10),
    themeSubtitleColor: rgbToHex(cssValue("--subtitle-color") || cssValue("--muted")),
    themeSubtitleShadowBlur: parseInt(cssValue("--subtitle-shadow-blur") || "0", 10),
    themePageTitleSize: parseInt(cssValue("--page-title-size") || "32", 10),
    themePageTitleShadowBlur: parseInt(cssValue("--page-title-shadow-blur") || "0", 10),
    themePageTitleColor: rgbToHex(cssValue("--page-title-color") || cssValue("--text")),
    themeSectionTitleColor: rgbToHex(cssValue("--section-title-color") || cssValue("--accent-alt")),
    themeSectionTitleSize: parseInt(cssValue("--section-title-size") || "12", 10),
    themeSectionTitleShadowBlur: parseInt(cssValue("--section-title-shadow-blur") || "0", 10),
    themeCardRadius: parseInt(cssValue("--card-radius") || "22", 10),
    themeCardGap: parseInt(cssValue("--card-gap") || "14", 10),
    themeTileHeight: parseInt(cssValue("--tile-height") || "132", 10),
    themePanelColor: rgbToHex(`rgb(${cssValue("--tile-panel-rgb").replaceAll(" ", ", ")})`),
    themePanelAlpha: Math.round(Number(cssValue("--tile-panel-alpha") || "0.08") * 100),
    themeGlassBlur: parseInt(cssValue("--glass-blur") || "12", 10),
    themeGlassSaturation: parseInt(cssValue("--glass-saturation") || "100", 10),
    themeBorderAlpha: Math.round(Number(cssValue("--border-alpha") || "0.11") * 100),
    themeAdminPanelColor: rgbToHex(`rgb(${cssValue("--admin-panel-rgb").replaceAll(" ", ", ")})`),
    themeAdminPanelAlpha: Math.round(Number(cssValue("--admin-panel-alpha") || "0.08") * 100),
    themeModalBg: rgbToHex(`rgb(${cssValue("--modal-bg-rgb").replaceAll(" ", ", ") || cssValue("--surface-base-rgb").replaceAll(" ", ", ")})`),
    themeModalAlpha: Math.round(Number(cssValue("--modal-alpha") || "0.92") * 100),
    themeModalGlassBlur: parseInt(cssValue("--modal-glass-blur") || "16", 10),
    themeModalBackdropBlur: parseInt(cssValue("--modal-backdrop-blur") || "3", 10),
    themeModalBackdropAlpha: Math.round(Number(cssValue("--modal-backdrop-alpha") || "0.62") * 100),
    themeModalRadius: parseInt(cssValue("--modal-radius") || "20", 10)
  };
  Object.entries(fields).forEach(([id, value]) => {
    const input = document.querySelector(`#${id}`);
    if (input) {
      input.value = value;
      updateRangeValue(input);
    }
  });
  const dialog = document.querySelector("#appearanceDialog");
  if (!dialog.open) dialog.showModal();
}

function updateRangeValue(input) {
  // Wartość tylko dla suwaków, w polu <span> zaraz za suwakiem — nie w ikonce ⓘ.
  if (input.type !== "range") return;
  const target = input.nextElementSibling?.matches?.("span:not(.info-tip)") ? input.nextElementSibling : null;
  if (!target) return;
  const percentFields = new Set(["themeLolliGlass", "themeBackgroundOpacity", "themeBackgroundDim", "themeSidebarPanelAlpha", "themePanelAlpha", "themeGlassSaturation", "themeBorderAlpha", "themeAdminPanelAlpha", "themeModalAlpha", "themeModalBackdropAlpha"]);
  target.textContent = percentFields.has(input.id) ? `${input.value}%` : `${input.value}px`;
}

function collectTheme() {
  return {
    text: document.querySelector("#themeTextColor").value,
    muted: document.querySelector("#themeMutedColor").value,
    onAccent: document.querySelector("#themeOnAccentColor").value,
    accent: document.querySelector("#themeAccent").value,
    accentAlt: document.querySelector("#themeAccentAlt").value,
    inputText: document.querySelector("#themeInputTextColor").value,
    lolliGlass: String(Number(document.querySelector("#themeLolliGlass").value) / 100),
    lolliBlur: `${document.querySelector("#themeLolliBlur").value}px`,
    lolliText: document.querySelector("#themeLolliTextColor").value,
    lolliHover: document.querySelector("#themeLolliHoverColor").value,
    lolliActiveBg: document.querySelector("#themeLolliActiveBg").value,
    lolliActiveIcon: document.querySelector("#themeLolliActiveIcon").value,
    surfaceColor: document.querySelector("#themeSurfaceColor").value,
    sidebarPanelColor: document.querySelector("#themeSidebarPanelColor").value,
    sidebarPanelAlpha: String(Number(document.querySelector("#themeSidebarPanelAlpha").value) / 100),
    sidebarToggleColor: document.querySelector("#themeSidebarToggleColor").value,
    sidebarToggleSize: `${document.querySelector("#themeSidebarToggleSize").value}px`,
    fontMenu: document.querySelector("#themeFontMenu").value,
    fontCard: document.querySelector("#themeFontCard").value,
    fontDescription: document.querySelector("#themeFontDescription").value,
    bg: document.querySelector("#themeBg").value,
    backgroundImage: document.querySelector("#themeBackgroundImage").value,
    backgroundBlur: `${document.querySelector("#themeBackgroundBlur").value}px`,
    backgroundOpacity: String(Number(document.querySelector("#themeBackgroundOpacity").value) / 100),
    backgroundDim: String(Number(document.querySelector("#themeBackgroundDim").value) / 100),
    sidebarWidth: `${document.querySelector("#themeSidebarWidth").value}px`,
    logoSize: `${document.querySelector("#themeLogoSize").value}px`,
    titleSize: `${document.querySelector("#themeTitleSize").value}px`,
    titleColor: document.querySelector("#themeTitleColor").value,
    titleShadowBlur: document.querySelector("#themeTitleShadowBlur").value,
    subtitleSize: `${document.querySelector("#themeSubtitleSize").value}px`,
    subtitleColor: document.querySelector("#themeSubtitleColor").value,
    subtitleShadowBlur: document.querySelector("#themeSubtitleShadowBlur").value,
    pageTitleSize: `${document.querySelector("#themePageTitleSize").value}px`,
    pageTitleShadowBlur: document.querySelector("#themePageTitleShadowBlur").value,
    pageTitleColor: document.querySelector("#themePageTitleColor").value,
    sectionTitleColor: document.querySelector("#themeSectionTitleColor").value,
    sectionTitleSize: `${document.querySelector("#themeSectionTitleSize").value}px`,
    sectionTitleShadowBlur: document.querySelector("#themeSectionTitleShadowBlur").value,
    cardRadius: `${document.querySelector("#themeCardRadius").value}px`,
    cardGap: `${document.querySelector("#themeCardGap").value}px`,
    tileHeight: `${document.querySelector("#themeTileHeight").value}px`,
    panelColor: document.querySelector("#themePanelColor").value,
    panelAlpha: String(Number(document.querySelector("#themePanelAlpha").value) / 100),
    glassBlur: `${document.querySelector("#themeGlassBlur").value}px`,
    glassSaturation: `${document.querySelector("#themeGlassSaturation").value}%`,
    borderAlpha: String(Number(document.querySelector("#themeBorderAlpha").value) / 100),
    adminPanelColor: document.querySelector("#themeAdminPanelColor").value,
    adminPanelAlpha: String(Number(document.querySelector("#themeAdminPanelAlpha").value) / 100),
    modalBg: document.querySelector("#themeModalBg").value,
    modalAlpha: String(Number(document.querySelector("#themeModalAlpha").value) / 100),
    modalGlassBlur: `${document.querySelector("#themeModalGlassBlur").value}px`,
    modalBackdropBlur: `${document.querySelector("#themeModalBackdropBlur").value}px`,
    modalBackdropAlpha: String(Number(document.querySelector("#themeModalBackdropAlpha").value) / 100),
    modalRadius: `${document.querySelector("#themeModalRadius").value}px`
  };
}

// ─── Tryb dzień / noc ─────────────────────────────────────────────────────────
// Wygląd startowy: styles.css. Zmiany z edytora: /custom/custom-d.css (dzień)
// i /custom/custom-n.css (noc). Oba pliki są wczytane w <head>; o tym, który
// działa, decyduje atrybut data-mode na <html>. Wybór trybu pamięta przeglądarka.

const MODE_STORAGE_KEY = "ifs.mode";

function currentMode() {
  return document.documentElement.dataset.mode === "d" ? "d" : "n";
}

function setMode(mode) {
  const next = mode === "d" ? "d" : "n";
  document.documentElement.dataset.mode = next;
  try { localStorage.setItem(MODE_STORAGE_KEY, next); } catch {}
  const button = document.querySelector("#sidebarIconMode .theme-toggle");
  button?.classList.toggle("theme-toggle--toggled", next === "n");
  applyLegacyThemeIfNeeded();
}

function modeToggleIcon() {
  return themeToggleIcon(currentMode() === "n");
}

// Odświeża plik CSS trybu po zapisie (pomija pamięć podręczną przeglądarki).
function reloadModeCss(mode) {
  const link = document.querySelector(`#customCss-${mode}`);
  if (link) link.href = `/custom/custom-${mode}.css?v=${Date.now()}`;
}

// Zmienne CSS, którymi steruje edytor — wszystkie, żeby podgląd dało się w całości zdjąć.
const THEME_VARS = [
  "--accent", "--accent-alt", "--accent-soft", "--glow-start", "--glow-end", "--on-accent", "--text", "--muted",
  "--page-bg", "--surface-base-rgb", "--panel-strong", "--background-image", "--background-image-opacity", "--background-image-blur",
  "--background-image-dim", "--title-color", "--title-size", "--title-shadow", "--title-shadow-blur", "--subtitle-color",
  "--subtitle-size", "--subtitle-shadow", "--subtitle-shadow-blur", "--logo-size", "--page-title-size", "--page-title-shadow",
  "--page-title-shadow-blur", "--page-title-color", "--section-title-color", "--section-title-size", "--section-title-shadow",
  "--section-title-shadow-blur", "--sidebar-panel-rgb", "--sidebar-panel-alpha", "--sidebar-width", "--sidebar-toggle-color",
  "--sidebar-toggle-size", "--font-menu", "--font-card", "--font-description", "--tile-panel-rgb", "--tile-panel-alpha",
  "--tile-height", "--admin-panel-rgb", "--admin-panel-alpha", "--border-alpha", "--line", "--card-radius", "--card-gap",
  "--glass-blur", "--glass-saturation", "--modal-bg-rgb", "--modal-alpha", "--modal-glass-blur", "--modal-radius",
  "--modal-backdrop-alpha", "--modal-backdrop-blur",
  "--input-text", "--lolli-glass", "--lolli-blur", "--lolli-text", "--lolli-hover", "--lolli-active-bg", "--lolli-active-icon"
];

const cssPx = (value) => (String(value).endsWith("px") ? String(value) : `${parseInt(value, 10) || 0}px`);

// Ustawienia z edytora (lub stary theme.json) → zmienne CSS.
function themeToVars(theme) {
  const vars = {};
  const set = (name, value) => { if (value != null && value !== "") vars[name] = String(value); };

  set("--text", theme.text);
  set("--muted", theme.muted);
  set("--on-accent", theme.onAccent);
  if (theme.accent) {
    set("--accent", theme.accent);
    set("--accent-soft", `color-mix(in srgb, ${theme.accent} 16%, transparent)`);
    set("--glow-start", `color-mix(in srgb, ${theme.accent} 12%, transparent)`);
    set("--glow-end", `color-mix(in srgb, ${theme.accent} 10%, transparent)`);
  }
  // Akcent 2 = kolor nagłówków na kafelkach i w okienkach.
  set("--accent-alt", theme.accentAlt);
  set("--input-text", theme.inputText);
  set("--lolli-glass", theme.lolliGlass);
  if (theme.lolliBlur) set("--lolli-blur", cssPx(theme.lolliBlur));
  set("--lolli-text", theme.lolliText);
  set("--lolli-hover", theme.lolliHover);
  set("--lolli-active-bg", theme.lolliActiveBg);
  set("--lolli-active-icon", theme.lolliActiveIcon);
  set("--page-bg", theme.bg);
  if (theme.surfaceColor) {
    set("--surface-base-rgb", hexToRgb(theme.surfaceColor));
    // --panel-strong jest liczone w :root, więc trzeba je podać razem z kolorem motywu.
    set("--panel-strong", `rgb(${hexToRgb(theme.surfaceColor)} / 0.94)`);
  }

  let backgroundUrl = "";
  if (theme.backgroundImage === "default") backgroundUrl = "/images/background.jpg";
  if (theme.backgroundImage === "custom") backgroundUrl = theme.backgroundUrl || "";
  if (backgroundUrl) {
    set("--background-image", `url("${backgroundUrl}")`);
    set("--background-image-opacity", theme.backgroundOpacity || "0.55");
    set("--background-image-blur", cssPx(theme.backgroundBlur || "10px"));
    set("--background-image-dim", theme.backgroundDim || "0.34");
  } else {
    set("--background-image", "none");
    set("--background-image-opacity", "0");
    set("--background-image-blur", "0px");
    set("--background-image-dim", "0");
  }

  set("--title-color", theme.titleColor);
  if (theme.titleSize) set("--title-size", cssPx(theme.titleSize));
  if (theme.titleShadowBlur != null && theme.titleShadowBlur !== "") {
    const blur = parseInt(theme.titleShadowBlur, 10) || 0;
    set("--title-shadow", blur > 0 ? `0 2px ${blur}px rgba(0,0,0,0.85)` : "none");
    set("--title-shadow-blur", `${blur}px`);
  }
  set("--subtitle-color", theme.subtitleColor);
  if (theme.subtitleSize) set("--subtitle-size", cssPx(theme.subtitleSize));
  if (theme.subtitleShadowBlur != null && theme.subtitleShadowBlur !== "") {
    const blur = parseInt(theme.subtitleShadowBlur, 10) || 0;
    set("--subtitle-shadow", blur > 0 ? `0 1px ${blur}px rgba(0,0,0,0.75)` : "none");
    set("--subtitle-shadow-blur", `${blur}px`);
  }
  if (theme.logoSize) set("--logo-size", cssPx(theme.logoSize));
  if (theme.pageTitleSize) set("--page-title-size", cssPx(theme.pageTitleSize));
  if (theme.pageTitleShadowBlur != null && theme.pageTitleShadowBlur !== "") {
    const blur = parseInt(theme.pageTitleShadowBlur, 10) || 0;
    set("--page-title-shadow", blur > 0 ? `0 2px ${blur}px rgba(0,0,0,0.85)` : "none");
    set("--page-title-shadow-blur", `${blur}px`);
  }
  set("--page-title-color", theme.pageTitleColor);
  set("--section-title-color", theme.sectionTitleColor);
  if (theme.sectionTitleSize) set("--section-title-size", cssPx(theme.sectionTitleSize));
  if (theme.sectionTitleShadowBlur != null && theme.sectionTitleShadowBlur !== "") {
    const blur = parseInt(theme.sectionTitleShadowBlur, 10) || 0;
    set("--section-title-shadow", blur > 0 ? `0 1px ${blur}px rgba(0,0,0,0.75)` : "none");
    set("--section-title-shadow-blur", `${blur}px`);
  }

  if (theme.sidebarPanelColor) set("--sidebar-panel-rgb", hexToRgb(theme.sidebarPanelColor));
  set("--sidebar-panel-alpha", theme.sidebarPanelAlpha);
  if (theme.sidebarWidth) set("--sidebar-width", cssPx(theme.sidebarWidth));
  set("--sidebar-toggle-color", theme.sidebarToggleColor);
  if (theme.sidebarToggleSize) set("--sidebar-toggle-size", cssPx(theme.sidebarToggleSize));
  if (theme.fontMenu) set("--font-menu", fontStack(theme.fontMenu));
  if (theme.fontCard) set("--font-card", fontStack(theme.fontCard));
  if (theme.fontDescription) set("--font-description", fontStack(theme.fontDescription));

  if (theme.panelColor) set("--tile-panel-rgb", hexToRgb(theme.panelColor));
  set("--tile-panel-alpha", theme.panelAlpha);
  if (theme.tileHeight) set("--tile-height", cssPx(theme.tileHeight));
  if (theme.adminPanelColor) set("--admin-panel-rgb", hexToRgb(theme.adminPanelColor));
  set("--admin-panel-alpha", theme.adminPanelAlpha);
  if (theme.borderAlpha) {
    set("--border-alpha", theme.borderAlpha);
    // Linie i ramki mają kolor tekstu — dzięki temu działają i na jasnym, i na ciemnym tle.
    const lineRgb = theme.text ? hexToRgb(theme.text) : "255 255 255";
    set("--line", `rgb(${lineRgb} / ${theme.borderAlpha})`);
  }
  if (theme.cardRadius) set("--card-radius", cssPx(theme.cardRadius));
  if (theme.cardGap) set("--card-gap", cssPx(theme.cardGap));
  if (theme.glassBlur) set("--glass-blur", cssPx(theme.glassBlur));
  set("--glass-saturation", theme.glassSaturation);

  if (theme.modalBg) set("--modal-bg-rgb", hexToRgb(theme.modalBg));
  set("--modal-alpha", theme.modalAlpha);
  if (theme.modalGlassBlur) set("--modal-glass-blur", cssPx(theme.modalGlassBlur));
  if (theme.modalRadius) set("--modal-radius", cssPx(theme.modalRadius));
  set("--modal-backdrop-alpha", theme.modalBackdropAlpha);
  if (theme.modalBackdropBlur) set("--modal-backdrop-blur", cssPx(theme.modalBackdropBlur));
  return vars;
}

function setThemeVars(vars) {
  const root = document.body || document.documentElement;
  Object.entries(vars).forEach(([name, value]) => root.style.setProperty(name, value));
}

function clearTheme() {
  const root = document.body || document.documentElement;
  THEME_VARS.forEach((name) => root.style.removeProperty(name));
}

// Dla zgodności: stary zapis wyglądu (theme.json) działa w trybie noc,
// dopóki nie powstanie custom-n.css.
function applyTheme(theme) {
  setThemeVars(themeToVars(theme || {}));
}

function applyLegacyThemeIfNeeded() {
  if (document.querySelector("#appearanceDialog")?.open) return;
  clearTheme();
  if (state.legacyTheme && currentMode() === "n") applyTheme(state.legacyTheme);
}

// Podgląd na żywo w edytorze — style tymczasowe, zdejmowane przy Anuluj/zapisie.
function previewTheme() {
  const theme = collectTheme();
  if (theme.backgroundImage === "custom") theme.backgroundUrl = state.pendingBackground || state.currentBackgroundUrl || "";
  clearTheme();
  setThemeVars(themeToVars(theme));
}

function discardThemePreview() {
  state.appearanceDirty = false;
  state.pendingBackground = null;
  clearTheme();
  if (state.legacyTheme && currentMode() === "n") applyTheme(state.legacyTheme);
}

async function saveThemeSettings(event) {
  event.preventDefault();
  const mode = document.querySelector("#themeEditMode")?.value === "d" ? "d" : "n";
  const theme = collectTheme();
  if (theme.backgroundImage === "custom") theme.backgroundUrl = state.currentBackgroundUrl || "";
  const vars = themeToVars(theme);
  if (theme.backgroundImage === "custom" && !theme.backgroundUrl && !state.pendingBackground) {
    showToast("Wybierz plik obrazu albo inny obraz tła.");
    return;
  }
  try {
    await request(`${dashboardConfig.apiUrl}/api/dashboard/custom-css`, {
      method: "PUT",
      body: JSON.stringify({ mode, vars, backgroundData: state.pendingBackground || null })
    });
    if (mode === "n") state.legacyTheme = null;
    reloadModeCss(mode);
    document.querySelector("#appearanceDialog").close();
    showToast(mode === "d" ? "Zapisano wygląd dnia (custom-d.css)." : "Zapisano wygląd nocy (custom-n.css).");
  } catch (error) {
    showToast(error.message);
  }
}

async function resetThemeSettings() {
  const mode = document.querySelector("#themeEditMode")?.value === "d" ? "d" : "n";
  const label = mode === "d" ? "dnia" : "nocy";
  if (!(await ifConfirm(`Przywrócić wygląd startowy ${label}? Twoje zmiany dla tego trybu zostaną usunięte.`, { okLabel: "Przywróć", danger: true }))) return;
  try {
    await request(`${dashboardConfig.apiUrl}/api/dashboard/custom-css`, {
      method: "PUT",
      body: JSON.stringify({ mode, reset: true })
    });
    if (mode === "n") state.legacyTheme = null;
    reloadModeCss(mode);
    document.querySelector("#appearanceDialog").close();
    showToast(`Przywrócono wygląd startowy ${label}.`);
  } catch (error) {
    showToast(error.message);
  }
}

async function loadThemeSettings() {
  state.legacyTheme = null;
  try {
    const status = await request(`${dashboardConfig.apiUrl}/api/dashboard/custom-css`);
    if (!status.n && status.legacyTheme) {
      const data = await request(`${dashboardConfig.apiUrl}/api/dashboard/theme`);
      const legacy = data.theme || {};
      if (Object.keys(legacy).length) state.legacyTheme = legacy;
    }
  } catch {}
  applyLegacyThemeIfNeeded();
}

function cssValue(name) {
  return getComputedStyle(document.body || document.documentElement).getPropertyValue(name).trim();
}

function rgbToHex(value) {
  if (value.startsWith("#")) return value.slice(0, 7);
  const match = value.match(/\d+/g);
  if (!match) return "#000000";
  return "#" + match.slice(0, 3).map((part) => Number(part).toString(16).padStart(2, "0")).join("");
}

function hexToRgb(value) {
  const hex = value.replace("#", "");
  const number = parseInt(hex, 16);
  return `${(number >> 16) & 255} ${(number >> 8) & 255} ${number & 255}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

let statusTopController = null;

function stopStatusTopDiagnostics() {
  if (statusTopController) {
    statusTopController.stop();
    statusTopController = null;
  }
}

function renderServerStatus() {
  stopStatusTopDiagnostics();
  document.querySelector("#viewTitle").textContent = "Status serwera";
  document.querySelector("#toolbarActions").innerHTML = `
    <button type="button" class="primary" id="btnRefreshServerStatus">Odśwież</button>
  `;
  document.querySelector("#content").innerHTML = `
    <section class="admin-card system-stats-card">
      <div class="panel-heading">
        <div><span class="eyebrow">Monitoring</span><h2>Statystyki systemu</h2></div>
        <div class="panel-heading-actions"><span id="systemStatsUpdated">Oczekiwanie</span></div>
      </div>
      <div class="cockpit-stats" id="systemStats"><div class="empty">Pobieranie danych…</div></div>
    </section>
  `;
  loadSystemStats();
  document.querySelector("#btnRefreshServerStatus")?.addEventListener("click", loadSystemStats);
}

function renderTopPage() {
  stopStatusTopDiagnostics();
  document.querySelector("#viewTitle").textContent = "Top (procesy)";
  document.querySelector("#toolbarActions").innerHTML = `
    <button type="button" class="primary" id="btnRefreshTop">Odśwież</button>
  `;
  document.querySelector("#content").innerHTML = `
    <section class="admin-card"><div id="topPageMount"></div></section>
  `;
  statusTopController = TopDiagnostics.mount(document.querySelector("#topPageMount"));
  statusTopController.start();
  document.querySelector("#btnRefreshTop")?.addEventListener("click", () => statusTopController?.refresh());
}

function renderToolsPage() {
  stopStatusTopDiagnostics();
  document.querySelector("#viewTitle").textContent = "Narzędzia";
  document.querySelector("#toolbarActions").innerHTML = "";
  // Tester portów (bez PIN-u) + po prawej „Narzędzia Pomocnicze” — miejsce na menu kolejnych
  // narzędzi (kopia zapasowa, przygotowanie instalacji); na razie puste.
  document.querySelector("#content").innerHTML = `
    <div class="tools-layout">
      <section class="admin-card ports-card">
        <div class="panel-heading"><div><span class="eyebrow">Sieć</span><h2>Wyszukiwanie i test portów</h2></div></div>
        <div id="portTool"></div>
      </section>
      <section class="admin-card helper-tools-card">
        <div class="panel-heading"><div><h2>Narzędzia Pomocnicze</h2></div></div>
      </section>
    </div>
  `;
  renderPortTool();
}

function renderAlertsPage() {
  stopStatusTopDiagnostics();
  document.querySelector("#viewTitle").textContent = "Alerty";
  document.querySelector("#toolbarActions").innerHTML = `
    <button type="button" class="primary" id="btnRefreshAlerts">Odśwież</button>
  `;
  document.querySelector("#content").innerHTML = `
    <section class="admin-card alerts-status-card">
      <div class="panel-heading">
        <div><span class="eyebrow">Diagnostyka</span><h2>Centrum alertów</h2></div>
        <div class="panel-heading-actions"><a href="./mods/admin/?tab=alerts">Pełny widok w Zapleczu →</a></div>
      </div>
      <div id="serverStatusAlerts" style="display:grid; gap:10px;"><div class="empty">Pobieranie stanu alertów...</div></div>
    </section>
  `;
  renderAlertsInto("#serverStatusAlerts");
  document.querySelector("#btnRefreshAlerts")?.addEventListener("click", () => renderAlertsInto("#serverStatusAlerts"));
}

function renderAdmin() {
  renderServerStatus();
}

function renderPortTool() {
  const target = document.querySelector("#portTool");
  target.innerHTML = `
    <div class="port-layout">
      <label>Kategoria<select id="hintCategory">${Object.entries(PORT_HINTS).map(([id, hint]) => `<option value="${id}">${hint.label}</option>`).join("")}</select></label>
      <div class="port-result is-info" id="hintResult"></div>
      <label>Host<input id="checkHost" value="${dashboardConfig.defaultHost}"></label>
      <label>Port hosta<input id="checkPort" inputmode="numeric" placeholder="3050"></label>
      <button class="primary" id="checkPortButton" type="button">Sprawdź port</button>
      <div class="port-result" id="portResult"><strong>Czeka</strong><span>Wpisz host i port.</span></div>
    </div>
  `;
  const category = document.querySelector("#hintCategory");
  const renderHint = () => {
    const hint = PORT_HINTS[category.value];
    const typicalText = hint.typicalPorts && hint.typicalPorts.length ? ` | Przykłady w tej puli: ${hint.typicalPorts.join(", ")}` : "";
    const descText = hint.description ? ` (${hint.description})` : "";
    setPortResult(document.querySelector("#hintResult"), "is-info", hint.label, `Pula hosta: ${hint.range}${typicalText}${descText}`);
  };
  category.addEventListener("change", renderHint);
  document.querySelector("#checkPortButton").addEventListener("click", runPortCheck);
  renderHint();
}

function setPortResult(box, tone, title, message) {
  box.className = `port-result ${tone}`;
  box.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
}

async function checkPortAvailability(host, port) {
  const payload = {
    category: "manual",
    hostPort: port,
    containerPort: 80,
    host,
    port
  };
  return request(`${dashboardConfig.apiUrl}/api/ports/check`, { method: "POST", body: JSON.stringify(payload) });
}

async function runPortCheck() {
  const host = document.querySelector("#checkHost").value.trim();
  const rawPort = document.querySelector("#checkPort").value.trim();
  const port = Number(rawPort);
  const box = document.querySelector("#portResult");
  if (!host) return setPortResult(box, "is-error", "Brak hosta", "Wpisz adres IP albo nazwę hosta.");
  if (rawPort === "" || !Number.isInteger(port) || port < 1 || port > 65535) {
    return setPortResult(box, "is-error", "Niepoprawny port", "Port TCP/UDP musi mieć zakres 1–65535.");
  }
  const button = document.querySelector("#checkPortButton");
  button.disabled = true;
  setPortResult(box, "is-pending", "Sprawdzam", `${host}:${port}`);
  try {
    const data = await checkPortAvailability(host, port);
    const status = data.status || data.result || data.state;
    if (["busy", "used", "occupied", "open"].includes(status) || data.busy === true || data.open === true) {
      return setPortResult(box, "is-busy", "Port zajęty", `${host}:${port}`);
    }
    if (["free", "available", "closed"].includes(status) || data.busy === false || data.open === false) {
      return setPortResult(box, "is-free", "Port wolny", `${host}:${port}`);
    }
    if (data.ok === true) return setPortResult(box, "is-free", "Port sprawdzony", `${host}:${port}`);
    setPortResult(box, "is-error", "Nieznany status", "Backend nie zwrócił rozpoznawanego statusu.");
  } catch (error) {
    setPortResult(box, "is-error", "Błąd sprawdzania", error.message);
  } finally {
    button.disabled = false;
  }
}

function loadDismissedAlerts() {
  try { return JSON.parse(localStorage.getItem("ifs.dismissedAlerts") || "[]"); } catch { return []; }
}

function saveDismissedAlerts(keys) {
  try { localStorage.setItem("ifs.dismissedAlerts", JSON.stringify(keys)); } catch {}
}

async function loadAlertsSummary() {
  const badge = document.querySelector("#sidebarAlertBadge");
  const headerAlert = document.querySelector("#headerAlert");
  try {
    const data = await request(`${dashboardConfig.apiUrl}/api/alerts/summary`);
    state.alertsData = data;
    const total = data.summary?.total || 0;

    if (badge) {
      if (total > 0) {
        badge.textContent = String(total);
        badge.style.display = "flex";
      } else {
        badge.style.display = "none";
      }
    }

    if (headerAlert) {
      // Pasek: każda awaria (czerwony) i ostrzeżenia temperatur (pomarańczowy).
      // CPU / RAM / dyski jako ostrzeżenie zostają tylko w dzwonku.
      // Zamknięty ✕ nie wraca dla tych samych zgłoszeń; wraca przy nowym, przy
      // zmianie z „uwagi” na „alarm” albo gdy usługa po naprawie padnie znowu.
      const barAlerts = (data.alerts || []).filter((a) => a.severity === "critical" || a.type === "temperature");
      const keyOf = (a) => `${a.id || a.resource || a.title}:${a.severity}`;
      const barKeys = barAlerts.map(keyOf);
      const dismissed = loadDismissedAlerts().filter((key) => barKeys.includes(key));
      saveDismissedAlerts(dismissed);
      const visible = barAlerts.filter((a) => !dismissed.includes(keyOf(a)));
      if (visible.length) {
        const isCritical = visible.some((a) => a.severity === "critical");
        const names = visible.map((a) => a.type === "temperature" ? `${a.resource} (${a.message.split(" — ")[0]})` : (a.resource || a.title));
        headerAlert.innerHTML = `
          <div class="incident-bar ${isCritical ? "critical" : "warning"}">
            <span class="incident-bar-icon">${uiIcon(isCritical ? "siren" : "warning", 24)}</span>
            <span class="incident-bar-text">
              <strong>${isCritical ? "Alarm — wykryto awarię" : "Uwaga — podwyższona temperatura"}</strong>
              <span>${escapeHtml(names.join(", "))}</span>
            </span>
            <a href="./mods/admin/?tab=alerts" class="incident-bar-btn" title="Otwórz szczegóły w Centrum alertów">Szczegóły →</a>
            <span class="incident-bar-spacer"></span>
            <button type="button" class="incident-bar-close" id="headerAlertClose" title="Zamknij pasek (alert zostaje w dzwonku)" aria-label="Zamknij pasek">${uiIcon("close", 18)}</button>
          </div>
        `;
        headerAlert.querySelector("#headerAlertClose").addEventListener("click", () => {
          saveDismissedAlerts([...dismissed, ...visible.map(keyOf)]);
          headerAlert.innerHTML = "";
          headerAlert.style.display = "none";
        });
        headerAlert.style.display = "flex";
      } else {
        headerAlert.innerHTML = "";
        headerAlert.style.display = "none";
      }
    }
  } catch (error) {
    if (badge) badge.style.display = "none";
    if (headerAlert) headerAlert.style.display = "none";
  }
}

function openQuickAlertsModal() {
  const dialog = document.querySelector("#alertsQuickModal");
  if (!dialog) return;
  renderQuickAlertsContent();
  dialog.showModal();
}

function renderQuickAlertsContent() {
  return renderAlertsInto("#quickAlertsContent");
}

async function renderAlertsInto(selector) {
  const container = document.querySelector(selector);
  if (!container) return;
  container.innerHTML = '<div class="empty">Pobieranie alertów...</div>';
  try {
    const data = await request(`${dashboardConfig.apiUrl}/api/alerts/summary`);
    state.alertsData = data;
    const alerts = data.alerts || [];
    if (alerts.length === 0) {
      container.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 24px; text-align:center; background: rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.25); border-radius:14px;">
          <span style="margin-bottom:8px; color:#34d399;">${uiIcon("ok", 34)}</span>
          <strong style="color:#34d399; font-size:15px;">Wszystkie usługi i kontenery działają stabilnie.</strong>
          <span style="color:var(--muted); font-size:12px; margin-top:4px;">Brak aktywnych awarii w Homelabie.</span>
        </div>
      `;
      return;
    }
    container.innerHTML = alerts.map((a) => {
      const isCritical = a.severity === "critical";
      const isInfo = a.severity === "info";
      const level = isCritical ? "critical" : isInfo ? "info" : "warning";
      return `
        <div class="incident-bar ${level}">
          <span class="incident-bar-icon">${uiIcon(isCritical ? "siren" : isInfo ? "package" : "warning", 24)}</span>
          <span class="incident-bar-text">
            <strong>${escapeHtml(a.title)}</strong>
            <span>${escapeHtml(a.message)}</span>
          </span>
          <span class="incident-bar-tag">${isCritical ? "Awaria" : isInfo ? "Informacja" : "Ostrzeżenie"}</span>
        </div>
      `;
    }).join("");
  } catch (err) {
    container.innerHTML = `<div class="empty" style="color:var(--danger);">Błąd pobierania alertów: ${escapeHtml(err.message)}</div>`;
  }
}

async function loadSystemStats() {
  const widget = document.querySelector("#systemStatsWidget");
  if (!widget) return;
  const container = document.querySelector("#systemStats");
  const updatedLabel = document.querySelector("#systemStatsUpdated");

  try {
    const data = await request(`${dashboardConfig.apiUrl}/api/system/stats`);
    widget.innerHTML = renderHeaderStats(data);
    widget.dataset.status = "online";
    const updated = data.updated ? new Date(data.updated) : null;
    const updatedText = updated && !Number.isNaN(updated.getTime())
      ? `Akt. ${updated.toLocaleTimeString("pl-PL")}`
      : "Połączono";
    widget.title = updatedText;
    if (container) container.innerHTML = renderSystemStats(data);
    if (updatedLabel) updatedLabel.textContent = updatedText;
  } catch (error) {
    widget.dataset.status = "error";
    widget.title = error.message;
    widget.innerHTML = `
      <div class="header-stat is-error"><span>CPU</span><strong>--</strong></div>
      <div class="header-stat is-error"><span>RAM</span><strong>--</strong></div>
    `;
    if (container) container.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
    if (updatedLabel) updatedLabel.textContent = "Brak danych";
  }
}

function renderHeaderStats(data) {
  const cpuUsage = data.cpu?.usage == null ? null : Number(data.cpu.usage);
  const memoryPercent = data.memory?.percent == null ? null : Number(data.memory.percent);
  // Kolor wg progów z Zaplecza → Centrum alertów (CPU i RAM tylko kolorem, bez paska).
  const level = (value, limits) => {
    if (value == null || Number.isNaN(value) || !limits) return "";
    if (value >= limits.alarm) return " is-alarm";
    if (value >= limits.warn) return " is-warn";
    return "";
  };
  return `
    <div class="header-stat${level(cpuUsage, data.thresholds?.cpu)}"><span>CPU</span><strong>${percentLabel(cpuUsage)}</strong></div>
    <div class="header-stat${level(memoryPercent, data.thresholds?.ram)}"><span>RAM</span><strong>${percentLabel(memoryPercent)}</strong></div>
  `;
}

function renderSystemStats(data) {
  const cpuUsage = data.cpu?.usage == null ? 0 : Number(data.cpu.usage);
  const memoryPercent = data.memory?.percent == null ? 0 : Number(data.memory.percent);
  const swapPercent = data.swap?.percent == null ? 0 : Number(data.swap.percent);
  const disks = Array.isArray(data.disks) ? data.disks.slice(0, 5) : [];

  return `
    <article class="cockpit-stat-card">
      <header><h3>Procesor</h3><strong>${data.cpu?.temperature == null ? "—" : `${Math.round(data.cpu.temperature)} °C`}</strong></header>
      <div class="stat-line"><strong>${escapeHtml(String(data.cpu?.count ?? "—"))} procesory</strong><span>użycie: ${percentLabel(cpuUsage)}</span></div>
      ${renderProgress(cpuUsage)}
      <p><strong>Obciążenie</strong> 1 minuta: ${numberLabel(data.cpu?.load1)}, 5 minut: ${numberLabel(data.cpu?.load5)}, 15 minut: ${numberLabel(data.cpu?.load15)}</p>
    </article>
    <article class="cockpit-stat-card">
      <header><h3>Pamięć</h3></header>
      <div class="stat-line"><strong>RAM</strong><span>${bytesLabel(data.memory?.available)} dostępne</span></div>
      ${renderProgress(memoryPercent)}
      <div class="stat-line"><strong>Partycja wymiany</strong><span>${bytesLabel(data.swap?.available)} dostępne</span></div>
      ${renderProgress(swapPercent)}
    </article>
    <article class="cockpit-stat-card">
      <header><h3>Dyski</h3></header>
      ${disks.length ? disks.map((disk) => `
        <div class="disk-row">
          <div class="stat-line"><strong>${escapeHtml(disk.mount)}</strong><span>${bytesLabel(disk.available)} wolne</span></div>
          ${renderProgress(disk.percent)}
        </div>
      `).join("") : `<div class="empty">Brak danych dysków.</div>`}
    </article>
  `;
}

function renderProgress(value) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return `<div class="stat-progress"><span style="width: ${safeValue}%"></span></div>`;
}

function numberLabel(value) {
  return value == null || Number.isNaN(Number(value)) ? "—" : Number(value).toFixed(2);
}

function bytesLabel(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit < 2 ? Math.round(size) : size.toFixed(1).replace(".", ",")} ${units[unit]}`;
}

function percentLabel(value) {
  return value == null ? "—" : `${Math.round(Number(value))}%`;
}

function statusLabel(value) {
  const status = String(value || "unknown").toLowerCase();
  if (["up", "online", "ok", "healthy"].includes(status)) return "Online";
  if (["down", "offline", "error"].includes(status)) return "Offline";
  return value || "Nieznany";
}

function syncSystemStatsPolling() {
  const shouldPoll = document.visibilityState === "visible";
  if (shouldPoll && !state.systemStatsTimer) {
    loadSystemStats();
    loadAlertsSummary();
    state.systemStatsTimer = window.setInterval(() => {
      loadSystemStats();
      loadAlertsSummary();
    }, 15000);
  } else if (!shouldPoll && state.systemStatsTimer) {
    clearInterval(state.systemStatsTimer);
    state.systemStatsTimer = null;
  }
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"), 2200);
}

async function init() {
  try {
    await loadDashboardSettings();
    await reloadData();
    appShell();
    await loadThemeSettings();
    loadAlertsSummary();
  } catch (error) {
    document.querySelector("#app").innerHTML = `
      <div class="startup-error">
        <strong>Nie udało się uruchomić strony startowej</strong>
        <span>${escapeHtml(error.message)}</span>
      </div>
    `;
  }
}

init();
