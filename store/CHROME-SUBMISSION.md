# Chrome Web Store submission

Prepared 12 October 2026.

- Item: streamBuddy 1.0.0
- Extension ID: `lieihlkbpleoeoaiagnfcegegjgeeojc`
- Draft: https://chrome.google.com/webstore/devconsole/13a5379f-6461-41c9-928b-7cc257592dc3/lieihlkbpleoeoaiagnfcegegjgeeojc/edit
- Package uploaded: `release/chrome-1.0.0.zip`
- Description, Entertainment category, English language, homepage and support links saved.
- Icon, small promo tile, marquee artwork and `store/screenshots/netflix-ratings.png` uploaded and saved.
- Privacy policy link, permission justifications and data disclosures saved.
- Distribution: free, public, all regions.
- Confidential reviewer instructions saved. The user approved sharing the development TMDb credential with Google's review team. No credential is included in this document or the release ZIP.

The screenshot is a crop of the live Netflix catalogue, resized to 1280×800. It shows ratings, friends' averages, and personal rating marks, without the browser sidebar or account details.

Verification: 110 tests passed; Chrome release build succeeded; ZIP integrity passed; no embedded development TMDb credential or Letterboxd username found.

## Submission status

Submitted for Chrome Web Store review on 12 October 2026. The dashboard confirmed **Pending review** and displayed "Your extension was submitted for review". Automatic publishing after approval is enabled.

The user approved `joshmdg04@gmail.com` as the public publisher contact and completed its verification. The account is declared non-trader.

Local confirmation screenshot: `release/chrome-submission-receipt.png` (not included in the extension ZIP).

Firefox submission is deferred until further testing.

## Next update: one batch with the review pill

Planned 16 October 2026. Chrome reviews every submission, listing edits included, so the 1.0.1 changes, the review pill and the new screenshots go up together once the review pill is merged.

1. Bump the version (Firefox already has 1.0.1, so use 1.0.2), then `npm run build:release` for `release/chrome-1.0.2.zip`.
2. Package tab: upload the zip.
3. Store listing tab: paste the description from `LISTING.md`, replace the screenshot with the four in `store/screenshots/` in the order listed there, and re-upload the icon and both promo tiles, which still show the pre-Buddy look.
4. Privacy tab: no permission changes since 1.0.0, so nothing to edit.
5. Submit for review.
