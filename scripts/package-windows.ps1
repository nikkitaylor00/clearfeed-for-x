param([string]$OutputDirectory)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
if (!$OutputDirectory) {
    $OutputDirectory = Join-Path $repo 'dist'
}

$manifest = Get-Content -Raw -LiteralPath (Join-Path $repo 'manifest.json') | ConvertFrom-Json
$staging = Join-Path ([System.IO.Path]::GetTempPath()) ("clearfeed-" + [guid]::NewGuid())
$extension = Join-Path $staging 'Clearfeed Extension'
$icons = Join-Path $extension 'icons'

New-Item -ItemType Directory -Force -Path $icons, $OutputDirectory | Out-Null
try {
    $files = @(
        'manifest.json', 'settings.js', 'worker.js', 'feed.js', 'feed.css',
        'popup.html', 'popup.js', 'popup.css', 'welcome.html', 'welcome.js',
        'setup.css', 'favorites.js', 'LICENSE'
    )
    foreach ($file in $files) {
        Copy-Item -LiteralPath (Join-Path $repo $file) -Destination $extension
    }
    foreach ($icon in @('icon16.png', 'icon32.png', 'icon48.png', 'icon128.png', 'clearfeed.svg', 'hero.svg')) {
        Copy-Item -LiteralPath (Join-Path $repo "icons/$icon") -Destination $icons
    }

    $guide = Join-Path $staging 'Windows Setup.txt'
    Copy-Item -LiteralPath (Join-Path $repo 'windows/README.txt') -Destination $guide
    $zip = Join-Path $OutputDirectory "Clearfeed-for-X-$($manifest.version)-Windows.zip"
    Compress-Archive -LiteralPath $extension, $guide -DestinationPath $zip -Force
    (Get-Item -LiteralPath $zip).FullName
} finally {
    Remove-Item -LiteralPath $staging -Recurse -Force
}
