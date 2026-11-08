#!/bin/bash
# Prism Launcher Deluxe — установка на macOS
set -e
VER=33.2.1
SRC="$(cd "$(dirname "$0")" && pwd)"
ARCH=$([ "$(uname -m)" = "arm64" ] && echo arm64 || echo x64)
APP="/Applications/Prism Launcher Deluxe.app"
[ -w /Applications ] || APP="$HOME/Applications/Prism Launcher Deluxe.app"
TMP="$(mktemp -d)"
echo "Prism Launcher Deluxe — установка ($ARCH)"
pkill -f "Prism Launcher Deluxe.app" 2>/dev/null || true
if [ ! -d "$APP/Contents/Resources" ] || [ "$(cat "$APP/Contents/Resources/runtime.txt" 2>/dev/null)" != "$VER" ]; then
  echo "[1/3] Скачиваю движок (~100 МБ)..."
  OK=0
  for U in "https://github.com/electron/electron/releases/download/v$VER/electron-v$VER-darwin-$ARCH.zip" \
           "https://registry.npmmirror.com/-/binary/electron/v$VER/electron-v$VER-darwin-$ARCH.zip"; do
    if curl -L --fail --connect-timeout 20 -o "$TMP/e.zip" "$U"; then OK=1; break; fi
    echo "  не получилось, пробую другой источник..."
  done
  [ $OK = 1 ] || { echo "Не удалось скачать движок"; exit 1; }
  echo "[2/3] Распаковываю..."
  ditto -x -k "$TMP/e.zip" "$TMP/x"
  rm -rf "$APP"; mkdir -p "$(dirname "$APP")"
  mv "$TMP/x/Electron.app" "$APP"
  echo "$VER" > "$APP/Contents/Resources/runtime.txt"
  rm -f "$APP/Contents/Resources/default_app.asar"
  /usr/libexec/PlistBuddy -c "Set :CFBundleName Prism Launcher Deluxe" -c "Set :CFBundleDisplayName Prism Launcher Deluxe" "$APP/Contents/Info.plist" 2>/dev/null || true
fi
echo "[3/3] Копирую лаунчер..."
R="$APP/Contents/Resources"
rm -rf "$R/app"; mkdir -p "$R/app"
cp -R "$SRC/package.json" "$SRC/main.js" "$SRC/preload.js" "$SRC/features.js" "$SRC/renderer" "$SRC/assets" "$R/app/"
cp "$SRC/assets/icon.icns" "$R/electron.icns"
xattr -cr "$APP" 2>/dev/null || true
touch "$APP"
rm -rf "$TMP"
echo "Готово! Приложение: $APP"
open "$APP"
