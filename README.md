# Chrono Tactics

A Final Fantasy Tactics–style isometric battle starring the cast of Chrono Trigger.
It's plain HTML5 canvas and JavaScript, with no build step and no dependencies.

The party (Crono, Marle, Lucca, Frog, Robo and Ayla) has to hold the Zenan
riverbank against Magus, Ozzie, Slash, Flea and their Henches.

## Run it

Open `index.html` in a browser. That's it — it works straight from the file system.

(Optionally serve it: `python3 -m http.server` then visit http://localhost:8000.)

## How to play

- **Turn order** follows FFT-style *Charge Time*: every tick each unit gains CT equal
  to its Speed, and whoever reaches 100 first acts. The upcoming order is shown top-left.
- On your turn you may **Move** once and **Act** once (Attack or Tech), in either order,
  then **Wait**. Doing less on a turn costs less CT, so you'll act again sooner.
- **Move**: blue tiles are reachable. Units can't climb more than their *Jump* height,
  can walk through allies but not enemies, and trees/rocks/deep water block. (Frog can swim.)
- **Attack / Tech**: red tiles are in range; the yellow area is what gets hit. Hover a
  target to preview damage and hit chance.
- **Flanking**: physical hits from the side do +25% (91% hit) and from behind +50% (100% hit).
- **High ground**: +10% damage per height level above the target (−10% per level below).
- Melee attacks can't reach targets more than 2 height levels away.

Controls: mouse to select, **Q / E** rotate the camera, **Esc** or right-click to cancel.

## Project layout

| File | Purpose |
| --- | --- |
| `js/sprites.js` | All pixel art (characters, trees, rocks) as palette-indexed character grids, rasterised to canvases at load. |
| `js/data.js` | Map layout/heights, character stats, techs, starting roster. |
| `js/battle.js` | Game rules: pathfinding, CT turn order, damage formulas, enemy AI. No rendering. |
| `js/render.js` | Isometric renderer: camera rotation, depth sorting, tiles, units, effects. |
| `js/main.js` | Turn flow, input, menus, HUD and animation sequencing. |

The sprites are original pixel art drawn for this project, not ripped assets.
Chrono Trigger characters are the property of Square Enix; this is a non-commercial fan project.
