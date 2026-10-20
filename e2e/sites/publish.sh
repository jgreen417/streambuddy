#!/usr/bin/env bash
# Copies saved pages into the private fixtures repo (streambuddy-sites) and pushes them. Only the files the replay and
# the visual checks read go: never a recording or storage.json, which hold the account's session. Stops if any
# copied text file still has one of the given names as a whole word, in any case (the --scrub lists missed it).
# The list is required; --none says there's nothing to look for.
#
#   e2e/sites/publish.sh ~/streambuddy-firefox-test/captures ~/Projects/streambuddy-sites "Steven Green,Anna"
set -euo pipefail
captures=$1 sites=$2 names=${3:?"give the names to look for, comma separated, or --none"}

for state in "$captures"/*/; do
	name=$(basename "$state")
	# a capture that stopped part way has no screenshot yet
	[ -f "$state/meta.json" ] && [ -f "$state/probe.json" ] && [ -f "$state/shot.png" ] || continue
	into="$sites/captures/$name"
	rm -rf "$into"
	mkdir -p "$into"
	for file in page.html images.json resources.json feeds.json probe.json shot.png meta.json resources; do
		[ -e "$state/$file" ] && cp -R "$state/$file" "$into/"
	done
done

if [ "$names" != --none ]; then
	IFS=, read -ra list <<< "$names"
	for name in "${list[@]}"; do
		name="${name#"${name%%[![:space:]]*}"}" name="${name%"${name##*[![:space:]]}"}"
		[ -n "$name" ] || continue
		# fixed strings, so a name with ( or . in it is looked for as written; grep's exit 1 is "not found", 2 an error
		status=0
		grep -rliwF -e "$name" "$sites/captures" --exclude='*.png' --exclude='*.jpg' --exclude='*.webp' || status=$?
		if [ "$status" = 0 ]; then
			echo "Those files still mention \"$name\"; nothing was committed." >&2
			exit 1
		elif [ "$status" != 1 ]; then
			echo "Couldn't search for \"$name\"; nothing was committed." >&2
			exit 1
		fi
	done
fi

git -C "$sites" add captures
git -C "$sites" commit -m "Add captured site pages"
git -C "$sites" push origin HEAD:main
