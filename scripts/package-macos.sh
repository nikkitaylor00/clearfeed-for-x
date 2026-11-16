#!/bin/bash
set -euo pipefail

repo=$(cd -- "$(dirname -- "$0")/.." && pwd -P)
version=$(node -p 'require(process.argv[1]).version' "$repo/manifest.json")
output_dir="${1:-$repo/dist}"
mkdir -p -- "$output_dir"
output_dir=$(cd -- "$output_dir" && pwd -P)
image="$output_dir/Clearfeed-for-X-${version}-macOS.dmg"

scratch=$(mktemp -d "${TMPDIR:-/tmp}/clearfeed-package.XXXXXX")
trap 'rm -rf -- "$scratch"' EXIT
volume="$scratch/disk"
app="$volume/Install Clearfeed.app"
payload="$app/Contents/Resources/extension"
mkdir -p "$app/Contents/MacOS" "$payload/icons"

cp "$repo"/manifest.json "$repo"/settings.js "$repo"/worker.js "$repo"/feed.js "$repo"/feed.css \
   "$repo"/popup.html "$repo"/popup.js "$repo"/popup.css "$repo"/welcome.html "$repo"/welcome.js \
   "$repo"/setup.css "$repo"/LICENSE "$payload/"
cp "$repo"/icons/icon{16,32,48,128}.png "$repo"/icons/{clearfeed,hero}.svg "$payload/icons/"
cp -R "$payload" "$volume/Clearfeed Extension"
cp "$repo/installer/Manual Setup.txt" "$volume/Manual Setup.txt"
cp "$repo/LICENSE" "$volume/LICENSE.txt"

cp "$repo/installer/Info.plist" "$app/Contents/Info.plist"
plutil -replace CFBundleVersion -string "$version" "$app/Contents/Info.plist"
plutil -replace CFBundleShortVersionString -string "$version" "$app/Contents/Info.plist"

iconset="$scratch/Clearfeed.iconset"
mkdir "$iconset"
for size in 16 32 128 256 512; do
  /usr/bin/sips -z "$size" "$size" "$repo/icons/icon128.png" --out "$iconset/icon_${size}x${size}.png" >/dev/null
  /usr/bin/sips -z "$((size * 2))" "$((size * 2))" "$repo/icons/icon128.png" --out "$iconset/icon_${size}x${size}@2x.png" >/dev/null
done
/usr/bin/iconutil -c icns "$iconset" -o "$app/Contents/Resources/Clearfeed.icns"

sdk=$(xcrun --sdk macosx --show-sdk-path)
for arch in arm64 x86_64; do
  xcrun swiftc -parse-as-library -O -sdk "$sdk" -target "${arch}-apple-macos13.0" \
    -module-cache-path "$scratch/modules-$arch" "$repo/installer/ClearfeedInstaller.swift" -o "$scratch/installer-$arch"
done
xcrun lipo -create "$scratch/installer-arm64" "$scratch/installer-x86_64" -output "$app/Contents/MacOS/ClearfeedInstaller"

identity="${CLEARFEED_CODESIGN_IDENTITY:--}"
if [[ "$identity" == "-" ]]; then
  if [[ -n "${CLEARFEED_NOTARY_PROFILE:-}" ]]; then
    printf 'Set CLEARFEED_CODESIGN_IDENTITY to a Developer ID Application identity to notarize.\n' >&2
    exit 1
  fi
  codesign --force --sign - "$app"
else
  codesign --force --sign "$identity" --timestamp --options runtime "$app"
fi
codesign --verify --deep --strict "$app"

hdiutil create -quiet -fs HFS+ -volname 'Clearfeed for X' -srcfolder "$volume" -format UDZO "$scratch/Clearfeed.dmg"
if [[ "$identity" != "-" ]]; then
  codesign --force --sign "$identity" --timestamp "$scratch/Clearfeed.dmg"
fi
if [[ -n "${CLEARFEED_NOTARY_PROFILE:-}" ]]; then
  xcrun notarytool submit "$scratch/Clearfeed.dmg" --keychain-profile "$CLEARFEED_NOTARY_PROFILE" --wait
  xcrun stapler staple "$scratch/Clearfeed.dmg"
fi
mv -f -- "$scratch/Clearfeed.dmg" "$image"
printf '%s\n' "$image"
