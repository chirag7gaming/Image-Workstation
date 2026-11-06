# image-workstation

Dependency-light, real pixel math — filters, auto levels, background removal, crop, rotate, flip — for PNG and JPEG. No AI/ML, no third-party API calls.

Made by [Fish Gang Co.](https://fish-gang.netlify.app/Company).

## Layout

```

lib/image-process.js    Pure functions (decode, encodePNG, process)
server.js               Local server: static files + POST /api/image-process
index.html              Reference browser editor (canvas, no server needed)
css/theme.css           Design tokens + shared chrome
js/theme-toggle.js      Applies saved theme, exposes window.toggleTheme()
js/perf-tier.js         Sets data-perf-tier + data-motion on <html>
demo.js                 CLI demo: synthetic PNG → ops → PNG

```

## Library

```js
const { process, encodePNG } = require('./lib/image-process');

const input = fs.readFileSync('in.png');
const out = process(input, 'png', [
  { type: 'filter',   name: 'bw' },
  { type: 'auto' },
  { type: 'crop',     x: 10, y: 10, w: 200, h: 200 },
  { type: 'rotate',   degrees: 90 },
  { type: 'flip',     axis: 'h' }
]);

fs.writeFileSync('out.png', encodePNG(out));
// out = { data, width, height }
```

Every operation is a pure function on { data, width, height }:

```js
const {
  decode, encodePNG, process,
  applyFilter, applyAuto, applyBgRemove,
  applyCrop, applyRotate, applyFlip
} = require('./lib/image-process');
```

· filter — one of b/w, negative, punch, bleach, vintage, blue, latte
· auto — histogram min/max stretch on luminance
· bgRemove — color-distance removal seeded at (x, y) against tolerance (default 32)
· crop — { x, y, w, h }, clamped to image bounds
· rotate — 90, -90, or 180
· flip — "h" or "v"

Input is capped at MAX_DIMENSION (2400) px per side.

## HTTP API

POST /api/image-process

```json
{
  "imageBase64": "...",
  "format": "png",
  "operations": [
    { "type": "filter", "name": "vintage" },
    { "type": "crop",   "x": 0, "y": 0, "w": 512, "h": 512 }
  ]
}
```

→

```json
{ "imageBase64": "...", "width": 512, "height": 512 }
```

Output is always PNG (to preserve alpha from bgRemove). Max request body is 8 MB. CORS is open. Intended as a reference implementation, not a public service.

## Running

```bash
npm install
npm start      # http://localhost:3000
npm run demo   # synthetic PNG → ops → PNG in a temp dir
```

## Downstream forks

The hosted Image-Workstation and the deployed image-process serverless handler (https://fish-gang.netlify.app/Image-Workstation) are forks of index.html and server.js from this repo. Forks are welcome — the contract is the .iw- DOM classnames, the operation shape, and the { imageBase64, format, operations } → { imageBase64, width, height } request/response pair. Results match whichever side computes them.