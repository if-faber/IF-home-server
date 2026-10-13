# shellcheck shell=bash disable=SC2034  # NAZWA i WERSJA czyta if-server.sh
# Składnik: pakiety systemowe (install-myhome.sh, krok „Pakiety systemowe”, bez druku i ShellChecka)
NAZWA="Pakiety systemowe"
WERSJA=1

sprawdz() {
    pakiet_jest openssh-server || return 1
    brak_pakietow avahi-daemon smartmontools lm-sensors sysstat htop \
        cifs-utils nfs-common nodejs python3-pip python3-venv
}

zainstaluj() {
    run "SSH i mDNS (.local)" apt-get install -y openssh-server avahi-daemon
    run "Diagnostyka sprzętu (smartmontools, lm-sensors...)" apt-get install -y smartmontools lm-sensors sysstat htop
    run "Protokoły sieciowe (NFS/CIFS)" apt-get install -y cifs-utils nfs-common
    run "Python / Node.js" apt-get install -y nodejs python3-pip python3-venv
}
