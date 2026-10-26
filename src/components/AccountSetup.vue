<script setup lang="ts">
import { ref, watch } from "vue"
import {
	BUILT_IN_TMDB_TOKEN,
	checkLetterboxdUsername,
	checkTmdbToken,
	cleanUsername,
	saveAccount,
	type CheckResult,
} from "@/utils/account"
import { useAccount } from "@/components/popup/useAccount"

const { account, ratingsPaused } = useAccount()
const username = ref("")
const token = ref("")
const usernameState = ref<CheckResult | "checking" | "">("")
const tokenState = ref<CheckResult | "checking" | "">("")
const revealToken = ref(false)

// fill the fields once the stored account arrives, without overwriting anything typed meanwhile
watch(
	account,
	(value) => {
		if (!value) return
		if (!username.value) username.value = value.letterboxdUsername
		if (!token.value) token.value = value.ownTmdbToken
		if (value.letterboxdUsername && !usernameState.value) usernameState.value = "ok"
		if (value.ownTmdbToken && !tokenState.value) tokenState.value = "ok"
	},
	{ immediate: true },
)

async function saveUsername() {
	const name = cleanUsername(username.value)
	username.value = name
	if (!name) {
		await saveAccount({ letterboxdUsername: "" })
		usernameState.value = ""
		return
	}
	usernameState.value = "checking"
	const result = await checkLetterboxdUsername(name)
	usernameState.value = result
	// an outage shouldn't block setup; the profile syncs once Letterboxd answers
	if (result !== "invalid") await saveAccount({ letterboxdUsername: name })
}

async function saveToken() {
	const value = token.value.trim()
	token.value = value
	// clearing your own key goes back to the built-in one
	if (!value && BUILT_IN_TMDB_TOKEN) {
		await saveAccount({ tmdbToken: "" })
		tokenState.value = ""
		return
	}
	tokenState.value = "checking"
	const result = await checkTmdbToken(value)
	tokenState.value = result
	if (result !== "invalid") await saveAccount({ tmdbToken: value })
}

const messages: Record<string, Record<string, string>> = {
	username: {
		checking: "Checking Letterboxd…",
		ok: "Saved. Your diary, watchlist and friends will sync.",
		invalid: "No Letterboxd profile has that username.",
		offline: "Saved, but Letterboxd didn’t answer. It will retry.",
	},
	token: {
		checking: "Checking with TMDb…",
		ok: "Key works. Ratings are on.",
		invalid: "TMDb didn’t accept that key. Copy the “API Read Access Token” or the “API Key”.",
		offline: "Saved, but TMDb didn’t answer. Check your connection.",
	},
}
</script>

<template>
	<div class="sb-setup">
		<section class="sb-step">
			<div class="sb-step-head">
				<span class="sb-step-num">1</span>
				<div>
					<h2>Your Letterboxd username</h2>
					<p>Optional. Adds friends’ ratings, marks films you’ve seen and shows your watchlist.</p>
				</div>
			</div>
			<form
				class="sb-field"
				@submit.prevent="saveUsername"
			>
				<label
					class="sr-only"
					for="sb-username"
				>
					Letterboxd username
				</label>
				<span class="sb-prefix">letterboxd.com/</span>
				<input
					id="sb-username"
					v-model="username"
					type="text"
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					placeholder="username"
				/>
				<button
					type="submit"
					:disabled="usernameState === 'checking'"
				>
					Save
				</button>
			</form>
			<p
				v-if="usernameState"
				class="sb-status"
				:class="`is-${usernameState}`"
				role="status"
			>
				{{ messages.username[usernameState] }}
			</p>
		</section>

		<section class="sb-step">
			<div class="sb-step-head">
				<span class="sb-step-num">2</span>
				<div>
					<template v-if="BUILT_IN_TMDB_TOKEN && !ratingsPaused">
						<h2>Your own TMDb key</h2>
						<p>
							Optional. Ratings already work with streamBuddy’s shared key. Add your own free key only if ratings ever
							pause.
							<RouterLink to="/options-page/Guide">How to get one →</RouterLink>
						</p>
					</template>
					<template v-else>
						<h2>Your free TMDb key</h2>
						<p>
							<template v-if="ratingsPaused">
								TMDb stopped accepting streamBuddy’s shared key, so ratings need your own.
							</template>
							<template v-else>Needed for ratings.</template>
							streamBuddy uses The Movie Database to work out which film or show each card is. A key is free and takes
							about two minutes.
							<RouterLink to="/options-page/Guide">How to get one →</RouterLink>
						</p>
					</template>
				</div>
			</div>
			<form
				class="sb-field"
				@submit.prevent="saveToken"
			>
				<label
					class="sr-only"
					for="sb-token"
				>
					TMDb API key or read access token
				</label>
				<input
					id="sb-token"
					v-model="token"
					:type="revealToken ? 'text' : 'password'"
					autocomplete="off"
					spellcheck="false"
					placeholder="Paste your API Read Access Token"
				/>
				<button
					type="button"
					class="sb-ghost"
					:aria-pressed="revealToken"
					@click="revealToken = !revealToken"
				>
					{{ revealToken ? "Hide" : "Show" }}
				</button>
				<button
					type="submit"
					:disabled="tokenState === 'checking' || (!token.trim() && !BUILT_IN_TMDB_TOKEN)"
				>
					Save
				</button>
			</form>
			<p
				v-if="tokenState"
				class="sb-status"
				:class="`is-${tokenState}`"
				role="status"
			>
				{{ messages.token[tokenState] }}
			</p>
			<p class="sb-fine">
				Lookups go straight from your browser to api.themoviedb.org. A key you add stays in your browser’s extension
				storage. This product uses the TMDb API but is not endorsed or certified by TMDb.
			</p>
		</section>
	</div>
</template>

<style scoped>
.sb-setup {
	display: grid;
	gap: 16px;
	max-width: 620px;
	text-align: left;
}
.sb-step {
	padding: 18px;
	border-radius: var(--sb-radius-xl);
	background: var(--sb-surface-sunken);
	border: 1px solid var(--sb-hairline);
}
.sb-step-head {
	display: flex;
	gap: 12px;
	align-items: flex-start;
}
.sb-step-head h2 {
	margin: 0 0 2px;
	font-size: 15px;
	font-weight: 600;
	color: var(--sb-text);
}
.sb-step-head p {
	margin: 0;
	font-size: 13px;
	line-height: 1.5;
	color: var(--sb-text-muted);
}
.sb-step-head a {
	color: var(--sb-info);
	text-decoration: none;
	white-space: nowrap;
}
.sb-step-num {
	flex: none;
	display: grid;
	place-items: center;
	width: 24px;
	height: 24px;
	border-radius: 50%;
	background: var(--sb-surface-raised);
	color: var(--sb-text);
	font-size: 12px;
	font-weight: 600;
}
.sb-field {
	display: flex;
	align-items: center;
	gap: 6px;
	margin: 14px 0 0 36px;
	padding: 4px;
	border-radius: var(--sb-radius-md);
	background: var(--sb-field);
	border: 1px solid var(--sb-line-raised);
}
.sb-field:focus-within {
	border-color: var(--sb-line-active);
}
.sb-prefix {
	padding-left: 8px;
	font-size: 14px;
	color: var(--sb-text-muted);
}
.sb-field input {
	flex: 1;
	min-width: 0;
	padding: 6px 4px;
	border: 0 !important;
	background: transparent !important;
	color: var(--sb-text);
	font-size: 14px;
	outline: none;
}
.sb-field button {
	flex: none;
	padding: 6px 14px;
	border-radius: var(--sb-radius-sm);
	border: 0;
	background: var(--sb-accent);
	color: var(--sb-text-on-accent);
	font-size: 13px;
	font-weight: 600;
	cursor: pointer;
}
.sb-field button:disabled {
	opacity: 0.45;
	cursor: default;
}
.sb-field button.sb-ghost {
	background: transparent;
	color: var(--sb-text-muted);
	font-weight: 500;
}
.sb-field button:focus-visible {
	outline: 2px solid var(--sb-focus);
	outline-offset: 2px;
}
.sb-status {
	margin: 8px 0 0 36px;
	font-size: 13px;
	color: var(--sb-text-muted);
}
.sb-status.is-ok {
	color: var(--sb-up);
}
.sb-status.is-invalid {
	color: var(--sb-danger);
}
.sb-status.is-offline {
	color: var(--sb-warning);
}
.sb-fine {
	margin: 10px 0 0 36px;
	font-size: 12px;
	color: var(--sb-text-muted);
}
.sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	overflow: hidden;
	clip: rect(0 0 0 0);
	white-space: nowrap;
}
@media (max-width: 520px) {
	.sb-field,
	.sb-status,
	.sb-fine {
		margin-left: 0;
	}
	.sb-prefix {
		display: none;
	}
}
</style>
