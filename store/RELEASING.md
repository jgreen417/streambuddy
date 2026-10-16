# Releasing

`.github/workflows/release.yml` ships a version to both stores when you push a tag.

1. Bump `version` in `package.json` and add a `# streamBuddy X.Y.Z` section to `CHANGELOG.md` (it becomes the AMO release notes).
2. Merge to `main`, then tag that commit: `git tag vX.Y.Z && git push origin vX.Y.Z`.
3. The workflow lints, typechecks, tests and builds the release packages, attaches them to a GitHub release, then:
   - uploads `chrome-X.Y.Z.zip` to the Chrome Web Store and submits it for review (Chrome Web Store API v2);
   - uploads the Firefox package, `streambuddy-source.zip`, the release notes and the reviewer notes to addons.mozilla.org and submits it for review (`web-ext sign`, AMO API v5).

Both stores still review every version. Chrome publishes once the review passes; AMO does the same for listed versions.

What the APIs don't cover, so it stays in the store dashboards: listing text, screenshots, promo tiles, the privacy tab and Chrome's reviewer notes. The AMO API can edit listing text and screenshots, but this workflow leaves them alone.

If a Chrome version is still in review, the upload may be refused until that review finishes or is cancelled in the dashboard.

## One-time setup

Add these as secrets of a GitHub environment named `stores` (Settings → Environments → New environment). Adding yourself as a required reviewer there makes each release wait for your click before anything is submitted.

| Secret | Where it comes from |
| --- | --- |
| `CWS_SERVICE_ACCOUNT_JSON` | Google Cloud console: create a project, enable the Chrome Web Store API, create a service account (no roles needed) and download a JSON key. Then add the service account's email in the Chrome Web Store Developer Dashboard under Account. |
| `CWS_PUBLISHER_ID` | Chrome Web Store Developer Dashboard → Publisher → Settings. |
| `AMO_JWT_ISSUER` | addons.mozilla.org → Developer Hub → Manage API Keys → "JWT issuer". |
| `AMO_JWT_SECRET` | Same page → "JWT secret". |
| `AMO_APPROVAL_NOTES` | Optional. The confidential notes for Mozilla's reviewers, including the test TMDb token. Only reviewers see them; never put the token in the repo. |
