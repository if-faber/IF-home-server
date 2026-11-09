// tab-helper.js — Moduł Zakładki „Helper & System” (mods/admin)

function renderHelperTab() {
  const saved = state.settings || {};
  // Na świeżej instalacji pola nie mogą być puste — podpowiadamy wartości startowe.
  const config = {
    title: saved.title || "Serwer domowy",
    subtitle: saved.subtitle || "Usługi, narzędzia i administracja serwera",
    defaultHost: saved.defaultHost || window.location.hostname
  };
  return `
    <div class="admin-tab-container">
      <section class="admin-section-card">
        <h2>${uiIcon("settings", 22)} Ustawienia Ogólne Systemu</h2>
        <form id="settingsForm" class="admin-form-panel">
          <div class="admin-form-grid">
            <label>Tytuł strony<input id="settingTitle" value="${escapeHtml(config.title ?? "")}" required></label>
            <label>Opis / Podtytuł<input id="settingSubtitle" value="${escapeHtml(config.subtitle ?? "")}" required></label>
            <label><span class="field-title">Adres strony startowej (nazwa serwera) ${infoTip("Jak domena strony startowej, np. iflab — otwierasz ją pod http://iflab. Tej nazwy używają odnośniki do Dockge, Cockpit i aplikacji. if-server wpisuje ją przy instalacji (nazwa serwera). Stronę możesz też otworzyć przez numer IP — działa tak samo.")}</span><input id="settingDefaultHost" value="${escapeHtml(config.defaultHost ?? "")}" required></label>
            <label>Nowy PIN administratora<input id="settingNewPin" type="password" inputmode="numeric" placeholder="Pozostaw puste = bez zmian"></label>
            <label>Upload logo (PNG/JPG)<input id="settingLogo" type="file" accept="image/png,image/jpeg,image/webp"></label>
          </div>
          <menu style="margin-top: 15px;">
            <button class="button primary" type="submit">${uiIcon("save", 16)} Zapisz Ustawienia Ogólne</button>
          </menu>
        </form>
      </section>
    </div>
  `;
}

function bindHelperEvents() {
  document.querySelector("#settingsForm")?.addEventListener("submit", saveSettings);
}

async function saveSettings(e) {
  e.preventDefault();
  const settings = {
    title: document.querySelector("#settingTitle").value.trim(),
    subtitle: document.querySelector("#settingSubtitle").value.trim(),
    defaultHost: document.querySelector("#settingDefaultHost").value.trim(),
    logo: state.settings.logo,
    newPin: document.querySelector("#settingNewPin").value.trim()
  };

  const logoFile = document.querySelector("#settingLogo").files[0];
  if (logoFile) {
    settings.logoData = await fileToDataUrl(logoFile);
  }

  try {
    const data = await request("/api/dashboard/settings", {
      method: "PUT",
      body: JSON.stringify(settings)
    });
    state.settings = data.settings || settings;
    // Po zmianie PIN-u wylogowanie — logujesz się od nowa nowym PIN-em. Inaczej
    // przeglądarka wysyłałaby stary PIN i serwer odrzucałby kolejne zapisy.
    if (settings.newPin) {
      logoutAdmin();
      showToast("PIN zmieniony. Zaloguj się nowym PIN-em.");
      return;
    }
    showToast("Ustawienia Ogólne zostały zapisane.");
  } catch (error) {
    showToast(error.message);
  }
}
