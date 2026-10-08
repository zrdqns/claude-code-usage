import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const HOUR = 3600000
const NOW = 1000 * HOUR
const PANE = {
  title: 'Usage',
  isFocused: false,
  bodyColumns: 40,
  placement: 'dock',
  scroll: { top: 0, rows: 30, total: 30 },
} as never

type Limit = { kind: string; percentUsed: number; resetsAt?: string }

/** A session at this share of its context window, with these rate limits. */
const world = (on: On, percent: number, rateLimits: Limit[]) => {
  const clock = mock.clock(on, { now: NOW })
  on('session.usage', () => ({
    value: {
      startedAt: NOW - 125000,
      context: { window: 1000000, tokens: percent * 10000, percent },
      rateLimits,
      cost: { usd: 3.514 },
    } as never,
  }))

  return clock
}

const drawn = async ($: Engine, surface: 'terminal' | 'desktop' = 'desktop') => {
  const pane = await $.ui.mount({
    plugin: 'usage',
    surface,
    component: 'Pane',
    requestId: 'usage',
    props: PANE,
  })
  const texts = (await pane.findAll({ type: 'Text' })).map(found => found.text)
  const hasSvg = (await pane.find({ type: 'Svg' })) !== undefined
  await pane.unmount()

  return { texts, hasSvg }
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the pane draws on ${surface}, with no notices when there is nothing to report`, async ($, on) => {
    world(on, 18, [
      { kind: 'five_hour', percentUsed: 9, resetsAt: new Date(NOW + 4 * HOUR).toISOString() },
      { kind: 'seven_day', percentUsed: 79 },
    ])

    const { texts, hasSvg } = await drawn($, surface)

    expect(texts).toContain('2 min 5 s')
    expect(texts).toContain('this session · $3.51')
    expect(texts).not.toContain('18%')
    expect(texts).toContain('180k of 1M')
    // The band mod has the five-hour figure: the pane keeps its reset.
    expect(texts).toContain('5-hour limit')
    expect(texts).not.toContain('9%')
    expect(texts).toContain('4 h 0 min')
    expect(texts).toContain('7-day limit')
    expect(texts).toContain('79%')
    expect(texts).not.toContain('Notices')
    expect(hasSvg).toBe(surface === 'desktop')
  })
}

test("warns from 80% of context or of a limit, without repeating the band's figures", async ($, on) => {
  world(on, 86, [
    { kind: 'five_hour', percentUsed: 82.4 },
    { kind: 'seven_day', percentUsed: 91 },
  ])

  const { texts } = await drawn($)

  expect(texts).toContain('Notices')
  expect(texts).toContain('Context is high: consider /compact')
  expect(texts).toContain('7-day limit at 91%')
  expect(texts.filter(text => /^.+ limit at \d+%$/.test(text))).toHaveLength(1)
  expect(texts.some(text => text.includes('86%') || text.includes('82%'))).toBe(false)
})

test('of the last turn it says the output; its length and its cost go on the band', async ($, on) => {
  world(on, 18, [])
  on('turn.complete', () => ({ text: '' }))

  await $.turn.complete({
    answer: '',
    durationMs: 72000,
    isAborted: false,
    turnId: 't1',
    reason: 'answer',
    usage: {
      input_tokens: 300,
      output_tokens: 1200,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    } as never,
  })
  const { texts } = await drawn($)

  expect(texts).toContain('Last turn')
  expect(texts.filter(text => text === '1.2k')).toHaveLength(2)
  expect(texts).not.toContain('duration')
  expect(texts).not.toContain('1 min 12 s')
  expect(texts.filter(text => text.includes('$'))).toEqual(['this session · $3.51'])
})

test(
  "shows the converter's last notice for one minute",
  {
    plugins: [
      {
        name: 'converter',
        register(on) {
          on('tool.call', async ($, e, next) => {
            const at = await $.clock.now()
            await $.state.set(
              { plugin: 'converter', key: 'notice' } as never,
              { text: 'report.pdf converted to Markdown', at } as never,
            )

            return next(e)
          })
        },
      },
    ],
  },
  async ($, on) => {
    const clock = world(on, 18, [])
    on('tool.call', () => ({ result: 'done' }) as never)

    expect((await drawn($)).texts).not.toContain('Notices')

    await $.tool.call({ tool: 'Read', file_path: 'report.pdf' })
    const fresh = (await drawn($)).texts
    expect(fresh).toContain('Notices')
    expect(fresh).toContain('report.pdf converted to Markdown')

    await clock.advance(61000)
    expect((await drawn($)).texts).not.toContain('Notices')
  },
)
