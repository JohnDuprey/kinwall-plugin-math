# Math practice

A math game for [Kinwall](https://github.com/JohnDuprey/kinwall), for ages 5 to 10. The child picks what to practice, sees a problem like "7 + 5 = ?" and taps the answer. Stars, levels and times-table mastery are saved for each child.

- **Four modes:** adding and taking away (four levels each: numbers up to 5, 10, 20 and 100), times tables (1 to 12, or mixed from the tables a child has practiced) and dividing (whole-number answers only).
- **Big answer buttons** with believable wrong answers, and countable pictures under the early adding and taking-away problems.
- **Kind by design:** no timers, no losing and no red X. A wrong tap gently shakes that button, and the child tries again.
- **Stars and levels:** ten right the first time moves up a level, or makes a table "strong", with a celebration. The table picker shows how strong each table is.
- **Speech:** a 🔊 button reads the problem aloud, and praise is spoken too. Each child can turn spoken praise off with the 🔔 button.

## Install

In Kinwall, go to **Activities → Get more activities**. Math practice is listed under **Reviewed by Kinwall**.

## Develop

This plugin is built from [kinwall-plugin-hello-world](https://github.com/JohnDuprey/kinwall-plugin-hello-world); its README covers the SDK, the limits and how publishing works. `AGENTS.md` has the same rules for AI coding assistants.

- **Preview:** `python3 -m http.server 8000`, then open http://localhost:8000/dev/.
- **Package:** `scripts/package.sh` builds `kinwall-plugin.zip`.
- **Release:** bump `version` in `kinwall-plugin.json` and publish a release tagged `v<version>`. The workflow attaches the package.

## License

MIT
