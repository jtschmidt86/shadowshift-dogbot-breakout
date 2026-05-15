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
