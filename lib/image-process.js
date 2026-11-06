'use strict';

const { PNG } = require('pngjs');
const jpeg = require('jpeg-js');

const MAX_DIMENSION = 2400;

function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

function decode(buffer, format) {
  const f = String(format || '').toLowerCase();
  if (f === 'png') {
    const png = PNG.sync.read(buffer);
    return { data: png.data, width: png.width, height: png.height };
  }
  if (f === 'jpeg' || f === 'jpg') {
    const out = jpeg.decode(buffer, { useTArray: true });
    return { data: Buffer.from(out.data), width: out.width, height: out.height };
  }
  throw new Error('format must be "png" or "jpeg"');
}

function encodePNG(image) {
  const png = new PNG({ width: image.width, height: image.height });
  png.data = Buffer.from(image.data);
  return PNG.sync.write(png);
}

const FILTER_FNS = {
  bw: (d, i) => {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = g;
  },
  negative: (d, i) => {
    d[i] = 255 - d[i];
    d[i + 1] = 255 - d[i + 1];
    d[i + 2] = 255 - d[i + 2];
  },
  punch: (d, i) => {
    for (let c = 0; c < 3; c++) d[i + c] = clamp((d[i + c] - 128) * 1.15 + 128);
    const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
    for (let c = 0; c < 3; c++) d[i + c] = clamp(avg + (d[i + c] - avg) * 1.6);
  },
  bleach: (d, i) => {
    const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
    for (let c = 0; c < 3; c++) d[i + c] = clamp((avg + (d[i + c] - avg) * 0.4) * 1.1);
    for (let c = 0; c < 3; c++) d[i + c] = clamp((d[i + c] - 128) * 1.3 + 128);
  },
  vintage: (d, i) => {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    d[i]     = clamp(r * 0.9 + g * 0.5 + b * 0.2);
    d[i + 1] = clamp(r * 0.3 + g * 0.8 + b * 0.2);
    d[i + 2] = clamp(r * 0.2 + g * 0.3 + b * 0.5);
    for (let c = 0; c < 3; c++) d[i + c] = clamp((d[i + c] - 128) * 1.05 + 128);
  },
  blue: (d, i) => {
    const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
    d[i]     = clamp(avg + (d[i + 2] - avg) * 1.2 - (d[i] - avg) * 0.5);
    d[i + 2] = clamp(avg + (d[i] - avg) * 1.2);
  },
  latte: (d, i) => {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    d[i]     = clamp(r * 0.95 + 20);
    d[i + 1] = clamp(g * 0.92 + 14);
    d[i + 2] = clamp(b * 0.85 + 8);
    for (let c = 0; c < 3; c++) d[i + c] = clamp((d[i + c] - 128) * 0.95 + 128);
  }
};

function applyFilter(image, name) {
  const fn = FILTER_FNS[name];
  if (!fn) return image;
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) fn(d, i);
  return image;
}

function applyAuto(image) {
  const d = image.data;
  let min = 255, max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (lum < min) min = lum;
    if (lum > max) max = lum;
  }
  const range = (max - min) || 1;
  for (let i = 0; i < d.length; i += 4) {
    d[i]     = clamp((d[i] - min) / range * 255);
    d[i + 1] = clamp((d[i + 1] - min) / range * 255);
    d[i + 2] = clamp((d[i + 2] - min) / range * 255);
  }
  return image;
}

function applyBgRemove(image, x, y, tolerance) {
  const d = image.data, w = image.width, h = image.height;
  const px = Math.floor(Math.max(0, Math.min(w - 1, x)));
  const py = Math.floor(Math.max(0, Math.min(h - 1, y)));
  const start = (py * w + px) * 4;
  const r0 = d[start], g0 = d[start + 1], b0 = d[start + 2];
  const tol = tolerance == null ? 32 : tolerance;
  for (let i = 0; i < d.length; i += 4) {
    const dr = d[i] - r0, dg = d[i + 1] - g0, db = d[i + 2] - b0;
    if (Math.sqrt(dr * dr + dg * dg + db * db) <= tol) d[i + 3] = 0;
  }
  return image;
}

function applyCrop(image, x, y, w, h) {
  x = Math.max(0, Math.floor(x));
  y = Math.max(0, Math.floor(y));
  w = Math.min(image.width - x, Math.floor(w));
  h = Math.min(image.height - y, Math.floor(h));
  const out = Buffer.alloc(w * h * 4);
  for (let row = 0; row < h; row++) {
    const srcStart = ((y + row) * image.width + x) * 4;
    image.data.copy(out, row * w * 4, srcStart, srcStart + w * 4);
  }
  return { data: out, width: w, height: h };
}

function applyRotate(image, degrees) {
  const norm = ((degrees % 360) + 360) % 360;
  const { data, width, height } = image;
  if (norm === 0) return image;

  if (norm === 180) {
    const out = Buffer.alloc(data.length);
    const last = width * height - 1;
    for (let i = 0; i <= last; i++) {
      data.copy(out, (last - i) * 4, i * 4, i * 4 + 4);
    }
    return { data: out, width, height };
  }

  const newW = height, newH = width;
  const out = Buffer.alloc(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcI = (y * width + x) * 4;
      let nx, ny;
      if (norm === 90) { nx = height - 1 - y; ny = x; }
      else { nx = y; ny = width - 1 - x; }
      data.copy(out, (ny * newW + nx) * 4, srcI, srcI + 4);
    }
  }
  return { data: out, width: newW, height: newH };
}

function applyFlip(image, axis) {
  const { data, width, height } = image;
  const out = Buffer.alloc(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcI = (y * width + x) * 4;
      const nx = axis === 'h' ? width - 1 - x : x;
      const ny = axis === 'v' ? height - 1 - y : y;
      data.copy(out, (ny * width + nx) * 4, srcI, srcI + 4);
    }
  }
  return { data: out, width, height };
}

function applyOperation(image, op) {
  if (!op || typeof op !== 'object') throw new Error('Invalid operation');
  switch (op.type) {
    case 'filter':   return applyFilter(image, op.name);
    case 'auto':     return applyAuto(image);
    case 'bgRemove': return applyBgRemove(image, op.x, op.y, op.tolerance);
    case 'crop':     return applyCrop(image, op.x, op.y, op.w, op.h);
    case 'rotate':   return applyRotate(image, op.degrees);
    case 'flip':     return applyFlip(image, op.axis);
    default:         throw new Error('Unknown operation: ' + op.type);
  }
}

function process(buffer, format, operations) {
  const image = decode(buffer, format);
  if (image.width > MAX_DIMENSION || image.height > MAX_DIMENSION) {
    throw new Error(`Image too large — max ${MAX_DIMENSION}px per side.`);
  }
  const ops = Array.isArray(operations) ? operations : [];
  let out = image;
  for (const op of ops) out = applyOperation(out, op);
  return out;
}

module.exports = {
  MAX_DIMENSION,
  decode,
  encodePNG,
  process,
  applyFilter,
  applyAuto,
  applyBgRemove,
  applyCrop,
  applyRotate,
  applyFlip,
  applyOperation
};