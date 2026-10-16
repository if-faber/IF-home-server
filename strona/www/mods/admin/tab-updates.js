// tab-updates.js — Zakładka Aktualizacje: pakiety apt + kontenery Docker → informacja + nawigacja

function renderUpdatesTab() {
  const settings = state.settings || {};
  const host = (settings.defaultHost || window.location.hostname || "localhost");
  const cockpitUrl = `https://${host}:9090`;
  const dockgeUrl = `http://${host}:5001`;

  return `
    <div class="admin-tab-container">

      <section class="admin-section-card">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px;">
          <div>
            <h2>${uiIcon("terminal", 22)} Pakiety systemowe (Debian apt)</h2>
            <p class="settings-note">Oczekujące aktualizacje Debiana. Listę zapisuje serwer raz dziennie i od razu po każdej instalacji pakietów (zadanie „if-system-updates”), instalujesz je w Cockpit.</p>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
            <button type="button" class="button primary" id="btnCheckOsUpdates">${uiIcon("search", 16)} Pokaż listę</button>
            <a href="${escapeHtml(cockpitUrl)}" target="_blank" class="button" style="font-size: 13px;">${uiIcon("monitor", 16)} Otwórz Cockpit ${uiIcon("external", 14)}</a>
          </div>
        </div>

        <div id="osUpdatesResult" style="margin-top: 10px;">
          <div class="empty" style="font-size: 13px;">Wczytywanie listy pakietów...</div>
        </div>
      </section>

      <div class="admin-section-divider"></div>

      <!-- Program serwera IF-home-server: zainstalowana i najnowsza wersja (Darek, 15.10.2026). -->
      <section class="admin-section-card">
        <h2>${uiIcon("server", 22)} IF-home-server (program serwera)</h2>
        <div id="ifServerResult" class="if-server-row"><span class="settings-note">Sprawdzanie wersji...</span></div>
      </section>

      <div class="admin-section-divider"></div>

      <section class="admin-section-card">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px;">
          <div>
            <h2>${uiIcon("container", 22)} Kontenery Docker</h2>
            <p class="settings-note">Zainstalowana i najnowsza stabilna wersja każdego kontenera (bez beta/rc/dev). Wersje sprawdzane są raz dziennie — „Sprawdź teraz” pyta od razu. „Aktualizuj compose” zapisuje tylko nowy numer wersji (z kopią pliku, „Cofnij” wraca do poprzedniej); aktualizację uruchamiasz w Dockge i tam widzisz jej przebieg.</p>
            <p class="settings-note" id="containersCheckedAt" style="margin-top: 4px;"></p>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
            <button type="button" class="button primary" id="btnRefreshContainers">${uiIcon("refresh", 16)} Sprawdź teraz</button>
            <a href="${escapeHtml(dockgeUrl)}" target="_blank" class="button" style="font-size: 13px;">${uiIcon("package", 16)} Otwórz Dockge ${uiIcon("external", 14)}</a>
          </div>
        </div>

        <div id="containersResult" style="margin-top: 10px;">
          <div class="empty" style="font-size: 13px;">Sprawdzanie wersji kontenerów...</div>
        </div>
      </section>

    </div>
  `;
}

function bindUpdatesEvents() {
  document.querySelector("#btnCheckOsUpdates")?.addEventListener("click", checkOsUpdates);
  checkOsUpdates();
  document.querySelector("#btnRefreshContainers")?.addEventListener("click", () => { loadContainers({ force: true }); loadIfServer({ force: true }); });
  loadContainers();
  loadIfServer();
}

// ─── IF-home-server (program serwera) ─────────────────────────────────────────

async function loadIfServer({ force = false } = {}) {
  const box = document.querySelector("#ifServerResult");
  if (!box) return;
  try {
    const data = await request(`/api/system/if-server${force ? "?refresh=1" : ""}`);
    const installed = data.installed
      ? `<strong>${escapeHtml(data.installed)}</strong>`
      : `<span class="upd-local">nieznana</span> ${infoTip("Serwer jeszcze nie podaje swojej wersji — podaje ją if-server od v0.3.0. W terminalu serwera: sudo if-server → aktualizuj.")}`;
    const latest = data.latest ? `<strong>${escapeHtml(data.latest)}</strong>` : `<span class="upd-local">nieznana</span>`;
    let status = "";
    if (data.installed && data.latest) {
      status = data.upToDate
        ? '<span class="upd-tag upd-tag-ok">aktualna</span>'
        : `<span class="upd-tag upd-tag-warn">nowsza wersja</span> <span class="settings-note">W terminalu serwera: <code>sudo if-server</code> → aktualizuj</span>`;
    }
    box.innerHTML = `
      <span>Zainstalowana: ${installed}</span>
      <span>Najnowsza: ${latest}</span>
      ${status}`;
  } catch (error) {
    box.innerHTML = `<span class="settings-note">${escapeHtml(error.message)}</span>`;
  }
}

// ─── Pakiety systemowe ────────────────────────────────────────────────────────

async function checkOsUpdates() {
  const btn = document.querySelector("#btnCheckOsUpdates");
  const result = document.querySelector("#osUpdatesResult");
  if (!btn || !result) return;

  btn.disabled = true;
  result.innerHTML = `<div class="empty" style="font-size:13px;">Wczytywanie listy pakietów...</div>`;
  const cockpitUrl = `https://${window.location.hostname}:9090`;

  try {
    const data = await request("/api/system/updates");
    const pkgs = data.packages || [];
    const checked = data.checkedAt ? `Lista z serwera: ${new Date(data.checkedAt).toLocaleString("pl-PL")} (odświeża się raz dziennie i po każdej aktualizacji).` : "";
    const stale = data.stale ? `<div class="sys-upd-stale">${uiIcon("warning", 14)} Lista ma ponad 2 dni — zadanie „if-system-updates” na serwerze chyba nie działa.</div>` : "";

    if (!data.available) {
      result.innerHTML = `
        <div class="sys-upd-box">
          ${uiIcon("info", 16)} ${escapeHtml(data.message || "Serwer nie zapisuje jeszcze listy aktualizacji.")}
          <div style="margin-top: 8px;"><a href="${escapeHtml(cockpitUrl)}" target="_blank" rel="noopener">Otwórz Cockpit →</a></div>
        </div>`;
    } else if (!pkgs.length) {
      result.innerHTML = `
        <div class="sys-upd-ok">${uiIcon("ok", 16)} Wszystkie pakiety systemowe są aktualne.</div>
        <p class="settings-note" style="margin-top:6px;">${escapeHtml(checked)}</p>${stale}`;
    } else {
      const count = pkgs.length;
      const sec = data.securityCount || 0;
      result.innerHTML = `
        <div class="sys-upd-warn">
          ${uiIcon("warning", 16)} ${count} pakiet${count === 1 ? "" : count < 5 ? "y" : "ów"} do aktualizacji${sec ? `, w tym ${sec} bezpieczeństwa` : ""}.
          Zainstalujesz je w Cockpit → Aktualizacje oprogramowania.
          <a href="${escapeHtml(cockpitUrl)}" target="_blank" rel="noopener" style="margin-left:6px;">Otwórz Cockpit →</a>
        </div>
        <p class="settings-note" style="margin:6px 0 8px;">${escapeHtml(checked)}</p>${stale}
        <table class="sys-upd-table">
          <thead><tr><th>Pakiet</th><th>Zainstalowana</th><th>Nowa</th><th></th></tr></thead>
          <tbody>
            ${pkgs.map((p) => `
              <tr>
                <td><strong>${escapeHtml(p.name)}</strong></td>
                <td>${escapeHtml(p.current)}</td>
                <td>${escapeHtml(p.available)}</td>
                <td>${p.security ? '<span class="upd-tag upd-tag-warn">bezpieczeństwo</span>' : ""}</td>
              </tr>`).join("")}
          </tbody>
        </table>`;
    }
  } catch (error) {
    result.innerHTML = `<div class="empty" style="color: var(--danger); font-size: 13px;">Błąd: ${escapeHtml(error.message)}</div>`;
  } finally {
    btn.disabled = false;
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
        if (v.latestPatch) buttons.push(`<button type="button" class="button" style="font-size:12px;" data-update-compose data-container="${escapeHtml(v.container)}" data-tag="${escapeHtml(v.latestPatch)}">${uiIcon("save", 14)} Aktualizuj compose → ${escapeHtml(v.latestPatch)}</button>`);
        if (v.latestMajor) buttons.push(`<button type="button" class="button" style="font-size:12px;" data-update-compose data-major="1" data-container="${escapeHtml(v.container)}" data-tag="${escapeHtml(v.latestMajor)}">${uiIcon("warning", 14)} Zmień na ${escapeHtml(v.latestMajor)}</button>`);
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
              <th style="padding:8px 10px;">Compose</th>
              <th style="padding:8px 10px;">Dockge</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    result.querySelectorAll("[data-update-compose]").forEach((btnEl) => {
      btnEl.addEventListener("click", () => updateContainerCompose(btnEl));
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

async function updateContainerCompose(btnEl) {
  const container = btnEl.dataset.container;
  const tag = btnEl.dataset.tag;

  const major = btnEl.dataset.major === "1";
  const question = major
    ? `UWAGA — większa zmiana wersji dla „${container}” (na ${tag}).\n\nPrzeczytaj „Co nowego”. Jeśli aplikacja ma dane (np. baza danych), ZRÓB NAJPIERW KOPIĘ DANYCH.\n\nZapisać ${tag} w compose.yaml? Aktualizację uruchomisz potem w Dockge.`
    : `Zapisać wersję „${tag}” w compose.yaml dla „${container}”?\n\nTo tylko zapisuje plik (z kopią) — aktualizację uruchamiasz w Dockge.`;
  if (!(await ifConfirm(question, { title: major ? "Większa zmiana wersji" : "Potwierdź", okLabel: "Zapisz wersję", danger: major }))) {
    return;
  }

  const originalLabel = btnEl.textContent;
  btnEl.disabled = true;
  btnEl.textContent = "Zapisywanie...";

  try {
    const res = await request("/api/docker/update-compose", {
      method: "POST",
      body: JSON.stringify({ container, tag })
    });
    loadContainers();
    await ifAlert(res.message || "Zapisano nowy tag w compose.yaml.", { title: "Gotowe" });
  } catch (error) {
    await ifAlert(error.message, { title: "Błąd" });
  } finally {
    btnEl.disabled = false;
    btnEl.textContent = originalLabel;
  }
}
