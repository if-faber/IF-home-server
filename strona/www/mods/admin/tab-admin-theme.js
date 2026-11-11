// tab-admin-theme.js — Zakładka „Wygląd Zaplecza”: edytor kolorów, czcionek, tła i przycisków
// z podglądem na żywo.
//
// Zasada działania (ważne przy zmianach):
// - Wartości startowe są zdefiniowane TYLKO w admin.css (blok body.admin-body) i styles.css.
// - Formularz czyta aktualne wartości z CSS (albo z zapisanego motywu), więc dotknięcie
//   kontrolki zmienia wyłącznie tę jedną właściwość.
// - Zapisywane są tylko pola zmienione przez użytkownika (oraz wcześniej zapisane).
//   Dzięki temu nowa wersja wyglądu startowego dociera do osób, które jej nie zmieniały.

// kind: color — kolor wprost; rgb — kolor zapisany jako kanały "R G B";
//       alpha — suwak 0–100 → 0–1; px — suwak w pikselach; font — czcionka.
const ADMIN_THEME_FIELDS = [
  // 1. Ogólne
  { key: "accent", id: "adminThemeAccent", cssVar: "--accent", kind: "color" },
  { key: "accentAlt", id: "adminThemeAccentAlt", cssVar: "--accent-alt", kind: "color" },
  { key: "inputText", id: "adminThemeInputText", cssVar: "--input-text", kind: "color" },
  { key: "surfaceColor", id: "adminThemeSurfaceColor", cssVar: "--surface-base-rgb", kind: "rgb" },
  { key: "bg", id: "adminThemeBg", cssVar: "--page-bg", kind: "color" },
  { key: "fontMenu", id: "adminThemeFontMenu", cssVar: "--font-menu", kind: "font" },
  { key: "fontCard", id: "adminThemeFontCard", cssVar: "--font-card", kind: "font" },
  { key: "fontDescription", id: "adminThemeFontDescription", cssVar: "--font-description", kind: "font" },
  { key: "cardRadius", id: "adminThemeCardRadius", cssVar: "--card-radius", kind: "px" },
  { key: "cardGap", id: "adminThemeCardGap", cssVar: "--card-gap", kind: "px" },
  { key: "panelColor", id: "adminThemePanelColor", cssVar: "--admin-panel-rgb", kind: "rgb" },
  { key: "panelAlpha", id: "adminThemePanelAlpha", cssVar: "--admin-panel-alpha", kind: "alpha" },
  { key: "glassBlur", id: "adminThemeGlassBlur", cssVar: "--glass-blur", kind: "px" },
  // 2. Pasek boczny
  { key: "sidebarColor", id: "adminSidebarColor", cssVar: "--admin-sidebar-rgb", kind: "rgb" },
  { key: "sidebarAlpha", id: "adminSidebarAlpha", cssVar: "--admin-sidebar-alpha", kind: "alpha" },
  { key: "menuTextColor", id: "adminMenuTextColor", cssVar: "--admin-menu-text-color", kind: "color" },
  { key: "sidebarWidth", id: "adminSidebarWidth", cssVar: "--admin-sidebar-width", kind: "px" },
  { key: "menuBtnBg", id: "adminMenuBtnBg", cssVar: "--admin-menu-btn-bg", kind: "color" },
  { key: "menuBtnText", id: "adminMenuBtnText", cssVar: "--admin-menu-btn-text", kind: "color" },
  { key: "menuBtnActiveBg", id: "adminMenuBtnActiveBg", cssVar: "--admin-menu-btn-active-bg", kind: "color" },
  { key: "menuBtnActiveText", id: "adminMenuBtnActiveText", cssVar: "--admin-menu-btn-active-text", kind: "color" },
  { key: "menuBtnHoverBg", id: "adminMenuBtnHoverBg", cssVar: "--admin-menu-btn-hover-bg", kind: "color" },
  { key: "menuBtnHoverText", id: "adminMenuBtnHoverText", cssVar: "--admin-menu-btn-hover-text", kind: "color" },
  // 3. Przyciski akcji
  { key: "btnRadius", id: "adminBtnRadius", cssVar: "--btn-radius", kind: "px" },
  { key: "btnBorderWidth", id: "adminBtnBorderWidth", cssVar: "--btn-border-width", kind: "px" },
  { key: "btnBorderColor", id: "adminBtnBorderColor", cssVar: "--btn-border-color", kind: "color" },
  { key: "btnGlow", id: "adminBtnGlow", cssVar: "--btn-glow", kind: "px" },
  { key: "btnGlowColor", id: "adminBtnGlowColor", cssVar: "--btn-glow-color", kind: "color" },
  { key: "btnDangerGlowColor", id: "adminBtnDangerGlowColor", cssVar: "--btn-danger-glow-color", kind: "color" },
  { key: "btnNormalBg", id: "adminBtnNormalBg", cssVar: "--btn-normal-bg", kind: "color" },
  { key: "btnNormalText", id: "adminBtnNormalText", cssVar: "--btn-normal-text", kind: "color" },
  { key: "btnNormalHoverBg", id: "adminBtnNormalHoverBg", cssVar: "--btn-normal-hover-bg", kind: "color" },
  { key: "btnNormalHoverText", id: "adminBtnNormalHoverText", cssVar: "--btn-normal-hover-text", kind: "color" },
  { key: "btnDangerBg", id: "adminBtnDangerBg", cssVar: "--btn-danger-bg", kind: "color" },
  { key: "btnDangerText", id: "adminBtnDangerText", cssVar: "--btn-danger-text", kind: "color" },
  { key: "btnDangerHoverBg", id: "adminBtnDangerHoverBg", cssVar: "--btn-danger-hover-bg", kind: "color" },
  { key: "btnDangerHoverText", id: "adminBtnDangerHoverText", cssVar: "--btn-danger-hover-text", kind: "color" }
];

// Tapeta: pola obsługiwane osobno, bo zależą od siebie nawzajem.
const ADMIN_BACKGROUND_DEFAULTS = { backgroundDim: 34, backgroundBlur: 10, backgroundOpacity: 55 };

// Zmienne ustawiane dodatkowo (pochodne) — potrzebne do pełnego czyszczenia przy resecie.
const ADMIN_DERIVED_VARS = [
  "--accent-soft", "--glow-start", "--glow-end", "--tile-panel-rgb",
  "--background-image", "--background-image-opacity", "--background-image-blur", "--background-image-dim",
  "--modal-bg-rgb", "--modal-alpha", "--modal-glass-blur", "--modal-backdrop-blur", "--modal-backdrop-alpha", "--modal-radius"
];

// Pola zmienione w tej sesji edytora (klucze motywu) i nowy plik tła, jeśli wybrany.
let adminThemeDirty = new Set();
let adminPendingBackground = null;

// ─── Konwersje wartości ─────────────────────────────────────────────────────

function adminThemeRoot() {
  return document.body || document.documentElement;
}

function readCssVar(name) {
  return getComputedStyle(adminThemeRoot()).getPropertyValue(name).trim();
}

function channelsToHex(channels) {
  const parts = String(channels).match(/\d+/g);
  if (!parts || parts.length < 3) return "#000000";
  return "#" + parts.slice(0, 3).map((n) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, "0")).join("");
}

function anyColorToHex(value) {
  const v = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(v)) return "#" + v.slice(1).split("").map((c) => c + c).join("").toLowerCase();
  if (/^rgba?\(/i.test(v)) return channelsToHex(v);
  return null;
}

function fontKeyFromStack(stack) {
  const first = String(stack || "").split(",")[0].replace(/["']/g, "").trim();
  const known = (typeof fontOptions !== "undefined" ? fontOptions : []).map(([value]) => value);
  if (known.includes(first)) return first;
  return known.includes("system") ? "system" : first || "Inter";
}

// Wartość z motywu (zapisana) → wartość pola formularza.
function themeValueToInput(field, value) {
  switch (field.kind) {
    case "color": return anyColorToHex(value) || "#000000";
    case "rgb": return value && String(value).startsWith("#") ? anyColorToHex(value) : channelsToHex(value);
    case "alpha": return Math.round(Number(value) * 100);
    case "px": return parseInt(value, 10) || 0;
    case "font": return value || "system";
    default: return value;
  }
}

// Aktualna wartość z CSS → wartość pola formularza.
function cssValueToInput(field) {
  const raw = readCssVar(field.cssVar);
  switch (field.kind) {
    case "color": return anyColorToHex(raw) || "#000000";
    case "rgb": return channelsToHex(raw);
    case "alpha": return Math.round((Number(raw) || 0) * 100);
    case "px": return parseInt(raw, 10) || 0;
    case "font": return fontKeyFromStack(raw);
    default: return raw;
  }
}

// Wartość pola formularza → wartość zapisywana w motywie.
function inputToThemeValue(field, inputValue) {
  switch (field.kind) {
    case "alpha": return String(Number(inputValue) / 100);
    case "px": return `${Number(inputValue) || 0}px`;
    default: return String(inputValue);
  }
}

// Wartość z motywu → wartość zmiennej CSS.
function themeValueToCss(field, value) {
  switch (field.kind) {
    case "rgb": return hexToRgbChannels(anyColorToHex(value) || "#000000");
    case "font": return fontStack(value);
    case "px": return String(value).endsWith("px") ? String(value) : `${parseInt(value, 10) || 0}px`;
    default: return String(value);
  }
}

function normalizeAdminTheme(theme) {
  let t = theme && typeof theme === "object" ? theme : {};
  if (t.saveTheme?.themeSettings) t = t.saveTheme.themeSettings;
  if (t.themeSettings) t = t.themeSettings;
  if (t.theme && typeof t.theme === "object") t = t.theme;
  return t;
}

// ─── Tryb dzień / noc ────────────────────────────────────────────────────────
// Tryb wspólny ze Stroną Główną (localStorage „ifs.mode”, atrybut data-mode na <html>).
// Wygląd Zaplecza zapisany osobno dla dnia (d) i nocy (n); wygląd startowy obu w admin.css.

function currentAdminMode() {
  return document.documentElement.dataset.mode === "d" ? "d" : "n";
}

// Odpowiedź /api/admin/theme → oba wyglądy w state, nałożony wygląd bieżącego trybu.
function useAdminThemes(data) {
  const themes = data?.themes || { d: {}, n: data?.theme || {} };
  state.adminThemes = { d: themes.d || {}, n: themes.n || {} };
  state.adminTheme = state.adminThemes[currentAdminMode()];
  clearAdminThemeStyles();
  applyAdminThemeStyles(state.adminTheme);
}

// Okna (modale) Zaplecza wyglądają jak na Stronie Głównej: zmienne --modal-* z pliku
// bieżącego trybu (/custom/custom-d.css lub custom-n.css). Reszty wyglądu nie ruszamy.
let pageModalVars = [];
async function applyPageModalStyles() {
  const mode = currentAdminMode();
  try {
    const response = await fetch(`/custom/custom-${mode}.css?v=${Date.now()}`, { cache: "no-store" });
    const css = response.ok ? await response.text() : "";
    if (mode !== currentAdminMode()) return;
    const root = adminThemeRoot();
    pageModalVars.forEach((name) => root.style.removeProperty(name));
    pageModalVars = [];
    for (const [, name, value] of css.matchAll(/(--modal-[a-z-]+)\s*:\s*([^;{}]+);/g)) {
      root.style.setProperty(name, value.trim());
      pageModalVars.push(name);
    }
  } catch {}
}

function renderAdminModeToggle() {
  const button = document.querySelector("#adminModeToggle");
  if (!button || typeof themeToggleIcon !== "function") return;
  const isNight = currentAdminMode() === "n";
  button.innerHTML = themeToggleIcon(isNight);
  button.title = t(isNight ? "admin.sidebar.mode_night_tip" : "admin.sidebar.mode_day_tip");
}

function setAdminMode(mode) {
  const next = mode === "d" ? "d" : "n";
  document.documentElement.dataset.mode = next;
  try { localStorage.setItem("ifs.mode", next); } catch {}
  renderAdminModeToggle();
  if (state.adminThemes) {
    state.adminTheme = state.adminThemes[next] || {};
    clearAdminThemeStyles();
    applyAdminThemeStyles(state.adminTheme);
  }
  // Otwarty edytor wyglądu przechodzi na wygląd wybranego trybu.
  if (document.querySelector("#adminAppearanceForm")) {
    adminThemeDirty = new Set();
    adminPendingBackground = null;
    populateAdminAppearanceForm(state.adminTheme || {});
    const select = document.querySelector("#adminThemeMode");
    if (select) select.value = next;
  }
}

function bindAdminModeToggle() {
  renderAdminModeToggle();
  document.querySelector("#adminModeToggle")?.addEventListener("click", () => {
    setAdminMode(currentAdminMode() === "n" ? "d" : "n");
  });
  // Przełączenie trybu w innej karcie (np. na Stronie Głównej) — Zaplecze idzie za nim.
  window.addEventListener("storage", (event) => {
    if (event.key === "ifs.mode" && event.newValue && event.newValue !== currentAdminMode()) setAdminMode(event.newValue);
  });
}

// ─── Widok ───────────────────────────────────────────────────────────────────

// Napisy karty (plan „Język”, Etap 3): sekcja admin.admin_theme; dymki: admin.messages.
const thT = (key, vars) => escapeHtml(t(`admin.admin_theme.${key}`, vars));

function renderAdminThemeTab() {
  const box = 'class="preset-manager-box" style="margin-top: 10px; padding: 18px; border: 1px solid var(--line); border-radius: 14px; background: rgba(255, 255, 255, 0.02);"';
  return `
    <div class="admin-tab-container">
      <section class="admin-section-card">
        <h2 style="margin: 0 0 8px;">${uiIcon("appearance", 22)} ${thT("title")}</h2>
        <p class="settings-note">${thT("intro")}</p>
        <label class="appearance-mode-bar" style="display: grid; gap: 6px; margin: 12px 0 4px; font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--muted);">
          ${thT("mode_label")}
          <select id="adminThemeMode" style="font-size: 15px; font-weight: 700; text-transform: none; color: var(--text);">
            <option value="d">${thT("mode_day")}</option>
            <option value="n">${thT("mode_night")}</option>
          </select>
        </label>
        <p class="settings-note" style="margin-top: 0;">${thT("mode_note")}</p>

        <form id="adminAppearanceForm" class="admin-form-panel">

          <div ${box}>
            <h4 style="margin-top: 0; margin-bottom: 6px; color: var(--accent);">${uiIcon("appearance", 16)} ${thT("group_colors")}</h4>
            <div class="admin-form-grid three-cols">
              <label>${thT("accent")}<input id="adminThemeAccent" type="color"></label>
              <label><span class="field-title">${thT("accent_alt")} ${infoTip(t("admin.admin_theme.accent_alt_tip"))}</span><input id="adminThemeAccentAlt" type="color"></label>
              <label><span class="field-title">${thT("surface")} ${infoTip(t("admin.admin_theme.surface_tip"))}</span><input id="adminThemeSurfaceColor" type="color"></label>
              <label><span class="field-title">${thT("input_text")} ${infoTip(t("admin.admin_theme.input_text_tip"))}</span><input id="adminThemeInputText" type="color"></label>

              <label>${thT("font_menu")}<select id="adminThemeFontMenu">${renderFontOptions()}</select></label>
              <label>${thT("font_card")}<select id="adminThemeFontCard">${renderFontOptions()}</select></label>
              <label>${thT("font_description")}<select id="adminThemeFontDescription">${renderFontOptions()}</select></label>

              <label>${thT("bg")}<input id="adminThemeBg" type="color"></label>
              <label>${thT("card_radius")}<input id="adminThemeCardRadius" type="range" min="0" max="34" step="1"><span></span></label>
              <label>${thT("card_gap")}<input id="adminThemeCardGap" type="range" min="8" max="40" step="1"><span></span></label>

              <label>${thT("panel_color")}<input id="adminThemePanelColor" type="color"></label>
              <label>${thT("panel_alpha")}<input id="adminThemePanelAlpha" type="range" min="5" max="100" step="1"><span></span></label>
              <label>${thT("panel_blur")}<input id="adminThemeGlassBlur" type="range" min="0" max="40" step="1"><span></span></label>
            </div>

            <span style="font-size: 11px; font-weight: bold; display: block; margin: 16px 0 8px; color: var(--accent);">${uiIcon("image", 14)} ${thT("wallpaper")}</span>
            <div class="admin-form-grid three-cols">
              <label>${thT("bg_image")}
                <select id="adminThemeBackgroundImage">
                  <option value="">${thT("bg_off")}</option>
                  <option value="default">${thT("bg_default")}</option>
                  <option value="custom">${thT("bg_custom")}</option>
                </select>
              </label>
              <label>${thT("bg_upload")}<input id="adminThemeBackgroundUpload" type="file" accept="image/png,image/jpeg,image/webp"></label>
              <label>${thT("bg_dim")}<input id="adminThemeBackgroundDim" type="range" min="0" max="85" step="1"><span></span></label>
              <label>${thT("bg_blur")}<input id="adminThemeBackgroundBlur" type="range" min="0" max="40" step="1"><span></span></label>
              <label>${thT("bg_opacity")}<input id="adminThemeBackgroundOpacity" type="range" min="0" max="100" step="1"><span></span></label>
            </div>
          </div>

          <div ${box}>
            <h4 style="margin-top: 0; margin-bottom: 6px; color: var(--accent);">${uiIcon("tabs", 16)} ${thT("group_sidebar")}</h4>
            <div class="admin-form-grid">
              <label>${thT("sidebar_color")}<input id="adminSidebarColor" type="color"></label>
              <label>${thT("sidebar_alpha")}<input id="adminSidebarAlpha" type="range" min="5" max="100" step="1"><span></span></label>
              <label>${thT("menu_text")}<input id="adminMenuTextColor" type="color"></label>
              <label>${thT("sidebar_width")}<input id="adminSidebarWidth" type="range" min="220" max="380" step="5"><span></span></label>
            </div>
            <span style="font-size: 11px; font-weight: bold; display: block; margin: 16px 0 8px; color: var(--accent);">${thT("menu_buttons")}</span>
            <div class="admin-form-grid">
              <label>${thT("btn_bg")}<input id="adminMenuBtnBg" type="color"></label>
              <label>${thT("btn_text")}<input id="adminMenuBtnText" type="color"></label>
              <label>${thT("btn_hover_bg")}<input id="adminMenuBtnHoverBg" type="color"></label>
              <label>${thT("btn_hover_text")}<input id="adminMenuBtnHoverText" type="color"></label>
              <label>${thT("btn_active_bg")}<input id="adminMenuBtnActiveBg" type="color"></label>
              <label>${thT("btn_active_text")}<input id="adminMenuBtnActiveText" type="color"></label>
            </div>
          </div>

          <div ${box}>
            <h4 style="margin-top: 0; margin-bottom: 14px; color: var(--accent);">${uiIcon("button", 16)} ${thT("group_buttons")}</h4>
            <div class="admin-form-grid three-cols" style="margin-bottom: 16px;">
              <label>${thT("btn_radius")}<input id="adminBtnRadius" type="range" min="0" max="30" step="1"><span></span></label>
              <label>${thT("btn_border_width")}<input id="adminBtnBorderWidth" type="range" min="0" max="4" step="1"><span></span></label>
              <label>${thT("btn_border_color")}<input id="adminBtnBorderColor" type="color"></label>
              <label>${thT("btn_glow")}<input id="adminBtnGlow" type="range" min="0" max="30" step="1"><span></span></label>
              <label>${thT("btn_glow_color")}<input id="adminBtnGlowColor" type="color"></label>
              <label>${thT("btn_danger_glow")}<input id="adminBtnDangerGlowColor" type="color"></label>
            </div>

            <div class="admin-form-grid" style="gap: 18px; align-items: start;">
              <div style="padding: 14px; border: 1px solid var(--line); border-radius: 10px; background: rgba(0,0,0,0.12);">
                <h5 style="margin: 0 0 10px 0; font-size: 13px;">${thT("primary_title")}</h5>
                <div style="margin-bottom: 12px; display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
                  <button type="button" class="button primary" tabindex="-1">${uiIcon("save", 16)} ${thT("sample_save")}</button>
                  <button type="button" class="button" tabindex="-1">${thT("sample_normal")}</button>
                </div>
                <div class="admin-form-grid">
                  <label>${thT("btn_bg")}<input id="adminBtnNormalBg" type="color"></label>
                  <label>${thT("btn_text")}<input id="adminBtnNormalText" type="color"></label>
                  <label>${thT("btn_hover_bg")}<input id="adminBtnNormalHoverBg" type="color"></label>
                  <label>${thT("btn_hover_text")}<input id="adminBtnNormalHoverText" type="color"></label>
                </div>
              </div>

              <div style="padding: 14px; border: 1px solid var(--line); border-radius: 10px; background: rgba(0,0,0,0.12);">
                <h5 style="margin: 0 0 10px 0; font-size: 13px;">${thT("danger_title")}</h5>
                <div style="margin-bottom: 12px; display: flex; justify-content: center;">
                  <button type="button" class="button danger" tabindex="-1">${uiIcon("trash", 16)} ${thT("sample_delete")}</button>
                </div>
                <div class="admin-form-grid">
                  <label>${thT("btn_bg")}<input id="adminBtnDangerBg" type="color"></label>
                  <label>${thT("btn_text")}<input id="adminBtnDangerText" type="color"></label>
                  <label>${thT("btn_hover_bg")}<input id="adminBtnDangerHoverBg" type="color"></label>
                  <label>${thT("btn_hover_text")}<input id="adminBtnDangerHoverText" type="color"></label>
                </div>
              </div>
            </div>
          </div>

          <menu style="margin-top: 18px; display: flex; justify-content: flex-end; gap: 12px; flex-wrap: wrap;">
            <button id="resetAdminAppearance" class="button danger" type="button">${thT("reset")}</button>
            <button id="revertAdminAppearance" class="button" type="button">${thT("revert")}</button>
            <button class="button primary" type="submit">${uiIcon("save", 16)} ${thT("save")}</button>
          </menu>
        </form>
      </section>
    </div>
  `;
}

// ─── Formularz ───────────────────────────────────────────────────────────────

function setAdminInput(id, value) {
  const el = document.querySelector(`#${id}`);
  if (!el) return;
  el.value = value;
  if (typeof updateRangeValue === "function") updateRangeValue(el);
}

function populateAdminAppearanceForm(theme) {
  const t = normalizeAdminTheme(theme);

  ADMIN_THEME_FIELDS.forEach((field) => {
    const saved = t[field.key];
    const value = saved != null && saved !== "" ? themeValueToInput(field, saved) : cssValueToInput(field);
    setAdminInput(field.id, value);
  });

  setAdminInput("adminThemeBackgroundImage", ["default", "custom"].includes(t.backgroundImage) ? t.backgroundImage : "");
  setAdminInput("adminThemeBackgroundDim", t.backgroundDim != null ? Math.round(Number(t.backgroundDim) * 100) : ADMIN_BACKGROUND_DEFAULTS.backgroundDim);
  setAdminInput("adminThemeBackgroundBlur", t.backgroundBlur != null ? parseInt(t.backgroundBlur, 10) || 0 : ADMIN_BACKGROUND_DEFAULTS.backgroundBlur);
  setAdminInput("adminThemeBackgroundOpacity", t.backgroundOpacity != null ? Math.round(Number(t.backgroundOpacity) * 100) : ADMIN_BACKGROUND_DEFAULTS.backgroundOpacity);
  const uploadInput = document.querySelector("#adminThemeBackgroundUpload");
  if (uploadInput) uploadInput.value = "";
}

function collectBackgroundFromForm() {
  return {
    backgroundImage: document.querySelector("#adminThemeBackgroundImage")?.value || "",
    backgroundDim: String(Number(document.querySelector("#adminThemeBackgroundDim")?.value ?? 34) / 100),
    backgroundBlur: `${Number(document.querySelector("#adminThemeBackgroundBlur")?.value ?? 10)}px`,
    backgroundOpacity: String(Number(document.querySelector("#adminThemeBackgroundOpacity")?.value ?? 55) / 100)
  };
}

const ADMIN_BACKGROUND_INPUT_IDS = new Set([
  "adminThemeBackgroundImage", "adminThemeBackgroundDim", "adminThemeBackgroundBlur", "adminThemeBackgroundOpacity"
]);

function bindAdminThemeEvents() {
  adminThemeDirty = new Set();
  adminPendingBackground = null;

  const form = document.querySelector("#adminAppearanceForm");
  if (!form) return;

  populateAdminAppearanceForm(state.adminTheme || {});

  const modeSelect = document.querySelector("#adminThemeMode");
  if (modeSelect) {
    modeSelect.value = currentAdminMode();
    modeSelect.addEventListener("change", async (event) => {
      event.stopPropagation();
      if (adminThemeDirty.size && !(await ifConfirm(t("admin.admin_theme.switch_confirm"), { okLabel: t("admin.admin_theme.switch_ok"), danger: true }))) {
        modeSelect.value = currentAdminMode();
        return;
      }
      setAdminMode(modeSelect.value);
    });
  }

  const onEdit = (event) => {
    const input = event.target;
    if (!input?.id) return;
    if (typeof updateRangeValue === "function") updateRangeValue(input);

    const field = ADMIN_THEME_FIELDS.find((item) => item.id === input.id);
    if (field) {
      adminThemeDirty.add(field.key);
      applyAdminThemeField(field, inputToThemeValue(field, input.value));
      return;
    }
    if (ADMIN_BACKGROUND_INPUT_IDS.has(input.id)) {
      ["backgroundImage", "backgroundDim", "backgroundBlur", "backgroundOpacity"].forEach((key) => adminThemeDirty.add(key));
      applyAdminBackground({ ...collectBackgroundFromForm(), backgroundUrl: state.adminTheme?.backgroundUrl }, adminPendingBackground);
    }
  };

  form.addEventListener("input", onEdit);
  form.addEventListener("change", onEdit);

  document.querySelector("#adminThemeBackgroundUpload")?.addEventListener("change", async (event) => {
    event.stopPropagation();
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      showToast(t("admin.messages.theme_image_too_big"));
      event.target.value = "";
      return;
    }
    try {
      adminPendingBackground = await fileToDataUrl(file);
      setAdminInput("adminThemeBackgroundImage", "custom");
      ["backgroundImage", "backgroundDim", "backgroundBlur", "backgroundOpacity"].forEach((key) => adminThemeDirty.add(key));
      applyAdminBackground(collectBackgroundFromForm(), adminPendingBackground);
    } catch (error) {
      showToast(t("admin.messages.theme_file_read_failed"));
    }
  });

  form.addEventListener("submit", saveAdminAppearance);
  document.querySelector("#resetAdminAppearance")?.addEventListener("click", resetAdminAppearance);
  document.querySelector("#revertAdminAppearance")?.addEventListener("click", revertAdminAppearance);
}

// Motyw do zapisu: wcześniej zapisane pola + pola zmienione teraz.
function collectAdminTheme() {
  const saved = normalizeAdminTheme(state.adminTheme);
  const theme = {};

  ADMIN_THEME_FIELDS.forEach((field) => {
    if (adminThemeDirty.has(field.key)) {
      const input = document.querySelector(`#${field.id}`);
      if (input) theme[field.key] = inputToThemeValue(field, input.value);
    } else if (saved[field.key] != null && saved[field.key] !== "") {
      theme[field.key] = saved[field.key];
    }
  });

  const background = collectBackgroundFromForm();
  ["backgroundImage", "backgroundDim", "backgroundBlur", "backgroundOpacity"].forEach((key) => {
    if (adminThemeDirty.has(key)) theme[key] = background[key];
    else if (saved[key] != null) theme[key] = saved[key];
  });
  if (saved.backgroundUrl) theme.backgroundUrl = saved.backgroundUrl;
  return theme;
}

async function saveAdminAppearance(event) {
  event.preventDefault();
  try {
    const themeSettings = collectAdminTheme();
    const data = await request("/api/admin/theme", {
      method: "PUT",
      body: JSON.stringify({ mode: currentAdminMode(), themeSettings, backgroundData: adminPendingBackground })
    });
    state.adminTheme = data.theme || themeSettings;
    if (state.adminThemes) state.adminThemes[currentAdminMode()] = state.adminTheme;
    adminThemeDirty = new Set();
    adminPendingBackground = null;
    clearAdminThemeStyles();
    applyAdminThemeStyles(state.adminTheme);
    populateAdminAppearanceForm(state.adminTheme);
    showToast(t(currentAdminMode() === "d" ? "admin.messages.theme_saved_day" : "admin.messages.theme_saved_night"));
  } catch (error) {
    showToast(error.message);
  }
}

function revertAdminAppearance() {
  adminThemeDirty = new Set();
  adminPendingBackground = null;
  clearAdminThemeStyles();
  applyAdminThemeStyles(state.adminTheme || {});
  populateAdminAppearanceForm(state.adminTheme || {});
  showToast(t("admin.messages.theme_reverted"));
}

async function resetAdminAppearance() {
  const confirmKey = currentAdminMode() === "d" ? "reset_confirm_day" : "reset_confirm_night";
  if (!(await ifConfirm(t(`admin.admin_theme.${confirmKey}`), { okLabel: t("admin.admin_theme.reset_ok"), danger: true }))) return;
  try {
    const data = await request("/api/admin/theme", {
      method: "PUT",
      body: JSON.stringify({ mode: currentAdminMode(), reset: true })
    });
    state.adminTheme = data.theme || {};
    if (state.adminThemes) state.adminThemes[currentAdminMode()] = state.adminTheme;
    adminThemeDirty = new Set();
    adminPendingBackground = null;
    clearAdminThemeStyles();
    applyAdminThemeStyles(state.adminTheme);
    populateAdminAppearanceForm(state.adminTheme);
    showToast(t("admin.messages.theme_reset_done"));
  } catch (error) {
    showToast(error.message);
  }
}

// ─── Nakładanie stylów ───────────────────────────────────────────────────────

function applyAdminThemeField(field, value) {
  const root = adminThemeRoot();
  root.style.setProperty(field.cssVar, themeValueToCss(field, value));

  if (field.key === "accent") {
    root.style.setProperty("--accent-soft", `color-mix(in srgb, ${value} 16%, transparent)`);
    root.style.setProperty("--glow-start", `color-mix(in srgb, ${value} 12%, transparent)`);
    root.style.setProperty("--glow-end", `color-mix(in srgb, ${value} 10%, transparent)`);
  }
}

function applyAdminBackground(background, pendingDataUrl) {
  const root = adminThemeRoot();
  const mode = background?.backgroundImage;
  let url = "";
  if (pendingDataUrl) url = pendingDataUrl;
  else if (mode === "custom" && background.backgroundUrl) url = background.backgroundUrl;
  else if (mode === "default") url = "/images/background.jpg";

  if (!url) {
    ["--background-image", "--background-image-opacity", "--background-image-blur", "--background-image-dim"]
      .forEach((name) => root.style.removeProperty(name));
    return;
  }
  root.style.setProperty("--background-image", `url("${url}")`);
  root.style.setProperty("--background-image-opacity", String(background.backgroundOpacity ?? "0.55"));
  const blur = String(background.backgroundBlur ?? "10px");
  root.style.setProperty("--background-image-blur", blur.endsWith("px") ? blur : `${parseInt(blur, 10) || 0}px`);
  root.style.setProperty("--background-image-dim", String(background.backgroundDim ?? "0.34"));
}

function clearAdminThemeStyles() {
  const root = adminThemeRoot();
  ADMIN_THEME_FIELDS.forEach((field) => root.style.removeProperty(field.cssVar));
  ADMIN_DERIVED_VARS.forEach((name) => root.style.removeProperty(name));
}

// Wywoływana też z admin.js przy starcie Zaplecza.
function applyAdminThemeStyles(theme) {
  const t = normalizeAdminTheme(theme);

  ADMIN_THEME_FIELDS.forEach((field) => {
    const value = t[field.key];
    if (value != null && value !== "") applyAdminThemeField(field, value);
  });
  applyAdminBackground(t, null);

  // Okna (modale) wyglądają tak samo jak na Stronie Głównej — biorą ustawienia z jej motywu.
  const modal = (typeof state !== "undefined" && state && state.theme) ? state.theme : {};
  const root = adminThemeRoot();
  const px = (v) => (String(v).endsWith("px") ? String(v) : `${parseInt(v, 10) || 0}px`);
  if (modal.modalBg) root.style.setProperty("--modal-bg-rgb", hexToRgbChannels(modal.modalBg));
  if (modal.modalAlpha) root.style.setProperty("--modal-alpha", modal.modalAlpha);
  if (modal.modalGlassBlur) root.style.setProperty("--modal-glass-blur", px(modal.modalGlassBlur));
  if (modal.modalBackdropBlur) root.style.setProperty("--modal-backdrop-blur", px(modal.modalBackdropBlur));
  if (modal.modalBackdropAlpha) root.style.setProperty("--modal-backdrop-alpha", modal.modalBackdropAlpha);
  if (modal.modalRadius) root.style.setProperty("--modal-radius", px(modal.modalRadius));
  // Ustawienia okien z pliku trybu Strony Głównej (mają pierwszeństwo przed starym theme.json).
  applyPageModalStyles();
}
