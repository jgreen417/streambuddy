import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { tokensCss } from "@/design/tokens-css"

const SRC = path.resolve(__dirname, "../..")
const read = (file: string) => readFileSync(path.join(SRC, file), "utf8")

describe("design tokens", () => {
	it("tokens.css is up to date with tokens.ts (run npm run tokens)", () => {
		expect(read("design/tokens.css")).toBe(tokensCss())
	})

	// colours belong in src/design/tokens.ts, so the palette stays in one place
	it("no raw colours outside the tokens", () => {
		const raw = /(?<!&)#[0-9a-f]{3,8}\b|rgba?\(\s*\d/i
		const found: string[] = []
		for (const file of readdirSync(SRC, { recursive: true, encoding: "utf8" })) {
			if (!/\.(ts|vue|css)$/.test(file) || /^(design|tests|types)\//.test(file)) continue
			// daisyUI's light theme is inherited from the original extension and never shown
			const source = read(file).replace(/name: "light";[^}]*/, (theme) => theme.replace(/[^\n]/g, ""))
			source.split("\n").forEach((line, i) => {
				if (raw.test(line)) found.push(`${file}:${i + 1}: ${line.trim()}`)
			})
		}
		expect(found).toEqual([])
	})
})
