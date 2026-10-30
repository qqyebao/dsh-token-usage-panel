/**
 * Host half of the token-usage-panel bundle.
 *
 * Registers the `tokenLedger` session projection: the panel's only data source.
 * It folds provider-reported usage out of the durable log, prices every billed
 * sample at its own time band and model, and keeps both whole-session totals
 * and one record per Turn — so the panel needs no other plugin, no shared
 * projection, and no second price table from elsewhere. The table below is the
 * single source of prices for this bundle.
 */
const CURRENCY = '¥'

/**
 * CNY per one million tokens, DeepSeek official rates
 * (https://api-docs.deepseek.com/zh-cn/quick_start/pricing, fetched 2026-10-20).
 * DeepSeek bills cache-hit input, cache-miss input, and output; tracked
 * cache-write tokens carry no separate price.
 */
const MODEL_PRICES = {
  'deepseek-flash': {
    peak: { miss: 2, hit: 0.04, output: 8 },
    idle: { miss: 1, hit: 0.02, output: 4 },
  },
  'deepseek-v4-pro': {
    peak: { miss: 9, hit: 0.3, output: 27 },
    idle: { miss: 4.5, hit: 0.15, output: 13.5 },
  },
}

/** Unknown routes are priced as DeepSeek Flash and flagged in the view. */
const FALLBACK_MODEL = 'deepseek-flash'

/** DeepSeek defines its bands in Beijing time, where the desktop may not be. */
const BEIJING_CLOCK = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Shanghai',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Newest per-turn records kept per Session; older turns roll off the front. */
const MAX_TURNS = 200

/** Views built per state object; identity suppresses unchanged frames. */
const viewCache = new WeakMap()

/**
 * Which band a call billed at `timeMs` falls in. Chinese public holidays are
 * not known here, so a holiday weekday is priced as peak — an overestimate.
 */
function priceBand(timeMs) {
  const parts = BEIJING_CLOCK.formatToParts(new Date(timeMs))
  const read = (type) => parts.find((part) => part.type === type)?.value ?? ''
  const weekday = read('weekday')
  const minutes = Number(read('hour')) * 60 + Number(read('minute'))
  const workday = weekday !== 'Sat' && weekday !== 'Sun'
  const peakHours = (minutes >= 540 && minutes < 720) || (minutes >= 840 && minutes < 1080)
  return workday && peakHours ? 'peak' : 'idle'
}

/** The four tracked buckets. */
function bucketsOf(usage) {
  return {
    uncached: usage.inputTokens ?? 0,
    cacheRead: usage.cacheReadTokens ?? 0,
    cacheWrite: usage.cacheWriteTokens ?? 0,
    output: usage.outputTokens ?? 0,
  }
}

function sameBuckets(left, right) {
  return (
    left.uncached === right.uncached &&
    left.cacheRead === right.cacheRead &&
    left.cacheWrite === right.cacheWrite &&
    left.output === right.output
  )
}

/** The last `usage` chunk of one assistant stream, if it carries one. */
function streamUsage(stream) {
  if (!Array.isArray(stream)) return undefined
  for (let index = stream.length - 1; index >= 0; index -= 1) {
    const record = stream[index]
    if (record !== null && typeof record === 'object' && record.type === 'chunk') {
      const chunk = record.chunk
      if (chunk !== null && typeof chunk === 'object' && chunk.type === 'usage') return chunk.usage
    }
  }
  return undefined
}

/** The usage one durable Assistant settlement reports for its attempt, if any. */
function usageOf(event) {
  const data = event.data
  if (event.type === 'assistant/message') {
    return data.usage !== undefined ? data.usage : streamUsage(data.stream)
  }
  if (event.type === 'assistant/attempt') return streamUsage(data.stream)
  return undefined
}

/** The model id that produced this sample, from the message or the last request header. */
function modelOf(event, route) {
  if (event.type === 'assistant/message') {
    const model = event.data?.message?.source?.model
    if (typeof model === 'string' && model !== '') return model
  }
  if (typeof route === 'string' && route !== '') return route.slice(route.lastIndexOf('/') + 1)
  return FALLBACK_MODEL
}

/** CNY for one sample under one model and band. */
function costOf(tokens, model, band) {
  const rates = (MODEL_PRICES[model] ?? MODEL_PRICES[FALLBACK_MODEL])[band]
  return (tokens.uncached * rates.miss + tokens.cacheRead * rates.hit + tokens.output * rates.output) / 1e6
}

/** Route ledger with one sample's contribution added (or taken back). */
function adjustRoutes(routes, model, delta) {
  const next = { ...routes }
  const value = (next[model] ?? 0) + delta
  if (Math.abs(value) < 1e-9) delete next[model]
  else next[model] = value
  return next
}

function round6(value) {
  return Math.round(value * 1e6) / 1e6
}

function blankTokens() {
  return { uncached: 0, cacheRead: 0, cacheWrite: 0, output: 0 }
}

function negatedTokens(tokens) {
  return {
    uncached: -tokens.uncached,
    cacheRead: -tokens.cacheRead,
    cacheWrite: -tokens.cacheWrite,
    output: -tokens.output,
  }
}

/** The ledger with one empty turn record appended, unless the turn is present. */
function startTurn(turns, turn, time) {
  for (let cursor = turns.length - 1; cursor >= 0; cursor -= 1) {
    if (turns[cursor].turn === turn) return turns
  }
  const next = turns.concat({
    turn,
    time,
    tokens: blankTokens(),
    cost: 0,
    peakCost: 0,
    idleCost: 0,
    models: {},
  })
  if (next.length > MAX_TURNS) next.shift()
  return next
}

/**
 * Add one sample's tokens, cost, band split, and model share to its turn,
 * creating the record when the turn is not in the ledger. Negative deltas take
 * a replaced sample back out, so a retried attempt replaces instead of
 * double-counting.
 */
function addTurnSample(turns, turn, time, tokens, cost, peakCost, idleCost, model) {
  const next = turns.slice()
  let index = -1
  for (let cursor = next.length - 1; cursor >= 0; cursor -= 1) {
    if (next[cursor].turn === turn) {
      index = cursor
      break
    }
  }
  if (index === -1) {
    next.push({
      turn,
      time,
      tokens: { ...tokens },
      cost,
      peakCost,
      idleCost,
      models: { [model]: cost },
    })
    if (next.length > MAX_TURNS) next.shift()
    return next
  }
  const current = next[index]
  const models = { ...current.models }
  const modelCost = (models[model] ?? 0) + cost
  if (Math.abs(modelCost) < 1e-9) delete models[model]
  else models[model] = modelCost
  next[index] = {
    turn,
    time: current.time === 0 ? time : current.time,
    tokens: {
      uncached: current.tokens.uncached + tokens.uncached,
      cacheRead: current.tokens.cacheRead + tokens.cacheRead,
      cacheWrite: current.tokens.cacheWrite + tokens.cacheWrite,
      output: current.tokens.output + tokens.output,
    },
    cost: current.cost + cost,
    peakCost: current.peakCost + peakCost,
    idleCost: current.idleCost + idleCost,
    models,
  }
  return next
}

/**
 * The registry only calls `parse`; a profile-linked bundle resolves no zod, so
 * the schema is the identity contract. State and view are plain JSON.
 */
const passthroughSchema = { parse: (value) => value }

class TokenLedgerProjection {
  constructor() {
    this.key = 'tokenLedger'
    this.stateVersion = 1
    this.stateSchema = passthroughSchema
    this.wire = { viewSchema: passthroughSchema, view: (state) => this.view(state) }
  }

  init() {
    return {
      tokens: blankTokens(),
      cost: 0,
      peakCost: 0,
      idleCost: 0,
      routes: {},
      route: null,
      unpriced: false,
      turns: [],
      last: null,
    }
  }

  apply(state, event) {
    if (event.type === 'request/header') {
      const config = event.data?.header?.config
      if (config === undefined || typeof config.model !== 'string') return state
      const route = (typeof config.provider === 'string' ? config.provider + '/' : '') + config.model
      return route === state.route ? state : { ...state, route }
    }

    if (event.type === 'turn/start') {
      const turns = startTurn(state.turns, event.data.turn, event.time)
      return turns === state.turns ? state : { ...state, turns }
    }

    // A retry ends the replacement scope, so the retried attempt adds its own
    // sample instead of replacing the failed one.
    if (event.type === 'llm/retry-started') {
      const { turn, step } = event.data ?? {}
      if (state.last === null || state.last.turn !== turn || state.last.step !== step) return state
      return { ...state, last: null }
    }

    if (event.type !== 'assistant/message' && event.type !== 'assistant/attempt') return state
    const usage = usageOf(event)
    if (usage === undefined) return state

    const { turn, step } = event.data
    const tokens = bucketsOf(usage)
    const previous =
      state.last !== null && state.last.turn === turn && state.last.step === step ? state.last : null
    if (previous !== null && sameBuckets(previous.tokens, tokens)) return state

    const model = modelOf(event, state.route)
    const band = priceBand(event.time)
    const cost = costOf(tokens, model, band)
    const peakCost = band === 'peak' ? cost : 0
    const idleCost = band === 'idle' ? cost : 0
    const priced = MODEL_PRICES[model] !== undefined

    let routes = adjustRoutes(state.routes, model, cost)
    if (previous !== null) routes = adjustRoutes(routes, previous.model, -previous.cost)

    let turns = state.turns
    if (previous !== null) {
      turns = addTurnSample(
        turns,
        previous.turn,
        event.time,
        negatedTokens(previous.tokens),
        -previous.cost,
        -previous.peakCost,
        -previous.idleCost,
        previous.model,
      )
    }
    turns = addTurnSample(turns, turn, event.time, tokens, cost, peakCost, idleCost, model)

    const previousTokens = previous?.tokens
    return {
      tokens: {
        uncached: state.tokens.uncached - (previousTokens?.uncached ?? 0) + tokens.uncached,
        cacheRead: state.tokens.cacheRead - (previousTokens?.cacheRead ?? 0) + tokens.cacheRead,
        cacheWrite: state.tokens.cacheWrite - (previousTokens?.cacheWrite ?? 0) + tokens.cacheWrite,
        output: state.tokens.output - (previousTokens?.output ?? 0) + tokens.output,
      },
      cost: state.cost - (previous?.cost ?? 0) + cost,
      peakCost: state.peakCost - (previous?.peakCost ?? 0) + peakCost,
      idleCost: state.idleCost - (previous?.idleCost ?? 0) + idleCost,
      routes,
      route: state.route,
      unpriced: state.unpriced || !priced,
      turns,
      last: { turn, step, tokens, model, cost, peakCost, idleCost },
    }
  }

  /**
   * Client view: whole-session totals plus the bounded turn ledger. Tokens use
   * the same wire names as the shipped token meter so the Client can fold them
   * with one helper.
   */
  view(state) {
    const cached = viewCache.get(state)
    if (cached !== undefined) return cached
    const turns = []
    for (const record of state.turns) {
      const total =
        record.tokens.uncached + record.tokens.cacheRead + record.tokens.cacheWrite + record.tokens.output
      if (total <= 0) continue
      turns.push({
        turn: record.turn,
        time: record.time,
        tokens: {
          uncachedInputTokens: record.tokens.uncached,
          cacheReadTokens: record.tokens.cacheRead,
          cacheWriteTokens: record.tokens.cacheWrite,
          outputTokens: record.tokens.output,
        },
        cost: round6(record.cost),
        peakCost: round6(record.peakCost),
        idleCost: round6(record.idleCost),
        models: Object.keys(record.models).sort(),
      })
    }
    const value = {
      currency: CURRENCY,
      tokens: {
        uncachedInputTokens: state.tokens.uncached,
        cacheReadTokens: state.tokens.cacheRead,
        cacheWriteTokens: state.tokens.cacheWrite,
        outputTokens: state.tokens.output,
      },
      cost: round6(state.cost),
      peakCost: round6(state.peakCost),
      idleCost: round6(state.idleCost),
      models: Object.entries(state.routes)
        .sort((left, right) => right[1] - left[1])
        .map(([model, cost]) => ({ model, cost: round6(cost) })),
      unpriced: state.unpriced,
      turns,
    }
    viewCache.set(state, value)
    return value
  }
}

export { TokenLedgerProjection }

/**
 * Mount the unit beside the projection registry. `ctx.inject` declares the
 * dependency properly: the Loader boots rows concurrently, so a bare
 * `ctx.get('sessionProjections')` may run before the registry exists.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 */
export function apply(ctx) {
  ctx.inject(['sessionProjections'], (scope) => {
    const projections = scope.get('sessionProjections')
    if (projections === undefined) return
    const unit = new TokenLedgerProjection()
    // Owned by the injected child fiber, so disposal follows the plugin and a
    // replaced registry re-registers the unit.
    scope.effect(() => projections.register(unit), 'token-usage-panel: tokenLedger projection')
  })
}
