<script setup lang="ts">
import { useAccount } from "@/components/popup/useAccount"
import { BUILT_IN_TMDB_TOKEN } from "@/utils/account"
const { account, ratingsPaused } = useAccount()
</script>

<template>
	<div class="sb-welcome">
		<img
			src="@/assets/logo.png"
			alt=""
		/>
		<h1>Welcome to streamBuddy</h1>
		<p class="description">
			Letterboxd scores on films and IMDb scores on series, right on Netflix, Prime Video, HBO Max, Disney+ and
			Crunchyroll.
			{{
				ratingsPaused
					? "Ratings are paused: TMDb stopped accepting streamBuddy’s shared key. Add your own free key in step 2 to turn them back on."
					: BUILT_IN_TMDB_TOKEN
						? "Ratings are already on. Add your Letterboxd username to see friends’ ratings too."
						: "Two quick steps and you’re set."
			}}
		</p>
	</div>
	<AccountSetup />
	<p
		v-if="account?.tmdbToken && !ratingsPaused"
		class="sb-done"
	>
		All set. Reload any open streaming tabs, and use the streamBuddy button in your toolbar to adjust what you see.
	</p>
	<p
		v-if="!BUILT_IN_TMDB_TOKEN || ratingsPaused"
		class="description sb-more"
	>
		Stuck on the key?
		<RouterLink to="/options-page/Guide">Read the two-minute guide</RouterLink>
		· You can change these later under Account.
	</p>
</template>

<style scoped>
.sb-welcome {
	max-width: 620px;
	margin-bottom: 20px;
}
.sb-welcome img {
	width: 48px;
	height: 48px;
	border-radius: 12px;
	margin: 0 0 12px;
}
.sb-welcome h1 {
	margin: 0 0 6px;
}
.sb-done {
	max-width: 620px;
	margin-top: 16px;
	padding: 12px 14px;
	border-radius: 10px;
	background: var(--sb-accent-wash);
	border: 1px solid var(--sb-accent-line);
	color: var(--sb-text);
}
.sb-more {
	margin-top: 16px;
}
.sb-more a {
	color: var(--sb-info);
}
</style>
