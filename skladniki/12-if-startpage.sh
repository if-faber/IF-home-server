# shellcheck shell=bash disable=SC2034  # NAZWA i WERSJA czyta if-server.sh
# Składnik: narzędzia dla IF-startpage (install-myhome.sh, krok 11) — ShellCheck
# i zadanie if-system-updates (lista aktualizacji Debiana raz dziennie i od razu po
# każdej instalacji lub aktualizacji pakietów — plik 99if-system-updates dla apt).
#
# Kontener IF-startpage nie widzi pakietów serwera. Serwer raz dziennie zapisuje
# listę oczekujących aktualizacji do folderu danych IF-startpage, a strona ją
# pokazuje. Pliki: strona/extras/system-updates/ (strona jest częścią tego repozytorium).
NAZWA="Narzędzia dla IF-startpage"
# WERSJA 3: skrypt zapisuje też wersję if-server (strona pokazuje ją w Aktualizacjach).
WERSJA=3

sprawdz() {
    local brak
    brak="$(
        brak_pakietow shellcheck
        [ -x /usr/local/bin/if-system-updates ] || echo "skrypt if-system-updates"
        [ "$(systemctl is-enabled if-system-updates.timer 2>/dev/null)" = "enabled" ] \
            || echo "zadanie if-system-updates.timer"
        [ -f /etc/apt/apt.conf.d/99if-system-updates ] || echo "odświeżanie listy po aktualizacji (apt)"
    )"
    [ "$(printf '%s\n' "$brak" | grep -c .)" -lt 4 ] || return 1
    if [ -x /usr/local/bin/if-system-updates ] \
        && ! cmp -s "$APP_DIR/strona/extras/system-updates/if-system-updates" /usr/local/bin/if-system-updates; then
        brak="${brak:+$brak
}nowa wersja zadania if-system-updates"
    fi
    [ -z "$brak" ] || printf '%s\n' "$brak"
}

zainstaluj() {
    local src="$APP_DIR/strona/extras/system-updates"
    local service=/etc/systemd/system/if-system-updates.service

    run "Sprawdzanie skryptów (shellcheck)" apt-get install -y shellcheck

    install -m 755 "$src/if-system-updates" /usr/local/bin/if-system-updates
    install -m 644 "$src/if-system-updates.timer" /etc/systemd/system/
    # Po każdej instalacji / aktualizacji pakietów (apt, Cockpit) lista odświeża się od razu.
    install -m 644 "$src/99if-system-updates" /etc/apt/apt.conf.d/99if-system-updates
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
    # Lista (i wersja serwera) od razu, nie dopiero w nocy — gdy strona już jest.
    run "Lista aktualizacji Debiana dla strony" systemctl start --no-block if-system-updates.service
    info "Lista aktualizacji trafi do: ${USER_HOME}/docker/app-data/if-startpage/config/system-updates.json"
}
