#!/bin/bash
# Stage Clearfeed in a stable location. Chrome requests the user's approval in Load unpacked.
set -euo pipefail

source_dir=$(cd -- "$(dirname -- "$0")" && pwd -P)
install_dir="$HOME/Library/Application Support/Clearfeed for X"
stage_only=false

if [[ $# -ne 0 ]]; then
  if [[ $# -eq 2 && "$1" == "--stage-only" && "$2" == /* ]]; then
    stage_only=true
    install_dir="$2"
  else
    printf 'Usage: %s [--stage-only /absolute/destination]\n' "$0" >&2
    exit 2
  fi
fi

if [[ ! -f "$source_dir/extension/manifest.json" ]]; then
  printf 'Extract the macOS release ZIP and run this installer from the extracted folder.\n' >&2
  exit 1
fi

if [[ "$stage_only" == false && "$(uname -s)" != Darwin ]]; then
  printf 'This installer requires macOS.\n' >&2
  exit 1
fi

mkdir -p -- "$install_dir"
lock="$install_dir/.install-lock"
if ! mkdir -- "$lock" 2>/dev/null; then
  printf 'Another installer is using %s. Close it and try again.\n' "$install_dir" >&2
  exit 1
fi

stage=''
cleanup() {
  if [[ -n "$stage" && -d "$stage/previous" ]]; then
    if [[ ! -e "$install_dir/extension" ]]; then
      if ! mv -- "$stage/previous" "$install_dir/extension"; then
        printf 'The previous version is still available at %s.\n' "$stage/previous" >&2
        rmdir -- "$lock"
        return
      fi
    fi
  fi
  if [[ -n "$stage" ]]; then rm -rf -- "$stage"; fi
  rmdir -- "$lock"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

stage=$(mktemp -d "$install_dir/.stage.XXXXXX")
cp -R -- "$source_dir/extension" "$stage/extension"
cp -- "$source_dir/Start Here.html" "$source_dir/setup.js" "$install_dir/"

if [[ -e "$install_dir/extension" ]]; then
  mv -- "$install_dir/extension" "$stage/previous"
fi
mv -- "$stage/extension" "$install_dir/extension"

printf '\nClearfeed files are ready. Select this folder in Chrome:\n%s\n\n' "$install_dir/extension"
if [[ "$stage_only" == false ]]; then
  printf 'Follow the setup guide. If Clearfeed is already installed from this folder, click Reload on its Chrome card instead.\n'
  if ! open -a 'Google Chrome' 'chrome://extensions/' "$install_dir/Start Here.html"; then
    printf 'Open Google Chrome manually and follow %s/Start Here.html.\n' "$install_dir"
  fi
fi
