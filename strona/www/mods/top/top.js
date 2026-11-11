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
    return `${IF_FORMAT.number(size, size >= 10 || unit < 2 ? 0 : 1)} ${units[unit]}`;
  }

  function formatSpeed(bytesPerSec) {
    const num = Number(bytesPerSec);
    if (!Number.isFinite(num) || num <= 0) return `${IF_FORMAT.number(0, 1)} KB/s`;
    if (num < 1024 * 1024) {
      return `${IF_FORMAT.number(num / 1024, 1)} KB/s`;
    }
    return `${IF_FORMAT.number(num / (1024 * 1024), 2)} MB/s`;
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

  // ─── Napisy (plan „Język”) ─────────────────────────────────────────────────
  // Panel jest na stronie (Status serwera → sekcja page.diagnostics) i w Zapleczu (Statystyki Live).
  // To ten sam kod, ale osobne miejsca → osobne wpisy w pliku języka: wywołujący podaje sekcję
  // w mount(root, { section }). Domyślnie page.diagnostics; Zaplecze (Statystyki Live) — admin.live.
  function texts(section) {
    const L = (key, vars) => escapeTopHtml(t(`${section}.${key}`, vars));
    L.n = (key, n, vars) => escapeTopHtml(tn(`${section}.${key}`, n, vars));
    L.raw = (key, vars) => t(`${section}.${key}`, vars);
    L.section = section;
    return L;
  }

  // ─── Wspólne fragmenty HTML (akordeon, karta w Zapleczu) ─────────────────

  function titleBoxHtml(subtitle, L) {
    return `
      <div class="top-header-title-box">
        <div class="top-live-dot" data-role="live-dot" title="${L("live_dot")}"></div>
        <div>
          <span class="eyebrow">${L("eyebrow")}</span>
          <h2 style="margin: 0; font-size: 1.1rem;">${subtitle}</h2>
          <span class="top-header-sub" data-role="uptime">${L("loading")}</span>
        </div>
      </div>
    `;
  }

  function bodyHtml(L) {
    return `
      <div class="top-body" data-role="body">
        <div class="empty" style="padding: 2rem;">${L("initializing")}</div>
      </div>
    `;
  }

  function footerHtml(L) {
    return `
      <menu class="top-modal-footer">
        <span data-role="last-updated" style="color:var(--muted); font-size:var(--top-wyniki);">${L("waiting")}</span>
        <div style="display:flex; gap:8px;">
          <button type="button" class="button" data-role="pause-btn">${uiIcon("pause", 16)} ${L("pause")}</button>
          <button type="button" class="button" data-role="refresh-btn">${uiIcon("refresh", 16)} ${L("refresh")}</button>
        </div>
      </menu>
    `;
  }

  // ─── Silnik: kontroler niezależny dla każdego zamontowanego panelu ────────

  function createController(root, { withTemperatures = false, L } = {}) {
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
        if (updated) updated.textContent = L.raw("error", { message: err.message });
      }
    }

    function renderData(data) {
      const body = root.querySelector('[data-role="body"]');
      const uptimeLabel = root.querySelector('[data-role="uptime"]');
      const lastUpdated = root.querySelector('[data-role="last-updated"]');

      if (uptimeLabel) {
        const load = data.cpu ? L.raw("load", { l1: IF_FORMAT.number(data.cpu.load1, 2), l5: IF_FORMAT.number(data.cpu.load5, 2) }) : "";
        const pkgTemp = data.cpu?.packageTemp ? ` • ${L.raw("cpu_temp", { temp: IF_FORMAT.temp(data.cpu.packageTemp) })}` : "";
        uptimeLabel.textContent = `${L.raw("uptime", { time: formatUptime(data.uptime) })} • ${load}${pkgTemp}`;
      }

      if (lastUpdated) {
        lastUpdated.textContent = L.raw("updated", { time: IF_FORMAT.time(data.updated || Date.now()) });
      }

      if (!body) return;

      // 1. CPU Cores Grid
      const cores = Array.isArray(data.cpu?.cores) ? data.cpu.cores : [];
      const allSensors = Array.isArray(data.temperatures) ? data.temperatures : [];
      const cpuSensor = allSensors.find((s) => /^(Package id \d+|Tctl)$/i.test(s.label || ""));
      const cpuGridHtml = cores.map((c) => {
        const usage = Math.max(0, Math.min(100, Number(c.usage) || 0));
        const temp = c.temperature ? IF_FORMAT.temp(c.temperature) : "—";
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
            <div class="top-core-usage">${IF_FORMAT.number(usage, 1, { minDigits: 1 })}%</div>
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
              <strong>${d.mountRoot && typeof serverMountName === "function" ? escapeTopHtml(serverMountName(d, L.section)) : escapeTopHtml(d.mount)}</strong>
              <span>${L("disk_free", { size: formatBytes(d.available), percent: p })}</span>
            </div>
            <div class="top-core-bar">
              <div class="top-core-fill ${p > 85 ? 'is-high' : ''}" style="width: ${p}%"></div>
            </div>
          </div>
        `;
      }).join("");

      // 5. Temperatury — wszystkie czujniki (tylko gdy włączone przy montażu; dziś tylko Zaplecze,
      //    napisy w sekcji admin.live; nazwy czujników składane z części od serwera).
      const sensors = withTemperatures && Array.isArray(data.temperatures) ? data.temperatures : [];
      const tempsHtml = sensors.map((s) => `
          <div class="top-core-box">
            <div class="top-core-header">
              <span>${escapeTopHtml(typeof serverSensorName === "function" ? serverSensorName(s.nameParts, s.name, L.section) : s.name)}</span>
              <span class="top-core-temp ${getTempClass(s.temp, s.warn, s.alarm)}">${IF_FORMAT.temp(s.temp)}</span>
            </div>
          </div>
        `).join("");
      const tempsSectionHtml = withTemperatures ? `
        <section class="top-section-card">
          <div class="top-section-title">
            <span>${L("temps_title")}</span>
            <span>${L.n("temps_count", sensors.length)}</span>
          </div>
          <div class="top-temps-grid">${tempsHtml || `<div class="empty">${L("temps_none")}</div>`}</div>
        </section>
      ` : "";

      // 6. Processes & Docker Table
      const processes = Array.isArray(data.processes) ? data.processes : [];
      const containers = Array.isArray(data.containers) ? data.containers : [];

      const tableTabsHtml = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div class="top-tabs-nav">
            <button type="button" class="top-tab-btn ${currentTab === 'processes' ? 'active' : ''}" data-role="tab-processes">${L("tab_processes", { n: processes.length })}</button>
            <button type="button" class="top-tab-btn ${currentTab === 'containers' ? 'active' : ''}" data-role="tab-containers">${L("tab_containers", { n: containers.length })}</button>
          </div>
        </div>
      `;

      let tableRowsHtml = "";
      if (currentTab === "processes") {
        tableRowsHtml = `
          <table class="top-table">
            <thead>
              <tr>
                <th>${L("col_pid")}</th>
                <th>${L("col_user")}</th>
                <th>${L("col_cpu")}</th>
                <th>${L("col_ram")}</th>
                <th>${L("col_command")}</th>
              </tr>
            </thead>
            <tbody>
              ${processes.map((p) => `
                <tr>
                  <td>${p.pid}</td>
                  <td>${p.user}</td>
                  <td class="top-badge-cpu">${IF_FORMAT.number(p.cpu, 1, { minDigits: 1 })}%</td>
                  <td class="top-badge-mem">${IF_FORMAT.number(p.mem, 1, { minDigits: 1 })}%</td>
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
                <th>${L("col_container")}</th>
                <th>${L("col_cpu")}</th>
                <th>${L("col_ram_usage")}</th>
                <th>${L("col_pids")}</th>
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
            <span>${L.n("cpu_title", cores.length)}</span>
            <span>${L("load_avg", { value: IF_FORMAT.number(data.cpu?.load1 || 0, 2, { minDigits: 2 }) })}</span>
          </div>
          <div class="top-cpu-grid">${cpuGridHtml || `<div class="empty">${L("no_cpu")}</div>`}</div>
        </section>

        ${tempsSectionHtml}

        <!-- 2. RAM & Network Row -->
        <div class="top-row-2col">
          <!-- RAM -->
          <section class="top-section-card">
            <div class="top-section-title">
              <span>${L("ram_title")}</span>
              <span>${formatBytes(memUsed)} / ${formatBytes(memTotal)}</span>
            </div>
            <div class="top-ram-segments">
              <div class="top-ram-seg-used" style="width: ${usedPct}%" title="${L("ram_used", { size: formatBytes(memUsed) })}"></div>
              <div class="top-ram-seg-cache" style="width: ${cachePct}%" title="${L("ram_cache_tip", { size: formatBytes(memCache) })}"></div>
              <div class="top-ram-seg-free" style="width: ${freePct}%" title="${L("ram_available", { size: formatBytes(memFree) })}"></div>
            </div>
            <div class="top-ram-legend">
              <div class="top-legend-item"><div class="top-legend-dot used"></div><span>${L("ram_used", { size: formatBytes(memUsed) })}</span></div>
              <div class="top-legend-item"><div class="top-legend-dot cache"></div><span>${L("ram_cache", { size: formatBytes(memCache) })}</span></div>
              <div class="top-legend-item"><div class="top-legend-dot free"></div><span>${L("ram_free", { size: formatBytes(memFree) })}</span></div>
              <div class="top-legend-item"><div class="top-legend-dot swap"></div><span>${L("swap", { used: formatBytes(swapUsed), total: formatBytes(swapTotal) })}</span></div>
            </div>
          </section>

          <!-- Network -->
          <section class="top-section-card">
            <div class="top-section-title">
              <span>${L("net_title")}</span>
              <span>${net.interfaces?.map(i => i.iface).join(", ") || "eth0"}</span>
            </div>
            <div class="top-net-grid">
              <div class="top-net-box">
                <span class="top-net-label">${uiIcon("arrowDown", 14)} ${L("net_download")}</span>
                <span class="top-net-speed">${rxSpeed}</span>
                <span class="top-net-total">${L("net_received", { size: rxTotal })}</span>
              </div>
              <div class="top-net-box">
                <span class="top-net-label">${uiIcon("arrowUp", 14)} ${L("net_upload")}</span>
                <span class="top-net-speed">${txSpeed}</span>
                <span class="top-net-total">${L("net_sent", { size: txTotal })}</span>
              </div>
            </div>
          </section>
        </div>

        <!-- 3. Disks -->
        <section class="top-section-card">
          <div class="top-section-title">
            <span>${L("disks_title")}</span>
            <span>${L.n("disks_count", disks.length)}</span>
          </div>
          <div class="top-disks-grid">${disksHtml || `<div class="empty">${L("no_disks")}</div>`}</div>
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
      if (btn) btn.innerHTML = isPaused ? `${uiIcon("play", 16)} ${L("resume")}` : `${uiIcon("pause", 16)} ${L("pause")}`;
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
     * { section } — sekcja pliku języka z napisami panelu (domyślnie page.diagnostics).
     * wewnątrz podanego elementu. Zwraca kontroler {start, stop, refresh,
     * togglePause} — każdy montaż ma własny, niezależny stan i timer, więc
     * wywołujący MUSI wywołać stop() przy odmontowaniu/nawigacji, inaczej
     * odpytywanie /api/system/top zostanie w tle.
     */
    mount(root, { title, withTemperatures = false, section = "page.diagnostics" } = {}) {
      if (!root) return null;
      const L = texts(section);
      root.classList.add("top-inline-mount");
      root.innerHTML = `
        ${titleBoxHtml(title ? escapeTopHtml(title) : L("title"), L)}
        ${bodyHtml(L)}
        ${footerHtml(L)}
      `;
      return createController(root, { withTemperatures, L });
    }
  };
})();
