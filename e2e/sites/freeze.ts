// Runs inside the page being captured (passed to page.evaluate, so it can't use anything outside itself). Turns the
// page as it is right now into one static HTML document: the DOM including open shadow roots, every stylesheet
// inlined in document order, no scripts. The parts a static copy can't hold (scroll offsets, the video's place) are
// written onto the elements as data-sb-* attributes for the replay to restore.
export type FreezeInput = {
	// text of the stylesheets the page can't read itself (cross-origin), by URL, from the recorded network traffic
	sheets: Record<string, string>
	// words to replace wherever they appear in text or attributes: profile names and the like
	scrub: string[]
}
export type FrozenPage = {
	html: string
	// every image the page shows, by URL, with the size it was drawn at, so the replay can serve a same-size stand-in
	images: Record<string, [number, number]>
	// stylesheets the page loaded but neither it nor the recording had the text of
	missingSheets: string[]
}

export function freeze({ sheets, scrub }: FreezeInput): FrozenPage {
	const missingSheets: string[] = []
	const absolute = (url: string, base: string) => {
		try {
			return new URL(url, base).href
		} catch {
			return url
		}
	}
	// url(...) in a stylesheet is relative to the sheet, which won't be where the copy is served from
	const rebase = (css: string, base: string) =>
		css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (whole, quote, url) =>
			url.startsWith("data:") ? whole : `url("${absolute(url, base)}")`,
		)
	const sheetText = (sheet: CSSStyleSheet) => {
		try {
			return Array.from(sheet.cssRules, (rule) => rule.cssText).join("\n")
		} catch {
			if (sheet.href && sheets[sheet.href] !== undefined) return sheets[sheet.href]
			if (sheet.href) missingSheets.push(sheet.href)
			return ""
		}
	}

	// mark what the copy has to restore, on the live elements, before serialising
	const marked: Element[] = []
	const mark = (el: Element, name: string, value: string) => {
		el.setAttribute(name, value)
		marked.push(el)
	}
	const roots: ShadowRoot[] = []
	const walk = (root: Document | ShadowRoot) => {
		for (const el of Array.from(root.querySelectorAll("*"))) {
			if (el.scrollTop || el.scrollLeft) mark(el, "data-sb-scroll", `${el.scrollLeft},${el.scrollTop}`)
			if (el.shadowRoot) {
				roots.push(el.shadowRoot)
				walk(el.shadowRoot)
			}
		}
		for (const style of Array.from(
			root.querySelectorAll<HTMLStyleElement | HTMLLinkElement>("style, link[rel~=stylesheet]"),
		)) {
			const sheet = style.sheet
			if (sheet) mark(style, "data-sb-css", rebase(sheetText(sheet), sheet.href ?? location.href))
		}
		for (const video of Array.from(root.querySelectorAll("video")))
			mark(
				video,
				"data-sb-video",
				JSON.stringify({ duration: video.duration || 0, at: video.currentTime, paused: video.paused }),
			)
	}
	walk(document)
	const adopted = Array.from(document.adoptedStyleSheets, (sheet) => rebase(sheetText(sheet), location.href))
	mark(document.documentElement, "data-sb-scroll", `${scrollX},${scrollY}`)

	const images: Record<string, [number, number]> = {}
	const allImages = [document, ...roots].flatMap((root) => Array.from(root.querySelectorAll("img")))
	for (const img of allImages) {
		const url = img.currentSrc || img.src
		if (url && !url.startsWith("data:")) images[url] = [img.naturalWidth || img.width, img.naturalHeight || img.height]
	}

	let html = document.documentElement.getHTML({ serializableShadowRoots: true, shadowRoots: roots })
	for (const el of marked) {
		el.removeAttribute("data-sb-scroll")
		el.removeAttribute("data-sb-css")
		el.removeAttribute("data-sb-video")
	}

	// the rest works on a detached copy, so the live page is left as it was. DOMParser leaves the shadow roots as
	// <template shadowrootmode> elements, which is how they're saved and how the copy attaches them again on load.
	const htmlAttributes = Array.from(
		document.documentElement.attributes,
		(attr) => `${attr.name}="${attr.value.replaceAll('"', "&quot;")}"`,
	)
	const copy = new DOMParser().parseFromString(
		`<!doctype html><html ${htmlAttributes.join(" ")}>${html}</html>`,
		"text/html",
	)
	const everywhere = (selector: string) => {
		const found: Element[] = []
		const visit = (root: ParentNode) => {
			for (const el of Array.from(root.querySelectorAll(selector))) found.push(el)
			for (const template of Array.from(root.querySelectorAll("template[shadowrootmode]")))
				visit((template as HTMLTemplateElement).content)
		}
		visit(copy)
		return found
	}
	for (const el of everywhere("script, noscript, link[rel~=preload], link[rel~=modulepreload], link[rel~=prefetch]"))
		el.remove()
	for (const el of everywhere("style[data-sb-css], link[data-sb-css]")) {
		const style = copy.createElement("style")
		style.textContent = el.getAttribute("data-sb-css")
		const href = el.getAttribute("href")
		if (href) style.dataset.sbFrom = absolute(href, location.href)
		el.replaceWith(style)
	}
	for (const el of everywhere("iframe")) el.removeAttribute("src")
	for (const el of everywhere("*"))
		for (const attr of Array.from(el.attributes)) {
			if (attr.name.startsWith("on")) el.removeAttribute(attr.name)
			else if (
				["src", "href", "poster"].includes(attr.name) &&
				!attr.value.startsWith("data:") &&
				!attr.value.startsWith("#")
			)
				el.setAttribute(attr.name, absolute(attr.value, location.href))
		}
	for (const video of everywhere("video")) {
		video.removeAttribute("src")
		video.innerHTML = ""
	}
	if (adopted.length) {
		const style = copy.createElement("style")
		style.dataset.sbFrom = "adoptedStyleSheets"
		style.textContent = adopted.join("\n")
		copy.head.append(style)
	}
	html = `<!doctype html>\n${copy.documentElement.outerHTML}`
	for (const word of scrub.filter(Boolean)) html = html.split(word).join("Viewer")
	return { html, images, missingSheets }
}
