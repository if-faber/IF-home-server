// tab-homepage.js — Moduł Zakładki „Homepage” (Zarządzanie Sekcjami i Linkami Strony Głównej)

let cachedAdminSections = [];
let cachedAdminPages = [];
let adminPageId = (() => { try { return localStorage.getItem("ifs.adminPage") || "home"; } catch { return "home"; } })();
let editingAdminLink = null;
let collapsedAdminSections = {};

function renderHomepageTab() {
  return `
    <div class="admin-tab-container">
      <section class="admin-section-card">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 8px;">
          <h2 style="margin: 0;">${uiIcon("page", 22)} Strony, sekcje i linki</h2>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <!-- Ten sam przycisk co w kafelku „Ikony aplikacji” — ikony stron i sekcji wybiera się tutaj. -->
          <button type="button" class="button" id="btnIconsListPages" style="padding: 6px 16px; font-size: 13px;">${uiIcon("search", 14)} Lista ikon</button>
          <a href="../../" class="button primary" target="_blank" style="padding: 6px 16px; font-size: 13px; font-weight: bold; text-decoration: none;">Otwórz Stronę Główną ${uiIcon("external", 14)}</a>
          </div>
        </div>
        <p class="settings-note">Wybierz stronę, a potem twórz sekcje, ustawiaj ich kolejność, dodawaj i sortuj linki strzałkami. Sekcję można przenieść na inną stronę.</p>

        <div id="adminSectionsManager" style="margin-top: 16px;">
          <div class="empty">Ładowanie sekcji i linków...</div>
        </div>
      </section>

      <section class="admin-section-card">
        <h2 style="margin: 0 0 6px;">${uiIcon("image", 22)} Ikony aplikacji</h2>
        <p class="settings-note">Prześlij ikony z komputera do folderu <code>icons</code> na serwerze (PNG, SVG, WebP, JPG, ICO, do 2 MB). W oknie linku w polu „Ikona” wpisujesz nazwę pliku, np. <code>immich.png</code>.</p>
        <div class="icons-upload-row">
          <label class="icons-upload-pick">
            <input type="file" id="iconsUploadInput" accept=".png,.svg,.webp,.jpg,.jpeg,.ico,image/png,image/svg+xml,image/webp,image/jpeg,image/x-icon" multiple>
          </label>
          <button type="button" class="button primary" id="btnIconsUpload">${uiIcon("arrowUp", 16)} Prześlij ikony</button>
          <button type="button" class="button" id="btnIconsList">${uiIcon("search", 16)} Lista ikon</button>
        </div>
        <div id="iconsUploadResult" class="icons-upload-result"></div>
      </section>
    </div>
  `;
}

function bindHomepageEvents() {
  loadAdminSections();
  document.querySelector("#btnIconsUpload")?.addEventListener("click", uploadIcons);
  document.querySelector("#btnIconsList")?.addEventListener("click", openIconsList);
  document.querySelector("#btnIconsListPages")?.addEventListener("click", openIconsList);
  const iconsSearch = document.querySelector("#iconsListSearch");
  if (iconsSearch) iconsSearch.oninput = renderIconsList;
  document.querySelector("#linkFormAdmin")?.addEventListener("submit", saveAdminLink);
}

// Funkcje obsługi sekcji i linków
async function loadAdminSections() {
  const container = document.querySelector("#adminSectionsManager");
  if (!container) return;

  try {
    const data = await request("/api/services");
    cachedAdminPages = data.pages && data.pages.length ? data.pages : [{ id: "home", name: "Home" }];
    if (!cachedAdminPages.some((page) => page.id === adminPageId)) adminPageId = "home";
    const allSections = data.sections || [];
    cachedAdminSections = allSections.filter((sec) => (sec.pageId || "home") === adminPageId);
    const pageOptions = (selectedId) => cachedAdminPages
      .map((page) => `<option value="${escapeHtml(page.id)}"${page.id === selectedId ? " selected" : ""}>${escapeHtml(page.name)}</option>`)
      .join("");

    const pageRows = cachedAdminPages.map((page, idx) => {
      const isHome = page.id === "home";
      const defaultIcon = isHome ? "house" : "page";
      return `
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <span class="hp-icon-preview" id="adminPageIconPreview_${escapeHtml(page.id)}">${uiIcon(page.icon || defaultIcon, 20)}</span>
          <input type="text" id="adminPageName_${escapeHtml(page.id)}" value="${escapeHtml(page.name)}" maxlength="60" class="hp-input" style="min-width: 160px;">
          <input type="text" id="adminPageIcon_${escapeHtml(page.id)}" value="${escapeHtml(page.icon || "")}" maxlength="60" class="hp-icon-input" placeholder="ikona, np. printer" title="Nazwa ikony z lucide.dev/icons, np. printer, heart, shopping-cart. Puste = ikona domyślna." oninput="previewPageIcon('${page.id}', this.value, '${defaultIcon}')">
          ${!isHome && idx > 1 ? `<button type="button" class="button" onclick="movePageAdmin('${page.id}', 'up')" style="font-size: 12px; padding: 6px 10px;" title="Wyżej w menu">▲</button>` : ""}
          ${!isHome && idx < cachedAdminPages.length - 1 ? `<button type="button" class="button" onclick="movePageAdmin('${page.id}', 'down')" style="font-size: 12px; padding: 6px 10px;" title="Niżej w menu">▼</button>` : ""}
          <button type="button" class="button" onclick="renamePageAdmin('${page.id}')" style="font-size: 12px; padding: 6px 12px;">${uiIcon("save", 14)} Zapisz</button>
          ${isHome ? `<span class="hp-home-tag">Strona główna ${infoTip("Pierwsza strona menu. Możesz zmienić jej nazwę, ale nie można jej usunąć ani przesunąć.")}</span>` : `<button type="button" class="button danger" onclick="deletePageAdmin('${page.id}')" style="font-size: 12px; padding: 6px 12px;">Usuń stronę</button>`}
        </div>
      `;
    }).join("");

    let html = `
      <div class="hp-box" style="display: grid; gap: 10px; margin-bottom: 22px;">
        <strong style="font-size: 16px;">${uiIcon("file", 18)} Strony ${infoTip("Ikona strony: wyszukaj ją na lucide.dev/icons i wpisz nazwę spod ikony, np. printer, heart, shopping-cart. Puste pole = ikona domyślna.")}</strong>
        ${pageRows}
        <form id="adminAddPageForm" onsubmit="addPageAdmin(event)" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 6px;">
          <span class="hp-icon-preview" id="adminPageIconPreview_new">${uiIcon("page", 20)}</span>
          <input type="text" id="newPageNameInput" maxlength="60" placeholder="Nazwa nowej strony (np. Ulubione, Zakupy)" class="hp-input" style="min-width: 160px;">
          <input type="text" id="newPageIconInput" maxlength="60" class="hp-icon-input" placeholder="ikona, np. printer" title="Nazwa ikony z lucide.dev/icons, np. printer, heart, shopping-cart. Puste = ikona domyślna." oninput="previewPageIcon('new', this.value, 'page')">
          <button type="submit" class="button primary" style="padding: 10px 18px; font-weight: bold;">+ Dodaj stronę</button>
        </form>
      </div>
      <label class="admin-page-picker" style="display: grid; gap: 6px; margin-bottom: 18px; font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--muted);">
        Strona
        <select id="adminPageSelect" onchange="selectAdminPage(this.value)" style="font-size: 15px; font-weight: 700; text-transform: none; color: var(--text);">${pageOptions(adminPageId)}</select>
      </label>
    `;
    html += `
      <form id="adminAddSectionForm" onsubmit="addSectionAdmin(event)" style="display: flex; gap: 12px; margin-bottom: 20px; align-items: center; flex-wrap: wrap;">
        <span class="hp-icon-preview" id="adminPageIconPreview_newSection">${uiIcon(newSectionIcon || "folder", 20)}</span>
        <input type="text" id="newSectionNameInput" placeholder="Nazwa nowej sekcji (np. Usługi serwera)" class="hp-input">
        <button type="button" class="button" onclick="pickIconForNewSection()" style="padding: 10px 14px;">${uiIcon("search", 14)} Wybierz ikonę</button>
        <button type="submit" class="button primary" style="padding: 10px 18px; font-weight: bold;">+ Dodaj sekcję</button>
      </form>
    `;

    if (!cachedAdminSections.length) {
      html += `<div class="empty">Brak zdefiniowanych sekcji. Dodaj pierwszą sekcję powyżej.</div>`;
    } else {
      html += cachedAdminSections.map((sec, idx) => {
        const items = sec.groups?.[0]?.items || [];
        const isCollapsed = Boolean(collapsedAdminSections[sec.id]);

        return `
          <div class="admin-section-card hp-box" style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: ${isCollapsed ? '0' : '12px'};">
              <!-- Edycja sekcji: górna linijka — nazwa i Zapisz; dolna — wybór ikony z listy Lucide („Zastosuj”). -->
              <div style="display: grid; gap: 8px;">
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                  <span class="hp-icon-preview">${uiIcon(sec.icon || "folder", 20)}</span>
                  <input type="text" id="adminSectionName_${escapeHtml(sec.id)}" value="${escapeHtml(sec.name)}" maxlength="60" class="hp-input" style="min-width: 160px;">
                  <button type="button" class="button" onclick="renameSectionAdmin('${sec.id}')" style="font-size: 12px; padding: 6px 12px;">${uiIcon("save", 14)} Zapisz</button>
                  <small style="color: var(--muted); font-size: 12px;">(${items.length} wpisów)</small>
                </div>
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding-left: 46px;">
                  <button type="button" class="button" onclick="pickIconForSection('${sec.id}')" style="font-size: 12px; padding: 6px 12px;">${uiIcon("search", 14)} Wybierz ikonę</button>
                  <small style="color: var(--muted); font-size: 12px;">${sec.icon ? `Ikona: <code>${escapeHtml(sec.icon)}</code>` : "Bez ikony"}</small>
                </div>
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                <button type="button" class="button" onclick="toggleCollapseAdminSection('${sec.id}')" style="font-size: 12px; padding: 6px 12px;" title="${isCollapsed ? 'Rozwiń sekcję' : 'Zwiń sekcję'}">
                  ${isCollapsed ? `${uiIcon("chevronDown", 14)} Rozwiń wpisy` : `${uiIcon("chevronUp", 14)} Zwiń wpisy`}
                </button>
                ${cachedAdminPages.length > 1 ? `<select onchange="moveSectionToPageAdmin('${sec.id}', this.value)" title="Przenieś sekcję na inną stronę" style="font-size: 12px; min-height: 32px; padding: 4px 8px;"><option value="">Przenieś na stronę…</option>${cachedAdminPages.filter((page) => page.id !== adminPageId).map((page) => `<option value="${escapeHtml(page.id)}">${escapeHtml(page.name)}</option>`).join("")}</select>` : ""}
                ${idx > 0 ? `<button type="button" class="button" onclick="moveSectionAdmin('${sec.id}', 'up')" style="font-size: 12px; padding: 6px 10px;" title="Przesuń sekcję w górę">▲</button>` : ""}
                ${idx < cachedAdminSections.length - 1 ? `<button type="button" class="button" onclick="moveSectionAdmin('${sec.id}', 'down')" style="font-size: 12px; padding: 6px 10px;" title="Przesuń sekcję w dół">▼</button>` : ""}
                <button type="button" class="button primary" onclick="openAddLinkAdmin('${sec.id}')" style="font-size: 12px; padding: 6px 12px;">+ Dodaj link</button>
                <button type="button" class="button danger" onclick="deleteSectionAdmin('${sec.id}', '${escapeHtml(sec.name)}')" style="font-size: 12px; padding: 6px 12px;">Usuń sekcję</button>
              </div>
            </div>

            <div id="adminSectionContent_${sec.id}" style="display: ${isCollapsed ? 'none' : 'block'}; margin-top: 10px;">
              ${items.length === 0 ? `<div style="font-size: 13px; color: var(--muted); padding: 10px 0; font-style: italic;">Brak linków w tej sekcji.</div>` : `
                <div style="display: grid; gap: 8px; padding-left: 12px; border-left: 2px solid var(--line);">
                  ${items.map((item, itemIdx) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; border-radius: 8px; background: color-mix(in srgb, var(--text) 5%, transparent); border: 1px solid var(--line);">
                      <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; min-width: 0; overflow: hidden; text-overflow: ellipsis;">
                        <span style="display: inline-flex; color: var(--muted);">${uiIcon("link", 14)}</span>
                        <strong style="white-space: nowrap;">${escapeHtml(item.name)}</strong>
                        <span style="color: var(--muted); font-size: 11px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">(${escapeHtml(item.url)})</span>
                      </div>
                      <div style="display: flex; gap: 6px; flex-shrink: 0; margin-left: 12px; align-items: center;">
                        ${itemIdx > 0 ? `<button type="button" class="button" onclick="moveLinkAdmin('${item.id}', 'up')" style="padding: 4px 8px; font-size: 11px;" title="Przesuń wpis w górę">▲</button>` : ""}
                        ${itemIdx < items.length - 1 ? `<button type="button" class="button" onclick="moveLinkAdmin('${item.id}', 'down')" style="padding: 4px 8px; font-size: 11px;" title="Przesuń wpis w dół">▼</button>` : ""}
                        <button type="button" class="button" onclick="openEditLinkAdmin('${sec.id}', '${item.id}')" style="padding: 4px 10px; font-size: 11px;">${uiIcon("edit", 13)} Edytuj</button>
                        <button type="button" class="button danger" onclick="deleteLinkAdmin('${item.id}', '${escapeHtml(item.name)}')" style="padding: 4px 10px; font-size: 11px;">Usuń</button>
                      </div>
                    </div>
                  `).join("")}
                </div>
              `}
            </div>
          </div>
        `;
      }).join("");
    }

    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

function selectAdminPage(pageId) {
  adminPageId = pageId || "home";
  try { localStorage.setItem("ifs.adminPage", adminPageId); } catch {}
  loadAdminSections();
}

// ─── Strony: dodawanie, nazwa, kolejność w menu, usuwanie ───

async function pageRequestAdmin(method, url, body, message) {
  try {
    const data = await request(url, { method, body: body ? JSON.stringify(body) : undefined });
    if (message) showToast(message);
    notifyServicesUpdated();
    loadAdminSections();
    return data;
  } catch (error) {
    showToast(error.message);
    return null;
  }
}

async function addPageAdmin(e) {
  if (e && e.preventDefault) e.preventDefault();
  const input = document.querySelector("#newPageNameInput");
  const name = input?.value.trim();
  if (!name) return showToast("Wpisz nazwę nowej strony.");
  const icon = document.querySelector("#newPageIconInput")?.value.trim() || "";
  const data = await pageRequestAdmin("POST", "/api/services/page", { name, icon }, `Dodano stronę „${name}”.`);
  if (data?.page) {
    adminPageId = data.page.id;
    try { localStorage.setItem("ifs.adminPage", adminPageId); } catch {}
  }
}

function renamePageAdmin(pageId) {
  const name = document.querySelector(`#adminPageName_${pageId}`)?.value.trim();
  const icon = document.querySelector(`#adminPageIcon_${pageId}`)?.value.trim() || "";
  if (!name) return showToast("Podaj nazwę strony.");
  pageRequestAdmin("PUT", `/api/services/page/${pageId}`, { name, icon }, "Strona zapisana.");
}

// Podgląd ikony strony na żywo (nazwa z lucide.dev/icons; puste = domyślna).
function previewPageIcon(pageId, value, defaultIcon) {
  const preview = document.querySelector(`#adminPageIconPreview_${pageId}`);
  if (!preview) return;
  const name = String(value || "").trim().toLowerCase();
  preview.innerHTML = uiIcon(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) && name.length > 1 ? name : defaultIcon, 20);
}

function movePageAdmin(pageId, direction) {
  pageRequestAdmin("PUT", `/api/services/page/${pageId}/move`, { direction });
}

async function deletePageAdmin(pageId) {
  const page = cachedAdminPages.find((item) => item.id === pageId);
  if (!page || !(await ifConfirm(`Usunąć stronę „${page.name}”? Jej sekcje i linki przejdą na Home.`, { okLabel: "Usuń", danger: true }))) return;
  if (adminPageId === pageId) adminPageId = "home";
  pageRequestAdmin("DELETE", `/api/services/page/${pageId}`, null, "Strona usunięta, sekcje przeniesione na Home.");
}

async function moveSectionToPageAdmin(sectionId, pageId) {
  if (!pageId) return;
  const section = cachedAdminSections.find((sec) => sec.id === sectionId);
  const page = cachedAdminPages.find((item) => item.id === pageId);
  if (!section || !page) return;
  try {
    await request(`/api/services/section/${sectionId}`, {
      method: "PUT",
      body: JSON.stringify({ name: section.name, pageId })
    });
    showToast(`Sekcja „${section.name}” przeniesiona na stronę „${page.name}”.`);
    notifyServicesUpdated();
    loadAdminSections();
  } catch (error) {
    showToast(error.message);
  }
}

function toggleCollapseAdminSection(sectionId) {
  collapsedAdminSections[sectionId] = !collapsedAdminSections[sectionId];
  loadAdminSections();
}

function notifyServicesUpdated() {
  try {
    localStorage.setItem("homedash_services_updated", String(Date.now()));
  } catch (e) {}
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("homedash_sync");
      channel.postMessage({ type: "services_updated" });
      channel.close();
    }
  } catch (e) {}
}

async function addSectionAdmin(e) {
  if (e && e.preventDefault) e.preventDefault();
  const input = document.querySelector("#newSectionNameInput");
  const name = input?.value.trim();
  if (!name) return showToast("Wpisz nazwę nowej sekcji.");
  try {
    await request("/api/services/section", { method: "POST", body: JSON.stringify({ name, icon: newSectionIcon, pageId: adminPageId }) });
    showToast("Sekcja dodana.");
    if (input) input.value = "";
    newSectionIcon = "";
    notifyServicesUpdated();
    loadAdminSections();
  } catch (error) {
    showToast(error.message);
  }
}

// Ikona nowej sekcji wybrana z listy przed kliknięciem „+ Dodaj sekcję”.
let newSectionIcon = "";

function pickIconForNewSection() {
  openIconPicker("Ikona nowej sekcji", (icon) => {
    newSectionIcon = icon;
    const preview = document.querySelector("#adminPageIconPreview_newSection");
    if (preview) preview.innerHTML = uiIcon(icon || "folder", 20);
  });
}

// „Zastosuj” na liście od razu przypisuje ikonę sekcji (nazwa bez zmian).
function pickIconForSection(id) {
  const section = cachedAdminSections.find((sec) => sec.id === id);
  if (!section) return;
  openIconPicker(`Ikona sekcji „${section.name}”`, async (icon) => {
    try {
      await request(`/api/services/section/${id}`, { method: "PUT", body: JSON.stringify({ name: section.name, icon }) });
      showToast(icon ? `Ikona „${icon}” przypisana.` : "Ikona usunięta.");
      notifyServicesUpdated();
      loadAdminSections();
    } catch (error) {
      showToast(error.message);
    }
  });
}

async function renameSectionAdmin(id) {
  const name = document.querySelector(`#adminSectionName_${id}`)?.value.trim();
  if (!name) return showToast("Podaj nazwę sekcji.");
  try {
    await request(`/api/services/section/${id}`, { method: "PUT", body: JSON.stringify({ name }) });
    showToast("Sekcja zapisana.");
    notifyServicesUpdated();
    loadAdminSections();
  } catch (error) {
    showToast(error.message);
  }
}

async function moveSectionAdmin(id, direction) {
  try {
    await request(`/api/services/section/${id}/move`, { method: "PUT", body: JSON.stringify({ direction }) });
    showToast("Kolejność sekcji została zmieniona.");
    notifyServicesUpdated();
    loadAdminSections();
  } catch (error) {
    showToast(error.message);
  }
}

async function moveLinkAdmin(id, direction) {
  try {
    await request(`/api/services/link/${id}/move`, { method: "PUT", body: JSON.stringify({ direction }) });
    showToast("Kolejność wpisu została zmieniona.");
    notifyServicesUpdated();
    loadAdminSections();
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteSectionAdmin(id, name) {
  if (!(await ifConfirm(`Czy na pewno chcesz usunąć sekcję „${name}” i wszystkie jej linki?`, { okLabel: "Usuń", danger: true }))) return;
  try {
    await request(`/api/services/section/${id}`, { method: "DELETE" });
    showToast("Sekcja usunięta.");
    notifyServicesUpdated();
    loadAdminSections();
  } catch (error) {
    showToast(error.message);
  }
}

function openAddLinkAdmin(sectionId) {
  editingAdminLink = null;
  const dialog = document.querySelector("#linkDialogAdmin");
  const title = document.querySelector("#linkDialogAdminTitle");
  const sectionSelect = document.querySelector("#linkSectionAdmin");

  if (!dialog) return;
  if (title) title.textContent = "Nowy link";
  if (sectionSelect) {
    sectionSelect.innerHTML = cachedAdminSections.map(s => `<option value="${s.id}" ${s.id === sectionId ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("");
  }
  const nameEl = document.querySelector("#linkNameAdmin");
  const urlEl = document.querySelector("#linkUrlAdmin");
  const iconEl = document.querySelector("#linkIconAdmin");
  const descEl = document.querySelector("#linkDescriptionAdmin");
  const modeEl = document.querySelector("#linkOpenModeAdmin");

  if (nameEl) nameEl.value = "";
  if (urlEl) urlEl.value = "";
  if (iconEl) iconEl.value = "";
  if (descEl) descEl.value = "";
  if (modeEl) modeEl.value = "new-tab";

  dialog.showModal();
}

function openEditLinkAdmin(sectionId, linkId) {
  const sec = cachedAdminSections.find(s => s.id === sectionId);
  const items = sec?.groups?.[0]?.items || [];
  const link = items.find(i => i.id === linkId);
  if (!link) return;

  editingAdminLink = link;
  const dialog = document.querySelector("#linkDialogAdmin");
  const title = document.querySelector("#linkDialogAdminTitle");
  const sectionSelect = document.querySelector("#linkSectionAdmin");

  if (!dialog) return;
  if (title) title.textContent = `Edytuj Link: ${link.name}`;
  if (sectionSelect) {
    sectionSelect.innerHTML = cachedAdminSections.map(s => `<option value="${s.id}" ${s.id === sectionId ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("");
  }
  const nameEl = document.querySelector("#linkNameAdmin");
  const urlEl = document.querySelector("#linkUrlAdmin");
  const iconEl = document.querySelector("#linkIconAdmin");
  const descEl = document.querySelector("#linkDescriptionAdmin");
  const modeEl = document.querySelector("#linkOpenModeAdmin");

  if (nameEl) nameEl.value = link.name || "";
  if (urlEl) urlEl.value = link.url || "";
  if (iconEl) iconEl.value = link.icon || "";
  if (descEl) descEl.value = link.description || "";
  if (modeEl) modeEl.value = link.openMode || "new-tab";

  dialog.showModal();
}

async function saveAdminLink(e) {
  e.preventDefault();
  const body = {
    sectionId: document.querySelector("#linkSectionAdmin")?.value,
    name: document.querySelector("#linkNameAdmin")?.value.trim(),
    url: document.querySelector("#linkUrlAdmin")?.value.trim(),
    icon: document.querySelector("#linkIconAdmin")?.value.trim(),
    description: document.querySelector("#linkDescriptionAdmin")?.value.trim(),
    openMode: document.querySelector("#linkOpenModeAdmin")?.value || "new-tab"
  };

  try {
    const path = editingAdminLink
      ? `/api/services/link/${editingAdminLink.id}`
      : "/api/services/link";
    await request(path, { method: editingAdminLink ? "PUT" : "POST", body: JSON.stringify(body) });
    document.querySelector("#linkDialogAdmin")?.close();
    showToast(editingAdminLink ? "Link zaktualizowany." : "Nowy link dodany.");
    notifyServicesUpdated();
    loadAdminSections();
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteLinkAdmin(id, name) {
  if (!(await ifConfirm(`Usunąć link „${name}”?`, { okLabel: "Usuń", danger: true }))) return;
  try {
    await request(`/api/services/link/${id}`, { method: "DELETE" });
    showToast("Link usunięty.");
    notifyServicesUpdated();
    loadAdminSections();
  } catch (error) {
    showToast(error.message);
  }
}

// Eksport funkcji do zakresu globalnego window
window.addSectionAdmin = addSectionAdmin;
window.renameSectionAdmin = renameSectionAdmin;
window.moveSectionAdmin = moveSectionAdmin;
window.moveLinkAdmin = moveLinkAdmin;
window.toggleCollapseAdminSection = toggleCollapseAdminSection;
window.deleteSectionAdmin = deleteSectionAdmin;
window.openAddLinkAdmin = openAddLinkAdmin;
window.openEditLinkAdmin = openEditLinkAdmin;
window.saveAdminLink = saveAdminLink;
window.deleteLinkAdmin = deleteLinkAdmin;

// ─── Ikony aplikacji: przesyłanie do folderu icons i lista ───

async function uploadIcons() {
  const input = document.querySelector("#iconsUploadInput");
  const result = document.querySelector("#iconsUploadResult");
  const files = [...(input?.files || [])];
  if (!files.length) return showToast("Najpierw wybierz pliki ikon z komputera.");
  const done = [];
  const failed = [];
  for (const file of files) {
    try {
      const data = await fileToDataUrl(file);
      try {
        const res = await request("/api/icons", { method: "POST", body: JSON.stringify({ name: file.name, data }) });
        done.push(res.name);
      } catch (error) {
        // Taka ikona już jest — pytamy, czy zastąpić.
        if (/już jest/.test(error.message) && await ifConfirm(`${error.message} Zastąpić?`, { okLabel: "Zastąp", danger: true })) {
          const res = await request("/api/icons", { method: "POST", body: JSON.stringify({ name: file.name, data, overwrite: true }) });
          done.push(res.name);
        } else {
          failed.push(error.message);
        }
      }
    } catch (error) {
      failed.push(`${file.name}: ${error.message}`);
    }
  }
  if (input) input.value = "";
  if (result) {
    result.innerHTML = `
      ${done.length ? `<div class="icons-upload-ok">${uiIcon("ok", 16)} Przesłano (${done.length}): ${done.map((name) => `<code>${escapeHtml(name)}</code>`).join(", ")}</div>` : ""}
      ${failed.length ? `<div class="icons-upload-bad">${uiIcon("warning", 16)} ${failed.map(escapeHtml).join("<br>")}</div>` : ""}
    `;
  }
  if (done.length) showToast(`Przesłano ikon: ${done.length}.`);
}

let cachedIconList = [];
// Nazwy ikon Lucide z pliku na serwerze (www/lucide-sprite.svg) — wczytywane raz, przy pierwszym otwarciu listy.
let cachedLucideNames = null;

async function loadLucideNames() {
  if (cachedLucideNames) return cachedLucideNames;
  try {
    const response = await fetch("/lucide-sprite.svg");
    const text = await response.text();
    cachedLucideNames = [...text.matchAll(/<symbol id="([a-z0-9-]+)"/g)].map((match) => match[1]);
  } catch {
    cachedLucideNames = [];
  }
  return cachedLucideNames;
}

// Tryb wyboru: to samo okno, ale tylko ikony Lucide i przycisk „Zastosuj” zamiast „Kopiuj nazwę”.
let iconPickerCallback = null;

function setIconsDialogTitle(eyebrow, title) {
  const heading = document.querySelector("#iconsListDialog .modal-heading");
  if (!heading) return;
  heading.querySelector(".eyebrow").textContent = eyebrow;
  heading.querySelector("h2").textContent = title;
}

async function openIconPicker(title, onPick) {
  iconPickerCallback = onPick;
  setIconsDialogTitle("Wybierz ikonę Lucide", title);
  const dialog = document.querySelector("#iconsListDialog");
  const box = document.querySelector("#iconsListBox");
  if (!dialog || !box) return;
  dialog.addEventListener("close", () => {
    iconPickerCallback = null;
    setIconsDialogTitle("Ikony aplikacji", "Lista ikon");
  }, { once: true });
  box.innerHTML = '<div class="empty">Wczytywanie ikon...</div>';
  const search = document.querySelector("#iconsListSearch");
  if (search) search.value = "";
  dialog.showModal();
  const lucideNames = await loadLucideNames();
  const summary = document.querySelector("#iconsListSummary");
  if (summary) summary.textContent = `Ikony Lucide: ${lucideNames.length} — kliknij „Zastosuj” przy wybranej.`;
  renderIconsList();
}

async function openIconsList() {
  iconPickerCallback = null;
  const dialog = document.querySelector("#iconsListDialog");
  const box = document.querySelector("#iconsListBox");
  if (!dialog || !box) return;
  box.innerHTML = '<div class="empty">Wczytywanie ikon...</div>';
  const search = document.querySelector("#iconsListSearch");
  if (search) search.value = "";
  dialog.showModal();
  try {
    const [data, lucideNames] = await Promise.all([request("/api/icons"), loadLucideNames()]);
    cachedIconList = data.icons || [];
    const summary = document.querySelector("#iconsListSummary");
    if (summary) summary.textContent = `Obrazki: ${cachedIconList.length} (Twoich: ${data.ownCount}, wbudowanych: ${data.builtInCount}) · Ikony Lucide: ${lucideNames.length} (pod obrazkami)`;
    renderIconsList();
  } catch (error) {
    box.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

function renderIconsList() {
  const box = document.querySelector("#iconsListBox");
  if (!box) return;
  const query = (document.querySelector("#iconsListSearch")?.value || "").trim().toLowerCase();
  const picking = typeof iconPickerCallback === "function";
  const icons = picking ? [] : cachedIconList.filter((icon) => !query || icon.name.includes(query));
  // Ikony Lucide zawsze pod obrazkami (bez wpisywania) — wyszukiwarka zawęża obie części.
  const lucide = (cachedLucideNames || []).filter((name) => !query || name.includes(query));
  if (!icons.length && !lucide.length) {
    box.innerHTML = '<div class="empty">Brak ikon pasujących do wyszukiwania.</div>';
    return;
  }
  box.innerHTML = `
    <table class="icons-list-table">
      <thead><tr><th>Ikona</th><th>Nazwa</th><th></th></tr></thead>
      <tbody>
        ${picking ? `
          <tr>
            <td><span class="icons-lucide-preview">${uiIcon("folder", 30)}</span></td>
            <td>Bez ikony</td>
            <td><button type="button" class="button" data-apply-icon="">Zastosuj</button></td>
          </tr>` : ""}
        ${icons.map((icon) => `
          <tr>
            <td><img src="../../icons/${encodeURIComponent(icon.name)}" alt="" loading="lazy"></td>
            <td><code>${escapeHtml(icon.name)}</code>${icon.own ? ' <span class="icons-own-tag">Twoja</span>' : ' <span class="icons-builtin-tag">Wbudowana</span>'}</td>
            <td><button type="button" class="button" data-copy-icon="${escapeHtml(icon.name)}">${uiIcon("logs", 14)} Kopiuj nazwę</button></td>
          </tr>
        `).join("")}
        ${lucide.map((name) => `
          <tr>
            <td><span class="icons-lucide-preview">${uiIcon(name, 30)}</span></td>
            <td><code>${escapeHtml(name)}</code> <span class="icons-lucide-tag">Lucide</span></td>
            <td>${picking
              ? `<button type="button" class="button primary" data-apply-icon="${escapeHtml(name)}">Zastosuj</button>`
              : `<button type="button" class="button" data-copy-icon="${escapeHtml(name)}">${uiIcon("logs", 14)} Kopiuj nazwę</button>`}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  box.querySelectorAll("[data-apply-icon]").forEach((button) => {
    button.addEventListener("click", () => {
      const pick = iconPickerCallback;
      document.querySelector("#iconsListDialog")?.close();
      if (pick) pick(button.dataset.applyIcon);
    });
  });
  box.querySelectorAll("[data-copy-icon]").forEach((button) => {
    button.addEventListener("click", () => copyIconName(button.dataset.copyIcon));
  });
}

// Schowek: navigator.clipboard działa tylko na https albo localhost — w sieci domowej
// (http://adres-serwera) używamy zapasowej metody z ukrytym polem tekstowym.
async function copyIconName(name) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(name);
    } else {
      const field = document.createElement("textarea");
      field.value = name;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.querySelector("#iconsListDialog")?.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    showToast(`Skopiowano: ${name}`);
  } catch {
    showToast(`Nie udało się skopiować — nazwa: ${name}`);
  }
}
