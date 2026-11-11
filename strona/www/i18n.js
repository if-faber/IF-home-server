// i18n.js — rdzeń tłumaczeń strony (plan „Język”, Etap 1).
//
// Napisy przychodzą z /lang.js (serwer) jako window.IF_LANG:
//   base    — angielski, język bazowy (www/langs/en.json i www/mods/<moduł>/langs/en.json), wbudowany i zablokowany,
//   shipped — tłumaczenie dostarczone ze stroną (np. www/langs/pl.json i pl.json modułów),
//   user    — tłumaczenie zapisane przez użytkownika (dane strony, langs/<kod>.json).
// Szukanie napisu: user → shipped → base. Brak frazy w tłumaczeniu → angielski.
//
// Plik języka jest podzielony: grupa → sekcja → napisy, np.
//   { "admin": { "general": { "_desc": "…", "save": "Save" } } }
// Napis wskazuje etykieta grupa.sekcja.nazwa: t("admin.general.save").
// Klucze zaczynające się od „_” (np. _desc, _meta) to opisy dla edytora, nie napisy.
// Zmienne w napisie: t("page.header.stats_updated", { time: "12:00" }) dla „Updated {time}”.
// Liczba mnoga: tn(etykieta, liczba) — opis przy funkcji tn niżej.
(function () {
  const data = window.IF_LANG && typeof window.IF_LANG === "object" ? window.IF_LANG : {};

  function flatten(tree, prefix, out) {
    if (!tree || typeof tree !== "object") return out;
    for (const [key, value] of Object.entries(tree)) {
      if (key.startsWith("_")) continue;
      const id = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "string") out[id] = value;
      else if (value && typeof value === "object") flatten(value, id, out);
    }
    return out;
  }

  const layers = [data.user, data.shipped, data.base].map((tree) => flatten(tree, "", {}));

  function lookup(key) {
    for (const layer of layers) {
      if (typeof layer[key] === "string" && layer[key] !== "") return layer[key];
    }
    return null;
  }

  function fill(text, vars) {
    if (!vars || typeof vars !== "object") return text;
    return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
  }

  function t(key, vars) {
    const text = lookup(key);
    if (text === null) {
      console.warn(`i18n: brak napisu „${key}”`);
      return key;
    }
    return fill(text, vars);
  }

  // Liczba mnoga: tn("page.server_status.debian_packages", 5) szuka wpisu z końcówką formy
  // według zasad języka (Intl.PluralRules): polski _one / _few / _many / _other (1 pakiet, 2 pakiety,
  // 5 pakietów, 1,5 pakietu), angielski _one / _other. Brak formy → _other. {n} w napisie = liczba.
  let pluralRules = null;
  try { pluralRules = new Intl.PluralRules(data.code || "en"); } catch { pluralRules = new Intl.PluralRules("en"); }

  function tn(key, n, vars) {
    const form = pluralRules.select(Number(n));
    const text = lookup(`${key}_${form}`) ?? lookup(`${key}_other`);
    if (text === null) {
      console.warn(`i18n: brak napisu „${key}_${form}”`);
      return key;
    }
    return fill(text, { n, ...(vars || {}) });
  }

  // Statyczny HTML (np. menu Zaplecza): <span data-t="admin.sidebar.title">Zaplecze</span>,
  // data-t-title / data-t-aria / data-t-placeholder — podpowiedź, opis dla czytników ekranu, podpowiedź w polu.
  function apply(root = document) {
    root.querySelectorAll("[data-t]").forEach((el) => { el.textContent = t(el.dataset.t); });
    root.querySelectorAll("[data-t-title]").forEach((el) => { el.title = t(el.dataset.tTitle); });
    root.querySelectorAll("[data-t-aria]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.tAria)); });
    root.querySelectorAll("[data-t-placeholder]").forEach((el) => { el.placeholder = t(el.dataset.tPlaceholder); });
  }

  // Czy napis jest w plikach języka (np. tłumaczenie komunikatu serwera — inaczej zostaje tekst z serwera).
  const has = (key) => lookup(key) !== null;

  window.IF_I18N = { language: data.code || "en", t, tn, apply, has };

  // ─── Formaty i jednostki (plan „Język”, Etap 7) ─────────────────────────────
  // Ustawienia ogólne: strefa czasowa, data i godzina, przecinek / kropka, °C / °F.
  // Domyślnie („auto”) według języka strony: kod języka + region przeglądarki (np. en + en-US → en-US).
  // Serwer podaje wybór w /lang.js (data.formats); temperatury serwer zawsze liczy w °C.
  const formats = data.formats && typeof data.formats === "object" ? data.formats : {};
  const language = data.code || "en";
  const browser = (navigator.languages || [navigator.language || ""]).find((tag) => String(tag).split("-")[0] === language);
  const autoLocale = browser && browser.includes("-") ? browser : ({ pl: "pl-PL", en: "en-GB" }[language] || language);
  const DATE_LOCALES = { pl: "pl-PL", "en-GB": "en-GB", "en-US": "en-US" };
  const dateLocale = DATE_LOCALES[formats.dateFormat] || autoLocale;
  const numberLocale = formats.decimal === "comma" ? "pl-PL" : formats.decimal === "dot" ? "en-US" : autoLocale;
  const timeZone = formats.timeZone || undefined;     // brak = strefa przeglądarki
  const fahrenheit = formats.temperatureUnit === "f";

  function toDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // ISO: 2026-11-11 19:27 — składane z części, żeby uwzględnić strefę czasową.
  function isoParts(date) {
    const parts = {};
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(date).forEach((part) => { parts[part.type] = part.value; });
    return parts;
  }

  function safeFormat(locale, options, date) {
    try { return new Intl.DateTimeFormat(locale, { timeZone, ...options }).format(date); }
    catch { return new Intl.DateTimeFormat(locale, options).format(date); }
  }

  const DATE_OPTIONS = { year: "numeric", month: "2-digit", day: "2-digit" };
  const TIME_OPTIONS = { hour: "2-digit", minute: "2-digit" };

  const format = {
    // Data i godzina, np. 11.11.2026, 19:27 (pl) · 11/11/2026, 19:27 (UK) · 11/11/2026, 07:27 PM (USA) · 2026-11-11 19:27 (ISO).
    dateTime(value, { seconds = false } = {}) {
      const date = toDate(value);
      if (!date) return "";
      if (formats.dateFormat === "iso") {
        const p = isoParts(date);
        return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}${seconds ? `:${p.second}` : ""}`;
      }
      return safeFormat(dateLocale, { ...DATE_OPTIONS, ...TIME_OPTIONS, ...(seconds ? { second: "2-digit" } : {}) }, date);
    },
    date(value) {
      const date = toDate(value);
      if (!date) return "";
      if (formats.dateFormat === "iso") { const p = isoParts(date); return `${p.year}-${p.month}-${p.day}`; }
      return safeFormat(dateLocale, DATE_OPTIONS, date);
    },
    time(value, { seconds = true } = {}) {
      const date = toDate(value);
      if (!date) return "";
      if (formats.dateFormat === "iso") { const p = isoParts(date); return `${p.hour}:${p.minute}${seconds ? `:${p.second}` : ""}`; }
      return safeFormat(dateLocale, { ...TIME_OPTIONS, ...(seconds ? { second: "2-digit" } : {}) }, date);
    },
    // Liczba z przecinkiem albo kropką, np. number(1.5, 1) → „1,5” / „1.5”.
    number(value, digits = 0, { minDigits = digits } = {}) {
      const n = Number(value);
      if (value == null || Number.isNaN(n)) return "—";
      return n.toLocaleString(numberLocale, { minimumFractionDigits: minDigits, maximumFractionDigits: digits });
    },
    // Temperatura z serwera (°C) w wybranej jednostce: temp(45.4) → „45°C” albo „114°F”.
    temp(celsius, digits = 0) {
      if (celsius == null || Number.isNaN(Number(celsius))) return "—";
      return `${format.number(format.tempValue(celsius), digits)}${format.tempUnit()}`;
    },
    tempValue(celsius) { return fahrenheit ? Number(celsius) * 9 / 5 + 32 : Number(celsius); },
    // Z jednostki użytkownika z powrotem na °C (np. próg wpisany w °F przed zapisem).
    tempToCelsius(value) { return fahrenheit ? (Number(value) - 32) * 5 / 9 : Number(value); },
    tempUnit() { return fahrenheit ? "°F" : "°C"; },
    settings: { ...formats, dateLocale, numberLocale, timeZone: timeZone || "" }
  };
  window.IF_FORMAT = format;
  window.t = t;
  window.tn = tn;
  if (data.code) document.documentElement.lang = data.code;
  // Skrypty są wczytywane z „defer”, więc HTML strony jest już gotowy.
  if (document.querySelectorAll) apply();
})();
