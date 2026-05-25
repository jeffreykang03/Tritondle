#!/usr/bin/env node
/**
 * Ensures faculty data lives at src/data/professors.json with exact lowercase spelling.
 * Case-insensitive macOS can hide Professors.json vs professors.json until Linux CI/build fails.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'src', 'data')
const REQUIRED = 'professors.json'

const entries = fs.existsSync(DATA_DIR) ? fs.readdirSync(DATA_DIR) : []
const hits = entries.filter((f) => f.toLowerCase() === REQUIRED.toLowerCase())

if (hits.length === 0) {
  console.error(`verify-professors-filename: missing ${REQUIRED} (expected under ${DATA_DIR})`)
  process.exit(1)
}
if (hits.length > 1) {
  console.error(`verify-professors-filename: multiple matching files: ${hits.join(', ')}`)
  process.exit(1)
}
if (hits[0] !== REQUIRED) {
  console.error(
    `verify-professors-filename: wrong casing on disk: "${hits[0]}" — must be "${REQUIRED}" for Linux CI.\n` +
      `Rename from repo root, preserving history: git mv profdle/src/data/${hits[0]} profdle/src/data/${REQUIRED}`,
  )
  process.exit(1)
}
