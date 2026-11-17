# Publishing on Google Play

Everything the repository can prepare is prepared: the signed app bundle build, the checks Google Play makes,
the listing texts, the graphics, screenshots and the privacy policy. This guide is the order in which to use them.

> Google changes its rules and the labels in Play Console from time to time. The points marked **(check)** are the ones to
> confirm against the current [Play Console help](https://support.google.com/googleplay/android-developer) before you rely on them.

## 0. What Google Play needs (and does not accept)

| | |
|---|---|
| **File format** | an **Android App Bundle (`.aab`)**. Google Play does not accept `.apk` files for new apps. |
| **Signing** | you sign the bundle with an **upload key**; Google re-signs the apps that users download with the real **app signing key**, which Google keeps (*Play App Signing*) |
| **Target API level** | new apps and updates must target **Android 16 (API level 36)** or higher (required since 31 Aug 2026) **(check)** |
| **16 KB memory pages** | apps with native code (ours is Rust) must support 16 KB pages; build with **NDK r28 or newer** **(check)** |
| **Version code** | must be higher with every upload. Tauri derives it from the version: `major × 1,000,000 + minor × 1,000 + patch` (1.0.1 → 1000001) |
| **Developer account** | one-time fee of 25 US dollars |
| **Testing (personal accounts)** | personal accounts created after 13 Nov 2023 must first run a **closed test with at least 12 testers for 14 continuous days** before they may apply for production access. Organization accounts are exempt. **(check)** |

Plan about three weeks for the first release with a new personal account: 14 days of closed testing, then the
application for production access, then Google's review.

## 1. Create the upload key (once)

```bash
keytool -genkeypair -v -keystore ~/ehrentag-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias ehrentag
```

- Use the **same password** for the keystore and the key.
- **Back the file up** (and the password) in at least two places. With Play App Signing a lost upload key can be reset by
  Google, but it takes time.
- Never commit it (`*.jks` is in `.gitignore`).

For the GitHub build add three repository secrets (Settings → Secrets and variables → Actions):
`ANDROID_KEYSTORE_BASE64` (output of `base64 -w0 ~/ehrentag-upload.jks`), `ANDROID_KEYSTORE_PASSWORD` and
`ANDROID_KEY_ALIAS` (`ehrentag`).

> **One channel per phone.** The APK on GitHub is signed with your upload key, the app from Google Play with Google's app
> signing key. Android refuses to update an app with a different signature, so someone who installed the APK has to
> uninstall it before installing the Play version (and the other way round). Offer one or the other to a person.

## 2. Build the signed bundle

**On your computer** (Android SDK, NDK r28+, JDK 17 and the Rust Android targets as described in the README):

```bash
scripts/build-android-release.sh
```

It builds the bundle, **checks** target SDK, 16 KB support and the application id, signs it with your upload key
and writes `dist/Ehrentag-Manager_<version>_android.aab`.

**With GitHub Actions:** push a tag (`git tag v1.0.1 && git push origin v1.0.1`). The workflow builds everything and keeps
the signed `.aab` as the build artifact *android-release* (Actions → the run → Artifacts). Download it from there.
(The `.aab` is deliberately not attached to the public release; users cannot install it.)

### Check before the first upload

1. **Application id.** It is `com.dietmarsl.code.ehrentag`, taken from `identifier` in `src-tauri/tauri.conf.json`
   (the script prints the one in your Android project; `node scripts/bump-version.js --check` shows the one in the
   configuration). **It can never be changed after the first upload.** If you ever change `identifier`, the Android
   project has to be created again, because the id is built into it:
   `rm -rf src-tauri/gen/android && npm run tauri android init && npm run tauri icon app-icon.png`
   (then commit the new `src-tauri/gen/android`). An app installed with the old id stays on the phone as a separate app
   and has to be uninstalled by hand.
2. **Permissions.** Look at the merged manifest after a build:
   `src-tauri/gen/android/app/build/intermediates/merged_manifests/universalRelease/` (any `AndroidManifest.xml`
   below it). Expected: notifications (`POST_NOTIFICATIONS`). The `INTERNET` permission may be there because Tauri's
   template adds it; the app makes no network requests. Remove permissions the app does not need
   from `src-tauri/gen/android/app/src/main/AndroidManifest.xml`. **If an exact-alarm permission is listed**
   (`SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`), Google Play asks you to declare why; the app does not need exact
   alarms, so remove it if present.
3. **Test the release build on a phone** (`adb install` of an APK build, or the internal test track below).

## 3. Create the app in Play Console

*All apps → Create app*

| Field | Value |
|---|---|
| App name | `Special Days Manager` (English) |
| Default language | English (United States) – `en-US` |
| App or game | App |
| Free or paid | Free |
| Declarations | tick the policy and US export law declarations |

Then add **German (de-DE)** under *Grow users → Store presence → Translations* (or *Main store listing → Manage
translations*). The app has 12 interface languages; localized store listings for further languages are optional.

## 4. Store listing

All texts are ready in [`store/listing/en-US.md`](../store/listing/en-US.md) and
[`store/listing/de-DE.md`](../store/listing/de-DE.md); they respect the character limits.

| Asset | File | Requirement |
|---|---|---|
| App icon | `store/icon-512.png` | 512 × 512 px PNG, up to 1 MB |
| Feature graphic | `store/feature-graphic-1024x500.png` | 1024 × 500 px |
| Phone screenshots | `store/screenshots/en-US/*.png`, `store/screenshots/de-DE/*.png` | 2 to 8 images, 1080 × 1920 px (9:16) |

The screenshots show demo data. Regenerate them any time the design changes
(`CHROME_PATH=/usr/bin/chromium node scripts/make-store-screenshots.js`, needs `npm install --no-save puppeteer-core`;
`python3 scripts/make-store-graphics.py` redraws icon and feature graphic), or take real ones on a phone.
Tablet screenshots are optional.

Contact details (*Store settings*): e-mail address (public), optional website `https://github.com/dietmarschnabel-code/ehrentag`.

Category suggestion: **Productivity** (or *Tools*). Tags: Calendar / Productivity.

## 5. App content (Policy → App content)

| Section | Answer |
|---|---|
| **Privacy policy** | URL of [`PRIVACY.md`](../PRIVACY.md) in the public repository: `https://github.com/dietmarschnabel-code/ehrentag/blob/main/PRIVACY.md` |
| **Ads** | No, the app contains no ads |
| **App access** | All functionality is available without any login or special access |
| **Content rating** | Fill in the questionnaire (category *Utility, productivity, communication or other*): no violence, no sexual content, no user-generated content shared with others, no location sharing, no purchases. Expect the lowest rating. |
| **Target audience** | Choose adult age groups (for example 18 and over). Do not select groups under 13: that would bring in the *Families* policy. |
| **Data safety** | *Does your app collect or share any of the required user data types?* **No.** The names and dates are only stored on the device and never sent anywhere. Then submit. |
| **News app / government / financial / health** | No |

**(check)** The forms are long and change; answer them truthfully for the version you upload. If you add network
features later, update the privacy policy and the Data safety form first.

## 6. Test tracks and release

1. **Internal testing** (no review, instantly available to up to 100 testers you list by e-mail): upload the `.aab` here
   first. Install it from the Play link on a real phone and check overview, editor, import/export and reminders.
2. **Closed testing** (personal accounts created after 13 Nov 2023): upload the same bundle, add **12 or more testers**
   (a Google Group or e-mail list), and let them opt in via the link. They must stay opted in for **14 continuous days**.
   Ask them to really use the app; uninstalling can reset their time. **(check)**
3. **Production access:** after the 14 days, *Dashboard → Apply for production*, answer the questions about your testing.
4. **Production release:** *Production → Create new release*, upload the bundle (or promote it from the test track),
   paste the release notes from `store/listing/*.md` and start the rollout. A first review can take several days.

## 7. Releasing the next version

```bash
node scripts/bump-version.js 1.0.2      # package.json, Cargo.toml, tauri.conf.json (+ prints the versionCode)
# update CHANGELOG.md and the release notes in store/listing/*.md
git commit -am "Release 1.0.2" && git tag v1.0.2 && git push origin main v1.0.2
```

Download the signed `.aab` from the workflow run and upload it as a new release. The version (and so the version
code) must be higher than the last upload.

## Troubleshooting

| Message | Cause and fix |
|---|---|
| "Version code 1000001 has already been used" | bump the version and build again |
| "Your app targets API level …, must target 36" | raise `targetSdk` and `compileSdk` to 36 in `src-tauri/gen/android/app/build.gradle.kts` |
| "Your app doesn't support 16 KB memory page sizes" | build with NDK r28 or newer; `scripts/check-16kb.sh file.aab` shows which library is affected |
| "You uploaded a debuggable bundle" | the bundle was built in debug mode; build with `scripts/build-android-release.sh` |
| "The upload certificate does not match" | the bundle was signed with a different key than the one registered; use the same keystore every time |
| The app does not install over the GitHub APK | different signature (see the note in step 1): uninstall first |
