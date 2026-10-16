(function () {
  const menu = document.getElementById("lollipopMenu");
  const notch = document.getElementById("kioskNotch");
  const frame = document.getElementById("viewerFrame");

  // Domyślne przyciski menu lizakowego Kiosku serwera domowego (od Fazy B: Homepage)
  const DEFAULT_KIOSK_MENU_ITEMS = [
    {
      id: "server-status",
      title: "Status serwera",
      icon: "",
      url: "",
      type: "server-status"
    },
    {
      id: "live",
      title: "Live",
      icon: "",
      url: "",
      type: "live"
    },
    {
      id: "docker-status",
      title: "Status kontenerów",
      icon: "",
      url: "",
      type: "docker-status"
    },
    {
      id: "radio",
      title: "Radio Internetowe",
      icon: "radio.png",
      url: "radio/index.html",
      type: "iframe"
    }
  ];

  async function loadKioskConfig() {
    let itemsToRender = DEFAULT_KIOSK_MENU_ITEMS;
    try {
      const res = await fetch("/api/kiosk/settings");
      if (res.ok) {
        const kioskConfig = await res.json();
        if (kioskConfig.theme) {
          applyKioskTheme(kioskConfig.theme);
        }
        if (Array.isArray(kioskConfig.menuItems) && kioskConfig.menuItems.length > 0) {
          itemsToRender = kioskConfig.menuItems;
        }
      }
    } catch (e) {
      console.warn("Kiosk config load error, loading default fallback menu:", e);
    }
    renderLollipopMenu(itemsToRender);
  }

  function hexToRgba(hex, alpha) {
    if (!hex) return "";
    if (hex.startsWith("rgba") || hex.startsWith("rgb")) return hex;
    let c = hex.replace("#", "");
    if (c.length === 3) c = c.split("").map(x => x + x).join("");
    const num = parseInt(c, 16);
    if (isNaN(num)) return hex;
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha ?? 1})`;
  }

  function applyKioskTheme(t) {
    if (!t) return;
    const root = document.documentElement;

    // 1. Przycisk MENU (Notch)
    const notchBgRgba = hexToRgba(t.notchBg || "#10b981", t.notchOpacity || 0.92);
    root.style.setProperty("--notch-bg", notchBgRgba);
    root.style.setProperty("--notch-text", t.notchText || "#ffffff");
    root.style.setProperty("--notch-border", t.notchBorder || "#10b981");
    root.style.setProperty("--notch-glow", String(t.notchGlow || "12").includes("px") ? t.notchGlow : t.notchGlow + "px");
    root.style.setProperty("--notch-blur", String(t.notchBlur || "16").includes("px") ? t.notchBlur : t.notchBlur + "px");

    // 2. Panel Rozwijanego Menu (Lollipop Dropdown Panel)
    const lollipopBgRgba = hexToRgba(t.lollipopBg || "#0f172a", t.lollipopOpacity || 0.88);
    root.style.setProperty("--lollipop-bg", lollipopBgRgba);
    root.style.setProperty("--lollipop-blur", String(t.lollipopBlur || "16").includes("px") ? t.lollipopBlur : t.lollipopBlur + "px");
    root.style.setProperty("--lollipop-sat", String(t.lollipopSat || "120").includes("%") ? t.lollipopSat : t.lollipopSat + "%");

    // 3. Kafelki w Menu (Lollipop Items)
    root.style.setProperty("--lollipop-btn-bg", t.btnBg || "#1e293b");
    root.style.setProperty("--lollipop-btn-text", t.btnText || "#ffffff");
    root.style.setProperty("--lollipop-btn-hover-bg", t.btnHoverBg || "rgba(255, 255, 255, 0.2)");
    root.style.setProperty("--lollipop-btn-hover-text", t.btnHoverText || "#ffffff");
    root.style.setProperty("--lollipop-btn-active", t.btnActiveBg || "#10b981");
    root.style.setProperty("--lollipop-btn-active-text", t.btnActiveText || "#ffffff");
    const activeGlowRgba = hexToRgba(t.btnActiveBg || "#10b981", 0.5);
    root.style.setProperty("--lollipop-btn-active-glow", activeGlowRgba);

    // 4. Skala czcionek
    if (t.fontScale) root.style.fontSize = t.fontScale;
  }

  function buildIconHtml(icon) {
    if (!icon) return '🔘';
    let primarySrc = icon;
    if (!icon.includes("/") && !icon.startsWith("http")) {
      primarySrc = `icons/${icon}`;
    }
    const escapedPrimary = escapeHtml(primarySrc);
    const escapedBase = escapeHtml(icon.replace(/^(\.\.\/|icons\/)/, ""));
    return `<img src="${escapedPrimary}" alt="" onerror="if(!this.dataset.triedFallback){this.dataset.triedFallback='1';this.src='../icons/${escapedBase}';}else{this.style.display='none';this.parentNode.innerHTML='🔘';}">`;
  }

  function renderLollipopMenu(items) {
    const grid = document.querySelector("#lollipopMenu .lollipop-grid");
    if (!grid || !Array.isArray(items)) return;

    grid.innerHTML = items.map((item, idx) => {
      const iconHtml = buildIconHtml(item.icon);
      return `
        <button class="lollipop-item ${idx === 0 ? 'is-active' : ''}" type="button" data-type="${escapeHtml(item.type)}" data-title="${escapeHtml(item.title)}" data-url="${escapeHtml(item.url || '')}">
          <div class="lollipop-head">${iconHtml}</div>
          <div class="lollipop-stem"><span>${escapeHtml(item.title)}</span></div>
        </button>
      `;
    }).join("");

    bindLollipopEvents();
  }

  function toggleMenu() {
    const menu = document.querySelector("#lollipopMenu");
    if (menu) menu.classList.toggle("is-open");
  }

  function closeMenu() {
    const menu = document.querySelector("#lollipopMenu");
    if (menu) menu.classList.remove("is-open");
  }

  function activateMenuItem(btn) {
    if (!btn) return;
    const buttons = Array.from(document.querySelectorAll(".lollipop-item"));
    buttons.forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");

    const type = btn.dataset.type;
    const url = btn.dataset.url;
    const frame = document.querySelector("#viewerFrame");

    if (type === "link") {
      window.open(url, "_blank");
      return;
    }

    if (typeof window.isNativePanelType === "function" && window.isNativePanelType(type)) {
      if (frame) frame.style.display = "none";
      if (typeof window.showNativePanel === "function") window.showNativePanel(type);
      return;
    }

    if (typeof window.hideNativePanel === "function") window.hideNativePanel();
    if (frame) {
      frame.style.display = "block";
      if (frame.src !== url && url) {
        frame.src = url;
      }
    }
  }

  function bindLollipopEvents() {
    const notch = document.querySelector("#kioskNotch");
    const menu = document.querySelector("#lollipopMenu");

    const buttons = Array.from(document.querySelectorAll(".lollipop-item"));
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        activateMenuItem(btn);
        closeMenu();
      });
    });

    if (notch && !notch.dataset.bound) {
      notch.dataset.bound = "1";
      notch.addEventListener("click", toggleMenu);
    }

    if (!document.datasetNotchClickBound) {
      document.datasetNotchClickBound = true;
      document.addEventListener("click", (event) => {
        const menuEl = document.querySelector("#lollipopMenu");
        const notchEl = document.querySelector("#kioskNotch");
        if (menuEl && notchEl && !menuEl.contains(event.target) && event.target !== notchEl && !notchEl.contains(event.target)) {
          closeMenu();
        }
      });
    }

    // Aktywuj domyślnie pierwszy przycisk menu (Status serwera) od razu po wczytaniu
    if (buttons[0]) activateMenuItem(buttons[0]);
  }

  if (notch && !notch.dataset.bound) {
    notch.dataset.bound = "1";
    notch.addEventListener("click", toggleMenu);
  }

  document.addEventListener("click", (event) => {
    if (menu && notch && !menu.contains(event.target) && event.target !== notch && !notch.contains(event.target)) {
      closeMenu();
    }
  });

  loadKioskConfig();

  const SILENT_WAV_URI = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
  let kioskAudioContext = null;

  function initKioskAudioEngine() {
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass && !kioskAudioContext) {
        kioskAudioContext = new AudioCtxClass();
      }
    } catch (e) {}
  }
  initKioskAudioEngine();

  const autoActivateKioskAudio = () => {
    try {
      if (kioskAudioContext && kioskAudioContext.state === "suspended") {
        kioskAudioContext.resume();
      }
      let player = document.getElementById("chimeAudioPlayer");
      if (player) {
        player.src = SILENT_WAV_URI;
        player.play().catch(() => {});
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.resume();
        const dummy = new SpeechSynthesisUtterance(" ");
        dummy.volume = 0.01;
        dummy.lang = "pl-PL";
        window.speechSynthesis.speak(dummy);
      }
    } catch (e) {}
  };
  window.addEventListener("touchstart", autoActivateKioskAudio, { passive: true });
  window.addEventListener("click", autoActivateKioskAudio, { passive: true });

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[m]);
  }

})();
