// math-helpers.js — shared generation/formatting utilities used across
// lessons.js. Kept separate from the lesson registry so that file stays
// readable as the curriculum grows.

// ---------- generic random helpers ----------

// Random nonzero integer in [min, max] -- useful for leading coefficients,
// since a zero leading coefficient would silently drop a polynomial's degree.
function randNonZeroInt(rng, min, max) {
  let n;
  do { n = randInt(rng, min, max); } while (n === 0);
  return n;
}

function pickFrom(rng, array) {
  return array[randInt(rng, 0, array.length - 1)];
}

// Like randNonZeroInt, but also rerolls values in `excluded` -- e.g.
// coefficients that would make an equation trivial, such as ±1 in front of
// a term that's supposed to require an actual division step.
function randNonZeroIntExcluding(rng, min, max, excluded) {
  let n;
  do { n = randInt(rng, min, max); } while (n === 0 || excluded.includes(n));
  return n;
}

// Formats a constant term for use after a leading term, e.g. "x" + "(-5)"
// -> " - 5", "x" + "3" -> " + 3". Shared by every equation-solving lesson
// that builds up a linear expression term by term.
function constantTermLatex(n) {
  return n >= 0 ? ` + ${n}` : ` - ${Math.abs(n)}`;
}

// Same idea as constantTermLatex, but for a coefficient*variable term
// (e.g. "+ 3y", "- z", omitting a coefficient of 1 the way termsToLatex
// does for x).
function variableTermLatex(coeff, varName) {
  const abs = Math.abs(coeff);
  const body = abs === 1 ? varName : `${abs}${varName}`;
  return coeff >= 0 ? ` + ${body}` : ` - ${body}`;
}

// Square-free radicands used throughout the Radicals lessons, so sqrt(n)
// is already in simplest form unless a lesson deliberately constructs
// otherwise (e.g. radicals-simplify).
const NICE_RADICANDS = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15];

// ---------- polynomial helpers ----------

// Turns a coefficient array (highest degree first) into {coeff, power}
// terms, dropping zero terms -- shared by the two renderers below so they
// can never drift out of sync with each other.
function polynomialTerms(coeffs) {
  const degree = coeffs.length - 1;
  return coeffs
    .map((coeff, i) => ({ coeff, power: degree - i }))
    .filter(t => t.coeff !== 0);
}

// Renders terms for display, e.g. "7x^{2} - 5x - 4"
function termsToLatex(terms) {
  if (terms.length === 0) return '0';
  return terms.map((t, i) => {
    const abs = Math.abs(t.coeff);
    let body;
    if (t.power === 0) body = `${abs}`;
    else if (t.power === 1) body = abs === 1 ? 'x' : `${abs}x`;
    else body = abs === 1 ? `x^{${t.power}}` : `${abs}x^{${t.power}}`;
    if (i === 0) return t.coeff < 0 ? `-${body}` : body;
    return t.coeff < 0 ? `- ${body}` : `+ ${body}`;
  }).join(' ');
}

// Renders terms for math.js to evaluate, e.g. "7*x^2 - 5*x - 4"
// (kept separate from termsToLatex -- math.js doesn't understand LaTeX's
// "^{2}" brace syntax, so reusing one string for both was a real bug once)
function termsToExpr(terms) {
  if (terms.length === 0) return '0';
  return terms.map((t, i) => {
    const abs = Math.abs(t.coeff);
    let body;
    if (t.power === 0) body = `${abs}`;
    else if (t.power === 1) body = abs === 1 ? 'x' : `${abs}*x`;
    else body = abs === 1 ? `x^${t.power}` : `${abs}*x^${t.power}`;
    if (i === 0) return t.coeff < 0 ? `-${body}` : body;
    return t.coeff < 0 ? `- ${body}` : `+ ${body}`;
  }).join(' ');
}

// Multiplies two coefficient arrays (highest degree first), returning the
// product's coefficient array. Standard convolution.
function multiplyPolynomials(a, b) {
  const result = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      result[i + j] += a[i] * b[j];
    }
  }
  return result;
}

// Raises a coefficient array to an integer power >= 0 via repeated
// multiplication -- avoids needing binomial coefficients directly.
function powerPolynomial(coeffs, n) {
  let result = [1];
  for (let i = 0; i < n; i++) {
    result = multiplyPolynomials(result, coeffs);
  }
  return result;
}

// Builds the coefficient array for a product of linear factors (x - r1),
// (x - r2), ... given their roots, optionally scaled by a leading
// coefficient. Used to construct polynomials with guaranteed-clean roots.
function fromRoots(roots, leading = 1) {
  let coeffs = [leading];
  roots.forEach(r => {
    coeffs = multiplyPolynomials(coeffs, [1, -r]);
  });
  return coeffs;
}

// ---------- rational number helpers ----------
//
// These keep fraction arithmetic exact (as a [numerator, denominator] pair)
// so that e.g. "x + 1/2 = c/d" can render c/d as a clean reduced fraction
// in the question, instead of computing a decimal and trying to guess a
// fraction back out of it.

function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}

// Reduces num/den to lowest terms with a positive denominator.
function reduceFraction(num, den) {
  if (den < 0) { num = -num; den = -den; }
  const g = gcd(num, den);
  return [num / g, den / g];
}

// LaTeX for a reduced fraction; falls back to a plain integer when the
// denominator cancels out entirely (e.g. fracLatex(4,2) -> "2").
function fracLatex(num, den) {
  const [n, d] = reduceFraction(num, den);
  if (d === 1) return `${n}`;
  return n < 0 ? `-\\frac{${Math.abs(n)}}{${d}}` : `\\frac{${n}}{${d}}`;
}

// Sign-aware fraction term for use within a larger expression, mirroring
// signedRadicalTerm below (first term has no leading "+", later ones get
// "+"/"-").
function signedFracTerm(num, den, isFirst) {
  const body = fracLatex(Math.abs(num), den);
  if (isFirst) return num < 0 ? `-${body}` : body;
  return num < 0 ? `- ${body}` : `+ ${body}`;
}

// Random non-integer fraction (numerator is never a multiple of the
// denominator, so it can't accidentally reduce to a whole number) with a
// small, "nice" denominator -- used as either a coefficient or a constant
// term in the Rationals equation lessons.
function randFraction(rng, denominators = [2, 3, 4, 5, 6]) {
  const den = pickFrom(rng, denominators);
  let num;
  do { num = randNonZeroInt(rng, -3 * den, 3 * den); } while (num % den === 0);
  const [n, d] = reduceFraction(num, den);
  return { num: n, den: d, value: n / d };
}

// Exact fraction arithmetic, each returning a reduced [numerator,
// denominator] pair. Used to derive a "given" constant (like the right-hand
// side of an equation) from other exact fractions, so it can still be
// displayed as a clean fraction rather than a decimal.
function addFractionParts(n1, d1, n2, d2) {
  return reduceFraction(n1 * d2 + n2 * d1, d1 * d2);
}
function subFractionParts(n1, d1, n2, d2) {
  return reduceFraction(n1 * d2 - n2 * d1, d1 * d2);
}
function mulFractionParts(n1, d1, n2, d2) {
  return reduceFraction(n1 * n2, d1 * d2);
}

// ---------- radical helpers ----------

// Extracts the largest perfect-square factor of n, returning
// {coefficient, radicand} such that coefficient * sqrt(radicand) = sqrt(n)
// and radicand is square-free. E.g. simplifyRadical(50) -> {coefficient:5, radicand:2}.
function simplifyRadical(n) {
  let radicand = n;
  let coefficient = 1;
  for (let f = 2; f * f <= radicand; f++) {
    while (radicand % (f * f) === 0) {
      radicand /= (f * f);
      coefficient *= f;
    }
  }
  return { coefficient, radicand };
}

// LaTeX for coefficient*sqrt(radicand).
// formatRadicalTerm(5, 2) -> "5\sqrt{2}"; formatRadicalTerm(1, 3) -> "\sqrt{3}"
// (coefficient of 1 omitted); formatRadicalTerm(6, 1) -> "6" (radicand of 1
// means the value is actually just an integer).
function formatRadicalTerm(coefficient, radicand) {
  if (radicand === 1) return `${coefficient}`;
  return coefficient === 1 ? `\\sqrt{${radicand}}` : `${coefficient}\\sqrt{${radicand}}`;
}

// Same as formatRadicalTerm but sign-aware, for use as a term within a
// larger expression (first term has no leading "+", later ones get "+"/"-").
function signedRadicalTerm(coeff, radicand, isFirst) {
  const body = formatRadicalTerm(Math.abs(coeff), radicand);
  if (isFirst) return coeff < 0 ? `-${body}` : body;
  return coeff < 0 ? `- ${body}` : `+ ${body}`;
}

// ---------- linear system helpers ----------

// Determinant via cofactor expansion along the first row. Only used to
// reject singular coefficient matrices when building a system of
// equations, so it never needs to handle anything bigger than 4x4.
function determinant(matrix) {
  const n = matrix.length;
  if (n === 1) return matrix[0][0];
  if (n === 2) return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
  let det = 0;
  for (let col = 0; col < n; col++) {
    const minor = matrix.slice(1).map(row => row.filter((_, c) => c !== col));
    const sign = col % 2 === 0 ? 1 : -1;
    det += sign * matrix[0][col] * determinant(minor);
  }
  return det;
}

// Builds a system of `n` linear equations in n unknowns with a guaranteed
// (and known) integer solution: picks the answer first, then rerolls a
// random coefficient matrix until it's non-singular, then derives each
// equation's constant term from those two. Returns the answers (in the
// same order as varNames) and the LaTeX for each equation.
function buildLinearSystem(rng, n, varNames, coeffRange = 6, answerRange = 9) {
  const answers = varNames.map(() => randNonZeroInt(rng, -answerRange, answerRange));

  let matrix;
  do {
    matrix = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => randNonZeroInt(rng, -coeffRange, coeffRange))
    );
  } while (determinant(matrix) === 0);

  const constants = matrix.map(row =>
    row.reduce((sum, coeff, i) => sum + coeff * answers[i], 0)
  );

  const equations = matrix.map((row, i) => {
    const firstTerm = row[0] === 1 ? varNames[0] : row[0] === -1 ? `-${varNames[0]}` : `${row[0]}${varNames[0]}`;
    const restTerms = row.slice(1).map((coeff, j) => variableTermLatex(coeff, varNames[j + 1])).join('');
    return `${firstTerm}${restTerms} = ${constants[i]}`;
  });

  return { answers, equations };
}

// Wraps a system's cases block and the "solve for x, y, ..." line in a
// single centered array. Without this, KaTeX renders the (tall) cases
// brace and the short question line side by side, and the question line
// wraps awkwardly once the brace eats most of the available width.
function systemQuestionLatex(equations, varNames) {
  return `\\begin{array}{c} \\begin{cases} ${equations.join(' \\\\ ')} \\end{cases} \\\\[10pt] ${varNames.join(', ')} = \\, ? \\end{array}`;
}

// ---------- complex number helpers ----------

// LaTeX for a + bi, e.g. formatComplex(3, -4) -> "3 - 4i"
function formatComplex(re, im) {
  if (im === 0) return `${re}`;
  const imAbs = Math.abs(im);
  const imTerm = imAbs === 1 ? 'i' : `${imAbs}i`;
  if (re === 0) return im < 0 ? `-${imTerm}` : imTerm;
  return im < 0 ? `${re} - ${imTerm}` : `${re} + ${imTerm}`;
}
