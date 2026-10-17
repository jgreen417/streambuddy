// npm run sites:report [-- --coverage]
// Opens every saved page in headless Chromium, runs probe.ts on it and writes what streamBuddy's site code makes of
// each page to e2e/.sites/<state>.json. With --coverage it also writes coverage.md: which lines of the site-reading
// code no saved page reaches, so a missing capture shows up as a named gap rather than a surprise on the live site.
import { chromium } from "@playwright/test"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { SourceMapConsumer, type RawSourceMap } from "source-map-js"
import { handle } from "../visual/harness"
import { bundleProbe, PROBE_URL, runProbe } from "./bundle"
import { STATES } from "./states"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const OUT = path.join(ROOT, "e2e/.sites")
// the code that reads the streaming sites; everything else streamBuddy does is the same on every service
const SITE_CODE = [
	"src/content-script/sites/",
	"src/playback/sites/",
	"src/utils/page-features.ts",
	"src/utils/netflix-shows.ts",
	"src/utils/netflix-credits.ts",
]

type Ranges = { startOffset: number; endOffset: number; count: number }[]
type ScriptCoverage = { url: string; functions: { ranges: Ranges }[] }

async function main() {
	const withCoverage = process.argv.includes("--coverage")
	const script = await bundleProbe()
	const browser = await chromium.launch()
	await mkdir(OUT, { recursive: true })
	const runs: Ranges[] = []
	for (const state of STATES) {
		const context = await browser.newContext({ viewport: state.viewport ?? { width: 1440, height: 900 } })
		await context.route(/^https?:\/\//, handle)
		const page = await context.newPage()
		const cdp = await context.newCDPSession(page)
		if (withCoverage) {
			await cdp.send("Profiler.enable")
			await cdp.send("Profiler.startPreciseCoverage", { callCount: true, detailed: true })
		}
		await page.goto(state.url)
		await page.waitForLoadState("networkidle")
		await state.prepare?.(page)
		const report = await runProbe(page, state.service, script)
		await writeFile(path.join(OUT, `${state.name}.json`), JSON.stringify(report, null, "\t"))
		if (withCoverage) {
			const { result } = (await cdp.send("Profiler.takePreciseCoverage")) as { result: ScriptCoverage[] }
			const probe = result.find((entry) => entry.url.endsWith(PROBE_URL))
			if (probe) runs.push(probe.functions.flatMap((fn) => fn.ranges))
		}
		console.log(
			`${state.name}: ${report.cards.length} cards, ${report.episodes.length} episodes${report.player ? ", player" : ""}`,
		)
		await context.close()
	}
	await browser.close()
	if (withCoverage) {
		const markdown = await coverageReport(script, runs)
		await writeFile(path.join(OUT, "coverage.md"), markdown)
		console.log(`\n${markdown}`)
	}
}

// A line counts as reached when any run executed code on it. V8 reports nested ranges, innermost last, so a line's
// count on one run is that of the innermost range around its first character of code.
async function coverageReport(script: string, runs: Ranges[]) {
	const map = JSON.parse(
		Buffer.from(/sourceMappingURL=data:application\/json;base64,(\S+)/.exec(script)![1], "base64").toString(),
	) as RawSourceMap
	const lineStarts = [0]
	for (let i = 0; i < script.length; i++) if (script[i] === "\n") lineStarts.push(i + 1)
	const offsetOf = (line: number, column: number) => lineStarts[line - 1] + column
	const reached = new Map<string, Set<number>>()
	const seen = new Map<string, Set<number>>()
	new SourceMapConsumer(map).eachMapping((mapping) => {
		// code esbuild wrote itself (the bundle's wrapper) maps to no source
		if (mapping.source === null || mapping.originalLine === null) return
		const file = path.relative(ROOT, path.resolve(ROOT, mapping.source))
		if (!SITE_CODE.some((prefix) => file.startsWith(prefix))) return
		const offset = offsetOf(mapping.generatedLine, mapping.generatedColumn)
		const lines = seen.get(file) ?? seen.set(file, new Set()).get(file)!
		lines.add(mapping.originalLine)
		const hit = runs.some((ranges) => {
			let count = 0
			for (const range of ranges) if (range.startOffset <= offset && offset < range.endOffset) count = range.count
			return count > 0
		})
		if (hit) (reached.get(file) ?? reached.set(file, new Set()).get(file)!).add(mapping.originalLine)
	})
	const rows: string[] = ["| File | Lines reached | Never reached |", "|---|---|---|"]
	for (const file of [...seen.keys()].sort()) {
		const all = [...seen.get(file)!].sort((a, b) => a - b)
		const hit = reached.get(file) ?? new Set()
		const missed = all.filter((line) => !hit.has(line))
		rows.push(`| ${file} | ${all.length - missed.length}/${all.length} | ${spans(missed)} |`)
	}
	const source = async (file: string) => (await readFile(path.join(ROOT, file), "utf8")).split("\n")
	const detail: string[] = []
	for (const file of [...seen.keys()].sort()) {
		const hit = reached.get(file) ?? new Set()
		const missed = [...seen.get(file)!].filter((line) => !hit.has(line)).sort((a, b) => a - b)
		if (!missed.length) continue
		const lines = await source(file)
		detail.push(`\n### ${file}\n\n\`\`\`ts`, ...missed.map((line) => `${line}: ${lines[line - 1].trim()}`), "```")
	}
	return [`# Site code reached by the saved pages\n`, `${STATES.length} saved states.\n`, ...rows, ...detail].join("\n")
}

function spans(lines: number[]) {
	const out: string[] = []
	for (let i = 0; i < lines.length; i++) {
		let j = i
		while (lines[j + 1] === lines[j] + 1) j++
		out.push(i === j ? `${lines[i]}` : `${lines[i]}-${lines[j]}`)
		i = j
	}
	return out.join(", ")
}

await main()
