# shellcheck shell=bash disable=SC2034  # NAZWA i WERSJA czyta if-server.sh
# Składnik: narzędzia dla IF-startpage (install-myhome.sh, krok 11) — ShellCheck
# i zadanie if-system-updates (lista aktualizacji Debiana raz dziennie).
#
# Kontener IF-startpage nie widzi pakietów serwera. Serwer raz dziennie zapisuje
# listę oczekujących aktualizacji do folderu danych IF-startpage, a strona ją
# pokazuje. Pliki w skladniki/pliki/if-startpage/ to KOPIA z repozytorium
# IF-startpage (extras/system-updates/) — zmiany wprowadzamy w obu miejscach.
NAZWA="Narzędzia dla IF-startpage"
WERSJA=1

sprawdz() {
    local brak
    brak="$(
        brak_pakietow shellcheck
        [ -x /usr/local/bin/if-system-updates ] || echo "skrypt if-system-updates"
        [ "$(systemctl is-enabled if-system-updates.timer 2>/dev/null)" = "enabled" ] \
            || echo "zadanie if-system-updates.timer"
    )"
    [ "$(printf '%s\n' "$brak" | grep -c .)" -lt 3 ] || return 1
    [ -z "$brak" ] || printf '%s\n' "$brak"
}

zainstaluj() {
    local src="$COMPONENTS_DIR/pliki/if-startpage"
    local service=/etc/systemd/system/if-system-updates.service

    run "Sprawdzanie skryptów (shellcheck)" apt-get install -y shellcheck

    install -m 755 "$src/if-system-updates" /usr/local/bin/if-system-updates
    install -m 644 "$src/if-system-updates.timer" /etc/systemd/system/
    if [ ! -f "$service" ]; then
        sed "s#/home/{user}/#${USER_HOME}/#" "$src/if-system-updates.service" > "$service"
        chmod 644 "$service"
    else
        # Mógł być poprawiony ręcznie (np. drugi plik dla wersji testowej) — nie nadpisujemy.
        info "if-system-updates.service już jest — zostawiam bez zmian"
    fi

    run "Przeładowanie systemd" systemctl daemon-reload
    run "Sprawdzanie aktualizacji raz dziennie (if-system-updates.timer)" \
        systemctl enable --now if-system-updates.timer
    info "Lista aktualizacji trafi do: ${USER_HOME}/docker/app-data/if-startpage/config/system-updates.json"
}
