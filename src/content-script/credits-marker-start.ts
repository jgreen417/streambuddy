// Puts the credits-marker reader into the players' pages as they start loading (Max, primevideo.com and Amazon's
// /gp/video pages), so it sees the player's first title even when the page is opened straight on it. Prime Video on
// other amazon.* pages waits for the main content script, which only knows it's Prime Video once the page has loaded.
import { injectCreditsMarkerReader } from "./credits-marker"

injectCreditsMarkerReader()
