// Whether the film is over: the review pill is up and the film is in its credits, or the service has moved on to a
// trailer. Set by the review pill (content-script/credits.ts), read by the playback engine so the speed controls
// step out of its way.
let over = false
export const filmOver = () => over
export function setFilmOver(value: boolean) {
	over = value
}
