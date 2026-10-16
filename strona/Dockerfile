# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim

# Docker CLI (statyczny binary z oficjalnego obrazu) — do komunikacji z hostowym
# dockerd przez zamontowany /var/run/docker.sock (Diagnostyka/Top, Status
# kontenerów w Kiosku, zakładka Aktualizacje).
COPY --from=docker:27-cli /usr/local/bin/docker /usr/local/bin/docker

# procps -> polecenie `top -b -n 1` używane przez /api/system/top (Diagnostyka Serwera).
RUN apt-get update \
    && apt-get install -y --no-install-recommends procps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Zależności backendu instalowane osobno od reszty kodu — lepszy cache warstw
# przy zmianach w www/ czy www-helper/server.js, które nie ruszają package.json.
COPY www-helper/package.json www-helper/package-lock.json ./www-helper/
RUN cd www-helper && npm ci --omit=dev

# Kod aplikacji.
COPY www ./www
COPY www-helper ./www-helper

ENV APP_BASE_DIR=/app \
    CONFIG_DIR=/app/config \
    WWW_DIR=/app/www \
    HELPER_DIR=/app/www-helper \
    BACKUP_DIR=/app/backups \
    ICONS_DIR=/app/icons \
    PORT=3010

EXPOSE 3010

WORKDIR /app/www-helper
CMD ["node", "server.js"]
