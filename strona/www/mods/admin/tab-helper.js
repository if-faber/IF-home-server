// tab-helper.js — karta „Ustawienia ogólne” (mods/admin). Napisy: admin.general; dymki: admin.messages.
const gT = (key, vars) => escapeHtml(t(`admin.general.${key}`, vars));

function renderHelperTab() {
  const saved = state.settings || {};
  // Na świeżej instalacji pola nie mogą być puste — podpowiadamy wartości startowe.
  const config = {
    title: saved.title || t("admin.general.default_title"),
    subtitle: saved.subtitle || t("admin.general.default_subtitle"),
    defaultHost: saved.defaultHost || window.location.hostname,
    autoLogoutMinutes: saved.autoLogoutMinutes ?? 30
  };
  const autoLogoutOption = (value, label) =>
    `<option value="${value}"${Number(config.autoLogoutMinutes) === value ? " selected" : ""}>${label}</option>`;
  return `
    <div class="admin-tab-container">
      <section class="admin-section-card">
        <h2>${uiIcon("settings", 22)} ${gT("title")}</h2>
        <form id="settingsForm" class="admin-form-panel">
          <div class="admin-form-grid">
            <label>${gT("page_title")}<input id="settingTitle" value="${escapeHtml(config.title ?? "")}" required></label>
            <label>${gT("subtitle")}<input id="settingSubtitle" value="${escapeHtml(config.subtitle ?? "")}" required></label>
            <label><span class="field-title">${gT("host")} ${infoTip(t("admin.general.host_tip"))}</span><input id="settingDefaultHost" value="${escapeHtml(config.defaultHost ?? "")}" required></label>
            <label><span class="field-title">${gT("language")} ${infoTip(t("admin.general.language_tip"))}</span>
              <select id="settingLanguage"><option value="${escapeHtml(window.IF_LANG?.code || "en")}">${gT("language_loading")}</option></select>
            </label>
            <label><span class="field-title">${gT("translator")} ${infoTip(t("admin.general.translator_tip"))}</span>
              <span class="checkbox-row"><input id="settingTranslator" type="checkbox"${saved.translatorEnabled ? " checked" : ""}> ${gT("translator_on")}</span>
            </label>
            <label>${gT("new_pin")}<input id="settingNewPin" type="password" inputmode="numeric" placeholder="${gT("new_pin_placeholder")}"></label>
            <label><span class="field-title">${gT("auto_logout")} ${infoTip(t("admin.general.auto_logout_tip"))}</span>
              <select id="settingAutoLogout">
                ${[5, 15, 30, 60].map((n) => autoLogoutOption(n, gT("after_minutes", { n }))).join("")}
                ${autoLogoutOption(0, gT("never"))}
              </select>
            </label>
            <label>${gT("logo")}<input id="settingLogo" type="file" accept="image/png,image/jpeg,image/webp"></label>
          </div>
          <h3 class="settings-subtitle">${gT("formats_title")}</h3>
          <p class="settings-note">${gT("formats_note")}</p>
          <div class="admin-form-grid">
            <label>${gT("time_zone")}
              <select id="settingTimeZone">${timeZoneOptions(saved.timeZone)}</select>
            </label>
            <label>${gT("date_format")}
              <select id="settingDateFormat">${formatOptions(saved.dateFormat || "auto", [
                ["auto", gT("by_language")], ["pl", "31.12.2026, 19:27"], ["en-GB", "31/12/2026, 19:27"], ["en-US", "12/31/2026, 07:27 PM"], ["iso", "2026-12-31 19:27"]])}</select>
            </label>
            <label>${gT("decimal")}
              <select id="settingDecimal">${formatOptions(saved.decimal || "auto", [
                ["auto", gT("by_language")], ["comma", gT("decimal_comma")], ["dot", gT("decimal_dot")]])}</select>
            </label>
            <label>${gT("temperature")}
              <select id="settingTemperature">${formatOptions(saved.temperatureUnit || "c", [
                ["c", gT("temp_c")], ["f", gT("temp_f")]])}</select>
            </label>
          </div>
          <p class="settings-note">${gT("formats_now", { example: formatsExample() })}</p>
          <menu style="margin-top: 15px;">
            <button class="button primary" type="submit">${uiIcon("save", 16)} ${gT("save")}</button>
          </menu>
        </form>
      </section>
    </div>
  `;
}

// ─── Formaty i jednostki (plan „Język”, Etap 7) ──────────────────────────────
function formatOptions(current, list) {
  return list.map(([value, label]) => `<option value="${value}"${value === current ? " selected" : ""}>${label}</option>`).join("");
}

function timeZoneOptions(current) {
  let zones = [];
  try { zones = Intl.supportedValuesOf("timeZone"); } catch {}
  if (current && !zones.includes(current)) zones.unshift(current);
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  return `<option value="">${gT("time_zone_browser", { zone: browserZone })}</option>`
    + zones.map((zone) => `<option value="${escapeHtml(zone)}"${zone === current ? " selected" : ""}>${escapeHtml(zone)}</option>`).join("");
}

// Jak wyglądają teraz data, liczba i temperatura (według zapisanych ustawień).
function formatsExample() {
  const f = window.IF_FORMAT;
  if (!f) return "";
  return `${f.dateTime(new Date())} · ${f.number(1234.5, 1)} GB · ${f.temp(45)}`;
}

const FORMAT_KEYS = ["timeZone", "dateFormat", "decimal", "temperatureUnit"];

function bindHelperEvents() {
  document.querySelector("#settingsForm")?.addEventListener("submit", saveSettings);
  loadLanguageChoices();
}

// Lista języków (plan „Język”, Etap 4): angielski, dostarczone ze stroną i własne tłumaczenia.
async function loadLanguageChoices() {
  const select = document.querySelector("#settingLanguage");
  if (!select) return;
  try {
    const data = await request("/api/languages");
    select.innerHTML = (data.languages || []).map((lang) =>
      `<option value="${escapeHtml(lang.code)}"${lang.code === data.current ? " selected" : ""}>${escapeHtml(lang.name)} (${escapeHtml(lang.code)})</option>`).join("");
    select.dataset.current = data.current;
  } catch (error) {
    showToast(error.message);
  }
}

async function saveSettings(e) {
  e.preventDefault();
  const settings = {
    title: document.querySelector("#settingTitle").value.trim(),
    subtitle: document.querySelector("#settingSubtitle").value.trim(),
    defaultHost: document.querySelector("#settingDefaultHost").value.trim(),
    logo: state.settings.logo,
    newPin: document.querySelector("#settingNewPin").value.trim(),
    autoLogoutMinutes: Number(document.querySelector("#settingAutoLogout").value),
    translatorEnabled: document.querySelector("#settingTranslator").checked,
    timeZone: document.querySelector("#settingTimeZone").value,
    dateFormat: document.querySelector("#settingDateFormat").value,
    decimal: document.querySelector("#settingDecimal").value,
    temperatureUnit: document.querySelector("#settingTemperature").value
  };
  const defaults = { timeZone: "", dateFormat: "auto", decimal: "auto", temperatureUnit: "c" };
  const formatsChanged = FORMAT_KEYS.some((key) => (state.settings[key] || defaults[key]) !== (settings[key] || defaults[key]));
  const translatorChanged = Boolean(state.settings.translatorEnabled) !== settings.translatorEnabled;

  const logoFile = document.querySelector("#settingLogo").files[0];
  if (logoFile) {
    settings.logoData = await fileToDataUrl(logoFile);
  }

  try {
    const data = await request("/api/dashboard/settings", {
      method: "PUT",
      body: JSON.stringify(settings)
    });
    state.settings = data.settings || settings;
    try { localStorage.setItem("ifs.autoLogoutMinutes", String(settings.autoLogoutMinutes)); } catch {}
    // Po zmianie PIN-u wylogowanie — logujesz się od nowa nowym PIN-em. Inaczej
    // przeglądarka wysyłałaby stary PIN i serwer odrzucałby kolejne zapisy.
    if (settings.newPin) {
      logoutAdmin();
      showToast(t("admin.messages.pin_changed"));
      return;
    }
    // Zmiana języka: zapis wyboru i ponowne wczytanie (napisy przychodzą z /lang.js przy wczytaniu strony).
    const language = document.querySelector("#settingLanguage");
    if (language?.dataset.current && language.value !== language.dataset.current) {
      await request("/api/language", { method: "PUT", body: JSON.stringify({ code: language.value }) });
      showToast(t("admin.messages.language_changed"));
      setTimeout(() => window.location.reload(), 800);
      return;
    }
    // Włączenie / wyłączenie Tłumacza zmienia menu strony (ikonka tłumacza) i Moduły — wczytanie od nowa.
    if (translatorChanged || formatsChanged) {
      showToast(t("admin.messages.translator_changed"));
      setTimeout(() => window.location.reload(), 800);
      return;
    }
    showToast(t("admin.messages.settings_saved"));
  } catch (error) {
    showToast(error.message);
  }
}
