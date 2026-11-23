# macOS build and signing

The release workflow (`.github/workflows/release.yml`) builds a **universal `.dmg`** (Apple Silicon + Intel) on a
GitHub `macos-latest` runner whenever a `v*` tag is pushed. No extra setup is needed for that.

## Without an Apple Developer account (default)

The app is **ad-hoc signed** (`"signingIdentity": "-"` in `src-tauri/tauri.conf.json`). It runs, but macOS Gatekeeper
warns on the first start. Users open it with right-click → **Open**, or remove the quarantine flag once:

```bash
xattr -dr com.apple.quarantine /Applications/Ehrentag-Manager.app
```

## With an Apple Developer account (signed and notarized)

This removes the warning. It needs the paid Apple Developer Program (99 USD / year).

1. In the Apple Developer portal create a **Developer ID Application** certificate and export it from Keychain Access
   as a `.p12` file (with a password).
2. Encode it: `base64 -i certificate.p12 | pbcopy`
3. Create an **app-specific password** at <https://appleid.apple.com> (for notarization).
4. Add these **repository secrets** (Settings → Secrets and variables → Actions):

   | Secret | Content |
   |---|---|
   | `APPLE_CERTIFICATE` | the base64 text of the `.p12` file |
   | `APPLE_CERTIFICATE_PASSWORD` | the password of the `.p12` file |
   | `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Your Name (TEAMID)` |
   | `APPLE_ID` | your Apple ID e-mail |
   | `APPLE_PASSWORD` | the app-specific password |
   | `APPLE_TEAM_ID` | your 10-character team ID |

5. In `release.yml`, remove the `#` in front of the six `APPLE_…` lines in the `env:` block of the
   `tauri-apps/tauri-action` step.

Leave them commented out until all six secrets exist: empty values make the build fail.

## iOS (App Store / TestFlight)

Not part of the workflow. It needs the Developer Program, a distribution certificate, a provisioning profile and an
App Store Connect API key, plus `npx tauri ios init` on a Mac. Reminders in the app are only wired for Android so far.
