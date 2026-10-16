/* ==========================================================================
   www/kiosk/status-panels.js — Natywne zakładki statusu serwera w Kiosku
   Status serwera / Live / Status kontenerów. Bez iframe, bez PIN-a —
   dane pobierane bezpośrednio z tych samych publicznych endpointów co
   Zaplecze (/api/system/top, /api/alerts/summary, /api/docker/containers),
   renderowane we własnym, kioskowym stylu.
   ========================================================================== */

(function () {
  function panelEl() {
    return document.getElementById("kioskNativePanel");
  }

  let pollTimer = null;

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function escapeHtmlLocal(str) {
    return String(str || "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[m]);
  }

  function formatBytes(bytes) {
    const num = Number(bytes);
    if (!Number.isFinite(num) || num <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = num;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit++;
    }
    return `${size >= 10 || unit < 2 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
  }

  function tempClass(temp) {
    if (temp == null) return "";
    if (temp < 50) return "knp-temp-cool";
    if (temp < 70) return "knp-temp-warm";
    return "knp-temp-hot";
  }

  function setLoading(label) {
    const el = panelEl();
    if (el) el.innerHTML = `<div class="knp-loading">${escapeHtmlLocal(label)}</div>`;
  }

  function showError(message) {
    const el = panelEl();
    if (el) el.innerHTML = `<div class="knp-empty">⚠️ ${escapeHtmlLocal(message)}</div>`;
  }

  // --- 1. Status serwera: temperatury CPU, RAM, dyski + alerty ---
  async function renderServerStatus() {
    try {
      const [topRes, alertsRes] = await Promise.all([
        fetch(`/api/system/top?_t=${Date.now()}`),
        fetch(`/api/alerts/summary?_t=${Date.now()}`)
      ]);
      const top = await topRes.json();
      const alertsData = await alertsRes.json();

      const cores = Array.isArray(top.cpu?.cores) ? top.cpu.cores : [];
      const coresHtml = cores.map((c) => {
        const usage = Math.max(0, Math.min(100, Number(c.usage) || 0));
        const temp = c.temperature ? `${Math.round(c.temperature)}°C` : "—";
        return `
          <div class="knp-core-box">
            <div class="knp-core-header">
              <span>${escapeHtmlLocal(c.name)}</span>
              <span class="${tempClass(c.temperature)}">${temp}</span>
            </div>
            <div class="knp-bar"><div class="knp-bar-fill ${usage > 75 ? 'is-high' : ''}" style="width:${usage}%"></div></div>
            <div class="knp-bar-label">${usage.toFixed(0)}%</div>
          </div>
        `;
      }).join("") || `<div class="knp-empty">Brak danych CPU</div>`;

      const mem = top.memory || {};
      const memTotal = Number(mem.total) || 1;
      const memUsed = Number(mem.used) || 0;
      const memPct = Math.min(100, (memUsed / memTotal) * 100);

      const disks = Array.isArray(top.disks) ? top.disks : [];
      const disksHtml = disks.map((d) => {
        const p = Math.max(0, Math.min(100, Number(d.percent) || 0));
        return `
          <div class="knp-disk-box">
            <div class="knp-disk-header">
              <strong>${escapeHtmlLocal(d.mount)}</strong>
              <span>${formatBytes(d.available)} wolne (${p}%)</span>
            </div>
            <div class="knp-bar"><div class="knp-bar-fill ${p > 85 ? 'is-high' : ''}" style="width:${p}%"></div></div>
          </div>
        `;
      }).join("") || `<div class="knp-empty">Brak danych o dyskach</div>`;

      const alerts = Array.isArray(alertsData.alerts) ? alertsData.alerts : [];
      const alertsHtml = alerts.length > 0
        ? alerts.map((a) => `
            <div class="knp-alert-item knp-alert-${escapeHtmlLocal(a.severity || 'warning')}">
              <strong>${escapeHtmlLocal(a.title)}</strong>
              <span>${escapeHtmlLocal(a.message)}</span>
            </div>
          `).join("")
        : `<div class="knp-empty knp-alert-ok">✅ Brak aktywnych alertów — wszystko działa poprawnie</div>`;

      const uptimeLabel = top.uptime != null
        ? `Uptime: ${Math.floor(top.uptime / 86400)}d ${Math.floor((top.uptime % 86400) / 3600)}h`
        : "";

      const el = panelEl();
      if (!el) return;
      el.innerHTML = `
        <div class="knp-section">
          <div class="knp-section-header">
            <h2 class="knp-title">🌡️ Procesor i temperatury</h2>
            <span class="knp-subtext">${escapeHtmlLocal(uptimeLabel)}</span>
          </div>
          <div class="knp-grid">${coresHtml}</div>
        </div>
        <div class="knp-section">
          <h2 class="knp-title">💾 Pamięć RAM</h2>
          <div class="knp-bar knp-bar-lg"><div class="knp-bar-fill ${memPct > 90 ? 'is-high' : ''}" style="width:${memPct}%"></div></div>
          <div class="knp-subtext">${formatBytes(memUsed)} / ${formatBytes(memTotal)}</div>
        </div>
        <div class="knp-section">
          <h2 class="knp-title">🗄️ Dyski</h2>
          <div class="knp-grid">${disksHtml}</div>
        </div>
        <div class="knp-section">
          <h2 class="knp-title">🔔 Alerty (${alerts.length})</h2>
          <div class="knp-alert-list">${alertsHtml}</div>
        </div>
      `;
    } catch (err) {
      showError(`Błąd pobierania statusu serwera: ${err.message}`);
    }
  }

  // --- 2. Live: żywy podgląd zużycia zasobów per kontener (styl ctop) ---
  async function renderLive() {
    try {
      const res = await fetch(`/api/system/top?_t=${Date.now()}`);
      const data = await res.json();
      const containers = Array.isArray(data.containers) ? data.containers : [];

      const rowsHtml = containers.map((c) => `
        <tr>
          <td><strong>${escapeHtmlLocal(c.name)}</strong></td>
          <td class="knp-badge-cpu">${escapeHtmlLocal(c.cpu)}</td>
          <td class="knp-badge-mem">${escapeHtmlLocal(c.mem)}</td>
          <td>${escapeHtmlLocal(c.pids || "—")}</td>
        </tr>
      `).join("");

      const el = panelEl();
      if (!el) return;
      el.innerHTML = `
        <div class="knp-section">
          <h2 class="knp-title">📡 Live — zużycie zasobów per kontener (${containers.length})</h2>
          <table class="knp-table">
            <thead><tr><th>Kontener</th><th>% CPU</th><th>Zużycie RAM</th><th>PIDs</th></tr></thead>
            <tbody>${rowsHtml || `<tr><td colspan="4" class="knp-empty">Brak danych o kontenerach</td></tr>`}</tbody>
          </table>
          <div class="knp-subtext">Odświeżanie co 2,5 s</div>
        </div>
      `;
    } catch (err) {
      showError(`Błąd pobierania danych Live: ${err.message}`);
    }
  }

  // --- 3. Status kontenerów: lista kontenerów i ich stan ---
  async function renderDockerStatus() {
    try {
      const res = await fetch(`/api/docker/containers?_t=${Date.now()}`);
      const data = await res.json();
      const containers = Array.isArray(data.containers) ? data.containers : [];

      const rowsHtml = containers.map((c) => {
        const running = String(c.state || "").toLowerCase() === "running";
        return `
          <tr>
            <td><strong>${escapeHtmlLocal(c.name)}</strong></td>
            <td class="${running ? 'knp-badge-ok' : 'knp-badge-bad'}">${running ? '🟢 Działa' : '🔴 ' + escapeHtmlLocal(c.state || 'nieznany')}</td>
            <td class="knp-subtext">${escapeHtmlLocal(c.status || "")}</td>
          </tr>
        `;
      }).join("");

      const runningCount = containers.filter((c) => String(c.state || "").toLowerCase() === "running").length;

      const el = panelEl();
      if (!el) return;
      el.innerHTML = `
        <div class="knp-section">
          <h2 class="knp-title">🐳 Status kontenerów (${runningCount}/${containers.length} działa)</h2>
          <table class="knp-table">
            <thead><tr><th>Kontener</th><th>Stan</th><th>Szczegóły</th></tr></thead>
            <tbody>${rowsHtml || `<tr><td colspan="3" class="knp-empty">Brak danych o kontenerach</td></tr>`}</tbody>
          </table>
        </div>
      `;
    } catch (err) {
      showError(`Błąd pobierania statusu kontenerów: ${err.message}`);
    }
  }

  const PANEL_CONFIG = {
    "server-status": { render: renderServerStatus, intervalMs: 10000, loadingLabel: "Wczytywanie statusu serwera..." },
    "live": { render: renderLive, intervalMs: 2500, loadingLabel: "Wczytywanie danych Live..." },
    "docker-status": { render: renderDockerStatus, intervalMs: 5000, loadingLabel: "Wczytywanie statusu kontenerów..." }
  };

  window.isNativePanelType = function (type) {
    return Object.prototype.hasOwnProperty.call(PANEL_CONFIG, type);
  };

  window.showNativePanel = function (type) {
    const cfg = PANEL_CONFIG[type];
    const el = panelEl();
    if (!cfg || !el) return;

    stopPolling();
    el.classList.add("is-visible");
    setLoading(cfg.loadingLabel);
    cfg.render();
    pollTimer = setInterval(cfg.render, cfg.intervalMs);
  };

  window.hideNativePanel = function () {
    stopPolling();
    const el = panelEl();
    if (el) el.classList.remove("is-visible");
  };
})();
