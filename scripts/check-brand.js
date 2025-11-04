'use strict'

const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '..')
const scanRoots = [
  path.join(repoRoot, 'frontend', 'src'),
  path.join(repoRoot, 'frontend', 'index.html'),
  path.join(repoRoot, 'frontend', 'vite.config.ts'),
  path.join(repoRoot, 'frontend', 'vitest.config.ts'),
  path.join(repoRoot, 'backend'),
]

const codeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs', '.json', '.html', '.css'])
const bannedPatterns = [
  { label: 'GuessTheSong', regex: /GuessTheSong/ },
  { label: 'Guess the song', regex: /Guess the song/i },
]

const ignoredDirectories = new Set(['node_modules', 'dist', '.git'])

const failures = []

const shouldScanFile = (filePath) => {
  const stats = fs.statSync(filePath)
  if (stats.isDirectory()) return true
  const ext = path.extname(filePath)
  return codeExtensions.has(ext)
}

const scanFile = (filePath) => {
  const relativePath = path.relative(repoRoot, filePath)
  const stats = fs.statSync(filePath)
  if (stats.isDirectory()) {
    if (ignoredDirectories.has(path.basename(filePath))) return
    const entries = fs.readdirSync(filePath)
    entries.forEach((entry) => {
      const child = path.join(filePath, entry)
      if (shouldScanFile(child)) {
        scanFile(child)
      }
    })
    return
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split(/\r?\n/)
  lines.forEach((line, index) => {
    bannedPatterns.forEach(({ label, regex }) => {
      if (regex.test(line)) {
        failures.push({
          file: relativePath,
          line: index + 1,
          label,
          snippet: line.trim(),
        })
      }
    })
  })
}

scanRoots.forEach((root) => {
  if (fs.existsSync(root)) {
    scanFile(root)
  }
})

if (failures.length > 0) {
  console.error('Branding validation failed. Update app-config/base.json instead of hardcoding the name:')
  failures.forEach(({ file, line, label, snippet }) => {
    console.error(` - ${file}:${line} -> ${label} | ${snippet}`)
  })
  process.exit(1)
}

console.log('Branding validation passed.')
