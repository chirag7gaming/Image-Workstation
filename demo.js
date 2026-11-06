'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { PNG } = require('pngjs');
const { process, encodePNG } = require('./lib/image-process');

function makeGradient(size) {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      png.data[i]     = Math.round((x / size) * 255);
      png.data[i + 1] = Math.round((y / size) * 255);
      png.data[i + 2] = 128;
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iw-demo-'));
  const size = 128;

  const inputBuf = makeGradient(size);
  const inputPath = path.join(tmp, 'input.png');
  fs.writeFileSync(inputPath, inputBuf);
  console.log(`wrote ${inputPath} (${inputBuf.length} bytes, ${size}x${size})`);

  const operations = [
    { type: 'filter', name: 'bw' },
    { type: 'auto' },
    { type: 'crop',   x: 16, y: 16, w: 96, h: 96 },
    { type: 'rotate', degrees: 90 },
    { type: 'flip',   axis: 'h' }
  ];
  console.log('operations:', operations.map((o) => o.type).join(' → '));

  const out = process(inputBuf, 'png', operations);
  const outBuf = encodePNG(out);
  const outPath = path.join(tmp, 'output.png');
  fs.writeFileSync(outPath, outBuf);

  console.log(`wrote ${outPath} (${outBuf.length} bytes, ${out.width}x${out.height})`);
  console.log(`temp dir: ${tmp}`);
}

main();