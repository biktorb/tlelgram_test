// The run is replayed on the server, so the simulation must give the same
// bits on every JS engine. +, -, *, / and sqrt are exact IEEE operations, but
// Math.sin, Math.cos, Math.pow and Math.hypot may differ in the last bit
// between V8 and Safari. These replacements use only exact operations.

const TWO_PI = 6.283185307179586;
const HALF_PI = 1.5707963267948966;

// sin on [-pi/2, pi/2], Taylor series up to x^13: error below 1e-9.
function sinCore(x: number): number {
  const x2 = x * x;
  return x * (1 + x2 * (-1 / 6 + x2 * (1 / 120 + x2 * (-1 / 5040 + x2 * (1 / 362880 + x2 * (-1 / 39916800 + x2 / 6227020800))))));
}

export function dsin(a: number): number {
  let x = a - TWO_PI * Math.round(a / TWO_PI); // now in [-pi, pi]
  if (x > HALF_PI) x = Math.PI - x;
  else if (x < -HALF_PI) x = -Math.PI - x;
  return sinCore(x);
}

export function dcos(a: number): number {
  return dsin(a + HALF_PI);
}

export function len(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}
