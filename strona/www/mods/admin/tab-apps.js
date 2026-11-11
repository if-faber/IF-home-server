// tab-apps.js — Zakładka Aplikacje: podmenu Aktualizacje (wersje aplikacji) i Instalator.
// Pakiety Debiana i wersja IF-home-server są tylko informacją w Statusie serwera
// na stronie głównej (Darek 9.11.2026).

// Napisy karty (plan „Język”, Etap 3): sekcja admin.apps; błędy z serwera: admin.messages.
const appsT = (key, vars) => escapeHtml(t(`admin.apps.${key}`, vars));

const APPS_SUBTABS = [
  { id: "updates", label: "sub_updates", icon: "refresh" },
  { id: "installer", label: "sub_installer", icon: "plus" }
];

function renderAppsTab() {
  const sub = APPS_SUBTABS.some((tab) => tab.id === state.appsSubTab) ? state.appsSubTab : "updates";
  const subnav = APPS_SUBTABS.map((t) => `
    <button type="button" class="apps-subnav-btn${t.id === sub ? " active" : ""}" data-apps-sub="${t.id}">${uiIcon(t.icon, 16)} ${appsT(t.label)}</button>`).join("");
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
const installerDraft = { name: "", category: "dashboard", compose: "", env: "", adapted: "", adaptedEnv: "", changes: null, changeCodes: null };

// Komunikat i etap zadania if-aplikacje (plik stanu: komunikat_kod + zmienne, etap_kod + etap_zmienne)
// w wybranym języku; brak kodu albo napisu → polski tekst z zadania.
function appsJobReason(v) {
  if (v?.powod_kod === "start_timeout") return t("admin.apps.job_reason_start_timeout", { minuty: v.minuty, lista: v.lista || t("admin.apps.job_no_containers") });
  return v?.powod || "";
}

function appsJobText(s) {
  const code = s?.komunikat_kod;
  if (!code || !IF_I18N.has(`admin.apps.job_${code}`)) return s?.komunikat || "";
  const vars = { ...(s.zmienne || {}) };
  vars.powod = appsJobReason(vars);
  if (vars.po) vars.opis = appsJobReason(vars.po);
  return t(`admin.apps.job_${code}`, vars);
}

function appsStageText(s) {
  if (s?.etap_kod && IF_I18N.has(`admin.apps.stage_${s.etap_kod}`)) return t(`admin.apps.stage_${s.etap_kod}`, s.etap_zmienne || {});
  return s?.etap || "";
}

// Jedna pozycja listy zmian — z kodu od serwera w wybranym języku, inaczej polski tekst z serwera.
function installerChangeText(text, index) {
  const item = (installerDraft.changeCodes || [])[index];
  if (!item?.code || !IF_I18N.has(`admin.apps.chg_${item.code}`)) return text;
  const vars = { ...(item.vars || {}) };
  if ("old" in vars && !vars.old) vars.old = t("admin.apps.chg_none_value");
  if ("by" in vars && !vars.by) vars.by = t("admin.apps.chg_other_service");
  return t(`admin.apps.chg_${item.code}`, vars);
}

function renderAppsInstaller() {
  const categories = typeof PORT_HINTS === "object" ? PORT_HINTS : {};
  const options = Object.entries(categories).map(([id, hint]) =>
    `<option value="${escapeHtml(id)}"${id === installerDraft.category ? " selected" : ""}>${escapeHtml(typeof portHintLabel === "function" ? portHintLabel(id, "admin.apps") : hint.label)} (${escapeHtml(hint.range)})</option>`).join("");
  return `
      <section class="admin-section-card installer">
        <h2>${uiIcon("plus", 22)} ${appsT("inst_title")}</h2>
        <p class="settings-note">${appsT("inst_intro").replace("{appdata}", "<code>app-data</code>")}</p>

        <div class="installer-row">
          <label>${appsT("inst_name")}
            <input id="installerName" placeholder="${appsT("inst_name_placeholder")}" autocomplete="off" value="${escapeHtml(installerDraft.name)}">
          </label>
          <label>${appsT("inst_category")}
            <select id="installerCategory">${options}</select>
          </label>
        </div>

        <div class="installer-columns">
          <div class="installer-col">
            <h3>${appsT("inst_col1")}</h3>
            <textarea id="installerCompose" spellcheck="false" placeholder="services:&#10;  aplikacja:&#10;    image: ...">${escapeHtml(installerDraft.compose)}</textarea>
            <details class="installer-env"${installerDraft.env ? " open" : ""}>
              <summary>${appsT("inst_env")}</summary>
              <textarea id="installerEnv" spellcheck="false" placeholder="${appsT("inst_env_placeholder")}">${escapeHtml(installerDraft.env)}</textarea>
            </details>
            <button type="button" class="button primary" id="btnInstallerAdapt">${uiIcon("repeat", 16)} ${appsT("inst_adapt")}</button>
          </div>
          <div class="installer-col">
            <h3>${appsT("inst_col2")}</h3>
            <textarea id="installerAdapted" spellcheck="false" placeholder="${appsT("inst_adapted_placeholder")}">${escapeHtml(installerDraft.adapted)}</textarea>
            <details class="installer-env"${installerDraft.adaptedEnv ? " open" : ""}>
              <summary>${appsT("inst_env_if")}</summary>
              <textarea id="installerAdaptedEnv" spellcheck="false">${escapeHtml(installerDraft.adaptedEnv)}</textarea>
            </details>
            <button type="button" class="button primary" id="btnInstallerCommit"${installerDraft.adapted ? "" : " disabled"}>${uiIcon("ok", 16)} ${appsT("inst_commit")}</button>
          </div>
        </div>

        <div id="installerChanges">${renderInstallerChanges()}</div>
        <div id="installerResult"></div>
      </section>`;
}

function renderInstallerChanges() {
  if (!installerDraft.changes) return "";
  if (!installerDraft.changes.length) return `<div class="installer-changes"><strong>${appsT("inst_changes_none_title")}</strong><p class="settings-note">${appsT("inst_changes_none")}</p></div>`;
  return `<div class="installer-changes"><strong>${appsT("inst_changes_title")}</strong><ul>${installerDraft.changes.map((c, i) => `<li>${escapeHtml(installerChangeText(c, i))}</li>`).join("")}</ul></div>`;
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
    if (!installerDraft.name) return ifAlert(t("admin.apps.inst_need_name"), { title: t("admin.apps.inst_need_name_title") });
    if (!installerDraft.compose.trim()) return ifAlert(t("admin.apps.inst_need_compose"), { title: t("admin.apps.inst_need_compose_title") });
    const btn = event.currentTarget;
    btn.disabled = true;
    btn.textContent = t("admin.apps.inst_adapting");
    try {
      const res = await request("/api/apps/installer/adapt", {
        method: "POST",
        body: JSON.stringify({
          name: installerDraft.name,
          compose: installerDraft.compose,
          env: installerDraft.env,
          range: PORT_HINTS[installerDraft.category]?.range,
          host: (state.settings || {}).defaultHost || window.location.hostname,
          timeZone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; } })()
        })
      });
      installerDraft.adapted = res.compose;
      installerDraft.adaptedEnv = res.env || "";
      installerDraft.changes = res.changes || [];
      installerDraft.changeCodes = res.changeCodes || [];
      switchTab("apps");
    } catch (error) {
      await ifAlert(error.message, { title: t("admin.apps.inst_adapt_failed") });
      btn.disabled = false;
      btn.innerHTML = `${uiIcon("repeat", 16)} ${appsT("inst_adapt")}`;
    }
  });
  document.querySelector("#btnInstallerCommit").addEventListener("click", commitInstaller);
}

async function commitInstaller() {
  const name = installerDraft.name;
  if (!(await ifConfirm(t("admin.apps.inst_confirm", { name }), { okLabel: t("admin.apps.inst_commit") }))) return;
  const btn = document.querySelector("#btnInstallerCommit");
  const box = document.querySelector("#installerResult");
  btn.disabled = true;
  try {
    await request("/api/apps/installer/commit", {
      method: "POST",
      body: JSON.stringify({ name, compose: installerDraft.adapted, env: installerDraft.adaptedEnv })
    });
    box.innerHTML = `<div class="sys-upd-box">${uiIcon("refresh", 16)} ${appsT("inst_working")}</div>`;
    const result = await waitForInstaller();
    if (result.stan === "gotowe") {
      const host = (state.settings || {}).defaultHost || window.location.hostname;
      box.innerHTML = `
        <div class="sys-upd-ok">${uiIcon("ok", 16)} ${escapeHtml(appsJobText(result))}</div>
        <a class="button primary" style="margin-top:10px;" href="http://${escapeHtml(host)}:5001/compose/${encodeURIComponent(name)}" target="_blank" rel="noopener">${uiIcon("package", 16)} ${appsT("open_in_dockge")} ${uiIcon("external", 14)}</a>`;
      Object.assign(installerDraft, { name: "", compose: "", env: "", adapted: "", adaptedEnv: "", changes: null, changeCodes: null });
    } else {
      box.innerHTML = `<div class="sys-upd-warn">${uiIcon("warning", 16)} ${escapeHtml(appsJobText(result) || t("admin.apps.inst_failed"))}</div>`;
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
      return { stan: "blad", komunikat: t("admin.apps.srv_no_answer") };
    }
  }
  return { stan: "blad", komunikat: t("admin.apps.srv_timeout") };
}

function renderAppsUpdates() {
  const settings = state.settings || {};
  const host = (settings.defaultHost || window.location.hostname || "localhost");
  const dockgeUrl = `http://${host}:5001`;

  return `
      <section class="admin-section-card">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px;">
          <div>
            <h2>${uiIcon("container", 22)} ${appsT("upd_title")}</h2>
            <p class="settings-note">${appsT("upd_intro").replace("{update}", `<strong>${appsT("upd_update_quoted")}</strong>`)}</p>
            <p class="settings-note" id="containersCheckedAt" style="margin-top: 4px;"></p>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
            <button type="button" class="button primary" id="btnRefreshContainers">${uiIcon("refresh", 16)} ${appsT("check_now")}</button>
            <a href="${escapeHtml(dockgeUrl)}" target="_blank" class="button" style="font-size: 13px;">${uiIcon("package", 16)} ${appsT("open_dockge")} ${uiIcon("external", 14)}</a>
          </div>
        </div>

        <div id="appsUpdateProgress"></div>
        <div id="containersResult" style="margin-top: 10px;">
          <div class="empty" style="font-size: 13px;">${appsT("checking")}</div>
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
  result.innerHTML = `<div class="empty" style="font-size:13px;">${appsT(force ? "checking_registries" : "loading_versions")}</div>`;

  try {
    const data = await request(`/api/docker/versions${force ? "?refresh=1" : ""}`);
    const versions = data.versions || [];

    if (!versions.length) {
      result.innerHTML = `<div class="empty" style="font-size:13px;">${appsT("no_containers")}</div>`;
      return;
    }

    const checked = versions.map((v) => v.checkedAt).filter(Boolean);
    const checkedLabel = document.querySelector("#containersCheckedAt");
    if (checkedLabel) {
      checkedLabel.textContent = checked.length
        ? t("admin.apps.last_check", { date: IF_FORMAT.dateTime(Math.min(...checked)) })
        : "";
    }

    const settings = state.settings || {};
    const host = (settings.defaultHost || window.location.hostname || "localhost");
    const dockgeBase = `http://${host}:5001`;

    const rows = versions.map((v) => {
      const installed = escapeHtml(v.installedVersion || v.installedTag || "—");
      const stackUrl = `${dockgeBase}/compose/${encodeURIComponent(v.stack)}`;
      const whatsNew = v.changelogUrl ? ` <a href="${escapeHtml(v.changelogUrl)}" target="_blank" rel="noreferrer" class="upd-link" title="${appsT("whats_new_tip")}">${uiIcon("external", 12)} ${appsT("whats_new")}</a>` : "";
      let latestCell;
      let composeCell;
      if (v.local) {
        latestCell = `<span class="upd-local">${appsT("local_image")}</span> ${infoTip(t("admin.apps.local_image_tip"))}`;
        composeCell = `<span style="color:var(--muted);font-size:12px;">—</span>`;
      } else if (!v.latestStable) {
        latestCell = `<span style="color:var(--muted);">${appsT("unknown")}</span>${v.checkError ? ` ${infoTip(t("admin.apps.check_failed", { error: v.checkError }))}` : ""}`;
        composeCell = `<span style="color:var(--muted);font-size:12px;">—</span>`;
      } else {
        const parts = [];
        if (v.latestPatch) parts.push(`<div class="upd-patch">${escapeHtml(v.latestPatch)} <span class="upd-tag">${appsT("tag_patch")}</span></div>`);
        if (v.latestMajor) parts.push(`<div class="upd-major">${escapeHtml(v.latestMajor)} ${uiIcon("warning", 14)} <span class="upd-tag upd-tag-warn">${appsT("tag_major")}</span> ${infoTip(t("admin.apps.major_tip"))}</div>`);
        if (!parts.length) {
          // „Aktualna” tylko wtedy, gdy zainstalowana wersja naprawdę jest najnowsza.
          const upToDate = v.installedVersion && compareTagsClient(v.installedVersion, v.latestStable) >= 0;
          parts.push(upToDate
            ? `<div>${escapeHtml(v.latestStable)} <span class="upd-tag upd-tag-ok">${appsT("tag_current")}</span></div>`
            : `<div class="upd-major">${escapeHtml(v.latestStable)} ${uiIcon("warning", 14)}</div>`);
        }
        latestCell = parts.join("") + whatsNew;
        const buttons = [];
        if (v.latestPatch) buttons.push(`<button type="button" class="button primary" style="font-size:12px;" data-update-app data-container="${escapeHtml(v.container)}" data-tag="${escapeHtml(v.latestPatch)}">${uiIcon("refresh", 14)} ${appsT("update_to", { tag: v.latestPatch })}</button>`);
        if (v.latestMajor) buttons.push(`<button type="button" class="button" style="font-size:12px;" data-update-app data-major="1" data-container="${escapeHtml(v.container)}" data-tag="${escapeHtml(v.latestMajor)}">${uiIcon("warning", 14)} ${appsT("update_to", { tag: v.latestMajor })}</button>`);
        if (v.backups) buttons.push(`<button type="button" class="button" style="font-size:12px;" data-compose-restore data-container="${escapeHtml(v.container)}" title="${appsT("undo_tip", { n: v.backups })}">${uiIcon("repeat", 14)} ${appsT("undo")}</button>`);
        composeCell = buttons.length ? `<div class="upd-buttons">${buttons.join("")}</div>` : `<span style="color:var(--muted);font-size:12px;">—</span>`;
      }
      const noteText = v.noteCode && IF_I18N.has(`admin.apps.note_${v.noteCode}`) ? t(`admin.apps.note_${v.noteCode}`) : v.note;
      const note = noteText ? `<div class="upd-note">${escapeHtml(noteText)}</div>` : "";

      return `
        <tr style="border-bottom:1px solid var(--line);">
          <td style="padding:8px 10px;font-weight:600;">${escapeHtml(v.container)}${note}</td>
          <td style="padding:8px 10px;" data-label="${appsT("col_installed")}">${installed}</td>
          <td style="padding:8px 10px;" data-label="${appsT("col_latest")}">${latestCell}</td>
          <td style="padding:8px 10px;" data-label="${appsT("col_update")}" class="upd-wide">${composeCell}</td>
          <td style="padding:8px 10px;" data-label="${appsT("col_dockge")}" class="upd-wide">
            <a href="${escapeHtml(stackUrl)}" target="_blank" class="button" style="font-size:12px;">${uiIcon("repeat", 14)} ${appsT("dockge_button")} ${uiIcon("external", 13)}</a>
          </td>
        </tr>`;
    }).join("");

    result.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="apps-updates-table" style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="border-bottom:1px solid var(--line);text-align:left;color:var(--muted);font-size:12px;">
              <th style="padding:8px 10px;">${appsT("col_container")}</th>
              <th style="padding:8px 10px;">${appsT("col_installed")}</th>
              <th style="padding:8px 10px;">${appsT("col_latest")}</th>
              <th style="padding:8px 10px;">${appsT("col_update")}</th>
              <th style="padding:8px 10px;">${appsT("col_dockge")}</th>
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
    result.innerHTML = `<div class="empty" style="color:var(--danger);font-size:13px;">${appsT("error", { message: error.message })}</div>`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function restoreContainerCompose(btnEl) {
  const container = btnEl.dataset.container;
  if (!(await ifConfirm(t("admin.apps.undo_confirm", { name: container }), { okLabel: t("admin.apps.undo_ok") }))) return;
  btnEl.disabled = true;
  try {
    const res = await request("/api/docker/compose-restore", { method: "POST", body: JSON.stringify({ container }) });
    loadContainers();
    await ifAlert(serverErrorText(res, "admin.messages", res.message || t("admin.apps.undo_done")), { title: t("admin.apps.done_title") });
  } catch (error) {
    await ifAlert(error.message, { title: t("admin.apps.error_title") });
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
    ? t("admin.apps.upd_steps_backup")
    : t("admin.apps.upd_steps_nobackup");
  const warn = major ? `\n\n${t("admin.apps.upd_major_warn")}` : "";
  const question = t("admin.apps.upd_question", { name: container, tag, steps, warn });
  if (!(await ifConfirm(question, { title: t(major ? "admin.apps.upd_title_major" : "admin.apps.upd_title_normal"), okLabel: t("admin.apps.upd_ok"), danger: major || !configured }))) return;
  try {
    await request("/api/apps/update", { method: "POST", body: JSON.stringify({ container, tag }) });
    document.querySelectorAll("[data-update-app]").forEach((b) => { b.disabled = true; });
    watchAppUpdate();
  } catch (error) {
    await ifAlert(error.message, { title: t("admin.apps.upd_cannot") });
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
        <strong>${appsT("upd_progress", { name: s.nazwa || "", percent: Number(s.procent) || 0 })}</strong>
        <span>${escapeHtml(s.serwerNieOdpowiada ? t("admin.apps.upd_no_answer") : appsStageText(s))}</span>
        <span class="backup-progress"><span style="width:${Number(s.procent) || 0}%"></span></span>
      </div>`;
    appUpdateTimer = setTimeout(() => watchAppUpdate(), 2000);
    return;
  }
  box.innerHTML = "";
  if (quiet) return;
  loadContainers();
  await ifAlert(appsJobText(s), { title: t(s.stan === "gotowe" ? "admin.apps.upd_done" : "admin.apps.upd_failed") });
}
