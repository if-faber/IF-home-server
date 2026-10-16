// shared.js — Wspólne narzędzia i funkcje pomocnicze dla IF-startpage

const fontOptions = [
  ["system", "System font"],
  ["Inter", "Inter"],
  ["Lato", "Lato"],
  ["Montserrat", "Montserrat"],
  ["Nunito", "Nunito"],
  ["Poppins", "Poppins"],
  ["Roboto", "Roboto"],
  ["Source Sans 3", "Source Sans"]
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getStoredAdminPin() {
  try {
    return localStorage.getItem("myhome.admin.pin") 
      || sessionStorage.getItem("homedash.admin.pin") 
      || (typeof state !== "undefined" && state ? state.adminPin : null) 
      || "";
  } catch {
    return (typeof state !== "undefined" && state ? state.adminPin : null) || "";
  }
}

function setStoredAdminPin(pin) {
  const clean = String(pin || "").trim();
  try {
    if (clean) {
      localStorage.setItem("myhome.admin.pin", clean);
      sessionStorage.setItem("homedash.admin.pin", clean);
    } else {
      clearStoredAdminPin();
    }
  } catch {}
  if (typeof state !== "undefined" && state) {
    state.adminPin = clean || null;
  }
}

function clearStoredAdminPin() {
  try {
    localStorage.removeItem("myhome.admin.pin");
    sessionStorage.removeItem("homedash.admin.pin");
    sessionStorage.removeItem("homedash.admin.activeTab");
  } catch {}
  if (typeof state !== "undefined" && state) {
    state.adminPin = null;
    state.unlocked = false;
  }
}

async function request(url, options = {}) {
  const headers = { "content-type": "application/json", ...(options.headers || {}) };
  const adminPin = getStoredAdminPin();
  if (adminPin) {
    headers["x-admin-pin"] = adminPin;
  }
  const response = await fetch(url, { ...options, headers });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Niepoprawna odpowiedź serwera API.");
  }
  if (!response.ok) {
    throw new Error(data.error || `Błąd serwera (kod ${response.status})`);
  }
  return data;
}

function showToast(message) {
  let toast = document.querySelector("#toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"), 2400);
}

function hexToRgbChannels(hex) {
  if (!hex || !hex.startsWith("#") || hex.length < 7) return "14 24 29";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r} ${g} ${b}`;
}

function fontStack(font) {
  if (!font || font === "system") return "Inter, ui-sans-serif, system-ui, sans-serif";
  return `"${font}", Inter, ui-sans-serif, system-ui, sans-serif`;
}

function renderFontOptions() {
  return fontOptions.map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`).join("");
}

function updateRangeValue(input) {
  // Pole wartości to <span> zaraz za suwakiem — nie ikonka ⓘ (infoTip) w etykiecie.
  const label = input.closest("label");
  const span = [...(label?.querySelectorAll(":scope > span") || [])].find((el) => !el.classList.contains("info-tip") && !el.classList.contains("field-title"));
  if (span) {
    if (input.id.includes("Alpha") || input.id.includes("Opacity") || input.id.includes("Dim")) {
      span.textContent = `${input.value}%`;
    } else if (input.type === "range") {
      span.textContent = `${input.value}px`;
    } else {
      span.textContent = input.value;
    }
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
