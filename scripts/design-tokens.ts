import { writeFileSync } from "node:fs"
import { tokensCss } from "../src/design/tokens-css"

// npm run tokens: rewrites src/design/tokens.css from src/design/tokens.ts
writeFileSync(new URL("../src/design/tokens.css", import.meta.url), tokensCss())
