// Runs inside the page being captured (passed to page.evaluate, so it can't use anything outside itself). Turns the
// page as it is right now into one static HTML document: the DOM including open shadow roots, every stylesheet
// inlined in document order, no scripts. The parts a static copy can't hold (scroll offsets, the video's place) are
// written onto the elements as data-sb-* attributes for the replay to restore.
export type FreezeInput = {
	// text of the stylesheets the page can't read itself (cross-origin), by URL, from the recorded network traffic
	sheets: Record<string, string>
}
export type FrozenPage = {
	html: string
	// every image the page shows, by URL, with the size it was drawn at, so the replay can serve a same-size stand-in
	images: Record<string, [number, number]>
	// stylesheets the page loaded but neither it nor the recording had the text of
	missingSheets: string[]
}

export function freeze({ sheets }: FreezeInput): FrozenPage {
	const missingSheets: string[] = []
	const BLOCKS =
		"address, article, aside, blockquote, details, dl, div, fieldset, figure, footer, form, h1, h2, h3, h4, h5, h6, " +
		"header, hr, main, nav, ol, p, pre, section, table, ul"
	const absolute = (url: string, base: string) => {
		try {
			return new URL(url, base).href
		} catch {
			return url
		}
	}
	// Each <p> marked data-sb-p written as a <div> keeping its margins (a div has none of a paragraph's own), so it
	// parses back as one box holding its blocks. Its </p> is the one that closes it, found by counting the <p>s
	// opened and closed inside it.
	const paragraphsAsDivs = (html: string) => {
		const open: boolean[] = []
		return html.replace(/<(\/?)p(?=[\s>])([^>]*)>/g, (tag, closing: string, attrs: string) => {
			if (closing) return open.pop() ? "</div>" : tag
			const margins = /\sdata-sb-p="([^"]*)"/.exec(attrs)
			open.push(!!margins)
			return margins ? `<div${attrs.replace(margins[0], "")} data-sb-margins="${margins[1]}">` : tag
		})
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
				// web components often style their shadow root only with constructed sheets (Disney+'s player)
				const adopted = el.shadowRoot.adoptedStyleSheets
				if (adopted.length)
					mark(el, "data-sb-adopted", adopted.map((sheet) => rebase(sheetText(sheet), location.href)).join("\n"))
				walk(el.shadowRoot)
			}
		}
		for (const style of Array.from(
			root.querySelectorAll<HTMLStyleElement | HTMLLinkElement>("style, link[rel~=stylesheet]"),
		)) {
			const sheet = style.sheet
			if (sheet) mark(style, "data-sb-css", rebase(sheetText(sheet), sheet.href ?? location.href))
		}
		// a <p> the site's script filled with blocks (Netflix's synopses hold a <div>) can't be written as HTML:
		// parsing it again closes the <p> before the block, and the text falls out of it
		for (const para of Array.from(root.querySelectorAll("p"))) {
			if (!para.querySelector(BLOCKS)) continue
			const style = getComputedStyle(para)
			mark(para, "data-sb-p", `${style.marginTop} ${style.marginBottom}`)
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

	// <html> itself isn't in getHTML's output, so its attributes (its scroll mark among them) are read here, before the
	// marks come off
	const htmlAttributes = Array.from(
		document.documentElement.attributes,
		(attr) => `${attr.name}="${attr.value.replaceAll('"', "&quot;")}"`,
	)
	const html = paragraphsAsDivs(document.documentElement.getHTML({ serializableShadowRoots: true, shadowRoots: roots }))
	for (const el of marked) {
		el.removeAttribute("data-sb-p")
		el.removeAttribute("data-sb-scroll")
		el.removeAttribute("data-sb-css")
		el.removeAttribute("data-sb-video")
		el.removeAttribute("data-sb-adopted")
	}

	// the rest works on a detached copy, so the live page is left as it was. DOMParser leaves the shadow roots as
	// <template shadowrootmode> elements, which is how they're saved and how the copy attaches them again on load.
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
		// links and sources keep their own spelling (site code matches on it, e.g. href^="/video/watch/"); the copy is
		// served at the page's own URL, so relative ones still resolve
		for (const attr of Array.from(el.attributes)) if (attr.name.startsWith("on")) el.removeAttribute(attr.name)
	for (const el of everywhere("[data-sb-margins]") as HTMLElement[]) {
		const [top, bottom] = el.dataset.sbMargins!.split(" ")
		el.style.marginTop = top
		el.style.marginBottom = bottom
		delete el.dataset.sbMargins
	}
	for (const video of everywhere("video")) {
		video.removeAttribute("src")
		video.innerHTML = ""
	}
	// constructed sheets come after a root's own stylesheets in the cascade, so they go last
	for (const host of everywhere("[data-sb-adopted]")) {
		const template = host.querySelector<HTMLTemplateElement>(":scope > template[shadowrootmode]")
		const style = copy.createElement("style")
		style.dataset.sbFrom = "adoptedStyleSheets"
		style.textContent = host.getAttribute("data-sb-adopted")
		template?.content.append(style)
		host.removeAttribute("data-sb-adopted")
	}
	if (adopted.length) {
		const style = copy.createElement("style")
		style.dataset.sbFrom = "adoptedStyleSheets"
		style.textContent = adopted.join("\n")
		copy.head.append(style)
	}
	return { html: `<!doctype html>\n${copy.documentElement.outerHTML}`, images, missingSheets }
}
