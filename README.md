# Clearfeed for X

![Clearfeed for X on macOS. The purple toolbar menu shows tab and all-time ad counts.](media/clearfeed-preview.png)

Clearfeed is a free, open-source Chrome extension for macOS that hides labeled promoted posts and trends on X. Use its toolbar menu to pause blocking, view your ad counts, hide sidebar suggestions, and change its appearance.

## Install on macOS

1. Download the **macOS DMG** from the [latest release](https://github.com/nikkitaylor00/clearfeed-for-x/releases/latest) and double-click it in Finder.
2. Copy **Clearfeed Extension** into your Home folder. In Finder, choose **Go → Home** or press **⌘⇧H**.
3. In Chrome, open `chrome://extensions`. Turn on **Developer mode**, click **Load unpacked**, and select the copy of **Clearfeed Extension** in your Home folder.
4. Pin Clearfeed from Chrome’s Extensions menu, then open or refresh X. Clearfeed’s welcome page and the **Setup help** button can help you check the connection.

![Clearfeed’s welcome page with pinning and connection check instructions.](media/setup-preview.png)

The DMG also contains **Manual Setup.txt**, **LICENSE.txt**, and **Install Clearfeed.app**. The optional installer app copies the extension into your user Library, opens Chrome’s Extensions page, and copies the folder path. It requires macOS 13 or newer and may be blocked by Gatekeeper. The folder steps above work independently of the helper. Both methods require Chrome 123 or newer. [Chrome’s installation guide](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked)

## Updates and removal

Open the newer DMG and copy the new extension files into the same folder you loaded in Chrome. Click **Reload** on Clearfeed’s card at `chrome://extensions`, then refresh X. Keeping the same folder preserves your settings and all-time count. If you used the installer app, it placed the extension in `~/Library/Application Support/Clearfeed for X/extension`. You can update that copy using the app’s **Update Extension Files** button.

To remove Clearfeed, click **Remove** on its Chrome card. You can then delete the folder you used for the extension.

## Scope and privacy

Clearfeed processes already loaded posts only on `x.com` and `www.x.com`. It keeps preferences and the all-time count in Chrome’s local extension storage and does not transmit browsing data. The current tab count restarts on page load. Unlabeled sponsorships may still appear, and changes to X’s feed can require a Clearfeed update. Clearfeed is independent of X.

## Build from source

The extension has no runtime dependencies. For development, select this repository folder in **Load unpacked**. Run `./scripts/package-macos.sh` on macOS with Node.js and the Xcode command-line tools to build the same DMG as the public release.

The native installer source is in [installer](installer). Set `CLEARFEED_NATIVE_INSTALLER=0` to build a files-only DMG. For a notarized private build with the app, set `CLEARFEED_CODESIGN_IDENTITY` to a Developer ID Application identity and `CLEARFEED_NOTARY_PROFILE` to an existing notarytool keychain profile. [Apple’s notarization workflow](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution/)

Clearfeed is released under the [MIT license](LICENSE).
