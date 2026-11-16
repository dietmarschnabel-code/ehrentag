#!/usr/bin/env bash
# Gives the app its icon when you run it from the source tree (npm run tauri dev) on Linux.
#
# Wayland (and GNOME in general) does not use the icon a program sets for its window. It looks
# up the program's name in the installed .desktop files and takes the icon from there. A build
# in the source tree has no .desktop file, so the desktop shows a generic icon. The installed
# .deb / .rpm packages bring their own .desktop file and do not need this script.
#
# Usage:   scripts/install-dev-desktop-entry.sh            # for the debug build (npm run tauri dev)
#          scripts/install-dev-desktop-entry.sh release    # for the release build
#          scripts/install-dev-desktop-entry.sh remove     # undo
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
APPS="$DATA/applications"
ICONS="$DATA/icons/hicolor"
DESKTOP="$APPS/ehrentag.desktop"
MODE="${1:-debug}"

if [ "$MODE" = "remove" ]; then
  rm -f "$DESKTOP" "$ICONS"/*/apps/ehrentag.png
  echo "Removed the desktop entry and the icons."
  exit 0
fi
if [ "$MODE" != "debug" ] && [ "$MODE" != "release" ]; then
  echo "Usage: $0 [debug|release|remove]" >&2
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
  cp "$src" "$ICONS/$size/apps/ehrentag.png"
done

# The window of the app announces itself as "ehrentag" (the name of the program), so the file
# must be called ehrentag.desktop and carry the same name in StartupWMClass.
cat > "$DESKTOP" <<DESKTOP_EOF
[Desktop Entry]
Type=Application
Name=Ehrentag-Manager (development build)
Comment=Birthdays, name days and other special dates
Exec=$REPO/src-tauri/target/$MODE/ehrentag
Icon=ehrentag
Terminal=false
Categories=Utility;Office;Calendar;
StartupWMClass=ehrentag
DESKTOP_EOF

command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$APPS" || true
command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -q -t "$ICONS" || true

echo "Installed $DESKTOP"
echo "Now close the app and start it again. If the old icon is still shown, log out and in once."
