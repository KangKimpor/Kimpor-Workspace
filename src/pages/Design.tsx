import { motion } from 'motion/react'
import { Inbox, Plus } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Ambient, Glass, GlassButton, GlassPanel, GlassPopover } from '@/components/glass'
import type { ButtonStatus } from '@/components/glass'
import { EmptyState } from '@/components/EmptyState'
import { useListStagger, useMotionReduced } from '@/motion/hooks'
import { DURATION, SPRING } from '@/motion/tokens'
import './specimen.css'

const SURFACE_TOKENS = [
  '--bg-canvas',
  '--bg-sidebar',
  '--bg-raised',
  '--bg-hover',
  '--bg-pressed',
  '--border-subtle',
  '--border-strong',
  '--text-primary',
  '--text-secondary',
  '--text-tertiary',
  '--accent',
  '--accent-fill',
  '--accent-text',
  '--selection',
  '--danger',
  '--success',
] as const

const PALETTE = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'] as const
const SPACES = [2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64] as const
const RADII = [
  ['chip', 4],
  ['control', 6],
  ['card', 8],
  ['popover', 12],
  ['modal', 16],
  ['glass', 20],
  ['tabbar', 28],
  ['pill', 999],
] as const
const TYPE_ROLES = [
  ['Page title', 't-title', '40 / 48 · 700'],
  ['Heading 1', 't-h1', '30 / 38 · 700'],
  ['Heading 2', 't-h2', '24 / 32 · 600'],
  ['Heading 3', 't-h3', '20 / 28 · 600'],
  ['Body', 't-body', '16 / 24 · 400'],
  ['UI label', 't-label', '14 / 20 · 500'],
  ['Small', 't-small', '12 / 16 · 500'],
  ['Caption', 't-caption', '11 / 14 · 600'],
] as const
const STATUS = [
  ['Not started', 'gray'],
  ['In progress', 'blue'],
  ['In review', 'purple'],
  ['Blocked', 'red'],
  ['Done', 'green'],
] as const
const PRIORITY = [
  ['Low', 'gray'],
  ['Medium', 'blue'],
  ['High', 'orange'],
  ['Urgent', 'red'],
] as const
const DURATIONS = [
  ['instant', DURATION.instant],
  ['fast', DURATION.fast],
  ['base', DURATION.base],
  ['slow', DURATION.slow],
  ['page', DURATION.page],
] as const

function Section({ id, title, lede, children }: { id: string; title: string; lede?: string; children: ReactNode }) {
  return (
    <section className="spec-section" aria-labelledby={id}>
      <h2 id={id} className="t-h2">
        {title}
      </h2>
      {lede ? <p className="lede t-body">{lede}</p> : null}
      {children}
    </section>
  )
}

function Chip({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="chip" style={{ ['--chip' as string]: `var(--chip-${color})`, ['--chip-dot' as string]: `var(--c-${color})` }}>
      <span className="dot" aria-hidden="true" />
      {children}
    </span>
  )
}

/** One theme pane: forces data-theme on a subtree so both themes show side by side. */
function Pane({ theme, children }: { theme: 'light' | 'dark'; children: ReactNode }) {
  return (
    <div className="pane" data-theme={theme} data-testid={`pane-${theme}`}>
      <Ambient />
      <div className="pane-body">
        <div className="t-caption pane-label">{theme === 'light' ? 'Light' : 'Dark'}</div>
        {children}
      </div>
    </div>
  )
}

function Materials() {
  return (
    <div className="cover">
      <div className="material-grid">
        {(['thin', 'regular', 'thick', 'tinted'] as const).map((m) => (
          <Glass key={m} material={m} className="material-card">
            <div className="t-label">{m[0]!.toUpperCase() + m.slice(1)}</div>
            <div className="t-small" style={m === 'tinted' ? { color: 'var(--on-accent)' } : undefined}>
              {{ thin: 'Toolbars · 12 px', regular: 'Sidebar, tab bar · 24 px', thick: 'Modals, sheets · 40 px', tinted: 'Primary buttons' }[m]}
            </div>
          </Glass>
        ))}
      </div>
    </div>
  )
}

function ButtonStates() {
  const states: { label: string; node: ReactNode }[] = [
    { label: 'Default', node: <GlassButton>Button</GlassButton> },
    { label: 'Hover', node: <GlassButton force="hover">Button</GlassButton> },
    { label: 'Pressed', node: <GlassButton force="pressed">Button</GlassButton> },
    { label: 'Focus', node: <GlassButton force="focus">Button</GlassButton> },
    { label: 'Disabled', node: <GlassButton disabled>Button</GlassButton> },
    { label: 'Loading', node: <GlassButton loading>Button</GlassButton> },
    { label: 'Success', node: <GlassButton status="success">Button</GlassButton> },
    { label: 'Error', node: <GlassButton status="error">Button</GlassButton> },
    { label: 'Tinted', node: <GlassButton variant="tinted">Primary</GlassButton> },
    { label: 'Tinted loading', node: <GlassButton variant="tinted" loading>Primary</GlassButton> },
  ]
  return (
    <div className="cover" data-tone="bright">
      <div className="states">
        {states.map((s) => (
          <figure key={s.label}>
            {s.node}
            <figcaption>{s.label}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}

function Chips() {
  return (
    <div className="row">
      {STATUS.map(([l, c]) => (
        <Chip key={l} color={c}>
          {l}
        </Chip>
      ))}
      {PRIORITY.map(([l, c]) => (
        <Chip key={l} color={c}>
          {l}
        </Chip>
      ))}
    </div>
  )
}

function LiveButton() {
  const [state, setState] = useState<'idle' | 'loading' | ButtonStatus>('idle')
  const run = (outcome: 'success' | 'error') => {
    setState('loading')
    window.setTimeout(() => {
      setState(outcome)
      window.setTimeout(() => setState('idle'), 1400)
    }, 900)
  }
  return (
    <div className="row">
      <GlassButton variant="tinted" loading={state === 'loading'} status={state === 'success' || state === 'error' ? state : 'idle'} onClick={() => run('success')}>
        Save changes
      </GlassButton>
      <GlassButton loading={state === 'loading'} onClick={() => run('error')}>
        Try failing
      </GlassButton>
    </div>
  )
}

function PopoverDemo() {
  return (
    <GlassPopover
      label="Example popover"
      align="start"
      trigger={<GlassButton>Open popover</GlassButton>}
    >
      <div className="menu-label t-caption">Thick material</div>
      <button type="button" className="menu-option">
        Menus over glass use Thick
      </button>
      <button type="button" className="menu-option">
        Scales from 0.96 and fades
      </button>
    </GlassPopover>
  )
}

function Motion() {
  const reduced = useMotionReduced()
  const item = useListStagger()
  const [run, setRun] = useState(false)
  const [spring, setSpring] = useState(false)
  const [loop, setLoop] = useState(0)
  return (
    <div className="panes" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
      <GlassPanel material="thick" title="Durations">
        <div className="motion-bars">
          {DURATIONS.map(([name, d]) => (
            <div className="motion-bar" key={name}>
              <span className="t-small">{name}</span>
              <span className="track">
                <span className="fill" data-run={run} style={{ ['--d' as string]: `${d}s` }} />
              </span>
              <span className="t-small tabular text-secondary">{Math.round(d * 1000)} ms</span>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 'var(--space-12)' }}>
          <GlassButton onClick={() => setRun((v) => !v)}>Replay</GlassButton>
        </div>
      </GlassPanel>
      <GlassPanel material="thick" title="Springs">
        <div className="row" style={{ minHeight: 'var(--space-48)' }}>
          {(['snappy', 'smooth', 'bouncy'] as const).map((k) => (
            <div key={k} style={{ display: 'grid', justifyItems: 'center', gap: 'var(--space-4)', width: 'var(--space-64)' }}>
              <motion.div
                className="spring-dot"
                animate={{ x: spring ? 0 : 0, y: 0, scale: spring ? 1.25 : 1 }}
                transition={reduced ? { duration: DURATION.fast } : SPRING[k]}
              />
              <span className="t-small">{k}</span>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 'var(--space-12)' }}>
          <GlassButton onClick={() => setSpring((v) => !v)}>Toggle</GlassButton>
        </div>
      </GlassPanel>
      <GlassPanel material="thick" title="List stagger · 30 ms · max 8">
        <ul className="stagger-list" key={loop}>
          {Array.from({ length: 5 }, (_, i) => (
            <motion.li key={i} {...item(i)}>
              <span className="skeleton" style={{ width: 'var(--space-20)', height: 'var(--space-20)' }} />
              Row {i + 1}
            </motion.li>
          ))}
        </ul>
        <div className="row" style={{ marginTop: 'var(--space-12)' }}>
          <GlassButton onClick={() => setLoop((n) => n + 1)}>Replay</GlassButton>
        </div>
      </GlassPanel>
    </div>
  )
}

function Levels() {
  return (
    <div className="panes" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
      {(['full', 'reduced', 'off'] as const).map((l) => (
        <div key={l} data-glass={l} className="cover" data-tone={l === 'off' ? 'bright' : undefined}>
          <Glass material="regular" className="material-card">
            <div className="t-label">{l[0]!.toUpperCase() + l.slice(1)}</div>
            <div className="t-small">{{ full: 'Blur 24 px, rim and sheen', reduced: 'Blur 12 px only', off: 'Solid surface with border' }[l]}</div>
          </Glass>
        </div>
      ))}
    </div>
  )
}

export default function Design() {
  return (
    <div className="page" data-wide="true">
      <h1 className="t-title large-title">Design system</h1>
      <p className="t-body text-secondary" style={{ margin: 0 }}>
        Every token, material and component state, in light and dark. Source: SPEC sections 9 to 11.
      </p>

      <Section id="surfaces" title="Surfaces and text" lede="Core tokens. Components reference these names, never literals.">
        <div className="swatches">
          {SURFACE_TOKENS.map((t) => (
            <div className="swatch" key={t}>
              <div className="chipbox" style={{ background: `var(${t})` }} />
              <code>{t}</code>
            </div>
          ))}
        </div>
      </Section>

      <Section id="palette" title="Palette" lede="Tag, project, status and highlight colors. Chips use the chip background with primary text.">
        <div className="palette-grid">
          {PALETTE.map((c) => (
            <div className="palette-card" key={c}>
              <span className="dot" style={{ ['--c' as string]: `var(--c-${c})` }} />
              <Chip color={c}>{c[0]!.toUpperCase() + c.slice(1)}</Chip>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 'var(--space-16)' }}>
          <Chips />
        </div>
      </Section>

      <Section id="type" title="Typography" lede="System fonts only. Tabular numerals for times, dates and counts.">
        {TYPE_ROLES.map(([name, cls, spec]) => (
          <div className="type-row" key={name}>
            <span className="t-small text-secondary">
              {name}
              <br />
              <span className="tabular">{spec}</span>
            </span>
            <span className={cls}>The quick brown fox 0123456789</span>
          </div>
        ))}
      </Section>

      <Section id="shape" title="Spacing, radii and elevation">
        <div style={{ display: 'grid', gap: 'var(--space-6)', marginBottom: 'var(--space-24)' }}>
          {SPACES.map((s) => (
            <div key={s} className="row" style={{ gap: 'var(--space-12)' }}>
              <span className="token-name tabular" style={{ width: 'var(--space-64)' }}>
                {s} px
              </span>
              <span className="space-bar" style={{ width: `var(--space-${s})` }} />
            </div>
          ))}
        </div>
        <div className="row" style={{ alignItems: 'end', marginBottom: 'var(--space-24)' }}>
          {RADII.map(([name, px]) => (
            <div key={name} style={{ display: 'grid', gap: 'var(--space-4)', justifyItems: 'center' }}>
              <div className="radius-box" style={{ borderRadius: `var(--radius-${name})` }} />
              <span className="token-name">
                {name} {px === 999 ? '' : px}
              </span>
            </div>
          ))}
        </div>
        <div className="elev-box" role="img" aria-label="Popover shadow sample" />
      </Section>

      <Section id="materials" title="Glass materials" lede="Thin, Regular, Thick and Tinted over a colored cover. Content stays solid; glass only floats above it.">
        <Materials />
      </Section>

      <Section id="levels" title="Glass levels" lede="Full, Reduced and Off. Reduced is blur only; Off uses solid surfaces with borders.">
        <Levels />
      </Section>

      <Section id="components" title="Components and states" lede="Default, hover, pressed, focus, disabled, loading, success and error, in both themes.">
        <div className="panes">
          {(['light', 'dark'] as const).map((t) => (
            <Pane key={t} theme={t}>
              <ButtonStates />
              <Chips />
              <EmptyState icon={<Inbox size={28} strokeWidth={1.75} />} title="Nothing here yet" action={<span className="btn-accent btn-glow" role="presentation"><Plus size={16} strokeWidth={1.75} aria-hidden="true" />Create</span>}>
                Empty states float their glyph and glow the primary action.
              </EmptyState>
            </Pane>
          ))}
        </div>
      </Section>

      <Section id="interactive" title="Interactive" lede="Live loading, success and error, and a popover on the Thick material.">
        <div className="cover" data-tone="bright">
          <LiveButton />
          <PopoverDemo />
        </div>
      </Section>

      <Section id="motion" title="Motion" lede="Duration and spring tokens. Reduced motion swaps movement for opacity and removes overshoot.">
        <Motion />
      </Section>
    </div>
  )
}
