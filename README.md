# IF-home-server

[Polski](README.pl.md) · **English**

A home server on Debian 13 for non-technical people: **the `if-server` program,
Dockge and the IF-startpage start page — one whole, installed together and correctly.**
Part of the **IdeaForge** package.

- `if-server` — a program that stays on the server (`sudo if-server`): it installs, completes
  and updates all components (similar to KIAUH for Klipper).
- [`strona/`](strona/) — the server's start page in the browser (`http://<server-address>`),
  with a PIN-protected back office (Zaplecze), server status, alerts, updates, an app installer
  and backup.

**Languages:** the `if-server` program speaks English or Polish (chosen on the first screen).
The start page is in Polish for now; English is the next step.

**Versions (since 0.3.0):** the second digit is shared by the server and the page (0.3, 0.4…).
Small fixes get the third digit (v0.4.1, v0.4.2…); the page is updated by Upgrade or by the
“Aktualizuj” (Update) button in Zaplecze → Aplikacje.

## Features

- **Server status** — each component: present / incomplete (what is missing) / not installed.
- **Upgrade** — installs new components, completes incomplete ones, updates those whose
  recipe has changed. On a clean Debian it is a full installation.
- **Program updates** — on start it checks for a newer version, shows “What is new”
  and asks: update / keep current.
- **Recognizing an existing installation** — a server set up with the old script
  (`install-myhome.sh`) is recognized without reinstalling anything.
- **Backup and restore** — following the settings on the start page (disk, how often,
  how many copies); later copies take only the changes; restore all apps or just one.
- **Apps** — an installer (the compose file from the app's repository, adjusted to the server:
  data in `app-data`, a fixed version, free ports) and one-click updates: a copy, the new version,
  a check, and if something goes wrong, a return to the previous version together with its data.
- **Root account password** — optional, for emergency mode (when installing Debian we leave
  the root password empty — Debian then sets up `sudo` by itself).

## Installed components

| Component | What it contains |
|---|---|
| System basics | sudo, curl, git, lsb-release |
| Quiet boot | quiet boot (GRUB) and kernel logs |
| System packages | SSH, avahi (`.local`), smartmontools, lm-sensors, sysstat, htop, cifs-utils, nfs-common, Node.js, Python (pip, venv) |
| Printing and scanning | CUPS (server or client), sane-utils |
| Docker | Docker from the official repository, Docker Compose |
| Server folders | `~/docker/app`, `~/docker/app-data` and working folders |
| Dockge | Docker Compose stack manager (port 5001) |
| Samba | file sharing on the home network |
| Cockpit and plugins | server panel (port 9090), disk modules, sosreport, 45Drives (Navigator, File Sharing, Identities), Explorer, Docker Manager, CTOP |
| Charts in Cockpit | PCP — load history |
| Unneeded services off | colord, nfs-blkmap |
| Tools for IF-startpage | ShellCheck, the Debian update list for the start page (daily and right after every update) |
| Backup | the `if-backup` task: copies and restore following the settings on the page (Zaplecze → Kopia zapasowa), schedule |
| App installer | the `if-aplikacje` task: sets up an app prepared on the page (Zaplecze → Aplikacje → Instalator) — folders with user rights, compose check |
| IF-startpage (start page) | server panel in the browser (`http://<server-address>`), the `if-startpage` stack in Dockge; Upgrade updates a page older than the one released with the server |

The 45Drives and Docker Manager plugins come from outside the Debian repositories (45Drives — a
`curl | bash` script run as root, Docker Manager — a repository without signature checking).

## Installation

Debian 13 (netinst) with “SSH server”, empty root password, preferably on a network cable. Then:

```sh
sudo apt install -y git
sudo git clone https://github.com/if-faber/IF-home-server.git /opt/if-home-server
sudo /opt/if-home-server/if-server.sh
```

The first screen asks for the language (English / Polski). In the menu: **Upgrade** — the program asks, among other things, for a file sharing password and
a PIN for the start page. After that, `sudo if-server` is enough — the language is remembered.
Change the language: menu → Język / Language. Start page: `http://<server-address>`.

## Tests

| Test | Hardware | Result |
|---|---|---|
| Clean Debian 13 installation and Upgrade of all components | HP t730 Thin Client | 12 of 12, Cockpit and Dockge work after restart |
| Server installed with the old script: recognition and completion | HP t730 Thin Client | 10 components recognized, 2 completed |
| Recognition, program updates, root password | Fujitsu Esprimo Q920 | no errors |
| 0.4: backup (4.5 GB in 45 s) and app restore | test server, USB disk | copies and restore without errors |
| 0.4: Installer (LubeLogger from a compose file on GitHub) | test server | the app works after Deploy in Dockge |
| 0.4.1: app update — successful, non-existent version, crashing version | test server | return to the previous version with data |
| 0.5.0: clean Debian 13 installation in English — every window and step | Dell Wyse | 15 of 15, start page and Dockge work |

## Project history

Up to version 0.2.5 the server and the page were separate projects (page: the
[if-startpage](https://github.com/if-faber/if-startpage) repository, last separate version v0.1.7.2).
Merged in v0.3.0: small mismatches when combining two projects required knowledge
and the terminal — as one whole they install correctly. Page change history (in Polish):
[strona/version-changelog.md](strona/version-changelog.md).

## License

MIT — see [LICENSE](LICENSE).
