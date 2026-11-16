#!/bin/bash
set -euo pipefail

repo=$(cd -- "$(dirname -- "$0")/.." && pwd -P)
version=$(node -p 'require(process.argv[1]).version' "$repo/manifest.json")
output_dir="${1:-$repo/dist}"
mkdir -p -- "$output_dir"
output_dir=$(cd -- "$output_dir" && pwd -P)
package_name="Clearfeed-for-X-${version}-macOS.zip"

scratch=$(mktemp -d "${TMPDIR:-/tmp}/clearfeed-package.XXXXXX")
trap 'rm -rf -- "$scratch"' EXIT
bundle="$scratch/Clearfeed for X"
mkdir -p "$bundle/extension/icons"

cp "$repo"/manifest.json "$repo"/settings.js "$repo"/worker.js "$repo"/feed.js "$repo"/feed.css \
   "$repo"/popup.html "$repo"/popup.js "$repo"/popup.css "$repo"/welcome.html "$repo"/welcome.js \
   "$repo"/setup.css "$bundle/extension/"
cp "$repo"/icons/icon{16,32,48,128}.png "$repo"/icons/{clearfeed,hero}.svg "$bundle/extension/icons/"
cp "$repo"/installer/{'Start Here.html','Install Clearfeed.command',setup.js} "$bundle/"
chmod +x "$bundle/Install Clearfeed.command"

(cd "$scratch" && zip -q -X -r "$package_name" 'Clearfeed for X')
mv -f -- "$scratch/$package_name" "$output_dir/$package_name"
printf '%s\n' "$output_dir/$package_name"
