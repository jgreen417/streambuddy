import { describe, expect, it } from "vitest"
import packageJson from "../../../package.json"

describe("manifest", () => {
	// Chrome rejects a longer description, and it grows with each service it names
	it("keeps the description within Chrome's 132 characters", () => {
		expect(packageJson.description.length).toBeLessThanOrEqual(132)
	})
})
