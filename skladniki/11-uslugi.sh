# shellcheck shell=bash disable=SC2034  # NAZWA i WERSJA czyta if-server.sh
# Składnik: wyłączenie zbędnych usług (install-myhome.sh, krok „Wyłączenie zbędnych usług”)
NAZWA="$(t 'Wyłączenie zbędnych usług')"
WERSJA=1

USLUGI=(colord nfs-blkmap)

sprawdz() {
    local u wlaczone=()
    for u in "${USLUGI[@]}"; do
        [ "$(systemctl is-enabled "$u.service" 2>/dev/null)" = "masked" ] || wlaczone+=("$u")
    done
    [ "${#wlaczone[@]}" -lt "${#USLUGI[@]}" ] || return 1
    for u in "${wlaczone[@]}"; do
        printf '%s\n' "$(t 'wyłączenie %s' "$u")"
    done
}

zainstaluj() {
    local u
    for u in "${USLUGI[@]}"; do
        systemctl disable --now "$u.service" >>"$LOG_FILE" 2>&1 || true
        run "$(t 'Wyłączenie %s' "$u")" systemctl mask "$u.service"
    done
}
