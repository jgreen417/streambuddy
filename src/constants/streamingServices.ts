export const streamingServices = ["Netflix", "Amazon", "HBO"] as const

export type StreamingService = (typeof streamingServices)[number]
