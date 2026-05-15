# ShadowShift: DogBot Breakout

A lightweight 3D browser game built with **HTML + CSS + JavaScript + Three.js**.

## Run

```bash
python3 -m http.server 8080
```

Open: http://localhost:8080/index.html

## Files

- `index.html` - HUD, overlays, shop/game-over/victory screens, and canvas.
- `styles.css` - UI and overlay styling.
- `game.js` - Core gameplay systems, 8 levels, AI, boss, pickups, checkpoints, and objective locking.

## Quick manual test checklist

1. Defeat an enemy, then stand where it died: health should stop dropping from that enemy.
2. Approach a living enemy: it should detect and chase only nearby, then damage on contact.
3. Confirm enemies have glowing eyes (red/purple depending on type).
4. Touch portal before completing objective: should show "Complete the objective first!".
5. Fall through a hole/gap: should respawn at checkpoint/start and lose health.
6. Collect green pickup: health increases.
7. Collect blue pickup: energy increases.
8. Verify ShadowShift model: head/body/arms/legs/cape/visor/name tag.
9. In Level 1, verify raised tiles and easy jump path with guiding coin trails.




## Branch and PR

- This update is prepared on a fresh branch from current `main`: `feat/shadowshift-clean-pr`.


## Extra QA for this update

- Walk into a visible floor hole on Level 1+: ShadowShift should fall, then respawn at checkpoint/start with HP loss.
- Reach a checkpoint marker (cyan pad), then fall again: respawn should use that checkpoint.
- Inspect ShadowShift model: gloves, boots, chest symbol, visor, cape, and name label.
- Reach Level 8 and inspect DogBot 9000 model: large robotic dog body/head/snout/legs/ears/eyes/jaw/tail/core and boss name label.
- Verify raised paths and jumps: easy in Level 1, harder vertical sections in mid/late levels.
