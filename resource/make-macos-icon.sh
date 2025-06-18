#!/bin/bash

ICON_SRC="Voco-app-icon-with-padding.png"
ICONSET="Voco.iconset"
ICNS="Voco.icns"

# 1. Create iconset folder
mkdir -p "$ICONSET"

# 2. Generate all required sizes
for size in 16 32 64 128 256 512 1024; do
  convert "$ICON_SRC" -resize ${size}x${size} "$ICONSET/icon_${size}x${size}.png"
  # Retina (@2x) sizes
  double=$((size * 2))
  convert "$ICON_SRC" -resize ${double}x${double} "$ICONSET/icon_${size}x${size}@2x.png"
done

# 3. Generate .icns file
iconutil -c icns "$ICONSET" -o "$ICNS"

# 4. Clean up iconset folder (optional)
rm -rf "$ICONSET"

echo "Done! Your production-ready icon is $ICNS"