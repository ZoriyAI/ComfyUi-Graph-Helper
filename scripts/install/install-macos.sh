#!/bin/bash
# NodeWise Studio: build the app from the project's own source and install it for the current Mac user.
#
#   curl -fsSL https://github.com/<owner>/<repository>/releases/latest/download/install-macos.sh -o install-macos.sh
#   bash install-macos.sh                 install or upgrade the latest release
#   bash install-macos.sh --uninstall     remove the app (asks before removing your data; default: keep)
#   bash install-macos.sh --dry-run       print every step and change nothing
#   bash install-macos.sh --help          all options
#
# Why it builds: there is no signed macOS package (no Apple certificate yet), so the app is built here from the
# source of a release tag, signed ad hoc for this Mac (Apple silicon runs only signed code) and installed in
# ~/Applications. Nothing needs administrator rights unless you ask for /Applications or a system-wide Node.js.
# What it touches, step by step, and every exit code: docs/wiki/start/Installing-On-macOS.md.
# Runs on macOS 13 or newer, Apple silicon or Intel, with the bash 3.2 that macOS ships. Started from zsh or sh,
# it runs itself again under bash.
# Checks: shellcheck -s bash (CI). SC2016: the single-quoted sh -c programs get their values as arguments, on
# purpose, so no path is ever parsed as code. SC2317: finish() and the helpers it calls run from the EXIT trap.
# shellcheck disable=SC2016,SC2317
if [ -z "${BASH_VERSION:-}" ]; then exec /bin/bash "$0" "$@"; fi
set -euo pipefail

# ---------------------------------------------------------------------------------------------------------------
# Fixed facts. The names match src/shared/productNames.ts and the address src/main/identity.ts PROJECT_URL
# (tests/unit/installScripts.test.ts compares them).
REPOSITORY='ZoriyAI/nodewise-studio'
APP_ID='nodewise-studio'
# Where a person reports a problem with this script.
ISSUES_URL="https://github.com/$REPOSITORY/issues"
DISPLAY_NAME='NodeWise Studio'
# The hosts this script downloads from; any other address is refused (fetch below).
ALLOWED_HOSTS='api.github.com codeload.github.com github.com nodejs.org registry.npmjs.org'
MIN_MACOS_MAJOR=13
# Free space needed: the build (sources, packages, Electron) and the installed app.
BUILD_SPACE_MB=3500
INSTALL_SPACE_MB=600

# Exit codes (the same numbers in install-windows.ps1; listed in the wiki's troubleshooting).
EXIT_OK=0
EXIT_UNEXPECTED=1
EXIT_USAGE=2
EXIT_SYSTEM=3
EXIT_DISK=4
EXIT_NETWORK=5
EXIT_PREREQUISITE=6
EXIT_DOWNLOAD=7
EXIT_BUILD=8
EXIT_INSTALL=9
EXIT_VERIFY=10
EXIT_RUNNING=11
EXIT_CANCELLED=12
EXIT_UNSUPPORTED_VERSION=13

# ---------------------------------------------------------------------------------------------------------------
# Options.
OPT_VERSION=''
OPT_MAIN=0
OPT_SOURCE=''
OPT_DRY_RUN=0
OPT_YES=0
OPT_UNINSTALL=0
OPT_PURGE_DATA=0
OPT_SYSTEM_APPS=0
OPT_SYSTEM_NODE=0
OPT_PRIVATE_NODE=0
OPT_KEEP_BUILD=0
OPT_LANG=''
OPT_PRETEND_MACOS=0
OPT_BUILD_DIR=''
OPT_LOG=''

usage() {
  cat <<'EOF'
NodeWise Studio installer for macOS

  bash install-macos.sh [options]

  --version <tag>         build this release tag (for example v1.0.0) instead of the latest release
  --main                  build the main branch (newest, untested code)
  --source <folder>       build from a folder that already holds the source (a checkout)
  --uninstall             remove the app; asks before removing your data (default: keep it)
  --purge-data            with --uninstall: also remove your data folder without asking
  --system-applications   install into /Applications instead of ~/Applications
  --system-node           install Node.js for the whole Mac (official .pkg) instead of a private copy
  --private-node          use a private copy of Node.js even when a fitting one is installed
  --yes                   answer yes to the questions about installing (never to removing your data)
  --dry-run               print every step and change nothing
  --keep-build            keep the build folder after a successful install
  --build-dir <folder>    where to build (default ~/Library/Caches/nodewise-studio-installer)
  --log <file>            where to write the log (default ~/Library/Logs/nodewise-studio-install.log)
  --lang en|ru            language of the messages (default: the system's)
  --help                  this text

Exit codes: 0 done, 1 unexpected error, 2 wrong option, 3 system not supported, 4 not enough disk space,
5 no connection, 6 a required tool is missing or was not installed, 7 download or check failed, 8 build failed,
9 install step failed, 10 the installed app did not pass its check, 11 the app is running, 12 cancelled,
13 this version cannot be installed by this script.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --version) [ $# -ge 2 ] || { echo "--version needs a tag" >&2; exit $EXIT_USAGE; }; OPT_VERSION=$2; shift ;;
    --version=*) OPT_VERSION=${1#*=} ;;
    --main) OPT_MAIN=1 ;;
    --source) [ $# -ge 2 ] || { echo "--source needs a folder" >&2; exit $EXIT_USAGE; }; OPT_SOURCE=$2; shift ;;
    --source=*) OPT_SOURCE=${1#*=} ;;
    --dry-run) OPT_DRY_RUN=1 ;;
    --yes|-y) OPT_YES=1 ;;
    --uninstall) OPT_UNINSTALL=1 ;;
    --purge-data) OPT_PURGE_DATA=1 ;;
    --system-applications) OPT_SYSTEM_APPS=1 ;;
    --system-node) OPT_SYSTEM_NODE=1 ;;
    --private-node) OPT_PRIVATE_NODE=1 ;;
    --keep-build) OPT_KEEP_BUILD=1 ;;
    --build-dir) [ $# -ge 2 ] || { echo "--build-dir needs a folder" >&2; exit $EXIT_USAGE; }; OPT_BUILD_DIR=$2; shift ;;
    --build-dir=*) OPT_BUILD_DIR=${1#*=} ;;
    --log) [ $# -ge 2 ] || { echo "--log needs a file" >&2; exit $EXIT_USAGE; }; OPT_LOG=$2; shift ;;
    --log=*) OPT_LOG=${1#*=} ;;
    --lang) [ $# -ge 2 ] || { echo "--lang needs en or ru" >&2; exit $EXIT_USAGE; }; OPT_LANG=$2; shift ;;
    --lang=*) OPT_LANG=${1#*=} ;;
    # A test switch: on another system, print the macOS plan of --dry-run (CI and Linux checks of this script).
    --pretend-macos) OPT_PRETEND_MACOS=1 ;;
    -h|--help) usage; exit $EXIT_OK ;;
    *) echo "Unknown option: $1 (try --help)" >&2; exit $EXIT_USAGE ;;
  esac
  shift
done

if [ "$OPT_MAIN" = 1 ] && [ -n "$OPT_VERSION" ]; then echo "--main and --version exclude each other" >&2; exit $EXIT_USAGE; fi
if [ -n "$OPT_SOURCE" ] && { [ "$OPT_MAIN" = 1 ] || [ -n "$OPT_VERSION" ]; }; then echo "--source excludes --main and --version" >&2; exit $EXIT_USAGE; fi
if [ "$OPT_PURGE_DATA" = 1 ] && [ "$OPT_UNINSTALL" = 0 ]; then echo "--purge-data works only with --uninstall" >&2; exit $EXIT_USAGE; fi
if [ "$OPT_PRETEND_MACOS" = 1 ] && [ "$OPT_DRY_RUN" = 0 ]; then echo "--pretend-macos works only with --dry-run" >&2; exit $EXIT_USAGE; fi
if [ -n "$OPT_VERSION" ] && ! printf '%s' "$OPT_VERSION" | grep -Eq '^v?[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$'; then
  echo "--version takes a release tag such as v1.0.0, not: $OPT_VERSION" >&2; exit $EXIT_USAGE
fi
if [ "$OPT_SYSTEM_NODE" = 1 ] && [ "$OPT_PRIVATE_NODE" = 1 ]; then echo "--system-node and --private-node exclude each other" >&2; exit $EXIT_USAGE; fi
case "$OPT_LANG" in ''|en|ru) ;; *) echo "--lang takes en or ru" >&2; exit $EXIT_USAGE ;; esac

# ---------------------------------------------------------------------------------------------------------------
# Language: --lang, else the first language of the Mac's settings, else the locale variables.
UI_LANG=en
if [ -n "$OPT_LANG" ]; then
  UI_LANG=$OPT_LANG
else
  first_language=$( (defaults read -g AppleLanguages 2>/dev/null || true) | tr -d ' "(),' | sed -n '2p')
  case "${first_language:-${LC_ALL:-${LANG:-}}}" in ru*) UI_LANG=ru ;; esac
fi

# One message in the chosen language. printf templates: %s are filled by the caller.
t() {
  case "$UI_LANG:$1" in
    en:start) echo "NodeWise Studio installer for macOS. Log: %s" ;;
    ru:start) echo "Установка NodeWise Studio для macOS. Журнал: %s" ;;
    en:untested) echo "This install script is checked on GitHub's macOS machines, not yet on a range of real Macs. If something goes wrong, please report it at %s with the log file named at the end and your macOS version." ;;
    ru:untested) echo "Этот скрипт установки проверяется на машинах GitHub с macOS, на разных настоящих Mac его ещё не пробовали. Если что-то пойдёт не так, сообщите, пожалуйста, на %s, приложив файл журнала, названный в конце, и версию macOS." ;;
    en:untested_failed) echo "This script is not yet tried on many real Macs, so this may be its own mistake. Please report it at %s with this log: %s, and your macOS version (Apple menu, About This Mac)." ;;
    ru:untested_failed) echo "Этот скрипт ещё мало пробовали на настоящих Mac, так что ошибка может быть в нём самом. Сообщите о ней, пожалуйста, на %s, приложив этот журнал: %s, и версию macOS (меню Apple, «Об этом Mac»)." ;;
    en:dry) echo "Dry run: every step is printed, nothing is changed." ;;
    ru:dry) echo "Пробный прогон: шаги только печатаются, ничего не меняется." ;;
    en:step) echo "Step %s of %s: %s" ;;
    ru:step) echo "Шаг %s из %s: %s" ;;
    en:s_check) echo "checking this Mac" ;;
    ru:s_check) echo "проверка компьютера" ;;
    en:s_source) echo "getting the source" ;;
    ru:s_source) echo "загрузка исходного кода" ;;
    en:s_tools) echo "tools for the build" ;;
    ru:s_tools) echo "инструменты для сборки" ;;
    en:s_build) echo "building the app (several minutes)" ;;
    ru:s_build) echo "сборка приложения (несколько минут)" ;;
    en:s_install) echo "installing" ;;
    ru:s_install) echo "установка" ;;
    en:s_verify) echo "checking the installed app" ;;
    ru:s_verify) echo "проверка установленного приложения" ;;
    en:not_mac) echo "This script is for macOS. On Linux install the .deb, .rpm, AppImage or .tar.gz from the release page; on Windows use install-windows.ps1." ;;
    ru:not_mac) echo "Этот скрипт для macOS. На Linux установите .deb, .rpm, AppImage или .tar.gz со страницы выпуска; на Windows запустите install-windows.ps1." ;;
    en:old_mac) echo "macOS %s is too old: the app needs macOS %s or newer." ;;
    ru:old_mac) echo "macOS %s слишком старая: приложению нужна macOS %s или новее." ;;
    en:bad_arch) echo "This processor (%s) is not supported: Apple silicon (arm64) or Intel (x86_64) only." ;;
    ru:bad_arch) echo "Этот процессор (%s) не поддерживается: только Apple silicon (arm64) или Intel (x86_64)." ;;
    en:root) echo "Do not run this script with sudo: it installs for your own user and asks for a password only when it must." ;;
    ru:root) echo "Не запускайте скрипт через sudo: он ставит приложение для вашего пользователя и сам спросит пароль, если понадобится." ;;
    en:system) echo "macOS %s, %s, free space for the build %s MB, for the app %s MB." ;;
    ru:system) echo "macOS %s, %s, свободно для сборки %s МБ, для приложения %s МБ." ;;
    en:no_space) echo "Not enough free space in %s: %s MB free, %s MB needed. Free some space or choose another folder with --build-dir." ;;
    ru:no_space) echo "Мало места в %s: свободно %s МБ, нужно %s МБ. Освободите место или выберите другую папку через --build-dir." ;;
    en:proxy) echo "A proxy is set in the environment (%s); downloads go through it." ;;
    ru:proxy) echo "В окружении задан прокси (%s); загрузки идут через него." ;;
    en:no_net) echo "%s cannot be reached. Check the internet connection (or the proxy settings) and run the script again." ;;
    ru:no_net) echo "Нет связи с %s. Проверьте подключение к интернету (или настройки прокси) и запустите скрипт снова." ;;
    en:net_ok) echo "Connection to GitHub, nodejs.org and the npm registry: fine." ;;
    ru:net_ok) echo "Связь с GitHub, nodejs.org и реестром npm есть." ;;
    en:running) echo "NodeWise Studio is running from %s. Quit it (NodeWise Studio menu, Quit) and run the script again." ;;
    ru:running) echo "NodeWise Studio запущено из %s. Закройте его (меню NodeWise Studio, Выйти) и запустите скрипт снова." ;;
    en:latest) echo "Latest release: %s." ;;
    ru:latest) echo "Последний выпуск: %s." ;;
    en:no_latest) echo "GitHub did not say which release is the latest. Name one: bash install-macos.sh --version v1.0.0" ;;
    ru:no_latest) echo "GitHub не ответил, какой выпуск последний. Укажите его сами: bash install-macos.sh --version v1.0.0" ;;
    en:source_from) echo "Source: %s" ;;
    ru:source_from) echo "Исходный код: %s" ;;
    en:download_failed) echo "The download of %s failed. The log says why: %s" ;;
    ru:download_failed) echo "Не удалось скачать %s. Причина в журнале: %s" ;;
    en:not_ours) echo "The downloaded source is not NodeWise Studio (%s). Nothing was installed." ;;
    ru:not_ours) echo "Скачанный код не похож на NodeWise Studio (%s). Ничего не установлено." ;;
    en:too_old_version) echo "Version %s cannot be installed with this script: only versions that ship install-macos.sh can. Choose a newer one with --version." ;;
    ru:too_old_version) echo "Версию %s этим скриптом не установить: только версии, в которых есть install-macos.sh. Выберите более новую через --version." ;;
    en:tools) echo "Build tools: Node.js %s, npm %s (%s)." ;;
    ru:tools) echo "Инструменты сборки: Node.js %s, npm %s (%s)." ;;
    en:node_found) echo "Node.js %s found at %s; it is used for the build." ;;
    ru:node_found) echo "Найден Node.js %s (%s); сборка пойдёт с ним." ;;
    en:node_private) echo "Node.js %s is needed only for the build. A private copy goes into the build folder; your Mac is not changed." ;;
    ru:node_private) echo "Node.js %s нужен только для сборки. Его отдельная копия ляжет в папку сборки; система не меняется." ;;
    en:node_other) echo "Node.js %s is on this Mac, but the build needs version %s. Yours stays as it is." ;;
    ru:node_other) echo "На компьютере есть Node.js %s, а сборке нужна версия %s. Ваш Node.js останется как есть." ;;
    en:ask_node_pkg) echo "Install Node.js %s for the whole Mac from nodejs.org (asks for your password)?" ;;
    ru:ask_node_pkg) echo "Установить Node.js %s для всего компьютера с nodejs.org (спросит пароль)?" ;;
    en:checksum_ok) echo "Checksum of %s: matches nodejs.org." ;;
    ru:checksum_ok) echo "Контрольная сумма %s совпадает с nodejs.org." ;;
    en:checksum_bad) echo "The checksum of %s does not match nodejs.org. The file was deleted; nothing was installed." ;;
    ru:checksum_bad) echo "Контрольная сумма %s не совпадает с nodejs.org. Файл удалён, ничего не установлено." ;;
    en:pkg_signature_bad) echo "The Node.js installer is not signed by the Node.js project. It was deleted; nothing was installed." ;;
    ru:pkg_signature_bad) echo "Установщик Node.js не подписан проектом Node.js. Он удалён, ничего не установлено." ;;
    en:prebuilt_ok) echo "Database module: the ready-made file for %s is used; nothing is compiled." ;;
    ru:prebuilt_ok) echo "Модуль базы данных: используется готовый файл для %s, компилировать ничего не нужно." ;;
    en:needs_compile) echo "No ready-made database module for %s: it must be compiled, which needs Apple's Command Line Tools." ;;
    ru:needs_compile) echo "Нет готового модуля базы данных для %s: его нужно скомпилировать, а для этого нужны Command Line Tools от Apple." ;;
    en:ask_clt) echo "Install Apple's Command Line Tools now? A system window opens; the script waits until they are installed." ;;
    ru:ask_clt) echo "Установить Command Line Tools от Apple? Откроется системное окно; скрипт подождёт окончания установки." ;;
    en:wait_clt) echo "Waiting for the Command Line Tools (finish the install in the system window)..." ;;
    ru:wait_clt) echo "Ждём Command Line Tools (закончите установку в системном окне)..." ;;
    en:declined) echo "Nothing was installed: %s is needed for the build. Run the script again when you are ready." ;;
    ru:declined) echo "Ничего не установлено: для сборки нужен %s. Запустите скрипт снова, когда будете готовы." ;;
    en:build_failed) echo "The build failed at: %s. The last lines of the log are above; the whole log: %s" ;;
    ru:build_failed) echo "Сборка остановилась на шаге: %s. Последние строки журнала выше; весь журнал: %s" ;;
    en:installing_to) echo "Installing into %s" ;;
    ru:installing_to) echo "Установка в %s" ;;
    en:upgrade) echo "Replacing version %s with %s; your data stays where it is." ;;
    ru:upgrade) echo "Версия %s заменяется на %s; ваши данные остаются на месте." ;;
    en:no_apps_write) echo "%s cannot be written by your user. Run without --system-applications to install into ~/Applications." ;;
    ru:no_apps_write) echo "В %s нельзя записывать от вашего пользователя. Запустите без --system-applications, чтобы поставить в ~/Applications." ;;
    en:install_failed) echo "Installing failed at: %s. The previous version, if there was one, is unchanged. Log: %s" ;;
    ru:install_failed) echo "Установка остановилась на шаге: %s. Прежняя версия, если была, не тронута. Журнал: %s" ;;
    en:verify_failed) echo "The installed app did not pass its check (%s). Log: %s" ;;
    ru:verify_failed) echo "Установленное приложение не прошло проверку (%s). Журнал: %s" ;;
    en:finished) echo "Done. NodeWise Studio %s is installed." ;;
    en:dry_finished) echo "Dry run finished: the steps above would install NodeWise Studio %s. Nothing was changed." ;;
    ru:dry_finished) echo "Пробный прогон закончен: шаги выше установили бы NodeWise Studio %s. Ничего не изменено." ;;
    ru:finished) echo "Готово. NodeWise Studio %s установлено." ;;
    en:where) echo "App:          %s" ;;
    ru:where) echo "Приложение:   %s" ;;
    en:data) echo "Your data:    %s" ;;
    ru:data) echo "Ваши данные:  %s" ;;
    en:how_start) echo "Start it:     Launchpad or Finder (%s), or: open -a \"NodeWise Studio\"" ;;
    ru:how_start) echo "Запуск:       Launchpad или Finder (%s), или: open -a \"NodeWise Studio\"" ;;
    en:how_remove) echo "Remove it:    bash \"%s\" --uninstall" ;;
    ru:how_remove) echo "Удаление:     bash \"%s\" --uninstall" ;;
    en:log_at) echo "Log:          %s" ;;
    ru:log_at) echo "Журнал:       %s" ;;
    en:keychain_note) echo "After an upgrade macOS may ask once whether NodeWise Studio may use \"nodewise-studio Safe Storage\" in your keychain: enter your password and choose Always Allow." ;;
    ru:keychain_note) echo "После обновления macOS может один раз спросить, можно ли NodeWise Studio пользоваться «nodewise-studio Safe Storage» в связке ключей: введите пароль и выберите «Разрешать всегда»." ;;
    en:nothing_installed) echo "NodeWise Studio is not installed in ~/Applications or /Applications." ;;
    ru:nothing_installed) echo "NodeWise Studio не найдено ни в ~/Applications, ни в /Applications." ;;
    en:removed) echo "Removed: %s" ;;
    ru:removed) echo "Удалено: %s" ;;
    en:ask_data) echo "Also remove your data (settings, keys, projects, conversations) in %s?" ;;
    ru:ask_data) echo "Удалить и ваши данные (настройки, ключи, проекты, разговоры) в %s?" ;;
    en:data_kept) echo "Your data is kept in %s (to remove it later: --uninstall --purge-data)." ;;
    ru:data_kept) echo "Ваши данные остались в %s (удалить позже: --uninstall --purge-data)." ;;
    en:uninstalled) echo "NodeWise Studio is removed." ;;
    en:dry_uninstalled) echo "Dry run finished: the steps above would remove NodeWise Studio. Nothing was changed." ;;
    ru:dry_uninstalled) echo "Пробный прогон закончен: шаги выше удалили бы NodeWise Studio. Ничего не изменено." ;;
    ru:uninstalled) echo "NodeWise Studio удалено." ;;
    en:cancelled) echo "Cancelled. Nothing more was changed." ;;
    ru:cancelled) echo "Отменено. Больше ничего не менялось." ;;
    en:unexpected) echo "Something unexpected failed. The log says what: %s" ;;
    ru:unexpected) echo "Что-то пошло не так. Подробности в журнале: %s" ;;
    en:yes_no) echo "[y/N]" ;;
    ru:yes_no) echo "[д/Н]" ;;
    *) echo "$1" ;;
  esac
}

# ---------------------------------------------------------------------------------------------------------------
# Output and the log. The terminal gets short lines; the log gets everything, commands' output included.
LOG=${OPT_LOG:-$HOME/Library/Logs/nodewise-studio-install.log}
if [ "$OPT_DRY_RUN" = 1 ] && [ -z "$OPT_LOG" ]; then LOG="${TMPDIR:-/tmp}/nodewise-studio-install-dry-run.log"; fi
mkdir -p "$(dirname "$LOG")"
: > "$LOG"
chmod 600 "$LOG" 2>/dev/null || true

log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG"; }
# say KEY [ARGS...]: the message in the chosen language, on the terminal and in the log.
say() {
  local key=$1; shift
  local text
  # shellcheck disable=SC2059 # the template comes from t(), never from outside
  text=$(printf "$(t "$key")" "$@")
  printf '%s\n' "$text"
  log "$text"
}
warn() {
  local key=$1; shift
  local text
  # shellcheck disable=SC2059
  text=$(printf "$(t "$key")" "$@")
  printf '%s\n' "$text" >&2
  log "WARNING $text"
}

DIED=0
FAIL_CODE=$EXIT_UNEXPECTED
FAIL_KEY=unexpected
CURRENT_ACTION=''
# die CODE KEY [ARGS...]: say why, then leave with CODE.
die() {
  local code=$1; shift
  local key=$1; shift
  local text
  # shellcheck disable=SC2059
  text=$(printf "$(t "$key")" "$@")
  printf '%s\n' "$text" >&2
  log "FAILED($code) $text"
  DIED=1
  exit "$code"
}

# On any failure that die() did not report (a command that failed under set -e), say which phase failed and use that
# phase's exit code; then always name the log.
finish() {
  local status=$1
  trap - EXIT
  if [ "$status" != 0 ] && [ "$DIED" = 0 ]; then
    log "FAILED command status=$status during: $CURRENT_ACTION"
    if [ -f "$LOG" ]; then echo '--- last lines of the log ---' >&2; tail -n 60 "$LOG" >&2 || true; fi
    case "$FAIL_KEY" in
      build_failed|install_failed|verify_failed) warn "$FAIL_KEY" "$CURRENT_ACTION" "$LOG" ;;
      *) warn unexpected "$LOG" ;;
    esac
    status=$FAIL_CODE
  fi
  # shellcheck disable=SC2059 # the template comes from t()
  [ "$status" = 0 ] || printf '%s\n' "$(printf "$(t log_at)" "$LOG")" >&2
  # A failure of the script itself (not a refusal such as a busy app or a full disk): ask for a report.
  case "$status" in "$EXIT_UNEXPECTED"|"$EXIT_PREREQUISITE"|"$EXIT_DOWNLOAD"|"$EXIT_BUILD"|"$EXIT_INSTALL"|"$EXIT_VERIFY") warn untested_failed "$ISSUES_URL" "$LOG" ;; esac
  log "EXIT $status"
  exit "$status"
}
trap 'finish $?' EXIT
trap 'DIED=1; log "interrupted"; exit $EXIT_CANCELLED' INT TERM

# phase CODE KEY: what a failing command in the steps that follow means.
phase() { FAIL_CODE=$1; FAIL_KEY=$2; }

STEP=0
STEPS=6
step() { STEP=$((STEP + 1)); say step "$STEP" "$STEPS" "$(t "$1")"; }

# act DESCRIPTION -- COMMAND...: run a command that changes something, with its output in the log; in a dry run,
# only print it.
act() {
  local description=$1; shift
  [ "$1" = '--' ] && shift
  CURRENT_ACTION=$description
  if [ "$OPT_DRY_RUN" = 1 ]; then
    printf '  DRY-RUN %s:' "$description"; printf ' %q' "$@"; printf '\n'
    log "DRY-RUN $description: $*"
    return 0
  fi
  log "RUN $description: $*"
  "$@" >> "$LOG" 2>&1
}

# ask KEY [ARGS...]: a yes/no question, asked once on the terminal; --yes answers yes, no terminal answers no.
ask() {
  local key=$1; shift
  local question answer
  # shellcheck disable=SC2059
  question=$(printf "$(t "$key")" "$@")
  log "ASK $question"
  if [ "$OPT_YES" = 1 ]; then log 'ANSWER yes (--yes)'; return 0; fi
  if [ "$OPT_DRY_RUN" = 1 ]; then printf '  DRY-RUN would ask: %s\n' "$question"; return 0; fi
  if ! { : < /dev/tty; } 2>/dev/null; then log 'ANSWER no (no terminal)'; return 1; fi
  printf '%s %s ' "$question" "$(t yes_no)" > /dev/tty
  read -r answer < /dev/tty || answer=''
  log "ANSWER $answer"
  case "$answer" in y|Y|yes|Yes|д|Д|да|Да) return 0 ;; *) return 1 ;; esac
}

# A proxy address without its user and password, for the log and the screen.
redact_proxy() { printf '%s' "$1" | sed -E 's#(://)[^@/]*@#\1***@#'; }

# fetch URL FILE: an HTTPS download from one of ALLOWED_HOSTS only, redirects kept on HTTPS. curl reads the proxy
# from https_proxy / HTTPS_PROXY / no_proxy itself.
fetch() {
  local url=$1 out=$2 host
  host=$(printf '%s' "$url" | sed -E 's#^https://([^/:]+).*#\1#')
  case "$url" in https://*) ;; *) log "REFUSED non-HTTPS $url"; return 1 ;; esac
  case " $ALLOWED_HOSTS " in *" $host "*) ;; *) log "REFUSED host $host"; return 1 ;; esac
  log "GET $url"
  # A GitHub token in the environment (CI) lifts the API's limit for anonymous calls; it goes to the API host only
  # and never into the log.
  if [ "$host" = api.github.com ] && [ -n "${GITHUB_TOKEN:-}" ]; then
    curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --tlsv1.2 --max-redirs 5 \
      --retry 3 --retry-delay 2 --connect-timeout 20 -H "Authorization: Bearer $GITHUB_TOKEN" -o "$out" "$url" 2>> "$LOG"
  else
    curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --tlsv1.2 --max-redirs 5 \
      --retry 3 --retry-delay 2 --connect-timeout 20 -o "$out" "$url" 2>> "$LOG"
  fi
}

# latest_tag_from_page: the tag the release page github.com/<repository>/releases/latest redirects to. The fallback
# when the API answers nothing (its limit for anonymous calls is low on shared networks).
latest_tag_from_page() {
  curl --silent --show-error --head --proto '=https' --tlsv1.2 --max-time 30 "https://github.com/$REPOSITORY/releases/latest" 2>> "$LOG" \
    | tr -d '\r' | sed -nE 's#^[Ll]ocation: https://github\.com/[^/]+/[^/]+/releases/tag/([^/ ]+)$#\1#p' | sed -n 1p
}

# reachable URL: whether HTTPS to this address answers at all (any HTTP status counts).
reachable() {
  curl --silent --output /dev/null --proto '=https' --tlsv1.2 --max-time 20 --head "$1" 2>> "$LOG"
}

# Folder sizes in MB free, for the nearest existing folder above PATH.
free_mb() {
  local dir=$1
  while [ ! -d "$dir" ]; do dir=$(dirname "$dir"); done
  df -Pk "$dir" | awk 'NR==2 {print int($4/1024)}'
}

# version_major "v22.11.0" -> 22
version_major() { printf '%s' "$1" | sed -E 's/^v?([0-9]+).*/\1/'; }

# ---------------------------------------------------------------------------------------------------------------
# Where things go.
IS_MAC=0
[ "$(uname -s)" = Darwin ] && IS_MAC=1
INSTALLER_HOME="$HOME/Library/Application Support/$APP_ID-installer"
# This script's own path, for the copy kept beside the app (empty when it was not started from a file).
SELF=''
if [ -f "$0" ]; then SELF="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"; fi
DATA_DIR="$HOME/Library/Application Support/$APP_ID"
BUILD_DIR=${OPT_BUILD_DIR:-$HOME/Library/Caches/$APP_ID-installer}
WORK_DIR="$BUILD_DIR/work"
if [ "$OPT_SYSTEM_APPS" = 1 ]; then APPS_DIR=/Applications; else APPS_DIR="$HOME/Applications"; fi
APP_PATH="$APPS_DIR/$DISPLAY_NAME.app"
APP_EXE="$APP_PATH/Contents/MacOS/$APP_ID"

say start "$LOG"
say untested "$ISSUES_URL"
[ "$OPT_DRY_RUN" = 1 ] && say dry
log "script=$0 args: version=$OPT_VERSION main=$OPT_MAIN source=$OPT_SOURCE uninstall=$OPT_UNINSTALL yes=$OPT_YES system-apps=$OPT_SYSTEM_APPS system-node=$OPT_SYSTEM_NODE lang=$UI_LANG"
log "home=$HOME build=$BUILD_DIR apps=$APPS_DIR"

if [ "$IS_MAC" = 0 ] && [ "$OPT_PRETEND_MACOS" = 0 ]; then die $EXIT_SYSTEM not_mac; fi
# Under --pretend-macos (a dry run on a test machine, often a root container) the check would stop the plan.
if [ "$(id -u)" = 0 ] && [ "$OPT_PRETEND_MACOS" = 0 ]; then die $EXIT_SYSTEM root; fi

# Whether the installed app (in either Applications folder) is running.
running_app() {
  local candidate
  for candidate in "$HOME/Applications/$DISPLAY_NAME.app" "/Applications/$DISPLAY_NAME.app"; do
    if pgrep -f "$candidate/Contents/MacOS/" >/dev/null 2>&1; then printf '%s' "$candidate"; return 0; fi
  done
  return 1
}

# ---------------------------------------------------------------------------------------------------------------
# --uninstall: the app, the installer's own folder and build folder; the data folder only when the person agrees.
uninstall() {
  local found=0 candidate running
  if running=$(running_app); then die $EXIT_RUNNING running "$running"; fi
  phase $EXIT_INSTALL install_failed
  for candidate in "$HOME/Applications/$DISPLAY_NAME.app" "/Applications/$DISPLAY_NAME.app"; do
    if [ -d "$candidate" ]; then
      found=1
      act "remove the app" -- rm -rf "$candidate"
      say removed "$candidate"
    fi
  done
  [ "$found" = 1 ] || say nothing_installed
  if [ -d "$INSTALLER_HOME" ]; then act "remove the installer's folder" -- rm -rf "$INSTALLER_HOME"; say removed "$INSTALLER_HOME"; fi
  if [ -d "$BUILD_DIR" ]; then act "remove the build folder" -- rm -rf "$BUILD_DIR"; say removed "$BUILD_DIR"; fi
  local remove_data=0
  if [ -d "$DATA_DIR" ]; then
    if [ "$OPT_PURGE_DATA" = 1 ]; then
      remove_data=1
    elif [ "$OPT_DRY_RUN" = 0 ] && [ "$OPT_YES" = 0 ]; then
      # Asked even when other questions were answered with --yes: removing data is never the default.
      if ask ask_data "$DATA_DIR"; then remove_data=1; fi
    fi
    if [ "$remove_data" = 1 ]; then
      act "remove the data folder" -- rm -rf "$DATA_DIR"
      # Electron's other per-app files on macOS, named after the bundle id it gives an unsigned build.
      for candidate in "$HOME/Library/Preferences/com.electron.$APP_ID.plist" "$HOME/Library/Saved Application State/com.electron.$APP_ID.savedState"; do
        if [ -e "$candidate" ]; then act "remove $candidate" -- rm -rf "$candidate"; fi
      done
      # The Keychain item that encrypted the saved keys; best effort (its name is Electron's "<app> Safe Storage").
      act "remove the keychain item" -- sh -c "security delete-generic-password -s '$APP_ID Safe Storage' >/dev/null 2>&1 || true"
      say removed "$DATA_DIR"
    else
      say data_kept "$DATA_DIR"
    fi
  fi
  if [ "$OPT_DRY_RUN" = 1 ]; then say dry_uninstalled; else say uninstalled; fi
  exit $EXIT_OK
}

if [ "$OPT_UNINSTALL" = 1 ]; then uninstall; fi

# ---------------------------------------------------------------------------------------------------------------
# Step 1: this Mac.
step s_check
phase $EXIT_SYSTEM unexpected
if [ "$IS_MAC" = 1 ]; then
  MACOS_VERSION=$(sw_vers -productVersion)
  ARCH=$(uname -m)
  # A Terminal running under Rosetta reports x86_64 on Apple silicon; build for the real processor.
  if [ "$ARCH" = x86_64 ] && [ "$(sysctl -in sysctl.proc_translated 2>/dev/null || echo 0)" = 1 ]; then ARCH=arm64; fi
else
  MACOS_VERSION='14.0 (pretended)'
  ARCH=arm64
fi
case "$ARCH" in arm64) ELECTRON_ARCH=arm64 ;; x86_64) ELECTRON_ARCH=x64 ;; *) die $EXIT_SYSTEM bad_arch "$ARCH" ;; esac
if [ "$(version_major "$MACOS_VERSION")" -lt "$MIN_MACOS_MAJOR" ]; then die $EXIT_SYSTEM old_mac "$MACOS_VERSION" "$MIN_MACOS_MAJOR"; fi
BUILD_FREE=$(free_mb "$BUILD_DIR")
APPS_FREE=$(free_mb "$APPS_DIR")
say system "$MACOS_VERSION" "$ARCH" "$BUILD_FREE" "$APPS_FREE"
[ "$BUILD_FREE" -ge "$BUILD_SPACE_MB" ] || die $EXIT_DISK no_space "$BUILD_DIR" "$BUILD_FREE" "$BUILD_SPACE_MB"
[ "$APPS_FREE" -ge "$INSTALL_SPACE_MB" ] || die $EXIT_DISK no_space "$APPS_DIR" "$APPS_FREE" "$INSTALL_SPACE_MB"
if [ "$OPT_SYSTEM_APPS" = 1 ] && [ ! -w /Applications ]; then die $EXIT_INSTALL no_apps_write /Applications; fi
PROXY=${https_proxy:-${HTTPS_PROXY:-${all_proxy:-${ALL_PROXY:-}}}}
if [ -n "$PROXY" ]; then say proxy "$(redact_proxy "$PROXY")"; fi
for site in https://github.com https://api.github.com https://registry.npmjs.org https://nodejs.org; do
  reachable "$site" || die $EXIT_NETWORK no_net "$site"
done
say net_ok
if running=$(running_app); then die $EXIT_RUNNING running "$running"; fi

# ---------------------------------------------------------------------------------------------------------------
# Step 2: the source, into a private build folder.
step s_source
phase $EXIT_DOWNLOAD unexpected
SRC="$WORK_DIR/src"
if [ "$OPT_DRY_RUN" = 0 ]; then
  rm -rf "$WORK_DIR"
  mkdir -p "$WORK_DIR"
  chmod 700 "$BUILD_DIR" "$WORK_DIR"
fi
if [ -n "$OPT_SOURCE" ]; then
  [ -f "$OPT_SOURCE/package.json" ] || die $EXIT_USAGE not_ours "--source $OPT_SOURCE: no package.json"
  OPT_SOURCE=$(cd "$OPT_SOURCE" && pwd)
  SOURCE_LABEL="folder $OPT_SOURCE"
  say source_from "$SOURCE_LABEL"
  # A copy without what a checkout may hold from earlier builds, so the build starts clean.
  act "copy the source folder" -- sh -c 'mkdir -p "$2" && cd "$1" && tar -cf - --exclude ./node_modules --exclude ./out --exclude ./dist --exclude ./.git . | (cd "$2" && tar -xf -)' sh "$OPT_SOURCE" "$SRC"
  CHECK_DIR=$OPT_SOURCE
else
  if [ "$OPT_MAIN" = 1 ]; then
    REF=heads/main
    TAG=main
  elif [ -n "$OPT_VERSION" ]; then
    TAG=$OPT_VERSION
    case "$TAG" in v*) ;; *) TAG="v$TAG" ;; esac
    REF="tags/$TAG"
  else
    latest_file="${TMPDIR:-/tmp}/nodewise-latest.$$.json"
    if fetch "https://api.github.com/repos/$REPOSITORY/releases/latest" "$latest_file"; then
      TAG=$(sed -nE 's/^ *"tag_name": *"([^"]+)".*/\1/p' "$latest_file" | sed -n 1p)
    else
      TAG=''
    fi
    rm -f "$latest_file"
    if [ -z "$TAG" ]; then
      log 'the API named no latest release; asking the release page'
      TAG=$(latest_tag_from_page || true)
    fi
    if ! printf '%s' "$TAG" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$'; then die $EXIT_DOWNLOAD no_latest; fi
    say latest "$TAG"
    REF="tags/$TAG"
  fi
  ARCHIVE_URL="https://codeload.github.com/$REPOSITORY/tar.gz/refs/$REF"
  SOURCE_LABEL="$REPOSITORY $TAG"
  say source_from "$ARCHIVE_URL"
  ARCHIVE="$WORK_DIR/source.tar.gz"
  if [ "$OPT_DRY_RUN" = 1 ]; then
    act "download the source archive" -- curl -o "$ARCHIVE" "$ARCHIVE_URL"
    act "unpack it" -- tar -xzf "$ARCHIVE" -C "$SRC" --strip-components 1
  else
    fetch "$ARCHIVE_URL" "$ARCHIVE" || die $EXIT_DOWNLOAD download_failed "$ARCHIVE_URL" "$LOG"
    log "source archive sha256 $(shasum -a 256 "$ARCHIVE" | cut -d ' ' -f 1) bytes $(wc -c < "$ARCHIVE" | tr -d ' ')"
    # GitHub names the archive's top folder after the repository: a first check that this is the expected project.
    top=$(tar -tzf "$ARCHIVE" | sed -n 1p | cut -d / -f 1)
    case "$top" in "${REPOSITORY#*/}"-*) ;; *) die $EXIT_DOWNLOAD not_ours "top folder $top" ;; esac
    mkdir -p "$SRC"
    tar -xzf "$ARCHIVE" -C "$SRC" --strip-components 1
    rm -f "$ARCHIVE"
  fi
  CHECK_DIR=$SRC
fi

# The project it must be: its package names, and (for a tag) the version the tag names.
if [ "$OPT_DRY_RUN" = 0 ] || [ -n "$OPT_SOURCE" ]; then
  pkg_name=$(sed -nE 's/^  "name": "([^"]+)".*/\1/p' "$CHECK_DIR/package.json" | sed -n 1p)
  pkg_product=$(sed -nE 's/^  "productName": "([^"]+)".*/\1/p' "$CHECK_DIR/package.json" | sed -n 1p)
  PKG_VERSION=$(sed -nE 's/^  "version": "([^"]+)".*/\1/p' "$CHECK_DIR/package.json" | sed -n 1p)
  log "package name=$pkg_name productName=$pkg_product version=$PKG_VERSION"
  # First whether this version knows this installer at all: a release from before the scripts (0.9 still had the
  # app's old name in package.json) is "too old" (13), not "someone else's code" (7). Nothing is built either way.
  [ -f "$CHECK_DIR/scripts/install/install-macos.sh" ] || die $EXIT_UNSUPPORTED_VERSION too_old_version "${TAG:-$PKG_VERSION} (package.json name=$pkg_name)"
  if [ "$pkg_name" != "$APP_ID" ] || [ "$pkg_product" != "$DISPLAY_NAME" ]; then die $EXIT_DOWNLOAD not_ours "package.json name=$pkg_name"; fi
  if [ -n "${TAG:-}" ] && [ "$TAG" != main ] && [ "v$PKG_VERSION" != "$TAG" ]; then die $EXIT_DOWNLOAD not_ours "tag $TAG, package version $PKG_VERSION"; fi
  NODE_MAJOR=$(tr -d ' \nv' < "$CHECK_DIR/.nvmrc" 2>/dev/null | cut -d . -f 1 || true)
  [ -n "$NODE_MAJOR" ] || NODE_MAJOR=$(sed -nE 's/^ *"node": ">=([0-9]+).*/\1/p' "$CHECK_DIR/package.json" | sed -n 1p)
else
  PKG_VERSION="${TAG#v}"
  NODE_MAJOR=22
  log "dry run: the Node.js version comes from the downloaded .nvmrc; 22 is assumed for the plan"
fi
[ -n "$NODE_MAJOR" ] || die $EXIT_DOWNLOAD not_ours "no .nvmrc and no engines.node"
log "node major required: $NODE_MAJOR"

# ---------------------------------------------------------------------------------------------------------------
# Step 3: Node.js of the required major version: one already on this Mac, else a private copy (or, with
# --system-node, the official installer for the whole Mac).
step s_tools
phase $EXIT_PREREQUISITE declined
NODE_BIN=''
node_version_of() { "$1" --version 2>/dev/null || true; }
# With --private-node only the copy in the build folder counts (it is fetched below when missing).
for candidate in "$(command -v node 2>/dev/null || true)" \
  "$BUILD_DIR/node/bin/node" \
  "/opt/homebrew/opt/node@$NODE_MAJOR/bin/node" "/usr/local/opt/node@$NODE_MAJOR/bin/node" \
  /opt/homebrew/bin/node /usr/local/bin/node \
  "${NVM_DIR:-$HOME/.nvm}"/versions/node/v"$NODE_MAJOR".*/bin/node \
  "${FNM_DIR:-$HOME/Library/Application Support/fnm}"/node-versions/v"$NODE_MAJOR".*/installation/bin/node; do
  if [ -z "$candidate" ] || [ ! -x "$candidate" ]; then continue; fi
  if [ "$OPT_PRIVATE_NODE" = 1 ] && [ "$candidate" != "$BUILD_DIR/node/bin/node" ]; then continue; fi
  found_version=$(node_version_of "$candidate")
  log "node candidate $candidate $found_version"
  if [ "$(version_major "$found_version")" = "$NODE_MAJOR" ]; then NODE_BIN=$candidate; break; fi
done
if [ -n "$NODE_BIN" ]; then
  say node_found "$(node_version_of "$NODE_BIN")" "$NODE_BIN"
else
  system_node=$(command -v node 2>/dev/null || true)
  if [ -n "$system_node" ] && [ "$(version_major "$(node_version_of "$system_node")")" != "$NODE_MAJOR" ]; then
    say node_other "$(node_version_of "$system_node")" "$NODE_MAJOR"
  fi
  NODE_DIST="https://nodejs.org/dist/latest-v$NODE_MAJOR.x"
  SUMS="$BUILD_DIR/SHASUMS256.txt"
  if [ "$OPT_DRY_RUN" = 0 ]; then
    mkdir -p "$BUILD_DIR"
    fetch "$NODE_DIST/SHASUMS256.txt" "$SUMS" || die $EXIT_DOWNLOAD download_failed "$NODE_DIST/SHASUMS256.txt" "$LOG"
  fi
  # verified_download NAME: the file NAME from nodejs.org, kept only when its SHA-256 matches SHASUMS256.txt.
  verified_download() {
    local name=$1 want got
    want=$(awk -v n="$name" '$2 == n {print $1}' "$SUMS")
    [ -n "$want" ] || die $EXIT_DOWNLOAD download_failed "$NODE_DIST/$name" "$LOG"
    fetch "$NODE_DIST/$name" "$BUILD_DIR/$name" || die $EXIT_DOWNLOAD download_failed "$NODE_DIST/$name" "$LOG"
    got=$(shasum -a 256 "$BUILD_DIR/$name" | cut -d ' ' -f 1)
    log "sha256 $name want=$want got=$got"
    if [ "$got" != "$want" ]; then rm -f "$BUILD_DIR/$name"; die $EXIT_DOWNLOAD checksum_bad "$name"; fi
    say checksum_ok "$name"
  }
  if [ "$OPT_SYSTEM_NODE" = 1 ]; then
    ask ask_node_pkg "$NODE_MAJOR" || die $EXIT_PREREQUISITE declined "Node.js $NODE_MAJOR"
    if [ "$OPT_DRY_RUN" = 1 ]; then
      act "download the Node.js installer and check its checksum and signature" -- curl -o node.pkg "$NODE_DIST/node-v$NODE_MAJOR.x.pkg"
      act "install Node.js for the whole Mac" -- sudo installer -pkg node.pkg -target /
    else
      pkg=$(awk '$2 ~ /^node-v[0-9.]+\.pkg$/ {print $2}' "$SUMS" | sed -n 1p)
      verified_download "$pkg"
      # The official .pkg is signed by the Node.js project with an Apple Developer ID; pkgutil checks the chain.
      signature=$(pkgutil --check-signature "$BUILD_DIR/$pkg" 2>&1 || echo 'pkgutil-failed')
      log "pkgutil: $signature"
      case "$signature" in
        *pkgutil-failed*) rm -f "$BUILD_DIR/$pkg"; die $EXIT_DOWNLOAD pkg_signature_bad ;;
        *'Developer ID Installer: Node.js Foundation'*|*'Developer ID Installer: OpenJS Foundation'*) ;;
        *) rm -f "$BUILD_DIR/$pkg"; die $EXIT_DOWNLOAD pkg_signature_bad ;;
      esac
      act "install Node.js for the whole Mac" -- sudo installer -pkg "$BUILD_DIR/$pkg" -target /
      rm -f "$BUILD_DIR/$pkg"
    fi
    NODE_BIN=/usr/local/bin/node
  else
    say node_private "$NODE_MAJOR"
    if [ "$OPT_DRY_RUN" = 1 ]; then
      act "download Node.js $NODE_MAJOR for $ELECTRON_ARCH and check its checksum" -- curl -o node.tar.gz "$NODE_DIST/node-v$NODE_MAJOR.x-darwin-$ELECTRON_ARCH.tar.gz"
      act "unpack it into the build folder" -- tar -xzf node.tar.gz -C "$BUILD_DIR/node" --strip-components 1
    else
      tarball=$(awk -v a="darwin-$ELECTRON_ARCH.tar.gz" '$2 ~ ("^node-v[0-9.]+-" a "$") {print $2}' "$SUMS" | sed -n 1p)
      verified_download "$tarball"
      rm -rf "$BUILD_DIR/node"
      mkdir -p "$BUILD_DIR/node"
      tar -xzf "$BUILD_DIR/$tarball" -C "$BUILD_DIR/node" --strip-components 1
      rm -f "$BUILD_DIR/$tarball"
    fi
    NODE_BIN="$BUILD_DIR/node/bin/node"
  fi
  rm -f "$SUMS"
fi
NODE_DIR=$(dirname "$NODE_BIN")
log "node for the build: $NODE_BIN"
# Versions on screen and in the log: the first thing to compare when a build fails on one Mac and not another.
if [ "$OPT_DRY_RUN" = 0 ]; then
  say tools "$("$NODE_BIN" --version 2>&1 || echo '?')" "$(PATH="$NODE_DIR:$PATH" "$NODE_DIR/npm" --version 2>&1 || echo '?')" "$NODE_BIN"
fi

# ---------------------------------------------------------------------------------------------------------------
# Step 4: npm ci, the build, the native module, and the .app made by Electron Forge.
step s_build
phase $EXIT_BUILD build_failed
BUILD_ENV_PATH="$NODE_DIR:/usr/bin:/bin:/usr/sbin:/sbin"
# Electron's download (@electron/get) uses the proxy only when asked to.
if [ -n "$PROXY" ]; then export ELECTRON_GET_USE_PROXY=1 GLOBAL_AGENT_HTTPS_PROXY="$PROXY"; fi
export npm_config_fund=false npm_config_audit=false npm_config_update_notifier=false
in_src() { act "$1" -- env PATH="$BUILD_ENV_PATH" sh -c 'cd "$1" && shift && "$@"' sh "$SRC" "${@:2}"; }
in_src "npm ci" npm ci
in_src "npm run build" npm run build
PREBUILD="$SRC/node_modules/better-sqlite3/prebuilds/darwin-$ELECTRON_ARCH.node"
if [ "$OPT_DRY_RUN" = 1 ] || [ -f "$PREBUILD" ]; then
  say prebuilt_ok "darwin-$ELECTRON_ARCH"
else
  # Not expected on a supported Mac (better-sqlite3 ships darwin-arm64 and darwin-x64); kept so a future version
  # without a ready module still builds. Not tried on a runner.
  say needs_compile "darwin-$ELECTRON_ARCH"
  if ! xcode-select -p >/dev/null 2>&1; then
    phase $EXIT_PREREQUISITE declined
    ask ask_clt || die $EXIT_PREREQUISITE declined "Command Line Tools"
    act "ask macOS to install the Command Line Tools" -- xcode-select --install
    say wait_clt
    waited=0
    until xcode-select -p >/dev/null 2>&1; do
      sleep 10
      waited=$((waited + 10))
      [ "$waited" -lt 3600 ] || die $EXIT_PREREQUISITE declined "Command Line Tools"
    done
    phase $EXIT_BUILD build_failed
  fi
  in_src "compile the database module for Electron" npx --no-install electron-rebuild --force --only better-sqlite3 --arch "$ELECTRON_ARCH"
  act "put the compiled module where the package expects it" -- cp "$SRC/node_modules/better-sqlite3/build/Release/better_sqlite3.node" "$PREBUILD"
fi
in_src "package the app with Electron Forge" npx --no-install electron-forge package --platform darwin --arch "$ELECTRON_ARCH"
BUILT_APP="$SRC/out/$DISPLAY_NAME-darwin-$ELECTRON_ARCH/$DISPLAY_NAME.app"
if [ "$OPT_DRY_RUN" = 0 ] && [ ! -x "$BUILT_APP/Contents/MacOS/$APP_ID" ]; then die $EXIT_BUILD build_failed "no app at $BUILT_APP" "$LOG"; fi

# ---------------------------------------------------------------------------------------------------------------
# Step 5: install. A new copy is prepared and signed beside the old one, then swapped in, so a failure leaves the
# old version as it was. The data folder is elsewhere and never touched here.
step s_install
phase $EXIT_INSTALL install_failed
say installing_to "$APP_PATH"
OLD_VERSION=''
if [ -f "$APP_PATH/Contents/Info.plist" ]; then
  OLD_VERSION=$(plutil -extract CFBundleShortVersionString raw -o - "$APP_PATH/Contents/Info.plist" 2>/dev/null || echo '?')
  say upgrade "$OLD_VERSION" "$PKG_VERSION"
fi
STAGED="$APPS_DIR/.$DISPLAY_NAME.app.new"
act "create $APPS_DIR" -- mkdir -p "$APPS_DIR"
act "copy the app beside the installed one" -- sh -c 'rm -rf "$2" && ditto "$1" "$2"' sh "$BUILT_APP" "$STAGED"
# Apple silicon runs only signed code. An ad hoc signature ("-") is made on this Mac for this copy; it proves no
# publisher, only that the files are the ones signed here.
act "sign the app ad hoc for this Mac" -- codesign --force --deep --sign - "$STAGED"
# Files made here carry no quarantine mark; clearing it anyway keeps Gatekeeper's first-open check off this build.
act "clear the quarantine mark" -- sh -c 'xattr -dr com.apple.quarantine "$1" 2>/dev/null || true' sh "$STAGED"
act "check the signature" -- codesign --verify --deep --strict --verbose=2 "$STAGED"
act "swap the new app in" -- sh -c 'if [ -d "$2" ]; then rm -rf "$2.old" && mv "$2" "$2.old"; fi && mv "$1" "$2" && rm -rf "$2.old"' sh "$STAGED" "$APP_PATH"
# The installer keeps a copy of itself and a note of what it installed, for --uninstall and the next upgrade.
act "keep the installer for removing the app later" -- sh -c 'mkdir -p "$1" && { [ ! -f "$2" ] || cp "$2" "$1/install-macos.sh"; } && printf "version=%s\napp=%s\nsource=%s\n" "$3" "$4" "$5" > "$1/installed.txt"' sh "$INSTALLER_HOME" "$SELF" "$PKG_VERSION" "$APP_PATH" "$SOURCE_LABEL"

# ---------------------------------------------------------------------------------------------------------------
# Step 6: the installed app answers and opens, as the Linux package checks require (scripts/smoke-installed-app.js).
step s_verify
phase $EXIT_VERIFY verify_failed
if [ "$OPT_DRY_RUN" = 0 ]; then
  # What macOS thinks of this build, for the log: signature, Gatekeeper's assessment, extended attributes.
  { codesign -dv --verbose=2 "$APP_PATH" 2>&1 || true; spctl --assess --type execute -vv "$APP_PATH" 2>&1 || true; xattr -lr "$APP_PATH" 2>/dev/null | head -n 20 || true; } >> "$LOG"
  printed=$("$APP_EXE" --version 2>> "$LOG" | tr -d '\r' || true)
  log "--version printed: $printed"
  [ "$printed" = "$DISPLAY_NAME $PKG_VERSION" ] || die $EXIT_VERIFY verify_failed "--version: $printed" "$LOG"
fi
act "start the app once with a throw-away profile and check its window" -- env PATH="$BUILD_ENV_PATH" "$NODE_BIN" "$SRC/scripts/smoke-installed-app.js" --app "$APP_EXE" --expect-version "$PKG_VERSION"

if [ "$OPT_KEEP_BUILD" = 0 ]; then act "remove the build folder" -- rm -rf "$WORK_DIR"; fi

if [ "$OPT_DRY_RUN" = 1 ]; then say dry_finished "$PKG_VERSION"; else say finished "$PKG_VERSION"; fi
say where "$APP_PATH"
say data "$DATA_DIR"
say how_start "$APPS_DIR"
say how_remove "$INSTALLER_HOME/install-macos.sh"
say log_at "$LOG"
if [ -n "$OLD_VERSION" ]; then say keychain_note; fi
exit $EXIT_OK
