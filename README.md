# Clearfeed for X

![Clearfeed for X on macOS. The purple toolbar menu shows tab and all-time ad counts.](media/clearfeed-preview.png)

Clearfeed is a free, open-source Chrome extension for macOS that hides labeled promoted posts and trends on X. Use its toolbar menu to pause blocking, view your ad counts, hide sidebar suggestions, and change its appearance.

## Install on macOS

1. Download the **macOS DMG** from the [latest release](https://github.com/nikkitaylor00/clearfeed-for-x/releases/latest) and open it in Finder.
2. Open **Install Clearfeed** from the mounted disk image and click **Install Extension Files**. The app copies the files to your user Library without administrator access.
3. Click **Open Chrome and Copy Path**. In Chrome, turn on **Developer mode** and click **Load unpacked**. Press **⌘⇧G**, paste the copied path, press **Return**, then click **Select**.
4. Pin Clearfeed from Chrome’s Extensions menu, then open or refresh X. Clearfeed’s welcome page and the **Setup help** button can help you check the connection.

![Clearfeed’s welcome page with pinning and connection check instructions.](media/setup-preview.png)

Use macOS 13 or newer for the installer and Google Chrome 123 or newer. Chrome requires users to complete the **Load unpacked** step for an extension distributed this way. [Chrome’s installation guide](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked)

The GitHub build is not notarized by Apple. If macOS blocks the installer app, copy the **Clearfeed Extension** folder from the mounted DMG into a permanent folder, such as Documents. Then select that copy in **Load unpacked**. The DMG includes the same steps in **Manual Setup.txt**.

## Updates and removal

Download and open the newer DMG, run **Install Clearfeed**, and click **Update Extension Files**. Click **Reload** on Clearfeed’s existing card at `chrome://extensions`, then refresh X. If you installed manually, replace the files in the same loaded folder before clicking **Reload**. Keeping the same folder preserves your settings and all-time count.

To remove Clearfeed, click **Remove** on its card at `chrome://extensions`. If you used the installer, you can then delete `~/Library/Application Support/Clearfeed for X`.

## Scope and privacy

Clearfeed processes already loaded posts only on `x.com` and `www.x.com`. It keeps preferences and the all-time count in Chrome’s local extension storage and does not transmit browsing data. The current tab count restarts on page load. Unlabeled sponsorships may still appear, and changes to X’s feed can require a Clearfeed update. Clearfeed is independent of X.

## Build from source

The extension has no runtime dependencies. For development, select this repository folder in **Load unpacked**. Run `./scripts/package-macos.sh` to build the universal DMG. The build requires macOS, Xcode command-line tools, and Node.js.

For a notarized build, set `CLEARFEED_CODESIGN_IDENTITY` to a Developer ID Application identity and `CLEARFEED_NOTARY_PROFILE` to your existing notarytool keychain profile before building. [Apple’s notarization workflow](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution/)

Clearfeed is released under the [MIT license](LICENSE).
