// checking.js — flexible answer checking.
//
// Scope: numeric expression evaluation (so "1/2", "0.5", and "2/4" all count
// as the same answer), multi-value answers in any order (so "3, -3" and
// "-3, 3" both work), and +/- expansion (so "x=±3" works too).
//
// This is NOT a full computer-algebra system — it won't recognize that
// "(x-1)(x+1)" and "x^2-1" are the same expression. That's a much bigger
// project on its own; flag it if a generator actually needs it.
//
// Depends on math.js (loaded via CDN in index.html) for expression parsing,
// since naive parsing (e.g. parseFloat) gets things like "7/3" wrong.

const TOLERANCE = 0.01;

function parseExpr(str) {
  try {
    const result = math.evaluate(str);
    return typeof result === 'number' ? result : NaN;
  } catch (e) {
    return NaN;
  }
}

// Splits "3, -3" or "3 or -3" into separate candidate pieces.
function splitAnswers(input) {
  return input
    .split(/,|\bor\b/i)
    .map(s => s.trim())
    .filter(Boolean);
}

// Strips a leading "x =" / "y =" prefix and expands "±" into two candidates.
//
// The ± token is substituted with "+" for one candidate and "-" for the
// other (rather than deleted) so this works for a bare "±3" as well as a
// compound expression like "4 ± sqrt(5)" -- deleting the token would leave
// "4 sqrt(5)" with no operator between the two pieces.
function normalizePiece(piece) {
  const stripped = piece.replace(/^[a-zA-Z]\s*=\s*/, '').trim();
  if (/±|\+\/-|\+-/.test(stripped)) {
    const plusVersion = stripped.replace(/±|\+\/-|\+-/, '+');
    const minusVersion = stripped.replace(/±|\+\/-|\+-/, '-');
    return [plusVersion, minusVersion];
  }
  return [stripped];
}

// A single expected numeric answer (e.g. an addition problem, or a fraction).
function checkSingleNumeric(expected, tolerance = TOLERANCE) {
  return function (input) {
    const value = parseExpr(input);
    return !Number.isNaN(value) && Math.abs(value - expected) < tolerance;
  };
}

// A set of acceptable numeric answers, in any order (e.g. x = 5 or x = -5).
function checkNumericSet(expectedValues, tolerance = TOLERANCE) {
  return function (input) {
    const values = splitAnswers(input).flatMap(normalizePiece).map(parseExpr);

    if (values.length !== expectedValues.length) return false;
    if (values.some(Number.isNaN)) return false;

    const remaining = [...expectedValues];
    for (const v of values) {
      const idx = remaining.findIndex(e => Math.abs(e - v) < tolerance);
      if (idx === -1) return false;
      remaining.splice(idx, 1);
    }
    return true;
  };
}

// Relative-error comparison -- more robust than a fixed absolute tolerance
// once expressions can produce large numbers.
function nearlyEqual(a, b, tolerance = TOLERANCE) {
  return Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));
}

// Checks whether the user's expression is the same FUNCTION as the expected
// one, by evaluating both at several sample points instead of comparing
// text. This is what lets us mark "did you simplify this polynomial
// correctly" right without a full symbolic/CAS engine: two polynomials that
// agree at enough distinct points are the same polynomial.
//
// Tolerance defaults much tighter than checkSingleNumeric's: this checker
// is for exact symbolic equivalence (the user types a whole expression,
// not a possibly-rounded decimal), so it shouldn't forgive real
// differences. A loose relative tolerance here previously let a flat
// constant error (e.g. +1) slip through on large-magnitude polynomials,
// since 1% of a large sample value can exceed 1.
function checkExpressionEquivalence(expectedExpr, variable = 'x', tolerance = 1e-6) {
  const samplePoints = [-3.1, -1.7, 0.4, 1.9, 2.6, 4.3]; // avoid round numbers
  let expectedCompiled;
  try {
    expectedCompiled = math.compile(expectedExpr);
  } catch (e) {
    throw new Error(`Generator bug: expected expression "${expectedExpr}" doesn't parse`);
  }

  return function (input) {
    let userCompiled;
    try {
      userCompiled = math.compile(input);
    } catch (e) {
      return false;
    }
    return samplePoints.every(point => {
      const scope = { [variable]: point };
      let userVal, expectedVal;
      try {
        userVal = userCompiled.evaluate(scope);
        expectedVal = expectedCompiled.evaluate(scope);
      } catch (e) {
        return false;
      }
      return typeof userVal === 'number' && nearlyEqual(userVal, expectedVal, tolerance);
    });
  };
}

// Checks a complex-number answer (a + bi). math.js parses "i" as the
// imaginary unit natively. Handles both plain-number results (a real
// expression, im=0) and math.js Complex objects.
function checkComplexEquality(expectedRe, expectedIm, tolerance = TOLERANCE) {
  return function (input) {
    let value;
    try {
      value = math.evaluate(input);
    } catch (e) {
      return false;
    }
    let re, im;
    if (typeof value === 'number') {
      re = value; im = 0;
    } else if (value && typeof value.re === 'number' && typeof value.im === 'number') {
      re = value.re; im = value.im;
    } else {
      return false;
    }
    return nearlyEqual(re, expectedRe, tolerance) && nearlyEqual(im, expectedIm, tolerance);
  };
}

// A set of acceptable complex answers, in any order -- the complex-number
// analogue of checkNumericSet. Used for quadratics with a negative
// discriminant, where the two roots are a conjugate pair and either could
// be typed first. Reuses splitAnswers/normalizePiece so "2+3i, 2-3i" and
// the "±" shorthand ("2 ± 3i") both work.
function checkComplexSet(expectedValues, tolerance = TOLERANCE) {
  return function (input) {
    const pieces = splitAnswers(input).flatMap(normalizePiece);
    if (pieces.length !== expectedValues.length) return false;

    const parsed = pieces.map(p => {
      try {
        const v = math.evaluate(p);
        if (typeof v === 'number') return { re: v, im: 0 };
        if (v && typeof v.re === 'number' && typeof v.im === 'number') return { re: v.re, im: v.im };
      } catch (e) { /* falls through to null below */ }
      return null;
    });
    if (parsed.some(p => p === null)) return false;

    const remaining = [...expectedValues];
    for (const v of parsed) {
      const idx = remaining.findIndex(e => nearlyEqual(e.re, v.re, tolerance) && nearlyEqual(e.im, v.im, tolerance));
      if (idx === -1) return false;
      remaining.splice(idx, 1);
    }
    return true;
  };
}

// A sequence of acceptable numeric answers where ORDER matters -- unlike
// checkNumericSet's any-order matching, which would let a system of
// equations' x and y values be swapped and still pass. Used for "solve
// this system" answers like "2, -3" (interpreted positionally against the
// variables as introduced in the question).
function checkOrderedNumericTuple(expectedValues, tolerance = TOLERANCE) {
  return function (input) {
    const pieces = splitAnswers(input).flatMap(normalizePiece);
    if (pieces.length !== expectedValues.length) return false;

    const values = pieces.map(parseExpr);
    if (values.some(Number.isNaN)) return false;

    return values.every((v, i) => nearlyEqual(v, expectedValues[i], tolerance));
  };
}

// Multi-variable version of checkExpressionEquivalence, for "solve for x"
// answers that are themselves expressions in other variables (e.g.
// x = (c - b*y)/a) rather than a single number. Samples every variable at
// several points, giving each variable a different value in a given
// sample so a generator bug that drops or swaps a variable shows up as a
// mismatch instead of an accidental match.
function checkExpressionEquivalenceMultiVar(expectedExpr, variables, tolerance = 1e-6) {
  const basePoints = [-3.1, -1.7, 0.4, 1.9, 2.6, 4.3, 5.7, -4.4];
  let expectedCompiled;
  try {
    expectedCompiled = math.compile(expectedExpr);
  } catch (e) {
    throw new Error(`Generator bug: expected expression "${expectedExpr}" doesn't parse`);
  }

  const scopes = basePoints.map((_, i) => {
    const scope = {};
    variables.forEach((v, vi) => {
      scope[v] = basePoints[(i + vi) % basePoints.length];
    });
    return scope;
  });

  return function (input) {
    let userCompiled;
    try {
      userCompiled = math.compile(input);
    } catch (e) {
      return false;
    }
    return scopes.every(scope => {
      let userVal, expectedVal;
      try {
        userVal = userCompiled.evaluate(scope);
        expectedVal = expectedCompiled.evaluate(scope);
      } catch (e) {
        return false;
      }
      return typeof userVal === 'number' && nearlyEqual(userVal, expectedVal, tolerance);
    });
  };
}
