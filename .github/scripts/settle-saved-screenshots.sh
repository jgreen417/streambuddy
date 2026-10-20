#!/usr/bin/env bash
# Settles a closed pull request's saved-page screenshots in streambuddy-sites (see accept-visuals.yml). Merged into
# the default branch, they become streambuddy-sites' main; merged into another pull request's branch, they move on to
# that branch's own (streambuddy/<base>), which settles in turn when that pull request closes. Either way the pull
# request's branch is deleted.
#
# Needs TOKEN, BRANCH (streambuddy/<head>), MERGED, BASE, DEFAULT and NUMBER in the environment. Prints the
# branch the screenshots went to, if any.
set -euo pipefail
[ -n "$TOKEN" ] || exit 0
remote="https://x-access-token:$TOKEN@github.com/jgreen417/streambuddy-sites.git"
git ls-remote --exit-code --heads "$remote" "$BRANCH" > /dev/null || exit 0
work=$(mktemp -d)
if [ "$MERGED" = true ]; then
	target=main
	[ "$BASE" = "$DEFAULT" ] || target="streambuddy/$BASE"
	git clone -q "$remote" "$work"
	cd "$work"
	git config user.name "github-actions[bot]"
	git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
	# where two pull requests changed the same screenshot, the one merging now is the newer look. Another pull request
	# closing at the same time can push first, so a refused push starts again from what it pushed.
	for attempt in 1 2 3 4 5; do
		git fetch -q origin
		if git rev-parse -q --verify "origin/$target" > /dev/null; then start="origin/$target"; else start=origin/main; fi
		git reset -q --hard "$start"
		git merge -q -X theirs "origin/$BRANCH" -m "Accept saved-page screenshots from streambuddy#$NUMBER"
		git push -q origin "HEAD:refs/heads/$target" && break
		[ "$attempt" = 5 ] && exit 1
		sleep $((attempt * 5))
	done
	echo "$target"
else
	git init -q "$work"
fi
git -C "$work" push -q "$remote" --delete "$BRANCH"
