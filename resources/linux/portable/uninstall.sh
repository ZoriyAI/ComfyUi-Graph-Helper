#!/bin/sh
# NodeWise Studio: remove the copy that install.sh put in your home folder.
#
#   ~/.local/share/nodewise-studio/uninstall.sh           remove the app, keep settings, projects and keys
#   ~/.local/share/nodewise-studio/uninstall.sh --purge   also delete ~/.config/nodewise-studio
#
# Removes only what install.sh made: the app folder, the launcher in ~/.local/bin, the menu entry and the icons.
set -eu

NAME=nodewise-studio
DISPLAY_NAME='NodeWise Studio'
MARK='Installed by install.sh of NodeWise Studio'

data_home=${XDG_DATA_HOME:-$HOME/.local/share}
config_home=${XDG_CONFIG_HOME:-$HOME/.config}
app_dir=$data_home/$NAME
launcher=$HOME/.local/bin/$NAME
desktop_entry=$data_home/applications/$NAME.desktop
profile=$config_home/$NAME

purge=0
for arg in "$@"; do
  case $arg in
    --purge) purge=1 ;;
    -h|--help)
      sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "$DISPLAY_NAME: unknown option $arg (try --help)" >&2
      exit 1
      ;;
  esac
done

if command -v pgrep >/dev/null 2>&1 && pgrep -f "$app_dir/$NAME" >/dev/null 2>&1; then
  echo "$DISPLAY_NAME: the app is running. Quit it, then run uninstall.sh again." >&2
  exit 1
fi

removed=0
if [ -f "$launcher" ] && grep -q "$MARK" "$launcher" 2>/dev/null; then
  rm -f "$launcher"
  removed=1
fi
if [ -f "$desktop_entry" ] && grep -q '^X-NodeWise-Installer=install.sh' "$desktop_entry" 2>/dev/null; then
  rm -f "$desktop_entry"
  removed=1
fi
for icon in "$data_home"/icons/hicolor/*/apps/"$NAME".png; do
  [ -f "$icon" ] || continue
  rm -f "$icon"
  removed=1
done
# Only a folder that holds this app is deleted.
if [ -x "$app_dir/$NAME" ] && [ -f "$app_dir/run.sh" ]; then
  rm -rf "$app_dir"
  removed=1
fi

if command -v update-desktop-database >/dev/null 2>&1 && [ -d "$data_home/applications" ]; then
  update-desktop-database -q "$data_home/applications" || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1 && [ -d "$data_home/icons/hicolor" ]; then
  gtk-update-icon-cache -q -t -f "$data_home/icons/hicolor" || true
fi

if [ "$removed" = 1 ]; then
  echo "$DISPLAY_NAME is removed."
else
  echo "$DISPLAY_NAME: nothing to remove; it was not installed with install.sh for this user."
fi
if [ "$purge" = 1 ]; then
  rm -rf "$profile"
  echo "Settings, projects and saved keys in $profile are deleted."
  echo "The system keyring may still hold the entry that encrypted the keys; your keyring manager can delete it."
elif [ -d "$profile" ]; then
  echo "Settings, projects and saved keys are kept in $profile (run with --purge to delete them)."
fi
