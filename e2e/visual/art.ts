// Stand-in artwork for the fixture pages, drawn as SVG so no real posters are needed. Each image is a two-tone
// gradient with a few shapes, plus whatever the service bakes into its real artwork at the same place:
// Netflix's Top 10 tag and "Recently added" strip, and Prime's channel logo (taken from the _CLs box in the URL,
// exactly where Prime's own image would have it).
export function artSvg(url: URL): string {
	const params = url.searchParams
	const w = Number(params.get("w") ?? 320)
	const h = Number(params.get("h") ?? 180)
	const hue = Number(params.get("hue") ?? 20)
	const tags = (params.get("tags") ?? "").split(",").filter(Boolean)
	const parts: string[] = [
		`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 55% 42%)"/><stop offset="1" stop-color="hsl(${(hue + 50) % 360} 45% 16%)"/></linearGradient></defs>`,
		`<rect width="${w}" height="${h}" fill="url(#g)"/>`,
		`<circle cx="${w * 0.3}" cy="${h * 0.45}" r="${Math.min(w, h) * 0.22}" fill="hsl(${(hue + 180) % 360} 60% 70%)" opacity="0.55"/>`,
		`<rect x="${w * 0.08}" y="${h * 0.72}" width="${w * 0.45}" height="${h * 0.07}" rx="${h * 0.02}" fill="#fff" opacity="0.8"/>`,
	]
	// a light patch in the badge's corner, so a badge that drifts off the artwork shows up against the page
	parts.push(`<rect x="${w * 0.6}" y="0" width="${w * 0.4}" height="${h}" fill="#fff" opacity="0.12"/>`)
	if (tags.includes("top10")) {
		const s = Math.min(w, h) * 0.2
		parts.push(`<rect x="${w - s * 0.8}" y="0" width="${s * 0.8}" height="${s}" fill="#e50914"/>`)
	}
	if (tags.includes("recent"))
		parts.push(`<rect x="${w * 0.3}" y="${h * 0.88}" width="${w * 0.4}" height="${h * 0.12}" rx="2" fill="#e50914"/>`)
	const logo = primeLogoBox(decodeURIComponent(url.pathname))
	if (logo) {
		const sx = w / logo.width
		const sy = h / logo.height
		parts.push(
			`<rect x="${logo.x * sx}" y="${logo.y * sy}" width="${logo.w * sx}" height="${logo.h * sy}" rx="${4 * sx}" fill="#00a8e1"/>`,
		)
	}
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join("")}</svg>`
}

// Prime's image URLs say where the channel logo is composited: _CLs|W,H|...channels-logo...|...+x,y,w,h
export function primeLogoBox(path: string) {
	const match = /_CLs\|(\d+),(\d+)\|[^|]*channels-logo[^|]*\|(?:\d+,\d+,\d+,\d+\+)*(\d+),(\d+),(\d+),(\d+)/.exec(path)
	if (!match) return null
	const [width, height, x, y, w, h] = match.slice(1).map(Number)
	return { width, height, x, y, w, h }
}

// A silent WAV of the given length: the player fixture's "film", long enough for the credits prompt to count it.
export function silentWav(seconds: number, sampleRate = 4000) {
	const dataSize = seconds * sampleRate
	const buffer = Buffer.alloc(44 + dataSize, 0x80)
	buffer.write("RIFF", 0)
	buffer.writeUInt32LE(36 + dataSize, 4)
	buffer.write("WAVEfmt ", 8)
	buffer.writeUInt32LE(16, 16)
	buffer.writeUInt16LE(1, 20)
	buffer.writeUInt16LE(1, 22)
	buffer.writeUInt32LE(sampleRate, 24)
	buffer.writeUInt32LE(sampleRate, 28)
	buffer.writeUInt16LE(1, 32)
	buffer.writeUInt16LE(8, 34)
	buffer.write("data", 36)
	buffer.writeUInt32LE(dataSize, 40)
	return buffer
}
