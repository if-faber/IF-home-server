# shellcheck shell=bash disable=SC2034  # NAZWA i WERSJA czyta if-server.sh
# Składnik: kopia zapasowa — zadanie if-backup, które robi kopie według ustawień ze strony startowej.
#
# Strona (Zaplecze → Kopia zapasowa) zapisuje ustawienia i zostawia „karteczkę”
# backup-zlecenie.json w swoim folderze config; if-backup.path ją zauważa i uruchamia
# if-backup.service. Pliki: strona/extras/backup/.
NAZWA="$(t 'Kopia zapasowa')"
# Harmonogram: if-backup-harmonogram.timer (codziennie o 3:00 sprawdza, czy kopia jest potrzebna).
WERSJA=1

sprawdz() {
    local brak
    brak="$(
        brak_pakietow python3
        [ -x /usr/local/bin/if-backup ] || printf '%s\n' "$(t 'skrypt if-backup')"
        [ "$(systemctl is-enabled if-backup.path 2>/dev/null)" = "enabled" ] || printf '%s\n' "$(t 'zadanie if-backup.path')"
        [ "$(systemctl is-enabled if-backup-harmonogram.timer 2>/dev/null)" = "enabled" ] || printf '%s\n' "$(t 'harmonogram kopii (if-backup-harmonogram.timer)')"
    )"
    [ "$(printf '%s\n' "$brak" | grep -c .)" -lt 4 ] || return 1
    if [ -x /usr/local/bin/if-backup ] \
        && ! cmp -s "$APP_DIR/strona/extras/backup/if-backup" /usr/local/bin/if-backup; then
        brak="${brak:+$brak
}$(t 'nowa wersja zadania %s' if-backup)"
    fi
    [ -z "$brak" ] || printf '%s\n' "$brak"
}

zainstaluj() {
    local src="$APP_DIR/strona/extras/backup"
    local plik

    run "$(t 'Python (dla zadania kopii)')" apt-get install -y python3
    install -m 755 "$src/if-backup" /usr/local/bin/if-backup
    for plik in if-backup.service if-backup.path if-backup-harmonogram.service if-backup-harmonogram.timer; do
        if [ ! -f "/etc/systemd/system/$plik" ]; then
            sed "s#/home/{user}/#${USER_HOME}/#" "$src/$plik" > "/etc/systemd/system/$plik"
            chmod 644 "/etc/systemd/system/$plik"
        else
            # Mógł być poprawiony ręcznie (np. folder wersji testowej) — nie nadpisujemy.
            info "$(t '%s już jest — zostawiam bez zmian' "$plik")"
        fi
    done

    run "$(t 'Przeładowanie systemd')" systemctl daemon-reload
    run "$(t 'Kopia zapasowa: czekanie na zlecenia ze strony (if-backup.path)')" systemctl enable --now if-backup.path
    run "$(t 'Kopia zapasowa: harmonogram (if-backup-harmonogram.timer)')" systemctl enable --now if-backup-harmonogram.timer
    info "$(t 'Ustawienia kopii: strona startowa → Zaplecze → Kopia zapasowa')"
}
