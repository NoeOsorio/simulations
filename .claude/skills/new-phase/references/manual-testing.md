# Manual survival test — 5 minutes in a real browser

The build/lint pass is necessary but not sufficient. The simulation has to *behave* — not extinct, not explode, with phase-specific events firing in the log. This is what the manual test catches that no static check can.

The test runs in a real browser via Playwright (so the canvas keeps animating even without a visible window). You snapshot stats every 60 seconds for 5 minutes, then evaluate the trend. Total wall-time ≈ 5 minutes; total simulated time ≈ 20+ minutes once you push speed to max.

## Setup

```bash
# Make sure the dev server is up. If port 5173 is taken, vite picks 5174;
# adjust the URL below.
lsof -i :5173 | grep LISTEN > /dev/null || (npm run dev > /tmp/sim-dev.log 2>&1 &)
sleep 3
```

Then open the new phase in Playwright (substitute the real `<phase-id>` and route):

```
mcp__plugin_playwright_playwright__browser_navigate
  url: http://localhost:5173/#/<phase-id>
```

Push the speed up. Many phases have a `× 1× → 2×` button — click it twice to land on `4×`. If the phase only goes to `2×`, that's fine.

## Snapshot helper

This is the eval payload. It reads the page's stats DOM and counts log entries; reuse it every 60s.

```js
() => {
  const cells = [...document.querySelectorAll('.sim-diag__cell')];
  const stats = Object.fromEntries(
    cells.map((c) => [
      c.querySelector('.sim-diag__label')?.textContent.trim().toLowerCase(),
      Number(c.querySelector('.sim-diag__value')?.textContent.trim()),
    ])
  );
  const events = [...document.querySelectorAll('.sim-event__text')]
    .slice(0, 30)
    .map((n) => n.textContent.trim());
  const errors = (window.__simErrors ??= []);
  return { stats, recentEvents: events, errorsCount: errors.length };
}
```

Capture each snapshot to a local variable in your assistant memory (or print and read later). You want at least:

```
T+0s    stats: { alive, food, births, deaths, ... }, recent: [...]
T+60s   ...
T+120s  ...
T+180s  ...
T+240s  ...
T+300s  ...
```

## Pass / fail rubric

Apply these in order. If any one of them flips a hard fail, the phase doesn't ship — go back to `references/survival-rules.md` for the standard tweak.

### Hard fails (do not ship)

1. **Extinction.** `alive == 0` at any snapshot after T+30s.
2. **Explosion.** `alive > MAX_POPULATION × 1.10` for two consecutive snapshots.
3. **Console error / unhandled exception** during the 5 minutes (`errorsCount > 0` in the snapshot).
4. **Births stuck at 0.** No births at all in 5 minutes means the reproduction path isn't reachable.
5. **Deaths > births for 3+ consecutive snapshots after T+60s.** Population is in a slow death spiral.

### Soft fails (worth a tweak, ship at user's discretion)

6. **A role exists but never appears in the event log.** "Bonk built a nest" never fires in 5 minutes → builder is unreachable. Either the trigger is too strict or the role count is too low.
7. **Final alive count < 50% of `INITIAL_POPULATION`.** Phase is technically not extinct but the trend is unhealthy.
8. **`food` count saturated at `MAX_FOOD` for multiple snapshots** while creatures are eating. Means creatures aren't keeping up — either too few mouths or food is too plentiful, both worth checking.

### Healthy run signature

For reference, a P2-style stable run looks roughly like:

```
T+0    alive 12, food 32, b 0,  d 0
T+60   alive 14, food 70, b 3,  d 1
T+120  alive 17, food 85, b 7,  d 2
T+180  alive 19, food 92, b 10, d 3
T+240  alive 22, food 98, b 14, d 4
T+300  alive 24, food 95, b 18, d 6
```

Population grows slowly (births > deaths but not by much), food climbs to its working level, deaths accumulate from old creatures cycling out. The log shows phase-specific actions every few seconds.

## What to record

When the test passes, capture this for the PR body:

- **Initial population**: from T+0
- **Final population**: from T+300
- **Births / Deaths**: from T+300
- **A final screenshot** of the viewport. Save with `mcp__plugin_playwright_playwright__browser_take_screenshot` to a temp path; reference in the PR body.

When it fails:

- **Which fail rule tripped** (1–5 above)
- **The snapshot history** (T+0 through T+last)
- **Two recent log lines** to hint at what was happening
- **The constant that was tweaked** and how (so the next attempt is informed)

## Wall-time tips

- The browser must stay foregrounded for the canvas loop to run at full speed in some platforms. Playwright headless is fine — the rAF loop runs without the OS throttling it.
- If you're tempted to run for less than 5 minutes "because it looks fine at T+120": don't. Most extinction patterns kick in between minutes 3 and 5, after the food buffer is consumed.
- If the test is borderline (e.g. final alive 6 of initial 12), either tweak and re-test, or surface to the user with the snapshots and let them decide. Don't ship a borderline run silently.
- After a clean run, **close the browser tab** before continuing — leaving the rAF loop running while you do other work just consumes CPU.

## After the test

If the test passes, fold the results into the PR body. The skill's PR template has a `## Survival test (5 min, browser)` section that fits the recorded numbers directly. Keep it short; the survival numbers are 4 lines, not 40.

If the test fails twice and you can't find a fix among the standard tweaks, **stop and surface to the user**. Don't keep grinding — some failures are design-level and need a conversation, not another retune.
