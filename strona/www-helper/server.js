const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const net = require("net");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

function loadEnvironmentFile(filename) {
  if (!fs.existsSync(filename)) return;

  const lines = fs.readFileSync(filename, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const APP_BASE_DIR = process.env.APP_BASE_DIR || path.join(__dirname, "..");
const CONFIG_DIR = process.env.CONFIG_DIR || path.join(APP_BASE_DIR, "config");
const WWW_DIR = process.env.WWW_DIR || path.join(APP_BASE_DIR, "www");
const HELPER_DIR = process.env.HELPER_DIR || path.join(APP_BASE_DIR, "www-helper");

loadEnvironmentFile(process.env.DASHBOARD_ENV_FILE || path.join(CONFIG_DIR, "dashboard.env"));

const app = express();
const PORT = Number(process.env.PORT || 3010);

const DATA_FILE = process.env.DATA_FILE || path.join(CONFIG_DIR, "services.json");
const DASHBOARD_FILE = process.env.DASHBOARD_FILE || path.join(CONFIG_DIR, "dashboard.json");
const THEME_FILE = process.env.THEME_FILE || path.join(CONFIG_DIR, "theme.json");
const ADMIN_THEME_FILE = process.env.ADMIN_THEME_FILE || path.join(CONFIG_DIR, "admin-theme.json");
const KIOSK_FILE = process.env.KIOSK_FILE || path.join(CONFIG_DIR, "kiosk.json");
// Pliki wgrane w UI (logo, tapety) trzymamy w wolumenie z konfiguracją, a nie w obrazie
// kontenera — inaczej znikałyby po każdej aktualizacji obrazu.
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(CONFIG_DIR, "uploads");
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(HELPER_DIR, "backups");
// Ikony aplikacji do kafelków: najpierw własne z wolumenu (ICONS_DIR), potem ok. 100
// najpopularniejszych wbudowanych w obraz (www/icons). Własna o tej samej nazwie wygrywa.
const ICONS_DIR = process.env.ICONS_DIR || path.join(APP_BASE_DIR, "icons");
// PIN domyślny, gdy nie ustawiono DASHBOARD_PIN ani nie zmieniono go w UI.
// Taki sam jak w przykładzie compose.yaml — trzeba go zmienić po instalacji.
const DEFAULT_PIN = "1234";

// Katalog docker/app/ hosta (stosy Dockge) zamontowany pod tą ścieżką w kontenerze
// if-startpage — do odczytu i zapisu compose.yaml innych stosów (zakładka Aktualizacje).
// Wymaga wolumenu "/home/{user}/docker/app:/host-apps" w compose.yaml.
const HOST_APPS_DIR = process.env.HOST_APPS_DIR || "/host-apps";

// Brak nagłówków CORS celowo: strona i API działają pod tym samym adresem,
// więc obce strony otwarte w przeglądarce nie mogą wywoływać tego API.
app.disable("x-powered-by");
app.use(express.json({ limit: "20mb" }));
app.use("/uploads", express.static(UPLOAD_DIR, {
  setHeaders: (res) => {
    res.setHeader("Cache-Control", "no-cache");
  }
}));
app.use("/icons", express.static(ICONS_DIR, {
  setHeaders: (res, filePath) => {
    res.setHeader("Cache-Control", "no-cache");
    // SVG wgrany przez użytkownika może zawierać skrypt — przy otwarciu wprost nic się nie wykona.
    if (/\.svg$/i.test(filePath)) res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  }
}));
app.use(express.static(WWW_DIR, {
  setHeaders: (res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  }
}));

app.get("/", (req, res) => {
  res.sendFile(path.join(WWW_DIR, "index.html"));
});

function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ sections: [] }, null, 2), "utf8");
  }

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function loadServices() {
  ensureDataFile();

  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    return normalizeServices(data);
  } catch (error) {
    console.error("Load services error:", error);
    return normalizeServices({});
  }
}

// Strony (pages) → sekcje → linki. Strona "home" istnieje zawsze.
// Starsze pliki bez stron: wszystkie sekcje trafiają na Home.
const HOME_PAGE_ID = "home";

function normalizeServices(data) {
  const out = data && typeof data === "object" ? data : {};
  if (!Array.isArray(out.sections)) out.sections = [];
  if (!Array.isArray(out.pages)) out.pages = [];
  out.pages = out.pages.filter((page) => page && page.id && normalizeText(page.name));
  if (!out.pages.some((page) => page.id === HOME_PAGE_ID)) {
    out.pages.unshift({ id: HOME_PAGE_ID, name: "Home" });
  }
  const pageIds = new Set(out.pages.map((page) => page.id));
  out.sections.forEach((section) => {
    if (!section.pageId || !pageIds.has(section.pageId)) section.pageId = HOME_PAGE_ID;
  });
  return out;
}

function backupServices() {
  ensureDataFile();

  if (!fs.existsSync(DATA_FILE)) return;

  const timestamp = new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replaceAll(".", "-");

  const backupFile = path.join(BACKUP_DIR, `services-${timestamp}.json`);

  fs.copyFileSync(DATA_FILE, backupFile);

  const backups = fs
    .readdirSync(BACKUP_DIR)
    .filter(file => file.endsWith(".json"))
    .sort()
    .reverse();

  backups.slice(20).forEach(file => {
    fs.unlinkSync(path.join(BACKUP_DIR, file));
  });
}

function saveServices(data) {
  ensureDataFile();

  try {
    backupServices();
  } catch (error) {
    console.error("Backup error:", error);
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

function createId() {
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function normalizeText(value) {
  return String(value || "").trim();
}

function ensureConfigDir(filename) {
  const dir = path.dirname(filename);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadDashboardSettings() {
  ensureConfigDir(DASHBOARD_FILE);
  if (!fs.existsSync(DASHBOARD_FILE)) return {};

  try {
    const data = JSON.parse(fs.readFileSync(DASHBOARD_FILE, "utf8"));
    return sanitizeDashboardSettings(data);
  } catch (error) {
    console.error("Load dashboard settings error:", error);
    return {};
  }
}

function sanitizeDashboardSettings(input) {
  const allowed = ["title", "subtitle", "apiUrl", "defaultHost", "logo"];
  const output = {};

  for (const key of allowed) {
    const value = normalizeText(input?.[key]);
    if (value) output[key] = value;
  }

  return output;
}

function saveDashboardSettings(settings) {
  ensureConfigDir(DASHBOARD_FILE);
  fs.writeFileSync(DASHBOARD_FILE, JSON.stringify(sanitizeDashboardSettings(settings), null, 2), "utf8");
}

function sanitizeThemeSettings(input) {
  const allowed = ["accent", "accentAlt", "surfaceColor", "fontMenu", "fontCard", "fontDescription", "bg", "backgroundImage", "backgroundUrl", "backgroundBlur", "backgroundOpacity", "backgroundDim", "sidebarWidth", "sidebarPanelColor", "sidebarPanelAlpha", "sidebarToggleColor", "sidebarToggleSize", "titleSize", "titleColor", "titleShadowBlur", "subtitleSize", "subtitleColor", "subtitleShadowBlur", "pageTitleSize", "pageTitleShadowBlur", "pageTitleColor", "sectionTitleColor", "sectionTitleSize", "sectionTitleShadowBlur", "cardRadius", "cardGap", "tileHeight", "logoSize", "panelColor", "panelAlpha", "glassBlur", "glassSaturation", "borderAlpha", "adminPanelColor", "adminPanelAlpha", "modalBg", "modalAlpha", "modalGlassBlur", "modalBackdropBlur", "modalBackdropAlpha", "modalRadius"];
  const output = {};

  for (const key of allowed) {
    const value = normalizeText(input?.[key]);
    if (value) output[key] = value;
  }

  return output;
}

function loadThemeSettings() {
  ensureConfigDir(THEME_FILE);
  if (!fs.existsSync(THEME_FILE)) return {};

  try {
    return sanitizeThemeSettings(JSON.parse(fs.readFileSync(THEME_FILE, "utf8")));
  } catch (error) {
    console.error("Load theme settings error:", error);
    return {};
  }
}

function saveThemeSettings(theme) {
  ensureConfigDir(THEME_FILE);
  fs.writeFileSync(THEME_FILE, JSON.stringify(sanitizeThemeSettings(theme), null, 2), "utf8");
}

// Zapisuje obraz z formularza (data URL) do UPLOAD_DIR i zwraca jego adres /uploads/...
function saveUploadedImage(dataUrl, baseName, errorMessage) {
  const match = String(dataUrl || "").match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
  if (!match) {
    throw new Error(errorMessage);
  }
  const extension = match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  // Usuń poprzednią wersję w innym formacie, żeby nie zostawały śmieci.
  for (const ext of ["png", "jpg", "webp"]) {
    const old = path.join(UPLOAD_DIR, `${baseName}.${ext}`);
    if (ext !== extension && fs.existsSync(old)) fs.unlinkSync(old);
  }
  const targetFile = path.join(UPLOAD_DIR, `${baseName}.${extension}`);
  fs.writeFileSync(targetFile, Buffer.from(match[2], "base64"));
  return `/uploads/${baseName}.${extension}?v=${Date.now()}`;
}

function saveDashboardLogo(dataUrl) {
  return saveUploadedImage(dataUrl, "dashboard-logo", "Niepoprawny format logo.");
}

function saveDashboardBackground(dataUrl) {
  return saveUploadedImage(dataUrl, "background-custom", "Niepoprawny format obrazu tła.");
}

function saveAdminBackground(dataUrl) {
  return saveUploadedImage(dataUrl, "background-admin", "Niepoprawny format obrazu tła.");
}

function getDashboardPin() {
  const targetEnv = process.env.DASHBOARD_ENV_FILE || path.join(CONFIG_DIR, "dashboard.env");
  if (fs.existsSync(targetEnv)) {
    try {
      const content = fs.readFileSync(targetEnv, "utf8");
      const match = content.match(/^DASHBOARD_PIN=(.*)$/m);
      if (match && match[1].trim()) return match[1].trim();
    } catch {}
  }
  return String(process.env.DASHBOARD_PIN || process.env.ADMIN_PIN || DEFAULT_PIN).trim();
}

function saveDashboardPin(pin) {
  const cleanPin = String(pin).replace(/\r?\n/g, "").trim();
  const targetEnv = process.env.DASHBOARD_ENV_FILE || path.join(CONFIG_DIR, "dashboard.env");
  ensureConfigDir(targetEnv);
  fs.writeFileSync(
    targetEnv,
    `DASHBOARD_PIN=${cleanPin}\n`,
    "utf8"
  );
  process.env.DASHBOARD_PIN = cleanPin;
}

// Ochrona przed zgadywaniem PIN-u: po 5 błędnych próbach z jednego adresu
// blokada na 1 minutę, każda kolejna seria podwaja czas (maks. 15 minut).
const PIN_MAX_FAILS = 5;
const PIN_BASE_LOCK_MS = 60 * 1000;
const PIN_MAX_LOCK_MS = 15 * 60 * 1000;
const pinAttempts = new Map();

function clientKey(req) {
  return String(req.ip || req.socket?.remoteAddress || "unknown");
}

function pinLockRemainingMs(req) {
  const entry = pinAttempts.get(clientKey(req));
  if (!entry || !entry.lockedUntil) return 0;
  return Math.max(0, entry.lockedUntil - Date.now());
}

function registerPinResult(req, ok) {
  const key = clientKey(req);
  if (ok) {
    pinAttempts.delete(key);
    return;
  }
  const entry = pinAttempts.get(key) || { fails: 0, locks: 0, lockedUntil: 0 };
  entry.fails += 1;
  if (entry.fails >= PIN_MAX_FAILS) {
    entry.locks += 1;
    entry.fails = 0;
    entry.lockedUntil = Date.now() + Math.min(PIN_MAX_LOCK_MS, PIN_BASE_LOCK_MS * 2 ** (entry.locks - 1));
  }
  pinAttempts.set(key, entry);
}

function pinsEqual(a, b) {
  const bufA = crypto.createHash("sha256").update(String(a)).digest();
  const bufB = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(bufA, bufB);
}

function hasValidPin(req) {
  if (pinLockRemainingMs(req) > 0) return false;
  const provided = String(req.body?.pin || req.get("x-admin-pin") || "").trim();
  if (!provided) return false;
  const ok = pinsEqual(provided, getDashboardPin());
  registerPinResult(req, ok);
  return ok;
}

// Middleware dla endpointów, które coś zmieniają albo pokazują wrażliwe dane.
function requirePin(req, res, next) {
  const remaining = pinLockRemainingMs(req);
  if (remaining > 0) {
    return res.status(429).json({
      ok: false,
      error: `Za dużo błędnych prób PIN-u. Spróbuj za ${Math.ceil(remaining / 1000)} s.`
    });
  }
  if (!hasValidPin(req)) {
    return res.status(403).json({ ok: false, error: "Niepoprawny PIN" });
  }
  next();
}

function isValidPort(port) {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

function checkTcpPort(host, port, timeoutMs = 1500) {
  return new Promise(resolve => {
    const socket = new net.Socket();
    let finished = false;

    function finish(result) {
      if (finished) return;

      finished = true;
      socket.destroy();
      resolve(result);
    }

    socket.setTimeout(timeoutMs);

    socket.once("connect", () => {
      finish({
        ok: true,
        status: "busy",
        open: true,
        busy: true,
        message: `Port ${port} jest zajęty. Coś odpowiada na ${host}:${port}.`
      });
    });

    socket.once("timeout", () => {
      finish({
        ok: true,
        status: "unknown",
        open: null,
        busy: null,
        message: `Nie udało się jednoznacznie sprawdzić ${host}:${port}. Timeout.`
      });
    });

    socket.once("error", () => {
      finish({
        ok: true,
        status: "free",
        open: false,
        busy: false,
        message: `Port ${port} wygląda na wolny na hoście ${host}.`
      });
    });

    socket.connect(port, host);
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(5000)
  });
  const data = await response.json();

  if (!response.ok) {
    const message = data?.message || data?.error || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

// ─── Sprawdzanie wersji obrazów Docker (tylko wersje stabilne) ────────────────

// Kontenery pomijane przy sprawdzaniu wersji, np. obrazy budowane lokalnie,
// dla których "najnowsza wersja" nie ma sensu. Lista po przecinku w zmiennej
// DOCKER_VERSION_EXCLUDE, np. "moj-kontener,inny-kontener".
const DOCKER_VERSION_EXCLUDE = new Set(
  String(process.env.DOCKER_VERSION_EXCLUDE || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
);

// Wyjątki, gdy nazwa kontenera nie pokrywa się z nazwą folderu stosu i/lub
// kluczem serwisu w compose.yaml (konwencja domyślna: stack === service === nazwa kontenera).
// Opcjonalnie w zmiennej DOCKER_STACK_OVERRIDES jako JSON, np.
// {"wordpress_db":{"stack":"wordpress","service":"db"}}
const DOCKER_STACK_OVERRIDES = (() => {
  try {
    const parsed = JSON.parse(process.env.DOCKER_STACK_OVERRIDES || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    console.error("DOCKER_STACK_OVERRIDES: niepoprawny JSON — pomijam.");
    return {};
  }
})();

// Nazwa stosu/serwisu trafia do ścieżki pliku — tylko bezpieczne znaki.
function isSafeName(value) {
  return /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(String(value || "")) && !String(value).includes("..");
}

function resolveStackAndService(containerName) {
  return DOCKER_STACK_OVERRIDES[containerName] || { stack: containerName, service: containerName };
}

const UNSTABLE_TAG_HINTS = /(alpha|beta|rc\d*|dev|nightly|edge|preview|snapshot|canary|insider|unstable|master|testing)/i;
const STABLE_TAG_RE = /^v?\d+(\.\d+){0,3}$/;

function isStableTag(tag) {
  if (!tag || tag === "latest") return false;
  if (UNSTABLE_TAG_HINTS.test(tag)) return false;
  return STABLE_TAG_RE.test(tag);
}

function compareVersionTags(a, b) {
  const partsA = String(a).replace(/^v/, "").split(".").map(Number);
  const partsB = String(b).replace(/^v/, "").split(".").map(Number);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const diff = (partsA[i] || 0) - (partsB[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function parseImageRef(image) {
  const clean = String(image).split("@")[0]; // odetnij ewentualny digest (@sha256:...)

  // Tag odcinamy tylko z ostatniego segmentu ścieżki, żeby nie pomylić portu
  // hosta rejestru (np. "localhost:3000/...") z separatorem taga.
  const lastSlashIdx = clean.lastIndexOf("/");
  const lastSegment = lastSlashIdx === -1 ? clean : clean.slice(lastSlashIdx + 1);
  const nameWithoutTag = lastSegment.includes(":")
    ? clean.slice(0, lastSlashIdx + 1) + lastSegment.split(":")[0]
    : clean;

  const segments = nameWithoutTag.split("/");
  const looksLikeHost = segments.length >= 2 && (segments[0].includes(".") || segments[0].includes(":") || segments[0] === "localhost");

  if (looksLikeHost) {
    return { host: segments[0], repository: segments.slice(1).join("/") };
  }

  const repository = segments.length === 1 ? `library/${segments[0]}` : nameWithoutTag;
  return { host: null, repository };
}

async function fetchDockerHubStableTags(repository) {
  const url = `https://hub.docker.com/v2/repositories/${repository}/tags?page_size=100&ordering=last_updated`;
  const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!response.ok) throw new Error(`Docker Hub HTTP ${response.status}`);
  const data = await response.json();
  const tags = (data.results || []).map(t => t.name).filter(isStableTag);
  return tags.sort(compareVersionTags);
}

async function fetchOciRegistryToken(host, repository) {
  const pingRes = await fetch(`https://${host}/v2/`, { signal: AbortSignal.timeout(5000) });
  if (pingRes.status === 200) return null;

  const authHeader = pingRes.headers.get("www-authenticate") || "";
  const realmMatch = authHeader.match(/realm="([^"]+)"/);
  const serviceMatch = authHeader.match(/service="([^"]+)"/);
  if (!realmMatch) return null;

  const tokenUrl = new URL(realmMatch[1]);
  if (serviceMatch) tokenUrl.searchParams.set("service", serviceMatch[1]);
  tokenUrl.searchParams.set("scope", `repository:${repository}:pull`);

  const tokenRes = await fetch(tokenUrl.toString(), { signal: AbortSignal.timeout(5000) });
  if (!tokenRes.ok) return null;
  const tokenData = await tokenRes.json();
  return tokenData.token || tokenData.access_token || null;
}

async function fetchOciStableTags(host, repository) {
  const token = await fetchOciRegistryToken(host, repository);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`https://${host}/v2/${repository}/tags/list`, {
    headers,
    signal: AbortSignal.timeout(6000)
  });
  if (!res.ok) throw new Error(`Registry HTTP ${res.status}`);
  const data = await res.json();
  const tags = (data.tags || []).filter(isStableTag);
  return tags.sort(compareVersionTags);
}

// ─── Sprawdzanie wersji: raz dziennie (wynik w config/versions-cache.json) albo „Sprawdź teraz” ───
const VERSIONS_CACHE_FILE = path.join(CONFIG_DIR, "versions-cache.json");
const VERSIONS_CACHE_MS = 24 * 60 * 60 * 1000;

function imageWithoutTag(image) {
  const { host, repository } = parseImageRef(image);
  return host ? `${host}/${repository}` : repository;
}

function loadVersionsCache() {
  try {
    const data = JSON.parse(fs.readFileSync(VERSIONS_CACHE_FILE, "utf8"));
    return data && typeof data.images === "object" ? data : { images: {} };
  } catch {
    return { images: {} };
  }
}

function saveVersionsCache(cache) {
  try {
    ensureConfigDir(VERSIONS_CACHE_FILE);
    fs.writeFileSync(VERSIONS_CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
  } catch (error) {
    console.error("Zapis versions-cache.json nie powiódł się:", error.message);
  }
}

// Lista stabilnych wersji obrazu (z pamięci, jeśli świeża — chyba że force).
// Nieudane sprawdzenie (np. chwilowy brak internetu po restarcie) ponawiamy po 10 minutach,
// a nie po dniu — i nie gubimy wtedy ostatniej znanej listy wersji.
const VERSIONS_RETRY_MS = 10 * 60 * 1000;

async function getStableTags(image, { force = false } = {}) {
  const key = imageWithoutTag(image);
  const entry = loadVersionsCache().images[key];
  const maxAge = entry?.error ? VERSIONS_RETRY_MS : VERSIONS_CACHE_MS;
  if (!force && entry && Date.now() - entry.checkedAt < maxAge) return entry;
  const { host, repository } = parseImageRef(image);
  let tags = null;
  let error = null;
  try {
    tags = host ? await fetchOciStableTags(host, repository) : await fetchDockerHubStableTags(repository);
  } catch (err) {
    error = err.message;
    console.error(`Sprawdzanie wersji nie powiodło się dla ${image}:`, err.message);
  }
  const fresh = { tags: tags ?? entry?.tags ?? null, error, checkedAt: Date.now() };
  // Plik czytamy na nowo tuż przed zapisem (bez await pomiędzy): sprawdzenia wszystkich
  // kontenerów biegną naraz i każde dopisuje tylko swój wynik — inaczej ostatnie
  // nadpisywało wyniki pozostałych starą zawartością pliku.
  const cache = loadVersionsCache();
  cache.images[key] = fresh;
  saveVersionsCache(cache);
  return fresh;
}

// Obraz lokalny = zbudowany na serwerze, nigdy nie pobrany z rejestru (brak RepoDigests).
async function isLocalImage(image) {
  try {
    const { stdout } = await execFileAsync("docker", ["image", "inspect", image, "--format", "{{json .RepoDigests}}"], { timeout: 3000 });
    const digests = JSON.parse(stdout.trim() || "[]");
    return !Array.isArray(digests) || digests.length === 0;
  } catch {
    return false;
  }
}

// „Linia” wersji: przy wersjach 1+ — główna.podrzędna (11.8), przy 0.x — 0.podrzędna (0.1).
// Poprawka = nowsza wersja w tej samej linii; nowa główna wersja = nowsza w innej linii.
function versionLine(tag) {
  const parts = String(tag).replace(/^v/, "").split(".").map(Number);
  return `${parts[0] || 0}.${parts[1] || 0}`;
}

function classifyUpdates(installed, tags) {
  if (!installed || !Array.isArray(tags) || !tags.length) return { latestStable: tags?.length ? tags[tags.length - 1] : null, latestPatch: null, latestMajor: null };
  const newer = tags.filter((tag) => compareVersionTags(tag, installed) > 0);
  const line = versionLine(installed);
  const patches = newer.filter((tag) => versionLine(tag) === line);
  const majors = newer.filter((tag) => versionLine(tag) !== line);
  return {
    latestStable: tags[tags.length - 1],
    latestPatch: patches.length ? patches[patches.length - 1] : null,
    latestMajor: majors.length ? majors[majors.length - 1] : null
  };
}

// „Co nowego”: lista zmian / strona obrazu.
function changelogUrl(image) {
  const { host, repository } = parseImageRef(image);
  if (host === "ghcr.io") {
    const [owner, name] = repository.split("/");
    // Strona startowa jest od v0.3.0 częścią IF-home-server (folder strona/).
    if (owner === "if-faber" && name === "if-startpage") return "https://github.com/if-faber/IF-home-server/blob/main/strona/version-changelog.md";
    if (owner === "if-faber") return `https://github.com/if-faber/${name}/blob/main/version-changelog.md`;
    return `https://github.com/${owner}/${name}/releases`;
  }
  if (!host) {
    return repository.startsWith("library/")
      ? `https://hub.docker.com/_/${repository.slice(8)}`
      : `https://hub.docker.com/r/${repository}`;
  }
  return null;
}

// Uwagi przy wybranych obrazach (pokazywane pod nazwą kontenera).
function imageNote(image) {
  const { host, repository } = parseImageRef(image);
  if (!host && repository === "library/wordpress") {
    return "Sam WordPress, wtyczki i motywy aktualizujesz w panelu WordPressa (Kokpit → Aktualizacje). Nowy obraz zmienia tylko PHP i serwer Apache.";
  }
  if (!host && (repository === "library/mariadb" || repository === "library/mysql" || repository === "library/postgres")) {
    return "Baza danych — przed nową główną wersją zrób kopię bazy.";
  }
  return "";
}

async function getInstalledVersionLabel(containerName) {
  try {
    const { stdout } = await execFileAsync("docker", [
      "inspect", containerName,
      "--format", '{{index .Config.Labels "org.opencontainers.image.version"}}'
    ], { timeout: 3000 });
    const label = stdout.trim();
    return label && label !== "<no value>" ? label : null;
  } catch {
    return null;
  }
}

function readAllCoresStat() {
  try {
    const content = fs.readFileSync("/proc/stat", "utf8");
    const lines = content.split(/\r?\n/);
    const cores = {};
    for (const line of lines) {
      const match = line.match(/^(cpu\d*)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
      if (match) {
        const id = match[1];
        const user = Number(match[2]);
        const nice = Number(match[3]);
        const system = Number(match[4]);
        const idle = Number(match[5]);
        const iowait = Number(match[6]);
        const irq = Number(match[7]);
        const softirq = Number(match[8]);
        const total = user + nice + system + idle + iowait + irq + softirq;
        const idleTotal = idle + iowait;
        cores[id] = { idle: idleTotal, total };
      }
    }
    return cores;
  } catch {
    return null;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readCpuUsage() {
  try {
    const first = readAllCoresStat();
    await delay(140);
    const second = readAllCoresStat();
    if (!first || !second || !first.cpu || !second.cpu) return null;
    const total = second.cpu.total - first.cpu.total;
    const idle = second.cpu.idle - first.cpu.idle;
    if (total <= 0) return null;
    return Math.max(0, Math.min(100, ((total - idle) / total) * 100));
  } catch {
    return null;
  }
}

async function readPerCoreCpuUsage() {
  try {
    const first = readAllCoresStat();
    await delay(140);
    const second = readAllCoresStat();
    if (!first || !second) return [];

    const keys = Object.keys(second)
      .filter((k) => /^cpu\d+$/.test(k))
      .sort((a, b) => Number(a.replace("cpu", "")) - Number(b.replace("cpu", "")));

    const results = [];
    for (const key of keys) {
      const f = first[key];
      const s = second[key];
      if (f && s) {
        const totalDelta = s.total - f.total;
        const idleDelta = s.idle - f.idle;
        const usage = totalDelta > 0
          ? Math.max(0, Math.min(100, ((totalDelta - idleDelta) / totalDelta) * 100))
          : 0;
        const coreIndex = Number(key.replace("cpu", ""));
        results.push({
          core: coreIndex,
          name: `Core ${coreIndex}`,
          usage: Math.round(usage * 10) / 10
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}

function readMemInfo() {
  const output = fs.readFileSync("/proc/meminfo", "utf8");
  const data = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([^:]+):\s+(\d+)/);
    if (match) data[match[1]] = Number(match[2]) * 1024;
  }
  const memoryTotal = data.MemTotal || 0;
  const memoryFree = data.MemFree || 0;
  const memoryAvailable = data.MemAvailable ?? memoryFree;
  const buffers = data.Buffers || 0;
  const cached = data.Cached || 0;
  const sReclaimable = data.SReclaimable || 0;
  const cacheTotal = buffers + cached + sReclaimable;
  const memoryUsed = Math.max(0, memoryTotal - memoryAvailable);

  const swapTotal = data.SwapTotal || 0;
  const swapFree = data.SwapFree || 0;
  const swapUsed = Math.max(0, swapTotal - swapFree);

  return {
    memory: {
      total: memoryTotal,
      free: memoryFree,
      available: memoryAvailable,
      cache: cacheTotal,
      buffers,
      cached,
      used: memoryUsed,
      percent: memoryTotal ? (memoryUsed / memoryTotal) * 100 : null
    },
    swap: {
      total: swapTotal,
      available: swapFree,
      used: swapUsed,
      percent: swapTotal ? (swapUsed / swapTotal) * 100 : null
    }
  };
}

function readTemperature() {
  const candidates = [];
  for (const base of ["/sys/class/thermal", "/sys/class/hwmon"]) {
    if (!fs.existsSync(base)) continue;
    for (const entry of fs.readdirSync(base)) {
      const dir = path.join(base, entry);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const file of fs.readdirSync(dir)) {
        if (/^temp\d*_input$/.test(file) || file === "temp") {
          candidates.push(path.join(dir, file));
        }
      }
    }
  }

  for (const file of candidates) {
    try {
      const raw = Number(fs.readFileSync(file, "utf8").trim());
      if (!Number.isFinite(raw) || raw <= 0) continue;
      const value = raw > 1000 ? raw / 1000 : raw;
      if (value > 0 && value < 130) return value;
    } catch {
      // Try next sensor.
    }
  }
  return null;
}

// Wszystkie czujniki temperatury z /sys/class/hwmon (nazwa układu + etykieta),
// z czytelną nazwą po polsku. Gdy hwmon jest pusty — strefy z /sys/class/thermal.
const SENSOR_NAMES = [
  [/^coretemp$|^k10temp$|^zenpower$/, "Procesor"],
  [/^acpitz$/, "Płyta główna (ACPI)"],
  [/^pch_/, "Chipset"],
  [/^nvme$/, "Dysk NVMe"],
  [/^drivetemp$/, "Dysk"],
  [/^amdgpu$|^nouveau$|^radeon$|^i915$/, "Karta graficzna"],
  [/^iwlwifi/, "Wi-Fi"]
];

function sensorFriendlyName(chip, label) {
  const group = SENSOR_NAMES.find(([re]) => re.test(chip))?.[1] || chip;
  if (/^Package id \d+$/i.test(label) || /^Tctl$/i.test(label)) return `${group} — całość`;
  const core = label.match(/^Core\s*(\d+)$/i);
  if (core) return `${group} — rdzeń ${core[1]}`;
  return label ? `${group} — ${label}` : group;
}

function readAllTemperatures() {
  const sensors = [];
  const readTemp = (file) => {
    const raw = Number(fs.readFileSync(file, "utf8").trim());
    if (!Number.isFinite(raw) || raw <= 0) return null;
    const value = raw > 1000 ? raw / 1000 : raw;
    return value > 0 && value < 130 ? value : null;
  };
  try {
    const hwmonDir = "/sys/class/hwmon";
    for (const entry of fs.existsSync(hwmonDir) ? fs.readdirSync(hwmonDir).sort() : []) {
      const dir = path.join(hwmonDir, entry);
      let chip = "";
      try { chip = fs.readFileSync(path.join(dir, "name"), "utf8").trim(); } catch {}
      const inputs = fs.readdirSync(dir)
        .map((file) => file.match(/^temp(\d+)_input$/))
        .filter(Boolean)
        .sort((a, b) => Number(a[1]) - Number(b[1]));
      for (const [file, idx] of inputs) {
        let label = "";
        try { label = fs.readFileSync(path.join(dir, `temp${idx}_label`), "utf8").trim(); } catch {}
        try {
          const temp = readTemp(path.join(dir, file));
          if (temp !== null) sensors.push({ id: `${chip || entry}:${label || `temp${idx}`}`, chip, label, name: sensorFriendlyName(chip, label || (inputs.length > 1 ? `czujnik ${idx}` : "")), temp });
        } catch {}
      }
    }
    if (!sensors.length) {
      const thermalDir = "/sys/class/thermal";
      for (const entry of fs.existsSync(thermalDir) ? fs.readdirSync(thermalDir).sort() : []) {
        if (!entry.startsWith("thermal_zone")) continue;
        const dir = path.join(thermalDir, entry);
        let type = entry;
        try { type = fs.readFileSync(path.join(dir, "type"), "utf8").trim(); } catch {}
        try {
          const temp = readTemp(path.join(dir, "temp"));
          if (temp !== null) sensors.push({ id: `${type}:${entry}`, chip: type, label: "", name: type === "x86_pkg_temp" ? "Procesor — całość" : sensorFriendlyName(type, ""), temp });
        } catch {}
      }
    }
  } catch {}
  // Dwa układy o tej samej nazwie (np. dwa dyski NVMe) — numer w identyfikatorze.
  const seen = {};
  for (const sensor of sensors) {
    seen[sensor.id] = (seen[sensor.id] || 0) + 1;
    if (seen[sensor.id] > 1) sensor.id = `${sensor.id}#${seen[sensor.id]}`;
    Object.assign(sensor, defaultTempThresholds(sensor.chip));
  }
  return sensors;
}

// ─── Progi temperatur (Zaplecze → Centrum alertów) ───
// Domyślne wg rodzaju czujnika; własne progi danego serwera w config/temperature-thresholds.json.
const TEMP_THRESHOLDS_FILE = path.join(CONFIG_DIR, "temperature-thresholds.json");
const TEMP_DEFAULTS = [
  [/^(coretemp|k10temp|zenpower|x86_pkg_temp)$/, 70, 85],
  [/^pch_/, 70, 85],
  [/^acpitz$/, 60, 75],
  [/^(nvme|drivetemp)$/, 55, 65],
  [/^(amdgpu|nouveau|radeon|i915)$/, 75, 90]
];

function defaultTempThresholds(chip) {
  const [, warn, alarm] = TEMP_DEFAULTS.find(([re]) => re.test(chip)) || [null, 70, 85];
  return { defaultWarn: warn, defaultAlarm: alarm };
}

function loadTempThresholds() {
  try {
    const data = JSON.parse(fs.readFileSync(TEMP_THRESHOLDS_FILE, "utf8"));
    return data && typeof data.sensors === "object" ? data.sensors : {};
  } catch {
    return {};
  }
}

// ─── Progi obciążenia CPU i RAM (kolor kafelków w nagłówku; bez alarmu w pasku) ───
const LOAD_THRESHOLDS_FILE = path.join(CONFIG_DIR, "load-thresholds.json");
const LOAD_DEFAULTS = { cpu: { warn: 70, alarm: 90 }, ram: { warn: 80, alarm: 95 } };

function loadLoadThresholds() {
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(LOAD_THRESHOLDS_FILE, "utf8")) || {}; } catch {}
  const result = {};
  for (const key of Object.keys(LOAD_DEFAULTS)) {
    result[key] = {
      warn: saved[key]?.warn ?? LOAD_DEFAULTS[key].warn,
      alarm: saved[key]?.alarm ?? LOAD_DEFAULTS[key].alarm,
      defaultWarn: LOAD_DEFAULTS[key].warn,
      defaultAlarm: LOAD_DEFAULTS[key].alarm
    };
  }
  return result;
}

// Czujniki z progami: własne, jeśli zapisane, inaczej domyślne.
function readTemperaturesWithThresholds() {
  const saved = loadTempThresholds();
  return readAllTemperatures().map((sensor) => ({
    ...sensor,
    warn: saved[sensor.id]?.warn ?? sensor.defaultWarn,
    alarm: saved[sensor.id]?.alarm ?? sensor.defaultAlarm
  }));
}

// Ogólna temperatura procesora (kafelek TEMP w nagłówku): Intel „Package id”,
// AMD „Tctl”, strefa x86_pkg_temp; gdy żadnej nie ma — pierwszy czujnik jak dotąd.
function readCpuTemperature() {
  const sensors = readAllTemperatures();
  const cpu = sensors.find((s) => /^(coretemp|k10temp|zenpower)$/.test(s.chip) && /^(Package id \d+|Tctl)$/i.test(s.label))
    || sensors.find((s) => s.chip === "x86_pkg_temp");
  if (cpu) return cpu.temp;
  try {
    const thermalDir = "/sys/class/thermal";
    for (const entry of fs.existsSync(thermalDir) ? fs.readdirSync(thermalDir) : []) {
      const dir = path.join(thermalDir, entry);
      try {
        if (fs.readFileSync(path.join(dir, "type"), "utf8").trim() !== "x86_pkg_temp") continue;
        const raw = Number(fs.readFileSync(path.join(dir, "temp"), "utf8").trim());
        if (Number.isFinite(raw) && raw > 0) return raw > 1000 ? raw / 1000 : raw;
      } catch {}
    }
  } catch {}
  return readTemperature();
}

function readCoreTemperatures() {
  const coreTemps = {};
  let packageTemp = null;
  try {
    const hwmonDir = "/sys/class/hwmon";
    if (fs.existsSync(hwmonDir)) {
      for (const entry of fs.readdirSync(hwmonDir)) {
        const dir = path.join(hwmonDir, entry);
        let name = "";
        try { name = fs.readFileSync(path.join(dir, "name"), "utf8").trim(); } catch {}
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const match = file.match(/^temp(\d+)_input$/);
          if (match) {
            const idx = match[1];
            let label = "";
            try { label = fs.readFileSync(path.join(dir, `temp${idx}_label`), "utf8").trim(); } catch {}
            const raw = Number(fs.readFileSync(path.join(dir, file), "utf8").trim());
            if (Number.isFinite(raw) && raw > 0) {
              const temp = raw > 1000 ? raw / 1000 : raw;
              if (temp > 0 && temp < 130) {
                if (/Package/i.test(label) || /pkg/i.test(label)) {
                  packageTemp = temp;
                } else if (/Core\s*(\d+)/i.test(label)) {
                  const coreNum = label.match(/Core\s*(\d+)/i)[1];
                  coreTemps[coreNum] = temp;
                } else if (/coretemp/i.test(name)) {
                  if (idx === "1" && !packageTemp) packageTemp = temp;
                  else if (Number(idx) > 1) {
                    const cNum = String(Number(idx) - 2);
                    if (!coreTemps[cNum]) coreTemps[cNum] = temp;
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch {}
  return { packageTemp: packageTemp || readTemperature(), coreTemps };
}

let lastNetSample = null;

function readNetDev() {
  try {
    const content = fs.readFileSync("/proc/net/dev", "utf8");
    const lines = content.split(/\r?\n/);
    let rxTotal = 0;
    let txTotal = 0;
    const interfaces = [];
    for (const line of lines) {
      const parts = line.trim().split(/[:\s]+/);
      if (parts.length >= 10 && !line.includes("Inter-|") && !line.includes("face |")) {
        const iface = parts[0];
        if (iface === "lo") continue;
        const rxBytes = Number(parts[1]) || 0;
        const txBytes = Number(parts[9]) || 0;
        rxTotal += rxBytes;
        txTotal += txBytes;
        interfaces.push({ iface, rxBytes, txBytes });
      }
    }
    return { timestamp: Date.now(), rxTotal, txTotal, interfaces };
  } catch {
    return null;
  }
}

async function getNetworkSpeed() {
  const current = readNetDev();
  if (!current) return { rxSpeed: 0, txSpeed: 0, rxTotal: 0, txTotal: 0, interfaces: [] };

  if (!lastNetSample) {
    lastNetSample = current;
    await delay(150);
    const next = readNetDev();
    if (!next) return { rxSpeed: 0, txSpeed: 0, rxTotal: current.rxTotal, txTotal: current.txTotal, interfaces: current.interfaces };
    const dt = (next.timestamp - current.timestamp) / 1000 || 0.15;
    const rxSpeed = Math.max(0, (next.rxTotal - current.rxTotal) / dt);
    const txSpeed = Math.max(0, (next.txTotal - current.txTotal) / dt);
    lastNetSample = next;
    return { rxSpeed, txSpeed, rxTotal: next.rxTotal, txTotal: next.txTotal, interfaces: next.interfaces };
  }

  const dt = (current.timestamp - lastNetSample.timestamp) / 1000;
  const rxSpeed = dt > 0 ? Math.max(0, (current.rxTotal - lastNetSample.rxTotal) / dt) : 0;
  const txSpeed = dt > 0 ? Math.max(0, (current.txTotal - lastNetSample.txTotal) / dt) : 0;
  lastNetSample = current;
  return { rxSpeed, txSpeed, rxTotal: current.rxTotal, txTotal: current.txTotal, interfaces: current.interfaces };
}

function formatMountName(target) {
  if (target === "/" || target === "/host/root") return "/ (Dysk główny)";
  if (target.startsWith("/host/mnt/")) return target.replace("/host/mnt/", "/mnt/");
  return target || "—";
}

async function readDisks() {
  try {
    const { stdout } = await execFileAsync("df", ["-k", "-P"], { timeout: 3000 });
    const lines = stdout.trim().split(/\r?\n/).slice(1);
    const seenFs = new Set();
    const disks = [];

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 6) continue;
      const filesystem = parts[0];
      const total = Number(parts[1]) * 1024;
      const used = Number(parts[2]) * 1024;
      const available = Number(parts[3]) * 1024;
      const percent = Number(String(parts[4]).replace("%", ""));
      const mount = parts[5];

      if (!total || total <= 0) continue;
      // Pomiń pseudopartytycje i wirtualne systemy plików
      if (filesystem === "tmpfs" || filesystem === "shm" || filesystem === "devtmpfs") continue;
      if (mount.startsWith("/proc") || mount.startsWith("/sys") || mount.startsWith("/dev") || mount.startsWith("/run")) continue;
      
      // Pomiń wewnętrzne montowania kontenera Docker (/app/*, /etc/*)
      if (mount.startsWith("/app/") || mount.startsWith("/etc/")) continue;
      
      // Deduplikacja wg urządzenia (aby ten sam dysk nie powtarzał się wielokrotnie)
      const fsKey = filesystem.startsWith("/dev/") ? filesystem : mount;
      if (seenFs.has(fsKey)) continue;
      seenFs.add(fsKey);

      disks.push({
        filesystem,
        mount: formatMountName(mount),
        total,
        used,
        available,
        percent
      });
    }
    return disks;
  } catch {
    return [];
  }
}

async function readTopProcesses() {
  const processes = [];
  try {
    const { stdout } = await execFileAsync("top", ["-b", "-n", "1"], { timeout: 2000 });
    const lines = stdout.trim().split(/\r?\n/);
    // Kolumny wg nagłówka (procps: PID USER PR NI VIRT RES SHR S %CPU %MEM TIME+ COMMAND;
    // busybox ma inną kolejność) — nie wg stałych pozycji.
    let header = null;
    for (const line of lines) {
      if (!header) {
        if (/^\s*PID\s+/i.test(line)) header = line.trim().split(/\s+/).map((name) => name.toUpperCase());
        continue;
      }
      if (!line.trim()) continue;
      const cols = line.trim().split(/\s+/);
      const at = (...names) => {
        const idx = header.findIndex((name) => names.includes(name));
        return idx === -1 ? undefined : cols[idx];
      };
      const commandIdx = header.findIndex((name) => name === "COMMAND" || name === "CMD");
      if (cols.length < header.length - 1) continue;
      processes.push({
        pid: Number(at("PID")) || at("PID"),
        user: at("USER") || "—",
        cpu: Number(String(at("%CPU", "CPU%", "CPU") ?? "0").replace("%", "").replace(",", ".")) || 0,
        mem: Number(String(at("%MEM", "MEM%", "%VSZ") ?? "0").replace("%", "").replace(",", ".")) || 0,
        command: commandIdx === -1 ? cols[cols.length - 1] : cols.slice(commandIdx).join(" ")
      });
    }
  } catch {}

  let containers = [];
  try {
    const { stdout } = await execFileAsync("docker", [
      "stats",
      "--no-stream",
      "--format",
      '{"name":"{{.Name}}","cpu":"{{.CPUPerc}}","mem":"{{.MemUsage}}","pids":"{{.PIDs}}"}'
    ], { timeout: 3000 });
    containers = stdout
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => {
        try { return JSON.parse(l); } catch { return null; }
      })
      .filter(Boolean);
  } catch {}

  return { processes: processes.slice(0, 15), containers };
}

async function loadSystemStats() {
  const [cpuUsage, disks] = await Promise.all([readCpuUsage(), readDisks()]);
  const memory = readMemInfo();
  const load = os.loadavg();
  return {
    updated: new Date().toISOString(),
    cpu: {
      count: os.cpus().length,
      usage: cpuUsage,
      load1: load[0],
      load5: load[1],
      load15: load[2],
      temperature: readCpuTemperature()
    },
    ...memory,
    disks,
    thresholds: loadLoadThresholds()
  };
}

async function loadSystemTopStats() {
  const [coresCpu, disks, netSpeed, topData] = await Promise.all([
    readPerCoreCpuUsage(),
    readDisks(),
    getNetworkSpeed(),
    readTopProcesses()
  ]);
  const memory = readMemInfo();
  const temperatures = readCoreTemperatures();
  const load = os.loadavg();
  const uptime = os.uptime();

  const cores = coresCpu.map((c) => ({
    ...c,
    temperature: temperatures.coreTemps[String(c.core)] ?? temperatures.packageTemp ?? null
  }));

  const cpuOverall = {
    count: os.cpus().length,
    load1: load[0],
    load5: load[1],
    load15: load[2],
    packageTemp: temperatures.packageTemp,
    cores
  };

  return {
    updated: new Date().toISOString(),
    uptime,
    cpu: cpuOverall,
    memory: memory.memory,
    swap: memory.swap,
    network: netSpeed,
    disks,
    temperatures: readTemperaturesWithThresholds(),
    processes: topData.processes,
    containers: topData.containers
  };
}

app.get("/api/services", (req, res) => {
  res.json(loadServices());
});

app.post("/api/admin/unlock", requirePin, (req, res) => {
  res.json({ success: true });
});

app.get("/api/dashboard/settings", (req, res) => {
  res.json({ settings: loadDashboardSettings() });
});

app.put("/api/dashboard/settings", (req, res) => {
  if (!hasValidPin(req)) {
    return res.status(403).json({ error: "Niepoprawny PIN" });
  }

  const settings = sanitizeDashboardSettings(req.body || {});
  const newPin = normalizeText(req.body?.newPin);
  const logoData = normalizeText(req.body?.logoData);

  if (logoData) {
    settings.logo = saveDashboardLogo(logoData);
  }

  if (newPin && newPin.length < 4) {
    return res.status(400).json({ error: "Nowy PIN musi mieć co najmniej 4 znaki." });
  }

  saveDashboardSettings(settings);
  if (newPin) saveDashboardPin(newPin);

  res.json({ success: true, settings });
});

app.get("/api/dashboard/theme", (req, res) => {
  res.json({ theme: loadThemeSettings() });
});

app.put("/api/dashboard/theme", (req, res) => {
  if (!hasValidPin(req)) {
    return res.status(403).json({ error: "Niepoprawny PIN" });
  }

  const theme = req.body?.reset ? {} : sanitizeThemeSettings(req.body || {});
  const backgroundData = normalizeText(req.body?.backgroundData);
  if (!req.body?.reset && backgroundData) {
    theme.backgroundImage = "custom";
    theme.backgroundUrl = saveDashboardBackground(backgroundData);
  }
  saveThemeSettings(theme);

  res.json({ success: true, theme });
});

// ─── Wygląd strony: tryb dzień / noc (custom-d.css, custom-n.css) ────────────
//
// Wygląd startowy jest w www/styles.css (w obrazie, nie zmieniamy go).
// Zmiany z edytora 🎨 trafiają do dwóch zwykłych plików CSS w CONFIG_DIR:
//   custom-d.css — tryb dzień,  custom-n.css — tryb noc.
// Pliki zawierają tylko właściwości, dla których edytor ma kontrolki.
// Gdy pliku nie ma, strona używa pliku domyślnego z www/custom-defaults/.

const CUSTOM_MODES = { d: "dzień", n: "noc" };
const CUSTOM_DEFAULTS_DIR = path.join(WWW_DIR, "custom-defaults");

// Zmienne, które edytor może zapisać, z opisem do komentarza w pliku.
const CUSTOM_CSS_VARS = {
  "--accent": "Akcent",
  "--accent-alt": "Kolor nagłówków na kafelkach (Akcent 2)",
  "--accent-soft": "Akcent — tło przycisków (z akcentu)",
  "--glow-start": "Poświata tła (z akcentu)",
  "--glow-end": "Poświata tła (z akcentu)",
  "--on-accent": "Tekst na przyciskach w kolorze akcentu",
  "--text": "Kolor tekstu",
  "--muted": "Kolor tekstu pomocniczego",
  "--page-bg": "Tło strony",
  "--surface-base-rgb": "Kolor motywu",
  "--panel-strong": "Kolor przycisku menu i powiadomień (z koloru motywu)",
  "--background-image": "Obraz tła",
  "--background-image-opacity": "Widoczność obrazu",
  "--background-image-blur": "Rozmycie obrazu",
  "--background-image-dim": "Przyciemnienie tła",
  "--title-color": "Kolor nazwy serwisu",
  "--title-size": "Wielkość nazwy serwisu",
  "--title-shadow": "Cień nazwy serwisu",
  "--title-shadow-blur": "Cień nazwy serwisu (rozmycie)",
  "--subtitle-color": "Kolor sloganu",
  "--subtitle-size": "Wielkość sloganu",
  "--subtitle-shadow": "Cień sloganu",
  "--subtitle-shadow-blur": "Cień sloganu (rozmycie)",
  "--logo-size": "Rozmiar logo",
  "--page-title-size": "Wielkość tytułu strony",
  "--page-title-shadow": "Cień tytułu strony",
  "--page-title-shadow-blur": "Cień tytułu strony (rozmycie)",
  "--page-title-color": "Kolor tytułu strony",
  "--section-title-color": "Kolor tytułów sekcji",
  "--section-title-size": "Wielkość tytułów sekcji",
  "--section-title-shadow": "Cień tytułów sekcji",
  "--section-title-shadow-blur": "Cień tytułów sekcji (rozmycie)",
  "--sidebar-panel-rgb": "Kolor tła menu",
  "--sidebar-panel-alpha": "Krycie menu",
  "--sidebar-width": "Szerokość menu",
  "--sidebar-toggle-color": "Kolor ikon menu (przyciski menu i ☰)",
  "--sidebar-toggle-size": "Wielkość ikon menu (przyciski menu i ☰)",
  "--lolli-glass": "Menu: glass paska z nazwą",
  "--lolli-blur": "Menu: blur paska z nazwą",
  "--lolli-text": "Menu: kolor napisów",
  "--lolli-hover": "Menu: po najechaniu",
  "--lolli-active-bg": "Aktywna pozycja: tło",
  "--lolli-active-icon": "Aktywna pozycja: ikona",
  "--input-text": "Kolor tekstu w polach",
  "--font-menu": "Czcionka menu",
  "--font-card": "Czcionka kafelków",
  "--font-description": "Czcionka opisów",
  "--tile-panel-rgb": "Kolor kafelków",
  "--tile-panel-alpha": "Krycie kafelków",
  "--tile-height": "Wysokość kafelków",
  "--admin-panel-rgb": "Kolor kart statusu",
  "--admin-panel-alpha": "Krycie kart statusu",
  "--border-alpha": "Obramowanie kart",
  "--line": "Kolor linii i ramek (z koloru tekstu)",
  "--card-radius": "Zaokrąglenie kart",
  "--card-gap": "Odstęp kart",
  "--glass-blur": "Rozmycie szkła",
  "--glass-saturation": "Nasycenie szkła",
  "--modal-bg-rgb": "Kolor okien",
  "--modal-alpha": "Krycie okien",
  "--modal-glass-blur": "Rozmycie okien",
  "--modal-radius": "Zaokrąglenie okien",
  "--modal-backdrop-alpha": "Przyciemnienie pod oknem",
  "--modal-backdrop-blur": "Rozmycie pod oknem"
};

function customCssPath(mode) {
  return path.join(CONFIG_DIR, `custom-${mode}.css`);
}

function isSafeCssValue(name, value) {
  if (!value || value.length > 300) return false;
  if (/[;{}<>\\]/.test(value)) return false;
  if (/url\(/i.test(value)) {
    if (name !== "--background-image") return false;
    return /^url\("(\/uploads\/[\w.-]+(\?v=\d+)?|\.?\/images\/background\.jpg)"\)$/.test(value);
  }
  return true;
}

function buildCustomCss(mode, vars) {
  const lines = Object.keys(CUSTOM_CSS_VARS)
    .filter((name) => vars[name] != null)
    .map((name) => `  ${name}: ${vars[name]}; /* ${CUSTOM_CSS_VARS[name]} */`);
  const scheme = mode === "d" ? "  color-scheme: light;\n" : "  color-scheme: dark;\n";
  return `/* IF-startpage — wygląd strony, tryb: ${CUSTOM_MODES[mode].toUpperCase()} (custom-${mode}.css)
   Ten plik zapisuje edytor wyglądu (🎨). Możesz go też poprawić ręcznie —
   ale kolejny zapis z edytora nadpisze cały plik.
   Wygląd startowy jest w styles.css; tu są tylko zmiany. Usuń plik,
   żeby wrócić do wyglądu startowego tego trybu. */

html[data-mode="${mode}"] body {
${scheme}${lines.join("\n")}
}
`;
}

// Odczyt zmiennych z pliku (także poprawionego ręcznie) — tylko znane i bezpieczne.
function parseCustomCss(text) {
  const vars = {};
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let match;
  while ((match = re.exec(String(text || "")))) {
    const name = match[1].toLowerCase();
    const value = match[2].trim();
    if (CUSTOM_CSS_VARS[name] && isSafeCssValue(name, value)) vars[name] = value;
  }
  return vars;
}

// Pliki CSS trybów: najpierw wersja użytkownika z CONFIG_DIR, inaczej domyślna.
app.get("/custom/:file", (req, res) => {
  const match = /^custom-(d|n)\.css$/.exec(req.params.file);
  if (!match) return res.status(404).end();
  const userFile = customCssPath(match[1]);
  const defaultFile = path.join(CUSTOM_DEFAULTS_DIR, `custom-${match[1]}.css`);
  res.setHeader("Cache-Control", "no-cache");
  res.type("text/css");
  if (fs.existsSync(userFile)) return res.send(fs.readFileSync(userFile, "utf8"));
  if (fs.existsSync(defaultFile)) return res.send(fs.readFileSync(defaultFile, "utf8"));
  res.send("");
});

// Czy użytkownik ma już własne pliki trybów (strona używa tego do zgodności ze starym theme.json).
app.get("/api/dashboard/custom-css", (req, res) => {
  res.json({
    d: fs.existsSync(customCssPath("d")),
    n: fs.existsSync(customCssPath("n")),
    legacyTheme: fs.existsSync(THEME_FILE)
  });
});

app.put("/api/dashboard/custom-css", requirePin, (req, res) => {
  const mode = req.body?.mode;
  if (!CUSTOM_MODES[mode]) {
    return res.status(400).json({ error: "Nieznany tryb (dozwolone: d, n)." });
  }

  if (req.body?.reset) {
    if (fs.existsSync(customCssPath(mode))) fs.unlinkSync(customCssPath(mode));
    return res.json({ success: true, mode, reset: true });
  }

  const input = req.body?.vars && typeof req.body.vars === "object" ? req.body.vars : {};
  const vars = {};
  for (const [name, raw] of Object.entries(input)) {
    const value = normalizeText(raw);
    if (CUSTOM_CSS_VARS[name] && isSafeCssValue(name, value)) vars[name] = value;
  }

  const backgroundData = normalizeText(req.body?.backgroundData);
  try {
    if (backgroundData) {
      const url = saveUploadedImage(backgroundData, `background-custom-${mode}`, "Niepoprawny format obrazu tła.");
      vars["--background-image"] = `url("${url}")`;
    }
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  ensureConfigDir(customCssPath(mode));
  fs.writeFileSync(customCssPath(mode), buildCustomCss(mode, vars), "utf8");

  // Stary zapis wyglądu (theme.json) przestaje być potrzebny po pierwszym zapisie trybu noc.
  if (mode === "n" && fs.existsSync(THEME_FILE)) {
    fs.renameSync(THEME_FILE, `${THEME_FILE}.old`);
  }

  res.json({ success: true, mode, vars });
});

// Klucze motywu Zaplecza, które przyjmujemy (zgodne z tab-admin-theme.js).
const ADMIN_THEME_KEYS = [
  "accent", "accentAlt", "inputText", "surfaceColor", "bg", "fontMenu", "fontCard", "fontDescription",
  "cardRadius", "cardGap", "panelColor", "panelAlpha", "glassBlur",
  "sidebarColor", "sidebarAlpha", "menuTextColor", "sidebarWidth",
  "menuBtnBg", "menuBtnText", "menuBtnActiveBg", "menuBtnActiveText", "menuBtnHoverBg", "menuBtnHoverText",
  "btnRadius", "btnBorderWidth", "btnBorderColor", "btnGlow", "btnGlowColor", "btnDangerGlowColor",
  "btnNormalBg", "btnNormalText", "btnNormalHoverBg", "btnNormalHoverText",
  "btnDangerBg", "btnDangerText", "btnDangerHoverBg", "btnDangerHoverText",
  "backgroundImage", "backgroundDim", "backgroundBlur", "backgroundOpacity", "backgroundUrl"
];

function sanitizeAdminTheme(input) {
  let source = input && typeof input === "object" ? input : {};
  if (source.themeSettings && typeof source.themeSettings === "object") source = source.themeSettings;
  if (source.theme && typeof source.theme === "object") source = source.theme;

  const output = {};
  for (const key of ADMIN_THEME_KEYS) {
    const value = normalizeText(source[key]);
    if (!value || value.length > 300) continue;
    // Do CSS nie wpuszczamy znaków, które pozwalałyby wyjść poza wartość.
    if (/[;{}<>"]/.test(value)) continue;
    if (key === "backgroundUrl" && !/^\/(uploads|images)\/[\w.-]+(\?v=\d+)?$/.test(value)) continue;
    output[key] = value;
  }
  return output;
}

// Wygląd Zaplecza osobno dla trybu dzień (d) i noc (n): { themes: { d: {...}, n: {...} } }.
// Stary zapis { theme: {...} } (sprzed trybów) to wygląd nocny.
function adminThemeMode(value) {
  return value === "d" ? "d" : "n";
}

function loadAdminThemes() {
  ensureConfigDir(ADMIN_THEME_FILE);
  if (!fs.existsSync(ADMIN_THEME_FILE)) return { d: {}, n: {} };
  try {
    const data = JSON.parse(fs.readFileSync(ADMIN_THEME_FILE, "utf8"));
    if (data && data.themes && typeof data.themes === "object") {
      return { d: sanitizeAdminTheme(data.themes.d), n: sanitizeAdminTheme(data.themes.n) };
    }
    return { d: {}, n: sanitizeAdminTheme(data) };
  } catch (error) {
    return { d: {}, n: {} };
  }
}

function saveAdminTheme(mode, theme) {
  const themes = loadAdminThemes();
  themes[adminThemeMode(mode)] = theme;
  ensureConfigDir(ADMIN_THEME_FILE);
  fs.writeFileSync(ADMIN_THEME_FILE, JSON.stringify({ themes }, null, 2), "utf8");
}

app.get("/api/admin/theme", (req, res) => {
  const themes = loadAdminThemes();
  res.json({ themes, theme: themes[adminThemeMode(req.query.mode)] });
});

app.put("/api/admin/theme", (req, res) => {
  if (!hasValidPin(req)) {
    return res.status(403).json({ error: "Niepoprawny PIN" });
  }
  const mode = adminThemeMode(req.body?.mode);
  if (req.body?.reset) {
    saveAdminTheme(mode, {});
    return res.json({ success: true, mode, theme: {} });
  }

  const theme = sanitizeAdminTheme(req.body?.themeSettings || req.body?.theme || {});
  const backgroundData = normalizeText(req.body?.backgroundData);
  try {
    if (backgroundData) {
      theme.backgroundImage = "custom";
      theme.backgroundUrl = saveAdminBackground(backgroundData);
    }
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  saveAdminTheme(mode, theme);
  res.json({ success: true, mode, theme });
});

// --- Ustawienia Kiosku (www/kiosk/) — podstawowe ustawienia, motyw i przyciski menu ---

const KIOSK_MENU_ITEM_TYPES = new Set(["iframe", "link", "server-status", "live", "docker-status"]);

function sanitizeKioskSettings(input) {
  const output = {};
  const idleTimeout = Number(input?.idleTimeout);
  if (Number.isFinite(idleTimeout) && idleTimeout >= 0) output.idleTimeout = idleTimeout;
  return output;
}

function sanitizeKioskTheme(input) {
  const allowed = [
    "fontScale",
    "notchBg", "notchText", "notchBorder", "notchGlow", "notchBlur", "notchOpacity",
    "lollipopBg", "lollipopBlur", "lollipopOpacity", "lollipopSat",
    "btnBg", "btnText", "btnHoverBg", "btnHoverText", "btnActiveBg", "btnActiveText"
  ];
  const output = {};
  for (const key of allowed) {
    const value = normalizeText(input?.[key]);
    if (value) output[key] = value;
  }
  return output;
}

function sanitizeKioskMenuItems(input) {
  if (!Array.isArray(input)) return null;
  return input
    .filter((raw) => raw && typeof raw === "object" && normalizeText(raw.title))
    .map((raw, idx) => ({
      id: normalizeText(raw.id) || `item-${Date.now()}-${idx}`,
      title: normalizeText(raw.title),
      type: KIOSK_MENU_ITEM_TYPES.has(raw.type) ? raw.type : "iframe",
      url: normalizeText(raw.url),
      icon: normalizeText(raw.icon)
    }));
}

function loadKioskSettings() {
  ensureConfigDir(KIOSK_FILE);
  if (!fs.existsSync(KIOSK_FILE)) {
    return { settings: {}, theme: {}, menuItems: [] };
  }
  try {
    const data = JSON.parse(fs.readFileSync(KIOSK_FILE, "utf8"));
    return {
      settings: sanitizeKioskSettings(data.settings || {}),
      theme: sanitizeKioskTheme(data.theme || {}),
      menuItems: sanitizeKioskMenuItems(data.menuItems) || []
    };
  } catch (error) {
    console.error("Load kiosk settings error:", error);
    return { settings: {}, theme: {}, menuItems: [] };
  }
}

function saveKioskSettings(data) {
  ensureConfigDir(KIOSK_FILE);
  const payload = {
    settings: sanitizeKioskSettings(data.settings || {}),
    theme: sanitizeKioskTheme(data.theme || {}),
    menuItems: sanitizeKioskMenuItems(data.menuItems) || []
  };
  fs.writeFileSync(KIOSK_FILE, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

app.get("/api/kiosk/settings", (req, res) => {
  res.json(loadKioskSettings());
});

app.put("/api/kiosk/settings", (req, res) => {
  if (!hasValidPin(req)) {
    return res.status(403).json({ error: "Niepoprawny PIN" });
  }

  const current = loadKioskSettings();
  const merged = {
    settings: { ...current.settings, ...sanitizeKioskSettings(req.body?.settings || {}) },
    theme: { ...current.theme, ...sanitizeKioskTheme(req.body?.theme || {}) },
    menuItems: Array.isArray(req.body?.menuItems) ? req.body.menuItems : current.menuItems
  };

  const saved = saveKioskSettings(merged);
  res.json({ success: true, ...saved });
});

// ─── Strony ──────────────────────────────────────────────────────────────────

// ─── Ikony Lucide (www/lucide-sprite.svg, ISC) — strony i linki ───
// Nazwa ikony jak na lucide.dev/icons (np. „printer”, „shopping-cart”).
let lucideNames = null;
function lucideIconNames() {
  if (!lucideNames) {
    try {
      const sprite = fs.readFileSync(path.join(WWW_DIR, "lucide-sprite.svg"), "utf8");
      lucideNames = new Set([...sprite.matchAll(/<symbol id="([a-z0-9-]+)"/g)].map((m) => m[1]));
    } catch {
      lucideNames = new Set();
    }
  }
  return lucideNames;
}

// Wygląda jak nazwa ikony Lucide (bez kropki, ukośnika, co najmniej 2 znaki)?
function looksLikeLucideName(value) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) && value.length > 1;
}

function lucideIconError(value) {
  return `Nie ma ikony „${value}” w Lucide. Wyszukaj nazwę na lucide.dev/icons i wpisz ją dokładnie (np. printer, shopping-cart).`;
}

// Ikona strony: pusta (domyślna) albo nazwa z Lucide.
function cleanPageIcon(raw) {
  const value = normalizeText(raw).toLowerCase().slice(0, 60);
  if (!value) return { icon: "" };
  if (!lucideIconNames().has(value)) return { error: lucideIconError(value) };
  return { icon: value };
}

app.post("/api/services/page", requirePin, (req, res) => {
  const data = loadServices();
  const name = normalizeText(req.body?.name).slice(0, 60);
  if (!name) return res.status(400).json({ error: "Podaj nazwę strony." });
  const pageIcon = cleanPageIcon(req.body?.icon);
  if (pageIcon.error) return res.status(400).json({ error: pageIcon.error });
  const page = { id: createId(), name };
  if (pageIcon.icon) page.icon = pageIcon.icon;
  data.pages.push(page);
  saveServices(data);
  res.json({ success: true, page, pages: data.pages });
});

app.put("/api/services/page/:id", requirePin, (req, res) => {
  const data = loadServices();
  const page = data.pages.find((item) => item.id === req.params.id);
  const name = normalizeText(req.body?.name).slice(0, 60);
  if (!page) return res.status(404).json({ error: "Strona nie istnieje." });
  if (!name) return res.status(400).json({ error: "Podaj nazwę strony." });
  if (req.body && Object.prototype.hasOwnProperty.call(req.body, "icon")) {
    const pageIcon = cleanPageIcon(req.body.icon);
    if (pageIcon.error) return res.status(400).json({ error: pageIcon.error });
    if (pageIcon.icon) page.icon = pageIcon.icon;
    else delete page.icon;
  }
  page.name = name;
  saveServices(data);
  res.json({ success: true, page, pages: data.pages });
});

app.put("/api/services/page/:id/move", requirePin, (req, res) => {
  const data = loadServices();
  const index = data.pages.findIndex((item) => item.id === req.params.id);
  const direction = normalizeText(req.body?.direction);
  if (index === -1) return res.status(404).json({ error: "Strona nie istnieje." });
  if (!["up", "down"].includes(direction)) return res.status(400).json({ error: "Niepoprawny kierunek" });
  const target = direction === "up" ? index - 1 : index + 1;
  // Home zostaje zawsze na górze.
  if (target >= 1 && target < data.pages.length && index >= 1) {
    [data.pages[index], data.pages[target]] = [data.pages[target], data.pages[index]];
    saveServices(data);
  }
  res.json({ success: true, pages: data.pages });
});

// Usunięcie strony nie usuwa kafelków — jej sekcje przechodzą na Home.
app.delete("/api/services/page/:id", requirePin, (req, res) => {
  if (req.params.id === HOME_PAGE_ID) {
    return res.status(400).json({ error: "Strony Home nie można usunąć (można zmienić jej nazwę)." });
  }
  const data = loadServices();
  const before = data.pages.length;
  data.pages = data.pages.filter((item) => item.id !== req.params.id);
  if (data.pages.length === before) return res.status(404).json({ error: "Strona nie istnieje." });
  let moved = 0;
  data.sections.forEach((section) => {
    if (section.pageId === req.params.id) {
      section.pageId = HOME_PAGE_ID;
      moved += 1;
    }
  });
  saveServices(data);
  res.json({ success: true, pages: data.pages, movedSections: moved });
});

app.post("/api/services/section", requirePin, (req, res) => {
  const data = loadServices();
  const name = normalizeText(req.body.name);

  if (!name) {
    return res.status(400).json({ error: "Brak nazwy sekcji" });
  }

  // Ikona sekcji (Lucide, opcjonalna) — ta sama kontrola co ikona strony.
  const sectionIcon = cleanPageIcon(req.body.icon);
  if (sectionIcon.error) return res.status(400).json({ error: sectionIcon.error });

  const requestedPage = normalizeText(req.body.pageId);
  const pageId = data.pages.some((page) => page.id === requestedPage) ? requestedPage : HOME_PAGE_ID;

  const section = {
    id: createId(),
    name,
    ...(sectionIcon.icon ? { icon: sectionIcon.icon } : {}),
    pageId,
    groups: [
      {
        name: "Linki",
        items: []
      }
    ]
  };

  data.sections.push(section);
  saveServices(data);

  res.json({ success: true, section });
});

app.put("/api/services/section/:id", requirePin, (req, res) => {
  const data = loadServices();
  const section = data.sections.find(item => item.id === req.params.id);
  const name = normalizeText(req.body.name);

  if (!section) {
    return res.status(404).json({ error: "Sekcja nie istnieje" });
  }

  if (!name) {
    return res.status(400).json({ error: "Brak nazwy sekcji" });
  }

  // Ikona zmienia się tylko, gdy przyszła w zapytaniu (przeniesienie na inną stronę jej nie wysyła).
  if (Object.prototype.hasOwnProperty.call(req.body, "icon")) {
    const sectionIcon = cleanPageIcon(req.body.icon);
    if (sectionIcon.error) return res.status(400).json({ error: sectionIcon.error });
    if (sectionIcon.icon) section.icon = sectionIcon.icon;
    else delete section.icon;
  }

  section.name = name;
  // Opcjonalnie: przeniesienie sekcji na inną stronę (na koniec tej strony).
  const pageId = normalizeText(req.body.pageId);
  if (pageId && pageId !== section.pageId && data.pages.some((page) => page.id === pageId)) {
    section.pageId = pageId;
    data.sections = data.sections.filter((item) => item !== section).concat(section);
  }
  saveServices(data);

  res.json({ success: true, section });
});

app.put("/api/services/section/:id/move", requirePin, (req, res) => {
  const data = loadServices();
  const sectionIndex = data.sections.findIndex(section => section.id === req.params.id);
  const direction = normalizeText(req.body.direction);

  if (sectionIndex === -1) {
    return res.status(404).json({ error: "Sekcja nie istnieje" });
  }

  if (!["up", "down"].includes(direction)) {
    return res.status(400).json({ error: "Niepoprawny kierunek" });
  }

  // Zamiana z sąsiednią sekcją na tej samej stronie.
  const pageId = data.sections[sectionIndex].pageId;
  const samePage = data.sections
    .map((section, index) => ({ section, index }))
    .filter((item) => item.section.pageId === pageId)
    .map((item) => item.index);
  const position = samePage.indexOf(sectionIndex);
  const targetIndex = samePage[direction === "up" ? position - 1 : position + 1];

  if (targetIndex === undefined) {
    return res.json({ success: true, sections: data.sections });
  }

  [data.sections[sectionIndex], data.sections[targetIndex]] = [
    data.sections[targetIndex],
    data.sections[sectionIndex]
  ];
  saveServices(data);

  res.json({ success: true, sections: data.sections });
});

app.put("/api/services/link/:id/move", requirePin, (req, res) => {
  const data = loadServices();
  const linkId = req.params.id;
  const direction = normalizeText(req.body.direction);

  if (!["up", "down"].includes(direction)) {
    return res.status(400).json({ error: "Niepoprawny kierunek (dozwolone: up, down)" });
  }

  let found = false;
  for (const section of (data.sections || [])) {
    if (!Array.isArray(section.groups)) continue;
    for (const group of section.groups) {
      if (!Array.isArray(group.items)) continue;
      const index = group.items.findIndex(item => item.id === linkId);
      if (index !== -1) {
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex >= 0 && targetIndex < group.items.length) {
          [group.items[index], group.items[targetIndex]] = [
            group.items[targetIndex],
            group.items[index]
          ];
          saveServices(data);
        }
        found = true;
        break;
      }
    }
    if (found) break;
  }

  if (!found) {
    return res.status(404).json({ error: "Link nie istnieje" });
  }

  res.json({ success: true, sections: data.sections });
});

app.post("/api/services/link", requirePin, (req, res) => {
  const data = loadServices();

  const sectionId = normalizeText(req.body.sectionId);
  const name = normalizeText(req.body.name);
  const url = normalizeText(req.body.url);
  let icon = normalizeText(req.body.icon);
  // Nazwa ikony Lucide (bez rozszerzenia) — małymi literami i tylko istniejąca.
  if (looksLikeLucideName(icon.toLowerCase())) {
    icon = icon.toLowerCase();
    if (!lucideIconNames().has(icon)) return res.status(400).json({ error: lucideIconError(icon) });
  }
  const description = normalizeText(req.body.description);

  if (!sectionId || !name || !url) {
    return res.status(400).json({ error: "Brakuje danych linku" });
  }

  const section = data.sections.find(item => item.id === sectionId);

  if (!section) {
    return res.status(404).json({ error: "Sekcja nie istnieje" });
  }

  if (!Array.isArray(section.groups)) {
    section.groups = [];
  }

  let group = section.groups.find(item => item.name === "Linki");

  if (!group) {
    group = {
      name: "Linki",
      items: []
    };

    section.groups.push(group);
  }

  group.items.push({
    id: createId(),
    name,
    description,
    icon,
    url,
    kind: "link"
  });

  saveServices(data);

  res.json({ success: true });
});

app.put("/api/services/link/:id", requirePin, (req, res) => {
  const data = loadServices();

  const linkId = req.params.id;
  const sectionId = normalizeText(req.body.sectionId);
  const name = normalizeText(req.body.name);
  const url = normalizeText(req.body.url);
  let icon = normalizeText(req.body.icon);
  // Nazwa ikony Lucide (bez rozszerzenia) — małymi literami i tylko istniejąca.
  if (looksLikeLucideName(icon.toLowerCase())) {
    icon = icon.toLowerCase();
    if (!lucideIconNames().has(icon)) return res.status(400).json({ error: lucideIconError(icon) });
  }
  const description = normalizeText(req.body.description);

  if (!sectionId || !name || !url) {
    return res.status(400).json({ error: "Brakuje danych linku" });
  }

  let foundLink = null;

  data.sections.forEach(section => {
    if (!Array.isArray(section.groups)) return;

    section.groups.forEach(group => {
      if (!Array.isArray(group.items)) return;

      const index = group.items.findIndex(item => item.id === linkId);

      if (index !== -1) {
        foundLink = group.items[index];
        group.items.splice(index, 1);
      }
    });
  });

  if (!foundLink) {
    return res.status(404).json({ error: "Link nie istnieje" });
  }

  const targetSection = data.sections.find(section => section.id === sectionId);

  if (!targetSection) {
    return res.status(404).json({ error: "Sekcja nie istnieje" });
  }

  if (!Array.isArray(targetSection.groups)) {
    targetSection.groups = [];
  }

  let targetGroup = targetSection.groups.find(group => group.name === "Linki");

  if (!targetGroup) {
    targetGroup = {
      name: "Linki",
      items: []
    };

    targetSection.groups.push(targetGroup);
  }

  targetGroup.items.push({
    id: linkId,
    name,
    description,
    icon,
    url,
    kind: "link"
  });

  saveServices(data);

  res.json({ success: true });
});

app.delete("/api/services/section/:id", requirePin, (req, res) => {
  const data = loadServices();

  data.sections = data.sections.filter(section => section.id !== req.params.id);

  saveServices(data);

  res.json({ success: true });
});

app.delete("/api/services/link/:id", requirePin, (req, res) => {
  const data = loadServices();

  data.sections.forEach(section => {
    if (!Array.isArray(section.groups)) return;

    section.groups.forEach(group => {
      if (!Array.isArray(group.items)) return;

      group.items = group.items.filter(item => item.id !== req.params.id);
    });
  });

  saveServices(data);

  res.json({ success: true });
});

app.post("/api/ports/check", requirePin, async (req, res) => {
  const host = normalizeText(req.body.host);
  const port = Number(req.body.port);

  if (!host || !isValidPort(port)) {
    return res.status(400).json({
      ok: false,
      status: "invalid-data",
      message: "Brakuje hosta albo poprawnego portu z zakresu 1-65535."
    });
  }

  try {
    const result = await checkTcpPort(host, port);

    return res.json({
      ...result,
      host,
      port
    });
  } catch (error) {
    console.error("Port check error:", error);

    return res.status(500).json({
      ok: false,
      status: "check-error",
      host,
      port,
      message: "Nie udało się sprawdzić portu."
    });
  }
});

app.get("/api/system/stats", async (req, res) => {
  try {
    const stats = await loadSystemStats();
    res.set("cache-control", "no-store");
    return res.json({ ok: true, ...stats });
  } catch (error) {
    console.error("System stats error:", error.message);
    return res.status(500).json({
      ok: false,
      message: "Nie udało się pobrać statystyk systemu."
    });
  }
});

app.get("/api/system/top", async (req, res) => {
  try {
    const stats = await loadSystemTopStats();
    res.set("cache-control", "no-store");
    return res.json({ ok: true, ...stats });
  } catch (error) {
    console.error("System top stats error:", error.message);
    return res.status(500).json({
      ok: false,
      message: "Nie udało się pobrać szczegółowych statystyk systemu."
    });
  }
});

app.get("/api/docker/containers", async (req, res) => {
  try {
    const { stdout } = await execFileAsync("docker", [
      "ps",
      "-a",
      "--format",
      '{"id":"{{.ID}}","name":"{{.Names}}","state":"{{.State}}","status":"{{.Status}}"}'
    ], { timeout: 4000 });
    const containers = stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
    res.set("cache-control", "no-store");
    return res.json({ ok: true, containers });
  } catch (error) {
    return res.status(500).json({ ok: false, containers: [], message: error.message });
  }
});

// Wersje działających kontenerów (zakładka Aktualizacje, sprawdzanie raz dziennie, dzwonek).
async function collectVersions({ force = false } = {}) {
  const { stdout } = await execFileAsync("docker", [
    "ps",
    "--format",
    '{"name":"{{.Names}}","image":"{{.Image}}"}'
  ], { timeout: 4000 });

  const running = stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean)
    .filter((c) => !DOCKER_VERSION_EXCLUDE.has(c.name));

  return Promise.all(running.map(async (c) => {
    const { stack, service } = resolveStackAndService(c.name);
    const lastSegment = c.image.split("/").pop();
    const installedTag = lastSegment.includes(":") ? lastSegment.split(":").pop() : "latest";
    const [installedLabel, local] = await Promise.all([getInstalledVersionLabel(c.name), isLocalImage(c.image)]);
    const installedVersion = installedLabel || (isStableTag(installedTag) ? installedTag : null);
    const base = {
      container: c.name,
      stack,
      service,
      image: c.image,
      installedTag,
      installedVersion,
      local,
      note: imageNote(c.image),
      changelogUrl: local ? null : changelogUrl(c.image),
      backups: listComposeBackups(stack).length
    };
    // Obraz lokalny (np. wersja testowa) — nie ma czego szukać w rejestrach.
    if (local) return { ...base, latestStable: null, latestPatch: null, latestMajor: null, checkedAt: null };
    const found = await getStableTags(c.image, { force });
    return { ...base, ...classifyUpdates(installedVersion, found.tags), checkedAt: found.checkedAt, checkError: found.error || null };
  }));
}

app.get("/api/docker/versions", async (req, res) => {
  try {
    const versions = await collectVersions({ force: req.query.refresh === "1" });
    res.set("cache-control", "no-store");
    res.json({ ok: true, versions });
  } catch (error) {
    res.status(500).json({ ok: false, versions: [], message: error.message });
  }
});

// Sprawdzanie raz dziennie w tle (pierwsze 2 minuty po starcie, potem co 24 h).
setTimeout(() => collectVersions({ force: true }).catch(() => {}), 2 * 60 * 1000);
setInterval(() => collectVersions({ force: true }).catch(() => {}), VERSIONS_CACHE_MS);

// ─── Kopie compose: docker/app/<aplikacja>/backup/compose.yaml.<data>, ostatnie 5 ───
const COMPOSE_BACKUPS_KEEP = 5;

function composeBackupDir(stack) {
  return path.join(HOST_APPS_DIR, stack, "backup");
}

function listComposeBackups(stack) {
  if (!isSafeName(stack)) return [];
  try {
    return fs.readdirSync(composeBackupDir(stack))
      .filter((name) => /^compose\.yaml\.\d{8}-\d{6}$/.test(name))
      .sort();
  } catch {
    return [];
  }
}

// Właściciel jak folderu stosu (nie root) — kopie da się normalnie oglądać i usuwać na serwerze.
function chownLike(target, reference) {
  try {
    const ref = fs.statSync(reference);
    fs.chownSync(target, ref.uid, ref.gid);
  } catch {}
}

function backupStamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function backupCompose(stack, composePath) {
  const dir = composeBackupDir(stack);
  const stackDir = path.dirname(composePath);
  fs.mkdirSync(dir, { recursive: true });
  chownLike(dir, stackDir);
  // Stare kopie „compose.yaml.bak-<ms>” obok compose.yaml przenosimy do backup/.
  for (const name of fs.readdirSync(stackDir)) {
    const legacy = name.match(/^compose\.yaml\.bak-(\d+)$/);
    if (!legacy) continue;
    const target = path.join(dir, `compose.yaml.${backupStamp(new Date(Number(legacy[1])))}`);
    if (!fs.existsSync(target)) fs.renameSync(path.join(stackDir, name), target);
  }
  const target = path.join(dir, `compose.yaml.${backupStamp()}`);
  fs.copyFileSync(composePath, target);
  chownLike(target, composePath);
  const all = listComposeBackups(stack);
  for (const old of all.slice(0, Math.max(0, all.length - COMPOSE_BACKUPS_KEEP))) {
    fs.unlinkSync(path.join(dir, old));
  }
  return target;
}

app.post("/api/docker/update-compose", requirePin, (req, res) => {
  try {
    const container = normalizeText(req.body?.container);
    const newTag = normalizeText(req.body?.tag);

    if (DOCKER_VERSION_EXCLUDE.has(container)) {
      return res.status(400).json({ ok: false, message: "Ten kontener jest wykluczony z aktualizacji przez ten panel." });
    }

    if (!newTag || !isStableTag(newTag)) {
      return res.status(400).json({ ok: false, message: "Niepoprawny numer wersji." });
    }

    const { stack, service } = resolveStackAndService(container);
    if (!isSafeName(stack) || !isSafeName(service)) {
      return res.status(400).json({ ok: false, message: "Niepoprawna nazwa kontenera lub stosu." });
    }
    const composePath = path.join(HOST_APPS_DIR, stack, "compose.yaml");

    if (!fs.existsSync(composePath)) {
      return res.status(404).json({
        ok: false,
        message: `Nie znaleziono ${composePath}. Sprawdź, czy w compose.yaml IF-startpage jest wolumen "/home/{user}/docker/app:/host-apps" ({user} — twoja nazwa użytkownika).`
      });
    }

    const original = fs.readFileSync(composePath, "utf8");
    const lines = original.split(/\r?\n/);

    let inTargetService = false;
    let serviceIndent = null;
    let updated = false;

    const newLines = lines.map((line) => {
      const serviceMatch = line.match(/^(\s\s)(\S[^:]*):\s*$/);
      if (serviceMatch) {
        inTargetService = serviceMatch[2] === service;
        serviceIndent = serviceMatch[1].length;
        return line;
      }

      if (inTargetService) {
        const indentMatch = line.match(/^(\s*)/);
        const indent = indentMatch[1].length;

        if (line.trim() && indent <= serviceIndent) {
          inTargetService = false;
        } else {
          const imageMatch = line.match(/^(\s*image:\s*)(\S+)(\s*)$/);
          if (imageMatch) {
            const repo = imageMatch[2].split(":")[0];
            updated = true;
            return `${imageMatch[1]}${repo}:${newTag}${imageMatch[3]}`;
          }
        }
      }

      return line;
    });

    if (!updated) {
      return res.status(404).json({
        ok: false,
        message: `Nie znaleziono linii "image:" dla serwisu "${service}" w ${stack}/compose.yaml.`
      });
    }

    backupCompose(stack, composePath);
    fs.writeFileSync(composePath, newLines.join("\n"), "utf8");

    res.json({
      ok: true,
      message: `Zapisano tag "${newTag}" w ${stack}/compose.yaml (serwis "${service}"). Restart stosu w Dockge, żeby zastosować zmianę.`
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

// „Cofnij” — przywraca compose.yaml z ostatniej kopii (kopia znika, więc kolejne „Cofnij” idzie dalej wstecz).
app.post("/api/docker/compose-restore", requirePin, (req, res) => {
  try {
    const container = normalizeText(req.body?.container);
    const { stack } = resolveStackAndService(container);
    if (!isSafeName(stack)) return res.status(400).json({ ok: false, message: "Niepoprawna nazwa stosu." });
    const composePath = path.join(HOST_APPS_DIR, stack, "compose.yaml");
    const backups = listComposeBackups(stack);
    if (!backups.length) return res.status(404).json({ ok: false, message: `Brak kopii compose.yaml dla „${stack}”.` });
    const latest = path.join(composeBackupDir(stack), backups[backups.length - 1]);
    const restored = fs.readFileSync(latest, "utf8");
    const imageLine = (restored.match(/^\s*image:\s*(\S+)/m) || [])[1] || "";
    fs.writeFileSync(composePath, restored, "utf8");
    fs.unlinkSync(latest);
    res.json({
      ok: true,
      message: `Przywrócono compose.yaml stosu „${stack}” z kopii ${backups[backups.length - 1].slice(13)}${imageLine ? ` (obraz ${imageLine})` : ""}. Zrób „Aktualizuj” w Dockge, żeby uruchomić tę wersję.`
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.get("/api/docker/container/:name/logs", requirePin, async (req, res) => {
  try {
    const name = String(req.params.name).replaceAll(/[^a-zA-Z0-9_.-]/g, "");
    const { stdout, stderr } = await execFileAsync("docker", [
      "logs",
      "--tail",
      "150",
      name
    ], { timeout: 5000 });
    res.set("cache-control", "no-store");
    return res.json({ ok: true, logs: (stdout || stderr || "Brak logów.").trim() });
  } catch (error) {
    return res.status(500).json({ ok: false, logs: `Błąd odczytu logów: ${error.message}` });
  }
});

// ─── Ikony aplikacji (Zaplecze → Strony i sekcje → Ikony aplikacji) ───
const ICON_EXTENSIONS = /\.(png|svg|webp|jpe?g|ico)$/i;
const ICON_MAX_BYTES = 2 * 1024 * 1024;

function listIconFiles(dir) {
  try {
    return fs.readdirSync(dir).filter((name) => ICON_EXTENSIONS.test(name) && fs.statSync(path.join(dir, name)).isFile());
  } catch {
    return [];
  }
}

// Bezpieczna nazwa pliku: małe litery, cyfry, „-”, „_”, „.”; bez ścieżek.
function cleanIconName(name) {
  const base = path.basename(String(name || "")).toLowerCase()
    .replace(/ł/g, "l").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-").replace(/[^a-z0-9._-]/g, "");
  return ICON_EXTENSIONS.test(base) && !base.startsWith(".") ? base.slice(0, 120) : "";
}

// „Twoja” = ikona z folderu icons, której nie ma w obrazie albo która różni się od wbudowanej
// (podmieniona). Kopia identyczna z wbudowaną liczy się jako wbudowana.
function sameFile(a, b) {
  try {
    const statA = fs.statSync(a);
    const statB = fs.statSync(b);
    return statA.size === statB.size && fs.readFileSync(a).equals(fs.readFileSync(b));
  } catch {
    return false;
  }
}

app.get("/api/icons", (req, res) => {
  const builtInDir = path.join(WWW_DIR, "icons");
  const builtIn = new Set(listIconFiles(builtInDir));
  const own = new Set(listIconFiles(ICONS_DIR).filter((name) =>
    !builtIn.has(name) || !sameFile(path.join(ICONS_DIR, name), path.join(builtInDir, name))));
  const names = new Set([...listIconFiles(ICONS_DIR), ...builtIn]);
  const icons = [...names].sort((a, b) => a.localeCompare(b)).map((name) => ({ name, own: own.has(name) }));
  res.set("cache-control", "no-store");
  res.json({ icons, ownCount: own.size, builtInCount: builtIn.size });
});

app.post("/api/icons", requirePin, (req, res) => {
  const name = cleanIconName(req.body?.name);
  if (!name) return res.status(400).json({ error: "Dozwolone pliki: PNG, SVG, WebP, JPG, ICO." });
  const match = String(req.body?.data || "").match(/^data:[^;,]*;base64,(.+)$/);
  if (!match) return res.status(400).json({ error: `${name}: nieprawidłowe dane pliku.` });
  const buffer = Buffer.from(match[1], "base64");
  if (!buffer.length || buffer.length > ICON_MAX_BYTES) return res.status(400).json({ error: `${name}: plik pusty albo większy niż 2 MB.` });
  const target = path.join(ICONS_DIR, name);
  if (fs.existsSync(target) && !req.body?.overwrite) return res.status(409).json({ error: `${name}: taka ikona już jest.`, exists: true, name });
  try {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
    fs.writeFileSync(target, buffer, { mode: 0o644 });
    // Prawa jak dla zwykłego pliku (rw-r--r--) i właściciel jak folderu icons —
    // ikona jest widoczna na stronie, a na serwerze można ją normalnie edytować i usunąć.
    fs.chmodSync(target, 0o644);
    try {
      const dirStat = fs.statSync(ICONS_DIR);
      fs.chownSync(target, dirStat.uid, dirStat.gid);
    } catch {}
    res.json({ success: true, name });
  } catch (error) {
    res.status(500).json({ error: `${name}: nie udało się zapisać (${error.message}).` });
  }
});

app.get("/api/alerts/temperature-thresholds", (req, res) => {
  res.set("cache-control", "no-store");
  res.json({ sensors: readTemperaturesWithThresholds() });
});

app.put("/api/alerts/temperature-thresholds", requirePin, (req, res) => {
  const input = req.body?.sensors;
  if (!input || typeof input !== "object") return res.status(400).json({ error: "Brak progów do zapisania." });
  const known = new Map(readAllTemperatures().map((sensor) => [sensor.id, sensor]));
  const saved = loadTempThresholds();
  for (const [id, value] of Object.entries(input)) {
    const sensor = known.get(id);
    if (!sensor) continue;
    const warn = Number(value?.warn);
    const alarm = Number(value?.alarm);
    if (!Number.isFinite(warn) || !Number.isFinite(alarm) || warn < 1 || alarm > 150) {
      return res.status(400).json({ error: `${sensor.name}: progi muszą być liczbami od 1 do 150 °C.` });
    }
    if (alarm <= warn) {
      return res.status(400).json({ error: `${sensor.name}: próg alarmu musi być wyższy niż próg uwagi.` });
    }
    // Progi równe domyślnym nie są zapisywane — wtedy czujnik idzie za domyślnymi.
    if (warn === sensor.defaultWarn && alarm === sensor.defaultAlarm) delete saved[id];
    else saved[id] = { warn, alarm };
  }
  ensureConfigDir(TEMP_THRESHOLDS_FILE);
  fs.writeFileSync(TEMP_THRESHOLDS_FILE, JSON.stringify({ sensors: saved }, null, 2), "utf8");
  res.json({ success: true, sensors: readTemperaturesWithThresholds() });
});

app.get("/api/alerts/load-thresholds", async (req, res) => {
  const stats = await loadSystemStats().catch(() => null);
  res.set("cache-control", "no-store");
  res.json({
    thresholds: loadLoadThresholds(),
    current: { cpu: stats?.cpu?.usage ?? null, ram: stats?.memory?.percent ?? null }
  });
});

app.put("/api/alerts/load-thresholds", requirePin, (req, res) => {
  const names = { cpu: "CPU", ram: "RAM" };
  const saved = {};
  for (const key of Object.keys(LOAD_DEFAULTS)) {
    const warn = Number(req.body?.[key]?.warn);
    const alarm = Number(req.body?.[key]?.alarm);
    if (!Number.isFinite(warn) || !Number.isFinite(alarm) || warn < 1 || alarm > 100) {
      return res.status(400).json({ error: `${names[key]}: progi muszą być liczbami od 1 do 100 %.` });
    }
    if (alarm <= warn) {
      return res.status(400).json({ error: `${names[key]}: próg alarmu musi być wyższy niż próg uwagi.` });
    }
    if (warn !== LOAD_DEFAULTS[key].warn || alarm !== LOAD_DEFAULTS[key].alarm) saved[key] = { warn, alarm };
  }
  ensureConfigDir(LOAD_THRESHOLDS_FILE);
  fs.writeFileSync(LOAD_THRESHOLDS_FILE, JSON.stringify(saved, null, 2), "utf8");
  res.json({ success: true, thresholds: loadLoadThresholds() });
});

app.get("/api/alerts/summary", async (req, res) => {
  try {
    const alerts = [];
    let containers = [];
    let dockerOk = true;

    // 1. Kontenery Docker
    try {
      const { stdout } = await execFileAsync("docker", [
        "ps",
        "-a",
        "--format",
        '{"id":"{{.ID}}","name":"{{.Names}}","image":"{{.Image}}","state":"{{.State}}","status":"{{.Status}}"}'
      ], { timeout: 4000 });
      containers = stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          try { return JSON.parse(line); } catch { return null; }
        })
        .filter(Boolean);

      for (const c of containers) {
        const stateLower = String(c.state || "").toLowerCase();
        const statusLower = String(c.status || "").toLowerCase();
        if (stateLower !== "running" || statusLower.includes("unhealthy") || statusLower.includes("dead") || statusLower.includes("restart")) {
          let severity = "critical";
          if (stateLower === "paused" || statusLower.includes("health: starting")) {
            severity = "warning";
          }
          alerts.push({
            id: `docker-${c.id || c.name}`,
            type: "docker",
            severity,
            title: `Kontener: ${c.name}`,
            message: `Stan: ${c.state || "nieznany"} (${c.status || "brak statusu"})`,
            resource: c.name,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (dockerErr) {
      dockerOk = false;
      alerts.push({
        id: "docker-daemon-error",
        type: "system",
        severity: "warning",
        title: "Docker Daemon niedostępny",
        message: `Błąd komunikacji z Dockerem: ${dockerErr.message}`,
        resource: "docker",
        timestamp: new Date().toISOString()
      });
    }

    // 2. Hardware / System
    try {
      const stats = await loadSystemStats();
      // Temperatury: każdy czujnik wg własnych progów (Centrum alertów → Progi temperatur).
      for (const sensor of readTemperaturesWithThresholds()) {
        if (sensor.temp < sensor.warn) continue;
        const isAlarm = sensor.temp >= sensor.alarm;
        alerts.push({
          id: `temp-${sensor.id}`,
          type: "temperature",
          severity: isAlarm ? "critical" : "warning",
          title: `Temperatura: ${sensor.name}`,
          message: `${Math.round(sensor.temp)}°C — ${isAlarm ? `alarm od ${sensor.alarm}°C` : `uwaga od ${sensor.warn}°C`}`,
          resource: sensor.name,
          timestamp: new Date().toISOString()
        });
      }

      const memPct = stats.memory?.percent;
      if (memPct != null && memPct >= 95) {
        alerts.push({
          id: "hw-ram-high",
          type: "hardware",
          severity: "warning",
          title: "Wysokie zużycie pamięci RAM",
          message: `Zajętość pamięci RAM wynosi ${Math.round(memPct)}%`,
          resource: "ram",
          timestamp: new Date().toISOString()
        });
      }

      const disks = Array.isArray(stats.disks) ? stats.disks : [];
      for (const d of disks) {
        const diskPct = Number(d.percent || d.use || 0);
        if (diskPct >= 90) {
          alerts.push({
            id: `hw-disk-${d.mount || d.filesystem}`,
            type: "hardware",
            severity: diskPct >= 95 ? "critical" : "warning",
            title: `Brak miejsca na dysku (${d.mount || d.filesystem})`,
            message: `Zajętość partycji wynosi ${diskPct}% (${d.used || ""} / ${d.size || ""})`,
            resource: d.mount || "disk",
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (statsErr) {
      console.error("Alerts summary stats error:", statsErr);
    }

    // Dostępne aktualizacje — informacja w dzwonku (nie alarm), z zapamiętanego sprawdzania.
    try {
      const cache = loadVersionsCache();
      const withUpdates = [];
      for (const c of containers.filter((item) => String(item.state).toLowerCase() === "running")) {
        const image = c.image || "";
        if (!image) continue;
        const entry = cache.images[imageWithoutTag(image)];
        if (!entry || !Array.isArray(entry.tags)) continue;
        const lastSegment = image.split("/").pop();
        const installed = lastSegment.includes(":") ? lastSegment.split(":").pop() : null;
        const found = classifyUpdates(isStableTag(installed) ? installed : null, entry.tags);
        if (found.latestPatch || found.latestMajor) withUpdates.push(c.name);
      }
      if (withUpdates.length) {
        alerts.push({
          id: "updates-available",
          type: "updates",
          severity: "info",
          title: `Dostępne aktualizacje: ${withUpdates.length}`,
          message: withUpdates.join(", "),
          resource: "updates",
          timestamp: new Date().toISOString()
        });
      }
    } catch {}

    // Aktualizacje Debiana (z pliku od serwera) — informacja w dzwonku.
    const systemUpdates = readSystemUpdates();
    if (systemUpdates.available && systemUpdates.count) {
      alerts.push({
        id: "system-updates-available",
        type: "updates",
        severity: "info",
        title: `Aktualizacje systemu: ${systemUpdates.count}`,
        message: systemUpdates.securityCount
          ? `W tym bezpieczeństwa: ${systemUpdates.securityCount}. Instalacja w Cockpit.`
          : "Instalacja w Cockpit.",
        resource: "system",
        timestamp: new Date().toISOString()
      });
    }

    const criticalCount = alerts.filter((a) => a.severity === "critical").length;
    const warningCount = alerts.filter((a) => a.severity === "warning").length;
    const infoCount = alerts.filter((a) => a.severity === "info").length;

    res.set("cache-control", "no-store");
    return res.json({
      ok: true,
      summary: {
        total: alerts.length,
        critical: criticalCount,
        warning: warningCount,
        info: infoCount,
        // Same informacje (np. dostępne aktualizacje) nie są awarią.
        healthy: criticalCount === 0 && warningCount === 0,
        containersTotal: containers.length,
        containersRunning: containers.filter((c) => c.state === "running").length,
        timestamp: new Date().toISOString()
      },
      alerts
    });
  } catch (error) {
    console.error("Alerts summary error:", error);
    return res.status(500).json({
      ok: false,
      summary: { total: 1, critical: 1, warning: 0, healthy: false },
      alerts: [{
        id: "internal-error",
        type: "system",
        severity: "critical",
        title: "Błąd modułu alertów",
        message: error.message,
        timestamp: new Date().toISOString()
      }]
    });
  }
});

// Pakiety systemowe serwera: kontener ich nie widzi, dlatego serwer raz dziennie zapisuje listę
// do config/system-updates.json (skrypt extras/system-updates/if-system-updates + zadanie systemd).
// IF-startpage tylko ją czyta; instalacja aktualizacji — w Cockpit.
const SYSTEM_UPDATES_FILE = path.join(CONFIG_DIR, "system-updates.json");

function readSystemUpdates() {
  try {
    const data = JSON.parse(fs.readFileSync(SYSTEM_UPDATES_FILE, "utf8"));
    const packages = Array.isArray(data.packages) ? data.packages.map((p) => ({
      name: normalizeText(p.name),
      current: normalizeText(p.current),
      available: normalizeText(p.available),
      security: p.security === true
    })).filter((p) => p.name) : [];
    const checkedAt = Date.parse(data.checkedAt) || null;
    const ifServer = /^v\d+\.\d+\.\d+$/.test(String(data.ifServerVersion || "")) ? data.ifServerVersion : null;
    return {
      available: true,
      checkedAt,
      ifServerVersion: ifServer,
      // Starsze niż 2 dni = zadanie na serwerze chyba nie działa.
      stale: checkedAt ? Date.now() - checkedAt > 2 * 24 * 60 * 60 * 1000 : true,
      count: packages.length,
      securityCount: packages.filter((p) => p.security).length,
      packages
    };
  } catch {
    return { available: false, count: 0, securityCount: 0, packages: [] };
  }
}

app.get("/api/system/updates", (req, res) => {
  const info = readSystemUpdates();
  res.set("cache-control", "no-store");
  res.json({
    ok: true,
    ...info,
    message: info.available ? "" : "Serwer nie zapisuje jeszcze listy aktualizacji. W terminalu serwera wpisz: sudo if-server → Upgrade. Do tego czasu aktualizacje sprawdzisz w Cockpit (port 9090)."
  });
});

// Program serwera IF-home-server (if-server): wersję zainstalowaną zapisuje serwer w pliku
// system-updates.json (pole ifServerVersion), najnowszą sprawdzamy na GitHubie (tagi vX.Y.Z).
const IF_SERVER_CACHE_KEY = "github:if-faber/IF-home-server";

async function getIfServerLatest({ force = false } = {}) {
  const entry = loadVersionsCache().images[IF_SERVER_CACHE_KEY];
  const maxAge = entry?.error ? VERSIONS_RETRY_MS : VERSIONS_CACHE_MS;
  if (!force && entry && Date.now() - entry.checkedAt < maxAge) return entry;
  let tags = null;
  let error = null;
  try {
    const response = await fetch("https://api.github.com/repos/if-faber/IF-home-server/tags?per_page=100", {
      headers: { "user-agent": "IF-startpage", accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
    tags = (await response.json())
      .map((tag) => String(tag?.name || ""))
      .filter((name) => /^v\d+\.\d+\.\d+$/.test(name))
      .sort(compareVersionTags);
  } catch (err) {
    error = err.message;
    console.error("Sprawdzanie wersji IF-home-server nie powiodło się:", err.message);
  }
  const fresh = { tags: tags ?? entry?.tags ?? null, error, checkedAt: Date.now() };
  const cache = loadVersionsCache();
  cache.images[IF_SERVER_CACHE_KEY] = fresh;
  saveVersionsCache(cache);
  return fresh;
}

app.get("/api/system/if-server", async (req, res) => {
  const installed = readSystemUpdates().ifServerVersion || null;
  const found = await getIfServerLatest({ force: req.query.refresh === "1" });
  const latest = Array.isArray(found.tags) && found.tags.length ? found.tags[found.tags.length - 1] : null;
  res.set("cache-control", "no-store");
  res.json({
    ok: true,
    installed,
    latest,
    upToDate: Boolean(installed && latest && compareVersionTags(installed, latest) >= 0),
    checkedAt: found.checkedAt,
    error: found.error || null
  });
});

// Wersja IF-startpage (Zaplecze): numer z obrazu tego kontenera; obraz lokalny = „tester”.
app.get("/api/app/version", async (req, res) => {
  try {
    const { stdout } = await execFileAsync("docker", ["inspect", os.hostname(), "--format", "{{.Config.Image}}"], { timeout: 3000 });
    const image = stdout.trim();
    const lastSegment = image.split("/").pop();
    const tag = lastSegment.includes(":") ? lastSegment.split(":").pop() : "";
    res.json({ version: isStableTag(tag) ? tag : tag || null, local: await isLocalImage(image) });
  } catch {
    res.json({ version: null, local: false });
  }
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`WWW Helper running on port ${PORT}`);
});

// Grzeczne wyłączanie: przy restarcie/aktualizacji Docker wysyła SIGTERM. Bez obsługi
// czekał 10 s i zabijał proces („exited with code 137”). Teraz kończymy od razu.
function shutdown(signal) {
  console.log(`${signal} — zamykanie serwera.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
