// node --test   (no dependencies)
const test = require('node:test')
const assert = require('node:assert/strict')
const F = require('../facts.js')

test('0 and 1 is the first set: 25 facts, 0s included', () => {
  const plan = F.defaultPlan()
  const facts = F.factsFor(plan)
  assert.equal(facts.length, 25) // 0x0..0x12 and 1x1..1x12
  assert.ok(facts.includes('0x7') && facts.includes('1x12') && !facts.includes('2x2'))
})

test('cumulative practice covers earlier sets; this-week-only does not', () => {
  const plan = { now: [7], before: [0, 1, 2, 3, 4, 5, 6], mix: true, quiz: false }
  assert.ok(F.factsFor(plan).includes('2x3'))
  assert.ok(!F.factsFor({ ...plan, mix: false }).includes('2x3'))
  assert.ok(F.factsFor({ ...plan, mix: false }).includes('3x7'))
})

test('cleanPlan repairs bad saves and keeps a table out of both lists', () => {
  assert.deepEqual(F.cleanPlan(null), F.defaultPlan())
  assert.deepEqual(F.cleanPlan({ now: [], before: [] }), F.defaultPlan())
  assert.deepEqual(F.cleanPlan({ now: [3, 3, 99, 'x'], before: [3, 2], mix: false, quiz: true }), { now: [3], before: [2], mix: false, quiz: true })
})

test('strong means right and quick the last 3 times', () => {
  const s = {}
  assert.equal(F.status(s['7x8']), 'new')
  F.record(s, '7x8', true, 2000)
  F.record(s, '7x8', true, 2500)
  assert.equal(F.record(s, '7x8', true, 3000), 'strong')
  assert.equal(F.record(s, '7x8', false, 0), 'learning') // a miss resets it
  F.record(s, '7x8', true, 1000); F.record(s, '7x8', true, 1000)
  assert.equal(F.record(s, '7x8', true, 9000), 'learning') // right but slow
  assert.equal(s['7x8'].length, 5) // only the last 5 are kept
})

test('weights favor the new set, misses and slow answers; strong facts fade', () => {
  const plan = { now: [7], before: [2], mix: true, quiz: false }
  const s = { '2x3': [20, 20, 20], '2x4': [20, 0], '2x5': [90], '2x6': [] }
  assert.ok(F.weight('3x7', plan, s) > F.weight('2x9', plan, s)) // this week's set
  assert.ok(F.weight('2x4', plan, s) > F.weight('2x9', plan, s)) // missed lately
  assert.ok(F.weight('2x5', plan, s) > F.weight('2x3', plan, { '2x3': [20] })) // slow
  assert.ok(F.weight('2x3', plan, s) < F.weight('2x9', plan, s)) // strong fades
})

test('pick draws from the plan, avoids recent facts, and leans to the new set', () => {
  const plan = { now: [7], before: [0, 1, 2, 3, 4, 5, 6], mix: true, quiz: false }
  let seed = 1
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  let sevens = 0
  for (let i = 0; i < 2000; i++) {
    const k = F.pick(plan, {}, ['7x7'], rnd)
    assert.ok(F.factsFor(plan).includes(k) && k !== '7x7')
    if (F.parse(k).includes(7)) sevens++
  }
  // 12 of the 63 facts (minus 7x7) have a 7, about 19%; weighting should make that well over a third.
  assert.ok(sevens / 2000 > 0.35, `sevens ${sevens}`)
})

test('quizSet: n different facts, cumulative even when practice is this week only', () => {
  const plan = { now: [3], before: [0, 1, 2], mix: false, quiz: true }
  const q = F.quizSet(plan, {}, 20)
  assert.equal(q.length, 20)
  assert.equal(new Set(q).size, 20)
  assert.ok(q.every(k => F.factsFor({ ...plan, mix: true }).includes(k)))
  assert.equal(F.quizSet(F.defaultPlan(), {}, 40).length, 25) // never more than there are
})

test('nextWeek moves this week to learned and picks the next table', () => {
  assert.deepEqual(F.nextWeek(F.defaultPlan()), { now: [2], before: [0, 1], mix: true, quiz: false })
  const out = F.nextWeek({ now: [12], before: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], mix: true, quiz: false })
  assert.deepEqual(out.now, [])
  assert.equal(F.factsFor(out).length, 91) // all learned: review everything
})

test('tableNames', () => {
  assert.equal(F.tableNames([1, 0]), '0s and 1s')
  assert.equal(F.tableNames([7]), '7s')
  assert.equal(F.tableNames([0, 1, 2, 3, 4, 5, 6, 9]), '0s–6s and 9s')
  assert.equal(F.tableNames([2, 5, 10]), '2s, 5s and 10s')
})
