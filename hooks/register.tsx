import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const PANE = 'consumo'
const TITLE = 'Consumo'

const tokens = atom({ plugin: 'consumo', key: 'tokens' } as const, {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
})
const tools = atom({ plugin: 'consumo', key: 'tools' } as const, {})
const parts = atom({ plugin: 'consumo', key: 'parts' } as const, [])
const last = atom({ plugin: 'consumo', key: 'last' } as const, null)
// The conversor mod's last notice, when it is loaded.
const converted = { plugin: 'conversor', key: 'notice' } as const
// From this share of the context window or of a rate limit, the pane says so.
const ALERT_PERCENT = 80
// How long another mod's notice stays in the pane.
const NOTICE_MS = 60000

const LIMITS: Record<string, string> = {
  five_hour: '5 horas',
  seven_day: '7 días',
  spend_limit: 'gasto',
}

const PARTS: Record<string, string> = {
  'System prompt': 'sistema',
  'System tools': 'herramientas',
  'MCP tools': 'herramientas MCP',
  'Custom agents': 'agentes',
  'Memory files': 'memoria',
  Messages: 'mensajes',
}

// The desktop draws the meter as an image, outside the theme: these read on
// a dark and on a light pane alike.
const METER = { calm: '#9c9a92', warning: '#d4a037', error: '#d65f4a' }

const trim = (n: number, digits: number) =>
  n.toFixed(digits).replace(/\.?0+$/, '')

const compact = (n: number) =>
  n >= 1e6
    ? `${trim(n / 1e6, 2)}M`
    : n >= 1e3
      ? `${trim(n / 1e3, 1)}k`
      : `${n}`

const span = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)

  return m >= 60
    ? `${Math.floor(m / 60)} h ${m % 60} min`
    : m > 0
      ? `${m} min ${s % 60} s`
      : `${s} s`
}

const until = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60000))

  return m >= 1440
    ? `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h`
    : m >= 60
      ? `${Math.floor(m / 60)} h ${m % 60} min`
      : `${m} min`
}

const tone = (percent: number) =>
  percent >= 85 ? 'error' : percent >= 60 ? 'warning' : undefined

const shortName = (tool: string) => tool.replace(/^mcp__.*__/, '')

const meter = (percent: number, color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="12" viewBox="0 0 100 12" preserveAspectRatio="none">` +
  `<rect y="4" width="100" height="4" fill="${METER.calm}" fill-opacity="0.3"/>` +
  `<rect y="4" width="${Math.min(100, Math.max(0, percent))}" height="4" fill="${color}"/>` +
  `</svg>`

const refresh = async ($: EngineInterface) => {
  try {
    const { context } = await $.session.usage({ breakdown: 'summary' })
    const rows = (context.breakdown?.categories ?? [])
      .filter(row => row.kind === 'used' && row.tokens > 0)
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 3)
      .map(row => ({ name: row.name, tokens: row.tokens }))
    await update($, parts, () => rows)
  } catch {
    // No breakdown yet (no session bound): the pane draws without it.
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'consumo',
      description: 'Abre el tablero de consumo de la sesión',
    })
    void $.ui.open({ id: PANE, title: TITLE })
    $.clock.every(1000, () => $.ui.invalidate('ui.render'))

    await refresh($)

    return next(e)
  })

  on('command.run', { command: 'consumo' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Tablero de consumo abierto.' }
  })

  on('tool.call', async ($, e, next) => {
    await update($, tools, counts => ({
      ...counts,
      [e.tool]: (counts[e.tool] ?? 0) + 1,
    }))

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const { usage } = e
    if (usage) {
      await update($, tokens, sum => ({
        input: sum.input + usage.input_tokens,
        output: sum.output + usage.output_tokens,
        cacheRead: sum.cacheRead + usage.cache_read_input_tokens,
        cacheWrite: sum.cacheWrite + usage.cache_creation_input_tokens,
      }))
    }
    if (e.agentId === undefined) {
      await update($, last, () => ({ output: usage?.output_tokens ?? 0 }))
      await refresh($)
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const [spent, counts, rows, turn, notice, usage, now] =
      await Promise.all([
        read($, tokens),
        read($, tools),
        read($, parts),
        read($, last),
        $.state.get(converted),
        $.session.usage(),
        $.clock.now(),
      ])

    const { context, cost, rateLimits } = usage
    const { percent } = context
    const fresh = spent.input + spent.cacheWrite
    const incoming = fresh + spent.cacheRead
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1])
    const calls = ranked.reduce((sum, [, count]) => sum + count, 0)
    // The franja mod's band has the context's figure and the five-hour one:
    // the pane keeps the advice, and the limits the band does not show.
    const warnings = [
      ...(percent !== undefined && percent >= ALERT_PERCENT
        ? [
            {
              text: 'Contexto alto: conviene /compact',
              color: tone(percent) ?? 'warning',
            },
          ]
        : []),
      ...rateLimits
        .filter(
          limit =>
            limit.kind !== 'five_hour' && limit.percentUsed >= ALERT_PERCENT,
        )
        .map(limit => ({
          text: `Límite de ${LIMITS[limit.kind] ?? limit.kind} al ${Math.round(limit.percentUsed)}%`,
          color: tone(limit.percentUsed) ?? 'warning',
        })),
    ]
    const news = [notice.value].flatMap(said =>
      said !== undefined && said !== null && now - said.at < NOTICE_MS
        ? [said.text]
        : [],
    )

    const head = (label: string, value: string) => (
      <Box flexDirection="row" justifyContent="space-between">
        <Text>{label}</Text>
        <Text bold>{value}</Text>
      </Box>
    )

    const sub = (label: string, value: string) => (
      <Box flexDirection="row" justifyContent="space-between">
        <Text dimColor wrap="truncate-end">
          {label}
        </Text>
        <Text dimColor>{value}</Text>
      </Box>
    )

    const gauge = (label: string, value: number) => {
      const alert = tone(value)
      if (e.surface === 'terminal') {
        const columns = Math.max(16, e.props.bodyColumns)
        const full = Math.round((Math.min(100, value) / 100) * columns)

        return (
          <Box flexDirection="row">
            {full > 0 && alert === undefined && <Text>{'━'.repeat(full)}</Text>}
            {full > 0 && alert !== undefined && (
              <Text color={alert}>{'━'.repeat(full)}</Text>
            )}
            {full < columns && (
              <Text dimColor>{'─'.repeat(columns - full)}</Text>
            )}
          </Box>
        )
      }
      const { Svg } = $.ui.resolve(e)

      return (
        <Svg
          source={meter(value, METER[alert ?? 'calm'])}
          alt={`${label} al ${value}%`}
          height={12}
        />
      )
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold>{span(now - usage.startedAt)}</Text>
          <Text dimColor>
            {cost === undefined
              ? 'de sesión'
              : `de sesión · $${cost.usd.toFixed(2)}`}
          </Text>
        </Box>

        {(warnings.length > 0 || news.length > 0) && (
          <Box flexDirection="column">
            <Text>Avisos</Text>
            {warnings.map(warning => (
              <Text color={warning.color}>{warning.text}</Text>
            ))}
            {news.map(text => (
              <Text dimColor>{text}</Text>
            ))}
          </Box>
        )}

        {rateLimits.map(limit => {
          const label = `Límite de ${LIMITS[limit.kind] ?? limit.kind}`
          const value = Math.round(limit.percentUsed)
          const reset =
            limit.resetsAt !== undefined &&
            sub('reinicia en', until(Date.parse(limit.resetsAt) - now))

          // The franja mod's band has the five-hour figure: here, only its reset.
          return limit.kind === 'five_hour' ? (
            reset && (
              <Box flexDirection="column">
                <Text>{label}</Text>
                {reset}
              </Box>
            )
          ) : (
            <Box flexDirection="column">
              {head(label, `${value}%`)}
              {gauge(label, value)}
              {reset}
            </Box>
          )
        })}

        {context.tokens !== undefined && (
          <Box flexDirection="column">
            {head(
              'Contexto',
              `${compact(context.tokens)} de ${compact(context.window)}`,
            )}
            {rows.map(row =>
              sub(PARTS[row.name] ?? row.name.toLowerCase(), compact(row.tokens)),
            )}
          </Box>
        )}

        {/* Its length and its cost are on the franja mod's band. */}
        {turn !== null && (
          <Box flexDirection="column">
            <Text>Último turno</Text>
            {sub('salida', compact(turn.output))}
          </Box>
        )}

        <Box flexDirection="column">
          {head('Tokens', compact(spent.output + fresh))}
          {sub('salida', compact(spent.output))}
          {sub('entrada', compact(fresh))}
          {incoming > 0 &&
            sub(
              'servido de caché',
              `${Math.round((spent.cacheRead / incoming) * 100)}%`,
            )}
        </Box>

        <Box flexDirection="column">
          {head('Herramientas', `${calls}`)}
          {ranked
            .slice(0, 5)
            .map(([tool, count]) => sub(shortName(tool), `${count}`))}
          {ranked.length > 5 && (
            <Text dimColor>+{ranked.length - 5} más</Text>
          )}
        </Box>
      </Box>
    )
  })
}
