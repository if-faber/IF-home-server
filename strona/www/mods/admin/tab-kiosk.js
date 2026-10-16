// tab-kiosk.js — Moduł Zakładki „Kiosk Serwera” (mods/admin)

let kioskState = {
  settings: {},
  theme: {},
  menuItems: []
};

let editingMenuItemId = null;

// Typy natywnych paneli statusu serwera (bez URL, renderowane bezpośrednio w Kiosku)
const KIOSK_NATIVE_PANEL_TYPES = ["server-status", "live", "docker-status"];

function renderKioskTab() {
  return `
    <div class="admin-tab-container">
      <a href="#" class="button module-back-link" data-modules-back>← Wróć do Modułów</a>
      <!-- Sekcja 1: Podstawowe Ustawienia Kiosku -->
      <section class="admin-section-card">
        <h2>${uiIcon("monitor", 22)} Podstawowe Ustawienia Kiosku</h2>
        <form id="kioskBasicSettingsForm">
          <div class="admin-form-grid" style="grid-template-columns: 1fr 1fr; gap: 16px;">
            <label>Czas auto-powrotu po bezczynności (sekundy, 0 = wyłączony)
              <input type="number" id="kioskIdleTimeout" value="120" min="0" max="600">
            </label>
          </div>
          <div style="margin-top: 16px; display: flex; justify-content: flex-end;">
            <button class="button primary" type="submit">${uiIcon("save", 16)} Zapisz podstawowe ustawienia</button>
          </div>
        </form>
      </section>

      <div class="admin-section-divider"></div>

      <!-- Sekcja 2: Zarządzanie Przyciskami Menu Kiosku (Lollipop Menu) -->
      <section class="admin-section-card">
        <h2>${uiIcon("button", 22)} Zarządzanie Przyciskami Menu Kiosku (Lollipop Menu)</h2>
        <p class="settings-note" style="margin-bottom: 16px;">Te przyciski wyświetlają się w wysuwanym menu z góry ekranu na tablecie.</p>
        
        <!-- Formularz dodawania / edycji przycisku -->
        <div style="padding: 16px; border: 1px dashed var(--line); border-radius: 12px; background: rgba(0,0,0,0.12); margin-bottom: 20px;">
          <h4 id="kioskItemFormTitle" style="margin-top: 0; margin-bottom: 12px; color: var(--accent);">${uiIcon("plus", 16)} Dodaj przycisk do menu Kiosku</h4>
          <form id="kioskMenuItemForm">
            <input type="hidden" id="kioskItemId">
            <div class="admin-form-grid" style="grid-template-columns: 1fr 1fr; gap: 12px;">
              <label>Nazwa przycisku
                <input type="text" id="kioskItemTitle" placeholder="np. Immich, Pogoda..." required>
              </label>
              <label>Typ wyświetlania
                <select id="kioskItemType">
                  <option value="iframe">Ramka wewnątrz Kiosku (iframe)</option>
                  <option value="link">Zewnętrzny link (nowa karta)</option>
                  <option value="server-status">Status serwera (natywne)</option>
                  <option value="live">Live — podgląd kontenerów (natywne)</option>
                  <option value="docker-status">Status kontenerów (natywne)</option>
                </select>
              </label>
              <label style="grid-column: 1 / -1;" id="kioskItemUrlGroup">Adres URL (http://... lub https://...)
                <input type="url" id="kioskItemUrl" placeholder="http://192.168.1.100:3000/">
              </label>
              <label style="grid-column: 1 / -1;">Nazwa ikony (z katalogu www/kiosk/icons/ lub pełny URL)
                <input type="text" id="kioskItemIcon" placeholder="np. immich.png, weather.png...">
              </label>
            </div>
            <div style="margin-top: 14px; display: flex; justify-content: flex-end; gap: 10px;">
              <button id="cancelKioskItemEdit" class="button danger" type="button" style="display: none;">Anuluj edycję</button>
              <button class="button primary" type="submit" id="saveKioskItemBtn">${uiIcon("plus", 16)} Dodaj przycisk</button>
            </div>
          </form>
        </div>

        <!-- Lista obecnych przycisków -->
        <div id="kioskMenuItemsList" style="display: flex; flex-direction: column; gap: 10px;">
          <div style="text-align: center; color: var(--text-muted); padding: 20px;">Wczytywanie przycisków menu...</div>
        </div>
      </section>

      <div class="admin-section-divider"></div>

      <!-- Sekcja 3: Wygląd, Efekty Glassmorphism i Stylizacja Kiosku (Zwijana karta) -->
      <details class="admin-details-card" open style="background: var(--surface); border: 1px solid var(--line); border-radius: 14px; margin-bottom: 20px; overflow: hidden;">
        <summary style="padding: 16px 20px; font-size: 18px; font-weight: 700; cursor: pointer; user-select: none; background: rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: space-between;">
          <span>${uiIcon("appearance", 16)} Wygląd, Efekty Glassmorphism i Stylizacja Kiosku</span>
          <span style="font-size: 12px; opacity: 0.7;">(kliknij aby zwinąć/rozwinąć)</span>
        </summary>
        <div style="padding: 20px;">
          <form id="kioskThemeForm">
            <!-- 1. Stylistyka i Efekty Przycisku MENU (Notch) -->
            <div style="margin-bottom: 24px; padding: 16px; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; background: rgba(0,0,0,0.1);">
              <h4 style="margin-top: 0; margin-bottom: 14px; color: var(--accent);">${uiIcon("button", 16)} Wygląd & Efekty Przycisku MENU</h4>
              
              <!-- Live Preview Przycisk MENU -->
              <div style="margin-bottom: 16px; padding: 16px; background: rgba(0,0,0,0.4); border-radius: 10px; text-align: center; border: 1px dashed rgba(255,255,255,0.15);">
                <span style="font-size: 11px; opacity: 0.7; display: block; margin-bottom: 8px;">Podgląd na żywo (Przycisk MENU na dole ekranu):</span>
                <button id="prevNotchBtn" type="button" style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 22px; font-size: 12px; font-weight: bold; border-radius: 24px; cursor: pointer; transition: all 0.2s; border: 0;">
                  <span style="width: 20px; height: 4px; background: currentColor; border-radius: 2px;"></span>
                  <span>MENU</span>
                </button>
              </div>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px;">
                <div>
                  <div style="font-size: 11px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase;">Tło przycisku MENU</div>
                  <input type="color" id="kioskNotchBg" style="width:100%; height:36px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; cursor: pointer;">
                </div>
                <div>
                  <div style="font-size: 11px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase;">Tekst / Ikona przycisku</div>
                  <input type="color" id="kioskNotchText" style="width:100%; height:36px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; cursor: pointer;">
                </div>
                <div>
                  <div style="font-size: 11px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase;">Obramowanie przycisku</div>
                  <input type="color" id="kioskNotchBorder" style="width:100%; height:36px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; cursor: pointer;">
                </div>
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase;">
                    <span>Blask świecenia</span>
                    <span id="valNotchGlow" style="color: var(--accent);">12px</span>
                  </div>
                  <input type="range" id="kioskNotchGlow" min="0" max="30" step="1" value="12" style="width:100%;">
                </div>
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase;">
                    <span>Rozmycie przycisku / Blur</span>
                    <span id="valNotchBlur" style="color: var(--accent);">12px</span>
                  </div>
                  <input type="range" id="kioskNotchBlur" min="0" max="40" step="1" value="12" style="width:100%;">
                </div>
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase;">
                    <span>Przezroczystość / Opacity</span>
                    <span id="valNotchOpacity" style="color: var(--accent);">92%</span>
                  </div>
                  <input type="range" id="kioskNotchOpacity" min="0.10" max="1.00" step="0.02" value="0.92" style="width:100%;">
                </div>
              </div>
            </div>

            <!-- 2. Stylistyka i Efekty Panelu Menu (Lollipop Dropdown Panel) -->
            <div style="margin-bottom: 24px; padding: 16px; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; background: rgba(0,0,0,0.1);">
              <h4 style="margin-top: 0; margin-bottom: 14px; color: var(--accent);">${uiIcon("tabs", 16)} Wygląd & Efekty Rozwijanego Menu (Lollipop Dropdown)</h4>

              <!-- Live Preview Lollipop Panel -->
              <div id="prevLollipopPanel" style="margin-bottom: 16px; padding: 20px; border-radius: 12px; display: flex; justify-content: center; align-items: center; border: 1px dashed rgba(255,255,255,0.15); background: rgba(15,23,42,0.88); transition: all 0.2s;">
                <div style="display: flex; align-items: center;">
                  <div id="prevLollipopHead" style="width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; z-index: 2; position: relative;">${uiIcon("monitor", 24)}</div>
                  <div id="prevLollipopStem" style="z-index: 1; position: relative; margin-left: -20px; padding: 8px 20px 8px 28px; height: 40px; border-radius: 0 20px 20px 0; font-size: 14px; font-weight: 700; display: flex; align-items: center; white-space: nowrap;">
                    <span>Immich (Przykładowy kafelek)</span>
                  </div>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px;">
                <div>
                  <div style="font-size: 11px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase;">Tło panelu menu</div>
                  <input type="color" id="kioskLollipopBg" style="width:100%; height:36px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; cursor: pointer;">
                </div>
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase;">
                    <span>Rozmycie tła / Blur</span>
                    <span id="valLollipopBlur" style="color: var(--accent);">16px</span>
                  </div>
                  <input type="range" id="kioskLollipopBlur" min="0" max="40" step="1" value="16" style="width:100%;">
                </div>
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase;">
                    <span>Przezroczystość panelu</span>
                    <span id="valLollipopOpacity" style="color: var(--accent);">88%</span>
                  </div>
                  <input type="range" id="kioskLollipopOpacity" min="0.10" max="1.00" step="0.02" value="0.88" style="width:100%;">
                </div>
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase;">
                    <span>Nasycenie kolorów</span>
                    <span id="valLollipopSat" style="color: var(--accent);">120%</span>
                  </div>
                  <input type="range" id="kioskLollipopSat" min="50" max="200" step="5" value="120" style="width:100%;">
                </div>
              </div>
            </div>

            <!-- 3. Stylistyka Kafelków w Menu (Lollipop Items) -->
            <div style="margin-bottom: 24px; padding: 16px; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; background: rgba(0,0,0,0.1);">
              <h4 style="margin-top: 0; margin-bottom: 14px; color: var(--accent);">${uiIcon("target", 16)} Stylistyka Kafelków w Menu (Lollipop)</h4>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px;">
                <div>
                  <div style="font-size: 11px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase;">Tło nieaktywnego kafelka</div>
                  <input type="color" id="kioskBtnBg" style="width:100%; height:36px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; cursor: pointer;">
                </div>
                <div>
                  <div style="font-size: 11px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase;">Tekst nieaktywnego kafelka</div>
                  <input type="color" id="kioskBtnText" style="width:100%; height:36px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; cursor: pointer;">
                </div>
                <div>
                  <div style="font-size: 11px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase;">Tło po najechaniu (Hover)</div>
                  <input type="color" id="kioskBtnHoverBg" style="width:100%; height:36px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; cursor: pointer;">
                </div>
                <div>
                  <div style="font-size: 11px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase;">Tekst po najechaniu (Hover)</div>
                  <input type="color" id="kioskBtnHoverText" style="width:100%; height:36px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; cursor: pointer;">
                </div>
                <div>
                  <div style="font-size: 11px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase;">Tło aktywnego kafelka</div>
                  <input type="color" id="kioskBtnActiveBg" style="width:100%; height:36px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; cursor: pointer;">
                </div>
                <div>
                  <div style="font-size: 11px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase;">Tekst aktywnego kafelka</div>
                  <input type="color" id="kioskBtnActiveText" style="width:100%; height:36px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; cursor: pointer;">
                </div>
                <div style="grid-column: 1 / -1;">
                  <div style="font-size: 11px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase;">Skala czcionek i przycisków</div>
                  <select id="kioskFontScale" style="width:100%; height:36px; background: rgba(0,0,0,0.4); color:#fff; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px;">
                    <option value="100%">Domyślna (100%)</option>
                    <option value="115%">Powiększona (115% - duży tablet)</option>
                    <option value="130%">Bardzo duża (130% - ekran ścienny)</option>
                  </select>
                </div>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end;">
              <button class="button primary" type="submit">${uiIcon("save", 16)} Zapisz wygląd i efekty Glass Kiosku</button>
            </div>
          </form>
        </div>
      </details>
    </div>
  `;
}

async function loadKioskTabConfig() {
  try {
    const data = await request("/api/kiosk/settings");
    kioskState = data;
    populateKioskForm();
    renderKioskMenuItems();
  } catch (err) {
    if (typeof showToast === "function") showToast("Błąd wczytywania ustawień Kiosku: " + err.message);
  }
}

function populateKioskForm() {
  const s = kioskState.settings || {};
  const t = kioskState.theme || {};

  const setVal = (id, val) => {
    const el = document.querySelector(`#${id}`);
    if (el) el.value = val ?? "";
  };

  setVal("kioskIdleTimeout", s.idleTimeout ?? 120);

  setVal("kioskFontScale", t.fontScale || "100%");
  setVal("kioskNotchBg", t.notchBg || "#10b981");
  setVal("kioskNotchText", t.notchText || "#ffffff");
  setVal("kioskNotchBorder", t.notchBorder || "#10b981");
  setVal("kioskNotchGlow", parseInt(t.notchGlow || "12", 10));
  setVal("kioskNotchBlur", parseInt(t.notchBlur || "12", 10));
  setVal("kioskNotchOpacity", parseFloat(t.notchOpacity || "0.92"));

  setVal("kioskLollipopBg", t.lollipopBg || "#0f172a");
  setVal("kioskLollipopBlur", parseInt(t.lollipopBlur || "16", 10));
  setVal("kioskLollipopOpacity", parseFloat(t.lollipopOpacity || "0.88"));
  setVal("kioskLollipopSat", parseInt(t.lollipopSat || "120", 10));

  setVal("kioskBtnBg", t.btnBg || "#1e293b");
  setVal("kioskBtnText", t.btnText || "#ffffff");
  setVal("kioskBtnHoverBg", t.btnHoverBg || "#334155");
  setVal("kioskBtnHoverText", t.btnHoverText || "#ffffff");
  setVal("kioskBtnActiveBg", t.btnActiveBg || "#10b981");
  setVal("kioskBtnActiveText", t.btnActiveText || "#ffffff");

  updateKioskLivePreviews();
}

function updateKioskLivePreviews() {
  const getVal = id => document.querySelector("#" + id)?.value;

  const notchBg = getVal("kioskNotchBg") || "#10b981";
  const notchText = getVal("kioskNotchText") || "#ffffff";
  const notchBorder = getVal("kioskNotchBorder") || "#10b981";
  const notchGlow = (getVal("kioskNotchGlow") || 12) + "px";
  const notchBlur = (getVal("kioskNotchBlur") || 12) + "px";
  const notchOpacity = getVal("kioskNotchOpacity") || "0.92";

  const lollipopBg = getVal("kioskLollipopBg") || "#0f172a";
  const lollipopBlur = (getVal("kioskLollipopBlur") || 16) + "px";
  const lollipopOpacity = getVal("kioskLollipopOpacity") || "0.88";
  const lollipopSat = (getVal("kioskLollipopSat") || 120) + "%";

  const btnBg = getVal("kioskBtnBg") || "#1e293b";
  const btnText = getVal("kioskBtnText") || "#ffffff";
  const btnActiveBg = getVal("kioskBtnActiveBg") || "#10b981";
  const btnActiveText = getVal("kioskBtnActiveText") || "#ffffff";

  // Aktualizacja tekstów przy suwakach
  const updateSpan = (id, text) => { const el = document.querySelector(`#${id}`); if (el) el.textContent = text; };
  updateSpan("valNotchGlow", notchGlow);
  updateSpan("valNotchBlur", notchBlur);
  updateSpan("valNotchOpacity", Math.round(parseFloat(notchOpacity) * 100) + "%");

  updateSpan("valLollipopBlur", lollipopBlur);
  updateSpan("valLollipopOpacity", Math.round(parseFloat(lollipopOpacity) * 100) + "%");
  updateSpan("valLollipopSat", lollipopSat);

  const hexToRgba = (hex, alpha) => {
    if (!hex) return "";
    if (hex.startsWith("rgba") || hex.startsWith("rgb")) return hex;
    let c = hex.replace("#", "");
    if (c.length === 3) c = c.split("").map(x => x + x).join("");
    const num = parseInt(c, 16);
    if (isNaN(num)) return hex;
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha ?? 1})`;
  };

  // 1. Podgląd Przycisk MENU
  const prevNotch = document.querySelector("#prevNotchBtn");
  if (prevNotch) {
    prevNotch.style.background = hexToRgba(notchBg, notchOpacity);
    prevNotch.style.color = notchText;
    prevNotch.style.border = `1px solid ${notchBorder}`;
    prevNotch.style.borderRadius = "24px";
    prevNotch.style.boxShadow = `0 4px 15px rgba(0,0,0,0.5), 0 0 ${notchGlow} ${notchBorder}`;
    prevNotch.style.backdropFilter = `blur(${notchBlur})`;
  }

  // 2. Podgląd Rozwijane Menu (Lollipop Dropdown Panel)
  const prevPanel = document.querySelector("#prevLollipopPanel");
  if (prevPanel) {
    prevPanel.style.background = hexToRgba(lollipopBg, lollipopOpacity);
    prevPanel.style.backdropFilter = `blur(${lollipopBlur}) saturate(${lollipopSat})`;
  }

  const prevHead = document.querySelector("#prevLollipopHead");
  if (prevHead) {
    prevHead.style.background = btnActiveBg;
    prevHead.style.borderColor = btnActiveBg;
    prevHead.style.boxShadow = `0 0 14px ${hexToRgba(btnActiveBg, 0.5)}`;
  }

  const prevStem = document.querySelector("#prevLollipopStem");
  if (prevStem) {
    prevStem.style.background = btnActiveBg;
    prevStem.style.color = btnActiveText;
    prevStem.style.borderRadius = "0 20px 20px 0";
  }
}

function kioskItemTypeLabel(type) {
  if (type === "iframe") return "Ramka (iframe)";
  if (type === "link") return "Zewnętrzny link";
  if (type === "server-status") return "Status serwera (natywne)";
  if (type === "live") return "Live (natywne)";
  if (type === "docker-status") return "Status kontenerów (natywne)";
  return "Nieznany typ";
}

function renderKioskMenuItems() {
  const listContainer = document.querySelector("#kioskMenuItemsList");
  if (!listContainer) return;

  const items = kioskState.menuItems || [];
  if (items.length === 0) {
    listContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">Brak przycisków w menu Kiosku. Dodaj pierwszy powyżej.</div>`;
    return;
  }

  listContainer.innerHTML = items.map((item, idx) => `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border: 1px solid var(--line); border-radius: 10px; background: rgba(255,255,255,0.02);">
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 20px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.2); border-radius: 8px;">
          ${item.icon ? `<img src="../../kiosk/icons/${item.icon}" alt="" style="width: 24px; height: 24px; object-fit: contain;" onerror="this.style.display='none'">` : uiIcon("monitor", 22)}
        </span>
        <div>
          <strong style="display: block; font-size: 14px;">${escapeHtml(item.title)}</strong>
          <span style="font-size: 11px; color: var(--text-muted);">
            Typ: ${kioskItemTypeLabel(item.type)}
          </span>
        </div>
      </div>
      <div style="display: flex; gap: 6px; align-items: center;">
        <button type="button" class="button" onclick="moveKioskMenuItem(${idx}, 'up')" ${idx === 0 ? 'disabled' : ''} title="Przesuń w górę">▲</button>
        <button type="button" class="button" onclick="moveKioskMenuItem(${idx}, 'down')" ${idx === items.length - 1 ? 'disabled' : ''} title="Przesuń w dół">▼</button>
        <button type="button" class="button primary" onclick="editKioskMenuItem('${item.id}')">${uiIcon("edit", 14)} Edytuj</button>
        <button type="button" class="button danger" onclick="deleteKioskMenuItem('${item.id}')">${uiIcon("trash", 14)} Usuń</button>
      </div>
    </div>
  `).join("");
}

function bindKioskEvents() {
  loadKioskTabConfig();
  if (typeof bindModulesBackLink === "function") bindModulesBackLink();

  // Nasłuchiwanie zmian na żywo dla podglądu (Live Preview)
  [
    "kioskNotchBg", "kioskNotchText", "kioskNotchBorder", "kioskNotchGlow", "kioskNotchBlur", "kioskNotchOpacity",
    "kioskLollipopBg", "kioskLollipopBlur", "kioskLollipopOpacity", "kioskLollipopSat",
    "kioskBtnBg", "kioskBtnText", "kioskBtnActiveBg", "kioskBtnActiveText"
  ].forEach(id => {
    document.querySelector("#" + id)?.addEventListener("input", updateKioskLivePreviews);
  });

  // 1. Zapis podstawowych ustawień
  const basicForm = document.querySelector("#kioskBasicSettingsForm");
  if (basicForm) {
    basicForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const settings = {
        idleTimeout: document.querySelector("#kioskIdleTimeout").value
      };

      try {
        await saveKioskConfig({ settings });
        if (typeof showToast === "function") showToast("Podstawowe ustawienia Kiosku zapisane.");
      } catch (err) {
        if (typeof showToast === "function") showToast("Błąd zapisu: " + err.message);
      }
    });
  }

  // 2. Dodawanie / edycja przycisku menu
  const menuTypeSelect = document.querySelector("#kioskItemType");
  const urlGroup = document.querySelector("#kioskItemUrlGroup");
  if (menuTypeSelect && urlGroup) {
    menuTypeSelect.addEventListener("change", () => {
      urlGroup.style.display = KIOSK_NATIVE_PANEL_TYPES.includes(menuTypeSelect.value) ? "none" : "block";
    });
  }

  const menuItemForm = document.querySelector("#kioskMenuItemForm");
  if (menuItemForm) {
    menuItemForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.querySelector("#kioskItemId").value || `item-${Date.now()}`;
      const title = document.querySelector("#kioskItemTitle").value.trim();
      const type = document.querySelector("#kioskItemType").value;
      const url = document.querySelector("#kioskItemUrl").value.trim();
      const icon = document.querySelector("#kioskItemIcon").value.trim();

      if (!title) return;

      const newItem = { id, title, type, url, icon };
      let items = [...(kioskState.menuItems || [])];

      if (editingMenuItemId) {
        items = items.map(it => it.id === editingMenuItemId ? newItem : it);
      } else {
        items.push(newItem);
      }

      try {
        await saveKioskConfig({ menuItems: items });
        resetKioskMenuItemForm();
        if (typeof showToast === "function") showToast(editingMenuItemId ? "Przycisk zaktualizowany." : "Nowy przycisk dodany do menu.");
      } catch (err) {
        if (typeof showToast === "function") showToast("Błąd zapisu przycisku: " + err.message);
      }
    });
  }

  const cancelBtn = document.querySelector("#cancelKioskItemEdit");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", resetKioskMenuItemForm);
  }

  // 3. Zapis motywu, kolorystyki i dedykowanych efektów Glassmorphism
  const themeForm = document.querySelector("#kioskThemeForm");
  if (themeForm) {
    themeForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const theme = {
        fontScale: document.querySelector("#kioskFontScale").value,

        // 1. Dedykowana stylistyka Przycisku MENU
        notchBg: document.querySelector("#kioskNotchBg").value,
        notchText: document.querySelector("#kioskNotchText").value,
        notchBorder: document.querySelector("#kioskNotchBorder").value,
        notchGlow: document.querySelector("#kioskNotchGlow").value + "px",
        notchBlur: document.querySelector("#kioskNotchBlur").value + "px",
        notchOpacity: document.querySelector("#kioskNotchOpacity").value,

        // 2. Dedykowana stylistyka Panelu Menu (Lollipop Dropdown)
        lollipopBg: document.querySelector("#kioskLollipopBg").value,
        lollipopBlur: document.querySelector("#kioskLollipopBlur").value + "px",
        lollipopOpacity: document.querySelector("#kioskLollipopOpacity").value,
        lollipopSat: document.querySelector("#kioskLollipopSat").value + "%",

        // 3. Dedykowana stylistyka Kafelków w Menu (Lollipop Items)
        btnBg: document.querySelector("#kioskBtnBg").value,
        btnText: document.querySelector("#kioskBtnText").value,
        btnHoverBg: document.querySelector("#kioskBtnHoverBg").value,
        btnHoverText: document.querySelector("#kioskBtnHoverText").value,
        btnActiveBg: document.querySelector("#kioskBtnActiveBg").value,
        btnActiveText: document.querySelector("#kioskBtnActiveText").value
      };

      try {
        await saveKioskConfig({ theme });
        if (typeof showToast === "function") showToast("Wygląd i efekty Glass Kiosku zapisane.");
      } catch (err) {
        if (typeof showToast === "function") showToast("Błąd zapisu wyglądu: " + err.message);
      }
    });
  }
}

async function saveKioskConfig(payload) {
  try {
    const updated = await request("/api/kiosk/settings", {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    kioskState = updated;
    populateKioskForm();
    renderKioskMenuItems();
  } catch (err) {
    throw new Error(err.message || "Błąd zapisu danych Kiosku");
  }
}

function editKioskMenuItem(id) {
  const item = (kioskState.menuItems || []).find(it => it.id === id);
  if (!item) return;

  editingMenuItemId = id;
  document.querySelector("#kioskItemId").value = item.id;
  document.querySelector("#kioskItemTitle").value = item.title;
  document.querySelector("#kioskItemType").value = item.type;
  document.querySelector("#kioskItemUrl").value = item.url || "";
  document.querySelector("#kioskItemIcon").value = item.icon || "";

  const urlGroup = document.querySelector("#kioskItemUrlGroup");
  if (urlGroup) urlGroup.style.display = KIOSK_NATIVE_PANEL_TYPES.includes(item.type) ? "none" : "block";

  document.querySelector("#kioskItemFormTitle").innerHTML = `${uiIcon("edit", 16)} Edytuj przycisk menu Kiosku`;
  document.querySelector("#saveKioskItemBtn").innerHTML = `${uiIcon("save", 16)} Zapisz zmiany`;
  document.querySelector("#cancelKioskItemEdit").style.display = "inline-block";
}

function resetKioskMenuItemForm() {
  editingMenuItemId = null;
  const form = document.querySelector("#kioskMenuItemForm");
  if (form) form.reset();
  document.querySelector("#kioskItemId").value = "";
  document.querySelector("#kioskItemFormTitle").innerHTML = `${uiIcon("plus", 16)} Dodaj przycisk do menu Kiosku`;
  document.querySelector("#saveKioskItemBtn").innerHTML = `${uiIcon("plus", 16)} Dodaj przycisk`;
  document.querySelector("#cancelKioskItemEdit").style.display = "none";
  const urlGroup = document.querySelector("#kioskItemUrlGroup");
  if (urlGroup) urlGroup.style.display = "block";
}

async function deleteKioskMenuItem(id) {
  if (!(await ifConfirm("Czy na pewno chcesz usunąć ten przycisk z menu Kiosku?", { okLabel: "Usuń", danger: true }))) return;
  const items = (kioskState.menuItems || []).filter(it => it.id !== id);
  try {
    await saveKioskConfig({ menuItems: items });
    if (typeof showToast === "function") showToast("Przycisk usunięty.");
  } catch (err) {
    if (typeof showToast === "function") showToast("Błąd usuwania przycisku: " + err.message);
  }
}

async function moveKioskMenuItem(index, direction) {
  const items = [...(kioskState.menuItems || [])];
  const targetIndex = direction === "up" ? index - 1 : index + 1;

  if (targetIndex < 0 || targetIndex >= items.length) return;

  const temp = items[index];
  items[index] = items[targetIndex];
  items[targetIndex] = temp;

  try {
    await saveKioskConfig({ menuItems: items });
    if (typeof showToast === "function") showToast("Kolejność przycisków zmieniona.");
  } catch (err) {
    if (typeof showToast === "function") showToast("Błąd zmiany kolejności: " + err.message);
  }
}
