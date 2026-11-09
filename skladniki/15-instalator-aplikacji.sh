# shellcheck shell=bash disable=SC2034  # NAZWA i WERSJA czyta if-server.sh
# Składnik: Instalator aplikacji — zadanie if-aplikacje, które zakłada aplikację przygotowaną na stronie.
#
# Strona (Zaplecze → Aplikacje → Instalator) dostosowuje compose i zostawia „karteczkę”
# aplikacje-zlecenie.json w swoim folderze config; if-aplikacje.path ją zauważa i uruchamia
# if-aplikacje.service (foldery z prawami użytkownika, sprawdzenie compose). Pliki: strona/extras/aplikacje/.
NAZWA="Instalator aplikacji"
WERSJA=1

sprawdz() {
    local brak
    brak="$(
        brak_pakietow python3
        [ -x /usr/local/bin/if-aplikacje ] || echo "skrypt if-aplikacje"
        [ "$(systemctl is-enabled if-aplikacje.path 2>/dev/null)" = "enabled" ] || echo "zadanie if-aplikacje.path"
    )"
    [ "$(printf '%s\n' "$brak" | grep -c .)" -lt 3 ] || return 1
    if [ -x /usr/local/bin/if-aplikacje ] \
        && ! cmp -s "$APP_DIR/strona/extras/aplikacje/if-aplikacje" /usr/local/bin/if-aplikacje; then
        brak="${brak:+$brak
}nowa wersja zadania if-aplikacje"
    fi
    [ -z "$brak" ] || printf '%s\n' "$brak"
}

zainstaluj() {
    local src="$APP_DIR/strona/extras/aplikacje"
    local plik

    run "Python (dla Instalatora aplikacji)" apt-get install -y python3
    install -m 755 "$src/if-aplikacje" /usr/local/bin/if-aplikacje
    for plik in if-aplikacje.service if-aplikacje.path; do
        if [ ! -f "/etc/systemd/system/$plik" ]; then
            sed "s#/home/{user}/#${USER_HOME}/#" "$src/$plik" > "/etc/systemd/system/$plik"
            chmod 644 "/etc/systemd/system/$plik"
        else
            # Mógł być poprawiony ręcznie (np. folder wersji testowej) — nie nadpisujemy.
            info "$plik już jest — zostawiam bez zmian"
        fi
    done

    run "Przeładowanie systemd" systemctl daemon-reload
    run "Instalator aplikacji: czekanie na zlecenia ze strony (if-aplikacje.path)" systemctl enable --now if-aplikacje.path
    info "Instalator: strona startowa → Zaplecze → Aplikacje → Instalator"
}
