// Napisy karty (plan „Język”, Etap 3): sekcja admin.alerts; dymki: admin.messages.
const alertsT = (key, vars) => escapeHtml(t(`admin.alerts.${key}`, vars));
const alertsTn = (key, n) => tn(`admin.alerts.${key}`, n);

// tab-alerts.js — Moduł Zakładki „Centrum Alertów i Diagnostyka” (mods/admin)

let currentAlertFilter = "all";
let cachedContainers = [];

function renderAlertsTab() {
  return `
    <div class="admin-tab-container">
      <!-- 1. Karta KPI i statusu na żywo -->
      <section class="admin-section-card">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
          <h2 style="margin: 0;">${uiIcon("alerts", 22)} ${alertsT("title")}</h2>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div id="alertsLiveBadge" style="display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 20px; font-size: var(--alerts-wyniki); font-weight: 700; background: rgba(255,255,255,0.06); border: 1px solid var(--line); color: var(--muted);">
              <span id="alertsLiveDot" style="width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></span>
              <span id="alertsLiveText">${alertsT("live_current")}</span>
            </div>
            <button type="button" class="button" id="btnRefreshAlertsTab">${uiIcon("refresh", 16)} ${alertsT("refresh")}</button>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
          <div class="cockpit-stat-card" style="margin: 0; min-height: auto; padding: 18px;">
            <header style="margin-bottom: 8px;"><h3>${alertsT("kpi_status")}</h3></header>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <strong id="valAlertsStatus" style="font-size: calc(var(--alerts-wyniki) + 5px); line-height: 1.2;">--</strong>
              <span id="subAlertsStatus" style="font-size: var(--alerts-wyniki); color: var(--muted); line-height: 1.4; word-break: break-word;">${alertsT("kpi_initializing")}</span>
            </div>
          </div>
          <div class="cockpit-stat-card" style="margin: 0; min-height: auto; padding: 18px;">
            <header style="margin-bottom: 8px;"><h3>${alertsT("kpi_alerts")}</h3></header>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <strong id="valAlertsTotal" style="font-size: calc(var(--alerts-wyniki) + 5px); line-height: 1.2;">0</strong>
              <span id="subAlertsTotal" style="font-size: var(--alerts-wyniki); color: var(--muted); line-height: 1.4; word-break: break-word;">${escapeHtml(alertsTn("crit_short", 0))}</span>
            </div>
          </div>
          <div class="cockpit-stat-card" style="margin: 0; min-height: auto; padding: 18px;">
            <header style="margin-bottom: 8px;"><h3>${alertsT("kpi_containers")}</h3></header>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <strong id="valAlertsRunning" style="font-size: calc(var(--alerts-wyniki) + 5px); line-height: 1.2;">--</strong>
              <span id="subAlertsTotalCont" style="font-size: var(--alerts-wyniki); color: var(--muted); line-height: 1.4; word-break: break-word;">${alertsT("kpi_containers_total")}</span>
            </div>
          </div>
          <div class="cockpit-stat-card" style="margin: 0; min-height: auto; padding: 18px;">
            <header style="margin-bottom: 8px;"><h3>${alertsT("kpi_hardware")}</h3></header>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <strong id="valAlertsCpu" style="font-size: calc(var(--alerts-wyniki) + 5px); line-height: 1.2;">-- ${IF_FORMAT.tempUnit()}</strong>
              <span id="subAlertsRam" style="font-size: var(--alerts-wyniki); color: var(--muted); line-height: 1.4; word-break: break-word;">${alertsT("ram_value", { value: "--%" })}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 1b. Progi temperatur (każdy serwer ma swoje normy) -->
      <section class="admin-section-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <h2 style="margin: 0;">${uiIcon("thermometer", 22)} ${alertsT("temp_title")}</h2>
        </div>
        <p class="settings-note">${alertsT("temp_intro")}</p>
        <div id="tempThresholdsBox" style="margin-top: 12px;">
          <div class="empty">${alertsT("temp_loading")}</div>
        </div>
        <div class="temp-thresholds-actions">
          <button type="button" class="button" id="btnTempThresholdsReset">${alertsT("reset_defaults")}</button>
          <button type="button" class="button primary" id="btnTempThresholdsSave">${alertsT("save")}</button>
        </div>
      </section>

      <!-- 1c. Progi obciążenia CPU i RAM (tylko kolor kafelków w nagłówku) -->
      <section class="admin-section-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <h2 style="margin: 0;">${uiIcon("trending", 22)} ${alertsT("load_title")}</h2>
        </div>
        <p class="settings-note">${alertsT("load_intro")}</p>
        <div id="loadThresholdsBox" style="margin-top: 12px;">
          <div class="empty">${alertsT("load_loading")}</div>
        </div>
        <div class="temp-thresholds-actions">
          <button type="button" class="button" id="btnLoadThresholdsReset">${alertsT("reset_defaults")}</button>
          <button type="button" class="button primary" id="btnLoadThresholdsSave">${alertsT("save")}</button>
        </div>
      </section>

      <!-- 2. Wykryte Zgłoszenia i Awarie -->
      <section class="admin-section-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <h2 style="margin: 0;">${uiIcon("warning", 22)} ${alertsT("incidents_title")}</h2>
          <span id="activeIncidentsBadge" style="font-size: var(--alerts-wyniki); font-weight: 700; padding: 3px 8px; border-radius: 8px; background: rgba(255,255,255,0.08); color: var(--muted); border: 1px solid var(--line);">${escapeHtml(alertsTn("incidents_count", 0))}</span>
        </div>
        <div id="alertsIncidentsList" style="display: flex; flex-direction: column; gap: 10px;">
          <div class="empty">${alertsT("incidents_loading")}</div>
        </div>
      </section>

      <!-- 3. Wszystkie Kontenery Docker -->
      <section class="admin-section-card">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 14px;">
          <h2 style="margin: 0;">${uiIcon("container", 22)} ${alertsT("containers_title")}</h2>
          <div class="filter-actions" style="display: flex; gap: 6px;">
            <button type="button" class="button filter-btn active" data-alert-filter="all">${alertsT("filter_all")}</button>
            <button type="button" class="button filter-btn" data-alert-filter="issues">${alertsT("filter_issues")}</button>
            <button type="button" class="button filter-btn" data-alert-filter="running">${alertsT("filter_running")}</button>
          </div>
        </div>
        <div id="alertsContainersGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px;">
          <div class="empty">${alertsT("containers_loading")}</div>
        </div>
      </section>

      <!-- 4. Narzędzia Administracyjne -->
      <section class="admin-section-card">
        <h2 style="margin: 0 0 4px 0;">${uiIcon("tools", 22)} ${alertsT("tools_title")}</h2>
        <p style="margin: 0 0 16px 0; font-size: var(--alerts-wyniki); color: var(--muted);">${alertsT("tools_intro")}</p>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
          <a id="tabLinkCockpit" href="#" target="_blank" rel="noreferrer" class="tool-card" style="display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--line); text-decoration: none; color: inherit; transition: transform 0.15s ease, background 0.15s ease;">
            <span style="display: inline-flex; color: var(--accent);">${uiIcon("terminal", 26)}</span>
            <div>
              <strong style="display: block; font-size: var(--alerts-wyniki); color: var(--text);">${alertsT("tool_cockpit")}</strong>
              <span style="font-size: var(--alerts-wyniki); color: var(--muted);">${alertsT("tool_cockpit_desc")}</span>
            </div>
            <span style="margin-left: auto; display: inline-flex; color: var(--muted);">${uiIcon("external", 14)}</span>
          </a>
          <a id="tabLinkDockge" href="#" target="_blank" rel="noreferrer" class="tool-card" style="display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--line); text-decoration: none; color: inherit; transition: transform 0.15s ease, background 0.15s ease;">
            <span style="display: inline-flex; color: var(--accent);">${uiIcon("container", 26)}</span>
            <div>
              <strong style="display: block; font-size: var(--alerts-wyniki); color: var(--text);">${alertsT("tool_dockge")}</strong>
              <span style="font-size: var(--alerts-wyniki); color: var(--muted);">${alertsT("tool_dockge_desc")}</span>
            </div>
            <span style="margin-left: auto; display: inline-flex; color: var(--muted);">${uiIcon("external", 14)}</span>
          </a>
        </div>
      </section>
    </div>
  `;
}

function bindAlertsEvents() {
  document.querySelector("#btnRefreshAlertsTab")?.addEventListener("click", loadAlertsData);
  
  document.querySelectorAll("[data-alert-filter]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll("[data-alert-filter]").forEach((b) => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      currentAlertFilter = e.currentTarget.dataset.alertFilter;
      renderContainersGrid(cachedContainers);
    });
  });

  setupToolsLinks();
  loadAlertsData();
  bindTempThresholds();
}

// ─── Progi temperatur ───

let cachedTempSensors = [];

function tempLevelClass(sensor) {
  if (sensor.temp >= sensor.alarm) return "is-alarm";
  if (sensor.temp >= sensor.warn) return "is-warn";
  return "is-ok";
}

// Progi w jednostce z Ustawień ogólnych (°C / °F); serwer zapisuje je w °C. Pole zapamiętuje wartość
// w °C (data-celsius) — nieruszone pole wysyła ją bez przeliczania, żeby °F → °C nie przesuwało progów.
function tempThresholdInput(role, celsius) {
  const shown = Math.round(IF_FORMAT.tempValue(celsius));
  return `<input type="number" min="${Math.ceil(IF_FORMAT.tempValue(1))}" max="${Math.floor(IF_FORMAT.tempValue(150))}" step="1" data-role="${role}" value="${shown}" data-shown="${shown}" data-celsius="${celsius}">`;
}

function tempThresholdCelsius(input) {
  if (input.value === input.dataset.shown && input.dataset.celsius !== undefined) return Number(input.dataset.celsius);
  return Math.round(IF_FORMAT.tempToCelsius(Number(input.value)) * 10) / 10;
}

function renderTempThresholds() {
  const box = document.querySelector("#tempThresholdsBox");
  if (!box) return;
  if (!cachedTempSensors.length) {
    box.innerHTML = `<div class="empty">${alertsT("temp_none")}</div>`;
    return;
  }
  box.innerHTML = `
    <table class="temp-thresholds-table">
      <thead>
        <tr><th>${alertsT("col_sensor")}</th><th>${alertsT("col_now")}</th><th>${alertsT("col_warn_c", { unit: IF_FORMAT.tempUnit() })}</th><th>${alertsT("col_alarm_c", { unit: IF_FORMAT.tempUnit() })}</th></tr>
      </thead>
      <tbody>
        ${cachedTempSensors.map((sensor) => `
          <tr data-sensor-id="${escapeHtml(sensor.id)}">
            <td>${escapeHtml(serverSensorName(sensor.nameParts, sensor.name, "admin.alerts"))}</td>
            <td data-label="${alertsT("col_now")}"><span class="temp-now ${tempLevelClass(sensor)}" data-role="temp-now">${IF_FORMAT.temp(sensor.temp)}</span></td>
            <td data-label="${alertsT("col_warn_c", { unit: IF_FORMAT.tempUnit() })}">${tempThresholdInput("warn", sensor.warn)}</td>
            <td data-label="${alertsT("col_alarm_c", { unit: IF_FORMAT.tempUnit() })}">${tempThresholdInput("alarm", sensor.alarm)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// Odświeża tylko kolumnę „Obecnie” — wpisane, niezapisane progi zostają w polach.
function refreshTempNow() {
  request("/api/alerts/temperature-thresholds").then((data) => {
    for (const sensor of data.sensors || []) {
      const row = document.querySelector(`#tempThresholdsBox tr[data-sensor-id="${CSS.escape(sensor.id)}"]`);
      const cell = row?.querySelector('[data-role="temp-now"]');
      if (!cell) continue;
      const warn = Number(row.querySelector('[data-role="warn"]').value) || sensor.warn;
      const alarm = Number(row.querySelector('[data-role="alarm"]').value) || sensor.alarm;
      cell.textContent = IF_FORMAT.temp(sensor.temp);
      cell.className = `temp-now ${tempLevelClass({ temp: sensor.temp, warn, alarm })}`;
    }
  }).catch(() => {});
}

async function loadTempThresholds() {
  try {
    const data = await request("/api/alerts/temperature-thresholds");
    cachedTempSensors = data.sensors || [];
    renderTempThresholds();
  } catch (error) {
    const box = document.querySelector("#tempThresholdsBox");
    if (box) box.innerHTML = `<div class="empty" style="color:var(--danger);">${alertsT("temp_error", { message: error.message })}</div>`;
  }
}

function resetTempThresholds() {
  document.querySelectorAll("#tempThresholdsBox tr[data-sensor-id]").forEach((row) => {
    const sensor = cachedTempSensors.find((item) => item.id === row.dataset.sensorId);
    if (!sensor) return;
    row.querySelector('[data-role="warn"]').outerHTML = tempThresholdInput("warn", sensor.defaultWarn);
    row.querySelector('[data-role="alarm"]').outerHTML = tempThresholdInput("alarm", sensor.defaultAlarm);
  });
  refreshTempNow();
  showToast(t("admin.messages.thresholds_defaults"));
}

async function saveTempThresholds() {
  const sensors = {};
  let outOfRange = "";
  document.querySelectorAll("#tempThresholdsBox tr[data-sensor-id]").forEach((row) => {
    const warn = tempThresholdCelsius(row.querySelector('[data-role="warn"]'));
    const alarm = tempThresholdCelsius(row.querySelector('[data-role="alarm"]'));
    if (!outOfRange && (!Number.isFinite(warn) || !Number.isFinite(alarm) || warn < 1 || alarm > 150)) {
      const sensor = cachedTempSensors.find((item) => item.id === row.dataset.sensorId);
      outOfRange = sensor ? serverSensorName(sensor.nameParts, sensor.name, "admin.alerts") : row.dataset.sensorId;
    }
    sensors[row.dataset.sensorId] = { warn, alarm };
  });
  // Zakres sprawdzany już tutaj — w jednostce, w której wpisujesz (°C / °F).
  if (outOfRange) return showToast(t("admin.messages.err_temp_threshold_range", { sensor: outOfRange, min: IF_FORMAT.temp(1), max: IF_FORMAT.temp(150) }));
  try {
    const data = await request("/api/alerts/temperature-thresholds", { method: "PUT", body: JSON.stringify({ sensors }) });
    cachedTempSensors = data.sensors || [];
    renderTempThresholds();
    showToast(t("admin.messages.temp_saved"));
  } catch (error) {
    showToast(error.message);
  }
}

// ─── Progi obciążenia CPU i RAM ───

const LOAD_ROWS = [["cpu", "load_cpu"], ["ram", "load_ram"]];
let cachedLoadThresholds = null;

function loadLevelClass(value, warn, alarm) {
  if (value == null) return "";
  if (value >= alarm) return "is-alarm";
  if (value >= warn) return "is-warn";
  return "is-ok";
}

function renderLoadThresholds(data) {
  const box = document.querySelector("#loadThresholdsBox");
  if (!box) return;
  cachedLoadThresholds = data.thresholds;
  box.innerHTML = `
    <table class="temp-thresholds-table">
      <thead>
        <tr><th>${alertsT("col_tile")}</th><th>${alertsT("col_now")}</th><th>${alertsT("col_warn_pct")}</th><th>${alertsT("col_alarm_pct")}</th></tr>
      </thead>
      <tbody>
        ${LOAD_ROWS.map(([key, name]) => {
          const t = data.thresholds[key];
          const value = data.current?.[key];
          return `
            <tr data-load-key="${key}">
              <td>${alertsT(name)}</td>
              <td data-label="${alertsT("col_now")}"><span class="temp-now ${loadLevelClass(value, t.warn, t.alarm)}" data-role="load-now">${value == null ? "—" : `${Math.round(value)}%`}</span></td>
              <td data-label="${alertsT("col_warn_pct")}"><input type="number" min="1" max="100" step="1" data-role="warn" value="${t.warn}"></td>
              <td data-label="${alertsT("col_alarm_pct")}"><input type="number" min="1" max="100" step="1" data-role="alarm" value="${t.alarm}"></td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

async function loadLoadThresholds() {
  try {
    renderLoadThresholds(await request("/api/alerts/load-thresholds"));
  } catch (error) {
    const box = document.querySelector("#loadThresholdsBox");
    if (box) box.innerHTML = `<div class="empty" style="color:var(--danger);">${alertsT("load_error", { message: error.message })}</div>`;
  }
}

// Odświeża tylko kolumnę „Obecnie” — wpisane, niezapisane progi zostają w polach.
function refreshLoadNow() {
  request("/api/alerts/load-thresholds").then((data) => {
    document.querySelectorAll("#loadThresholdsBox tr[data-load-key]").forEach((row) => {
      const value = data.current?.[row.dataset.loadKey];
      const cell = row.querySelector('[data-role="load-now"]');
      const warn = Number(row.querySelector('[data-role="warn"]').value);
      const alarm = Number(row.querySelector('[data-role="alarm"]').value);
      cell.textContent = value == null ? "—" : `${Math.round(value)}%`;
      cell.className = `temp-now ${loadLevelClass(value, warn, alarm)}`;
    });
  }).catch(() => {});
}

function resetLoadThresholds() {
  if (!cachedLoadThresholds) return;
  document.querySelectorAll("#loadThresholdsBox tr[data-load-key]").forEach((row) => {
    const t = cachedLoadThresholds[row.dataset.loadKey];
    row.querySelector('[data-role="warn"]').value = t.defaultWarn;
    row.querySelector('[data-role="alarm"]').value = t.defaultAlarm;
  });
  refreshLoadNow();
  showToast(t("admin.messages.thresholds_defaults"));
}

async function saveLoadThresholds() {
  const body = {};
  document.querySelectorAll("#loadThresholdsBox tr[data-load-key]").forEach((row) => {
    body[row.dataset.loadKey] = {
      warn: Number(row.querySelector('[data-role="warn"]').value),
      alarm: Number(row.querySelector('[data-role="alarm"]').value)
    };
  });
  try {
    await request("/api/alerts/load-thresholds", { method: "PUT", body: JSON.stringify(body) });
    await loadLoadThresholds();
    showToast(t("admin.messages.load_saved"));
  } catch (error) {
    showToast(error.message);
  }
}

function bindTempThresholds() {
  document.querySelector("#btnTempThresholdsReset")?.addEventListener("click", resetTempThresholds);
  document.querySelector("#btnTempThresholdsSave")?.addEventListener("click", saveTempThresholds);
  document.querySelector("#btnLoadThresholdsReset")?.addEventListener("click", resetLoadThresholds);
  document.querySelector("#btnLoadThresholdsSave")?.addEventListener("click", saveLoadThresholds);
  loadTempThresholds();
  loadLoadThresholds();
  const timer = setInterval(() => { refreshTempNow(); refreshLoadNow(); }, 5000);
  // switchTab() w admin.js woła to przy zmianie zakładki — zatrzymuje odświeżanie w tle.
  const previousCleanup = window.__activeTabCleanup;
  window.__activeTabCleanup = () => {
    clearInterval(timer);
    if (typeof previousCleanup === "function") previousCleanup();
  };
}

function setupToolsLinks() {
  const host = window.location.hostname || "127.0.0.1";
  const cockpit = document.querySelector("#tabLinkCockpit");
  const dockge = document.querySelector("#tabLinkDockge");

  if (cockpit) cockpit.href = `https://${host}:9090`;
  if (dockge) dockge.href = `http://${host}:5001`;
}

async function loadAlertsData() {
  try {
    const data = await request("/api/alerts/summary");
    updateKPI(data);
    renderIncidents(data.alerts || []);
  } catch (error) {
    const list = document.querySelector("#alertsIncidentsList");
    if (list) list.innerHTML = `<div class="empty" style="color:var(--danger);">${alertsT("incidents_error", { message: error.message })}</div>`;
  }

  try {
    const contData = await request("/api/docker/containers");
    cachedContainers = contData.containers || [];
    renderContainersGrid(cachedContainers);
  } catch (error) {
    const grid = document.querySelector("#alertsContainersGrid");
    if (grid) grid.innerHTML = `<div class="empty" style="color:var(--danger);">${alertsT("containers_error", { message: error.message })}</div>`;
  }

  try {
    const sys = await request("/api/system/stats");
    const temp = sys.cpu?.temperature ? IF_FORMAT.temp(sys.cpu.temperature) : "—";
    const ram = sys.memory?.percent != null ? `${Math.round(sys.memory.percent)}%` : "—";
    const cpuEl = document.querySelector("#valAlertsCpu");
    const ramEl = document.querySelector("#subAlertsRam");
    if (cpuEl) cpuEl.textContent = temp;
    if (ramEl) ramEl.textContent = t("admin.alerts.ram_value", { value: ram });
  } catch {}
}

function updateKPI(data) {
  const summary = data.summary || {};
  const statusEl = document.querySelector("#valAlertsStatus");
  const subStatusEl = document.querySelector("#subAlertsStatus");
  const dot = document.querySelector("#alertsLiveDot");
  const liveText = document.querySelector("#alertsLiveText");

  // Stan ogólny: coś krytycznego = Awaria; ostrzeżenia = Wymaga uwagi; same informacje albo nic = Stabilny.
  const crit = summary.critical || 0;
  const warn = summary.warning || 0;
  const info = summary.info || 0;
  const infoText = info ? alertsTn("info_count", info) : "";
  let state;
  if (crit > 0) {
    state = { label: t("admin.alerts.state_failure"), color: "#f87171", dot: "#ef4444", live: t("admin.alerts.state_failure_live"),
      sub: alertsTn("crit_count", crit) };
  } else if (warn > 0) {
    state = { label: t("admin.alerts.state_attention"), color: "#fb923c", dot: "#f97316", live: t("admin.alerts.state_attention_live"),
      sub: alertsTn("warn_count", warn) };
  } else {
    state = { label: t("admin.alerts.state_stable"), color: "#34d399", dot: "#10b981", live: t("admin.alerts.state_stable_live"),
      sub: info ? t("admin.alerts.no_failures_info", { info: infoText }) : t("admin.alerts.no_failures") };
  }
  if (statusEl) { statusEl.textContent = state.label; statusEl.style.color = state.color; }
  if (subStatusEl) subStatusEl.textContent = state.sub;
  if (dot) dot.style.background = state.dot;
  if (liveText) liveText.textContent = state.live;

  const totalEl = document.querySelector("#valAlertsTotal");
  const subTotalEl = document.querySelector("#subAlertsTotal");
  if (totalEl) {
    totalEl.textContent = String(summary.total || 0);
    totalEl.style.color = crit > 0 ? "#f87171" : warn > 0 ? "#fbbf24" : "inherit";
  }
  if (subTotalEl) subTotalEl.textContent = [alertsTn("crit_short", crit), alertsTn("warn_count", warn), alertsTn("info_count", info)].join(", ");

  const runEl = document.querySelector("#valAlertsRunning");
  const totalContEl = document.querySelector("#subAlertsTotalCont");
  if (runEl) runEl.textContent = `${summary.containersRunning ?? "—"} / ${summary.containersTotal ?? "—"}`;
  if (totalContEl) {
    const diff = (summary.containersTotal || 0) - (summary.containersRunning || 0);
    totalContEl.textContent = diff > 0 ? t("admin.alerts.containers_stopped", { n: diff }) : t("admin.alerts.containers_all_active");
  }
}

function renderIncidents(alerts) {
  const container = document.querySelector("#alertsIncidentsList");
  const badge = document.querySelector("#activeIncidentsBadge");
  if (!container) return;

  if (badge) {
    badge.textContent = alertsTn("incidents_count", alerts.length);
    badge.style.borderColor = alerts.length > 0 ? "rgba(239,68,68,0.4)" : "var(--line)";
    badge.style.color = alerts.length > 0 ? "#f87171" : "var(--muted)";
  }

  if (alerts.length === 0) {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; text-align: center; border-radius: 12px; background: rgba(16, 185, 129, 0.05); border: 1px dashed rgba(16, 185, 129, 0.25);">
        <span style="margin-bottom: 6px; color: #34d399;">${uiIcon("ok", 34)}</span>
        <strong style="color: #34d399; font-size: var(--alerts-wyniki);">${alertsT("all_ok")}</strong>
        <p style="color: var(--muted); font-size: var(--alerts-wyniki); margin: 4px 0 0;">${alertsT("no_incidents")}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = alerts.map((a) => {
    const isCritical = a.severity === "critical";
    const isInfo = a.severity === "info";
    const level = isCritical ? "critical" : isInfo ? "info" : "warning";
    // Informacja o aktualizacjach prowadzi do zakładki Aktualizacje, nie do logów.
    const action = a.type === "updates"
      ? `<button type="button" class="incident-bar-btn" onclick="switchTab('apps')">${uiIcon("package", 14)} ${alertsT("action_apps")}</button>`
      : a.resource ? `<button type="button" class="incident-bar-btn" onclick="showContainerLogs('${escapeHtml(a.resource)}')">${uiIcon("logs", 14)} ${alertsT("action_logs")}</button>` : "";
    const text = serverAlertText(a, "admin.alerts");
    return `
      <div class="incident-bar ${level}">
        <span class="incident-bar-icon">${uiIcon(isCritical ? "siren" : isInfo ? "package" : "warning", 24)}</span>
        <div class="incident-bar-text">
          <strong>${escapeHtml(text.title)}</strong>
          <span>${escapeHtml(text.message)}</span>
        </div>
        ${action}
      </div>
    `;
  }).join("");
}

function renderContainersGrid(containers) {
  const grid = document.querySelector("#alertsContainersGrid");
  if (!grid) return;

  let filtered = containers;
  if (currentAlertFilter === "running") {
    filtered = containers.filter((c) => (c.state || "").toLowerCase() === "running");
  } else if (currentAlertFilter === "issues") {
    filtered = containers.filter((c) => (c.state || "").toLowerCase() !== "running");
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty" style="grid-column: 1 / -1;">${alertsT("containers_none")}</div>`;
    return;
  }

  grid.innerHTML = filtered.map((c) => {
    const isRunning = (c.state || "").toLowerCase() === "running";
    const containerName = c.name || c.names || c.id;
    return `
      <div style="display: flex; flex-direction: column; justify-content: space-between; gap: 10px; padding: 14px; border-radius: 12px; background: ${isRunning ? "rgba(255,255,255,0.03)" : "rgba(239,68,68,0.08)"}; border: 1px solid ${isRunning ? "var(--line)" : "rgba(239,68,68,0.4)"}; min-width: 0;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div style="min-width: 0; flex: 1;">
            <strong style="display: block; font-size: var(--alerts-wyniki); color: var(--text); word-break: break-all;">${escapeHtml(containerName)}</strong>
            <div style="font-size: var(--alerts-wyniki); color: var(--muted); margin-top: 2px; word-break: break-word;">${escapeHtml(c.status || c.state)}</div>
          </div>
          <span style="font-size: var(--alerts-wyniki); font-weight: 700; padding: 2px 6px; border-radius: 6px; background: ${isRunning ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.2)"}; color: ${isRunning ? "#34d399" : "#f87171"}; text-transform: uppercase; flex-shrink: 0;">
            ${escapeHtml(c.state || "unknown")}
          </span>
        </div>
        <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
          <button type="button" class="button" onclick="showContainerLogs('${escapeHtml(containerName)}')" style="padding: 3px 8px; font-size: var(--alerts-wyniki);">${uiIcon("logs", 13)} ${alertsT("action_logs")}</button>
        </div>
      </div>
    `;
  }).join("");
}

function stripAnsi(text) {
  return String(text || "")
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/\[\d+m/g, "")
    .replace(/\[\d+;\d+m/g, "")
    .replace(/\[0m/g, "");
}

async function showContainerLogs(name) {
  const dialog = document.querySelector("#logsDialog");
  const content = document.querySelector("#logsDialogContent");
  const title = document.querySelector("#logsDialogHeaderTitle") || document.querySelector("#logsDialog h2");
  if (!dialog || !content) return;

  const cleanName = name.replace(/^\//, "");
  if (title) title.textContent = t("admin.logs.title_container", { name: cleanName });
  content.textContent = t("admin.logs.loading", { name: cleanName });
  dialog.showModal();

  try {
    const res = await request(`/api/docker/container/${encodeURIComponent(cleanName)}/logs`);
    content.textContent = stripAnsi(res.logs) || t("admin.logs.empty");
  } catch (err) {
    content.textContent = t("admin.logs.error", { message: err.message });
  }
}

window.showContainerLogs = showContainerLogs;
