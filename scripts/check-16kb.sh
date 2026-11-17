#!/usr/bin/env bash
# Checks that the native libraries in an .aab / .apk support 16 KB memory pages.
# Google Play requires this for apps with native code (the app's Rust code is native code).
#
# Usage: scripts/check-16kb.sh path/to/app.aab
#
# Every LOAD segment of every 64-bit library must be aligned to at least 0x4000 (16 KB).
# NDK r28 and newer do this by default; with an older NDK the check fails.
set -euo pipefail

FILE="${1:?Usage: $0 <file.aab|file.apk>}"
READELF="$(command -v llvm-readelf || command -v readelf || true)"
[ -n "$READELF" ] || { echo "readelf (or llvm-readelf from the NDK) is needed" >&2; exit 2; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
unzip -q -o "$FILE" '*.so' -d "$TMP" 2>/dev/null || true

status=0
count=0
while IFS= read -r so; do
  case "$so" in
    */arm64-v8a/*|*/x86_64/*) ;;   # only 64-bit libraries are affected
    *) continue ;;
  esac
  count=$((count + 1))
  bad=0
  while read -r align; do
    [ -n "$align" ] || continue
    if [ $((align)) -lt 16384 ]; then bad=1; fi
  done < <("$READELF" -lW "$so" | awk '$1 == "LOAD" { print $NF }')
  rel="${so#"$TMP"/}"
  if [ "$bad" -eq 1 ]; then
    echo "FAIL  $rel (segments are not aligned to 16 KB)"
    status=1
  else
    echo "ok    $rel"
  fi
done < <(find "$TMP" -name '*.so' | sort)

if [ "$count" -eq 0 ]; then
  echo "No 64-bit native libraries found in $FILE" >&2
  exit 2
fi
if [ "$status" -ne 0 ]; then
  echo
  echo "Build with NDK r28 or newer (it aligns to 16 KB by default) and run this check again."
fi
exit "$status"
