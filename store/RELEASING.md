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
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Printed by the Google Cloud setup below. |
| `CWS_SERVICE_ACCOUNT` | The service account's email, also from the setup below. |
| `CWS_PUBLISHER_ID` | Chrome Web Store Developer Dashboard → Publisher → Settings. |
| `AMO_JWT_ISSUER` | addons.mozilla.org → Developer Hub → Manage API Keys → "JWT issuer". |
| `AMO_JWT_SECRET` | Same page → "JWT secret". |
| `AMO_APPROVAL_NOTES` | Optional. The confidential notes for Mozilla's reviewers, including the test TMDb token. Only reviewers see them; never put the token in the repo. |

### Google Cloud setup for Chrome

Chrome signs in without a key file: Google trusts GitHub's identity token only for jobs of this repository that run in the `stores` environment (so they pass its required reviewers) and lets them act as a service account (Workload Identity Federation). New Google Cloud accounts block service account keys by default, so this is also the only route that works there.

1. In the [Google Cloud console](https://console.cloud.google.com), create a project, then open Cloud Shell (the `>_` button, top right) and run:

   ```sh
   PROJECT_ID=$(gcloud config get-value project)
   gcloud services enable chromewebstore.googleapis.com iam.googleapis.com iamcredentials.googleapis.com \
     sts.googleapis.com cloudresourcemanager.googleapis.com
   PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
   gcloud iam service-accounts create streambuddy-release --display-name="streamBuddy release"
   gcloud iam workload-identity-pools create github --location=global --display-name="GitHub"
   gcloud iam workload-identity-pools providers create-oidc streambuddy --location=global \
     --workload-identity-pool=github --issuer-uri=https://token.actions.githubusercontent.com \
     --attribute-mapping="google.subject=assertion.sub" \
     --attribute-condition="assertion.sub=='repo:jgreen417/streambuddy:environment:stores'"
   gcloud iam service-accounts add-iam-policy-binding \
     "streambuddy-release@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/iam.workloadIdentityUser \
     --member="principal://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/subject/repo:jgreen417/streambuddy:environment:stores"
   echo "GCP_WORKLOAD_IDENTITY_PROVIDER: projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/streambuddy"
   echo "CWS_SERVICE_ACCOUNT: streambuddy-release@$PROJECT_ID.iam.gserviceaccount.com"
   ```

2. Copy the two printed values into the `stores` environment secrets.
3. In the Chrome Web Store Developer Dashboard, open Account and add the `CWS_SERVICE_ACCOUNT` email.
