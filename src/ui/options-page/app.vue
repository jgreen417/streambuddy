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
						stream
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
					v-for="service in [
						{ route: 'Netflix', name: 'Netflix' },
						{ route: 'Amazon', name: 'Prime Video' },
						{ route: 'Disney', name: 'Disney+' },
						{ route: 'HBO', name: 'HBO Max' },
						{ route: 'Paramount', name: 'Paramount+' },
						{ route: 'Crunchyroll', name: 'Crunchyroll' },
					]"
					:key="service.route"
					:to="`/options-page/${service.route}`"
					class="menuButton flex"
					:class="{ 'is-active': hash.endsWith(service.route) }"
					draggable="false"
				>
					<i-mdi-play-circle-outline class="icon" />
					<div>{{ service.name }}</div>
				</RouterLink>
				<RouterLink
					to="/options-page/SharedSettings"
					class="menuButton flex"
					:class="{ 'is-active': hash.endsWith('SharedSettings') }"
					draggable="false"
				>
					<i-mdi-cog-outline class="icon" />
					<div>Advanced settings</div>
				</RouterLink>
				<RouterLink
					to="/options-page/HiddenTitles"
					class="menuButton flex"
					:class="{ 'is-active': hash.endsWith('HiddenTitles') }"
					draggable="false"
				>
					<i-mdi-eye-off-outline class="icon" />
					<div>{{ $t("hiddenTitlesNav") }}</div>
				</RouterLink>
				<RouterLink
					to="/options-page/Statistics"
					class="menuButton flex"
					:class="{ 'is-active': hash.endsWith('Statistics') }"
					draggable="false"
				>
					<i-mdi-chart-bar class="icon" />
					<div>{{ $t("statistics") }}</div>
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
/* streamBuddy: same quiet dark palette as the popup */
body {
	background: #0b0d10;
	color: #e8eaed;
	font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, "Segoe UI", sans-serif;
	-webkit-font-smoothing: antialiased;
}
.sidenav {
	@apply h-full px-3 gap-1;
	min-width: 230px;
	background: #0b0d10;
	border-right: 1px solid rgba(255, 255, 255, 0.07);
}
.menuButton {
	@apply rounded-lg m-0 px-3 py-2 no-underline whitespace-nowrap cursor-pointer select-none items-center gap-2;
	color: #8a929b;
	font-size: 14px;
	font-weight: 500;
	transition:
		background 0.15s,
		color 0.15s;
}
.menuButton:hover {
	background-color: rgba(255, 255, 255, 0.05);
	color: #e8eaed;
}
.menuButton p,
.menuButton div {
	margin: 0;
	font-size: inherit;
	font-weight: inherit;
}
.menuButton.is-active {
	background-color: rgba(255, 255, 255, 0.1);
	box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
	color: #f1f3f5;
}
.IconBox {
	@apply flex items-center gap-3 px-2 pt-6 pb-5;
}
.Logo {
	@apply h-9 w-9 rounded-lg;
}
.title {
	font-size: 14px;
	font-weight: 600;
	letter-spacing: -0.01em;
	color: #e8eaed;
}
.title span {
	color: #8a929b;
	font-weight: 500;
}
.version {
	font-size: 12px;
	color: #8a929b;
}
.credit {
	padding: 16px 8px 20px;
	font-size: 12px;
	line-height: 1.5;
	color: #8a929b;
}
.credit a {
	color: #8a929b;
}
.credit .links {
	display: block;
	margin-bottom: 6px;
}
.credit .support {
	display: block;
	margin-bottom: 8px;
	color: #e8eaed;
	font-weight: 500;
	text-decoration: none;
}
.credit .support:hover {
	color: #00e054;
}

/* settings pages: calmer type, neutral buttons and inputs */
.content {
	font-size: 14px;
	line-height: 1.5;
}
.content h1 {
	font-size: 20px;
	font-weight: 600;
	/* service-coloured headings (Netflix red #e60010) fail WCAG contrast on this background */
	color: #e8eaed !important;
	letter-spacing: -0.01em;
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
	border-color: rgba(255, 255, 255, 0.08) !important;
}
.content table {
	border-color: rgba(255, 255, 255, 0.08) !important;
}
.content th {
	font-weight: 500;
	color: #8a929b;
}
.content .description {
	color: #8a929b;
}
.content hr {
	border-color: rgba(255, 255, 255, 0.07);
}
.content .btn {
	font-size: 14px;
	background: rgba(255, 255, 255, 0.07);
	border: 1px solid rgba(255, 255, 255, 0.1);
	color: #e8eaed;
	box-shadow: none;
	font-weight: 500;
}
.content .btn:hover {
	background: rgba(255, 255, 255, 0.12);
}
.content input:not([type="checkbox"]),
.content select {
	background: #15191d;
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 6px;
	color: #e8eaed;
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
	outline: 2px solid #b7c9df;
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
		border-bottom: 1px solid #ffffff12;
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
