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
  button.title = isNight ? "Tryb nocny — kliknij, żeby przełączyć na dzienny" : "Tryb dzienny — kliknij, żeby przełączyć na nocny";
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

function renderAdminThemeTab() {
  const box = 'class="preset-manager-box" style="margin-top: 10px; padding: 18px; border: 1px solid var(--line); border-radius: 14px; background: rgba(255, 255, 255, 0.02);"';
  return `
    <div class="admin-tab-container">
      <section class="admin-section-card">
        <h2 style="margin: 0 0 8px;">${uiIcon("appearance", 22)} Wygląd Zaplecza</h2>
        <p class="settings-note">Zmiany widać od razu. Zapisz, żeby zostały na stałe. „Cofnij zmiany” wraca do ostatnio zapisanego wyglądu, a „Wygląd startowy” — do wyglądu po instalacji.</p>
        <label class="appearance-mode-bar" style="display: grid; gap: 6px; margin: 12px 0 4px; font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--muted);">
          Edytujesz wygląd trybu
          <select id="adminThemeMode" style="font-size: 15px; font-weight: 700; text-transform: none; color: var(--text);">
            <option value="d">Dzień</option>
            <option value="n">Noc</option>
          </select>
        </label>
        <p class="settings-note" style="margin-top: 0;">Dzień i noc mają osobne ustawienia. Wybór trybu przełącza też Zaplecze, więc widzisz to, co edytujesz.</p>

        <form id="adminAppearanceForm" class="admin-form-panel">

          <div ${box}>
            <h4 style="margin-top: 0; margin-bottom: 6px; color: var(--accent);">${uiIcon("appearance", 16)} 1. Kolory, czcionki i panele</h4>
            <div class="admin-form-grid three-cols">
              <label>Akcent główny<input id="adminThemeAccent" type="color"></label>
              <label><span class="field-title">Kolor nagłówków (Akcent pomocniczy) ${infoTip("Nagłówki kafelków w zakładkach Zaplecza (np. „Progi temperatur”) i tytuły okien. Jedną kontrolką poprawisz nagłówki w całym Zapleczu.")}</span><input id="adminThemeAccentAlt" type="color"></label>
              <label><span class="field-title">Kolor okien (modali) ${infoTip("Kolor zapasowy okien. Okna w Zapleczu biorą wygląd ze Strony Głównej → Wygląd → Okna Modalne (osobno dzień i noc) — tam zmieniasz ich kolor.")}</span><input id="adminThemeSurfaceColor" type="color"></label>
              <label><span class="field-title">Kolor tekstu w polach ${infoTip("Tekst wpisywany w polach formularzy i listach wyboru w Zapleczu. Podpowiedź w pustym polu ma jaśniejszą wersję tego koloru.")}</span><input id="adminThemeInputText" type="color"></label>

              <label>Czcionka menu<select id="adminThemeFontMenu">${renderFontOptions()}</select></label>
              <label>Czcionka kart<select id="adminThemeFontCard">${renderFontOptions()}</select></label>
              <label>Czcionka opisów<select id="adminThemeFontDescription">${renderFontOptions()}</select></label>

              <label>Tło strony<input id="adminThemeBg" type="color"></label>
              <label>Zaokrąglenie kart<input id="adminThemeCardRadius" type="range" min="0" max="34" step="1"><span></span></label>
              <label>Odstęp kart<input id="adminThemeCardGap" type="range" min="8" max="40" step="1"><span></span></label>

              <label>Kolor paneli<input id="adminThemePanelColor" type="color"></label>
              <label>Krycie paneli<input id="adminThemePanelAlpha" type="range" min="5" max="100" step="1"><span></span></label>
              <label>Rozmycie paneli<input id="adminThemeGlassBlur" type="range" min="0" max="40" step="1"><span></span></label>
            </div>

            <span style="font-size: 11px; font-weight: bold; display: block; margin: 16px 0 8px; color: var(--accent);">${uiIcon("image", 14)} Tapeta</span>
            <div class="admin-form-grid three-cols">
              <label>Obraz tła
                <select id="adminThemeBackgroundImage">
                  <option value="">Wyłączony (tylko kolor tła)</option>
                  <option value="default">Domyślne tło</option>
                  <option value="custom">Własny obraz</option>
                </select>
              </label>
              <label>Wgraj własny obraz<input id="adminThemeBackgroundUpload" type="file" accept="image/png,image/jpeg,image/webp"></label>
              <label>Przyciemnienie<input id="adminThemeBackgroundDim" type="range" min="0" max="85" step="1"><span></span></label>
              <label>Rozmycie tapety<input id="adminThemeBackgroundBlur" type="range" min="0" max="40" step="1"><span></span></label>
              <label>Widoczność tapety<input id="adminThemeBackgroundOpacity" type="range" min="0" max="100" step="1"><span></span></label>
            </div>
          </div>

          <div ${box}>
            <h4 style="margin-top: 0; margin-bottom: 6px; color: var(--accent);">${uiIcon("tabs", 16)} 2. Pasek boczny</h4>
            <div class="admin-form-grid">
              <label>Kolor paska<input id="adminSidebarColor" type="color"></label>
              <label>Krycie paska<input id="adminSidebarAlpha" type="range" min="5" max="100" step="1"><span></span></label>
              <label>Kolor napisów paska<input id="adminMenuTextColor" type="color"></label>
              <label>Szerokość paska<input id="adminSidebarWidth" type="range" min="220" max="380" step="5"><span></span></label>
            </div>
            <span style="font-size: 11px; font-weight: bold; display: block; margin: 16px 0 8px; color: var(--accent);">Przyciski menu</span>
            <div class="admin-form-grid">
              <label>Tło<input id="adminMenuBtnBg" type="color"></label>
              <label>Tekst<input id="adminMenuBtnText" type="color"></label>
              <label>Tło po najechaniu<input id="adminMenuBtnHoverBg" type="color"></label>
              <label>Tekst po najechaniu<input id="adminMenuBtnHoverText" type="color"></label>
              <label>Tło aktywnego<input id="adminMenuBtnActiveBg" type="color"></label>
              <label>Tekst aktywnego<input id="adminMenuBtnActiveText" type="color"></label>
            </div>
          </div>

          <div ${box}>
            <h4 style="margin-top: 0; margin-bottom: 14px; color: var(--accent);">${uiIcon("button", 16)} 3. Przyciski akcji</h4>
            <div class="admin-form-grid three-cols" style="margin-bottom: 16px;">
              <label>Zaokrąglenie<input id="adminBtnRadius" type="range" min="0" max="30" step="1"><span></span></label>
              <label>Grubość ramki<input id="adminBtnBorderWidth" type="range" min="0" max="4" step="1"><span></span></label>
              <label>Kolor ramki<input id="adminBtnBorderColor" type="color"></label>
              <label>Wielkość poświaty<input id="adminBtnGlow" type="range" min="0" max="30" step="1"><span></span></label>
              <label>Poświata głównego<input id="adminBtnGlowColor" type="color"></label>
              <label>Poświata ostrzegawczego<input id="adminBtnDangerGlowColor" type="color"></label>
            </div>

            <div class="admin-form-grid" style="gap: 18px; align-items: start;">
              <div style="padding: 14px; border: 1px solid var(--line); border-radius: 10px; background: rgba(0,0,0,0.12);">
                <h5 style="margin: 0 0 10px 0; font-size: 13px;">Przycisk główny</h5>
                <div style="margin-bottom: 12px; display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
                  <button type="button" class="button primary" tabindex="-1">${uiIcon("save", 16)} Zapisz</button>
                  <button type="button" class="button" tabindex="-1">Zwykły</button>
                </div>
                <div class="admin-form-grid">
                  <label>Tło<input id="adminBtnNormalBg" type="color"></label>
                  <label>Tekst<input id="adminBtnNormalText" type="color"></label>
                  <label>Tło po najechaniu<input id="adminBtnNormalHoverBg" type="color"></label>
                  <label>Tekst po najechaniu<input id="adminBtnNormalHoverText" type="color"></label>
                </div>
              </div>

              <div style="padding: 14px; border: 1px solid var(--line); border-radius: 10px; background: rgba(0,0,0,0.12);">
                <h5 style="margin: 0 0 10px 0; font-size: 13px;">Przycisk ostrzegawczy</h5>
                <div style="margin-bottom: 12px; display: flex; justify-content: center;">
                  <button type="button" class="button danger" tabindex="-1">${uiIcon("trash", 16)} Usuń</button>
                </div>
                <div class="admin-form-grid">
                  <label>Tło<input id="adminBtnDangerBg" type="color"></label>
                  <label>Tekst<input id="adminBtnDangerText" type="color"></label>
                  <label>Tło po najechaniu<input id="adminBtnDangerHoverBg" type="color"></label>
                  <label>Tekst po najechaniu<input id="adminBtnDangerHoverText" type="color"></label>
                </div>
              </div>
            </div>
          </div>

          <menu style="margin-top: 18px; display: flex; justify-content: flex-end; gap: 12px; flex-wrap: wrap;">
            <button id="resetAdminAppearance" class="button danger" type="button">Wygląd startowy</button>
            <button id="revertAdminAppearance" class="button" type="button">Cofnij zmiany</button>
            <button class="button primary" type="submit">${uiIcon("save", 16)} Zapisz wygląd</button>
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
      if (adminThemeDirty.size && !(await ifConfirm("Niezapisane zmiany wyglądu przepadną. Przełączyć tryb?", { okLabel: "Przełącz", danger: true }))) {
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
      showToast("Obraz jest za duży (maks. 8 MB).");
      event.target.value = "";
      return;
    }
    try {
      adminPendingBackground = await fileToDataUrl(file);
      setAdminInput("adminThemeBackgroundImage", "custom");
      ["backgroundImage", "backgroundDim", "backgroundBlur", "backgroundOpacity"].forEach((key) => adminThemeDirty.add(key));
      applyAdminBackground(collectBackgroundFromForm(), adminPendingBackground);
    } catch (error) {
      showToast("Nie udało się odczytać pliku.");
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
    showToast(`Zapisano wygląd Zaplecza (${currentAdminMode() === "d" ? "dzień" : "noc"}).`);
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
  showToast("Cofnięto niezapisane zmiany.");
}

async function resetAdminAppearance() {
  const modeName = currentAdminMode() === "d" ? "dzień" : "noc";
  if (!(await ifConfirm(`Przywrócić wygląd startowy Zaplecza (${modeName})? Zapisane ustawienia wyglądu tego trybu zostaną usunięte.`, { okLabel: "Przywróć", danger: true }))) return;
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
    showToast("Przywrócono wygląd startowy Zaplecza.");
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
