import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// tokens.css promises WCAG AA for every pairing the stylesheets use. Each
// is listed here: text needs 4.5:1, borders and focus rings 3:1. Add a row
// whenever CSS puts a color on a new background.
const WHITE = '#ffffff'
const TEXT = 4.5
const NON_TEXT = 3

const PAIRINGS = [
  // Text
  ['white on primary buttons', WHITE, 'primary', TEXT],
  ['white on secondary buttons', WHITE, 'secondary', TEXT],
  ['white on danger buttons and error messages', WHITE, 'danger', TEXT],
  ['white on success messages', WHITE, 'success', TEXT],
  ['white on the navbar', WHITE, 'navbar', TEXT],
  ['links', 'primary', 'surface', TEXT],
  ['field errors', 'danger', 'surface', TEXT],
  ['hints', 'text-muted', 'surface', TEXT],
  ['muted text on muted panels', 'text-muted', 'surface-muted', TEXT],
  // Borders and focus rings
  ['field borders', 'border', 'surface', NON_TEXT],
  ['focus rings and focused fields', 'primary', 'surface', NON_TEXT],
  ['focus rings on muted panels', 'primary', 'surface-muted', NON_TEXT],
  ['invalid fields', 'danger', 'surface', NON_TEXT],
  ['focus rings on the navbar', WHITE, 'navbar', NON_TEXT],
]

const tokensCss = readFileSync(path.resolve(import.meta.dirname, '../tokens.css'), 'utf8')
const tokens = Object.fromEntries(
  [...tokensCss.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{3,6})\s*;/gi)]
    .map(([, name, hex]) => [name, hex])
)

const toHex = color => (color.startsWith('#') ? color : tokens[color])

// WCAG 2.2's relative luminance and contrast ratio
function luminance(hex) {
  const digits = hex.slice(1)
  const full = digits.length === 3 ? [...digits].map(d => d + d).join('') : digits
  const [r, g, b] = [0, 2, 4].map(i => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

describe('color tokens', () => {
  it('computes contrast as WCAG does', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21)
    expect(contrast('#777', '#fff')).toBeCloseTo(4.48, 2)
  })

  it.each(PAIRINGS)('%s meet AA', (_, foreground, background, minimum) => {
    expect(toHex(foreground), `${foreground} is a token`).toMatch(/^#/)
    expect(toHex(background), `${background} is a token`).toMatch(/^#/)

    expect(contrast(toHex(foreground), toHex(background))).toBeGreaterThanOrEqual(minimum)
  })
})
