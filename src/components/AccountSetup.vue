<script setup lang="ts">
import { ref, watch } from "vue"
import { checkLetterboxdUsername, checkTmdbToken, cleanUsername, saveAccount, type CheckResult } from "@/utils/account"
import { useAccount } from "@/components/popup/useAccount"

const { account } = useAccount()
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
		if (!token.value) token.value = value.tmdbToken
		if (value.letterboxdUsername && !usernameState.value) usernameState.value = "ok"
		if (value.tmdbToken && !tokenState.value) tokenState.value = "ok"
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
					<h2>Your free TMDb key</h2>
					<p>
						Needed for ratings. streamBuddy uses The Movie Database to work out which film or show each card is. A key
						is free and takes about two minutes.
						<RouterLink to="/options-page/Guide">How to get one →</RouterLink>
					</p>
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
					:disabled="tokenState === 'checking' || !token.trim()"
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
				Your key stays in your browser’s extension storage and is only ever sent to api.themoviedb.org.
			</p>
		</section>
	</div>
</template>

<style scoped>
.sb-setup {
	display: grid;
	gap: 16px;
	max-width: 560px;
	text-align: left;
}
.sb-step {
	padding: 18px;
	border-radius: 12px;
	background: rgba(251, 244, 236, 0.04);
	border: 1px solid rgba(251, 244, 236, 0.08);
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
	color: #fbf4ec;
}
.sb-step-head p {
	margin: 0;
	font-size: 13px;
	line-height: 1.5;
	color: #a39b93;
}
.sb-step-head a {
	color: #8ec5ff;
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
	background: rgba(251, 244, 236, 0.1);
	color: #fbf4ec;
	font-size: 12px;
	font-weight: 600;
}
.sb-field {
	display: flex;
	align-items: center;
	gap: 6px;
	margin: 14px 0 0 36px;
	padding: 4px;
	border-radius: 8px;
	background: #262220;
	border: 1px solid rgba(251, 244, 236, 0.1);
}
.sb-field:focus-within {
	border-color: rgba(251, 244, 236, 0.28);
}
.sb-prefix {
	padding-left: 8px;
	font-size: 14px;
	color: #a39b93;
}
.sb-field input {
	flex: 1;
	min-width: 0;
	padding: 6px 4px;
	border: 0 !important;
	background: transparent !important;
	color: #fbf4ec;
	font-size: 14px;
	outline: none;
}
.sb-field button {
	flex: none;
	padding: 6px 14px;
	border-radius: 6px;
	border: 0;
	background: #ff7a45;
	color: #1b1918;
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
	color: #a39b93;
	font-weight: 500;
}
.sb-field button:focus-visible {
	outline: 2px solid #ffb38f;
	outline-offset: 2px;
}
.sb-status {
	margin: 8px 0 0 36px;
	font-size: 13px;
	color: #a39b93;
}
.sb-status.is-ok {
	color: #7ad9a0;
}
.sb-status.is-invalid {
	color: #ff8a8a;
}
.sb-status.is-offline {
	color: #ffd23f;
}
.sb-fine {
	margin: 10px 0 0 36px;
	font-size: 12px;
	color: #a39b93;
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
