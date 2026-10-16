<script setup lang="ts"></script>
<template>
	<h1>Getting your free TMDb key</h1>
	<p class="description">
		streamBuddy uses The Movie Database (TMDb) to work out exactly which film or show each card is, so the right
		Letterboxd or IMDb rating appears. TMDb gives every member a free key for personal use. It takes about two minutes.
	</p>
	<ol class="sb-guide">
		<li>
			<strong>Create a free TMDb account.</strong>
			Sign up at
			<a
				href="https://www.themoviedb.org/signup"
				target="_blank"
				rel="noopener"
			>
				themoviedb.org/signup
			</a>
			and confirm your email.
		</li>
		<li>
			<strong>Open the API settings.</strong>
			Go to
			<a
				href="https://www.themoviedb.org/settings/api"
				target="_blank"
				rel="noopener"
			>
				Settings → API
			</a>
			and choose to create a key for a
			<em>Developer</em>
			(personal) app. TMDb asks a few questions: describe it as “Personal use with the streamBuddy browser extension”.
			Any website field can be
			<code>https://letterboxd.com</code>
			.
		</li>
		<li>
			<strong>Copy your key.</strong>
			On the same page, copy the long
			<em>API Read Access Token</em>
			. The shorter
			<em>API Key</em>
			works too.
		</li>
		<li>
			<strong>Paste it into streamBuddy.</strong>
			Back on the
			<RouterLink to="/options-page/Account">Account</RouterLink>
			page, paste it and press Save. Then reload any open Netflix, Prime Video or HBO Max tabs.
		</li>
	</ol>
	<h2>Do I need my own key?</h2>
	<p>
		Usually not: streamBuddy comes with a shared key, so ratings work straight after install. Your own key keeps
		ratings going if TMDb ever pauses the shared one. Either way there’s no server in the middle that sees what you
		browse.
	</p>
	<h2>Is it private?</h2>
	<p>
		The key is kept in your browser’s extension storage, synced only through your own browser account, and sent only to
		api.themoviedb.org. streamBuddy has no server and collects nothing.
	</p>
	<p class="description">
		This product uses the TMDb API but is not endorsed or certified by TMDb. streamBuddy is not affiliated with
		Letterboxd, IMDb, Netflix, Amazon or Warner Bros. Discovery.
	</p>
</template>
<style scoped>
h2 {
	margin: 28px 0 6px;
}
h2 + p {
	margin-top: 0;
	max-width: 620px;
}
.sb-guide {
	display: grid;
	gap: 14px;
	padding-left: 20px;
	max-width: 620px;
}
.sb-guide li {
	line-height: 1.55;
}
.sb-guide a,
p a {
	color: var(--sb-info);
}
code {
	font-size: 13px;
	padding: 1px 5px;
	border-radius: 4px;
	background: var(--sb-line);
}
</style>
