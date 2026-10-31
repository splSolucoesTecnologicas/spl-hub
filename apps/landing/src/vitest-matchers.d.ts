import 'vitest'

declare module 'vitest' {
  interface Assertion<T = unknown> {
    toBeInTheDocument(): T
    toHaveTextContent(text: string | RegExp): T
    toHaveLength(length: number): T
  }
}
