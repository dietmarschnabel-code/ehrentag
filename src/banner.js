'use strict';

// The banner: bouncing rainbow pixel letters plus confetti (default text: MARTIN).
// The text is configurable (Banner.setText) and shrinks automatically when it is longer.
// On 11 Nov the confetti gets denser (main.js calls Banner.setConfetti).

const DEFAULT_BANNER_TEXT = 'MARTIN';

// 5x7 pixel font. Lower-case input is upper-cased; accented letters fall back to their base letter.
const FONT = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['###..', '#..#.', '#...#', '#...#', '#...#', '#..#.', '###..'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  Ä: ['.#.#.', '.###.', '#...#', '#####', '#...#', '#...#', '#...#'],
  Ö: ['.#.#.', '.###.', '#...#', '#...#', '#...#', '#...#', '.###.'],
  Ü: ['.#.#.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.....', '..#..'],
  ',': ['.....', '.....', '.....', '.....', '.....', '..#..', '.#...'],
  ':': ['.....', '..#..', '..#..', '.....', '..#..', '..#..', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '♥': ['.#.#.', '#####', '#####', '#####', '.###.', '..#..', '.....'],
};

/** Pixel pattern for a character (never undefined). */
function glyphFor(ch) {
  if (FONT[ch]) return FONT[ch];
  const base = ch.normalize('NFD')[0]; // É -> E
  if (base && FONT[base]) return FONT[base];
  return FONT['?'];
}

const Banner = (() => {
  const canvas = document.getElementById('banner');
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LETTER_GAP = 1.3; // in pixel cells
  let text = DEFAULT_BANNER_TEXT;
  let confetti = 90;
  let width = 0;
  let height = 0;

  // Deterministic pseudo-random number in 0..1
  function rnd(i, k) {
    let x = (Math.imul(i, 2654435761) + Math.imul(k, 0x9e3779b9)) >>> 0;
    x ^= x >>> 15;
    x = Math.imul(x, 0x2c1b3c6d) >>> 0;
    x ^= x >>> 12;
    x = Math.imul(x, 0x297a2d39) >>> 0;
    x ^= x >>> 15;
    return (x & 0xffff) / 65535;
  }

  function hue(h, l = 58) {
    return 'hsl(' + (((h % 1) + 1) % 1) * 360 + ' 85% ' + l + '%)';
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = canvas.getBoundingClientRect();
    width = r.width;
    height = r.height;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(ms) {
    if (!width || !height) return;
    const t = ms / 1000;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#140c28';
    ctx.fillRect(0, 0, width, height);

    // confetti
    const count = reduceMotion ? Math.round(confetti / 4) : confetti;
    const speedFactor = reduceMotion ? 0.2 : 1;
    for (let i = 0; i < count; i++) {
      const x0 = rnd(i, 1) * width;
      const speed = (25 + rnd(i, 2) * 60) * speedFactor;
      const y = (t * speed + rnd(i, 3) * height) % height;
      const x = Math.min(width - 3, Math.max(3, x0 + Math.sin(t * (1 + rnd(i, 4) * 2) * speedFactor + rnd(i, 5) * 6.28) * 12));
      const sz = 2.5 + rnd(i, 7) * 3.5;
      ctx.fillStyle = hue(rnd(i, 6), 62);
      if (rnd(i, 8) > 0.5) {
        ctx.beginPath();
        ctx.arc(x, y, sz * 0.7, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(x - sz * 0.8, y - sz * 0.5, sz * 1.6, sz);
      }
    }

    // text: every letter is 5 pixel cells wide (a space 3), the cell size shrinks to fit the width
    const chars = Array.from(text);
    const advances = chars.map((c) => (c === ' ' ? 3 : 5));
    const totalCells = advances.reduce((a, b) => a + b, 0) + (chars.length - 1) * LETTER_GAP;
    const cell = Math.min(14, (width - 24) / totalCells);
    const px = cell * 0.84;
    const baseY = (height - 7 * cell) / 2;
    let cursor = (width - totalCells * cell) / 2;

    for (let li = 0; li < chars.length; li++) {
      const glyph = glyphFor(chars[li]);
      const bounce = reduceMotion ? 0 : Math.sin(t * 3 + li * 0.7) * cell * 0.6;
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if (glyph[row][col] !== '#') continue;
          const h = t * 0.25 + (li * 5 + col) * 0.035 + row * 0.02;
          const px0 = cursor + col * cell;
          const py0 = baseY + row * cell + bounce;
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.fillRect(px0 + Math.min(2, cell / 4), py0 + Math.min(2, cell / 4), px, px);
          ctx.fillStyle = hue(h);
          ctx.fillRect(px0, py0, px, px);
        }
      }
      cursor += (advances[li] + LETTER_GAP) * cell;
    }
  }

  function frame(ms) {
    if (!document.hidden && canvas.offsetParent !== null) {
      if (!width || !height) resize();
      draw(ms);
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  requestAnimationFrame(frame);

  return {
    setConfetti(n) {
      confetti = n;
    },
    /** Sets the banner text; empty falls back to the default. */
    setText(v) {
      const s = String(v === undefined || v === null ? '' : v).trim();
      text = (s || DEFAULT_BANNER_TEXT).toUpperCase();
    },
    resize,
    draw, // exposed for tests
  };
})();
