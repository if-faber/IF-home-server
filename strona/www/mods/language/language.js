// mods/language/language.js — moduł „Tłumacz” (plan „Język”, Etap 4).
// Wczytywany przez Zaplecze dopiero przy otwarciu karty i tylko, gdy moduł jest włączony
// (Ustawienia ogólne → Moduł „Tłumacz”). Napisy karty: sekcja mods.language.
// Karta: lista języków z postępem tłumaczenia, zarządzanie językami (wzór angielski do pobrania,
// eksport, nowy język, wgrywanie pliku, usuwanie) i edytor (angielski | tłumaczenie) z filtrami i zapisem.
// Etykieta napisu (grupa.sekcja.nazwa) jest ukryta — tłumacz widzi sekcję, angielski tekst i tłumaczenie.

const langT = (key, vars) => escapeHtml(t(`mods.language.${key}`, vars));
const LANG_GROUPS = ["page", "admin", "mods"];
const LANG_PAGE_SIZE = 60;

// Wygląd karty — własny plik modułu, dołączany razem ze skryptem.
(function addTranslatorStyles() {
  if (document.querySelector("link[data-translator-css]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "../language/language.css?v=0.5-l3";
  link.dataset.translatorCss = "1";
  document.head.appendChild(link);
})();

const translator = {
  languages: [],
  current: "",
  code: "",          // edytowany język
  content: null,     // { shipped, user } edytowanego języka
  entries: [],       // wszystkie napisy do edycji
  dirty: new Map(),  // etykieta → nowy tekst (niezapisane)
  limit: LANG_PAGE_SIZE
};

// ─── Pliki języka ────────────────────────────────────────────────────────────

// Wszystkie etykiety napisów z pliku języka (grupa.sekcja.nazwa), bez opisów i danych pliku (klucze z „_” na początku).
function languageKeys(file) {
  const keys = [];
  for (const [group, sections] of Object.entries(file || {})) {
    if (group.startsWith("_") || !sections || typeof sections !== "object") continue;
    for (const [section, entries] of Object.entries(sections)) {
      if (section.startsWith("_") || !entries || typeof entries !== "object") continue;
      for (const [name, text] of Object.entries(entries)) {
        if (!name.startsWith("_") && typeof text === "string") keys.push(`${group}.${section}.${name}`);
      }
    }
  }
  return keys;
}

function languageText(file, key) {
  const [group, section, name] = key.split(".");
  const text = file?.[group]?.[section]?.[name];
  return typeof text === "string" && text.trim() ? text : "";
}

// Opis miejsca (sekcji) w języku Zaplecza — część przed „ — ”, np. „Pasek boczny”.
function sectionLabel(group, section) {
  const layers = [window.IF_LANG?.user, window.IF_LANG?.shipped, window.IF_LANG?.base];
  for (const layer of layers) {
    const desc = layer?.[group]?.[section]?._desc;
    if (typeof desc === "string" && desc.trim()) return desc.split(" — ")[0].trim();
  }
  return `${group}.${section}`;
}

// Przykładowe liczby dla formy liczby mnogiej, np. „few” po polsku → 2, 3, 4, 22.
function pluralExamples(code, form) {
  let rules;
  try { rules = new Intl.PluralRules(code); } catch { return ""; }
  const samples = [0, 1, 2, 3, 4, 5, 6, 11, 12, 21, 22, 25, 100, 101, 102, 105, 111, 112, 1.5];
  return samples.filter((n) => rules.select(n) === form).slice(0, 5).map((n) => n.toLocaleString(code)).join(", ");
}

function pluralForms(code) {
  try { return new Intl.PluralRules(code).resolvedOptions().pluralCategories; } catch { return ["one", "other"]; }
}

// Lista napisów do edycji: kolejność z angielskiego pliku bazowego; napisy z liczbą mnogą
// rozpisane na formy edytowanego języka (polski: one, few, many, other).
function buildEntries(code) {
  const base = window.IF_LANG?.base || {};
  const forms = pluralForms(code);
  const entries = [];
  for (const group of LANG_GROUPS) {
    for (const [section, items] of Object.entries(base[group] || {})) {
      if (section.startsWith("_") || !items || typeof items !== "object") continue;
      const seenPlural = new Set();
      for (const [name, english] of Object.entries(items)) {
        if (name.startsWith("_") || typeof english !== "string") continue;
        const plural = /^(.+)_(zero|one|two|few|many|other)$/.exec(name);
        if (plural && typeof items[`${plural[1]}_other`] === "string") {
          const stem = plural[1];
          if (seenPlural.has(stem)) continue;
          seenPlural.add(stem);
          for (const form of forms) {
            entries.push({ key: `${group}.${section}.${stem}_${form}`, group, section, english: items[`${stem}_${form}`] || items[`${stem}_other`], form });
          }
          continue;
        }
        entries.push({ key: `${group}.${section}.${name}`, group, section, english });
      }
    }
  }
  return entries;
}

function entryValue(key) {
  if (translator.dirty.has(key)) return translator.dirty.get(key);
  return languageText(translator.content?.user, key) || languageText(translator.content?.shipped, key);
}

// Zmienne w napisie, np. {time} — tłumaczenie musi je zachować, inaczej w tym miejscu zabraknie wartości.
function missingVars(english, text) {
  if (!text) return [];
  const vars = [...new Set(english.match(/\{\w+\}/g) || [])];
  return vars.filter((name) => !text.includes(name));
}

// ─── Widok ───────────────────────────────────────────────────────────────────

function renderLanguageTab() {
  return `
    <div class="admin-tab-container">
      <a href="#" class="button module-back-link" data-modules-back>${langT("back")}</a>
      <section class="admin-section-card">
        <h2>${uiIcon("languages", 22)} ${langT("title")}</h2>
        <p class="settings-note">${langT("intro")}</p>
        <div id="languageList"><div class="empty">${langT("loading")}</div></div>
        <p class="settings-note">${langT("choose_note")}</p>
        <div class="translator-tools">
          <a class="button" href="../../lang-en.json" download="en.json">${uiIcon("download", 16)} ${langT("template")}</a>
          <button type="button" class="button" id="trNewToggle">${uiIcon("plus", 16)} ${langT("new_language")}</button>
          <button type="button" class="button" id="trUploadButton">${uiIcon("upload", 16)} ${langT("upload")}</button>
          <input type="file" id="trUpload" accept=".json,application/json" hidden>
        </div>
        <form class="translator-new" id="trNewForm" hidden>
          <label>${langT("new_code")}<input id="trNewCode" placeholder="de" autocomplete="off" maxlength="10"></label>
          <label>${langT("new_name")}<input id="trNewName" placeholder="Deutsch" autocomplete="off" maxlength="60"></label>
          <button type="submit" class="button primary">${uiIcon("plus", 16)} ${langT("create")}</button>
        </form>
        <details class="translator-help">
          <summary>${langT("outside_title")}</summary>
          <ol>
            <li>${langT("outside_1")}</li>
            <li>${langT("outside_2")}</li>
            <li>${langT("outside_3")}</li>
            <li>${langT("outside_4")}</li>
          </ol>
        </details>
      </section>
      <section class="admin-section-card">
        <h2>${uiIcon("pencil", 22)} ${langT("editor_title")}</h2>
        <p class="settings-note">${langT("editor_intro")}</p>
        <div id="languageEditor"><div class="empty">${langT("loading")}</div></div>
      </section>
    </div>`;
}

function bindLanguageEvents() {
  if (typeof bindModulesBackLink === "function") bindModulesBackLink();
  bindLanguageTools();
  loadTranslator();
}

// ─── Zarządzanie językami ────────────────────────────────────────────────────

function bindLanguageTools() {
  const form = document.querySelector("#trNewForm");
  document.querySelector("#trNewToggle").addEventListener("click", () => {
    form.hidden = !form.hidden;
    if (!form.hidden) document.querySelector("#trNewCode").focus();
  });
  form.addEventListener("submit", createLanguage);
  const upload = document.querySelector("#trUpload");
  document.querySelector("#trUploadButton").addEventListener("click", () => upload.click());
  upload.addEventListener("change", () => {
    const file = upload.files?.[0];
    upload.value = "";
    if (file) uploadLanguageFile(file);
  });
  document.querySelector("#languageList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-lang-action]");
    if (!button) return;
    const lang = translator.languages.find((item) => item.code === button.dataset.code);
    if (!lang) return;
    if (button.dataset.langAction === "export") exportLanguage(lang);
    if (button.dataset.langAction === "delete") deleteLanguage(lang);
    if (button.dataset.langAction === "edit") editLanguageFromList(lang.code);
  });
}

async function editLanguageFromList(code) {
  const select = document.querySelector("#trLanguage");
  if (code !== translator.code) {
    if (!(await confirmDiscard())) return;
    await openLanguageForEdit(code);
  }
  (select || document.querySelector("#languageEditor"))?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function createLanguage(event) {
  event.preventDefault();
  const code = document.querySelector("#trNewCode").value.trim();
  const name = document.querySelector("#trNewName").value.trim();
  try {
    if (!(await confirmDiscard())) return;
    await request("/api/languages", { method: "POST", body: JSON.stringify({ code, name }) });
    document.querySelector("#trNewForm").hidden = true;
    document.querySelector("#trNewCode").value = "";
    document.querySelector("#trNewName").value = "";
    showToast(t("mods.language.created", { name, code }));
    translator.code = code;
    translator.dirty = new Map();
    await loadTranslator();
    const status = document.querySelector("#trStatus");
    if (status) { status.value = "missing"; renderEditorRows(); }
    document.querySelector("#languageEditor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showToast(error.message);
  }
}

async function uploadLanguageFile(file) {
  let content;
  try {
    content = JSON.parse(await file.text());
  } catch {
    return showToast(t("mods.language.upload_not_json"));
  }
  const code = String(content?._meta?.code || "").trim();
  // Wgrany wzór angielski bez zmienionego kodu — trzeba podać, na jaki to język.
  if (!code || code === "en") return showToast(t("mods.language.upload_no_code"));
  const existing = translator.languages.find((lang) => lang.code === code);
  if (existing?.user && !(await ifConfirm(t("mods.language.upload_replace", { name: existing.name, code }), { okLabel: t("mods.language.upload_ok"), danger: true }))) return;
  if (!(await confirmDiscard())) return;
  try {
    const data = await request("/api/languages/import", { method: "POST", body: JSON.stringify({ content }) });
    showToast(t("mods.language.uploaded", { code: data.code, imported: data.imported, skipped: data.skipped, untranslated: data.untranslated || 0 }));
    translator.code = data.code;
    translator.dirty = new Map();
    await loadTranslator();
  } catch (error) {
    showToast(error.message);
  }
}

// Eksport: plik języka do pobrania — opisy miejsc, tłumaczenie dostarczone ze stroną i Twoje zmiany razem.
async function exportLanguage(lang) {
  try {
    const content = await request(`/api/languages/${encodeURIComponent(lang.code)}`);
    const out = { _meta: { code: lang.code, name: lang.name } };
    const base = window.IF_LANG?.base || {};
    for (const group of LANG_GROUPS) {
      for (const [section, items] of Object.entries(base[group] || {})) {
        if (section.startsWith("_") || !items || typeof items !== "object") continue;
        const merged = { ...(content.shipped?.[group]?.[section] || {}), ...(content.user?.[group]?.[section] || {}) };
        if (!merged._desc && items._desc) merged._desc = items._desc;
        if (Object.keys(merged).some((key) => !key.startsWith("_"))) {
          out[group] ||= {};
          out[group][section] = { _desc: merged._desc, ...merged };
        }
      }
    }
    const blob = new Blob([JSON.stringify(out, null, 2) + "\n"], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${lang.code}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteLanguage(lang) {
  const key = lang.shipped ? "delete_changes_confirm" : "delete_confirm";
  if (!(await ifConfirm(t(`mods.language.${key}`, { name: lang.name, code: lang.code }), { okLabel: t("mods.language.delete"), danger: true }))) return;
  try {
    const data = await request(`/api/languages/${encodeURIComponent(lang.code)}`, { method: "DELETE" });
    showToast(t(lang.shipped ? "mods.language.deleted_changes" : "mods.language.deleted", { name: lang.name }));
    // Usunięty był wybranym językiem strony → strona wróciła do angielskiego; wczytanie od nowa.
    if (data.current !== translator.current) {
      setTimeout(() => window.location.reload(), 800);
      return;
    }
    if (translator.code === lang.code && !lang.shipped) translator.code = "";
    translator.dirty = new Map();
    await loadTranslator();
  } catch (error) {
    showToast(error.message);
  }
}

async function loadTranslator() {
  try {
    const data = await request("/api/languages");
    translator.languages = data.languages || [];
    translator.current = data.current;
    await renderLanguageList();
    const editable = translator.languages.filter((lang) => !lang.base);
    const start = editable.find((lang) => lang.code === (translator.code || data.current)) || editable[0];
    if (!start) {
      document.querySelector("#languageEditor").innerHTML = `<p class="settings-note">${langT("no_editable")}</p>`;
      return;
    }
    await openLanguageForEdit(start.code);
  } catch (error) {
    const box = document.querySelector("#languageList");
    if (box) box.innerHTML = `<p class="backup-disk-warn">${uiIcon("warning", 14)} ${escapeHtml(error.message)}</p>`;
  }
}

function languageSourceLabel(lang) {
  if (lang.base) return langT("src_base");
  if (lang.shipped && lang.user) return langT("src_shipped_user");
  return langT(lang.shipped ? "src_shipped" : "src_user");
}

async function renderLanguageList() {
  const box = document.querySelector("#languageList");
  if (!box) return;
  const baseKeys = languageKeys(window.IF_LANG?.base);
  const rows = await Promise.all(translator.languages.map(async (lang) => {
    if (lang.base) return { lang, progress: langT("progress_base", { total: baseKeys.length }) };
    const content = await request(`/api/languages/${encodeURIComponent(lang.code)}`);
    const done = baseKeys.filter((key) => languageText(content.user, key) || languageText(content.shipped, key)).length;
    const percent = baseKeys.length ? Math.floor((done / baseKeys.length) * 100) : 0;
    return { lang, progress: langT("progress", { done, total: baseKeys.length, percent }) };
  }));
  if (!document.querySelector("#languageList")) return;
  box.innerHTML = `
    <table class="apps-updates-table language-table" style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr><th>${langT("col_language")}</th><th>${langT("col_progress")}</th><th>${langT("col_source")}</th><th></th></tr></thead>
      <tbody>${rows.map(({ lang, progress }) => `
        <tr>
          <td data-label="${langT("col_language")}"><strong>${escapeHtml(lang.name)}</strong> (${escapeHtml(lang.code)})${lang.code === translator.current ? ` <span class="backup-badge">${langT("current")}</span>` : ""}</td>
          <td data-label="${langT("col_progress")}">${progress}</td>
          <td data-label="${langT("col_source")}">${languageSourceLabel(lang)}</td>
          <td class="upd-wide"><span class="translator-actions">${languageRowActions(lang)}</span></td>
        </tr>`).join("")}
      </tbody>
    </table>`;
}

function languageRowActions(lang) {
  if (lang.base) return `<a class="button" href="../../lang-en.json" download="en.json">${uiIcon("download", 14)} ${langT("template_short")}</a>`;
  const button = (action, icon, label, extra = "") => `<button type="button" class="button${extra}" data-lang-action="${action}" data-code="${escapeHtml(lang.code)}">${uiIcon(icon, 14)} ${label}</button>`;
  return [
    button("edit", "pencil", langT("edit")),
    button("export", "download", langT("export")),
    lang.user ? button("delete", "trash", langT(lang.shipped ? "delete_changes" : "delete"), " danger") : ""
  ].join("");
}

async function openLanguageForEdit(code) {
  const box = document.querySelector("#languageEditor");
  if (!box) return;
  translator.code = code;
  translator.content = await request(`/api/languages/${encodeURIComponent(code)}`);
  translator.entries = buildEntries(code);
  translator.dirty = new Map();
  translator.limit = LANG_PAGE_SIZE;
  box.innerHTML = renderEditorShell();
  bindEditorEvents();
  renderEditorRows();
}

function renderEditorShell() {
  const editable = translator.languages.filter((lang) => !lang.base);
  const groups = { page: langT("grp_page"), admin: langT("grp_admin"), mods: langT("grp_mods") };
  const sections = LANG_GROUPS.map((group) => {
    const list = [...new Set(translator.entries.filter((e) => e.group === group).map((e) => e.section))];
    if (!list.length) return "";
    return `<optgroup label="── ${groups[group]} ──">${list.map((section) =>
      `<option value="${group}.${section}">${escapeHtml(sectionLabel(group, section))}</option>`).join("")}</optgroup>`;
  }).join("");
  return `
    <div class="translator-filters">
      <label>${langT("edit_lang")}
        <select id="trLanguage">${editable.map((lang) => `<option value="${escapeHtml(lang.code)}"${lang.code === translator.code ? " selected" : ""}>${escapeHtml(lang.name)} (${escapeHtml(lang.code)})</option>`).join("")}</select>
      </label>
      <label>${langT("section")}
        <select id="trSection"><option value="">${langT("all_sections")}</option>${sections}</select>
      </label>
      <label>${langT("show")}
        <select id="trStatus">
          <option value="all">${langT("show_all")}</option>
          <option value="missing">${langT("show_untranslated")}</option>
        </select>
      </label>
      <label>${langT("search")}
        <input id="trSearch" type="search" placeholder="${langT("search_placeholder")}" autocomplete="off">
      </label>
    </div>
    <div class="translator-bar">
      <span class="settings-note" id="trCount"></span>
      <span class="translator-actions">
        <button type="button" class="button" id="trRevert" disabled>${langT("revert")}</button>
        <button type="button" class="button primary" id="trSave" disabled>${uiIcon("save", 16)} <span>${langT("save")}</span></button>
      </span>
    </div>
    <div class="translator-head"><span>${langT("col_english")}</span><span>${langT("col_translation")}</span></div>
    <div id="trRows"></div>
    <div class="translator-more" id="trMore"></div>`;
}

function filteredEntries() {
  const section = document.querySelector("#trSection")?.value || "";
  const status = document.querySelector("#trStatus")?.value || "all";
  const query = (document.querySelector("#trSearch")?.value || "").trim().toLocaleLowerCase();
  return translator.entries.filter((entry) => {
    if (section && `${entry.group}.${entry.section}` !== section) return false;
    const value = entryValue(entry.key);
    if (status === "missing" && value) return false;
    if (query && !entry.english.toLocaleLowerCase().includes(query) && !value.toLocaleLowerCase().includes(query)) return false;
    return true;
  });
}

function renderEditorRows() {
  const rowsBox = document.querySelector("#trRows");
  if (!rowsBox) return;
  const list = filteredEntries();
  const shown = list.slice(0, translator.limit);
  let lastSection = "";
  rowsBox.innerHTML = shown.length ? shown.map((entry) => {
    const sectionId = `${entry.group}.${entry.section}`;
    const heading = sectionId !== lastSection ? `<div class="translator-section">${escapeHtml(sectionLabel(entry.group, entry.section))}</div>` : "";
    lastSection = sectionId;
    return heading + renderEditorRow(entry);
  }).join("") : `<p class="settings-note">${langT("no_rows")}</p>`;
  document.querySelector("#trCount").textContent = t("mods.language.shown", { shown: shown.length, total: list.length });
  const more = document.querySelector("#trMore");
  more.innerHTML = list.length > shown.length ? `<button type="button" class="button" id="trShowMore">${langT("more")}</button>` : "";
  document.querySelector("#trShowMore")?.addEventListener("click", () => { translator.limit += LANG_PAGE_SIZE; renderEditorRows(); });
}

function renderEditorRow(entry) {
  const value = entryValue(entry.key);
  const shipped = languageText(translator.content?.shipped, entry.key);
  const own = translator.dirty.has(entry.key) ? value && value !== shipped : Boolean(languageText(translator.content?.user, entry.key));
  const plural = entry.form ? `<span class="translator-note">${langT("plural", { examples: pluralExamples(translator.code, entry.form) || entry.form })}</span>` : "";
  const missing = missingVars(entry.english, value);
  return `
    <div class="translator-row${translator.dirty.has(entry.key) ? " is-dirty" : ""}" data-key="${escapeHtml(entry.key)}">
      <div class="translator-english">${escapeHtml(entry.english)}${plural}</div>
      <div class="translator-target">
        <textarea rows="${Math.min(6, Math.max(1, Math.ceil(entry.english.length / 48)))}" placeholder="${langT("empty_hint")}">${escapeHtml(value)}</textarea>
        <span class="translator-flags">
          ${own && shipped ? `<span class="translator-note">${langT("changed")} · <a href="#" data-restore>${langT("restore_shipped")}</a></span>` : ""}
          ${missing.length ? `<span class="backup-disk-warn">${uiIcon("warning", 14)} ${langT("missing_vars", { vars: missing.join(" ") })}</span>` : ""}
        </span>
      </div>
    </div>`;
}

function updateEditorBar() {
  const count = translator.dirty.size;
  const save = document.querySelector("#trSave");
  const revert = document.querySelector("#trRevert");
  if (save) {
    save.disabled = !count;
    save.querySelector("span").textContent = count ? t("mods.language.save_count", { n: count }) : t("mods.language.save");
  }
  if (revert) revert.disabled = !count;
}

async function confirmDiscard() {
  if (!translator.dirty.size) return true;
  return ifConfirm(t("mods.language.confirm_discard"), { okLabel: t("mods.language.discard_ok"), danger: true });
}

function bindEditorEvents() {
  const refilter = () => { translator.limit = LANG_PAGE_SIZE; renderEditorRows(); };
  document.querySelector("#trSection").addEventListener("change", refilter);
  document.querySelector("#trStatus").addEventListener("change", refilter);
  let searchTimer = null;
  document.querySelector("#trSearch").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(refilter, 250); });

  const languageSelect = document.querySelector("#trLanguage");
  languageSelect.addEventListener("change", async () => {
    if (!(await confirmDiscard())) { languageSelect.value = translator.code; return; }
    openLanguageForEdit(languageSelect.value).catch((error) => showToast(error.message));
  });

  const rows = document.querySelector("#trRows");
  rows.addEventListener("input", (event) => {
    const area = event.target.closest("textarea");
    const row = event.target.closest(".translator-row");
    if (!area || !row) return;
    const key = row.dataset.key;
    const saved = languageText(translator.content?.user, key) || languageText(translator.content?.shipped, key);
    if (area.value === saved || (!area.value.trim() && !saved)) translator.dirty.delete(key);
    else translator.dirty.set(key, area.value);
    row.classList.toggle("is-dirty", translator.dirty.has(key));
    const entry = translator.entries.find((e) => e.key === key);
    const flags = row.querySelector(".translator-flags");
    const missing = entry ? missingVars(entry.english, area.value) : [];
    flags.querySelector(".backup-disk-warn")?.remove();
    if (missing.length) flags.insertAdjacentHTML("beforeend", `<span class="backup-disk-warn">${uiIcon("warning", 14)} ${langT("missing_vars", { vars: missing.join(" ") })}</span>`);
    updateEditorBar();
  });
  rows.addEventListener("click", (event) => {
    const link = event.target.closest("[data-restore]");
    if (!link) return;
    event.preventDefault();
    const row = link.closest(".translator-row");
    const key = row.dataset.key;
    const shipped = languageText(translator.content?.shipped, key);
    if (languageText(translator.content?.user, key)) translator.dirty.set(key, shipped);
    else translator.dirty.delete(key);
    row.outerHTML = renderEditorRow(translator.entries.find((e) => e.key === key));
    updateEditorBar();
  });

  document.querySelector("#trRevert").addEventListener("click", () => {
    translator.dirty = new Map();
    renderEditorRows();
    updateEditorBar();
    showToast(t("mods.language.reverted"));
  });
  document.querySelector("#trSave").addEventListener("click", saveTranslations);
  updateEditorBar();
}

async function saveTranslations() {
  if (!translator.dirty.size) return;
  const button = document.querySelector("#trSave");
  button.disabled = true;
  try {
    const changes = Object.fromEntries(translator.dirty);
    const data = await request(`/api/languages/${encodeURIComponent(translator.code)}`, { method: "PUT", body: JSON.stringify({ changes }) });
    translator.content.user = data.user || {};
    translator.dirty = new Map();
    renderEditorRows();
    updateEditorBar();
    const listing = await request("/api/languages");
    translator.languages = listing.languages || translator.languages;
    renderLanguageList().catch(() => {});
    showToast(t(translator.code === translator.current ? "mods.language.saved_current" : "mods.language.saved", { n: data.saved }));
  } catch (error) {
    showToast(error.message);
    updateEditorBar();
  }
}
