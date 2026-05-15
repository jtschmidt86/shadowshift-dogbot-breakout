# ShadowShift: DogBot Breakout

A lightweight 3D browser game built with **HTML + CSS + JavaScript + Three.js**.

## Run

Because modules are loaded from CDN, run with a local web server:

```bash
python3 -m http.server 8080
```

Then open:

- http://localhost:8080/index.html

## Files

- `index.html` - HUD, overlays, and canvas mount.
- `styles.css` - Neon UI theme and panel styling.
- `game.js` - Core game loop, level logic (8 levels), enemies, boss, checkpoints, shop, HUD, combat.

## Controls

- **WASD / Arrow keys**: move
- **Space**: jump
- **Hold left-click + move mouse**: rotate camera
- **F**: Shadow Strike
- **E**: Shadow Clone (unlocked at level 3, prepared in progression)
- **Shift**: Teleport Dash (unlocked at level 7)
