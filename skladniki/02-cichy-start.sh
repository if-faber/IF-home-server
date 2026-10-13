# shellcheck shell=bash disable=SC2034  # NAZWA i WERSJA czyta if-server.sh
# Składnik: cichy start (install-myhome.sh, krok „Quiet boot, wyciszenie logów jądra”)
NAZWA="Cichy start"
WERSJA=1

sprawdz() {
    grep -qs '^kernel.printk' /etc/sysctl.d/99-quiet-console.conf || return 1
    grep -qs 'loglevel=3' /etc/default/grub || echo "ustawienia GRUB"
}

zainstaluj() {
    # shellcheck disable=SC2016  # `lsb_release` ma się wykonać w GRUB, nie tutaj
    printf '%s\n' \
        'GRUB_DEFAULT=0' \
        'GRUB_TIMEOUT=1' \
        'GRUB_RECORDFAIL_TIMEOUT=0' \
        'GRUB_DISTRIBUTOR=`lsb_release -i -s 2>/dev/null || echo Debian`' \
        'GRUB_CMDLINE_LINUX_DEFAULT="quiet loglevel=3 console=tty1"' \
        'GRUB_CMDLINE_LINUX=""' \
        > /etc/default/grub
    run "Aktualizacja GRUB-a" update-grub

    echo "kernel.printk = 3 4 1 3" > /etc/sysctl.d/99-quiet-console.conf
    run "Zastosowanie sysctl" sysctl -p /etc/sysctl.d/99-quiet-console.conf
}
