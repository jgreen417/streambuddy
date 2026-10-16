// Development builds keep the chatty logging; store builds stay quiet so users' consoles don't fill with it.
export const debugLog: (...args: unknown[]) => void = __SIDELOAD__ ? console.log.bind(console) : () => {}

// A network blip, a rate limit or an outage at TMDb, Letterboxd or IMDb is expected and already handled (the title
// is retried later), so it isn't worth an error in the console. Anything else is a real bug and still logs as one.
export function logLookupFailure(context: string, error: unknown, ...details: unknown[]) {
	const name = (error as Error | undefined)?.name
	const message = String((error as Error | undefined)?.message ?? error)
	const expected =
		name === "TransientLookupError" || /NetworkError|Failed to fetch|Load failed|HTTP \d{3}|^(Letterboxd|IMDb|TMDb) \d{3}$/.test(message)
	if (expected) debugLog(context, ...details, error)
	else console.error(context, ...details, error)
}
