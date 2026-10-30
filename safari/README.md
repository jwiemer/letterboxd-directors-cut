# Director’s Cut for iOS Safari

This is a prototype Safari Web Extension for the Letterboxd website on iPhone and iPad, targeting iOS/iPadOS 17+. The Chrome, Firefox, and Safari builds share the same feature code. This does not modify the native Letterboxd app.

## Build and install

1. Install Xcode and finish its first-launch setup.
2. From the repository root, run:

   ```sh
   cd src
   npm install
   ./build.sh safari
   npm run test-safari
   cd ..
   ```

3. Open `safari/Directors Cut/Directors Cut.xcodeproj` in Xcode. The checked-in project references `src/dist/safari`; rebuild that directory after changing JavaScript or CSS.
4. Select the **Directors Cut** app scheme and an iPhone simulator, then Run. For a physical iPhone, connect it, choose your own signing team for both app and extension targets, and enable Developer Mode if prompted. The default bundle IDs are `com.jwiemer.letterboxd.directorscut` and `com.jwiemer.letterboxd.directorscut.Extension`; use your own matching pair if necessary.
5. On the iPhone, open **Settings → Apps → Safari → Extensions** and enable **Director’s Cut**. On iOS 17, use **Settings → Safari → Extensions**.
6. Visit a film on Letterboxd in Safari and allow the extension on Letterboxd from Safari’s page menu. Open the extension’s settings from that menu. Allow the rating providers you use when Safari asks for additional site access.

For a command-line simulator build:

```sh
xcodebuild -project 'safari/Directors Cut/Directors Cut.xcodeproj' \
  -scheme 'Directors Cut' -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/directors-cut-derived CODE_SIGNING_ALLOWED=NO build
```

`create-project.sh` is a bootstrap utility; it leaves the checked-in, customized project alone when it already exists. No signing team, credentials, or provisioning profiles are committed. When releasing, update the marketing version on both Xcode targets to match `src/plus/VERSION`, and increment their build numbers.

## Behavior on touch screens

- Gallery arrows and counts remain visible; controls have larger tap targets.
- Photo filters wrap on small screens, and the trailer player scrolls in landscape so Close stays reachable.
- On iPhone/iPad, the full-resolution download button opens the original TMDB image during the tap. Use Safari’s Share menu or long-press to save it. Desktop browsers keep the existing file download behavior.
- Cast hover photos activate only when a hover-capable input is available. On a phone, tap a person’s name for their page and photo gallery.
- Safari settings are stored on the device; cross-device settings synchronization is not promised.

## GitHub CSS updates

After installing this build once, open Director’s Cut settings from Safari’s page menu. Under **GitHub CSS updates**, turn on **Get styling updates from GitHub** and allow access to `raw.githubusercontent.com`. It is off until you enable it.

The shared stylesheet is [`safari/styles/live.css`](styles/live.css) on the **safari-ios** branch of `jwiemer/letterboxd-directors-cut`. Edit and commit that file on GitHub to deliver CSS changes to this build. Keep its first line unchanged. The same overlay is applied to Letterboxd pages and the extension settings page, so use selectors that target the intended elements.

Checks run when a page opens, at most every five minutes. To bypass that interval, open the extension settings and tap **Check for style updates**, then reload Letterboxd (or reopen the settings page). GitHub’s own caching may add a short delay. This does not download JavaScript, change the app’s signing expiration, or install a new app version.

Bundled styles always load first. The downloaded CSS adds overrides after them. Offline, the last successful download is reused; without a saved download, bundled styles remain. Turn off the toggle to remove the overlay and return to bundled styles. An empty overlay restores the baseline for everyone with updates enabled; do not remove the required header line. Files over 128 KiB, missing the header, or containing `@import` are ignored and do not replace the last successful download.

Keep this branch available: installed builds use its fixed URL even if the pull request is later merged. Moving the source URL requires another extension build. Everyone who installs this version and enables this option uses the same public stylesheet.

## Validation before release

The automated package checks verify shipped resources, manifest configuration, version consistency, and image-saving behavior on iPhone, desktop-mode iPad, and desktop. They do not prove that Safari grants permissions, streams YouTube videos, or accepts Letterboxd account actions correctly.

Test the following on a real iPhone and iPad before release:

- Enable/disable the extension and grant/revoke Letterboxd and rating-provider access.
- Film ratings, links, and details while logged in and logged out.
- Extras tabs, playback, fullscreen, switching videos, and closing in portrait and landscape.
- Stills/posters, language filters, grid/single views, arrows, and saving an original.
- Contributor galleries, search thumbnails, and settings persistence after Safari is terminated.
- Patron poster/backdrop selection using an authorized Patron account.
- Optional rating-provider permissions and Google search integration.
- Settings backup/restore from the Safari popup and a full settings tab.

## Distribution

The optional workflow update in `safari/ci-workflows.patch` creates `directors-cut-safari-v*.zip` containing extension resources. Apply it with `git apply safari/ci-workflows.patch` from the repo root using a GitHub connection allowed to update workflows. The patch also adds pull-request checks for the Safari package and iOS build. These workflow changes are supplied as a patch because the current GitHub connection lacks workflow-write permission. This ZIP is for Apple packaging tools, not direct installation in iOS Safari. Apple’s Safari Web Extension Packager in App Store Connect can package resource ZIPs, or you can archive this Xcode app. TestFlight/App Store distribution requires your Apple Developer account, signing, metadata, and Apple review. No upload or submission is performed by the repository workflow.

References: [Apple Safari extensions](https://developer.apple.com/safari/extensions/) and [Safari browser compatibility](https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility).
