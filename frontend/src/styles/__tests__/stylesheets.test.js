import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import path from 'path'

// tokens.css holds the app's only colors: every other stylesheet names a
// token, so a palette change is one file and tokens.test.js sees every
// pairing. These checks hold that line, and keep the tokens and their uses
// in step.
const SRC = path.resolve(import.meta.dirname, '../..')
const TOKENS = path.join(SRC, 'styles', 'tokens.css')

const stylesheets = readdirSync(SRC, { recursive: true })
  .filter(file => file.endsWith('.css'))
  .map(file => path.join(SRC, file))
const read = file => readFileSync(file, 'utf8')
const label = file => path.relative(SRC, file).replaceAll('\\', '/')

const stripComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '')

// Properties that take a color, shorthands included
const COLOR_PROPERTY =
  /(^|-)color$|^(background|border(-(top|right|bottom|left|block|inline)(-(start|end))?)?|outline|box-shadow|text-shadow|fill|stroke|column-rule)$/

// Words such a property may hold besides a token: keywords that are no
// color of their own, the other parts of a shorthand, and the system
// colors forced-colors mode uses
const ALLOWED_WORDS = new Set([
  'transparent', 'currentcolor', 'inherit', 'initial', 'unset', 'revert', 'none',
  'solid', 'dashed', 'dotted', 'double', 'inset', 'auto',
  'canvas', 'canvastext', 'buttonface', 'buttontext', 'buttonborder', 'field', 'fieldtext',
  'highlight', 'highlighttext', 'linktext', 'visitedtext', 'activetext', 'graytext',
  'mark', 'marktext', 'selecteditem', 'selecteditemtext', 'accentcolor', 'accentcolortext',
])
const COLOR_FUNCTION = /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(/i

/** The colors a stylesheet writes out rather than naming a token */
function colorLiterals(css) {
  const declarations = [...stripComments(css).matchAll(/\{([^{}]*)\}/g)]
    .flatMap(([, block]) => block.split(';'))
    .map(declaration => declaration.split(':'))
    .filter(([property, value]) => value && COLOR_PROPERTY.test(property.trim()))
  return declarations.flatMap(([, value]) => {
    const rest = value.replace(/var\(--[\w-]+\)/g, '')
    const functions = rest.match(new RegExp(COLOR_FUNCTION, 'gi')) ?? []
    const words = rest.replace(new RegExp(COLOR_FUNCTION.source + '[^)]*\\)', 'gi'), '')
      .split(/[\s,/]+/)
      .filter(word => word && !/^[-+.\d]/.test(word) && !ALLOWED_WORDS.has(word.toLowerCase()))
    return [...functions, ...words]
  })
}

const defined = css => new Set([...css.matchAll(/(--color-[\w-]+)\s*:/g)].map(([, name]) => name))
const used = sheets =>
  new Set(sheets.flatMap(css => [...css.matchAll(/var\((--color-[\w-]+)\)/g)].map(([, name]) => name)))

/** Tokens no stylesheet uses */
const unusedTokens = (tokensCss, sheets) => [...defined(tokensCss)].filter(name => !used(sheets).has(name))

/** Tokens a stylesheet uses that tokens.css does not define */
const undefinedTokens = (tokensCss, sheets) => [...used(sheets)].filter(name => !defined(tokensCss).has(name))

describe('stylesheets', () => {
  it('finds every stylesheet under src/', () => {
    expect(stylesheets.map(label)).toEqual(expect.arrayContaining([
      'styles/tokens.css', 'styles/buttons.css', 'features/notes/notes.css',
    ]))
  })

  it.each(stylesheets.filter(file => file !== TOKENS).map(label))('%s names only color tokens', file => {
    expect(colorLiterals(read(path.join(SRC, file)))).toEqual([])
  })

  it('uses every color token', () => {
    expect(unusedTokens(read(TOKENS), stylesheets.map(read))).toEqual([])
  })

  it('uses only color tokens that tokens.css defines', () => {
    expect(undefinedTokens(read(TOKENS), stylesheets.map(read))).toEqual([])
  })
})

describe('the checks themselves', () => {
  it.each([
    ['a named color', '.a { color: white; }', ['white']],
    ['a hex color', '.a { background-color: #fff; }', ['#fff']],
    ['a color in a shorthand', '.a { border: 1px solid red; }', ['red']],
    ['a color function', '.a { outline-color: rgb(0 0 0 / 0.5); }', ['rgb(']],
    ['a color in a shadow', '.a { box-shadow: inset 0 0 0 1px hsl(0 0% 0%); }', ['hsl(']],
    ['a color in a nested block', '@media (forced-colors: active) { .a { border-left-color: black } }', ['black']],
  ])('refuses %s', (_, css, literals) => {
    expect(colorLiterals(css)).toEqual(literals)
  })

  it('allows tokens, keywords, system colors and the rest of a shorthand', () => {
    const css = `
      /* color: white in a comment */
      .a:hover { color: var(--color-text); border: 1px solid transparent; }
      .b { box-shadow: inset 0 0 0 1px var(--color-border); white-space: nowrap; }
      .c { text-decoration: underline; border-radius: 4px; outline-offset: 2px; }
      @media (forced-colors: active) { .d { border: 1px solid ButtonText; } }
    `
    expect(colorLiterals(css)).toEqual([])
  })

  it('finds a token nothing uses, and a use of a token never defined', () => {
    const tokensCss = ':root { --color-a: #000; --color-b: #fff; }'
    const sheets = ['.x { color: var(--color-a); }', '.y { color: var(--color-c); }']

    expect(unusedTokens(tokensCss, sheets)).toEqual(['--color-b'])
    expect(undefinedTokens(tokensCss, sheets)).toEqual(['--color-c'])
  })
})
