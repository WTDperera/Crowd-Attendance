import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { webcrypto } from 'node:crypto'

Object.defineProperty(globalThis.crypto, 'subtle', { value: webcrypto.subtle, configurable: true })
afterEach(cleanup)
