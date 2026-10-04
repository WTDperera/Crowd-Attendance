import { defineConfig } from 'vitest/config'
import base from './vitest.config'

export default defineConfig({ ...base, test: { ...base.test,
  include: ['tests/persistence.test.jsx'], testTimeout: 30000, hookTimeout: 30000,
  fileParallelism: false,
} })
