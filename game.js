// Math practice: adding, taking away, times tables and dividing, for ages about 5 to 10. The child
// taps the answer; a wrong tap just shakes and they try again. Ten stars (right the first time) move
// up a level or make a table "strong". Progress is saved for whoever is playing, on every answer.
const STARS = 10
// Adding and taking away share levels: `max` is the biggest number, sums fall in lo..max, and each
// part is at least `part`. `dots` shows countable pictures under the problem.
const LEVELS = [
  { max: 5, lo: 2, part: 1, dots: true },
  { max: 10, lo: 4, part: 1, dots: true },
  { max: 20, lo: 10, part: 2 },
  { max: 100, lo: 20, part: 5 },
]
const MODES = {
  facts: { name: 'My facts', sign: '★' }, // the weekly multiplication facts: its own screen
  add: { name: 'Adding', sign: '+', levelName: max => `Sums up to ${max}` },
  sub: { name: 'Taking away', sign: '−', levelName: max => `Numbers up to ${max}` },
  mul: { name: 'Times tables', sign: '×', tables: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  div: { name: 'Dividing', sign: '÷', tables: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
}
const PRAISE = ['Yes!', 'Great job!', 'You got it!', 'Nice work!', 'Awesome!', "That's right!", 'Super!', 'Well done!', 'Way to go!', 'Brilliant!']
const AGAIN = ['Almost! Try again.', 'Have another go!', 'Not quite. Try again!', 'Keep trying!']
const PICTURES = ['🍎', '⭐', '🐞', '🐟', '🌸', '🍓', '🚗', '🎈', '🐥', '🍪']
const RECENT = 3 // a problem isn't asked again until this many others have been

const el = id => document.getElementById(id)
const sleep = ms => new Promise(r => setTimeout(r, ms))
const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1))
const anyOf = list => list[Math.floor(Math.random() * list.length)]
function shuffle(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

// Saved per child: stars per level (adding, taking away), stars per table (times, dividing), the
// mute choice, a count of every answer, and for "My facts" the weekly plan, each fact's recent
// results (see facts.js) and the practice quiz's best times.
let progress = { muted: false, answers: 0, add: [0, 0, 0, 0], sub: [0, 0, 0, 0], mul: {}, div: {}, plan: Facts.defaultPlan(), facts: {}, quiz: { best: {} } }
let mode = 'add'
let choice = 0 // a level index (adding, taking away), a table number, or 'mixed'
let problem = null
let tried = false // a wrong answer on this problem already: a right one now gets praise, not a star
let locked = false
let screen = 'menu'
const recent = []

// Saves at most every 400 ms (Kinwall allows 30 saves in 10 s), always ending with the latest.
let saveTimer = null
let dirty = false
function persist() {
  dirty = true
  if (saveTimer) return
  const flush = () => {
    saveTimer = null
    if (!dirty) return
    dirty = false
    Kinwall.save('progress', progress).catch(() => { /* offline: keep playing, it saves next time */ })
    saveTimer = setTimeout(flush, 400)
  }
  flush()
}

// Speech, as in sight-words: the clearest English voice on the device, a pause after cancel() (speaking
// straight after it garbles the start), a reference to the utterance, and a fallback for a lost onend.
const speech = 'speechSynthesis' in window ? window.speechSynthesis : null
const UNCLEAR = /Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Grandma|Grandpa|Rocko|Shelley|Flo\b|Eddy|Reed|Sandy/i
const CLEAR = /Samantha|Ava|Allison|Susan|Zoe|Alex|Karen|Daniel|Serena|Moira|Tessa|Aria|Jenny|Guy|Libby|Natural/i
let voice = null
function pickVoice() {
  const english = speech.getVoices().filter(v => /^en([-_]|$)/i.test(v.lang) && !UNCLEAR.test(v.name))
  const score = v => (v.localService ? 4 : 0) + (/en[-_]US/i.test(v.lang) ? 2 : 0) + (CLEAR.test(v.name) ? 3 : 0) + (v.default ? 1 : 0)
  voice = english.sort((a, b) => score(b) - score(a))[0] || null
}
if (speech) { pickVoice(); if (speech.addEventListener) speech.addEventListener('voiceschanged', pickVoice) }
let speaking = null
let turn = 0
async function say(text, rate = 0.85) {
  if (!speech) return
  const mine = ++turn
  if (speech.speaking || speech.pending) {
    speech.cancel()
    await sleep(150)
    if (mine !== turn) return
  }
  speech.resume()
  await new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(text)
    if (voice) { u.voice = voice; u.lang = voice.lang } else u.lang = 'en-US'
    u.rate = rate
    const done = () => { clearTimeout(fallback); if (speaking === u) speaking = null; resolve() }
    const fallback = setTimeout(done, 1500 + text.length * 120)
    u.onend = done
    u.onerror = done
    speaking = u
    speech.speak(u)
  })
}
/** Praise and encouragement: spoken unless this child turned sound off. */
const cheer = text => progress.muted ? Promise.resolve() : say(text)

let lastPhrase = ''
function pickFrom(list) {
  lastPhrase = anyOf(list.filter(p => p !== lastPhrase))
  return lastPhrase
}

const currentLevel = m => { const i = progress[m].findIndex(s => s < STARS); return i < 0 ? LEVELS.length - 1 : i }
const practiced = m => MODES[m].tables.filter(t => progress[m][t] > 0)
const strong = m => MODES[m].tables.filter(t => progress[m][t] >= STARS)

// ---- Problems ----

function makeProblem() {
  if (mode === 'facts') {
    const [a, b] = forced || orient(Facts.pick(plan(), progress.facts, recent))
    forced = null
    return { key: Facts.key(a, b), t: a, k: b, a, b, answer: a * b, text: `${a} × ${b}`, speak: `${a} times ${b}` }
  }
  if (mode === 'add' || mode === 'sub') {
    const L = LEVELS[choice]
    const s = rand(L.lo, L.max)
    const a = rand(L.part, s - L.part)
    const b = s - a
    return mode === 'add'
      ? { a, b, answer: s, text: `${a} + ${b}`, speak: `${a} plus ${b}` }
      : { a: s, b: a, answer: b, text: `${s} − ${a}`, speak: `${s} minus ${a}` }
  }
  const t = choice === 'mixed' ? anyOf(practiced(mode)) : choice
  if (mode === 'mul') {
    const k = rand(0, 12)
    const [a, b] = Math.random() < 0.5 ? [t, k] : [k, t]
    return { t, k, a, b, answer: t * k, text: `${a} × ${b}`, speak: `${a} times ${b}` }
  }
  const k = rand(1, 12)
  return { t, k, a: t * k, b: t, answer: k, text: `${t * k} ÷ ${t}`, speak: `${t * k} divided by ${t}` }
}

/** Plausible wrong answers: off by one or two, off by ten, a neighboring table fact, or the other
 *  operation's result. Never negative, never the answer, never twice. */
function wrongAnswers(p, count) {
  const n = p.answer
  let near
  if (mode === 'add' || mode === 'sub') {
    near = [n + 1, n - 1, n + 2, n - 2, mode === 'add' ? p.a - p.b : p.a + p.b]
    if (LEVELS[choice].max >= 20) near.push(n + 10, n - 10)
  } else if (mode === 'mul' || mode === 'facts') {
    near = [n + p.t, n - p.t, n + p.k, n - p.k, n + 1, n - 1] // one more or less of either factor
    if (n >= 20) near.push(n + 10, n - 10)
  } else {
    near = [n + 1, n - 1, n + 2, n - 2, p.t] // p.t: mixing up the divisor and the answer
  }
  const ok = x => Number.isInteger(x) && x >= 0 && x !== n
  const out = []
  for (const x of shuffle(near)) if (ok(x) && !out.includes(x)) out.push(x)
  while (out.length < count) { const x = n + rand(-5, 5); if (ok(x) && !out.includes(x)) out.push(x) }
  return out.slice(0, count)
}

function next() {
  if (screen !== 'play') return
  locked = false
  tried = false
  let p
  for (let i = 0; i < 30; i++) { p = makeProblem(); if (!recent.includes(p.key || p.text)) break }
  p.shown = performance.now()
  problem = p
  recent.push(p.key || p.text)
  if (recent.length > RECENT) recent.shift()
  el('sum').innerHTML = `${p.text} = <span class="q">?</span>`
  el('praise').textContent = ''
  // Countable pictures for the early levels: two groups to add, or some taken away (faded).
  const dots = el('dots')
  dots.textContent = ''
  const tables = !(mode === 'add' || mode === 'sub')
  if (!tables && LEVELS[choice].dots) {
    const pic = anyOf(PICTURES)
    const group = (n, gone = 0) => {
      const g = document.createElement('span')
      g.className = 'group'
      for (let i = 0; i < n; i++) {
        const d = document.createElement('span')
        d.textContent = pic
        if (i >= n - gone) d.className = 'gone'
        g.append(d)
      }
      return g
    }
    if (mode === 'add') {
      const plus = document.createElement('span')
      plus.className = 'plus'
      plus.textContent = '+'
      dots.append(group(p.a), plus, group(p.b))
    } else dots.append(group(p.a, p.b))
  }
  dots.hidden = !dots.childElementCount
  const count = !tables && choice < 2 ? 3 : 4 // fewer to choose from for the youngest
  const box = el('choices')
  box.className = count === 3 ? 'choices three' : 'choices'
  box.textContent = ''
  for (const v of shuffle([p.answer, ...wrongAnswers(p, count - 1)])) {
    const b = document.createElement('button')
    b.className = 'choice'
    b.textContent = v
    b.onclick = () => choose(b, v)
    box.append(b)
  }
  renderPlay()
}

/** Adds a star for a first-try answer; returns a celebration message when a level or table fills. */
function addStar() {
  if (MODES[mode].tables) {
    const t = problem.t
    const s = progress[mode][t] || 0
    if (s >= STARS) return null
    progress[mode][t] = s + 1
    if (s + 1 < STARS) return null
    return mode === 'mul' ? `You're strong at the ${t} times table!` : `You're strong at dividing by ${t}!`
  }
  const stars = progress[mode]
  if (stars[choice] >= STARS) return null
  stars[choice]++
  if (stars[choice] < STARS) return null
  return choice < LEVELS.length - 1 ? pickFrom(['Level up! Amazing!', 'Level up! You are a math star!', 'New level! Keep it up!'])
    : `You finished every ${mode === 'add' ? 'adding' : 'taking away'} level! Wow!`
}

async function choose(button, value) {
  if (locked) return
  progress.answers++
  if (value !== problem.answer) {
    if (mode === 'facts' && !tried) Facts.record(progress.facts, problem.key, false, 0)
    tried = true
    button.classList.remove('wrong'); void button.offsetWidth; button.classList.add('wrong')
    const again = pickFrom(AGAIN)
    el('praise').textContent = again
    persist()
    cheer(again)
    return
  }
  locked = true
  const asked = problem
  button.classList.add('right')
  el('sum').innerHTML = `${problem.text} = <span class="a">${problem.answer}</span>`
  let party = null
  let praise = pickFrom(PRAISE)
  if (mode === 'facts') {
    if (!tried) {
      const news = factNews(problem.key, true, performance.now() - problem.shown)
      if (news) [praise, party] = news
    }
  } else party = tried ? null : addStar()
  persist()
  renderPlay()
  el('praise').textContent = party ? '' : praise
  // Let the praise finish, then a beat, so it never runs into the next problem.
  await Promise.all([party ? null : cheer(praise), sleep(1100)])
  if (party) await celebrate(party)
  if (problem !== asked) return // they went back and picked something else meanwhile
  if (mode === 'facts') { /* keeps going */ } else if (party && !MODES[mode].tables && choice < LEVELS.length - 1) { choice++; recent.length = 0 }
  // A table just became strong, or the last level is done: back to the list to pick what's next.
  // Mixed keeps going (a table filling up mid-mix isn't the end of it).
  else if (party && choice !== 'mixed') return show('pick')
  next()
}

function celebrate(text) {
  const box = el('party')
  el('party-text').textContent = text
  box.hidden = false
  return new Promise(resolve => {
    const done = () => { clearTimeout(timer); box.hidden = true; box.onclick = null; resolve() }
    const timer = setTimeout(done, 3200)
    box.onclick = done
    cheer(text)
  })
}

// ---- Screens ----

const SCREENS = ['menu', 'pick', 'play', 'facts', 'cards', 'skip', 'chart', 'quiz', 'grown']
function show(name) {
  if (screen === 'quiz' && name !== 'quiz') stopClock()
  screen = name
  for (const s of SCREENS) el(s).hidden = s !== name
  el('back').hidden = name === 'menu'
  el('stars').hidden = name !== 'play'
  if (name === 'menu') renderMenu()
  if (name === 'pick') renderPick()
  if (name === 'facts') renderFacts()
  if (name === 'chart') renderChart()
  if (name === 'quiz') quizIntro()
  if (name === 'grown') { el('grown-ask').hidden = false; el('grown-set').hidden = true }
  window.scrollTo(0, 0)
}

function starLine(s) { return '⭐'.repeat(s) + '☆'.repeat(STARS - s) }

function renderMenu() {
  const box = el('modes')
  box.textContent = ''
  for (const [id, m] of Object.entries(MODES)) {
    const b = document.createElement('button')
    b.className = 'mode'
    const note = id === 'facts' ? planWords(plan())
      : m.tables
      ? (strong(id).length ? `${strong(id).length} of ${m.tables.length} strong` : practiced(id).length ? `${practiced(id).length} practiced` : 'Pick a table')
      : `Level ${currentLevel(id) + 1} of ${LEVELS.length}`
    b.innerHTML = `<span class="mode-sign">${m.sign}</span><span class="mode-name">${m.name}</span><span class="dim">${note}</span>`
    b.onclick = () => { if (speech) pickVoice(); if (id === 'facts') return show('facts'); mode = id; show('pick') }
    box.append(b)
  }
}

function renderPick() {
  const m = MODES[mode]
  el('pick-title').textContent = m.tables ? `${m.name}: pick a table` : `${m.name}: pick a level`
  const box = el('picks')
  box.className = m.tables ? 'picks tables' : 'picks'
  box.textContent = ''
  const add = (html, cls, value, disabled) => {
    const b = document.createElement('button')
    b.className = 'pick ' + cls
    b.innerHTML = html
    b.disabled = !!disabled
    b.onclick = () => { choice = value; recent.length = 0; show('play'); next() }
    box.append(b)
  }
  if (m.tables) {
    for (const t of m.tables) {
      const s = progress[mode][t] || 0
      add(`<span class="num">${t}</span><span class="fill" style="--fill:${s / STARS}"></span>${s >= STARS ? '<span class="badge">⭐</span>' : ''}`,
        s >= STARS ? 'strong' : '', t)
    }
    const few = practiced(mode).length < 2
    add('🎲 Mixed', 'mixed', 'mixed', few)
    el('pick-note').textContent = few ? 'Practice two tables to unlock Mixed.' : 'Mixed: the tables you’ve practiced.'
  } else {
    const cur = currentLevel(mode)
    LEVELS.forEach((L, i) => {
      const s = progress[mode][i]
      add(`<span class="num">${L.max}</span><span class="dim">${m.levelName(L.max)}</span><span class="mini">${s >= STARS ? '✓ Done' : `⭐ ${s} / ${STARS}`}</span>`,
        i === cur ? 'current' : s >= STARS ? 'done' : '', i)
    })
    el('pick-note').textContent = ''
  }
}

function renderPlay() {
  if (mode === 'facts') {
    const [strongCount, total] = factCounts()
    el('stars').textContent = `★ ${strongCount} of ${total} strong`
    el('level').textContent = `My facts · ${planWords(plan())}`
    return
  }
  const tables = MODES[mode].tables
  const s = tables ? (problem ? progress[mode][problem.t] || 0 : 0) : progress[mode][choice]
  el('stars').textContent = starLine(s)
  el('level').textContent = tables
    ? (choice === 'mixed' ? `Mixed · now the ${problem.t}s` : `${MODES[mode].name} · the ${choice}s`)
    : `${MODES[mode].levelName(LEVELS[choice].max)} · level ${choice + 1} of ${LEVELS.length}`
}

function renderMute() {
  const b = el('mute')
  b.textContent = progress.muted ? '🔕' : '🔔'
  b.setAttribute('aria-label', progress.muted ? 'Sound off' : 'Sound on')
  b.setAttribute('aria-pressed', String(progress.muted))
}

el('mute').onclick = () => {
  progress.muted = !progress.muted
  if (progress.muted && speech) speech.cancel()
  renderMute()
  persist()
}
el('say').onclick = () => { if (problem) say(problem.speak, 0.75) } // a tap asks for it, so it speaks even when muted
// ---- My facts: the weekly multiplication facts ----

const plan = () => progress.plan
let forced = null // [a, b]: a fact tapped on the chart, asked next
const NOT_YET = ["That's how we learn!", "It'll come back soon.", 'Good to know. Again soon!', 'No problem. You’ll see it again.']
const orient = k => { const [a, b] = Facts.parse(k); return Math.random() < 0.5 ? [a, b] : [b, a] }
function remember(k) { recent.push(k); if (recent.length > RECENT) recent.shift() }
function planWords(p) {
  if (!p.now.length) return 'Reviewing all your facts'
  const extra = p.mix && p.before.length ? ` + ${Facts.tableNames(p.before)}` : ''
  return `This week: ${Facts.tableNames(p.now)}${extra}`
}
function factCounts() {
  const all = Facts.factsFor(plan())
  return [all.filter(k => Facts.status(progress.facts[k]) === 'strong').length, all.length]
}

/** Records an answer; returns [praise, celebration] when a fact (or this week's whole set) just got strong. */
function factNews(k, right, ms) {
  const was = Facts.status(progress.facts[k])
  if (Facts.record(progress.facts, k, right, ms) !== 'strong' || was === 'strong') return null
  const [a, b] = Facts.parse(k)
  const p = plan()
  const week = Facts.factsFor({ ...p, mix: false })
  const allStrong = p.now.length && week.includes(k) && week.every(f => Facts.status(progress.facts[f]) === 'strong')
  return [`${a} × ${b} is strong now!`, allStrong ? `You know all your ${Facts.tableNames(p.now)}! Amazing!` : null]
}

function renderFacts() {
  el('plan-line').textContent = planWords(plan())
  const [strongCount, total] = factCounts()
  el('facts-note').textContent = `★ ${strongCount} of ${total} facts strong`
  const ways = [
    ['🎯', 'Game', () => { mode = 'facts'; recent.length = 0; show('play'); next() }],
    ['🃏', 'Flashcards', () => { recent.length = 0; show('cards'); nextCard() }],
    ['🦘', 'Skip counting', () => { show('skip'); startSkip(skipTables().includes(skipBy) ? skipBy : plan().now.filter(t => t > 0).pop() || skipTables().pop()) }],
    ['🔢', 'Fact chart', () => show('chart')],
  ]
  if (plan().quiz) ways.push(['⏱️', 'Practice quiz', () => show('quiz')])
  const box = el('ways')
  box.textContent = ''
  for (const [icon, name, go] of ways) {
    const b = document.createElement('button')
    b.className = 'mode way'
    b.innerHTML = `<span class="way-icon" aria-hidden="true">${icon}</span><span class="mode-name">${name}</span>`
    b.onclick = go
    box.append(b)
  }
}
el('grownups').onclick = () => show('grown')

// Flashcards: the child thinks, taps to flip, then says whether they knew it. Time to flip is the speed.
let card = null
let cardCount = 0
let cardAgain = [] // "not yet" facts, back in a few cards: [{ key, at }]
function nextCard() {
  cardCount++
  const due = cardAgain.findIndex(c => c.at <= cardCount)
  const k = due >= 0 ? cardAgain.splice(due, 1)[0].key : Facts.pick(plan(), progress.facts, recent)
  remember(k)
  const [a, b] = orient(k)
  card = { key: k, a, b, shown: performance.now(), flipped: false, ms: 0 }
  renderCard()
}
function renderCard() {
  const { a, b, flipped } = card
  const c = el('card')
  c.classList.toggle('flipped', flipped)
  c.innerHTML = flipped ? `<span>${a} × ${b} = <span class="a">${a * b}</span></span>` : `${a} × ${b}<span class="card-hint">Tap to check</span>`
  c.setAttribute('aria-label', flipped ? `${a} times ${b} is ${a * b}` : `${a} times ${b}. Think of the answer, then tap to check.`)
  el('card-btns').classList.toggle('off', !flipped)
  for (const id of ['got', 'notyet']) el(id).disabled = !flipped
}
el('card').onclick = () => {
  if (card.flipped) return
  card.flipped = true
  card.ms = performance.now() - card.shown
  renderCard()
  el('got').focus()
}
function cardDone(knew) {
  if (!card.flipped) return
  const news = factNews(card.key, knew, card.ms)
  if (!knew) cardAgain.push({ key: card.key, at: cardCount + 3 })
  progress.answers++
  persist()
  const note = news ? news[0] : pickFrom(knew ? PRAISE : NOT_YET)
  el('card-note').textContent = note
  cheer(note)
  nextCard()
  el('card').focus()
  if (news && news[1]) celebrate(news[1])
}
el('got').onclick = () => cardDone(true)
el('notyet').onclick = () => cardDone(false)
el('card-say').onclick = () => { if (card) say(`${card.a} times ${card.b}`, 0.75) }

// Skip counting: 4, 8, 12, 16… the child taps what comes next, up to 12 of them.
let skipBy = 0
let skipStep = 0
let skipLocked = false
const skipTables = () => { const t = Facts.tablesOf(plan()).filter(t => t > 0); return t.length ? t : [1] }
function startSkip(t) { skipBy = t; skipStep = 0; el('skip-note').textContent = ''; renderSkip() }
function renderSkip() {
  skipLocked = false
  el('skip-title').textContent = `Count by ${skipBy}s`
  const chips = el('skip-tables')
  chips.textContent = ''
  for (const t of skipTables()) {
    const b = document.createElement('button')
    b.className = 'chip'
    b.textContent = `${t}s`
    b.setAttribute('aria-pressed', String(t === skipBy))
    b.onclick = () => startSkip(t)
    chips.append(b)
  }
  chips.hidden = skipTables().length < 2
  const trail = el('trail')
  trail.textContent = ''
  for (let i = 1; i <= 12; i++) {
    const li = document.createElement('li')
    li.className = i <= skipStep ? 'done' : i === skipStep + 1 ? 'next' : 'later'
    li.textContent = i <= skipStep ? i * skipBy : i === skipStep + 1 ? '?' : ''
    trail.append(li)
  }
  const box = el('skip-choices')
  box.textContent = ''
  if (skipStep >= 12) return
  const n = (skipStep + 1) * skipBy
  const prev = n - skipBy
  const wrong = shuffle([n + 1, n - 1, n + 2, n - 2, n + skipBy, n + 10, n - 10]).filter((x, i, a) => x > prev && x !== n && a.indexOf(x) === i).slice(0, 2)
  for (const v of shuffle([n, ...wrong])) {
    const b = document.createElement('button')
    b.className = 'choice'
    b.textContent = v
    b.onclick = () => skipChoose(b, v, n)
    box.append(b)
  }
}
async function skipChoose(button, v, n) {
  if (skipLocked) return
  progress.answers++
  persist()
  if (v !== n) {
    button.classList.remove('wrong'); void button.offsetWidth; button.classList.add('wrong')
    const again = pickFrom(AGAIN)
    el('skip-note').textContent = again
    cheer(again)
    return
  }
  skipLocked = true
  skipStep++
  button.classList.add('right')
  el('skip-note').textContent = ''
  if (skipStep < 12) { await sleep(350); if (screen === 'skip') renderSkip(); return }
  renderSkip()
  await celebrate(`You counted by ${skipBy}s all the way to ${12 * skipBy}!`)
  if (screen === 'skip') startSkip(skipBy)
}
el('skip-say').onclick = () => {
  const said = []
  for (let i = Math.max(1, skipStep - 2); i <= skipStep; i++) said.push(i * skipBy)
  say(said.length ? `${said.join(', ')}. What comes next?` : `Count by ${skipBy}s. What comes first?`, 0.75)
}

// Fact chart: 0-12 by 0-12. A mark and a color show each fact's status; tapping one practices it.
const MARK = { strong: ['★', 'strong'], learning: ['●', 'practicing'], new: ['○', 'not yet'] }
function renderChart() {
  const t = el('chart-table')
  t.textContent = ''
  const tables = Facts.tablesOf(plan())
  const row = (head, cls) => { const tr = t.insertRow(); const th = document.createElement('th'); th.textContent = head; if (cls) th.className = cls; th.scope = 'row'; tr.append(th); return tr }
  const top = row('×')
  top.firstChild.removeAttribute('scope')
  for (const b of Facts.ALL) {
    const th = document.createElement('th')
    th.scope = 'col'
    th.textContent = b
    if (plan().now.includes(b)) th.className = 'now'
    top.append(th)
  }
  for (const a of Facts.ALL) {
    const tr = row(a, plan().now.includes(a) ? 'now' : '')
    for (const b of Facts.ALL) {
      const s = Facts.status(progress.facts[Facts.key(a, b)])
      const td = tr.insertCell()
      const btn = document.createElement('button')
      btn.className = `cell ${s}${tables.includes(a) || tables.includes(b) ? '' : ' off'}`
      btn.textContent = MARK[s][0]
      btn.setAttribute('aria-label', `${a} times ${b}, ${MARK[s][1]}`)
      btn.onclick = () => { mode = 'facts'; forced = [a, b]; recent.length = 0; show('play'); next() }
      td.append(btn)
    }
  }
}

// Practice quiz (a grown-up turns it on): 20 facts like the school's quiz, typed on a number pad.
// The clock counts up, only compares with the child's own best, and nothing can be failed.
const QUIZ_N = 20
let quiz = null
let clockTimer = null
const clock = ms => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
function stopClock() { clearInterval(clockTimer); clockTimer = null }
const quizSize = () => Math.min(QUIZ_N, Facts.factsFor({ ...plan(), mix: true }).length)
function quizIntro() {
  quiz = null
  stopClock()
  const n = quizSize()
  el('quiz-about').textContent = `Practice for the fact quiz at school: ${n} facts from all your sets so far. Take your time.`
  const best = progress.quiz.best[n]
  el('quiz-best').textContent = best ? `Your best: ${clock(best)}. Beat it, or just practice!` : 'A clock shows how long it takes. You only race yourself.'
  el('quiz-intro').hidden = false
  el('quiz-run').hidden = true
  el('quiz-done').hidden = true
  el('quiz-start').focus()
}
el('quiz-start').onclick = () => {
  quiz = { keys: Facts.quizSet(plan(), progress.facts, QUIZ_N), i: 0, right: 0, misses: [], started: performance.now(), locked: false }
  el('quiz-intro').hidden = true
  el('quiz-run').hidden = false
  const tick = () => { el('quiz-clock').textContent = `⏱ ${clock(performance.now() - quiz.started)}` }
  tick()
  clockTimer = setInterval(tick, 1000)
  quizShow()
}
function quizShow() {
  const [a, b] = orient(quiz.keys[quiz.i])
  Object.assign(quiz, { a, b, entry: '', shown: performance.now(), locked: false })
  el('quiz-count').textContent = `Fact ${quiz.i + 1} of ${quiz.keys.length}`
  el('quiz-note').textContent = ''
  quizRender()
}
function quizRender(calm) {
  const { a, b, entry } = quiz
  el('quiz-sum').className = calm ? 'sum calm' : 'sum'
  el('quiz-sum').innerHTML = calm ? `${a} × ${b} = ${a * b}` : `${a} × ${b} = <span class="${entry ? 'entry' : 'q'}">${entry || '?'}</span>`
}
function quizKey(k) {
  if (!quiz || quiz.locked || el('quiz-run').hidden) return
  if (k === 'back') quiz.entry = quiz.entry.slice(0, -1)
  else if (k === 'ok') return quizSubmit()
  else if (quiz.entry.length < 3) quiz.entry += k
  quizRender()
}
async function quizSubmit() {
  if (!quiz.entry) return
  quiz.locked = true
  const k = quiz.keys[quiz.i]
  const right = Number(quiz.entry) === quiz.a * quiz.b
  Facts.record(progress.facts, k, right, performance.now() - quiz.shown)
  progress.answers++
  persist()
  if (right) { quiz.right++; el('quiz-note').textContent = '✓' }
  else { quiz.misses.push(k); quizRender(true); el('quiz-note').textContent = 'We’ll practice that one.' }
  await sleep(right ? 500 : 1800)
  if (!quiz || screen !== 'quiz') return
  if (++quiz.i < quiz.keys.length) return quizShow()
  quizDone()
}
function quizDone() {
  stopClock()
  const ms = performance.now() - quiz.started
  const n = quiz.keys.length
  const best = progress.quiz.best[n]
  if (!best || ms < best) progress.quiz.best[n] = Math.round(ms)
  persist()
  el('quiz-run').hidden = true
  el('quiz-done').hidden = false
  el('quiz-done-title').textContent = pickFrom(['All done!', 'You did it!', 'Finished!'])
  el('quiz-done-time').textContent = `${n} facts in ${clock(ms)}.` + (!best ? '' : ms < best ? ' A new personal best!' : ` Your best is ${clock(best)}.`)
  el('quiz-done-right').textContent = quiz.misses.length ? `You knew ${quiz.right} of ${n} right away.` : `You knew all ${n}! 🎉`
  const box = el('quiz-next')
  box.textContent = ''
  if (quiz.misses.length) {
    const p = document.createElement('p')
    p.className = 'dim'
    p.textContent = 'Facts to practice next:'
    const list = document.createElement('p')
    list.className = 'to-practice'
    list.textContent = quiz.misses.map(k => k.replace('x', ' × ')).join('   ')
    box.append(p, list)
  }
  el('quiz-practice').hidden = !quiz.misses.length
  cheer(el('quiz-done-title').textContent)
  ;(quiz.misses.length ? el('quiz-practice') : el('quiz-again')).focus()
}
el('quiz-again').onclick = () => el('quiz-start').onclick()
el('quiz-practice').onclick = () => {
  const misses = quiz.misses
  recent.length = 0
  show('cards')
  cardAgain = misses.map((key, i) => ({ key, at: cardCount + 1 + i }))
  nextCard()
}
for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'ok']) {
  const b = document.createElement('button')
  b.className = 'key' + (k === 'ok' ? ' ok' : '')
  b.textContent = k === 'back' ? '⌫' : k === 'ok' ? '✓' : k
  if (k === 'back') b.setAttribute('aria-label', 'Delete')
  if (k === 'ok') b.setAttribute('aria-label', 'Done')
  b.onclick = () => quizKey(k)
  el('keypad').append(b)
}

// For grown-ups: which sets are this week's and which are learned, cumulative or not, and the quiz.
el('grown-no').onclick = () => show('facts')
el('grown-yes').onclick = () => { el('grown-ask').hidden = true; el('grown-set').hidden = false; renderGrown(); el('now-chips').firstChild.focus() }
el('grown-done').onclick = () => show('facts')
el('next-week').onclick = () => setPlan(Facts.nextWeek(plan()))
function setPlan(p) { progress.plan = Facts.cleanPlan(p); persist(); renderGrown() }
function chips(box, items) {
  box.textContent = ''
  for (const [label, on, go] of items) {
    const b = document.createElement('button')
    b.className = 'chip'
    b.textContent = label
    b.setAttribute('aria-pressed', String(on))
    b.onclick = go
    box.append(b)
  }
}
function renderGrown() {
  const p = plan()
  el('grown-who').textContent = `${who ? `Facts for ${who.name}. ` : ''}Each week the class adds a new set. Pick this week's set; "Next week" moves it to learned.`
  const toggle = (list, other, t) => list.includes(t) ? { [list === p.now ? 'now' : 'before']: list.filter(x => x !== t) }
    : { [list === p.now ? 'now' : 'before']: [...list, t], [list === p.now ? 'before' : 'now']: other.filter(x => x !== t) }
  chips(el('now-chips'), Facts.ALL.map(t => [String(t), p.now.includes(t), () => setPlan({ ...p, ...toggle(p.now, p.before, t) })]))
  chips(el('before-chips'), Facts.ALL.map(t => [String(t), p.before.includes(t), () => setPlan({ ...p, ...toggle(p.before, p.now, t) })]))
  const n = Facts.nextWeek(p).now
  el('next-week').textContent = n.length ? `Next week: start the ${n[0]}s →` : 'Next week: review them all →'
  el('next-week').disabled = !p.now.length
  chips(el('mix-chips'), [['All facts so far', p.mix, () => setPlan({ ...p, mix: true })], ["Only this week's", !p.mix, () => setPlan({ ...p, mix: false })]])
  chips(el('quiz-chips'), [['Off', !p.quiz, () => setPlan({ ...p, quiz: false })], ['On', p.quiz, () => setPlan({ ...p, quiz: true })]])
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !el('back').hidden && el('party').hidden) { el('back').click(); return }
  if (screen !== 'quiz') return
  if (/^[0-9]$/.test(e.key)) quizKey(e.key)
  else if (e.key === 'Backspace') quizKey('back')
  else if (e.key === 'Enter' && quiz && !el('quiz-run').hidden) { e.preventDefault(); quizKey('ok') }
})

const BACK = { pick: 'menu', facts: 'menu', cards: 'facts', skip: 'facts', chart: 'facts', quiz: 'facts', grown: 'facts' }
el('back').onclick = () => show(screen === 'play' ? (mode === 'facts' ? 'facts' : 'pick') : BACK[screen])

let who = null
Kinwall.ready().then(async ctx => {
  who = ctx.member
  el('who').textContent = ctx.member ? `${ctx.member.avatar || ''} ${ctx.member.name}` : ''
  if (ctx.reducedMotion) document.documentElement.dataset.reducedMotion = ''
  const saved = await Kinwall.load().catch(() => ({}))
  if (saved.progress) {
    const p = saved.progress
    progress = { ...progress, ...p, mul: { ...p.mul }, div: { ...p.div }, facts: { ...p.facts }, plan: Facts.cleanPlan(p.plan), quiz: { best: {}, ...p.quiz } }
    for (const m of ['add', 'sub']) progress[m] = LEVELS.map((_, i) => (p[m] && p[m][i]) || 0)
  }
  el('say').hidden = !speech
  renderMute()
  show('menu')
  el('modes').firstChild.focus()
})
