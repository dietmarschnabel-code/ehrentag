#!/usr/bin/env bash
# Builds the signed Android App Bundle (.aab) that you upload to Google Play
# (Google Play does not accept .apk files for new apps).
#
# Usage:  scripts/build-android-release.sh            build + check + sign the .aab
#         scripts/build-android-release.sh --apk      additionally build an unsigned .apk
#
# You need: the Android SDK and NDK r28 or newer, a JDK 17 (for jarsigner), the Rust Android
# targets (see the README) and your UPLOAD key:
#   ANDROID_KEYSTORE_FILE      path of the keystore   (default: ~/ehrentag-upload.jks)
#   ANDROID_KEY_ALIAS          alias of the key       (default: ehrentag)
#   ANDROID_KEYSTORE_PASSWORD  password               (asked for if not set)
#   ANDROID_KEY_PASSWORD       only if the key has a different password than the keystore
# Result: dist/Ehrentag-Manager_<version>_android.aab
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

WITH_APK=0
[ "${1:-}" = "--apk" ] && WITH_APK=1

KEYSTORE="${ANDROID_KEYSTORE_FILE:-$HOME/ehrentag-upload.jks}"
ALIAS="${ANDROID_KEY_ALIAS:-ehrentag}"
GRADLE="src-tauri/gen/android/app/build.gradle.kts"

say() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

command -v jarsigner >/dev/null || die "jarsigner not found. Install a JDK 17 (or set JAVA_HOME to the JDK of Android Studio, the 'jbr' folder)."
[ -f "$KEYSTORE" ] || die "Keystore not found: $KEYSTORE (see docs/PLAY_STORE.md, step 'Create the upload key')."
if [ -z "${ANDROID_KEYSTORE_PASSWORD:-}" ]; then
  read -rsp "Password of $KEYSTORE: " ANDROID_KEYSTORE_PASSWORD; echo
fi
export ANDROID_KEYSTORE_PASSWORD

say "Checking the version numbers"
node scripts/bump-version.js --check
VERSION="$(node -p "require('./package.json').version")"

if [ ! -d src-tauri/gen/android ]; then
  say "Creating the Android project (first time only)"
  npm run tauri android init
  npm run tauri icon app-icon.png
fi

say "Building the Android App Bundle (this takes a while)"
npm run tauri android build -- --aab
if [ "$WITH_APK" -eq 1 ]; then
  say "Building the APK"
  npm run tauri android build -- --apk
fi

AAB="$(find src-tauri/gen/android -path '*outputs/bundle/*' -name '*.aab' -print | sort | head -n1)"
[ -n "$AAB" ] || die "No .aab found after the build."
echo "Bundle: $AAB"

say "Checking what Google Play checks"
if [ -f "$GRADLE" ]; then
  TARGET="$(grep -oE 'targetSdk(Version)?\s*=\s*[0-9]+' "$GRADLE" | grep -oE '[0-9]+$' | head -n1 || true)"
  APPID="$(grep -oE 'applicationId\s*=\s*"[^"]+"' "$GRADLE" | head -n1 | cut -d'"' -f2 || true)"
  [ -n "$APPID" ] && echo "applicationId: $APPID   (permanent once the first upload is in Play Console!)"
  if [ -n "$TARGET" ]; then
    echo "targetSdk:     $TARGET"
    [ "$TARGET" -ge 36 ] || die "targetSdk is $TARGET. Google Play requires 36 or higher for new apps and updates (since 31 Aug 2026). Raise targetSdk and compileSdk in $GRADLE."
  else
    echo "targetSdk:     (not found in $GRADLE - check it by hand: it must be 36 or higher)"
  fi
fi
scripts/check-16kb.sh "$AAB"

say "Signing with your upload key"
mkdir -p dist
OUT="dist/Ehrentag-Manager_${VERSION}_android.aab"
EXTRA=()
if [ -n "${ANDROID_KEY_PASSWORD:-}" ]; then export ANDROID_KEY_PASSWORD; EXTRA=(-keypass:env ANDROID_KEY_PASSWORD); fi
jarsigner -keystore "$KEYSTORE" -storepass:env ANDROID_KEYSTORE_PASSWORD "${EXTRA[@]}" \
  -sigalg SHA256withRSA -digestalg SHA-256 -signedjar "$OUT" "$AAB" "$ALIAS"
jarsigner -verify "$OUT" | tail -n 1

if [ "$WITH_APK" -eq 1 ]; then
  APK="$(find src-tauri/gen/android -name '*-release-unsigned.apk' -print | sort | head -n1)"
  [ -n "$APK" ] && { cp "$APK" "dist/Ehrentag-Manager_${VERSION}_android-unsigned.apk"; echo "Unsigned APK copied to dist/ (sign it with apksigner, see the README)."; }
fi

say "Done"
echo "Upload this file to Google Play: $OUT"
command -v sha256sum >/dev/null && sha256sum "$OUT"
