import { ref, watch, nextTick } from "vue"
type PlainObject = Record<string, unknown>
function mergeDeep(defaults: PlainObject, source: PlainObject): PlainObject {
	// Merge the default options with the stored options
	const output = { ...defaults } // Start with defaults

	Object.keys(defaults).forEach((key) => {
		const defaultValue = defaults[key]
		const sourceValue = source[key]

		if (isObject(defaultValue) && isObject(sourceValue)) {
			// Recursively merge nested objects
			output[key] = mergeDeep(defaultValue, sourceValue)
		} else if (checkType(defaultValue, sourceValue)) {
			output[key] = sourceValue
		} else {
			// Not stored yet (a setting added since), or stored as another type: use the default value
			output[key] = defaultValue
			if (sourceValue !== undefined) console.log("Type mismatch", key, sourceValue, defaultValue)
		}
	})

	return output
}

function checkType(defaultValue: unknown, value: unknown): boolean {
	// Check if the value type is the same type as the default value or null
	// there are only strings, booleans, nulls and arrays as types left
	return (
		value === null ||
		defaultValue === undefined ||
		(typeof value === typeof defaultValue && Array.isArray(value) == Array.isArray(defaultValue))
	)
}
function isObject(value: unknown): value is PlainObject {
	return value !== null && value instanceof Object && !Array.isArray(value)
}

export function useBrowserSyncStorage<T>(key: string, defaultValue: T, merge = true) {
	return useBrowserStorage(key, defaultValue, "sync", merge)
}

export function useBrowserLocalStorage<T>(key: string, defaultValue: T, merge = true) {
	return useBrowserStorage(key, defaultValue, "local", merge)
}

function useBrowserStorage<T>(key: string, defaultValue: T, storageType: "sync" | "local" = "sync", merge = true) {
	const data = ref<T>(defaultValue)
	// Blocking setting storage if it is updating from storage
	let isUpdatingFromStorage = true
	const defaultIsObject = isObject(defaultValue)
	// a stored object gets the defaults for anything it lacks (written by an older version, maybe in another synced browser)
	const fromStorage = (stored: unknown) => {
		if (stored === undefined) return
		if (defaultIsObject && isObject(stored)) {
			data.value = (merge ? mergeDeep(defaultValue as PlainObject, stored) : stored) as T
		} else if (checkType(defaultValue, stored)) {
			data.value = stored as T
		}
	}
	// Initialize storage with the value from browser.storage
	const promise = (async () => {
		const result = await browser.storage[storageType].get(key)
		fromStorage(result?.[key])
		await nextTick()
		isUpdatingFromStorage = false
	})()

	// Watch for changes in the storage and update browser.storage
	watch(
		data,
		(newValue) => {
			if (!isUpdatingFromStorage) {
				if (checkType(defaultValue, newValue)) {
					void browser.storage[storageType].set({ [key]: toRaw(newValue) })
				} else {
					console.error("not updating " + key + ": type mismatch")
				}
			}
		},
		{ deep: true, flush: "post" },
	)
	// Add the onChanged listener here
	browser.storage.onChanged.addListener(async function (changes, areaName) {
		if (areaName === storageType && changes?.[key]) {
			isUpdatingFromStorage = true
			fromStorage(changes[key].newValue)
			await nextTick()
			isUpdatingFromStorage = false
		}
	})
	return { data, promise }
}
