// Multiplication facts 0-12: the weekly plan, which fact to ask next, and when a fact is "strong".
// Pure functions only (no DOM, no saving), so test/facts.test.js can run them under node.
//
// A fact is an unordered pair, "3x7", so 3 × 7 and 7 × 3 share their history. Each fact keeps its
// last few results: the answer time in tenths of a second when right, 0 when missed or "not yet".
// A plan is { now: [tables this week], before: [tables already learned], mix, quiz }: `mix` practices
// everything so far (the default), not just this week's set; `quiz` turns the practice quiz on.
;(function (root) {
  const ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  const FAST_MS = 4000 // "quickly": right within 4 seconds
  const STRONG_RUN = 3 // ...the last 3 times in a row
  const KEEP = 5 // results kept per fact

  const key = (a, b) => (a <= b ? `${a}x${b}` : `${b}x${a}`)
  const parse = k => k.split('x').map(Number)
  const uniq = list => ALL.filter(t => list.includes(t))

  const defaultPlan = () => ({ now: [0, 1], before: [], mix: true, quiz: false })

  /** A saved plan, checked: tables 0-12, none both "this week" and "learned", never empty. */
  function cleanPlan(p) {
    if (!p || typeof p !== 'object') return defaultPlan()
    const tables = list => (Array.isArray(list) ? uniq(list.filter(t => Number.isInteger(t))) : [])
    const now = tables(p.now)
    const before = tables(p.before).filter(t => !now.includes(t))
    if (!now.length && !before.length) return defaultPlan()
    return { now, before, mix: p.mix !== false, quiz: p.quiz === true }
  }

  /** The tables being practiced: this week's, plus the learned ones when cumulative. */
  function tablesOf(plan) {
    if (!plan.now.length) return plan.before
    return plan.mix ? uniq([...plan.now, ...plan.before]) : plan.now
  }

  /** Every fact (unordered, 0-12) with a factor among the plan's tables. */
  function factsFor(plan) {
    const tables = tablesOf(plan)
    const out = []
    for (const a of ALL) for (const b of ALL) if (a <= b && (tables.includes(a) || tables.includes(b))) out.push(key(a, b))
    return out
  }

  /** 'new' (never tried), 'learning', or 'strong' (right and quick the last 3 times). */
  function status(results) {
    if (!results || !results.length) return 'new'
    const last = results.slice(-STRONG_RUN)
    return last.length === STRONG_RUN && last.every(r => r > 0 && r * 100 <= FAST_MS) ? 'strong' : 'learning'
  }

  /** Adds one result to `stats` (changed in place) and returns the fact's new status. */
  function record(stats, k, right, ms) {
    const r = right ? Math.max(1, Math.min(600, Math.round(ms / 100))) : 0
    stats[k] = (stats[k] || []).concat(r).slice(-KEEP)
    return status(stats[k])
  }

  /** How likely a fact is to come up: this week's set ×3, missed lately +3, slow last time +1.5,
   *  never tried +1, already strong ×0.3. */
  function weight(k, plan, stats) {
    const [a, b] = parse(k)
    const r = stats[k] || []
    const s = status(r)
    let w = 1
    if (s === 'new') w += 1
    if (r.includes(0)) w += 3
    else if (r.length && r[r.length - 1] * 100 > FAST_MS) w += 1.5
    if (plan.now.includes(a) || plan.now.includes(b)) w *= 3
    if (s === 'strong') w *= 0.3
    return w
  }

  function draw(keys, plan, stats, rnd) {
    const ws = keys.map(k => weight(k, plan, stats))
    let x = rnd() * ws.reduce((s, w) => s + w, 0)
    for (let i = 0; i < keys.length; i++) if ((x -= ws[i]) < 0) return i
    return keys.length - 1
  }

  /** The next fact to ask, avoiding the `avoid` keys (the last few asked) when it can. */
  function pick(plan, stats, avoid = [], rnd = Math.random) {
    const all = factsFor(plan)
    const keys = all.filter(k => !avoid.includes(k))
    const from = keys.length ? keys : all
    return from.length ? from[draw(from, plan, stats, rnd)] : null
  }

  /** A practice quiz like the school's: `n` different facts from everything so far (cumulative even
   *  when daily practice isn't), weighted the same way. */
  function quizSet(plan, stats, n = 20, rnd = Math.random) {
    const keys = factsFor({ ...plan, mix: true })
    const out = []
    while (out.length < n && keys.length) out.push(keys.splice(draw(keys, plan, stats, rnd), 1)[0])
    return out
  }

  /** Next week: this week's tables count as learned, and the next unlearned table in order is new. */
  function nextWeek(plan) {
    const before = uniq([...plan.before, ...plan.now])
    const next = ALL.find(t => !before.includes(t))
    return { ...plan, before, now: next === undefined ? [] : [next] }
  }

  /** "0s and 1s", "7s", "0s–6s and 9s": tables in words, with runs of 3+ shortened. */
  function tableNames(list) {
    const runs = []
    for (const t of uniq(list)) {
      const last = runs[runs.length - 1]
      if (last && last[1] === t - 1) last[1] = t
      else runs.push([t, t])
    }
    const parts = runs.flatMap(([a, b]) => (b - a >= 2 ? [`${a}s–${b}s`] : a === b ? [`${a}s`] : [`${a}s`, `${b}s`]))
    return parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  }

  const api = { ALL, FAST_MS, key, parse, defaultPlan, cleanPlan, tablesOf, factsFor, status, record, weight, pick, quizSet, nextWeek, tableNames }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.Facts = api
})(this)
