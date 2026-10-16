# www-helper — backend API IF-startpage

Mały serwer Node.js (Express), który:

- serwuje pliki strony (`www/`),
- zapisuje kafelki, wygląd i ustawienia w katalogu `CONFIG_DIR`,
- odczytuje stan serwera (CPU, RAM, dyski, sieć) i kontenerów Dockera przez zamontowany `/var/run/docker.sock`.

Działa w kontenerze na porcie `3010` (w `compose.yaml` zmapowany na port `80` hosta).

## Pliki konfiguracyjne (w `CONFIG_DIR`, domyślnie `/app/config`)

- `dashboard.env` — PIN Zaplecza (`DASHBOARD_PIN`), tworzony po zmianie PIN-u w UI
- `services.json` — sekcje i kafelki strony głównej
- `dashboard.json` — tytuł, podtytuł, logo
- `theme.json` — wygląd Strony Głównej
- `admin-theme.json` — wygląd Zaplecza
- `kiosk.json` — ustawienia Kiosku

Żaden z tych plików nie jest częścią repo ani obrazu. Przy pierwszym uruchomieniu serwer sam tworzy puste wartości domyślne.

## Uruchomienie bez Dockera (do testów)

```bash
cd www-helper
npm ci
CONFIG_DIR=/tmp/if-startpage-config WWW_DIR=../www npm start
```
