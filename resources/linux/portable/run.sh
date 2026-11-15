#!/bin/sh
# NodeWise Studio: start the app from this folder, without installing anything.
# Also the start script of the AppImage (AppRun) and of the per-user install (install.sh).
# Arguments are passed on to the app (for example --version or --user-data-dir=<folder>).
set -eu

NAME=nodewise-studio
DISPLAY_NAME='NodeWise Studio'
# The folder that holds the app's files, relative to this script, and whether this is the AppImage
# (scripts/make-linux-portable.js rewrites both lines for it).
APP_SUBDIR=.
IN_APPIMAGE=0

here=$(dirname "$(readlink -f "$0")")
app_dir="$here/$APP_SUBDIR"
binary="$app_dir/$NAME"
if [ ! -x "$binary" ]; then
  echo "$DISPLAY_NAME: $binary is missing. Unpack the whole archive again." >&2
  exit 1
fi

# Chromium keeps every page in a sandbox. Outside a .deb or .rpm package its helper (chrome-sandbox) is not set up
# by an administrator, so Chromium uses the kernel's user namespaces instead. Some systems turn those off for
# programs without a security profile (Ubuntu 24.04 and later, some hardened kernels). Then the app could not start
# at all: it starts without the sandbox and says so here. A .deb or .rpm package keeps the sandbox everywhere.
sandbox_available() {
  helper="$app_dir/chrome-sandbox"
  if [ -u "$helper" ] && [ "$(stat -c %u "$helper" 2>/dev/null || echo 1)" = 0 ]; then
    return 0
  fi
  [ "$(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null || echo 1)" = 1 ] || return 1
  [ "$(cat /proc/sys/user/max_user_namespaces 2>/dev/null || echo 1)" != 0 ] || return 1
  [ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null || echo 0)" = 0 ] || return 1
  return 0
}

for arg in "$@"; do
  if [ "$arg" = "--no-sandbox" ]; then
    exec "$binary" "$@"
  fi
done

if sandbox_available; then
  exec "$binary" "$@"
fi

echo "$DISPLAY_NAME: this system does not let the app use Chromium's sandbox here, so it starts without it." >&2
if [ "$IN_APPIMAGE" = 1 ]; then
  echo "To keep the sandbox, install the .deb or .rpm package instead of the AppImage." >&2
else
  cat >&2 <<EOF
To keep the sandbox, install the .deb or .rpm package, or let an administrator set up the sandbox helper once:
  sudo chown root:root "$app_dir/chrome-sandbox" && sudo chmod 4755 "$app_dir/chrome-sandbox"
EOF
fi
exec "$binary" --no-sandbox "$@"
