import '@testing-library/jest-dom'
import { TextDecoder, TextEncoder } from 'util'

if (!globalThis.TextEncoder) {
	globalThis.TextEncoder = TextEncoder
}

if (!globalThis.TextDecoder) {
	globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder
}

if (!window.matchMedia) {
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		value: (query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addEventListener: () => undefined,
			removeEventListener: () => undefined,
			addListener: () => undefined,
			removeListener: () => undefined,
			dispatchEvent: () => false,
		}),
	})
}

window.scrollTo = () => undefined
