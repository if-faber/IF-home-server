const dashboard = document.documentElement.dataset.dashboard;
const dashboardConfig = {
  apiUrl: window.location.origin,
  title: t("page.header.default_title"),
  subtitle: t("page.header.default_subtitle"),
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
      localStorage.setItem("ifs.lastActivity", String(Date.now())); // zamek czasowy liczy od zalogowania
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
  ["system", t("page.appearance.font_system")],
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
  if (!response.ok) {
    const error = new Error(serverErrorText(data, "page.messages", data.message || data.error || `HTTP ${response.status}`));
    error.code = data.code;
    throw error;
  }
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
      <button class="menu-toggle" id="menuToggle" type="button" aria-label="${escapeHtml(t("page.sidebar.menu_toggle"))}" title="${escapeHtml(t("page.sidebar.menu_toggle"))}">${uiIcon("menu", 22)}</button>
      <aside class="sidebar">
        <div class="brand">
          <div><strong>${escapeHtml(state.data.title)}</strong></div>
        </div>
        <nav id="navigation"></nav>
        <div class="sidebar-actions">
          <div class="sidebar-menu" id="sidebarMenu" role="menu" hidden>
            <button type="button" role="menuitem" data-menu-action="appearance">${uiIcon("appearance", 18)} ${escapeHtml(t("page.sidebar.menu_appearance"))}</button>
            <a href="./mods/admin/" role="menuitem">${uiIcon("admin", 18)} ${escapeHtml(t("page.sidebar.menu_admin"))}</a>
            <div class="sidebar-menu-sep" role="separator"></div>
            <button type="button" role="menuitem" data-menu-action="lock" id="sidebarMenuLock" title="${escapeHtml(t("page.sidebar.menu_lock_title"))}">${uiIcon("lock", 18)} <span>${escapeHtml(t("page.sidebar.menu_lock"))}</span></button>
          </div>
          <div class="sidebar-tools">
            <button type="button" class="sidebar-icon-btn" id="sidebarIconMode" title="${escapeHtml(t("page.sidebar.mode_title"))}" aria-label="${escapeHtml(t("page.sidebar.mode_label"))}">${modeToggleIcon()}</button>
            ${dashboardConfig.translatorEnabled ? `<a class="sidebar-icon-btn" id="sidebarTranslatorButton" href="./mods/admin/?tab=language" title="${escapeHtml(t("page.sidebar.translator_title"))}" aria-label="${escapeHtml(t("page.sidebar.translator_title"))}">${uiIcon("languages", 20)}</a>` : ""}
            <button type="button" class="sidebar-icon-btn" id="sidebarHelpButton" title="${escapeHtml(t("page.sidebar.help_title"))}" aria-label="${escapeHtml(t("page.sidebar.help_label"))}">${uiIcon("help", 20)}</button>
            <button type="button" class="sidebar-icon-btn" id="sidebarMenuButton" title="${escapeHtml(t("page.sidebar.settings"))}" aria-label="${escapeHtml(t("page.sidebar.settings"))}" aria-haspopup="menu" aria-expanded="false">${uiIcon("settings", 20)}</button>
          </div>
          <div class="sidebar-footer">${escapeHtml(t("page.sidebar.created_by"))} <strong>Idea Forge</strong></div>
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
          <div class="header-stats" id="systemStatsWidget" aria-label="${escapeHtml(t("page.header.stats_label"))}">
            <div class="header-stat is-loading"><span>${escapeHtml(t("page.header.cpu"))}</span><strong>--</strong></div>
            <div class="header-stat is-loading"><span>${escapeHtml(t("page.header.ram"))}</span><strong>--</strong></div>
          </div>
          <div class="toolbar-actions" id="toolbarActions"></div>
          <button type="button" class="sidebar-icon-btn header-bell" id="sidebarIconAlerts" title="${escapeHtml(t("page.header.bell"))}" aria-label="${escapeHtml(t("page.header.bell"))}">${uiIcon("alerts", 20)}<span class="sidebar-alert-badge" id="sidebarAlertBadge" style="display:none;">0</span></button>
        </header>
        <div id="headerAlert" class="header-alert-box" style="display: none;"></div>
        <div id="headerBackup" class="header-alert-box" style="display: none;"></div>
        <section id="content"></section>
      </main>
    </div>
    <dialog id="linkDialog" class="wide-dialog">
      <form id="linkForm" class="modal-panel">
        <header class="modal-heading">
          <div><span class="eyebrow">${escapeHtml(t("page.link_dialog.eyebrow"))}</span><h2 id="linkDialogTitle">${escapeHtml(t("page.link_dialog.title_new"))}</h2></div>
          <button type="button" data-close aria-label="${escapeHtml(t("page.link_dialog.close"))}">×</button>
        </header>
        <div class="settings-grid">
          <label>${escapeHtml(t("page.link_dialog.section"))}<select id="linkSection"></select></label>
          <label>${escapeHtml(t("page.link_dialog.name"))}<input id="linkName" required></label>
          <label style="grid-column: 1 / -1;">${escapeHtml(t("page.link_dialog.url"))}<input id="linkUrl" type="url" required placeholder="https://..."></label>
          <label style="grid-column: 1 / -1;">${escapeHtml(t("page.link_dialog.description"))}<input id="linkDescription"></label>
          <label>${escapeHtml(t("page.link_dialog.icon"))}<input id="linkIcon" placeholder="${escapeHtml(t("page.link_dialog.icon_placeholder"))}"></label>
          <label>${escapeHtml(t("page.link_dialog.open_mode"))}<select id="linkOpenMode"><option value="new-tab">${escapeHtml(t("page.link_dialog.open_new_tab"))}</option><option value="iframe">${escapeHtml(t("page.link_dialog.open_iframe"))}</option></select></label>
        </div>
        <menu><button type="button" data-close>${escapeHtml(t("page.link_dialog.cancel"))}</button><button class="primary">${escapeHtml(t("page.link_dialog.save"))}</button></menu>
      </form>
    </dialog>
    ${pinDialogHtml()}
    <dialog id="appearanceDialog" class="wide-dialog preview-dialog">
      <form id="appearanceForm" class="modal-panel">
        <header class="modal-heading">
          <div><span class="eyebrow">${escapeHtml(t("page.appearance.eyebrow"))}</span><h2>${escapeHtml(t("page.appearance.title"))}</h2></div>
          <button type="button" data-close aria-label="${escapeHtml(t("page.appearance.close"))}">×</button>
        </header>
        <div class="appearance-mode-bar">
          <label>${escapeHtml(t("page.appearance.mode_label"))}
            <select id="themeEditMode">
              <option value="d">${escapeHtml(t("page.appearance.mode_day"))}</option>
              <option value="n">${escapeHtml(t("page.appearance.mode_night"))}</option>
            </select>
          </label>
          <p>${escapeHtml(t("page.appearance.mode_hint"))}</p>
        </div>
        <div class="appearance-sections">
          <!-- 1. Ogólne i tło -->
          <section class="appearance-section">
            <div class="appearance-section-title">${uiIcon("appearance", 16)} ${escapeHtml(t("page.appearance.group_general"))}</div>
            <div class="appearance-section-grid">
              <label>${escapeHtml(t("page.appearance.accent"))}<input id="themeAccent" type="color"></label>
              <label><span class="field-title">${escapeHtml(t("page.appearance.accent_alt"))} ${infoTip(t("page.appearance.accent_alt_tip"))}</span><input id="themeAccentAlt" type="color"></label>
              <label>${escapeHtml(t("page.appearance.bg"))}<input id="themeBg" type="color"></label>
              <label>${escapeHtml(t("page.appearance.surface"))}<input id="themeSurfaceColor" type="color"></label>
              <label>${escapeHtml(t("page.appearance.text"))}<input id="themeTextColor" type="color"></label>
              <label>${escapeHtml(t("page.appearance.muted"))}<input id="themeMutedColor" type="color"></label>
              <label>${escapeHtml(t("page.appearance.on_accent"))}<input id="themeOnAccentColor" type="color"></label>
              <label><span class="field-title">${escapeHtml(t("page.appearance.input_text"))} ${infoTip(t("page.appearance.input_text_tip"))}</span><input id="themeInputTextColor" type="color"></label>
              <label>${escapeHtml(t("page.appearance.bg_image"))}<select id="themeBackgroundImage"><option value="">${escapeHtml(t("page.appearance.bg_image_off"))}</option><option value="default">./images/background.jpg</option><option value="custom">${escapeHtml(t("page.appearance.bg_image_custom"))}</option></select></label>
              <label>${escapeHtml(t("page.appearance.bg_upload"))}<input id="themeBackgroundUpload" type="file" accept="image/png,image/jpeg,image/webp"></label>
              <label>${escapeHtml(t("page.appearance.bg_dim"))}<input id="themeBackgroundDim" type="range" min="0" max="85" step="1"><span></span></label>
              <label>${escapeHtml(t("page.appearance.bg_blur"))}<input id="themeBackgroundBlur" type="range" min="0" max="40" step="1"><span></span></label>
              <label>${escapeHtml(t("page.appearance.bg_opacity"))}<input id="themeBackgroundOpacity" type="range" min="0" max="100" step="1"><span></span></label>
            </div>
          </section>

          <!-- 2. Header / Nagłówek -->
          <section class="appearance-section">
            <div class="appearance-section-title">${uiIcon("tag", 16)} ${escapeHtml(t("page.appearance.group_header"))} ${infoTip(t("page.appearance.group_header_tip"))}</div>
            <div class="appearance-section-grid">
              <label>${escapeHtml(t("page.appearance.site_name_color"))}<input id="themeTitleColor" type="color"></label>
              <label>${escapeHtml(t("page.appearance.site_name_size"))}<input id="themeTitleSize" type="range" min="16" max="52" step="1"><span></span></label>
              <label>${escapeHtml(t("page.appearance.site_name_shadow"))}<input id="themeTitleShadowBlur" type="range" min="0" max="30" step="1"><span></span></label>
              <label>${escapeHtml(t("page.appearance.slogan_color"))}<input id="themeSubtitleColor" type="color"></label>
              <label>${escapeHtml(t("page.appearance.slogan_size"))}<input id="themeSubtitleSize" type="range" min="11" max="28" step="1"><span></span></label>
              <label>${escapeHtml(t("page.appearance.slogan_shadow"))}<input id="themeSubtitleShadowBlur" type="range" min="0" max="30" step="1"><span></span></label>
              <label>${escapeHtml(t("page.appearance.logo_size"))}<input id="themeLogoSize" type="range" min="32" max="260" step="2"><span></span></label>
              <label><span class="field-title">${escapeHtml(t("page.appearance.page_title_color"))} ${infoTip(t("page.appearance.page_title_color_tip"))}</span><input id="themePageTitleColor" type="color"></label>
              <label>${escapeHtml(t("page.appearance.page_title_size"))}<input id="themePageTitleSize" type="range" min="16" max="52" step="1"><span></span></label>
              <label>${escapeHtml(t("page.appearance.page_title_shadow"))}<input id="themePageTitleShadowBlur" type="range" min="0" max="30" step="1"><span></span></label>
              <label><span class="field-title">${escapeHtml(t("page.appearance.section_title_color"))} ${infoTip(t("page.appearance.section_title_color_tip"))}</span><input id="themeSectionTitleColor" type="color"></label>
              <label>${escapeHtml(t("page.appearance.section_title_size"))}<input id="themeSectionTitleSize" type="range" min="10" max="28" step="1"><span></span></label>
              <label>${escapeHtml(t("page.appearance.section_title_shadow"))}<input id="themeSectionTitleShadowBlur" type="range" min="0" max="30" step="1"><span></span></label>
            </div>
          </section>

          <!-- 3. Sidebar / Pasek boczny -->
          <section class="appearance-section">
            <div class="appearance-section-title">${uiIcon("tabs", 16)} ${escapeHtml(t("page.appearance.group_sidebar"))}</div>
            <div class="appearance-section-grid">
              <label>${escapeHtml(t("page.appearance.sidebar_bg"))}<input id="themeSidebarPanelColor" type="color"></label>
              <label>${escapeHtml(t("page.appearance.sidebar_alpha"))}<input id="themeSidebarPanelAlpha" type="range" min="0" max="95" step="1"><span></span></label>
              <label>${escapeHtml(t("page.appearance.sidebar_width"))}<input id="themeSidebarWidth" type="range" min="240" max="360" step="5"><span></span></label>
              <label><span class="field-title">${escapeHtml(t("page.appearance.sidebar_icon_color"))} ${infoTip(t("page.appearance.sidebar_icon_color_tip"))}</span><input id="themeSidebarToggleColor" type="color"></label>
              <label><span class="field-title">${escapeHtml(t("page.appearance.sidebar_icon_size"))} ${infoTip(t("page.appearance.sidebar_icon_size_tip"))}</span><input id="themeSidebarToggleSize" type="range" min="16" max="44" step="1"><span></span></label>
              <label>${escapeHtml(t("page.appearance.font_menu"))}<select id="themeFontMenu">${renderFontOptions()}</select></label>
              <label><span class="field-title">${escapeHtml(t("page.appearance.lolli_glass"))} ${infoTip(t("page.appearance.lolli_glass_tip"))}</span><input id="themeLolliGlass" type="range" min="0" max="95" step="1"><span></span></label>
              <label><span class="field-title">${escapeHtml(t("page.appearance.lolli_blur"))} ${infoTip(t("page.appearance.lolli_blur_tip"))}</span><input id="themeLolliBlur" type="range" min="0" max="30" step="1"><span></span></label>
              <label><span class="field-title">${escapeHtml(t("page.appearance.lolli_text"))} ${infoTip(t("page.appearance.lolli_text_tip"))}</span><input id="themeLolliTextColor" type="color"></label>
              <label><span class="field-title">${escapeHtml(t("page.appearance.lolli_hover"))} ${infoTip(t("page.appearance.lolli_hover_tip"))}</span><input id="themeLolliHoverColor" type="color"></label>
              <label><span class="field-title">${escapeHtml(t("page.appearance.lolli_active_bg"))} ${infoTip(t("page.appearance.lolli_active_bg_tip"))}</span><input id="themeLolliActiveBg" type="color"></label>
              <label><span class="field-title">${escapeHtml(t("page.appearance.lolli_active_icon"))} ${infoTip(t("page.appearance.lolli_active_icon_tip"))}</span><input id="themeLolliActiveIcon" type="color"></label>
            </div>
          </section>

          <!-- 4. Kafelki i Strona -->
          <section class="appearance-section">
            <div class="appearance-section-title">${uiIcon("page", 16)} ${escapeHtml(t("page.appearance.group_tiles"))}</div>
            <div class="appearance-section-grid">
              <label>${escapeHtml(t("page.appearance.tile_color"))}<input id="themePanelColor" type="color"></label>
              <label>${escapeHtml(t("page.appearance.tile_glass"))}<input id="themePanelAlpha" type="range" min="5" max="85" step="1"><span></span></label>
              <label>${escapeHtml(t("page.appearance.tile_height"))}<input id="themeTileHeight" type="range" min="108" max="180" step="2"><span></span></label>
              <label>${escapeHtml(t("page.appearance.card_color"))}<input id="themeAdminPanelColor" type="color"></label>
              <label>${escapeHtml(t("page.appearance.card_alpha"))}<input id="themeAdminPanelAlpha" type="range" min="5" max="90" step="1"><span></span></label>
              <label>${escapeHtml(t("page.appearance.card_border"))}<input id="themeBorderAlpha" type="range" min="0" max="35" step="1"><span></span></label>
              <label>${escapeHtml(t("page.appearance.card_radius"))}<input id="themeCardRadius" type="range" min="8" max="34" step="1"><span></span></label>
              <label>${escapeHtml(t("page.appearance.card_gap"))}<input id="themeCardGap" type="range" min="8" max="28" step="1"><span></span></label>
              <label>${escapeHtml(t("page.appearance.glass_blur"))}<input id="themeGlassBlur" type="range" min="0" max="60" step="1"><span></span></label>
              <label>${escapeHtml(t("page.appearance.glass_saturation"))}<input id="themeGlassSaturation" type="range" min="60" max="260" step="1"><span></span></label>
              <label>${escapeHtml(t("page.appearance.font_card"))}<select id="themeFontCard">${renderFontOptions()}</select></label>
              <label>${escapeHtml(t("page.appearance.font_description"))}<select id="themeFontDescription">${renderFontOptions()}</select></label>
            </div>
          </section>

          <!-- 5. Okna modalne (Modale) -->
          <section class="appearance-section">
            <div class="appearance-section-title">${uiIcon("window", 16)} ${escapeHtml(t("page.appearance.group_modals"))}</div>
            <div class="appearance-section-grid">
              <label>${escapeHtml(t("page.appearance.modal_color"))}<input id="themeModalBg" type="color"></label>
              <label>${escapeHtml(t("page.appearance.modal_alpha"))}<input id="themeModalAlpha" type="range" min="10" max="100" step="1"><span></span></label>
              <label>${escapeHtml(t("page.appearance.modal_blur"))}<input id="themeModalGlassBlur" type="range" min="0" max="60" step="1"><span></span></label>
              <label>${escapeHtml(t("page.appearance.modal_radius"))}<input id="themeModalRadius" type="range" min="8" max="36" step="1"><span></span></label>
              <label>${escapeHtml(t("page.appearance.modal_backdrop"))}<input id="themeModalBackdropAlpha" type="range" min="0" max="95" step="1"><span></span></label>
              <label>${escapeHtml(t("page.appearance.modal_backdrop_blur"))}<input id="themeModalBackdropBlur" type="range" min="0" max="25" step="1"><span></span></label>
            </div>
          </section>
        </div>
        <menu><button id="resetAppearance" type="button">${escapeHtml(t("page.appearance.reset"))}</button><button type="button" data-close>${escapeHtml(t("page.appearance.cancel"))}</button><button class="primary">${escapeHtml(t("page.appearance.save"))}</button></menu>
      </form>
    </dialog>
    <dialog id="alertsQuickModal" class="wide-dialog">
      <div class="modal-panel">
        <header class="modal-heading">
          <div><span class="eyebrow">${escapeHtml(t("page.alerts_preview.eyebrow"))}</span><h2>${uiIcon("alerts", 22)} ${escapeHtml(t("page.alerts_preview.title"))}</h2></div>
          <button type="button" data-close aria-label="${escapeHtml(t("page.alerts_preview.close"))}">×</button>
        </header>
        <div id="quickAlertsContent" style="display: grid; gap: 10px; max-height: 50vh; overflow-y: auto; padding-right: 4px;">
          <div class="empty">${escapeHtml(t("page.alerts_preview.loading_state"))}</div>
        </div>
        <menu>
          <button type="button" data-close>${escapeHtml(t("page.alerts_preview.close"))}</button>
          <button type="button" id="btnQuickRefresh" class="button">${uiIcon("refresh", 16)} ${escapeHtml(t("page.alerts_preview.refresh"))}</button>
          <a href="./mods/admin/?tab=alerts" class="button primary" style="display: inline-flex; align-items: center; text-decoration: none;">${escapeHtml(t("page.alerts_preview.open_center"))}</a>
        </menu>
      </div>
    </dialog>
    <dialog id="sectionAddDialog">
      <div class="modal-panel">
        <header class="modal-heading">
          <div><span class="eyebrow">${escapeHtml(t("page.section_dialog.page_label"))} <span id="sectionAddPage"></span></span><h2>${escapeHtml(t("page.section_dialog.title"))}</h2></div>
          <button type="button" data-close aria-label="${escapeHtml(t("page.section_dialog.close"))}">×</button>
        </header>
        <form id="sectionAddForm" class="inline-form">
          <label>${escapeHtml(t("page.section_dialog.name"))}<input id="sectionAddName" required maxlength="60" placeholder="${escapeHtml(t("page.section_dialog.name_placeholder"))}"></label>
          <button class="primary" type="submit">${escapeHtml(t("page.section_dialog.add"))}</button>
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
      showToast(t("page.messages.bg_read_failed"));
    }
  });
  document.querySelector("#themeEditMode")?.addEventListener("change", async (event) => {
    const mode = event.target.value;
    if (state.appearanceDirty && !(await ifConfirm(t("page.appearance.switch_confirm"), { okLabel: t("page.appearance.switch_ok"), danger: true }))) {
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
  document.querySelector("#sidebarHelpButton")?.addEventListener("click", openInformator);
  document.querySelector("#sidebarIconMode")?.addEventListener("click", () => {
    setMode(currentMode() === "n" ? "d" : "n");
  });
  document.querySelector("#resetAppearance")?.addEventListener("click", resetThemeSettings);
  document.querySelector("#sectionAddForm")?.addEventListener("submit", saveQuickSection);
  document.querySelector("#linkForm")?.addEventListener("submit", saveLink);
  document.querySelector("#sidebarIconAlerts")?.addEventListener("click", openQuickAlertsModal);
  document.querySelector("#btnQuickRefresh")?.addEventListener("click", renderQuickAlertsContent);
  document.querySelector("#systemStatsWidget")?.addEventListener("click", () => {
    // Bez modala: kliknięcie widżetu przenosi na Status serwera, do panelu procesów (Top).
    state.view = "status";
    render();
    document.querySelector("#topPageMount")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    if (lock) lock.innerHTML = getStoredAdminPin() ? `${uiIcon("lock", 18)} <span>${escapeHtml(t("page.sidebar.menu_lock"))}</span>` : `${uiIcon("unlock", 18)} <span>${escapeHtml(t("page.sidebar.menu_unlock"))}</span>`;
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
        showToast(t("page.messages.locked"));
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
        // Kopia albo przywracanie zlecone w Zapleczu — pasek od razu.
        if (event.data?.type === "backup_started") refreshBackupBar(true);
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
  // „top”, „alerts” i „tools” to dawne zakładki (do 0.3.5) — zapamiętane w przeglądarce prowadzą na Status serwera.
  if (["admin", "status", "top", "alerts", "tools"].includes(state.view)) renderServerStatus();
  else renderLinks();
  syncSystemStatsPolling();
}

// Stałe strony serwera — pod kreską w menu. Procesy (Top) są w Statusie serwera, alerty — w dzwonku,
// tester portów — w Zapleczu → Moduły (Darek 9.11.2026: zakładki Top, Alerty i Narzędzia usunięte).
const SERVER_VIEWS = [
  { view: "status", label: t("page.sidebar.nav_server_status"), icon: "status" }
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
  if (!name) return showToast(t("page.messages.section_name_required"));
  try {
    await request(`${dashboardConfig.apiUrl}/api/services/section`, {
      method: "POST",
      body: JSON.stringify({ name, pageId: state.activePageId })
    });
    document.querySelector("#sectionAddDialog").close();
    await reloadData();
    render();
    showToast(t("page.messages.section_added", { name }));
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
    <input id="search" type="search" value="${escapeHtml(state.query)}" placeholder="${escapeHtml(t("page.header.search_placeholder"))}">
  `;
  document.querySelector("#content").innerHTML = `
    <div class="page-sections" id="pageSections"></div>
    <div class="content-actions">
      <div class="content-menu-wrap">
        <div class="sidebar-menu content-menu" id="contentMenu" role="menu" hidden>
          ${sections.length ? `<button type="button" role="menuitem" data-content-action="link">${uiIcon("plus", 18)} ${escapeHtml(t("page.links.menu_add_link"))}</button>` : ""}
          <button type="button" role="menuitem" data-content-action="section">${uiIcon("plus", 18)} ${escapeHtml(t("page.links.menu_add_section"))}</button>
          <div class="sidebar-menu-sep" role="separator"></div>
          <a href="./mods/admin/?tab=homepage" role="menuitem" data-content-action="manage">${uiIcon("admin", 18)} ${escapeHtml(t("page.links.menu_manage"))}</a>
        </div>
        <button type="button" class="sidebar-icon-btn content-menu-btn" id="contentMenuButton" title="${escapeHtml(t("page.links.menu_button"))}" aria-label="${escapeHtml(t("page.links.menu_button"))}" aria-haspopup="menu" aria-expanded="false">${uiIcon("settings", 22)}</button>
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
    <div class="card-actions"><button data-edit type="button" aria-label="${escapeHtml(t("page.links.edit_label"))}" title="${escapeHtml(t("page.links.edit_title"))}">${uiIcon("edit", 15)}</button><button data-delete type="button" aria-label="${escapeHtml(t("page.links.delete_label"))}" title="${escapeHtml(t("page.links.delete_title"))}">${uiIcon("trash", 15)}</button></div>
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
    const hint = escapeHtml(t("page.links.empty_hint")).replace("{button}", `<strong>${escapeHtml(t("page.links.empty_button"))}</strong>`);
    target.innerHTML = `<div class="empty"><p style="margin:0">${escapeHtml(t("page.links.empty_page"))}<br>${hint}</p></div>`;
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
    if (!links.length) grid.innerHTML = `<div class="empty empty-small">${escapeHtml(t("page.links.empty_section"))}</div>`;
    shown += links.length;
    target.appendChild(block);
  });
  if (query && !shown) target.innerHTML = `<div class="empty">${escapeHtml(t("page.links.no_results"))}</div>`;
}

function openLink(link) {
  if (link.openMode === "iframe") {
    state.view = "iframe";
    document.querySelector("#content").innerHTML = `
      <div class="frame-panel">
        <div>
          <strong>${escapeHtml(link.name)}</strong>
          <button id="closeFrame" type="button">${escapeHtml(t("page.links.frame_close"))}</button>
          <a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(t("page.links.frame_open_tab"))} ${uiIcon("external", 14)}</a>
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
  document.querySelector("#linkDialogTitle").textContent = t(link ? "page.link_dialog.title_edit" : "page.link_dialog.title_new");
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
    showToast(isEditing ? t("page.messages.link_updated") : t("page.messages.link_added"));
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteLink(link) {
  if (!(await ifConfirm(t("page.links.delete_confirm", { name: link.name }), { okLabel: t("page.links.delete_ok"), danger: true }))) return;
  try {
    await request(`${dashboardConfig.apiUrl}/api/services/link/${link.id}`, { method: "DELETE" });
    await reloadData();
    render();
    showToast(t("page.messages.link_deleted"));
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
    showToast(t("page.messages.unlocked"));
    if (state.pendingAdminPanel === "appearance") openAppearancePanel();
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
    showToast(t("page.messages.wrong_pin"));
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
  if (settings.defaultHost) dashboardConfig.defaultHost = settings.defaultHost;
  if (settings.logo) dashboardConfig.logo = settings.logo;
  // Moduł „Tłumacz” włączony → ikonka tłumacza (Lucide „languages”) na pasku (otwiera kartę w Zapleczu, z PIN-em).
  dashboardConfig.translatorEnabled = settings.translatorEnabled === true;
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
    showToast(t("page.messages.bg_choose"));
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
    showToast(mode === "d" ? t("page.messages.saved_day") : t("page.messages.saved_night"));
  } catch (error) {
    showToast(error.message);
  }
}

async function resetThemeSettings() {
  const mode = document.querySelector("#themeEditMode")?.value === "d" ? "d" : "n";
  if (!(await ifConfirm(t(mode === "d" ? "page.appearance.reset_confirm_day" : "page.appearance.reset_confirm_night"), { okLabel: t("page.appearance.reset_ok"), danger: true }))) return;
  try {
    await request(`${dashboardConfig.apiUrl}/api/dashboard/custom-css`, {
      method: "PUT",
      body: JSON.stringify({ mode, reset: true })
    });
    if (mode === "n") state.legacyTheme = null;
    reloadModeCss(mode);
    document.querySelector("#appearanceDialog").close();
    showToast(mode === "d" ? t("page.messages.reset_day") : t("page.messages.reset_night"));
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
  document.querySelector("#viewTitle").textContent = t("page.header.title_server_status");
  document.querySelector("#toolbarActions").innerHTML = `
    <button type="button" class="primary" id="btnRefreshServerStatus">${escapeHtml(t("page.header.refresh"))}</button>
  `;
  document.querySelector("#content").innerHTML = `
    <section class="admin-card system-stats-card">
      <div class="panel-heading">
        <div><span class="eyebrow">${escapeHtml(t("page.server_status.eyebrow_stats"))}</span><h2>${escapeHtml(t("page.server_status.stats_title"))}</h2></div>
        <div class="panel-heading-actions"><span id="systemStatsUpdated">${escapeHtml(t("page.server_status.waiting"))}</span></div>
      </div>
      <div class="cockpit-stats" id="systemStats"><div class="empty">${escapeHtml(t("page.server_status.loading"))}</div></div>
    </section>
    <section class="admin-card status-updates-card">
      <div class="panel-heading"><div><span class="eyebrow">${escapeHtml(t("page.server_status.updates_eyebrow"))}</span><h2>${escapeHtml(t("page.server_status.updates_title"))}</h2></div></div>
      <div class="status-updates" id="statusUpdates"><div class="empty">${escapeHtml(t("page.server_status.checking"))}</div></div>
    </section>
    <section class="admin-card status-top-card"><div id="topPageMount"></div></section>
  `;
  loadSystemStats();
  loadStatusUpdates();
  // Procesy (Top) — dawna zakładka Top, z tym samym działaniem.
  statusTopController = TopDiagnostics.mount(document.querySelector("#topPageMount"));
  statusTopController.start();
  document.querySelector("#btnRefreshServerStatus")?.addEventListener("click", () => {
    loadSystemStats();
    loadStatusUpdates();
    statusTopController?.refresh();
  });
}

// Kafle aktualizacji w Statusie serwera — tylko informacja i odnośnik do miejsca, gdzie się
// aktualizuje (Darek 9.11.2026). Aktualizowanie aplikacji: Zaplecze → Aplikacje → Aktualizacje.
function statusUpdateTile(icon, title, level, text, link) {
  return `
    <article class="status-update-tile is-${level}">
      <header>${uiIcon(icon, 20)}<h3>${escapeHtml(title)}</h3></header>
      <p>${text}</p>
      ${link}
    </article>`;
}

async function loadStatusUpdates() {
  const box = document.querySelector("#statusUpdates");
  if (!box) return;
  const api = dashboardConfig.apiUrl;
  const [os, server, apps] = await Promise.allSettled([
    request(`${api}/api/system/updates`),
    request(`${api}/api/system/if-server`),
    request(`${api}/api/docker/versions`)
  ]);
  if (!document.querySelector("#statusUpdates")) return;
  const host = dashboardConfig.defaultHost || window.location.hostname;

  // Debian (pakiety systemowe) — instalacja w Cockpit.
  let osTile;
  const cockpit = `<a class="status-update-link" href="https://${escapeHtml(host)}:9090" target="_blank" rel="noopener">${escapeHtml(t("page.server_status.open_cockpit"))} ${uiIcon("external", 13)}</a>`;
  if (os.status !== "fulfilled" || !os.value.available) {
    osTile = statusUpdateTile("terminal", "Debian", "info", escapeHtml(t("page.server_status.debian_unavailable")), cockpit);
  } else {
    const n = (os.value.packages || []).length;
    const sec = os.value.securityCount || 0;
    const stale = os.value.stale ? ` ${t("page.server_status.debian_stale")}` : "";
    osTile = n
      ? statusUpdateTile("terminal", "Debian", "warn", escapeHtml((sec ? tn("page.server_status.debian_packages_security", n, { security: sec }) : tn("page.server_status.debian_packages", n)) + stale), cockpit)
      : statusUpdateTile("terminal", "Debian", "ok", escapeHtml(t("page.server_status.debian_ok") + stale), cockpit);
  }

  // Program serwera — aktualizuje się w terminalu: sudo if-server → aktualizuj.
  let serverTile;
  const s = server.status === "fulfilled" ? server.value : {};
  if (!s.installed || !s.latest) {
    serverTile = statusUpdateTile("monitor", "IF-home-server", "info", escapeHtml(t(s.latest ? "page.server_status.server_info_latest" : "page.server_status.server_info", { installed: s.installed || t("page.server_status.server_unknown"), latest: s.latest })), "");
  } else if (s.upToDate) {
    serverTile = statusUpdateTile("monitor", "IF-home-server", "ok", escapeHtml(t("page.server_status.server_ok", { version: s.installed })), "");
  } else {
    serverTile = statusUpdateTile("monitor", "IF-home-server", "warn", escapeHtml(t("page.server_status.server_newer", { latest: s.latest, installed: s.installed })),
      `<span class="status-update-link is-hint">${escapeHtml(t("page.server_status.server_hint")).replace("{command}", "<code>sudo if-server</code>")}</span>`);
  }

  // Aplikacje (kontenery) — aktualizowanie w Zapleczu.
  let appsTile;
  const appsLink = `<a class="status-update-link" href="./mods/admin/?tab=apps">${escapeHtml(t("page.server_status.apps_link"))}</a>`;
  if (apps.status !== "fulfilled") {
    appsTile = statusUpdateTile("container", t("page.server_status.apps_title"), "info", escapeHtml(t("page.server_status.apps_failed")), appsLink);
  } else {
    const list = (apps.value.versions || []).filter((v) => !v.local);
    const patch = list.filter((v) => v.latestPatch).length;
    const major = list.filter((v) => v.latestMajor).length;
    const parts = [];
    if (patch) parts.push(tn("page.server_status.apps_patch", patch));
    if (major) parts.push(tn("page.server_status.apps_major", major));
    appsTile = parts.length
      ? statusUpdateTile("container", t("page.server_status.apps_title"), "warn", escapeHtml(t("page.server_status.apps_newer", { list: parts.join(", ") })), appsLink)
      : statusUpdateTile("container", t("page.server_status.apps_title"), "ok", escapeHtml(t("page.server_status.apps_ok", { n: list.length })), appsLink);
  }

  box.innerHTML = osTile + serverTile + appsTile;
}

// ─── Pasek postępu kopii na górze strony (jak pasek alarmów) ─────────────────
let backupBarTimer = null;
let backupBarWasRunning = false;

async function refreshBackupBar(soon = false) {
  clearTimeout(backupBarTimer);
  const bar = document.querySelector("#headerBackup");
  let running = soon;
  try {
    const s = await request(`${dashboardConfig.apiUrl}/api/tools/backup/status`);
    running = s.state === "trwa";
    if (bar) {
      if (running) {
        bar.innerHTML = `
          <div class="incident-bar backup">
            <span class="incident-bar-icon">${uiIcon("save", 22)}</span>
            <span class="incident-bar-text">
              <strong>${escapeHtml(t(s.kind === "przywracanie" ? "page.header.restore_running" : "page.header.backup_running", { percent: s.percent }))}</strong>
              <span>${escapeHtml(backupStepText(s, "page.header"))}</span>
              <span class="backup-progress"><span style="width:${s.percent}%"></span></span>
            </span>
          </div>`;
        bar.style.display = "flex";
      } else {
        bar.innerHTML = "";
        bar.style.display = "none";
      }
    }
    // Koniec kopii — komunikat i odświeżenie kafelka.
    if (backupBarWasRunning && !running) backupResultDialog(s);
  } catch {}
  backupBarWasRunning = running;
  backupBarTimer = setTimeout(() => refreshBackupBar(), running ? 3000 : 60000);
}

function renderAdmin() {
  renderServerStatus();
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
        const names = visible.map((a) => a.type === "temperature"
          ? `${serverSensorName(a.sensor, a.resource, "page.header")} (${a.vars?.temp != null ? IF_FORMAT.temp(a.vars.temp) : a.message.split(" — ")[0]})`
          : (a.resource || a.title));
        headerAlert.innerHTML = `
          <div class="incident-bar ${isCritical ? "critical" : "warning"}">
            <span class="incident-bar-icon">${uiIcon(isCritical ? "siren" : "warning", 24)}</span>
            <span class="incident-bar-text">
              <strong>${escapeHtml(t(isCritical ? "page.header.alert_critical" : "page.header.alert_warning"))}</strong>
              <span>${escapeHtml(names.join(", "))}</span>
            </span>
            <a href="./mods/admin/?tab=alerts" class="incident-bar-btn" title="${escapeHtml(t("page.header.alert_details_title"))}">${escapeHtml(t("page.header.alert_details"))}</a>
            <span class="incident-bar-spacer"></span>
            <button type="button" class="incident-bar-close" id="headerAlertClose" title="${escapeHtml(t("page.header.alert_close_title"))}" aria-label="${escapeHtml(t("page.header.alert_close_label"))}">${uiIcon("close", 18)}</button>
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
  container.innerHTML = `<div class="empty">${escapeHtml(t("page.alerts_preview.loading"))}</div>`;
  try {
    const data = await request(`${dashboardConfig.apiUrl}/api/alerts/summary`);
    state.alertsData = data;
    const alerts = data.alerts || [];
    if (alerts.length === 0) {
      container.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 24px; text-align:center; background: rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.25); border-radius:14px;">
          <span style="margin-bottom:8px; color:#34d399;">${uiIcon("ok", 34)}</span>
          <strong style="color:#34d399; font-size:15px;">${escapeHtml(t("page.alerts_preview.all_ok"))}</strong>
          <span style="color:var(--muted); font-size:12px; margin-top:4px;">${escapeHtml(t("page.alerts_preview.no_failures"))}</span>
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
            <strong>${escapeHtml(serverAlertText(a, "page.alerts_preview").title)}</strong>
            <span>${escapeHtml(serverAlertText(a, "page.alerts_preview").message)}</span>
          </span>
          <span class="incident-bar-tag">${escapeHtml(t(isCritical ? "page.alerts_preview.tag_critical" : isInfo ? "page.alerts_preview.tag_info" : "page.alerts_preview.tag_warning"))}</span>
        </div>
      `;
    }).join("");
  } catch (err) {
    container.innerHTML = `<div class="empty" style="color:var(--danger);">${escapeHtml(t("page.alerts_preview.error", { message: err.message }))}</div>`;
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
      ? t("page.server_status.updated", { time: IF_FORMAT.time(updated) })
      : t("page.server_status.connected");
    widget.title = updated && !Number.isNaN(updated.getTime())
      ? t("page.header.stats_updated", { time: IF_FORMAT.time(updated) })
      : t("page.header.stats_connected");
    if (container) container.innerHTML = renderSystemStats(data);
    if (updatedLabel) updatedLabel.textContent = updatedText;
  } catch (error) {
    widget.dataset.status = "error";
    widget.title = error.message;
    widget.innerHTML = `
      <div class="header-stat is-error"><span>${escapeHtml(t("page.header.cpu"))}</span><strong>--</strong></div>
      <div class="header-stat is-error"><span>${escapeHtml(t("page.header.ram"))}</span><strong>--</strong></div>
    `;
    if (container) container.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
    if (updatedLabel) updatedLabel.textContent = t("page.server_status.no_data");
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
    <div class="header-stat${level(cpuUsage, data.thresholds?.cpu)}"><span>${escapeHtml(t("page.header.cpu"))}</span><strong>${percentLabel(cpuUsage)}</strong></div>
    <div class="header-stat${level(memoryPercent, data.thresholds?.ram)}"><span>${escapeHtml(t("page.header.ram"))}</span><strong>${percentLabel(memoryPercent)}</strong></div>
  `;
}

function renderSystemStats(data) {
  const cpuUsage = data.cpu?.usage == null ? 0 : Number(data.cpu.usage);
  const memoryPercent = data.memory?.percent == null ? 0 : Number(data.memory.percent);
  const swapPercent = data.swap?.percent == null ? 0 : Number(data.swap.percent);
  const disks = Array.isArray(data.disks) ? data.disks.slice(0, 5) : [];

  return `
    <article class="cockpit-stat-card">
      <header><h3>${escapeHtml(t("page.server_status.cpu_title"))}</h3><strong>${IF_FORMAT.temp(data.cpu?.temperature)}</strong></header>
      <div class="stat-line"><strong>${data.cpu?.count == null ? "—" : escapeHtml(tn("page.server_status.cpu_count", data.cpu.count))}</strong><span>${escapeHtml(t("page.server_status.cpu_usage", { value: percentLabel(cpuUsage) }))}</span></div>
      ${renderProgress(cpuUsage)}
      <p><strong>${escapeHtml(t("page.server_status.load"))}</strong> ${escapeHtml(t("page.server_status.load_values", { m1: numberLabel(data.cpu?.load1), m5: numberLabel(data.cpu?.load5), m15: numberLabel(data.cpu?.load15) }))}</p>
    </article>
    <article class="cockpit-stat-card">
      <header><h3>${escapeHtml(t("page.server_status.memory_title"))}</h3></header>
      <div class="stat-line"><strong>${escapeHtml(t("page.server_status.ram"))}</strong><span>${escapeHtml(t("page.server_status.available", { size: bytesLabel(data.memory?.available) }))}</span></div>
      ${renderProgress(memoryPercent)}
      <div class="stat-line"><strong>${escapeHtml(t("page.server_status.swap"))}</strong><span>${escapeHtml(t("page.server_status.available", { size: bytesLabel(data.swap?.available) }))}</span></div>
      ${renderProgress(swapPercent)}
    </article>
    <article class="cockpit-stat-card">
      <header><h3>${escapeHtml(t("page.server_status.disks_title"))}</h3></header>
      ${disks.length ? disks.map((disk) => `
        <div class="disk-row">
          <div class="stat-line"><strong>${escapeHtml(serverMountName(disk, "page.server_status"))}</strong><span>${escapeHtml(t("page.server_status.free", { size: bytesLabel(disk.available) }))}</span></div>
          ${renderProgress(disk.percent)}
        </div>
      `).join("") : `<div class="empty">${escapeHtml(t("page.server_status.no_disks"))}</div>`}
    </article>
  `;
}

function renderProgress(value) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return `<div class="stat-progress"><span style="width: ${safeValue}%"></span></div>`;
}

function numberLabel(value) {
  return IF_FORMAT.number(value, 2);
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
  return `${IF_FORMAT.number(size, size >= 10 || unit < 2 ? 0 : 1)} ${units[unit]}`;
}

function percentLabel(value) {
  return value == null ? "—" : `${Math.round(Number(value))}%`;
}

function syncSystemStatsPolling() {
  const shouldPoll = document.visibilityState === "visible";
  if (shouldPoll && !state.systemStatsTimer) {
    loadSystemStats();
    loadAlertsSummary();
    refreshBackupBar();
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
    initIdleLock((minutes) => showToast(t("page.messages.auto_logout", { minutes })));
  } catch (error) {
    document.querySelector("#app").innerHTML = `
      <div class="startup-error">
        <strong>${escapeHtml(t("page.messages.startup_failed"))}</strong>
        <span>${escapeHtml(error.message)}</span>
      </div>
    `;
  }
}

init();

// ─── Informator: skrócona obsługa — najważniejsze rzeczy, gdzie co jest (Darek 9.11.2026) ───
function openInformator() {
  const host = escapeHtml(dashboardConfig.defaultHost || window.location.hostname);
  const T = (key) => escapeHtml(t(`page.informator.${key}`));
  const admin = (tab, key) => `<a href="./mods/admin/?tab=${tab}"><strong>${T(`${key}_name`)}</strong></a> ${T(`${key}_text`)}`;
  const apps = T("apps_text")
    .replace("{updates}", `<em>${T("apps_updates")}</em>`)
    .replace("{installer}", `<em>${T("apps_installer")}</em>`);
  const dialog = document.createElement("dialog");
  dialog.className = "if-confirm informator";
  dialog.innerHTML = `
    <div class="modal-panel">
      <header class="modal-heading"><div><h2>${uiIcon("help", 22)} ${T("title")}</h2></div>
        <button type="button" data-close aria-label="${T("close")}">×</button></header>
      <div class="informator-body">
        <h3>${T("h_home")}</h3>
        <ul>
          <li><strong>${T("menu_name")}</strong> ${T("menu_text")}</li>
          <li><strong>${T("pages_name")}</strong> ${T("pages_text")}</li>
          <li><a href="#" data-informator-status><strong>${T("status_name")}</strong></a> ${T("status_text")}</li>
          <li><strong>${T("bell_name")}</strong> ${T("bell_text")}</li>
          <li><strong>${T("mode_name")}</strong> ${T("mode_text")}</li>
        </ul>
        <h3>${T("h_admin")}</h3>
        <ul>
          <li><a href="./mods/admin/?tab=apps"><strong>${T("apps_name")}</strong></a> ${apps}</li>
          <li>${admin("backup", "backup")}</li>
          <li>${admin("alerts", "alerts")}</li>
          <li>${admin("homepage", "homepage")}</li>
          <li>${admin("modules", "modules")}</li>
          <li>${admin("helper", "general")}</li>
        </ul>
        <h3>${T("h_outside")}</h3>
        <ul>
          <li><a href="http://${host}:5001" target="_blank" rel="noopener"><strong>Dockge</strong></a> ${T("dockge_text")}</li>
          <li><a href="https://${host}:9090" target="_blank" rel="noopener"><strong>Cockpit</strong></a> ${T("cockpit_text")}</li>
          <li><strong>${T("terminal_name")}</strong> ${T("terminal_text").replace("{command}", "<code>sudo if-server</code>")}</li>
        </ul>
      </div>
    </div>`;
  dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
  dialog.querySelector("[data-informator-status]").addEventListener("click", (event) => {
    event.preventDefault();
    dialog.close();
    state.view = "status";
    render();
  });
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  document.body.appendChild(dialog);
  dialog.showModal();
}
