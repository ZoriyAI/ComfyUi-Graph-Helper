#!/bin/sh
# NodeWise Studio: install this folder for the current user, without root.
#
#   ./install.sh
#
# Puts the app in ~/.local/share/nodewise-studio, a launcher in ~/.local/bin, a menu entry in
# ~/.local/share/applications and the icons in ~/.local/share/icons. Running it again replaces an older copy,
# also a copy of version 0.9 installed under the app's old name. Settings, projects and keys live apart, in
# ~/.config/nodewise-studio, and are kept. To remove the app: ~/.local/share/nodewise-studio/uninstall.sh
set -eu

# The names (src/shared/productNames.ts; tests/unit/productNames.test.ts compares them).
NAME=nodewise-studio
DISPLAY_NAME='NodeWise Studio'
MARK='Installed by install.sh of NodeWise Studio'
# The name 0.9 was installed under (src/shared/legacyNames.ts LEGACY_APP_ID): its copy is removed below.
LEGACY_NAME=comfyui-graph-builder

here=$(dirname "$(readlink -f "$0")")
data_home=${XDG_DATA_HOME:-$HOME/.local/share}
bin_dir=$HOME/.local/bin
app_dir=$data_home/$NAME
launcher=$bin_dir/$NAME
desktop_entry=$data_home/applications/$NAME.desktop

fail() {
  echo "$DISPLAY_NAME: $1" >&2
  exit 1
}

for arg in "$@"; do
  case $arg in
    -h|--help)
      sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) fail "unknown option $arg (try --help)" ;;
  esac
done

if [ ! -x "$here/$NAME" ] || [ ! -f "$here/run.sh" ]; then
  fail "run install.sh from the unpacked archive: $here/$NAME is missing."
fi
[ "$here" != "$(readlink -f "$app_dir" 2>/dev/null || echo "$app_dir")" ] || fail "this copy is already the installed one. Unpack a new archive and run its install.sh."
case $app_dir in
  *\"*|*\\*|*\$*|*\`*) fail "the folder $app_dir has a character a menu entry cannot hold." ;;
esac
if [ "$(id -u)" = 0 ]; then
  echo "$DISPLAY_NAME: you are root, so the app goes to root's own home folder ($HOME). For every user, install the .deb or .rpm package." >&2
fi
if [ -e "$launcher" ] && ! grep -q "$MARK" "$launcher" 2>/dev/null; then
  fail "$launcher exists and was not made by this script. Move it away and run install.sh again."
fi
if command -v pgrep >/dev/null 2>&1 && pgrep -f "$app_dir/$NAME" >/dev/null 2>&1; then
  fail "the app is running from $app_dir. Quit it, then run install.sh again."
fi

# Copy beside the old copy first, then swap, so a failed copy never leaves half an app.
mkdir -p "$data_home" "$bin_dir" "$data_home/applications"
staging="$app_dir.new.$$"
rm -rf "$staging"
trap 'rm -rf "$staging"' EXIT
cp -R "$here/." "$staging"
rm -f "$staging/install.sh"
chmod 755 "$staging/run.sh" "$staging/uninstall.sh" "$staging/$NAME"
rm -rf "$app_dir"
mv "$staging" "$app_dir"
trap - EXIT

# The launcher: a small script, so the app finds its own folder and the sandbox check in run.sh applies.
quoted=$(printf '%s' "$app_dir/run.sh" | sed "s/'/'\\\\''/g")
cat > "$launcher" <<EOF
#!/bin/sh
# $MARK. Removed by uninstall.sh.
exec '$quoted' "\$@"
EOF
chmod 755 "$launcher"

# The menu entry starts the launcher by its full path: ~/.local/bin is not on every desktop's PATH.
sed -e "s|^Exec=.*|Exec=\"$launcher\" %U|" -e '/^TryExec=/d' "$here/share/applications/$NAME.desktop" > "$desktop_entry.tmp"
printf 'X-NodeWise-Installer=install.sh\n' >> "$desktop_entry.tmp"
mv "$desktop_entry.tmp" "$desktop_entry"
chmod 644 "$desktop_entry"

for icon in "$here"/share/icons/hicolor/*/apps/"$NAME".png; do
  size=$(basename "$(dirname "$(dirname "$icon")")")
  mkdir -p "$data_home/icons/hicolor/$size/apps"
  cp "$icon" "$data_home/icons/hicolor/$size/apps/$NAME.png"
done

# A copy of 0.9 that this script installed under the old name would stay in the menu next to the new one: remove
# it with its own uninstall.sh (app folder, launcher, menu entry, icons; never its settings). Its settings folder
# is taken over by the app on its first start (src/main/profileAdoption.ts).
legacy_dir=$data_home/$LEGACY_NAME
if [ -x "$legacy_dir/uninstall.sh" ] && [ -x "$legacy_dir/$LEGACY_NAME" ]; then
  if "$legacy_dir/uninstall.sh" >/dev/null; then
    echo "$DISPLAY_NAME: the copy of version 0.9 in $legacy_dir is removed; its settings and projects are kept."
  else
    echo "$DISPLAY_NAME: the copy of version 0.9 in $legacy_dir is still there (is it running?). Quit it and run install.sh again to remove it." >&2
  fi
fi

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database -q "$data_home/applications" || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -q -t -f "$data_home/icons/hicolor" || true
fi

echo "$DISPLAY_NAME is installed in $app_dir"
echo "Start it from the applications menu or with: $launcher"
case ":$PATH:" in
  *":$bin_dir:"*) ;;
  *) echo "Note: $bin_dir is not on your PATH, so the short command $NAME does not work in a terminal yet." ;;
esac
echo "To remove it: $app_dir/uninstall.sh"
