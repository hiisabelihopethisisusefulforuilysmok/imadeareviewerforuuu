// rng.js — seeded pseudo-random number generator.
//
// Math.random() can't be seeded, so every random choice in this app —
// which lesson gets picked, and the numbers inside it — needs to flow
// through this instead. Same seed, same sequence, every time. That's what
// makes a bug reproducible: note the seed logged to the console, and you
// can describe exactly which session produced it.

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Random integer in [min, max], inclusive.
function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}
