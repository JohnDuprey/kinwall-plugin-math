# Math practice

A math game for [Kinwall](https://github.com/JohnDuprey/kinwall), for ages 5 to 10. The child picks what to practice, sees a problem like "7 + 5 = ?" and taps the answer. Stars, levels and times-table mastery are saved for each child.

- **Five ways in:** My facts (below), adding and taking away (four levels each: numbers up to 5, 10, 20 and 100), times tables (0 to 12, or mixed from the tables a child has practiced) and dividing (whole-number answers only).
- **Big answer buttons** with believable wrong answers, and countable pictures under the early adding and taking-away problems.
- **Kind by design:** no countdowns, no losing and no red X. A wrong tap gently shakes that button, and the child tries again once the answers come back from a short rest (they dim for about 1.5 seconds, so guessing at random doesn't pay). In the quiz, the number pad rests while the missed fact's answer shows.
- **No spamming 🔊:** each 🔊 button rests (dimmed) while it speaks and for 1.5 seconds after.
- **No zooming:** pinch and double-tap zoom are off, so a child can't zoom in and get lost. Text follows Kinwall's text size instead.
- **Stars and levels:** ten right the first time moves up a level, or makes a table "strong", with a celebration. The table picker shows how strong each table is.
- **Speech:** a 🔊 button reads the problem aloud, and praise is spoken too. Each child can turn spoken praise off with the 🔔 button.

### My facts: multiplication facts 0 to 12, a set a week

Made for the usual 4th-grade plan: the class adds one set of facts each week (0 and 1 first, then on toward 12), with a cumulative fact quiz along the way.

- **A plan per child.** A grown-up sets this week's set and the sets already learned, and **Next week** moves on to the next table. Practice covers every set so far by default, weighted toward this week's set and toward facts the child missed or answered slowly lately; it can be limited to this week's set instead.
- **Game:** tap the answer, drawing from the plan.
- **Flashcards:** see 7 × 8, tap to flip, then say **Got it** or **Not yet**. Not-yet facts come back a few cards later.
- **Skip counting:** count by the week's table (4, 8, 12, 16…), tapping what comes next.
- **Fact chart:** every fact from 0 × 0 to 12 × 12, marked ★ strong, ● practicing or ○ not yet (a mark as well as a color). Tap one to practice it.
- **Practice quiz** (off until a grown-up turns it on): 20 facts from every set so far, like the school quiz, typed on a number pad. A small clock counts up and the child is compared only with their own best time. There's nothing to fail: a missed fact just shows its answer, and the end lists the facts to practice next, with retakes any time.
- **Strong facts:** a fact becomes strong when it's answered right within 4 seconds 3 times in a row. It stays strong through a slow answer (a pause isn't forgetting) and goes back to practicing when it's missed, or once its quick run is older than its last 5 answers. Each fact's last 5 answers and times are saved for the child.
- **For grown-ups:** the plan sits behind a **For grown-ups** button. On a parent's phone or computer it opens straight to the plan; wall screens and kids' devices don't show it (Kinwall tells the plugin which it is). On an older Kinwall without that signal, a simple "I'm a grown-up" confirm keeps casual taps out; it isn't a lock.
- **Spoken in the Android app too:** where the page can't speak (Android's WebView), Kinwall says the problems with the device's voice.

## Install

In Kinwall, go to **Activities → Get more activities**. Math practice is listed under **Reviewed by Kinwall**.

## Develop

This plugin is built from [kinwall-plugin-hello-world](https://github.com/JohnDuprey/kinwall-plugin-hello-world); its README covers the SDK, the limits and how publishing works. `AGENTS.md` has the same rules for AI coding assistants.

- **Preview:** `python3 -m http.server 8000`, then open http://localhost:8000/dev/.
- **Test:** `node --test` runs the tests for the fact plan, picking and mastery in `facts.js`.
- **Package:** `scripts/package.sh` builds `kinwall-plugin.zip`.
- **Release:** bump `version` in `kinwall-plugin.json` and publish a release tagged `v<version>`. The workflow attaches the package.

## License

MIT
