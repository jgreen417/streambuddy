#!/usr/bin/env bash
# Copies saved pages into the private fixtures repo (streambuddy-sites) and pushes them. Only the files the replay and
# the visual checks read go: never a recording or storage.json, which hold the account's session. Stops if any
# copied file still mentions one of the given names (the --scrub lists missed something).
#
#   e2e/sites/publish.sh ~/streambuddy-firefox-test/captures ~/Projects/streambuddy-sites "Name One,Name Two"
set -euo pipefail
captures=$1 sites=$2 names=${3:-}

for state in "$captures"/*/; do
	name=$(basename "$state")
	[ -f "$state/meta.json" ] || continue
	into="$sites/captures/$name"
	rm -rf "$into"
	mkdir -p "$into"
	for file in page.html images.json resources.json feeds.json probe.json shot.png meta.json resources; do
		[ -e "$state/$file" ] && cp -R "$state/$file" "$into/"
	done
done

if [ -n "$names" ]; then
	pattern=$(echo "$names" | sed 's/ *, */|/g')
	if grep -rliE "$pattern" "$sites/captures" --include='*.html' --include='*.json'; then
		echo "Those files still mention a name from the list; nothing was committed." >&2
		exit 1
	fi
fi

git -C "$sites" add captures
git -C "$sites" commit -m "Add captured site pages"
git -C "$sites" push origin HEAD:main
