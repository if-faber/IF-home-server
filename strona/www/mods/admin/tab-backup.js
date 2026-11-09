// tab-backup.js — Zaplecze → Kopia zapasowa. Trzy panele (Darek 9.11.2026):
//   1. Konfiguracja — dysk, jak często, ile kopii,
//   2. Wykonaj kopię zapasową — wszystko (z wyborem części) albo wybrana aplikacja, postęp kopii,
//   3. Przywracanie kopii — wszystko albo wybrana aplikacja, postęp przywracania.
// Kopię i przywracanie robi serwer (zadanie if-backup); strona zapisuje ustawienia i zostawia „karteczkę”.

function renderBackupTab() {
  return `
    <div class="admin-tab-container backup-tab">
      <section class="admin-section-card">
        <h2>${uiIcon("settings", 22)} Konfiguracja</h2>
        <div id="backupConfig"><div class="empty">Wczytywanie…</div></div>
      </section>
      <div class="admin-section-divider"></div>
      <section class="admin-section-card">
        <h2>${uiIcon("save", 22)} Wykonaj kopię zapasową</h2>
        <div id="backupProgressKopia"></div>
        <div id="backupRun"><div class="empty">Wczytywanie…</div></div>
      </section>
      <div class="admin-section-divider"></div>
      <section class="admin-section-card">
        <h2>${uiIcon("refresh", 22)} Przywracanie kopii</h2>
        <div id="backupProgressPrzywracanie"></div>
        <div id="restoreTool"><div class="empty">Wczytywanie…</div></div>
      </section>
    </div>`;
}

function bindBackupEvents() {
  renderBackupPanels();
  watchBackupProgress();
  window.__activeTabCleanup = () => clearTimeout(backupProgressTimer);
}

// Wielkość po ludzku: poniżej 1 GB w MB (ustawienia serwera to zwykle kilka MB).
const formatGB = (bytes) => {
  if (bytes == null) return "—";
  if (bytes < 1e9) return `${Math.max(1, Math.round(bytes / 1e6)).toLocaleString("pl-PL")} MB`;
  return `${(bytes / 1e9).toLocaleString("pl-PL", { maximumFractionDigits: bytes < 1e10 ? 1 : 0 })} GB`;
};

// Nazwa kopii (2026-11-08_2307) → „8.11.2026, 23:07”.
function backupCopyLabel(name) {
  const m = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})/.exec(name || "");
  return m ? `${Number(m[3])}.${m[2]}.${m[1]}, ${m[4]}:${m[5]}` : name;
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
      <p class="settings-note">Serwer nie przygotował jeszcze listy dysków.</p>
      <button type="button" class="primary" id="btnBackupScan">${uiIcon("search", 16)} Sprawdź dyski</button>
      <p class="settings-note" id="backupScanNote"></p>`;
    box.querySelector("#btnBackupScan").addEventListener("click", () => scanBackupDisks(null));
    return;
  }
  const s = data.settings || {};
  box.innerHTML = `
    <h3 class="backup-step">Wybierz dysk dla kopii zapasowych</h3>
    <p class="settings-note" style="margin:-4px 0 10px;">Zalecamy dysk zewnętrzny (USB) — kopia przetrwa awarię serwera.</p>
    <div class="backup-disks">
      ${data.disks.map((d) => `
        <label class="backup-disk${d.nadaje ? "" : " is-disabled"}">
          <input type="radio" name="backupDisk" value="${escapeHtml(d.id)}"${d.id === s.dysk ? " checked" : ""}${d.nadaje ? "" : " disabled"}>
          <span>
            <strong>${escapeHtml(d.nazwa)}${d.zewnetrzny && d.nadaje ? ' <span class="backup-badge">Zalecany</span>' : ""}</strong>
            <span class="settings-note">wolne ${formatGB(d.wolne)} z ${formatGB(d.wielkosc)}</span>
            ${d.uwaga ? `<span class="backup-disk-warn">${uiIcon("warning", 14)} ${escapeHtml(d.uwaga)}</span>` : ""}
          </span>
        </label>`).join("")}
    </div>
    <p class="settings-note" id="backupScanNote">Sprawdzono: ${data.checkedAt ? new Date(data.checkedAt).toLocaleString("pl-PL") : "—"}${data.pending ? " · serwer sprawdza dyski…" : ""}
      <button type="button" class="backup-link" id="btnBackupScan">${uiIcon("refresh", 14)} Sprawdź dyski</button></p>

    <h3 class="backup-step">Jak często i ile kopii</h3>
    <div class="backup-important">${uiIcon("warning", 16)} <span><strong>Ważne!</strong> W zależności od posiadanego miejsca sam wybierz ilość kopii zapasowych oraz sposób (częstotliwość) ich tworzenia.</span></div>
    <div class="backup-frequency">
      ${[["codziennie", "codziennie"], ["co-tydzien", "co tydzień"], ["recznie", "tylko ręcznie"]].map(([value, label]) => `
        <label><input type="radio" name="backupFrequency" value="${value}"${(s.czestotliwosc || "codziennie") === value ? " checked" : ""}> ${label}</label>`).join("")}
    </div>
    <label class="backup-count">Ile kopii trzymać — każdego rodzaju <input type="number" id="backupCount" min="1" max="60" value="${Number(s.ile) || 7}"></label>
    <p class="settings-note">Liczy się osobno: kopie „Wszystko” i kopie każdej aplikacji (np. przy 7 — siedem kopii „Wszystko” i osobno siedem kopii samej poczty).
      Gdy kopii danego rodzaju będzie więcej, najstarsza z nich zostanie usunięta. Kopia jednej aplikacji nigdy nie usuwa kopii innej aplikacji ani kopii „Wszystko”.</p>

    <div class="backup-actions">
      <button type="button" class="primary" id="btnBackupSave">${uiIcon("save", 16)} Zapisz ustawienia</button>
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
    if (toast) showToast("Wybierz dysk z listy.");
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
    if (toast) showToast("Ustawienia kopii zapasowej zapisane.");
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
  if (note) note.textContent = "Serwer sprawdza dyski… (to może potrwać minutę)";
  for (let i = 0; i < 40; i++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    if (!document.querySelector("#backupConfig")) return;
    try {
      const data = await request("/api/tools/backup/disks");
      if (data.available && !data.pending && data.checkedAt !== previousCheckedAt) return renderBackupPanels();
    } catch {}
  }
  if (note) note.textContent = "Serwer nie odpowiada. W terminalu serwera: sudo if-server → Upgrade (ustawia zadanie kopii zapasowej).";
}

// ─── 2. Wykonaj kopię zapasową ───────────────────────────────────────────────

function renderBackupRun() {
  const box = document.querySelector("#backupRun");
  if (!box || !backupData) return;
  const data = backupData.disks;
  const status = backupData.status || {};
  const s = data.settings || {};
  if (!s.dysk) {
    box.innerHTML = '<p class="settings-note">Najpierw wybierz dysk w Konfiguracji i zapisz ustawienia.</p>';
    return;
  }
  const est = data.estimate || {};
  const scope = s.zakres || {};
  const apps = data.apps || [];
  const last = status.last;
  const when = last?.data ? new Date(last.data).toLocaleString("pl-PL") : "";
  const lastText = !last
    ? "Nie zrobiono jeszcze żadnej kopii."
    : last.wynik === "ok"
      ? `Ostatnia kopia${last.czesciowa ? ` (tylko ${escapeHtml(last.czesciowa)})` : ""}: <strong>${escapeHtml(when)}</strong> — udana (${formatGB(last.rozmiar)}, ${Math.max(1, Math.round((last.czas_s || 0) / 60))} min). Kopii na dysku: ${status.copies?.length || 0}.`
      : `<span class="backup-disk-warn">${uiIcon("warning", 14)} Ostatnia kopia (${escapeHtml(when)}) nie powiodła się: ${escapeHtml(last.komunikat || "")}</span>`;
  const running = status.state === "trwa";
  box.innerHTML = `
    <p class="settings-note" style="margin-top:0;">${lastText}</p>
    <div class="backup-what">
      <label class="backup-what-option"><input type="radio" name="backupWhat" value="all" checked> <strong>Wszystko</strong></label>
      <div class="backup-scope">
        ${backupScopeItem("aplikacje", "Aplikacje i ich dane", est.aplikacje, scope.aplikacje)}
        ${backupScopeItem("pliki", "Twoje pliki", est.pliki, scope.pliki)}
        ${backupScopeItem("ustawienia", "Ustawienia serwera (udostępnianie plików, drukarki)", est.ustawienia, scope.ustawienia)}
        <p class="settings-note" id="backupSizeNote"></p>
        <p class="settings-note">Według tych ptaszków robią się też kopie automatyczne (Konfiguracja → jak często).</p>
      </div>
      <label class="backup-what-option"><input type="radio" name="backupWhat" value="app"${apps.length ? "" : " disabled"}> <strong>Wybrana aplikacja</strong>
        <select id="backupApp"${apps.length ? "" : " disabled"}>${apps.map((a) => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join("")}</select>
      </label>
    </div>
    <div class="backup-actions">
      <button type="button" class="primary" id="btnBackupRun"${running ? " disabled" : ""}>${uiIcon("save", 16)} ${running ? "Trwa…" : "Zrób kopię teraz"}</button>
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
  return `<label class="backup-scope-item"><input type="checkbox" data-scope="${key}"${checked === false ? "" : " checked"}> <span>${escapeHtml(label)}</span> <span class="settings-note">ok. ${formatGB(bytes)}</span></label>`;
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
    note.textContent = `Pierwsza kopia: ok. ${formatGB(total)}.`;
    return;
  }
  const fits = total ? Math.floor(Number(disk.wolne) / total) : 0;
  note.innerHTML = total > Number(disk.wolne)
    ? `<span class="backup-disk-warn">${uiIcon("warning", 14)} Pierwsza kopia (ok. ${formatGB(total)}) nie zmieści się na tym dysku (wolne ${formatGB(disk.wolne)}).</span>`
    : `Pierwsza kopia: ok. ${formatGB(total)} · wolne na dysku: ${formatGB(disk.wolne)}. Kolejne kopie zajmują tylko to, co się zmieniło${fits ? ` — miejsca starczy na pełną kopię ok. ${fits} razy` : ""}.`;
}

async function runBackupNow() {
  const app = document.querySelector('input[name="backupWhat"]:checked')?.value === "app";
  const aplikacja = app ? document.querySelector("#backupApp")?.value || "" : "";
  if (!app && !document.querySelector(".backup-scope input:checked")) return showToast("Zaznacz co najmniej jedną rzecz do kopiowania.");
  try {
    await request("/api/tools/backup/run", { method: "POST", body: JSON.stringify({ aplikacja }) });
    notifyBackupStarted();
    const btn = document.querySelector("#btnBackupRun");
    if (btn) { btn.disabled = true; btn.innerHTML = `${uiIcon("save", 16)} Trwa…`; }
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
    box.innerHTML = '<p class="settings-note">Na dysku nie ma jeszcze żadnej kopii (albo lista nie jest odświeżona — „Sprawdź dyski” w Konfiguracji).</p>';
    return;
  }
  const r = status.lastRestore;
  const lastText = !r ? "" : r.wynik === "ok"
    ? `<p class="settings-note">Ostatnie przywrócenie: <strong>${escapeHtml(r.aplikacja)}</strong> z kopii ${escapeHtml(backupCopyLabel(r.kopia))} (${escapeHtml(new Date(r.data).toLocaleString("pl-PL"))}). Dane sprzed przywrócenia: <code>${escapeHtml(r.odlozone || "")}</code></p>`
    : `<p class="backup-disk-warn">${uiIcon("warning", 14)} Ostatnie przywrócenie nie powiodło się: ${escapeHtml(r.komunikat || "")}</p>`;
  box.innerHTML = `
    <p class="settings-note" style="margin-top:0;">Przywraca aplikacje (pliki, dane i wolumeny) ze stanu z wybranej kopii.
      Obecne dane nie są kasowane — trafiają do <code>~/backups/przed-przywroceniem</code>.</p>
    <div class="restore-form">
      <label>Kopia
        <select id="restoreCopy">${copies.map((c) => `<option value="${escapeHtml(c.nazwa)}">${escapeHtml(backupCopyLabel(c.nazwa))}${c.czesciowa ? ` — tylko ${escapeHtml(c.czesciowa)}` : ""}${c.rozmiar ? ` — ${formatGB(c.rozmiar)}` : ""}</option>`).join("")}</select>
      </label>
      <label>Co przywrócić
        <select id="restoreApp"></select>
      </label>
      <button type="button" class="button danger" id="btnRestore">${uiIcon("refresh", 16)} Przywróć</button>
    </div>
    ${lastText}
    <p class="settings-note">Cały serwer po awarii (nowy Debian) przywraca program <code>if-server</code>.</p>`;
  const fillApps = () => {
    const copy = copies.find((c) => c.nazwa === box.querySelector("#restoreCopy").value);
    const apps = copy?.aplikacje || [];
    box.querySelector("#restoreApp").innerHTML = (apps.length > 1 ? `<option value="*">Wszystko (wszystkie aplikacje z tej kopii)</option>` : "")
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
  if (!kopia || !aplikacja) return showToast("Wybierz kopię i co przywrócić.");
  const all = aplikacja === "*";
  const ok = await ifConfirm(all
    ? `Przywrócić WSZYSTKIE aplikacje ze stanu z ${backupCopyLabel(kopia)}?\n\nKażda aplikacja wróci do stanu z tej kopii — zmiany zrobione później znikną z aplikacji. Aplikacje będą po kolei zatrzymywane. Ich obecne dane nie zostaną usunięte — trafią do ~/backups/przed-przywroceniem.`
    : `Przywrócić „${aplikacja}” ze stanu z ${backupCopyLabel(kopia)}?\n\nAplikacja zostanie na chwilę zatrzymana. Jej obecne dane nie zostaną usunięte — trafią do ~/backups/przed-przywroceniem.`,
    { title: all ? "Przywracanie wszystkich aplikacji" : "Przywracanie aplikacji", okLabel: "Przywróć", danger: true });
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
        <strong>${restore ? "Przywracanie" : "Kopia zapasowa"}: ${s.percent}%</strong> <span class="settings-note">${escapeHtml(s.step || "")}</span>
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
