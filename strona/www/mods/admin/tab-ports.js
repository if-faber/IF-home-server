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

// Napisy karty (plan „Język”, Etap 3): sekcja mods.ports (grupa Moduły). Nazwy pul: cat_<id> w sekcji miejsca
// (Tester portów — mods.ports, Instalator — admin.apps); PORT_HINTS zostaje jako zapas.
const portsT = (key, vars) => escapeHtml(t(`mods.ports.${key}`, vars));

function portHintLabel(id, section) {
  return IF_I18N.has(`${section}.cat_${id}`) ? t(`${section}.cat_${id}`) : (PORT_HINTS[id]?.label || id);
}

function portHintDesc(id) {
  return IF_I18N.has(`mods.ports.cat_${id}_desc`) ? t(`mods.ports.cat_${id}_desc`) : (PORT_HINTS[id]?.description || "");
}

function renderPortsTab() {
  const host = (state.settings || {}).defaultHost || window.location.hostname;
  return `
    <div class="admin-tab-container">
      <a href="#" class="button module-back-link" data-modules-back>${portsT("back")}</a>
      <section class="admin-section-card">
        <h2>${uiIcon("search", 22)} ${portsT("title")}</h2>
        <p class="settings-note">${portsT("intro")}</p>
        <div class="port-layout" style="margin-top: 14px;">
          <label>${portsT("category")}<select id="hintCategory">${Object.keys(PORT_HINTS).map((id) => `<option value="${id}">${escapeHtml(portHintLabel(id, "mods.ports"))}</option>`).join("")}</select></label>
          <div class="port-result is-info" id="hintResult"></div>
          <label>${portsT("host")}<input id="checkHost" value="${escapeHtml(host)}"></label>
          <label>${portsT("port")}<input id="checkPort" inputmode="numeric" placeholder="3050"></label>
          <button class="button primary" id="checkPortButton" type="button">${portsT("check")}</button>
          <div class="port-result" id="portResult"><strong>${portsT("waiting")}</strong><span>${portsT("waiting_text")}</span></div>
        </div>
      </section>
    </div>
  `;
}

function bindPortsEvents() {
  if (typeof bindModulesBackLink === "function") bindModulesBackLink();
  const category = document.querySelector("#hintCategory");
  const renderHint = () => {
    const id = category.value;
    const hint = PORT_HINTS[id];
    const typicalText = hint.typicalPorts && hint.typicalPorts.length ? t("mods.ports.examples", { ports: hint.typicalPorts.join(", ") }) : "";
    const desc = portHintDesc(id);
    const descText = desc ? ` (${desc})` : "";
    setPortResult(document.querySelector("#hintResult"), "is-info", portHintLabel(id, "mods.ports"), `${t("mods.ports.range", { range: hint.range })}${typicalText}${descText}`);
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
  if (!host) return setPortResult(box, "is-error", t("mods.ports.no_host"), t("mods.ports.no_host_text"));
  if (rawPort === "" || !Number.isInteger(port) || port < 1 || port > 65535) {
    return setPortResult(box, "is-error", t("mods.ports.bad_port"), t("mods.ports.bad_port_text"));
  }
  const button = document.querySelector("#checkPortButton");
  button.disabled = true;
  setPortResult(box, "is-pending", t("mods.ports.checking"), `${host}:${port}`);
  try {
    const data = await request("/api/ports/check", {
      method: "POST",
      body: JSON.stringify({ category: "manual", hostPort: port, containerPort: 80, host, port })
    });
    const status = data.status || data.result || data.state;
    if (["busy", "used", "occupied", "open"].includes(status) || data.busy === true || data.open === true) {
      return setPortResult(box, "is-busy", t("mods.ports.busy"), `${host}:${port}`);
    }
    if (["free", "available", "closed"].includes(status) || data.busy === false || data.open === false) {
      return setPortResult(box, "is-free", t("mods.ports.free"), `${host}:${port}`);
    }
    // Brak odpowiedzi na czas (status „unknown”) — wcześniej pokazywało się mylące „Port sprawdzony”.
    if (status === "unknown") return setPortResult(box, "is-busy", t("mods.ports.unknown"), t("mods.ports.unknown_text", { host, port }));
    setPortResult(box, "is-error", t("mods.ports.bad_answer"), t("mods.ports.bad_answer_text"));
  } catch (error) {
    setPortResult(box, "is-error", t("mods.ports.error"), error.message);
  } finally {
    button.disabled = false;
  }
}
