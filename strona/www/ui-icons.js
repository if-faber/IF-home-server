// ui-icons.js — ikony interfejsu z zestawu Lucide (https://lucide.dev), licencja ISC.
// Każda ikona to fragment SVG 24×24 rysowany kolorem tekstu (currentColor).
/*
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

---

The following Lucide icons are derived from the Feather project:

airplay, alert-circle, alert-octagon, alert-triangle, aperture, arrow-down-circle, arrow-down-left, arrow-down-right, arrow-down, arrow-left-circle, arrow-left, arrow-right-circle, arrow-right, arrow-up-circle, arrow-up-left, arrow-up-right, arrow-up, at-sign, calendar, cast, check, chevron-down, chevron-left, chevron-right, chevron-up, chevrons-down, chevrons-left, chevrons-right, chevrons-up, circle, clipboard, clock, code, columns, command, compass, corner-down-left, corner-down-right, corner-left-down, corner-left-up, corner-right-down, corner-right-up, corner-up-left, corner-up-right, crosshair, database, divide-circle, divide-square, dollar-sign, download, external-link, feather, frown, hash, headphones, help-circle, info, italic, key, layout, life-buoy, link-2, link, loader, lock, log-in, log-out, maximize, meh, minimize, minimize-2, minus-circle, minus-square, minus, monitor, moon, more-horizontal, more-vertical, move, music, navigation-2, navigation, octagon, pause-circle, percent, plus-circle, plus-square, plus, power, radio, rss, search, server, share, shopping-bag, sidebar, smartphone, smile, square, table-2, tablet, target, terminal, trash-2, trash, triangle, tv, type, upload, x-circle, x-octagon, x-square, x, zoom-in, zoom-out

The MIT License (MIT) (for the icons listed above)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

const UI_ICON_PATHS = {
  house: `<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /> <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />`,
  page: `<rect width="7" height="7" x="3" y="3" rx="1" /> <rect width="7" height="7" x="14" y="3" rx="1" /> <rect width="7" height="7" x="14" y="14" rx="1" /> <rect width="7" height="7" x="3" y="14" rx="1" />`,
  plus: `<path d="M5 12h14" /> <path d="M12 5v14" />`,
  status: `<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />`,
  top: `<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" />`,
  tools: `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z" />`,
  alerts: `<path d="M10.268 21a2 2 0 0 0 3.464 0" /> <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />`,
  settings: `<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" /> <circle cx="12" cy="12" r="3" />`,
  appearance: `<path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" /> <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /> <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /> <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /> <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />`,
  edit: `<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /> <path d="m15 5 4 4" />`,
  lock: `<rect width="18" height="11" x="3" y="11" rx="2" ry="2" /> <path d="M7 11V7a5 5 0 0 1 10 0v4" />`,
  unlock: `<rect width="18" height="11" x="3" y="11" rx="2" ry="2" /> <path d="M7 11V7a5 5 0 0 1 9.9-1" />`,
  admin: `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />`,
  modules: `<rect width="7" height="7" x="14" y="3" rx="1" /> <path d="M10 21V8a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H3" />`,
  package: `<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" /> <path d="M12 22V12" /> <path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7" /> <path d="m7.5 4.27 9 5.15" />`,
  back: `<path d="m12 19-7-7 7-7" /> <path d="M19 12H5" />`,
  logout: `<path d="m16 17 5-5-5-5" /> <path d="M21 12H9" /> <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />`,
  menu: `<path d="M4 12h16" /> <path d="M4 6h16" /> <path d="M4 18h16" />`,
  sun: `<circle cx="12" cy="12" r="4" /> <path d="M12 2v2" /> <path d="M12 20v2" /> <path d="m4.93 4.93 1.41 1.41" /> <path d="m17.66 17.66 1.41 1.41" /> <path d="M2 12h2" /> <path d="M20 12h2" /> <path d="m6.34 17.66-1.41 1.41" /> <path d="m19.07 4.93-1.41 1.41" />`,
  moon: `<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />`,
  refresh: `<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /> <path d="M21 3v5h-5" /> <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /> <path d="M8 16H3v5" />`,
  external: `<path d="M15 3h6v6" /> <path d="M10 14 21 3" /> <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />`,
  logs: `<rect width="8" height="4" x="8" y="2" rx="1" ry="1" /> <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /> <path d="M12 11h4" /> <path d="M12 16h4" /> <path d="M8 11h.01" /> <path d="M8 16h.01" />`,
  thermometer: `<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />`,
  trending: `<path d="M16 7h6v6" /> <path d="m22 7-8.5 8.5-5-5L2 17" />`,
  warning: `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /> <path d="M12 9v4" /> <path d="M12 17h.01" />`,
  ok: `<circle cx="12" cy="12" r="10" /> <path d="m9 12 2 2 4-4" />`,
  siren: `<path d="M7 18v-6a5 5 0 1 1 10 0v6" /> <path d="M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z" /> <path d="M21 12h1" /> <path d="M18.5 4.5 18 5" /> <path d="M2 12h1" /> <path d="M12 2v1" /> <path d="m4.929 4.929.707.707" /> <path d="M12 12v6" />`,
  save: `<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /> <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" /> <path d="M7 3v4a1 1 0 0 0 1 1h7" />`,
  folder: `<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />`,
  link: `<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /> <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />`,
  chevronDown: `<path d="m6 9 6 6 6-6" />`,
  chevronUp: `<path d="m18 15-6-6-6 6" />`,
  file: `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /> <path d="M14 2v4a2 2 0 0 0 2 2h4" /> <path d="M10 9H8" /> <path d="M16 13H8" /> <path d="M16 17H8" />`,
  trash: `<path d="M3 6h18" /> <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /> <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /> <path d="M10 11v6" /> <path d="M14 11v6" />`,
  close: `<path d="M18 6 6 18" /> <path d="m6 6 12 12" />`,
  tag: `<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" /> <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />`,
  image: `<rect width="18" height="18" x="3" y="3" rx="2" ry="2" /> <circle cx="9" cy="9" r="2" /> <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />`,
  search: `<circle cx="11" cy="11" r="8" /> <path d="m21 21-4.3-4.3" />`,
  pause: `<rect x="14" y="4" width="4" height="16" rx="1" /> <rect x="6" y="4" width="4" height="16" rx="1" />`,
  play: `<polygon points="6 3 20 12 6 21 6 3" />`,
  arrowDown: `<path d="M12 5v14" /> <path d="m19 12-7 7-7-7" />`,
  arrowUp: `<path d="m5 12 7-7 7 7" /> <path d="M12 19V5" />`,
  monitor: `<rect width="20" height="14" x="2" y="3" rx="2" /> <path d="M8 21h8" /> <path d="M12 17v4" />`,
  container: `<path d="M22 7.7c0-.6-.4-1.2-.8-1.5l-6.3-3.9a1.72 1.72 0 0 0-1.7 0l-10.3 6c-.5.2-.9.8-.9 1.4v6.6c0 .5.4 1.2.8 1.5l6.3 3.9a1.72 1.72 0 0 0 1.7 0l10.3-6c.5-.3.9-1 .9-1.5Z" /> <path d="M10 21.9V14L2.1 9.1" /> <path d="m10 14 11.9-6.9" /> <path d="M14 19.8v-8.1" /> <path d="M18 17.5V9.4" />`,
  terminal: `<path d="m4 17 6-6-6-6" /> <path d="M12 19h8" />`,
  tabs: `<rect width="18" height="18" x="3" y="3" rx="2" /> <path d="M3 9h18" /> <path d="M9 21V9" />`,
  window: `<rect x="2" y="4" width="20" height="16" rx="2" /> <path d="M10 4v4" /> <path d="M2 8h20" /> <path d="M6 4v4" />`,
  target: `<circle cx="12" cy="12" r="10" /> <circle cx="12" cy="12" r="6" /> <circle cx="12" cy="12" r="2" />`,
  button: `<circle cx="12" cy="12" r="10" /> <circle cx="12" cy="12" r="1" />`,
  repeat: `<path d="m17 2 4 4-4 4" /> <path d="M3 11v-1a4 4 0 0 1 4-4h14" /> <path d="m7 22-4-4 4-4" /> <path d="M21 13v1a4 4 0 0 1-4 4H3" />`,
  chart: `<path d="M3 3v16a2 2 0 0 0 2 2h16" /> <path d="M18 17V9" /> <path d="M13 17V5" /> <path d="M8 17v-3" />`,
  info: `<circle cx="12" cy="12" r="10" /> <path d="M12 16v-4" /> <path d="M12 8h.01" />`
};

// Ikony spoza listy wyżej — z pełnego zestawu Lucide (www/lucide-sprite.svg, ISC, lokalnie, bez internetu).
const LUCIDE_SPRITE = "/lucide-sprite.svg";

function uiIcon(name, size = 20) {
  const key = String(name || "");
  if (!UI_ICON_PATHS[key] && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(key) && key.length > 1) {
    return `<svg class="ui-icon" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="${LUCIDE_SPRITE}#${key}"></use></svg>`;
  }
  const paths = UI_ICON_PATHS[key] || UI_ICON_PATHS.page;
  return `<svg class="ui-icon" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

// Ikona przełącznika dzień / noc: „theme-toggles” (Alfie Jones, MIT) — wariant classic.
// Wspólna dla Strony Głównej i Zaplecza; isNight = pokaż księżyc.
function themeToggleIcon(isNight) {
  const toggled = isNight ? " theme-toggle--toggled" : "";
  return `<span class="theme-toggle${toggled}" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="1em" height="1em" fill="currentColor" stroke-linecap="round" class="theme-toggle__classic" viewBox="0 0 32 32"><clipPath id="theme-toggle__classic__cutout"><path d="M0-5h30a1 1 0 0 0 9 13v24H0Z" /></clipPath><g clip-path="url(#theme-toggle__classic__cutout)"><circle cx="16" cy="16" r="9.34" /><g stroke="currentColor" stroke-width="1.5"><path d="M16 5.5v-4" /><path d="M16 30.5v-4" /><path d="M1.5 16h4" /><path d="M26.5 16h4" /><path d="m23.4 8.6 2.8-2.8" /><path d="m5.7 26.3 2.9-2.9" /><path d="m5.8 5.8 2.8 2.8" /><path d="m23.4 23.4 2.9 2.9" /></g></g></svg></span>`;
}

// Ikonka ⓘ z dymkiem: opis po najechaniu myszą, a na telefonie po dotknięciu
// (dotknięcie ustawia fokus). Tekst opisu jest zwykłym tekstem — bez HTML.
function infoTip(text) {
  const safe = String(text).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  return `<span class="info-tip" tabindex="0" role="note" aria-label="${safe}">${uiIcon("info", 15)}<span class="info-tip-bubble" aria-hidden="true">${safe}</span></span>`;
}

// Nasze okienko pytania / komunikatu zamiast confirm() i alert() przeglądarki — wygląda jak
// reszta okien (ustawienia „Okna modalne”). Zasada: w IF-startpage nie używamy okienek przeglądarki.
//   if (!(await ifConfirm("Usunąć link?", { okLabel: "Usuń", danger: true }))) return;
//   await ifAlert("Zapisano.");
function ifDialog(message, { title = "Potwierdź", okLabel = "OK", cancelLabel = "Anuluj", danger = false, cancel = true } = {}) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "if-confirm";
    dialog.innerHTML = `
      <div class="modal-panel">
        <header class="modal-heading"><div><h2></h2></div></header>
        <p class="if-confirm-message"></p>
        <menu>
          ${cancel ? '<button type="button" class="button" data-cancel></button>' : ""}
          <button type="button" class="button ${danger ? "danger" : "primary"}" data-ok></button>
        </menu>
      </div>`;
    dialog.querySelector("h2").textContent = title;
    dialog.querySelector(".if-confirm-message").textContent = String(message ?? "");
    dialog.querySelector("[data-ok]").textContent = okLabel;
    const cancelButton = dialog.querySelector("[data-cancel]");
    if (cancelButton) cancelButton.textContent = cancelLabel;
    let result = false;
    dialog.querySelector("[data-ok]").addEventListener("click", () => { result = true; dialog.close(); });
    cancelButton?.addEventListener("click", () => dialog.close());
    // Zamknięcie klawiszem Esc albo kliknięcie obok = „Anuluj”.
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener("close", () => { dialog.remove(); resolve(result); }, { once: true });
    document.body.appendChild(dialog);
    dialog.showModal();
    (cancelButton || dialog.querySelector("[data-ok]")).focus();
  });
}

function ifConfirm(message, options = {}) {
  return ifDialog(message, options);
}

function ifAlert(message, options = {}) {
  return ifDialog(message, { title: "Informacja", cancel: false, ...options });
}
