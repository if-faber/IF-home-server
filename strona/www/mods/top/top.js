/* ==========================================================================
   Autorski Moduł www/mods/top/top.js — Glassmorphism Server Diagnostics
   W 100% zintegrowany ze stylami i motywem IF-startpage

   Silnik diagnostyki jest reużywalny: window.TopDiagnostics.mount(root)
   montuje panel (nagłówek + ciało + stopka Pauza/Odśwież) w dowolnym
   kontenerze — akordeon „Szczegółowa Diagnostyka” pod Statusem Serwera na
   stronie głównej oraz karta „Statystyki Live” w Zapleczu. Świadomie bez
   modala/dialogu — to ma być zakładka/panel, nie okienko wyskakujące.
   ========================================================================== */

(function () {
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

  function formatSpeed(bytesPerSec) {
    const num = Number(bytesPerSec);
    if (!Number.isFinite(num) || num <= 0) return "0.0 KB/s";
    if (num < 1024 * 1024) {
      return `${(num / 1024).toFixed(1)} KB/s`;
    }
    return `${(num / (1024 * 1024)).toFixed(2)} MB/s`;
  }

  function formatUptime(seconds) {
    const s = Math.floor(Number(seconds) || 0);
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    return parts.join(" ");
  }

  function escapeTopHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  // Progi z Zaplecza → Centrum alertów → Progi temperatur (gdy brak — 70/85 °C).
  function getTempClass(temp, warn = 70, alarm = 85) {
    if (temp == null) return "";
    if (temp >= alarm) return "top-temp-hot";
    if (temp >= warn) return "top-temp-warm";
    return "top-temp-cool";
  }

  // ─── Wspólne fragmenty HTML (modal, akordeon, karta w Zapleczu) ───────────

  function titleBoxHtml(subtitle) {
    return `
      <div class="top-header-title-box">
        <div class="top-live-dot" data-role="live-dot" title="Transmisja telemetrii na żywo"></div>
        <div>
          <span class="eyebrow">Diagnostyka Serwera</span>
          <h2 style="margin: 0; font-size: 1.1rem;">${subtitle}</h2>
          <span class="top-header-sub" data-role="uptime">Ładowanie telemetrii...</span>
        </div>
      </div>
    `;
  }

  function bodyHtml() {
    return `
      <div class="top-body" data-role="body">
        <div class="empty" style="padding: 2rem;">Inicjalizacja diagnostyki serwera...</div>
      </div>
    `;
  }

  function footerHtml({ withClose } = {}) {
    return `
      <menu class="top-modal-footer">
        <span data-role="last-updated" style="color:var(--muted); font-size:12px;">Oczekiwanie na próbkę</span>
        <div style="display:flex; gap:8px;">
          <button type="button" class="button" data-role="pause-btn">${uiIcon("pause", 16)} Pauza</button>
          <button type="button" class="button" data-role="refresh-btn">${uiIcon("refresh", 16)} Odśwież</button>
          ${withClose ? '<button type="button" class="button primary" data-role="footer-close-btn">Zamknij</button>' : ""}
        </div>
      </menu>
    `;
  }

  // ─── Silnik: kontroler niezależny dla każdego zamontowanego panelu ────────

  function createController(root, { withTemperatures = false } = {}) {
    let activeTimer = null;
    let isPaused = false;
    let currentTab = "processes"; // "processes" | "containers"
    let cachedData = null;

    async function fetchData() {
      try {
        const apiUrl = (typeof dashboardConfig !== "undefined" && dashboardConfig.apiUrl)
          ? dashboardConfig.apiUrl
          : window.location.origin;

        const res = await fetch(`${apiUrl}/api/system/top?_t=${Date.now()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        cachedData = data;
        renderData(data);
      } catch (err) {
        console.warn("Błąd pobierania statystyk top:", err.message);
        const updated = root.querySelector('[data-role="last-updated"]');
        if (updated) updated.textContent = `Błąd: ${err.message}`;
      }
    }

    function renderData(data) {
      const body = root.querySelector('[data-role="body"]');
      const uptimeLabel = root.querySelector('[data-role="uptime"]');
      const lastUpdated = root.querySelector('[data-role="last-updated"]');

      if (uptimeLabel) {
        const load = data.cpu ? `Load: ${data.cpu.load1?.toFixed(2)}, ${data.cpu.load5?.toFixed(2)}` : "";
        const pkgTemp = data.cpu?.packageTemp ? ` • Temp CPU: ${Math.round(data.cpu.packageTemp)}°C` : "";
        uptimeLabel.textContent = `Uptime: ${formatUptime(data.uptime)} • ${load}${pkgTemp}`;
      }

      if (lastUpdated) {
        lastUpdated.textContent = `Zaktualizowano: ${new Date(data.updated || Date.now()).toLocaleTimeString("pl-PL")}`;
      }

      if (!body) return;

      // 1. CPU Cores Grid
      const cores = Array.isArray(data.cpu?.cores) ? data.cpu.cores : [];
      const allSensors = Array.isArray(data.temperatures) ? data.temperatures : [];
      const cpuSensor = allSensors.find((s) => /^(Package id \d+|Tctl)$/i.test(s.label || ""));
      const cpuGridHtml = cores.map((c) => {
        const usage = Math.max(0, Math.min(100, Number(c.usage) || 0));
        const temp = c.temperature ? `${Math.round(c.temperature)}°C` : "—";
        const coreSensor = allSensors.find((s) => new RegExp(`^Core\\s*${c.core}$`, "i").test(s.label || "")) || cpuSensor;
        const tempClass = getTempClass(c.temperature, coreSensor?.warn, coreSensor?.alarm);
        return `
          <div class="top-core-box">
            <div class="top-core-header">
              <span>${c.name}</span>
              <span class="top-core-temp ${tempClass}">${temp}</span>
            </div>
            <div class="top-core-bar">
              <div class="top-core-fill ${usage > 75 ? 'is-high' : ''}" style="width: ${usage}%"></div>
            </div>
            <div style="font-size:11px; text-align:right; font-family:monospace; color:var(--muted);">${usage.toFixed(1)}%</div>
          </div>
        `;
      }).join("");

      // 2. RAM & Swap calculations
      const mem = data.memory || {};
      const memTotal = Number(mem.total) || 1;
      const memUsed = Number(mem.used) || 0;
      const memCache = Number(mem.cache) || 0;
      const memFree = Number(mem.available) || 0;

      const usedPct = Math.min(100, (memUsed / memTotal) * 100);
      const cachePct = Math.min(100 - usedPct, (memCache / memTotal) * 100);
      const freePct = Math.max(0, 100 - usedPct - cachePct);

      const swap = data.swap || {};
      const swapTotal = Number(swap.total) || 0;
      const swapUsed = Number(swap.used) || 0;

      // 3. Network Metrics
      const net = data.network || {};
      const rxSpeed = formatSpeed(net.rxSpeed);
      const txSpeed = formatSpeed(net.txSpeed);
      const rxTotal = formatBytes(net.rxTotal);
      const txTotal = formatBytes(net.txTotal);

      // 4. Disks
      const disks = Array.isArray(data.disks) ? data.disks : [];
      const disksHtml = disks.map((d) => {
        const p = Math.max(0, Math.min(100, Number(d.percent) || 0));
        return `
          <div class="top-disk-box">
            <div class="top-disk-header">
              <strong>${d.mount}</strong>
              <span>${formatBytes(d.available)} wolne (${p}%)</span>
            </div>
            <div class="top-core-bar">
              <div class="top-core-fill ${p > 85 ? 'is-high' : ''}" style="width: ${p}%"></div>
            </div>
          </div>
        `;
      }).join("");

      // 5. Temperatury — wszystkie czujniki (tylko gdy włączone przy montażu)
      const sensors = withTemperatures && Array.isArray(data.temperatures) ? data.temperatures : [];
      const tempsHtml = sensors.map((s) => `
          <div class="top-core-box">
            <div class="top-core-header">
              <span>${escapeTopHtml(s.name)}</span>
              <span class="top-core-temp ${getTempClass(s.temp, s.warn, s.alarm)}">${Math.round(s.temp)}°C</span>
            </div>
          </div>
        `).join("");
      const tempsSectionHtml = withTemperatures ? `
        <section class="top-section-card">
          <div class="top-section-title">
            <span>Temperatury</span>
            <span>${sensors.length} ${sensors.length === 1 ? "czujnik" : sensors.length < 5 ? "czujniki" : "czujników"}</span>
          </div>
          <div class="top-temps-grid">${tempsHtml || '<div class="empty">Brak czujników temperatury</div>'}</div>
        </section>
      ` : "";

      // 6. Processes & Docker Table
      const processes = Array.isArray(data.processes) ? data.processes : [];
      const containers = Array.isArray(data.containers) ? data.containers : [];

      const tableTabsHtml = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div class="top-tabs-nav">
            <button type="button" class="top-tab-btn ${currentTab === 'processes' ? 'active' : ''}" data-role="tab-processes">Procesy kontenera (${processes.length})</button>
            <button type="button" class="top-tab-btn ${currentTab === 'containers' ? 'active' : ''}" data-role="tab-containers">Kontenery Docker (${containers.length})</button>
          </div>
        </div>
      `;

      let tableRowsHtml = "";
      if (currentTab === "processes") {
        tableRowsHtml = `
          <table class="top-table">
            <thead>
              <tr>
                <th>PID</th>
                <th>Użytkownik</th>
                <th>% CPU</th>
                <th>% RAM</th>
                <th>Polecenie</th>
              </tr>
            </thead>
            <tbody>
              ${processes.map((p) => `
                <tr>
                  <td>${p.pid}</td>
                  <td>${p.user}</td>
                  <td class="top-badge-cpu">${Number(p.cpu).toFixed(1)}%</td>
                  <td class="top-badge-mem">${Number(p.mem).toFixed(1)}%</td>
                  <td style="max-width:320px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${p.command}">${p.command}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;
      } else {
        tableRowsHtml = `
          <table class="top-table">
            <thead>
              <tr>
                <th>Kontener</th>
                <th>% CPU</th>
                <th>Zużycie RAM</th>
                <th>PIDs</th>
              </tr>
            </thead>
            <tbody>
              ${containers.map((c) => `
                <tr>
                  <td><strong>${c.name}</strong></td>
                  <td class="top-badge-cpu">${c.cpu}</td>
                  <td class="top-badge-mem">${c.mem}</td>
                  <td>${c.pids || "—"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;
      }

      body.innerHTML = `
        <!-- 1. CPU Section -->
        <section class="top-section-card">
          <div class="top-section-title">
            <span>Obciążenie procesora per rdzeń (${cores.length} rdzenie)</span>
            <span>Load Avg: ${data.cpu?.load1?.toFixed(2) || "0.00"}</span>
          </div>
          <div class="top-cpu-grid">${cpuGridHtml || '<div class="empty">Brak danych CPU</div>'}</div>
        </section>

        ${tempsSectionHtml}

        <!-- 2. RAM & Network Row -->
        <div class="top-row-2col">
          <!-- RAM -->
          <section class="top-section-card">
            <div class="top-section-title">
              <span>Pamięć operacyjna RAM</span>
              <span>${formatBytes(memUsed)} / ${formatBytes(memTotal)}</span>
            </div>
            <div class="top-ram-segments">
              <div class="top-ram-seg-used" style="width: ${usedPct}%" title="Użyta: ${formatBytes(memUsed)}"></div>
              <div class="top-ram-seg-cache" style="width: ${cachePct}%" title="Cache/Buffery: ${formatBytes(memCache)}"></div>
              <div class="top-ram-seg-free" style="width: ${freePct}%" title="Dostępna: ${formatBytes(memFree)}"></div>
            </div>
            <div class="top-ram-legend">
              <div class="top-legend-item"><div class="top-legend-dot used"></div><span>Użyta: ${formatBytes(memUsed)}</span></div>
              <div class="top-legend-item"><div class="top-legend-dot cache"></div><span>Cache: ${formatBytes(memCache)}</span></div>
              <div class="top-legend-item"><div class="top-legend-dot free"></div><span>Wolna: ${formatBytes(memFree)}</span></div>
              <div class="top-legend-item"><div class="top-legend-dot swap"></div><span>Swap: ${formatBytes(swapUsed)} / ${formatBytes(swapTotal)}</span></div>
            </div>
          </section>

          <!-- Network -->
          <section class="top-section-card">
            <div class="top-section-title">
              <span>Ruch sieciowy w czasie rzeczywistym</span>
              <span>${net.interfaces?.map(i => i.iface).join(", ") || "eth0"}</span>
            </div>
            <div class="top-net-grid">
              <div class="top-net-box">
                <span class="top-net-label">${uiIcon("arrowDown", 14)} Pobieranie (Download)</span>
                <span class="top-net-speed">${rxSpeed}</span>
                <span class="top-net-total">Odebrano: ${rxTotal}</span>
              </div>
              <div class="top-net-box">
                <span class="top-net-label">${uiIcon("arrowUp", 14)} Wysyłanie (Upload)</span>
                <span class="top-net-speed">${txSpeed}</span>
                <span class="top-net-total">Wysłano: ${txTotal}</span>
              </div>
            </div>
          </section>
        </div>

        <!-- 3. Disks -->
        <section class="top-section-card">
          <div class="top-section-title">
            <span>Dyski i pamięć masowa</span>
            <span>${disks.length} ${disks.length === 1 ? 'dysk' : 'dyski'}</span>
          </div>
          <div class="top-disks-grid">${disksHtml || '<div class="empty">Brak danych o dyskach</div>'}</div>
        </section>

        <!-- 4. Processes / Containers -->
        <section class="top-section-card">
          ${tableTabsHtml}
          <div class="top-table-box">${tableRowsHtml}</div>
        </section>
      `;

      // Bind tab buttons (rebindowane przy każdym renderze, bo są w innerHTML ciała)
      const tabProcBtn = body.querySelector('[data-role="tab-processes"]');
      const tabContBtn = body.querySelector('[data-role="tab-containers"]');
      if (tabProcBtn) tabProcBtn.addEventListener("click", () => { currentTab = "processes"; renderData(data); });
      if (tabContBtn) tabContBtn.addEventListener("click", () => { currentTab = "containers"; renderData(data); });
    }

    function togglePause() {
      isPaused = !isPaused;
      const btn = root.querySelector('[data-role="pause-btn"]');
      const dot = root.querySelector('[data-role="live-dot"]');
      if (btn) btn.innerHTML = isPaused ? `${uiIcon("play", 16)} Wznów` : `${uiIcon("pause", 16)} Pauza`;
      if (dot) dot.style.animationPlayState = isPaused ? "paused" : "running";
    }

    function start() {
      stop();
      isPaused = false;
      fetchData();
      activeTimer = setInterval(() => {
        if (!isPaused) fetchData();
      }, 2500);
    }

    function stop() {
      if (activeTimer) {
        clearInterval(activeTimer);
        activeTimer = null;
      }
    }

    root.querySelector('[data-role="pause-btn"]')?.addEventListener("click", togglePause);
    root.querySelector('[data-role="refresh-btn"]')?.addEventListener("click", fetchData);

    return {
      start,
      stop,
      refresh: fetchData,
      togglePause,
      get cachedData() { return cachedData; }
    };
  }

  // ─── Montaż w dowolnym kontenerze (akordeon na Statusie Serwera / karta
  //     „Statystyki Live” w Zapleczu). Bez modala — na wyraźne życzenie
  //     usera diagnostyka Top żyje wyłącznie jako wbudowany panel/zakładka.

  window.TopDiagnostics = {
    /**
     * Montuje panel diagnostyczny (nagłówek + ciało + stopka Pauza/Odśwież)
     * wewnątrz podanego elementu. Zwraca kontroler {start, stop, refresh,
     * togglePause} — każdy montaż ma własny, niezależny stan i timer, więc
     * wywołujący MUSI wywołać stop() przy odmontowaniu/nawigacji, inaczej
     * odpytywanie /api/system/top zostanie w tle.
     */
    mount(root, { title, withTemperatures = false } = {}) {
      if (!root) return null;
      root.classList.add("top-inline-mount");
      root.innerHTML = `
        ${titleBoxHtml(title || "Szczegółowe Statystyki Serwera (Top)")}
        ${bodyHtml()}
        ${footerHtml()}
      `;
      return createController(root, { withTemperatures });
    }
  };
})();
