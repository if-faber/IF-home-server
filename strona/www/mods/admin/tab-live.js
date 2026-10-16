// tab-live.js — Zakładka Statystyki Live: pełna diagnostyka serwera na żywo
// (CPU per rdzeń, RAM, dyski, sieć, procesy, kontenery Docker).
// Reużywa silnik z www/mods/top/top.js (window.TopDiagnostics) — ten sam
// kod co akordeon „Szczegółowa Diagnostyka” na Statusie Serwera i modal
// otwierany z widżetu statystyk w nagłówku strony głównej.

function renderLiveTab() {
  return `
    <div class="admin-tab-container">
      <section class="admin-section-card">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px;">
          <div>
            <h2>${uiIcon("status", 22)} Statystyki Live</h2>
            <p class="settings-note">Szczegółowa diagnostyka serwera na żywo — obciążenie CPU per rdzeń, temperatury, pamięć RAM, dyski, ruch sieciowy, procesy kontenera IF-startpage i kontenery Docker. Dane odświeżają się automatycznie co 2,5 s.</p>
          </div>
        </div>
        <div id="liveStatsMount"></div>
      </section>
    </div>
  `;
}

function bindLiveEvents() {
  const mount = document.querySelector("#liveStatsMount");
  if (!mount || typeof TopDiagnostics === "undefined") return;

  const controller = TopDiagnostics.mount(mount, { title: "Statystyki Live", withTemperatures: true });
  controller.start();

  // switchTab() w admin.js woła to przy zmianie zakładki, żeby zatrzymać
  // odpytywanie /api/system/top w tle.
  window.__activeTabCleanup = () => controller.stop();
}
