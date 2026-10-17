// Puts the credits-marker reader into Max's and primevideo.com's pages as they start loading, so it sees the player's
// first title even when the page is opened straight on it. Prime Video on amazon.* waits for the main content script,
// which only knows it's a Prime Video page once the page has loaded.
import { injectCreditsMarkerReader } from "./credits-marker"

injectCreditsMarkerReader()
