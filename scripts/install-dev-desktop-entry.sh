#!/usr/bin/env bash
# Gives the app its icon when you run it from the source tree (npm run tauri dev) on Linux.
#
# Wayland (and GNOME and KDE in general) do not use the icon a program sets for its window. They take the
# program's name (the app id, here "Ehrentag-Manager") and look for an installed .desktop file with that
# name; the icon comes from there. A build in the source tree has no such file, so the desktop shows a
# generic icon. The installed .deb / .rpm packages bring their own Ehrentag-Manager.desktop and do not need
# this script (do not run it if the package is installed: it would replace the menu entry of the package).
#
# The name must match the name of the program: "name" in src-tauri/Cargo.toml.
#
# Usage:   scripts/install-dev-desktop-entry.sh            # for the debug build (npm run tauri dev)
#          scripts/install-dev-desktop-entry.sh release    # for the release build
#          scripts/install-dev-desktop-entry.sh remove     # undo
set -euo pipefail

NAME="Ehrentag-Manager"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
APPS="$DATA/applications"
ICONS="$DATA/icons/hicolor"
DESKTOP="$APPS/$NAME.desktop"
MODE="${1:-debug}"

if [ "$MODE" = "remove" ]; then
  # also removes the files of the first version of this script, which used the lower-case name
  rm -f "$DESKTOP" "$APPS/ehrentag.desktop" "$ICONS"/*/apps/"$NAME".png "$ICONS"/*/apps/ehrentag.png
  echo "Removed the desktop entry and the icons."
  exit 0
fi
if [ "$MODE" != "debug" ] && [ "$MODE" != "release" ]; then
  echo "Usage: $0 [debug|release|remove]" >&2
  exit 1
fi

# the program name in Cargo.toml must be the one this script uses
CARGO_NAME="$(grep -m1 -E '^name\s*=' "$REPO/src-tauri/Cargo.toml" | cut -d'"' -f2)"
if [ "$CARGO_NAME" != "$NAME" ]; then
  echo "src-tauri/Cargo.toml says name = \"$CARGO_NAME\", this script expects \"$NAME\"." >&2
  exit 1
fi

mkdir -p "$APPS"
for size in 128x128 256x256 512x512; do
  case "$size" in
    128x128) src="$REPO/src-tauri/icons/128x128.png" ;;
    256x256) src="$REPO/src-tauri/icons/128x128@2x.png" ;;
    512x512) src="$REPO/src-tauri/icons/icon.png" ;;
  esac
  mkdir -p "$ICONS/$size/apps"
  cp "$src" "$ICONS/$size/apps/$NAME.png"
done

cat > "$DESKTOP" <<DESKTOP_EOF
[Desktop Entry]
Type=Application
Name=Ehrentag-Manager (development build)
Comment=Birthdays, name days and other special dates
Exec=$REPO/src-tauri/target/$MODE/$NAME
Icon=$NAME
Terminal=false
Categories=Utility;Office;Calendar;
StartupWMClass=$NAME
DESKTOP_EOF

command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$APPS" || true
command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -q -t "$ICONS" || true

echo "Installed $DESKTOP"
echo "Now close the app and start it again. If the old icon is still shown, log out and in once."
