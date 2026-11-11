// tab-homepage.js — Moduł Zakładki „Homepage” (Zarządzanie Sekcjami i Linkami Strony Głównej)

let cachedAdminSections = [];
let cachedAdminPages = [];
let adminPageId = (() => { try { return localStorage.getItem("ifs.adminPage") || "home"; } catch { return "home"; } })();
let editingAdminLink = null;
let collapsedAdminSections = {};

// Napisy karty (plan „Język”, Etap 3): sekcja admin.pages; dymki: admin.messages.
const pagesT = (key, vars) => escapeHtml(t(`admin.pages.${key}`, vars));
const pagesMsg = (key, vars) => t(`admin.messages.${key}`, vars);

function renderHomepageTab() {
  return `
    <div class="admin-tab-container">
      <section class="admin-section-card">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 8px;">
          <h2 style="margin: 0;">${uiIcon("page", 22)} ${pagesT("title")}</h2>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <!-- Ten sam przycisk co w kafelku „Ikony aplikacji” — ikony stron i sekcji wybiera się tutaj. -->
          <button type="button" class="button" id="btnIconsListPages" style="padding: 6px 16px; font-size: 13px;">${uiIcon("search", 14)} ${pagesT("icons_list")}</button>
          <a href="../../" class="button primary" target="_blank" style="padding: 6px 16px; font-size: 13px; font-weight: bold; text-decoration: none;">${pagesT("open_page")} ${uiIcon("external", 14)}</a>
          </div>
        </div>
        <p class="settings-note">${pagesT("intro")}</p>

        <div id="adminSectionsManager" style="margin-top: 16px;">
          <div class="empty">${pagesT("loading")}</div>
        </div>
      </section>

      <section class="admin-section-card">
        <h2 style="margin: 0 0 6px;">${uiIcon("image", 22)} ${pagesT("icons_title")}</h2>
        <p class="settings-note">${pagesT("icons_intro").replace("{folder}", "<code>icons</code>").replace("{example}", "<code>immich.png</code>")}</p>
        <div class="icons-upload-row">
          <label class="icons-upload-pick">
            <input type="file" id="iconsUploadInput" accept=".png,.svg,.webp,.jpg,.jpeg,.ico,image/png,image/svg+xml,image/webp,image/jpeg,image/x-icon" multiple>
          </label>
          <button type="button" class="button primary" id="btnIconsUpload">${uiIcon("arrowUp", 16)} ${pagesT("icons_upload")}</button>
          <button type="button" class="button" id="btnIconsList">${uiIcon("search", 16)} ${pagesT("icons_list")}</button>
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
          <input type="text" id="adminPageIcon_${escapeHtml(page.id)}" value="${escapeHtml(page.icon || "")}" maxlength="60" class="hp-icon-input" placeholder="${pagesT("icon_placeholder")}" title="${pagesT("icon_tip")}" oninput="previewPageIcon('${page.id}', this.value, '${defaultIcon}')">
          ${!isHome && idx > 1 ? `<button type="button" class="button" onclick="movePageAdmin('${page.id}', 'up')" style="font-size: 12px; padding: 6px 10px;" title="${pagesT("page_up")}">▲</button>` : ""}
          ${!isHome && idx < cachedAdminPages.length - 1 ? `<button type="button" class="button" onclick="movePageAdmin('${page.id}', 'down')" style="font-size: 12px; padding: 6px 10px;" title="${pagesT("page_down")}">▼</button>` : ""}
          <button type="button" class="button" onclick="renamePageAdmin('${page.id}')" style="font-size: 12px; padding: 6px 12px;">${uiIcon("save", 14)} ${pagesT("save")}</button>
          ${isHome ? `<span class="hp-home-tag">${pagesT("home_tag")} ${infoTip(t("admin.pages.home_tip"))}</span>` : `<button type="button" class="button danger" onclick="deletePageAdmin('${page.id}')" style="font-size: 12px; padding: 6px 12px;">${pagesT("delete_page")}</button>`}
        </div>
      `;
    }).join("");

    let html = `
      <div class="hp-box" style="display: grid; gap: 10px; margin-bottom: 22px;">
        <strong style="font-size: 16px;">${uiIcon("file", 18)} ${pagesT("pages_title")} ${infoTip(t("admin.pages.pages_tip"))}</strong>
        ${pageRows}
        <form id="adminAddPageForm" onsubmit="addPageAdmin(event)" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 6px;">
          <span class="hp-icon-preview" id="adminPageIconPreview_new">${uiIcon("page", 20)}</span>
          <input type="text" id="newPageNameInput" maxlength="60" placeholder="${pagesT("new_page_placeholder")}" class="hp-input" style="min-width: 160px;">
          <input type="text" id="newPageIconInput" maxlength="60" class="hp-icon-input" placeholder="${pagesT("icon_placeholder")}" title="${pagesT("icon_tip")}" oninput="previewPageIcon('new', this.value, 'page')">
          <button type="submit" class="button primary" style="padding: 10px 18px; font-weight: bold;">${pagesT("add_page")}</button>
        </form>
      </div>
      <label class="admin-page-picker" style="display: grid; gap: 6px; margin-bottom: 18px; font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--muted);">
        ${pagesT("page_label")}
        <select id="adminPageSelect" onchange="selectAdminPage(this.value)" style="font-size: 15px; font-weight: 700; text-transform: none; color: var(--text);">${pageOptions(adminPageId)}</select>
      </label>
    `;
    html += `
      <form id="adminAddSectionForm" onsubmit="addSectionAdmin(event)" style="display: flex; gap: 12px; margin-bottom: 20px; align-items: center; flex-wrap: wrap;">
        <span class="hp-icon-preview" id="adminPageIconPreview_newSection">${uiIcon(newSectionIcon || "folder", 20)}</span>
        <input type="text" id="newSectionNameInput" placeholder="${pagesT("new_section_placeholder")}" class="hp-input">
        <button type="button" class="button" onclick="pickIconForNewSection()" style="padding: 10px 14px;">${uiIcon("search", 14)} ${pagesT("pick_icon")}</button>
        <button type="submit" class="button primary" style="padding: 10px 18px; font-weight: bold;">${pagesT("add_section")}</button>
      </form>
    `;

    if (!cachedAdminSections.length) {
      html += `<div class="empty">${pagesT("no_sections")}</div>`;
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
                  <button type="button" class="button" onclick="renameSectionAdmin('${sec.id}')" style="font-size: 12px; padding: 6px 12px;">${uiIcon("save", 14)} ${pagesT("save")}</button>
                  <small style="color: var(--muted); font-size: 12px;">${escapeHtml(tn("admin.pages.entries", items.length))}</small>
                </div>
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding-left: 46px;">
                  <button type="button" class="button" onclick="pickIconForSection('${sec.id}')" style="font-size: 12px; padding: 6px 12px;">${uiIcon("search", 14)} ${pagesT("pick_icon")}</button>
                  <small style="color: var(--muted); font-size: 12px;">${sec.icon ? pagesT("section_icon").replace("{icon}", `<code>${escapeHtml(sec.icon)}</code>`) : pagesT("no_icon")}</small>
                </div>
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                <button type="button" class="button" onclick="toggleCollapseAdminSection('${sec.id}')" style="font-size: 12px; padding: 6px 12px;" title="${pagesT(isCollapsed ? "expand_title" : "collapse_title")}">
                  ${isCollapsed ? `${uiIcon("chevronDown", 14)} ${pagesT("expand")}` : `${uiIcon("chevronUp", 14)} ${pagesT("collapse")}`}
                </button>
                ${cachedAdminPages.length > 1 ? `<select onchange="moveSectionToPageAdmin('${sec.id}', this.value)" title="${pagesT("move_to_page_title")}" style="font-size: 12px; min-height: 32px; padding: 4px 8px;"><option value="">${pagesT("move_to_page")}</option>${cachedAdminPages.filter((page) => page.id !== adminPageId).map((page) => `<option value="${escapeHtml(page.id)}">${escapeHtml(page.name)}</option>`).join("")}</select>` : ""}
                ${idx > 0 ? `<button type="button" class="button" onclick="moveSectionAdmin('${sec.id}', 'up')" style="font-size: 12px; padding: 6px 10px;" title="${pagesT("section_up")}">▲</button>` : ""}
                ${idx < cachedAdminSections.length - 1 ? `<button type="button" class="button" onclick="moveSectionAdmin('${sec.id}', 'down')" style="font-size: 12px; padding: 6px 10px;" title="${pagesT("section_down")}">▼</button>` : ""}
                <button type="button" class="button primary" onclick="openAddLinkAdmin('${sec.id}')" style="font-size: 12px; padding: 6px 12px;">${pagesT("add_link")}</button>
                <button type="button" class="button danger" onclick="deleteSectionAdmin('${sec.id}', '${escapeHtml(sec.name)}')" style="font-size: 12px; padding: 6px 12px;">${pagesT("delete_section")}</button>
              </div>
            </div>

            <div id="adminSectionContent_${sec.id}" style="display: ${isCollapsed ? 'none' : 'block'}; margin-top: 10px;">
              ${items.length === 0 ? `<div style="font-size: 13px; color: var(--muted); padding: 10px 0; font-style: italic;">${pagesT("no_links")}</div>` : `
                <div style="display: grid; gap: 8px; padding-left: 12px; border-left: 2px solid var(--line);">
                  ${items.map((item, itemIdx) => `
                    <div class="hp-link-row" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; border-radius: 8px; background: color-mix(in srgb, var(--text) 5%, transparent); border: 1px solid var(--line);">
                      <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; min-width: 0; overflow: hidden; text-overflow: ellipsis;">
                        <span style="display: inline-flex; color: var(--muted);">${uiIcon("link", 14)}</span>
                        <strong style="white-space: nowrap;">${escapeHtml(item.name)}</strong>
                        <span style="color: var(--muted); font-size: 11px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">(${escapeHtml(item.url)})</span>
                      </div>
                      <div class="hp-link-actions" style="display: flex; gap: 6px; flex-shrink: 0; margin-left: 12px; align-items: center;">
                        ${itemIdx > 0 ? `<button type="button" class="button" onclick="moveLinkAdmin('${item.id}', 'up')" style="padding: 4px 8px; font-size: 11px;" title="${pagesT("link_up")}">▲</button>` : ""}
                        ${itemIdx < items.length - 1 ? `<button type="button" class="button" onclick="moveLinkAdmin('${item.id}', 'down')" style="padding: 4px 8px; font-size: 11px;" title="${pagesT("link_down")}">▼</button>` : ""}
                        <button type="button" class="button" onclick="openEditLinkAdmin('${sec.id}', '${item.id}')" style="padding: 4px 10px; font-size: 11px;">${uiIcon("edit", 13)} ${pagesT("edit")}</button>
                        <button type="button" class="button danger" onclick="deleteLinkAdmin('${item.id}', '${escapeHtml(item.name)}')" style="padding: 4px 10px; font-size: 11px;">${pagesT("delete")}</button>
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
  if (!name) return showToast(pagesMsg("page_name_required_new"));
  const icon = document.querySelector("#newPageIconInput")?.value.trim() || "";
  const data = await pageRequestAdmin("POST", "/api/services/page", { name, icon }, pagesMsg("page_added", { name }));
  if (data?.page) {
    adminPageId = data.page.id;
    try { localStorage.setItem("ifs.adminPage", adminPageId); } catch {}
  }
}

function renamePageAdmin(pageId) {
  const name = document.querySelector(`#adminPageName_${pageId}`)?.value.trim();
  const icon = document.querySelector(`#adminPageIcon_${pageId}`)?.value.trim() || "";
  if (!name) return showToast(pagesMsg("page_name_required"));
  pageRequestAdmin("PUT", `/api/services/page/${pageId}`, { name, icon }, pagesMsg("page_saved"));
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
  if (!page || !(await ifConfirm(t("admin.pages.confirm_delete_page", { name: page.name }), { okLabel: t("admin.pages.delete_ok"), danger: true }))) return;
  if (adminPageId === pageId) adminPageId = "home";
  pageRequestAdmin("DELETE", `/api/services/page/${pageId}`, null, pagesMsg("page_deleted"));
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
    showToast(pagesMsg("section_moved", { section: section.name, page: page.name }));
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
  if (!name) return showToast(pagesMsg("section_name_required_new"));
  try {
    await request("/api/services/section", { method: "POST", body: JSON.stringify({ name, icon: newSectionIcon, pageId: adminPageId }) });
    showToast(pagesMsg("section_added"));
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
  openIconPicker(t("admin.pages.picker_new_section"), (icon) => {
    newSectionIcon = icon;
    const preview = document.querySelector("#adminPageIconPreview_newSection");
    if (preview) preview.innerHTML = uiIcon(icon || "folder", 20);
  });
}

// „Zastosuj” na liście od razu przypisuje ikonę sekcji (nazwa bez zmian).
function pickIconForSection(id) {
  const section = cachedAdminSections.find((sec) => sec.id === id);
  if (!section) return;
  openIconPicker(t("admin.pages.picker_section", { name: section.name }), async (icon) => {
    try {
      await request(`/api/services/section/${id}`, { method: "PUT", body: JSON.stringify({ name: section.name, icon }) });
      showToast(icon ? pagesMsg("section_icon_set", { icon }) : pagesMsg("section_icon_removed"));
      notifyServicesUpdated();
      loadAdminSections();
    } catch (error) {
      showToast(error.message);
    }
  });
}

async function renameSectionAdmin(id) {
  const name = document.querySelector(`#adminSectionName_${id}`)?.value.trim();
  if (!name) return showToast(pagesMsg("section_name_required"));
  try {
    await request(`/api/services/section/${id}`, { method: "PUT", body: JSON.stringify({ name }) });
    showToast(pagesMsg("section_saved"));
    notifyServicesUpdated();
    loadAdminSections();
  } catch (error) {
    showToast(error.message);
  }
}

async function moveSectionAdmin(id, direction) {
  try {
    await request(`/api/services/section/${id}/move`, { method: "PUT", body: JSON.stringify({ direction }) });
    showToast(pagesMsg("section_order_changed"));
    notifyServicesUpdated();
    loadAdminSections();
  } catch (error) {
    showToast(error.message);
  }
}

async function moveLinkAdmin(id, direction) {
  try {
    await request(`/api/services/link/${id}/move`, { method: "PUT", body: JSON.stringify({ direction }) });
    showToast(pagesMsg("link_order_changed"));
    notifyServicesUpdated();
    loadAdminSections();
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteSectionAdmin(id, name) {
  if (!(await ifConfirm(t("admin.pages.confirm_delete_section", { name }), { okLabel: t("admin.pages.delete_ok"), danger: true }))) return;
  try {
    await request(`/api/services/section/${id}`, { method: "DELETE" });
    showToast(pagesMsg("section_deleted"));
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
  if (title) title.textContent = t("admin.link_dialog.title_new");
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
  if (title) title.textContent = t("admin.link_dialog.title_edit", { name: link.name });
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
    showToast(editingAdminLink ? pagesMsg("link_updated") : pagesMsg("link_added"));
    notifyServicesUpdated();
    loadAdminSections();
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteLinkAdmin(id, name) {
  if (!(await ifConfirm(t("admin.pages.confirm_delete_link", { name }), { okLabel: t("admin.pages.delete_ok"), danger: true }))) return;
  try {
    await request(`/api/services/link/${id}`, { method: "DELETE" });
    showToast(pagesMsg("link_deleted"));
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
  if (!files.length) return showToast(pagesMsg("icons_choose_files"));
  const done = [];
  const failed = [];
  for (const file of files) {
    try {
      const data = await fileToDataUrl(file);
      try {
        const res = await request("/api/icons", { method: "POST", body: JSON.stringify({ name: file.name, data }) });
        done.push(res.name);
      } catch (error) {
        // Taka ikona już jest — pytamy, czy zastąpić (rozpoznanie po kodzie błędu z serwera).
        if (error.code === "icon_exists" && await ifConfirm(t("admin.pages.confirm_replace_icon", { message: error.message }), { okLabel: t("admin.pages.icons_replace_ok"), danger: true })) {
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
      ${done.length ? `<div class="icons-upload-ok">${uiIcon("ok", 16)} ${pagesT("icons_uploaded", { n: done.length })} ${done.map((name) => `<code>${escapeHtml(name)}</code>`).join(", ")}</div>` : ""}
      ${failed.length ? `<div class="icons-upload-bad">${uiIcon("warning", 16)} ${failed.map(escapeHtml).join("<br>")}</div>` : ""}
    `;
  }
  if (done.length) showToast(pagesMsg("icons_uploaded", { n: done.length }));
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
  setIconsDialogTitle(t("admin.icons.picker_eyebrow"), title);
  const dialog = document.querySelector("#iconsListDialog");
  const box = document.querySelector("#iconsListBox");
  if (!dialog || !box) return;
  dialog.addEventListener("close", () => {
    iconPickerCallback = null;
    setIconsDialogTitle(t("admin.icons.eyebrow"), t("admin.icons.title"));
  }, { once: true });
  box.innerHTML = `<div class="empty">${escapeHtml(t("admin.icons.loading"))}</div>`;
  const search = document.querySelector("#iconsListSearch");
  if (search) search.value = "";
  dialog.showModal();
  const lucideNames = await loadLucideNames();
  const summary = document.querySelector("#iconsListSummary");
  if (summary) summary.textContent = t("admin.icons.summary_picker", { n: lucideNames.length });
  renderIconsList();
}

async function openIconsList() {
  iconPickerCallback = null;
  const dialog = document.querySelector("#iconsListDialog");
  const box = document.querySelector("#iconsListBox");
  if (!dialog || !box) return;
  box.innerHTML = `<div class="empty">${escapeHtml(t("admin.icons.loading"))}</div>`;
  const search = document.querySelector("#iconsListSearch");
  if (search) search.value = "";
  dialog.showModal();
  try {
    const [data, lucideNames] = await Promise.all([request("/api/icons"), loadLucideNames()]);
    cachedIconList = data.icons || [];
    const summary = document.querySelector("#iconsListSummary");
    if (summary) summary.textContent = t("admin.icons.summary", { images: cachedIconList.length, own: data.ownCount, builtin: data.builtInCount, lucide: lucideNames.length });
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
    box.innerHTML = `<div class="empty">${escapeHtml(t("admin.icons.none_found"))}</div>`;
    return;
  }
  box.innerHTML = `
    <table class="icons-list-table">
      <thead><tr><th>${escapeHtml(t("admin.icons.col_icon"))}</th><th>${escapeHtml(t("admin.icons.col_name"))}</th><th></th></tr></thead>
      <tbody>
        ${picking ? `
          <tr>
            <td><span class="icons-lucide-preview">${uiIcon("folder", 30)}</span></td>
            <td>${escapeHtml(t("admin.icons.no_icon"))}</td>
            <td><button type="button" class="button" data-apply-icon="">${escapeHtml(t("admin.icons.apply"))}</button></td>
          </tr>` : ""}
        ${icons.map((icon) => `
          <tr>
            <td><img src="../../icons/${encodeURIComponent(icon.name)}" alt="" loading="lazy"></td>
            <td><code>${escapeHtml(icon.name)}</code>${icon.own ? ` <span class="icons-own-tag">${escapeHtml(t("admin.icons.tag_own"))}</span>` : ` <span class="icons-builtin-tag">${escapeHtml(t("admin.icons.tag_builtin"))}</span>`}</td>
            <td><button type="button" class="button" data-copy-icon="${escapeHtml(icon.name)}">${uiIcon("logs", 14)} ${escapeHtml(t("admin.icons.copy"))}</button></td>
          </tr>
        `).join("")}
        ${lucide.map((name) => `
          <tr>
            <td><span class="icons-lucide-preview">${uiIcon(name, 30)}</span></td>
            <td><code>${escapeHtml(name)}</code> <span class="icons-lucide-tag">Lucide</span></td>
            <td>${picking
              ? `<button type="button" class="button primary" data-apply-icon="${escapeHtml(name)}">${escapeHtml(t("admin.icons.apply"))}</button>`
              : `<button type="button" class="button" data-copy-icon="${escapeHtml(name)}">${uiIcon("logs", 14)} ${escapeHtml(t("admin.icons.copy"))}</button>`}</td>
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
    showToast(t("admin.icons.copied", { name }));
  } catch {
    showToast(t("admin.icons.copy_failed", { name }));
  }
}
