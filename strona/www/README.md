# IF-startpage — Strona Główna

Interfejs Strony Głównej SPA projektu **IF-startpage** — samodzielnej strony startowej serwera domowego.

Sekcje i linki są obsługiwane i trwale zapisywane przez API helpera:

```text
http://<adres-serwera>:3010/api/services
```

Struktura:

```text
index.html
app.js
styles.css
shared.js
images/
icons/
mods/
  top/
  alerts/
  admin/
```

Nazwę pliku ikony, np. `proxmox.png`, wpisuje się w formularzu linku. Pliki ikon trafiają do `icons/`.

Tester portów korzysta z `/api/ports/check`.
Diagnostyka systemu korzysta z `/api/system/stats`, `/api/system/top` oraz `/api/alerts/summary`.

Kolejność sekcji jest zapisywana przez helper. Menu można całkowicie schować przyciskiem `☰`.

