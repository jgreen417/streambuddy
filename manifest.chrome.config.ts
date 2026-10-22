import { defineManifest } from "@crxjs/vite-plugin"
import ManifestConfig from "./manifest.config.ts"

export default defineManifest(() => ({
	...ManifestConfig,
}))
