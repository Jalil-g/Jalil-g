// Generates the SVGs in assets/: `node scripts/build.mjs`
//
// Everything is self-contained SVG (fonts come from the viewer's system,
// the keyboard render is embedded), because GitHub shows these through
// <img>, which can't load anything external.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = (name, svg) => writeFileSync(join(root, 'assets', name), svg.replace(/\n\s*\n/g, '\n'))

const SANS = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Helvetica, Arial, sans-serif`
const MONO = `ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace`

const PALETTE = {
  white: { color: '#f4f2ee', ink: '#6a58ee' },
  teal: { color: '#2f7a66', ink: '#ffffff' },
  orange: { color: '#f2701b', ink: '#ffffff' },
  yellow: { color: '#f2b705', ink: '#ffffff' },
  blue: { color: '#0a66c2', ink: '#ffffff' },
  charcoal: { color: '#26262b', ink: '#ffffff' },
  lavender: { color: '#8b7cf6', ink: '#ffffff' },
}

// ---------- helpers ----------

function mix(hex, other, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const a = p(hex)
  const b = p(other)
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Rough text width for system sans at weight 600, so keycaps fit their legends. */
const textWidth = (s, size) => [...s].reduce((w, ch) => w + (/[ il.]/.test(ch) ? 0.3 : /[A-Z+#]/.test(ch) ? 0.68 : 0.56), 0) * size

/** Gradients for one keycap colour: darker skirt, lighter top face. */
function capDefs(name, color) {
  return `
    <linearGradient id="skirt-${name}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${mix(color, '#000000', 0.2)}"/>
      <stop offset="1" stop-color="${mix(color, '#000000', 0.5)}"/>
    </linearGradient>
    <linearGradient id="top-${name}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${mix(color, '#ffffff', 0.18)}"/>
      <stop offset="0.8" stop-color="${color}"/>
    </linearGradient>`
}

/** A front-facing keycap: soft shadow, skirt, sculpted top face, legend. */
function keycap({ x, y, w, h, name, ink, label, icon, size = 17, cls = '', delay = 0 }) {
  const top = { x: x + 5, y: y + 3, w: w - 10, h: h - 15 }
  const cy = top.y + top.h / 2 + size * 0.36
  let legend
  if (icon) {
    const iconSize = size * 1.15
    const tw = textWidth(label, size)
    const total = iconSize + 8 + tw
    const ix = x + w / 2 - total / 2
    legend = `
      <g transform="translate(${ix.toFixed(1)} ${(top.y + top.h / 2 - iconSize / 2).toFixed(1)}) scale(${(iconSize / 24).toFixed(3)})" fill="${ink}">${icon}</g>
      <text x="${(ix + iconSize + 8).toFixed(1)}" y="${cy.toFixed(1)}" fill="${ink}" font-size="${size}">${esc(label)}</text>`
  } else {
    legend = `<text x="${x + w / 2}" y="${cy.toFixed(1)}" fill="${ink}" font-size="${size}" text-anchor="middle">${esc(label)}</text>`
  }
  return `
    <g class="${cls}" style="animation-delay:${delay.toFixed(2)}s">
      <rect x="${x + 2}" y="${y + 7}" width="${w - 4}" height="${h}" rx="13" fill="#000" opacity=".5" filter="url(#soft)"/>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="13" fill="url(#skirt-${name})"/>
      <rect x="${top.x}" y="${top.y}" width="${top.w}" height="${top.h}" rx="10" fill="url(#top-${name})"/>
      <rect x="${top.x + 0.5}" y="${top.y + 0.5}" width="${top.w - 1}" height="${top.h - 1}" rx="9.5" fill="none" stroke="#fff" stroke-opacity=".22"/>
      ${legend}
    </g>`
}

const SOFT = `<filter id="soft" x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>`

const DOTS = `
    <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1.2" cy="1.2" r="1.1" fill="#fff" opacity=".07"/></pattern>
    <radialGradient id="fade" cx="50%" cy="50%" r="65%"><stop offset=".35" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <mask id="dotmask"><rect width="100%" height="100%" fill="url(#fade)"/></mask>`

/** Dark rounded card with a fading dot grid, shared by the banner and stack. */
const card = (w, h) => `
  <rect width="${w}" height="${h}" rx="28" fill="#09090a"/>
  <rect width="${w}" height="${h}" rx="28" fill="url(#dots)" mask="url(#dotmask)"/>
  <rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="27.5" fill="none" stroke="#fff" stroke-opacity=".09"/>`

// Material Icons (Apache 2.0), 24×24.
const ICONS = {
  keyboard:
    '<path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z"/>',
  mail: '<path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>',
  doc: '<path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>',
  // LinkedIn has no icon in the set; draw its "in" wordmark instead.
  linkedin:
    '<rect x="1" y="1" width="22" height="22" rx="4" fill="none" stroke="currentColor"/><text x="12" y="17.5" font-size="15" font-weight="800" text-anchor="middle" letter-spacing="-1" font-family="Arial, Helvetica, sans-serif">in</text>',
}

// ---------- banner ----------

function banner() {
  const W = 1200
  const H = 420
  const kb = readFileSync(join(root, 'assets/keyboard.webp')).toString('base64')
  // The render is 1080×788; place it at half size on the right.
  const img = { x: 618, y: 13, w: 540, h: 394 }
  const s = img.w / 1080
  const at = (px, py) => [img.x + px * s, img.y + py * s]

  // Key-top centres of J A L I L in the render, and the heart.
  const letterKeys = [
    [318, 176],
    [423, 250],
    [534, 327],
    [650, 402],
    [757, 478],
  ].map(([px, py]) => at(px, py))
  const [hx, hy] = at(880, 400)

  // Typing loop: letters appear one by one, hold, then clear.
  const D = 8
  const t = [0.9, 1.25, 1.6, 1.95, 2.3]
  const clear = 6.6
  const pct = (sec) => ((sec / D) * 100).toFixed(2)
  const letters = 'JALIL'
  const x0 = 116
  const step = 19

  const css = [
    `text{font-family:${SANS}}`,
    `.mono{font-family:${MONO}}`,
    `@keyframes blink{50%{opacity:0}}`,
    `.caret{animation:blink 1.05s steps(1) infinite}`,
    `@keyframes pulse{0%,100%{opacity:.35}50%{opacity:.85}}`,
    `.heart{animation:pulse 2.6s ease-in-out infinite}`,
    ...t.map((ti, i) => {
      const a = pct(ti)
      return (
        `@keyframes l${i}{0%,${(a - 0.01).toFixed(2)}%{opacity:0}${a}%,${pct(clear)}%{opacity:1}${(+pct(clear) + 0.01).toFixed(2)}%,100%{opacity:0}}` +
        `.l${i}{animation:l${i} ${D}s infinite}` +
        `@keyframes f${i}{0%,${a}%{opacity:0}${(+a + 0.6).toFixed(2)}%{opacity:1}${(+a + 6).toFixed(2)}%,100%{opacity:0}}` +
        `.f${i}{animation:f${i} ${D}s infinite}`
      )
    }),
    // Caret follows the typed letters, then jumps home when they clear.
    `@keyframes move{0%{transform:translateX(0)}` +
      t.map((ti, i) => `${(+pct(ti) - 0.01).toFixed(2)}%{transform:translateX(${i * step}px)}${pct(ti)}%{transform:translateX(${(i + 1) * step}px)}`).join('') +
      `${pct(clear)}%{transform:translateX(${letters.length * step}px)}${(+pct(clear) + 0.01).toFixed(2)}%,100%{transform:translateX(0)}}`,
    `.move{animation:move ${D}s infinite}`,
    `@media (prefers-reduced-motion:reduce){*{animation:none!important}.l0,.l1,.l2,.l3,.l4{opacity:1}}`,
  ].join('\n')

  const flashes = letterKeys
    .map(
      ([cx, cy], i) =>
        `<ellipse class="f${i}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="30" ry="19" transform="rotate(33 ${cx.toFixed(1)} ${cy.toFixed(1)})" fill="url(#flash)" opacity="0"/>`,
    )
    .join('\n    ')

  const typed = [...letters]
    .map((ch, i) => `<text class="mono l${i}" x="${x0 + i * step}" y="325" font-size="20" fill="#cfc6ff" filter="url(#glow)" opacity="0">${ch}</text>`)
    .join('\n    ')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Jalil Jabbarli, Software and AI engineer. A 3D keyboard with keys for GitHub, LinkedIn, Resume, the letters J A L I L, Projects, About and Hire Me.">
  <style>
${css}
  </style>
  <defs>
    ${DOTS}
    <radialGradient id="warm" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#f2701b" stop-opacity=".22"/><stop offset="1" stop-color="#f2701b" stop-opacity="0"/></radialGradient>
    <radialGradient id="flash" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#e4dcff" stop-opacity=".95"/><stop offset=".55" stop-color="#b3a4ff" stop-opacity=".45"/><stop offset="1" stop-color="#8b7cf6" stop-opacity="0"/></radialGradient>
    <radialGradient id="red" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ff4a2a" stop-opacity=".9"/><stop offset="1" stop-color="#ff2a10" stop-opacity="0"/></radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <clipPath id="clip"><rect width="${W}" height="${H}" rx="28"/></clipPath>
  </defs>
  <g clip-path="url(#clip)">
    ${card(W, H)}
    <ellipse cx="890" cy="215" rx="380" ry="230" fill="url(#warm)"/>
    <image x="${img.x}" y="${img.y}" width="${img.w}" height="${img.h}" href="data:image/webp;base64,${kb}"/>
    ${flashes}
    <circle class="heart" cx="${hx.toFixed(1)}" cy="${(hy + 14).toFixed(1)}" r="42" fill="url(#red)" style="mix-blend-mode:screen"/>
  </g>

  <text class="mono" x="64" y="116" font-size="15" letter-spacing="3" fill="#f2701b">HELLO, I’M</text>
  <text x="62" y="182" font-size="60" font-weight="700" letter-spacing="-1.5" fill="#f2f0ea">Jalil Jabbarli</text>
  <text x="64" y="224" font-size="25" font-weight="500" fill="#dcd9d2">Software &amp; AI engineer</text>
  <text x="64" y="257" font-size="18" fill="#8f8c86">MEng CS @ Cornell Tech  ·  BSc McGill</text>

  <rect x="64" y="291" width="290" height="50" rx="14" fill="#060606" stroke="#fff" stroke-opacity=".16"/>
  <text class="mono" x="88" y="324" font-size="18" fill="#f2701b">&gt;</text>
    ${typed}
  <g class="move"><rect class="caret" x="${x0}" y="306" width="10" height="22" fill="#f2701b"/></g>

  <text class="mono" x="64" y="384" font-size="14" fill="#6f6d69">jaliljabbarli.vercel.app  ↗</text>
</svg>
`
}

// ---------- tech stack ----------

const STACK = [
  {
    label: 'languages',
    tone: 'white',
    keys: ['Python', 'TypeScript', 'JavaScript', 'SQL', 'C++', 'C', 'R', 'Bash'],
  },
  {
    label: 'ai / ml',
    tone: 'teal',
    keys: ['PyTorch', 'LangChain', 'LLM agents', 'XGBoost', 'scikit-learn', 'OpenCV', 'MediaPipe'],
  },
  {
    label: 'web, backend & cloud',
    tone: 'orange',
    keys: ['FastAPI', 'Node.js', 'React', 'Kafka', 'Docker', 'AWS', 'MongoDB', 'PostgreSQL'],
  },
]

function stack() {
  const pad = 48
  let widest = 0
  const keyH = 56
  const gap = 12
  const size = 17
  let y = 58
  let order = 0
  const rows = STACK.map((row) => {
    const { color, ink } = PALETTE[row.tone]
    const widths = row.keys.map((k) => Math.max(keyH, Math.round(textWidth(k, size) + 38)))
    const label = `<text class="mono" x="${pad}" y="${y}" font-size="13" letter-spacing="2.5" fill="#76736d">${esc(row.label.toUpperCase())}</text>`
    y += 16
    let x = pad
    const caps = row.keys.map((k, i) => {
      const cap = keycap({ x, y, w: widths[i], h: keyH, name: row.tone, ink, label: k, size, cls: 'k', delay: order++ * 0.11 })
      x += widths[i] + gap
      return cap
    })
    widest = Math.max(widest, x - gap - pad)
    y += keyH + 44
    return label + caps.join('') + capDefsFor(row.tone, color)
  })
  // Card hugs the widest row; GitHub scales it to the page width anyway.
  const W = Math.round(widest + pad * 2)
  const H = y - 24

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Tech stack. Languages: ${STACK[0].keys.join(', ')}. AI and ML: ${STACK[1].keys.join(', ')}. Backend and infrastructure: ${STACK[2].keys.join(', ')}.">
  <style>
    text{font-family:${SANS};font-weight:600}
    .mono{font-family:${MONO};font-weight:500}
    .k{animation:press 9s ease-in-out infinite}
    @keyframes press{0%,3%,100%{transform:translateY(0)}1.2%{transform:translateY(4px)}}
    @media (prefers-reduced-motion:reduce){.k{animation:none}}
  </style>
  <defs>${DOTS}${SOFT}</defs>
  ${card(W, H)}
  ${rows.join('\n')}
</svg>
`
}

// Gradient defs are emitted once per tone, next to the row that uses them.
const emitted = new Set()
function capDefsFor(tone, color) {
  if (emitted.has(tone)) return ''
  emitted.add(tone)
  return `<defs>${capDefs(tone, color)}</defs>`
}

// ---------- contact keys ----------

const CONTACT = [
  { file: 'key-portfolio.svg', label: 'Portfolio', tone: 'orange', icon: 'keyboard' },
  { file: 'key-linkedin.svg', label: 'LinkedIn', tone: 'blue', icon: 'linkedin' },
  { file: 'key-email.svg', label: 'Email', tone: 'charcoal', icon: 'mail' },
  { file: 'key-resume.svg', label: 'Resume', tone: 'teal', icon: 'doc' },
]

function contactKey({ label, tone, icon }) {
  const { color, ink } = PALETTE[tone]
  const size = 19
  const h = 64
  const w = Math.round(textWidth(label, size) + size * 1.15 + 8 + 48)
  emitted.clear()
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w + 8} ${h + 16}" width="${w + 8}" height="${h + 16}" role="img" aria-label="${esc(label)}">
  <style>text{font-family:${SANS};font-weight:600}</style>
  <defs>${SOFT}${capDefs(tone, color)}</defs>
  ${keycap({ x: 4, y: 2, w, h, name: tone, ink, label, icon: ICONS[icon].replace(/currentColor/g, ink), size })}
</svg>
`
}

out('banner.svg', banner())
out('stack.svg', stack())
for (const c of CONTACT) out(c.file, contactKey(c))
console.log('assets written')
