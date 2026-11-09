// tab-apps.js — Zakładka Aplikacje: podmenu Aktualizacje (wersje aplikacji) i Instalator.
// Pakiety Debiana i wersja IF-home-server są tylko informacją w Statusie serwera
// na stronie głównej (Darek 9.11.2026).

const APPS_SUBTABS = [
  { id: "updates", label: "Aktualizacje", icon: "refresh" },
  { id: "installer", label: "Instalator", icon: "plus" }
];

function renderAppsTab() {
  const sub = APPS_SUBTABS.some((t) => t.id === state.appsSubTab) ? state.appsSubTab : "updates";
  const subnav = APPS_SUBTABS.map((t) => `
    <button type="button" class="apps-subnav-btn${t.id === sub ? " active" : ""}" data-apps-sub="${t.id}">${uiIcon(t.icon, 16)} ${escapeHtml(t.label)}</button>`).join("");
  return `
    <div class="admin-tab-container">
      <nav class="apps-subnav">${subnav}</nav>
      ${sub === "installer" ? renderAppsInstaller() : renderAppsUpdates()}
    </div>
  `;
}

// ─── Instalator (Darek 9.11.2026) ─────────────────────────────────────────────
// Nazwa i kategoria → oryginalny compose (+ .env) → „Dostosuj” → compose IF z listą zmian →
// „Zatwierdź” (serwer zakłada foldery i sprawdza compose, zadanie if-aplikacje) → Dockge.
const installerDraft = { name: "", category: "dashboard", compose: "", env: "", adapted: "", adaptedEnv: "", changes: null };

function renderAppsInstaller() {
  const categories = typeof PORT_HINTS === "object" ? PORT_HINTS : {};
  const options = Object.entries(categories).map(([id, hint]) =>
    `<option value="${escapeHtml(id)}"${id === installerDraft.category ? " selected" : ""}>${escapeHtml(hint.label)} (${escapeHtml(hint.range)})</option>`).join("");
  return `
      <section class="admin-section-card installer">
        <h2>${uiIcon("plus", 22)} Instalator aplikacji</h2>
        <p class="settings-note">Wklej compose z repozytorium aplikacji (np. z GitHuba). Instalator dopasuje go do serwera: dane w <code>app-data</code> (obejmie je kopia zapasowa), stała wersja zamiast „latest”, wolne porty, automatyczny start i strefa czasowa. Każdą zmianę zobaczysz przed zapisem.</p>

        <div class="installer-row">
          <label>Nazwa aplikacji
            <input id="installerName" placeholder="np. immich" autocomplete="off" value="${escapeHtml(installerDraft.name)}">
          </label>
          <label>Rodzaj aplikacji (pula portów)
            <select id="installerCategory">${options}</select>
          </label>
        </div>

        <div class="installer-columns">
          <div class="installer-col">
            <h3>1. Oryginalny compose</h3>
            <textarea id="installerCompose" spellcheck="false" placeholder="services:&#10;  aplikacja:&#10;    image: ...">${escapeHtml(installerDraft.compose)}</textarea>
            <details class="installer-env"${installerDraft.env ? " open" : ""}>
              <summary>Plik .env (jeśli aplikacja go ma)</summary>
              <textarea id="installerEnv" spellcheck="false" placeholder="KLUCZ=wartość">${escapeHtml(installerDraft.env)}</textarea>
            </details>
            <button type="button" class="button primary" id="btnInstallerAdapt">${uiIcon("repeat", 16)} Dostosuj</button>
          </div>
          <div class="installer-col">
            <h3>2. Compose dla serwera IF</h3>
            <textarea id="installerAdapted" spellcheck="false" placeholder="Tu pojawi się compose po „Dostosuj”. Możesz go jeszcze poprawić.">${escapeHtml(installerDraft.adapted)}</textarea>
            <details class="installer-env"${installerDraft.adaptedEnv ? " open" : ""}>
              <summary>Plik .env dla serwera IF</summary>
              <textarea id="installerAdaptedEnv" spellcheck="false">${escapeHtml(installerDraft.adaptedEnv)}</textarea>
            </details>
            <button type="button" class="button primary" id="btnInstallerCommit"${installerDraft.adapted ? "" : " disabled"}>${uiIcon("ok", 16)} Zatwierdź</button>
          </div>
        </div>

        <div id="installerChanges">${renderInstallerChanges()}</div>
        <div id="installerResult"></div>
      </section>`;
}

function renderInstallerChanges() {
  if (!installerDraft.changes) return "";
  if (!installerDraft.changes.length) return `<div class="installer-changes"><strong>Co zmieniłem</strong><p class="settings-note">Nic — compose już pasuje do serwera.</p></div>`;
  return `<div class="installer-changes"><strong>Co zmieniłem i dlaczego</strong><ul>${installerDraft.changes.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul></div>`;
}

function bindInstallerEvents() {
  const keep = () => {
    installerDraft.name = document.querySelector("#installerName").value.trim().toLowerCase();
    installerDraft.category = document.querySelector("#installerCategory").value;
    installerDraft.compose = document.querySelector("#installerCompose").value;
    installerDraft.env = document.querySelector("#installerEnv").value;
    installerDraft.adapted = document.querySelector("#installerAdapted").value;
    installerDraft.adaptedEnv = document.querySelector("#installerAdaptedEnv").value;
    document.querySelector("#btnInstallerCommit").disabled = !installerDraft.adapted.trim();
  };
  document.querySelectorAll(".installer input, .installer select, .installer textarea").forEach((el) => el.addEventListener("input", keep));
  document.querySelector("#btnInstallerAdapt").addEventListener("click", async (event) => {
    keep();
    if (!installerDraft.name) return ifAlert("Wpisz nazwę aplikacji, np. immich.", { title: "Brak nazwy" });
    if (!installerDraft.compose.trim()) return ifAlert("Wklej compose aplikacji w lewe okno.", { title: "Brak compose" });
    const btn = event.currentTarget;
    btn.disabled = true;
    btn.textContent = "Dostosowuję…";
    try {
      const res = await request("/api/apps/installer/adapt", {
        method: "POST",
        body: JSON.stringify({
          name: installerDraft.name,
          compose: installerDraft.compose,
          env: installerDraft.env,
          range: PORT_HINTS[installerDraft.category]?.range,
          host: (state.settings || {}).defaultHost || window.location.hostname
        })
      });
      installerDraft.adapted = res.compose;
      installerDraft.adaptedEnv = res.env || "";
      installerDraft.changes = res.changes || [];
      switchTab("apps");
    } catch (error) {
      await ifAlert(error.message, { title: "Nie udało się dostosować" });
      btn.disabled = false;
      btn.innerHTML = `${uiIcon("repeat", 16)} Dostosuj`;
    }
  });
  document.querySelector("#btnInstallerCommit").addEventListener("click", commitInstaller);
}

async function commitInstaller() {
  const name = installerDraft.name;
  if (!(await ifConfirm(`Założyć aplikację „${name}”?\n\nSerwer utworzy foldery app/${name} i app-data/${name}, zapisze compose i sprawdzi go. Aplikację uruchomisz potem w Dockge.`, { okLabel: "Zatwierdź" }))) return;
  const btn = document.querySelector("#btnInstallerCommit");
  const box = document.querySelector("#installerResult");
  btn.disabled = true;
  try {
    await request("/api/apps/installer/commit", {
      method: "POST",
      body: JSON.stringify({ name, compose: installerDraft.adapted, env: installerDraft.adaptedEnv })
    });
    box.innerHTML = `<div class="sys-upd-box">${uiIcon("refresh", 16)} Serwer zakłada foldery i sprawdza compose…</div>`;
    const result = await waitForInstaller();
    if (result.stan === "gotowe") {
      const host = (state.settings || {}).defaultHost || window.location.hostname;
      box.innerHTML = `
        <div class="sys-upd-ok">${uiIcon("ok", 16)} ${escapeHtml(result.komunikat)}</div>
        <a class="button primary" style="margin-top:10px;" href="http://${escapeHtml(host)}:5001/compose/${encodeURIComponent(name)}" target="_blank" rel="noopener">${uiIcon("package", 16)} Otwórz w Dockge ${uiIcon("external", 14)}</a>`;
      Object.assign(installerDraft, { name: "", compose: "", env: "", adapted: "", adaptedEnv: "", changes: null });
    } else {
      box.innerHTML = `<div class="sys-upd-warn">${uiIcon("warning", 16)} ${escapeHtml(result.komunikat || "Nie udało się.")}</div>`;
      btn.disabled = false;
    }
  } catch (error) {
    box.innerHTML = `<div class="sys-upd-warn">${uiIcon("warning", 16)} ${escapeHtml(error.message)}</div>`;
    btn.disabled = false;
  }
}

// Czekanie na serwer (zadanie if-aplikacje) — zwykle kilka sekund.
async function waitForInstaller() {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const s = await request("/api/apps/installer/status");
    if (s.stan === "gotowe" || s.stan === "blad") return s;
    if (s.serwerNieOdpowiada) {
      return { stan: "blad", komunikat: "Serwer nie odpowiada — zadanie „if-aplikacje” chyba nie jest zainstalowane. W terminalu serwera: sudo if-server → Upgrade." };
    }
  }
  return { stan: "blad", komunikat: "Serwer nie skończył w ciągu 90 s. Sprawdź później w Dockge, czy aplikacja się pojawiła." };
}

function renderAppsUpdates() {
  const settings = state.settings || {};
  const host = (settings.defaultHost || window.location.hostname || "localhost");
  const dockgeUrl = `http://${host}:5001`;

  return `
      <section class="admin-section-card">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px;">
          <div>
            <h2>${uiIcon("container", 22)} Aktualizacje aplikacji</h2>
            <p class="settings-note">Zainstalowana i najnowsza stabilna wersja każdej aplikacji (bez beta/rc/dev). Wersje sprawdzane są raz dziennie — „Sprawdź teraz” pyta od razu. <strong>„Aktualizuj”</strong> robi serwer: kopia aplikacji, nowa wersja, uruchomienie i sprawdzenie, czy działa — jeśli nie, powrót do poprzedniej wersji razem z danymi. „Cofnij” przywraca tylko plik compose (dla zaawansowanych, potem Dockge).</p>
            <p class="settings-note" id="containersCheckedAt" style="margin-top: 4px;"></p>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
            <button type="button" class="button primary" id="btnRefreshContainers">${uiIcon("refresh", 16)} Sprawdź teraz</button>
            <a href="${escapeHtml(dockgeUrl)}" target="_blank" class="button" style="font-size: 13px;">${uiIcon("package", 16)} Otwórz Dockge ${uiIcon("external", 14)}</a>
          </div>
        </div>

        <div id="appsUpdateProgress"></div>
        <div id="containersResult" style="margin-top: 10px;">
          <div class="empty" style="font-size: 13px;">Sprawdzanie wersji aplikacji...</div>
        </div>
      </section>`;
}

function bindAppsEvents() {
  document.querySelectorAll("[data-apps-sub]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.appsSubTab = btn.dataset.appsSub;
      switchTab("apps");
    });
  });
  if (document.querySelector("#btnInstallerAdapt")) bindInstallerEvents();
  if (document.querySelector("#containersResult")) {
    document.querySelector("#btnRefreshContainers")?.addEventListener("click", () => loadContainers({ force: true }));
    loadContainers();
    watchAppUpdate({ quiet: true });
  }
}

// ─── Kontenery Docker ─────────────────────────────────────────────────────────

function compareTagsClient(a, b) {
  const partsA = String(a).replace(/^v/, "").split(".").map(Number);
  const partsB = String(b).replace(/^v/, "").split(".").map(Number);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const diff = (partsA[i] || 0) - (partsB[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function loadContainers({ force = false } = {}) {
  const btn = document.querySelector("#btnRefreshContainers");
  const result = document.querySelector("#containersResult");
  if (!result) return;

  if (btn) btn.disabled = true;
  result.innerHTML = `<div class="empty" style="font-size:13px;">${force ? "Sprawdzanie wersji w rejestrach..." : "Wczytywanie wersji kontenerów..."}</div>`;

  try {
    const data = await request(`/api/docker/versions${force ? "?refresh=1" : ""}`);
    const versions = data.versions || [];

    if (!versions.length) {
      result.innerHTML = `<div class="empty" style="font-size:13px;">Brak kontenerów Docker.</div>`;
      return;
    }

    const checked = versions.map((v) => v.checkedAt).filter(Boolean);
    const checkedLabel = document.querySelector("#containersCheckedAt");
    if (checkedLabel) {
      checkedLabel.textContent = checked.length
        ? `Ostatnie sprawdzenie: ${new Date(Math.min(...checked)).toLocaleString("pl-PL")}`
        : "";
    }

    const settings = state.settings || {};
    const host = (settings.defaultHost || window.location.hostname || "localhost");
    const dockgeBase = `http://${host}:5001`;

    const rows = versions.map((v) => {
      const installed = escapeHtml(v.installedVersion || v.installedTag || "—");
      const stackUrl = `${dockgeBase}/compose/${encodeURIComponent(v.stack)}`;
      const whatsNew = v.changelogUrl ? ` <a href="${escapeHtml(v.changelogUrl)}" target="_blank" rel="noreferrer" class="upd-link" title="Co nowego — lista zmian / strona obrazu">${uiIcon("external", 12)} Co nowego</a>` : "";
      let latestCell;
      let composeCell;
      if (v.local) {
        latestCell = `<span class="upd-local">obraz lokalny (tester)</span> ${infoTip("Obraz zbudowany na tym serwerze, np. wersja testowa. Nie ma go w żadnym rejestrze, więc nie ma czego sprawdzać.")}`;
        composeCell = `<span style="color:var(--muted);font-size:12px;">—</span>`;
      } else if (!v.latestStable) {
        latestCell = `<span style="color:var(--muted);">nieznana</span>${v.checkError ? ` ${infoTip(`Nie udało się sprawdzić: ${v.checkError}`)}` : ""}`;
        composeCell = `<span style="color:var(--muted);font-size:12px;">—</span>`;
      } else {
        const parts = [];
        if (v.latestPatch) parts.push(`<div class="upd-patch">${escapeHtml(v.latestPatch)} <span class="upd-tag">poprawka</span></div>`);
        if (v.latestMajor) parts.push(`<div class="upd-major">${escapeHtml(v.latestMajor)} ${uiIcon("warning", 14)} <span class="upd-tag upd-tag-warn">większa zmiana</span> ${infoTip("Nowa wersja w innej linii (np. 11.8 → 13.0). Przeczytaj „Co nowego”, a przy bazach danych i aplikacjach z danymi zrób najpierw kopię danych.")}</div>`);
        if (!parts.length) {
          // „Aktualna” tylko wtedy, gdy zainstalowana wersja naprawdę jest najnowsza.
          const upToDate = v.installedVersion && compareTagsClient(v.installedVersion, v.latestStable) >= 0;
          parts.push(upToDate
            ? `<div>${escapeHtml(v.latestStable)} <span class="upd-tag upd-tag-ok">aktualna</span></div>`
            : `<div class="upd-major">${escapeHtml(v.latestStable)} ${uiIcon("warning", 14)}</div>`);
        }
        latestCell = parts.join("") + whatsNew;
        const buttons = [];
        if (v.latestPatch) buttons.push(`<button type="button" class="button primary" style="font-size:12px;" data-update-app data-container="${escapeHtml(v.container)}" data-tag="${escapeHtml(v.latestPatch)}">${uiIcon("refresh", 14)} Aktualizuj do ${escapeHtml(v.latestPatch)}</button>`);
        if (v.latestMajor) buttons.push(`<button type="button" class="button" style="font-size:12px;" data-update-app data-major="1" data-container="${escapeHtml(v.container)}" data-tag="${escapeHtml(v.latestMajor)}">${uiIcon("warning", 14)} Aktualizuj do ${escapeHtml(v.latestMajor)}</button>`);
        if (v.backups) buttons.push(`<button type="button" class="button" style="font-size:12px;" data-compose-restore data-container="${escapeHtml(v.container)}" title="Przywróć compose.yaml z ostatniej kopii (kopii: ${v.backups})">${uiIcon("repeat", 14)} Cofnij</button>`);
        composeCell = buttons.length ? `<div class="upd-buttons">${buttons.join("")}</div>` : `<span style="color:var(--muted);font-size:12px;">—</span>`;
      }
      const note = v.note ? `<div class="upd-note">${escapeHtml(v.note)}</div>` : "";

      return `
        <tr style="border-bottom:1px solid var(--line);">
          <td style="padding:8px 10px;font-weight:600;">${escapeHtml(v.container)}${note}</td>
          <td style="padding:8px 10px;">${installed}</td>
          <td style="padding:8px 10px;">${latestCell}</td>
          <td style="padding:8px 10px;">${composeCell}</td>
          <td style="padding:8px 10px;">
            <a href="${escapeHtml(stackUrl)}" target="_blank" class="button" style="font-size:12px;">${uiIcon("repeat", 14)} Restart / Aktualizuj ${uiIcon("external", 13)}</a>
          </td>
        </tr>`;
    }).join("");

    result.innerHTML = `
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="border-bottom:1px solid var(--line);text-align:left;color:var(--muted);font-size:12px;">
              <th style="padding:8px 10px;">Kontener</th>
              <th style="padding:8px 10px;">Zainstalowana wersja</th>
              <th style="padding:8px 10px;">Najnowsza (stabilna)</th>
              <th style="padding:8px 10px;">Aktualizacja</th>
              <th style="padding:8px 10px;">Dockge</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    result.querySelectorAll("[data-update-app]").forEach((btnEl) => {
      btnEl.addEventListener("click", () => updateApp(btnEl));
    });
    result.querySelectorAll("[data-compose-restore]").forEach((btnEl) => {
      btnEl.addEventListener("click", () => restoreContainerCompose(btnEl));
    });
  } catch (error) {
    result.innerHTML = `<div class="empty" style="color:var(--danger);font-size:13px;">Błąd: ${escapeHtml(error.message)}</div>`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function restoreContainerCompose(btnEl) {
  const container = btnEl.dataset.container;
  if (!(await ifConfirm(`Przywrócić compose.yaml dla „${container}” z ostatniej kopii?\n\nPotem zrób „Aktualizuj” w Dockge, żeby uruchomić przywróconą wersję.`, { okLabel: "Przywróć" }))) return;
  btnEl.disabled = true;
  try {
    const res = await request("/api/docker/compose-restore", { method: "POST", body: JSON.stringify({ container }) });
    loadContainers();
    await ifAlert(res.message || "Przywrócono compose.yaml.", { title: "Gotowe" });
  } catch (error) {
    await ifAlert(error.message, { title: "Błąd" });
  } finally {
    btnEl.disabled = false;
  }
}

// ─── Aktualizacja przez serwer (krok 2, Darek 9.11.2026) ──────────────────────

async function updateApp(btnEl) {
  const container = btnEl.dataset.container;
  const tag = btnEl.dataset.tag;
  const major = btnEl.dataset.major === "1";
  let configured = false;
  try { configured = (await request("/api/tools/backup/status")).configured; } catch {}
  const steps = configured
    ? "Najpierw zrobię kopię tej aplikacji, potem pobiorę i uruchomię nową wersję i sprawdzę, czy działa. Jeśli nie zadziała — wrócę do poprzedniej wersji razem z danymi z tej kopii."
    : "UWAGA: kopia zapasowa nie jest ustawiona (Zaplecze → Kopia zapasowa) — aktualizacja bez kopii. Jeśli nowa wersja nie zadziała, wrócę do poprzedniej wersji, ale zmian w danych nie da się cofnąć.";
  const warn = major ? "\n\nTo większa zmiana wersji — przeczytaj najpierw „Co nowego”." : "";
  const question = `Zaktualizować „${container}” do ${tag}?\n\n${steps}${warn}\n\nAplikacja będzie na chwilę niedostępna.`;
  if (!(await ifConfirm(question, { title: major ? "Większa zmiana wersji" : "Aktualizacja aplikacji", okLabel: "Aktualizuj", danger: major || !configured }))) return;
  try {
    await request("/api/apps/update", { method: "POST", body: JSON.stringify({ container, tag }) });
    document.querySelectorAll("[data-update-app]").forEach((b) => { b.disabled = true; });
    watchAppUpdate();
  } catch (error) {
    await ifAlert(error.message, { title: "Nie można zaktualizować" });
  }
}

// Postęp aktualizacji (zadanie if-aplikacje) — pasek nad tabelą, na końcu okienko z wynikiem.
let appUpdateTimer = null;
async function watchAppUpdate({ quiet = false } = {}) {
  clearTimeout(appUpdateTimer);
  const box = document.querySelector("#appsUpdateProgress");
  if (!box) return;
  let s;
  try { s = await request("/api/apps/installer/status"); } catch { return; }
  if (s.rodzaj !== "aktualizacja") return;
  if (s.stan === "trwa") {
    box.innerHTML = `
      <div class="sys-upd-box apps-update-progress">
        <strong>Aktualizacja: ${escapeHtml(s.nazwa || "")} — ${Number(s.procent) || 0}%</strong>
        <span>${escapeHtml(s.serwerNieOdpowiada ? "Serwer nie odpowiada — zadanie „if-aplikacje” chyba nie jest zainstalowane (sudo if-server → Upgrade)." : (s.etap || ""))}</span>
        <span class="backup-progress"><span style="width:${Number(s.procent) || 0}%"></span></span>
      </div>`;
    appUpdateTimer = setTimeout(() => watchAppUpdate(), 2000);
    return;
  }
  box.innerHTML = "";
  if (quiet) return;
  loadContainers();
  await ifAlert(s.komunikat || "", { title: s.stan === "gotowe" ? "Zaktualizowano" : "Aktualizacja nie powiodła się" });
}
