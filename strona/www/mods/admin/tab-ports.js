// tab-ports.js — Moduł „Tester portów” (Zaplecze → Moduły). Do 0.3.5 strona Narzędzia
// na stronie głównej; Darek 9.11.2026: moduł, strona Narzędzia usunięta.

// Pule portów hosta wg kategorii aplikacji (te same podpowiada Instalator).
const PORT_HINTS = {
  system: { label: "System & Sieć", range: "2000-2099", typicalPorts: [2022, 2080, 2443], description: "Usługi bazowe i sieciowe" },
  dashboard: { label: "Dashboard & Aplikacje", range: "3000-3099", typicalPorts: [3000, 3010, 3100], description: "Gitea Web, IF-startpage, Homebox" },
  media: { label: "Media & Galeria", range: "4000-4099", typicalPorts: [4000, 4080, 2283], description: "Immich, strumieniowanie, odtwarzacze" },
  administracja: { label: "Administracja & Narzędzia", range: "5000-5099", typicalPorts: [5000, 5001, 5090], description: "Gitea Registry, Dockge, Cockpit" },
  monitoring: { label: "Monitoring & ESP", range: "6000-6099", typicalPorts: [6052, 6090, 6100], description: "ESPHome, telemetria, sensory" },
  ha_iot: { label: "Smart Home & IoT", range: "7000-7099", typicalPorts: [7000, 7123, 8123], description: "Home Assistant, MQTT, automatyzacje" },
  ai_testy: { label: "Dokumentacja & Usługi", range: "8000-8099", typicalPorts: [8000, 8010, 8080, 8085, 8090], description: "DokuWiki, Paperless, Memos, Stirling" }
};

function renderPortsTab() {
  const host = (state.settings || {}).defaultHost || window.location.hostname;
  return `
    <div class="admin-tab-container">
      <a href="#" class="button module-back-link" data-modules-back>← Wróć do Modułów</a>
      <section class="admin-section-card">
        <h2>${uiIcon("search", 22)} Wyszukiwanie i test portów</h2>
        <p class="settings-note">Wybierz kategorię aplikacji — zobaczysz pulę portów dla niej. Wpisz port i sprawdź, czy na serwerze jest wolny.</p>
        <div class="port-layout" style="margin-top: 14px;">
          <label>Kategoria<select id="hintCategory">${Object.entries(PORT_HINTS).map(([id, hint]) => `<option value="${id}">${escapeHtml(hint.label)}</option>`).join("")}</select></label>
          <div class="port-result is-info" id="hintResult"></div>
          <label>Host<input id="checkHost" value="${escapeHtml(host)}"></label>
          <label>Port hosta<input id="checkPort" inputmode="numeric" placeholder="3050"></label>
          <button class="button primary" id="checkPortButton" type="button">Sprawdź port</button>
          <div class="port-result" id="portResult"><strong>Czeka</strong><span>Wpisz host i port.</span></div>
        </div>
      </section>
    </div>
  `;
}

function bindPortsEvents() {
  if (typeof bindModulesBackLink === "function") bindModulesBackLink();
  const category = document.querySelector("#hintCategory");
  const renderHint = () => {
    const hint = PORT_HINTS[category.value];
    const typicalText = hint.typicalPorts && hint.typicalPorts.length ? ` | Przykłady w tej puli: ${hint.typicalPorts.join(", ")}` : "";
    const descText = hint.description ? ` (${hint.description})` : "";
    setPortResult(document.querySelector("#hintResult"), "is-info", hint.label, `Pula hosta: ${hint.range}${typicalText}${descText}`);
  };
  category.addEventListener("change", renderHint);
  document.querySelector("#checkPortButton").addEventListener("click", runPortCheck);
  document.querySelector("#checkPort").addEventListener("keydown", (e) => { if (e.key === "Enter") runPortCheck(); });
  renderHint();
}

function setPortResult(box, tone, title, message) {
  box.className = `port-result ${tone}`;
  box.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
}

async function runPortCheck() {
  const host = document.querySelector("#checkHost").value.trim();
  const rawPort = document.querySelector("#checkPort").value.trim();
  const port = Number(rawPort);
  const box = document.querySelector("#portResult");
  if (!host) return setPortResult(box, "is-error", "Brak hosta", "Wpisz adres IP albo nazwę hosta.");
  if (rawPort === "" || !Number.isInteger(port) || port < 1 || port > 65535) {
    return setPortResult(box, "is-error", "Niepoprawny port", "Port TCP/UDP musi mieć zakres 1–65535.");
  }
  const button = document.querySelector("#checkPortButton");
  button.disabled = true;
  setPortResult(box, "is-pending", "Sprawdzam", `${host}:${port}`);
  try {
    const data = await request("/api/ports/check", {
      method: "POST",
      body: JSON.stringify({ category: "manual", hostPort: port, containerPort: 80, host, port })
    });
    const status = data.status || data.result || data.state;
    if (["busy", "used", "occupied", "open"].includes(status) || data.busy === true || data.open === true) {
      return setPortResult(box, "is-busy", "Port zajęty", `${host}:${port}`);
    }
    if (["free", "available", "closed"].includes(status) || data.busy === false || data.open === false) {
      return setPortResult(box, "is-free", "Port wolny", `${host}:${port}`);
    }
    if (data.ok === true) return setPortResult(box, "is-free", "Port sprawdzony", `${host}:${port}`);
    setPortResult(box, "is-error", "Nieznany status", "Serwer nie zwrócił rozpoznawanego wyniku.");
  } catch (error) {
    setPortResult(box, "is-error", "Błąd sprawdzania", error.message);
  } finally {
    button.disabled = false;
  }
}
