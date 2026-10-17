#!/bin/sh
# Opens a browser the capture tools can attach to: its own profile (signed in once, kept between runs) and a debugging
# port on this machine only. Chrome by default; pass "dia" to use Dia's app with a profile of its own.
#   e2e/sites/open-browser.sh [chrome|dia] [profile dir]
browser=${1:-chrome}
profile=${2:-$HOME/streambuddy-firefox-test/capture-profile-$browser}
case $browser in
chrome) app="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ;;
dia) app="/Applications/Dia.app/Contents/MacOS/Dia" ;;
*) echo "unknown browser: $browser" >&2 && exit 1 ;;
esac
mkdir -p "$profile"
exec "$app" --user-data-dir="$profile" --remote-debugging-port=9333 --remote-debugging-address=127.0.0.1 \
	--no-first-run --no-default-browser-check \
	https://www.netflix.com/login https://www.primevideo.com https://play.max.com
