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
const TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const MODES = {
  add: { name: 'Adding', sign: '+', levelName: max => `Sums up to ${max}` },
  sub: { name: 'Taking away', sign: '−', levelName: max => `Numbers up to ${max}` },
  mul: { name: 'Times tables', sign: '×', tables: true },
  div: { name: 'Dividing', sign: '÷', tables: true },
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
// mute choice and a count of every answer.
let progress = { muted: false, answers: 0, add: [0, 0, 0, 0], sub: [0, 0, 0, 0], mul: {}, div: {} }
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
const practiced = m => TABLES.filter(t => progress[m][t] > 0)
const strong = m => TABLES.filter(t => progress[m][t] >= STARS)

// ---- Problems ----

function makeProblem() {
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
  const k = rand(1, 12)
  if (mode === 'mul') {
    const [a, b] = Math.random() < 0.5 ? [t, k] : [k, t]
    return { t, k, a, b, answer: t * k, text: `${a} × ${b}`, speak: `${a} times ${b}` }
  }
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
  } else if (mode === 'mul') {
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
  for (let i = 0; i < 30; i++) { p = makeProblem(); if (!recent.includes(p.text)) break }
  problem = p
  recent.push(p.text)
  if (recent.length > RECENT) recent.shift()
  el('sum').innerHTML = `${p.text} = <span class="q">?</span>`
  el('praise').textContent = ''
  // Countable pictures for the early levels: two groups to add, or some taken away (faded).
  const dots = el('dots')
  dots.textContent = ''
  const tables = MODES[mode].tables
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
  const party = tried ? null : addStar()
  persist()
  renderPlay()
  const praise = pickFrom(PRAISE)
  el('praise').textContent = party ? '' : praise
  // Let the praise finish, then a beat, so it never runs into the next problem.
  await Promise.all([party ? null : cheer(praise), sleep(1100)])
  if (party) await celebrate(party)
  if (problem !== asked) return // they went back and picked something else meanwhile
  if (party && !MODES[mode].tables && choice < LEVELS.length - 1) { choice++; recent.length = 0 }
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

function show(name) {
  screen = name
  for (const s of ['menu', 'pick', 'play']) el(s).hidden = s !== name
  el('back').hidden = name === 'menu'
  el('stars').hidden = name !== 'play'
  if (name === 'menu') renderMenu()
  if (name === 'pick') renderPick()
}

function starLine(s) { return '⭐'.repeat(s) + '☆'.repeat(STARS - s) }

function renderMenu() {
  const box = el('modes')
  box.textContent = ''
  for (const [id, m] of Object.entries(MODES)) {
    const b = document.createElement('button')
    b.className = 'mode'
    const note = m.tables
      ? (strong(id).length ? `${strong(id).length} of 12 strong` : practiced(id).length ? `${practiced(id).length} practiced` : 'Pick a table')
      : `Level ${currentLevel(id) + 1} of ${LEVELS.length}`
    b.innerHTML = `<span class="mode-sign">${m.sign}</span><span class="mode-name">${m.name}</span><span class="dim">${note}</span>`
    b.onclick = () => { mode = id; if (speech) pickVoice(); show('pick') }
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
    for (const t of TABLES) {
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
el('back').onclick = () => show(screen === 'play' ? 'pick' : 'menu')

Kinwall.ready().then(async ctx => {
  el('who').textContent = ctx.member ? `${ctx.member.avatar || ''} ${ctx.member.name}` : ''
  if (ctx.reducedMotion) document.documentElement.dataset.reducedMotion = ''
  const saved = await Kinwall.load().catch(() => ({}))
  if (saved.progress) {
    const p = saved.progress
    progress = { ...progress, ...p, mul: { ...p.mul }, div: { ...p.div } }
    for (const m of ['add', 'sub']) progress[m] = LEVELS.map((_, i) => (p[m] && p[m][i]) || 0)
  }
  el('say').hidden = !speech
  renderMute()
  show('menu')
  el('modes').firstChild.focus()
})
