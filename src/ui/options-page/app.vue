<script setup lang="ts">
import { DONATE_URL, ISSUES_URL, PRIVACY_URL, SOURCE_URL } from "@/constants/links"
const version = __VERSION__
import { useFrontendStore } from "@/stores/options.store"
// wont sync without opening once
useFrontendStore()
const router = useRouter()
const hash = ref(router.currentRoute.value.path)
// watch router route changed
watch(
	() => router.currentRoute.value.path,
	(newHash) => {
		hash.value = newHash
	},
	{
		immediate: true,
		deep: true,
	},
)
</script>
<template>
	<div
		class="wrapper"
		style="height: calc(min(100vh, 1800px))"
	>
		<div class="sidenav flex flex-col">
			<div class="IconBox">
				<img
					class="Logo"
					src="@/assets/logo.png"
					alt=""
				/>
				<div>
					<div class="title">
						<span>stream</span>
						<span>Buddy</span>
					</div>
					<p class="version">All settings · v{{ version }}</p>
				</div>
			</div>
			<nav
				class="flex flex-col MenuButtons"
				aria-label="Settings"
			>
				<RouterLink
					to="/options-page/Account"
					class="menuButton flex"
					:class="{ 'is-active': hash.endsWith('Account') || hash.endsWith('Guide') || hash.endsWith('install') }"
					draggable="false"
				>
					<i-mdi-account-circle-outline class="icon" />
					<div>Account</div>
				</RouterLink>
				<RouterLink
					to="/options-page/Experience"
					class="menuButton flex"
					:class="{ 'is-active': hash.endsWith('Experience') }"
					draggable="false"
				>
					<i-mdi-tune class="icon" />
					<div>Viewing preferences</div>
				</RouterLink>
				<RouterLink
					to="/options-page/Playback"
					class="menuButton flex"
					:class="{ 'is-active': hash.endsWith('Playback') }"
					draggable="false"
				>
					<i-mdi-play-circle-outline class="icon" />
					<div>Playback</div>
				</RouterLink>
				<RouterLink
					to="/options-page/Backup"
					class="menuButton flex"
					:class="{ 'is-active': hash.endsWith('Backup') }"
					draggable="false"
				>
					<i-mdi-backup-restore class="icon" />
					<div>{{ $t("backup") }}</div>
				</RouterLink>
				<RouterLink
					to="/options-page/Changelog"
					class="menuButton flex"
					:class="{ 'is-active': hash.endsWith('Changelog') }"
					draggable="false"
				>
					<i-mdi-format-list-bulleted class="icon" />
					<div>{{ $t("changelog") }}</div>
				</RouterLink>
			</nav>
			<div class="mt-auto credit">
				<a
					v-if="DONATE_URL"
					class="support"
					:href="DONATE_URL"
					target="_blank"
					rel="noopener"
				>
					♥ Support streamBuddy
				</a>
				<span class="links">
					<a
						:href="SOURCE_URL"
						target="_blank"
						rel="noopener"
					>
						Source
					</a>
					·
					<a
						:href="PRIVACY_URL"
						target="_blank"
						rel="noopener"
					>
						Privacy
					</a>
					·
					<a
						:href="ISSUES_URL"
						target="_blank"
						rel="noopener"
					>
						Report a problem
					</a>
				</span>
				Based on
				<a
					href="https://github.com/Dreamlinerm/Netflix-Prime-Auto-Skip"
					target="_blank"
					rel="noopener"
				>
					Streaming enhanced
				</a>
				by Dreamlinerm · GPL-3.0
			</div>
		</div>
		<div class="content flex flex-col overflow-y-auto w-full">
			<div class="page">
				<div class="p-4 prose">
					<RouterView />
				</div>
			</div>
		</div>
	</div>
</template>

<style>
@import "@/assets/base.css";
/* streamBuddy: same "Buddy" palette and type as the popup */
body {
	background: #1b1918;
	color: #fbf4ec;
	font-family:
		"Bricolage Grotesque Variable",
		"Bricolage Grotesque",
		-apple-system,
		BlinkMacSystemFont,
		"Segoe UI",
		sans-serif;
	-webkit-font-smoothing: antialiased;
}
.sidenav {
	@apply h-full px-3 gap-1;
	min-width: 230px;
	background: #1b1918;
	border-right: 1px solid rgba(251, 244, 236, 0.07);
}
.menuButton {
	@apply rounded-lg m-0 px-3 py-2 no-underline whitespace-nowrap cursor-pointer select-none items-center gap-2;
	color: #a39b93;
	font-size: 14px;
	font-weight: 500;
	transition:
		background 0.15s,
		color 0.15s;
}
.menuButton:hover {
	background-color: rgba(251, 244, 236, 0.05);
	color: #fbf4ec;
}
.menuButton p,
.menuButton div {
	margin: 0;
	font-size: inherit;
	font-weight: inherit;
}
.menuButton.is-active {
	background-color: #fbf4ec;
	color: #1b1918;
	font-weight: 700;
}
.IconBox {
	@apply flex items-center gap-3 px-2 pt-6 pb-5;
}
.Logo {
	@apply h-9 w-9 rounded-lg;
}
.title {
	font-size: 17px;
	font-weight: 800;
	letter-spacing: -0.035em;
	line-height: 1.1;
	color: #fbf4ec;
}
.title span + span {
	color: #ff7a45;
}
.version {
	font-size: 12px;
	color: #a39b93;
}
.credit {
	padding: 16px 8px 20px;
	font-size: 12px;
	line-height: 1.5;
	color: #a39b93;
}
.credit a {
	color: #a39b93;
}
.credit .links {
	display: block;
	margin-bottom: 6px;
}
.credit .support {
	display: block;
	margin-bottom: 8px;
	color: #fbf4ec;
	font-weight: 500;
	text-decoration: none;
}
.credit .support:hover {
	color: #ff7a45;
}

/* settings pages: calmer type, neutral buttons and inputs */
.content {
	font-size: 14px;
	line-height: 1.5;
}
.content h1 {
	font-size: 22px;
	font-weight: 800;
	/* service-coloured headings (Netflix red #e60010) fail WCAG contrast on this background */
	color: #fbf4ec !important;
	letter-spacing: -0.03em;
}
.content h2,
.content h3 {
	font-size: 14px;
	font-weight: 600;
}
.content p,
.content td,
.content th,
.content label {
	font-size: 14px;
}
.content th,
.content td {
	padding: 4px 8px;
	border-color: rgba(251, 244, 236, 0.08) !important;
}
.content table {
	border-color: rgba(251, 244, 236, 0.08) !important;
}
.content th {
	font-weight: 500;
	color: #a39b93;
}
.content .description {
	color: #a39b93;
}
.content hr {
	border-color: rgba(251, 244, 236, 0.07);
}
.content .btn {
	font-size: 14px;
	background: rgba(251, 244, 236, 0.07);
	border: 1px solid rgba(251, 244, 236, 0.1);
	color: #fbf4ec;
	box-shadow: none;
	font-weight: 500;
}
.content .btn:hover {
	background: rgba(251, 244, 236, 0.12);
}
.content input:not([type="checkbox"]),
.content select {
	background: #262220;
	border: 1px solid rgba(251, 244, 236, 0.1);
	border-radius: 6px;
	color: #fbf4ec;
}
.content {
	@apply min-w-[200px] min-h-[450px];
}
.page {
	@apply p-[80px_0_0_3%] w-[97%];
}

.icon {
	@apply w-5 h-5 m-0;
}
.wrapper {
	@apply flex flex-row;
}

/* Keep every service identifiable when settings move to a small window. */
.menuButton:focus-visible {
	outline: 2px solid #ffb38f;
	outline-offset: 2px;
}
@media (max-width: 900px), (max-height: 700px) {
	.wrapper {
		flex-direction: column;
	}
	.sidenav {
		height: auto;
		min-width: 0;
		flex-shrink: 0;
		border-right: 0;
		border-bottom: 1px solid #fbf4ec12;
	}
	.IconBox {
		display: flex;
		flex-direction: row;
		padding: 12px 8px 8px;
	}
	.MenuButtons {
		flex-direction: row;
		flex-wrap: nowrap;
		justify-content: flex-start;
		overflow-x: auto;
		padding: 4px 0 10px;
		scrollbar-width: thin;
	}
	.menuButton {
		flex-shrink: 0;
		margin: 0;
		padding: 8px 10px;
	}
	.menuButton p,
	.menuButton div {
		display: block;
	}
	.credit {
		display: none;
	}
	.content {
		min-height: 0;
		min-width: 0;
	}
	.page {
		padding: 0;
		margin: 0;
		width: 100%;
	}
	.content table {
		display: block;
		max-width: 100%;
		overflow-x: auto;
	}
}
</style>
