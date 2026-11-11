// tab-backup.js — Zaplecze → Kopia zapasowa. Trzy panele (Darek 9.11.2026):
//   1. Konfiguracja — dysk, jak często, ile kopii,
//   2. Wykonaj kopię zapasową — wszystko (z wyborem części) albo wybrana aplikacja, postęp kopii,
//   3. Przywracanie kopii — wszystko albo wybrana aplikacja, postęp przywracania.
// Kopię i przywracanie robi serwer (zadanie if-backup); strona zapisuje ustawienia i zostawia „karteczkę”.

// Napisy karty (plan „Język”, Etap 3): sekcja admin.backup; dymki i błędy: admin.messages.
const bkT = (key, vars) => escapeHtml(t(`admin.backup.${key}`, vars));

// Nazwa dysku i uwaga przy nim — z części od zadania if-backup (model, USB, etykieta, kod uwagi).
function backupDiskName(d) {
  if (d.model === undefined) return d.nazwa || "";
  return `${d.model || t("admin.backup.disk_default")}${d.zewnetrzny ? " (USB)" : ""}${d.etykieta ? ` — ${d.etykieta}` : ""}`;
}

function backupDiskNote(d) {
  if (d.uwaga_kod && IF_I18N.has(`admin.backup.note_${d.uwaga_kod}`)) return t(`admin.backup.note_${d.uwaga_kod}`, { fs: d.fs || "" });
  return d.uwaga || "";
}

function renderBackupTab() {
  return `
    <div class="admin-tab-container backup-tab">
      <section class="admin-section-card">
        <h2>${uiIcon("settings", 22)} ${bkT("config_title")}</h2>
        <div id="backupConfig"><div class="empty">${bkT("loading")}</div></div>
      </section>
      <div class="admin-section-divider"></div>
      <section class="admin-section-card">
        <h2>${uiIcon("save", 22)} ${bkT("run_title")}</h2>
        <div id="backupProgressKopia"></div>
        <div id="backupRun"><div class="empty">${bkT("loading")}</div></div>
      </section>
      <div class="admin-section-divider"></div>
      <section class="admin-section-card">
        <h2>${uiIcon("refresh", 22)} ${bkT("restore_title")}</h2>
        <div id="backupProgressPrzywracanie"></div>
        <div id="restoreTool"><div class="empty">${bkT("loading")}</div></div>
      </section>
    </div>`;
}

function bindBackupEvents() {
  renderBackupPanels();
  watchBackupProgress();
  window.__activeTabCleanup = () => clearTimeout(backupProgressTimer);
}

// Ile razy zmieści się pełna kopia — liczba według formatów; powyżej 1000 „ponad 1000” (sama liczba
// typu 1411430 nic nie mówi — uwaga z testu v0.6.0).
const FITS_MAX = 1000;
function fitsText(fits) {
  if (!fits) return "";
  return fits > FITS_MAX
    ? bkT("fits_times_over", { n: IF_FORMAT.number(FITS_MAX) })
    : bkT("fits_times", { n: IF_FORMAT.number(fits) });
}

// Wielkość po ludzku: poniżej 1 GB w MB (ustawienia serwera to zwykle kilka MB).
const formatGB = (bytes) => {
  if (bytes == null) return "—";
  if (bytes < 1e9) return `${IF_FORMAT.number(Math.max(1, Math.round(bytes / 1e6)))} MB`;
  return `${IF_FORMAT.number(bytes / 1e9, bytes < 1e10 ? 1 : 0)} GB`;
};

// Nazwa kopii (2026-11-08_2307) → data i godzina według Ustawień ogólnych (Formaty i jednostki),
// np. „8.11.2026, 23:07” albo „11/8/2026, 11:07 PM” — tak samo jak „Ostatnia kopia”.
function backupCopyLabel(name) {
  const m = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})/.exec(name || "");
  if (!m) return name;
  const when = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return IF_FORMAT.dateTime(when) || `${Number(m[3])}.${m[2]}.${m[1]}, ${m[4]}:${m[5]}`;
}

// Dane wspólne dla paneli (dyski, ustawienia, stan) — wczytywane razem.
let backupData = null;

async function renderBackupPanels() {
  try {
    const [disks, status] = await Promise.all([
      request("/api/tools/backup/disks"),
      request("/api/tools/backup/status").catch(() => ({}))
    ]);
    backupData = { disks, status };
  } catch (error) {
    ["#backupConfig", "#backupRun", "#restoreTool"].forEach((id) => {
      const box = document.querySelector(id);
      if (box) box.innerHTML = `<p class="settings-note">${escapeHtml(error.message)}</p>`;
    });
    return;
  }
  renderBackupConfig();
  renderBackupRun();
  renderRestoreTool();
}

// ─── 1. Konfiguracja ─────────────────────────────────────────────────────────

function renderBackupConfig() {
  const box = document.querySelector("#backupConfig");
  if (!box || !backupData) return;
  const data = backupData.disks;
  if (!data.available) {
    box.innerHTML = `
      <p class="settings-note">${bkT("no_disk_list")}</p>
      <button type="button" class="primary" id="btnBackupScan">${uiIcon("search", 16)} ${bkT("scan")}</button>
      <p class="settings-note" id="backupScanNote"></p>`;
    box.querySelector("#btnBackupScan").addEventListener("click", () => scanBackupDisks(null));
    return;
  }
  const s = data.settings || {};
  box.innerHTML = `
    <h3 class="backup-step">${bkT("pick_disk")}</h3>
    <p class="settings-note" style="margin:-4px 0 10px;">${bkT("pick_disk_hint")}</p>
    <div class="backup-disks">
      ${data.disks.map((d) => `
        <label class="backup-disk${d.nadaje ? "" : " is-disabled"}">
          <input type="radio" name="backupDisk" value="${escapeHtml(d.id)}"${d.id === s.dysk ? " checked" : ""}${d.nadaje ? "" : " disabled"}>
          <span>
            <strong>${escapeHtml(backupDiskName(d))}${d.zewnetrzny && d.nadaje ? ` <span class="backup-badge">${bkT("recommended")}</span>` : ""}</strong>
            <span class="settings-note">${bkT("disk_free", { free: formatGB(d.wolne), size: formatGB(d.wielkosc) })}</span>
            ${backupDiskNote(d) ? `<span class="backup-disk-warn">${uiIcon("warning", 14)} ${escapeHtml(backupDiskNote(d))}</span>` : ""}
          </span>
        </label>`).join("")}
    </div>
    <p class="settings-note" id="backupScanNote">${bkT("checked", { date: data.checkedAt ? IF_FORMAT.dateTime(data.checkedAt) : "—" })}${data.pending ? bkT("checking") : ""}
      <button type="button" class="backup-link" id="btnBackupScan">${uiIcon("refresh", 14)} ${bkT("scan")}</button></p>

    <h3 class="backup-step">${bkT("freq_title")}</h3>
    <div class="backup-important">${uiIcon("warning", 16)} <span><strong>${bkT("important")}</strong> ${bkT("important_text")}</span></div>
    <div class="backup-frequency">
      ${[["codziennie", "freq_daily"], ["co-tydzien", "freq_weekly"], ["recznie", "freq_manual"]].map(([value, label]) => `
        <label><input type="radio" name="backupFrequency" value="${value}"${(s.czestotliwosc || "codziennie") === value ? " checked" : ""}> ${bkT(label)}</label>`).join("")}
    </div>
    <label class="backup-count">${bkT("count")} <input type="number" id="backupCount" min="1" max="60" value="${Number(s.ile) || 7}"></label>
    <p class="settings-note">${bkT("count_note")}</p>

    <div class="backup-actions">
      <button type="button" class="primary" id="btnBackupSave">${uiIcon("save", 16)} ${bkT("save_settings")}</button>
    </div>`;
  box.querySelector("#btnBackupScan").addEventListener("click", () => scanBackupDisks(data.checkedAt));
  box.querySelector("#btnBackupSave").addEventListener("click", () => saveBackupSettings({ toast: true }));
  box.querySelectorAll('input[name="backupDisk"]').forEach((input) => input.addEventListener("change", updateBackupSizeNote));
}

// Zapis ustawień: dysk, częstotliwość i liczba (panel 1) oraz części kopii „Wszystko” (panel 2).
async function saveBackupSettings({ toast = false } = {}) {
  const s = backupData?.disks?.settings || {};
  const dysk = document.querySelector('input[name="backupDisk"]:checked')?.value || s.dysk;
  if (!dysk) {
    if (toast) showToast(t("admin.messages.backup_pick_disk_toast"));
    return;
  }
  const zakres = { ...(s.zakres || {}) };
  document.querySelectorAll(".backup-scope input").forEach((input) => { zakres[input.dataset.scope] = input.checked; });
  const body = {
    dysk,
    zakres,
    czestotliwosc: document.querySelector('input[name="backupFrequency"]:checked')?.value || s.czestotliwosc || "codziennie",
    ile: Number(document.querySelector("#backupCount")?.value || s.ile || 7)
  };
  try {
    const result = await request("/api/tools/backup/settings", { method: "PUT", body: JSON.stringify(body) });
    if (backupData) backupData.disks.settings = result.settings;
    if (toast) showToast(t("admin.messages.backup_settings_saved"));
    // Szacunek „Twoich plików” zależy od wybranego dysku — przy zmianie dysku serwer liczy go na nowo.
    if (result.diskChanged) scanBackupDisks(null);
    else renderBackupRun();
  } catch (error) {
    showToast(error.message);
  }
}

// „Karteczka” dla serwera i czekanie na nową listę dysków (najwyżej 2 minuty).
async function scanBackupDisks(previousCheckedAt) {
  const note = document.querySelector("#backupScanNote");
  try {
    await request("/api/tools/backup/scan", { method: "POST" });
  } catch (error) {
    return showToast(error.message);
  }
  if (note) note.textContent = t("admin.backup.scanning");
  for (let i = 0; i < 40; i++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    if (!document.querySelector("#backupConfig")) return;
    try {
      const data = await request("/api/tools/backup/disks");
      if (data.available && !data.pending && data.checkedAt !== previousCheckedAt) return renderBackupPanels();
    } catch {}
  }
  if (note) note.textContent = t("admin.backup.scan_no_answer");
}

// ─── 2. Wykonaj kopię zapasową ───────────────────────────────────────────────

function renderBackupRun() {
  const box = document.querySelector("#backupRun");
  if (!box || !backupData) return;
  const data = backupData.disks;
  const status = backupData.status || {};
  const s = data.settings || {};
  if (!s.dysk) {
    box.innerHTML = `<p class="settings-note">${bkT("need_disk")}</p>`;
    return;
  }
  const est = data.estimate || {};
  const scope = s.zakres || {};
  const apps = data.apps || [];
  const last = status.last;
  const when = last?.data ? IF_FORMAT.dateTime(last.data) : "";
  const lastText = !last
    ? bkT("last_none")
    : last.wynik === "ok"
      ? bkT("last_ok", { part: last.czesciowa ? t("admin.backup.last_part", { app: last.czesciowa }) : "", when: "{when}", size: formatGB(last.rozmiar), minutes: Math.max(1, Math.round((last.czas_s || 0) / 60)), copies: status.copies?.length || 0 }).replace("{when}", `<strong>${escapeHtml(when)}</strong>`)
      : `<span class="backup-disk-warn">${uiIcon("warning", 14)} ${bkT("last_failed", { when, error: backupJobText(last.kod, last.zmienne, last.komunikat, "admin.backup") })}</span>`;
  const running = status.state === "trwa";
  box.innerHTML = `
    <p class="settings-note" style="margin-top:0;">${lastText}</p>
    <div class="backup-what">
      <label class="backup-what-option"><input type="radio" name="backupWhat" value="all" checked> <strong>${bkT("everything")}</strong></label>
      <div class="backup-scope">
        ${backupScopeItem("aplikacje", t("admin.backup.scope_apps"), est.aplikacje, scope.aplikacje)}
        ${backupScopeItem("pliki", t("admin.backup.scope_files"), est.pliki, scope.pliki)}
        ${backupScopeItem("ustawienia", t("admin.backup.scope_settings"), est.ustawienia, scope.ustawienia)}
        <p class="settings-note" id="backupSizeNote"></p>
        <p class="settings-note">${bkT("scope_note")}</p>
      </div>
      <label class="backup-what-option"><input type="radio" name="backupWhat" value="app"${apps.length ? "" : " disabled"}> <strong>${bkT("one_app")}</strong>
        <select id="backupApp"${apps.length ? "" : " disabled"}>${apps.map((a) => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join("")}</select>
      </label>
    </div>
    <div class="backup-actions">
      <button type="button" class="primary" id="btnBackupRun"${running ? " disabled" : ""}>${uiIcon("save", 16)} ${bkT(running ? "running" : "run_now")}</button>
    </div>`;
  box.querySelectorAll(".backup-scope input").forEach((input) => input.addEventListener("change", () => {
    updateBackupSizeNote();
    saveBackupSettings();   // ptaszki zapamiętywane od razu — dotyczą też kopii automatycznych
  }));
  box.querySelector("#backupApp")?.addEventListener("change", () => { box.querySelector('input[name="backupWhat"][value="app"]').checked = true; });
  box.querySelector("#btnBackupRun").addEventListener("click", runBackupNow);
  updateBackupSizeNote();
}

function backupScopeItem(key, label, bytes, checked) {
  return `<label class="backup-scope-item"><input type="checkbox" data-scope="${key}"${checked === false ? "" : " checked"}> <span>${escapeHtml(label)}</span> <span class="settings-note">${bkT("about", { size: formatGB(bytes) })}</span></label>`;
}

// Wielkość pierwszej kopii (pełnej) wobec wolnego miejsca na wybranym dysku.
function updateBackupSizeNote() {
  const note = document.querySelector("#backupSizeNote");
  if (!note || !backupData) return;
  const data = backupData.disks;
  const est = data.estimate || {};
  const total = [...document.querySelectorAll(".backup-scope input:checked")].reduce((sum, input) => sum + (Number(est[input.dataset.scope]) || 0), 0);
  const diskId = document.querySelector('input[name="backupDisk"]:checked')?.value || data.settings?.dysk;
  const disk = data.disks.find((d) => d.id === diskId);
  if (!disk) {
    note.textContent = t("admin.backup.first_copy", { size: formatGB(total) });
    return;
  }
  const fits = total ? Math.floor(Number(disk.wolne) / total) : 0;
  note.innerHTML = total > Number(disk.wolne)
    ? `<span class="backup-disk-warn">${uiIcon("warning", 14)} ${bkT("first_too_big", { size: formatGB(total), free: formatGB(disk.wolne) })}</span>`
    : `${bkT("first_fits", { size: formatGB(total), free: formatGB(disk.wolne) })}${fitsText(fits)}.`;
}

async function runBackupNow() {
  const app = document.querySelector('input[name="backupWhat"]:checked')?.value === "app";
  const aplikacja = app ? document.querySelector("#backupApp")?.value || "" : "";
  if (!app && !document.querySelector(".backup-scope input:checked")) return showToast(t("admin.messages.backup_nothing_toast"));
  try {
    await request("/api/tools/backup/run", { method: "POST", body: JSON.stringify({ aplikacja }) });
    notifyBackupStarted();
    const btn = document.querySelector("#btnBackupRun");
    if (btn) { btn.disabled = true; btn.innerHTML = `${uiIcon("save", 16)} ${bkT("running")}`; }
    watchBackupProgress();
  } catch (error) {
    showToast(error.message);
  }
}

// ─── 3. Przywracanie kopii ───────────────────────────────────────────────────

async function renderRestoreTool() {
  const box = document.querySelector("#restoreTool");
  if (!box) return;
  const list = await request("/api/tools/backup/copies").catch(() => ({ copies: [] }));
  const status = backupData?.status || {};
  const copies = [...(list.copies || [])].reverse();
  if (!copies.length) {
    box.innerHTML = `<p class="settings-note">${bkT("no_copies")}</p>`;
    return;
  }
  const r = status.lastRestore;
  const lastText = !r ? "" : r.wynik === "ok"
    ? `<p class="settings-note">${bkT("last_restore_ok", { app: "{app}", copy: backupCopyLabel(r.kopia), when: IF_FORMAT.dateTime(r.data), moved: "{moved}" })
        .replace("{app}", `<strong>${escapeHtml(r.wszystkie ? t("admin.backup.all_apps") : r.aplikacja)}</strong>`)
        .replace("{moved}", `<code>${escapeHtml(r.odlozone || "")}</code>`)}</p>`
    : `<p class="backup-disk-warn">${uiIcon("warning", 14)} ${bkT("last_restore_failed", { error: backupJobText(r.kod, r.zmienne, r.komunikat, "admin.backup") })}</p>`;
  box.innerHTML = `
    <p class="settings-note" style="margin-top:0;">${bkT("restore_intro").replace("{folder}", "<code>~/backups/przed-przywroceniem</code>")}</p>
    <div class="restore-form">
      <label>${bkT("copy")}
        <select id="restoreCopy">${copies.map((c) => `<option value="${escapeHtml(c.nazwa)}">${escapeHtml(backupCopyLabel(c.nazwa))}${c.czesciowa ? bkT("copy_only", { app: c.czesciowa }) : ""}${c.rozmiar ? ` — ${formatGB(c.rozmiar)}` : ""}</option>`).join("")}</select>
      </label>
      <label>${bkT("what_restore")}
        <select id="restoreApp"></select>
      </label>
      <button type="button" class="button danger" id="btnRestore">${uiIcon("refresh", 16)} ${bkT("restore")}</button>
    </div>
    ${lastText}
    <p class="settings-note">${bkT("server_restore").replace("{program}", "<code>if-server</code>")}</p>`;
  const fillApps = () => {
    const copy = copies.find((c) => c.nazwa === box.querySelector("#restoreCopy").value);
    const apps = copy?.aplikacje || [];
    box.querySelector("#restoreApp").innerHTML = (apps.length > 1 ? `<option value="*">${bkT("restore_all")}</option>` : "")
      + apps.map((a) => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join("");
  };
  box.querySelector("#restoreCopy").addEventListener("change", fillApps);
  fillApps();
  box.querySelector("#btnRestore").disabled = status.state === "trwa";
  box.querySelector("#btnRestore").addEventListener("click", restoreApp);
}

async function restoreApp() {
  const kopia = document.querySelector("#restoreCopy")?.value;
  const aplikacja = document.querySelector("#restoreApp")?.value;
  if (!kopia || !aplikacja) return showToast(t("admin.messages.restore_pick"));
  const all = aplikacja === "*";
  const ok = await ifConfirm(all
    ? t("admin.backup.confirm_all", { copy: backupCopyLabel(kopia) })
    : t("admin.backup.confirm_one", { app: aplikacja, copy: backupCopyLabel(kopia) }),
    { title: t(all ? "admin.backup.confirm_all_title" : "admin.backup.confirm_one_title"), okLabel: t("admin.backup.restore"), danger: true });
  if (!ok) return;
  try {
    await request("/api/tools/backup/restore", { method: "POST", body: JSON.stringify({ kopia, aplikacja }) });
    notifyBackupStarted();
    document.querySelector("#btnRestore").disabled = true;
    watchBackupProgress();
  } catch (error) {
    showToast(error.message);
  }
}

// ─── Postęp: pasek kopii w panelu 2, pasek przywracania w panelu 3 ──────────────

// Strona główna (otwarta w innej karcie) od razu pokazuje pasek — bez czekania na swoje sprawdzenie.
function notifyBackupStarted() {
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("homedash_sync");
      channel.postMessage({ type: "backup_started" });
      channel.close();
    }
  } catch {}
}

let backupProgressTimer = null;
let backupProgressWasRunning = false;

async function watchBackupProgress() {
  clearTimeout(backupProgressTimer);
  const boxKopia = document.querySelector("#backupProgressKopia");
  const boxPrzywracanie = document.querySelector("#backupProgressPrzywracanie");
  if (!boxKopia || !boxPrzywracanie) return;
  let running = false;
  try {
    const s = await request("/api/tools/backup/status");
    running = s.state === "trwa";
    const restore = s.kind === "przywracanie";
    const bar = running ? `
      <div class="backup-progress-box">
        <strong>${bkT(restore ? "progress_restore" : "progress_backup", { percent: s.percent })}</strong> <span class="settings-note">${escapeHtml(backupStepText(s, "admin.backup"))}</span>
        <span class="backup-progress"><span style="width:${s.percent}%"></span></span>
      </div>` : "";
    boxKopia.innerHTML = running && !restore ? bar : "";
    boxPrzywracanie.innerHTML = running && restore ? bar : "";
    if (backupProgressWasRunning && !running) {
      renderBackupPanels();
      backupResultDialog(s);
    }
  } catch {}
  backupProgressWasRunning = running;
  if (running) backupProgressTimer = setTimeout(watchBackupProgress, 2000);
}
