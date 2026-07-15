// lessons.js — the lesson generator registry.
//
// Contract: each entry is { id, label, category, generate(rng) }.
// generate(rng) must return { questionLatex, answer, checkAnswer(input) }.
//   - questionLatex: a KaTeX-renderable string
//   - answer: a string shown to the user if they get it wrong (also
//     KaTeX-rendered)
//   - checkAnswer: a function(input) => boolean, built from checking.js's
//     checkSingleNumeric / checkNumericSet / checkExpressionEquivalence /
//     checkComplexEquality
//
// Shared math/formatting helpers live in math-helpers.js, loaded before
// this file. This file also defines two small local helpers used only by
// the Polynomials category (addSubtractPolynomials, expandFactorPolynomial)
// since poly-add/poly-subtract and poly-expand/poly-factor are each really
// one generator asked in two directions.

function addSubtractPolynomials(rng, operation) {
  const degree = randInt(rng, 1, 3);
  const coeffsA = Array.from({ length: degree + 1 }, () => randInt(rng, -9, 9));
  const coeffsB = Array.from({ length: degree + 1 }, () => randInt(rng, -9, 9));
  coeffsA[0] = randNonZeroInt(rng, -9, 9);
  coeffsB[0] = randNonZeroInt(rng, -9, 9);

  const sign = operation === 'add' ? 1 : -1;
  let result = coeffsA.map((c, i) => c + sign * coeffsB[i]);

  // A cancelled leading term would quietly drop the degree -- reroll B's
  // leading coefficient rather than ship a confusing question.
  let guard = 0;
  while (result[0] === 0 && guard < 20) {
    coeffsB[0] = randNonZeroInt(rng, -9, 9);
    result = coeffsA.map((c, i) => c + sign * coeffsB[i]);
    guard++;
  }

  const opSymbol = operation === 'add' ? '+' : '-';
  const termsResult = polynomialTerms(result);

  return {
    questionLatex: `(${termsToLatex(polynomialTerms(coeffsA))}) ${opSymbol} (${termsToLatex(polynomialTerms(coeffsB))}) = \\, ?`,
    answer: termsToLatex(termsResult),
    checkAnswer: checkExpressionEquivalence(termsToExpr(termsResult), 'x')
  };
}

function expandFactorPolynomial(rng, direction) {
  const factorCount = randInt(rng, 2, 3); // degree 2 or 3
  const factors = [];
  for (let i = 0; i < factorCount; i++) {
    factors.push([randNonZeroInt(rng, -4, 4), randNonZeroInt(rng, -6, 6)]);
  }
  let expanded = [1];
  factors.forEach(f => { expanded = multiplyPolynomials(expanded, f); });

  const factoredLatex = factors
    .map(f => `\\left(${termsToLatex(polynomialTerms(f))}\\right)`)
    .join('');
  const expandedTerms = polynomialTerms(expanded);
  const expandedLatex = termsToLatex(expandedTerms);
  const expandedExpr = termsToExpr(expandedTerms);

  if (direction === 'expand') {
    return {
      questionLatex: `${factoredLatex} = \\, ?`,
      answer: expandedLatex,
      checkAnswer: checkExpressionEquivalence(expandedExpr, 'x')
    };
  }
  return {
    questionLatex: `${expandedLatex} = \\, ?`,
    answer: factoredLatex,
    checkAnswer: checkExpressionEquivalence(expandedExpr, 'x')
  };
}

const LESSONS = [

  // ================= RADICALS =================
  {
    id: 'radicals-add',
    label: 'Add',
    category: 'Radicals',
    generate(rng) {
      const n = pickFrom(rng, NICE_RADICANDS);
      const a = randInt(rng, 1, 9);
      const b = randInt(rng, 1, 9);
      const sum = a + b;
      return {
        questionLatex: `${a}\\sqrt{${n}} + ${b}\\sqrt{${n}} = \\, ?`,
        answer: formatRadicalTerm(sum, n),
        checkAnswer: checkSingleNumeric(sum * Math.sqrt(n))
      };
    }
  },
  {
    id: 'radicals-subtract',
    label: 'Subtract',
    category: 'Radicals',
    generate(rng) {
      const n = pickFrom(rng, NICE_RADICANDS);
      const a = randInt(rng, 2, 9);
      const b = randInt(rng, 1, a - 1); // keep positive & avoid a===b (a trivial 0 answer)
      const diff = a - b;
      return {
        questionLatex: `${a}\\sqrt{${n}} - ${b}\\sqrt{${n}} = \\, ?`,
        answer: formatRadicalTerm(diff, n),
        checkAnswer: checkSingleNumeric(diff * Math.sqrt(n))
      };
    }
  },
  {
    id: 'radicals-multiply',
    label: 'Multiply',
    category: 'Radicals',
    generate(rng) {
      const m = pickFrom(rng, NICE_RADICANDS);
      const n = pickFrom(rng, NICE_RADICANDS);
      const a = randInt(rng, 1, 6);
      const b = randInt(rng, 1, 6);
      const { coefficient, radicand } = simplifyRadical(m * n);
      return {
        questionLatex: `${a}\\sqrt{${m}} \\times ${b}\\sqrt{${n}} = \\, ?`,
        answer: formatRadicalTerm(a * b * coefficient, radicand),
        checkAnswer: checkSingleNumeric(a * Math.sqrt(m) * b * Math.sqrt(n))
      };
    }
  },
  {
    id: 'radicals-distribute',
    label: 'Distribute',
    category: 'Radicals',
    generate(rng) {
      const m = pickFrom(rng, NICE_RADICANDS);
      const n = pickFrom(rng, NICE_RADICANDS);
      const p = pickFrom(rng, NICE_RADICANDS.filter(x => x !== n));
      const a = randInt(rng, 1, 6);
      const b = randInt(rng, 1, 6);
      const c = randInt(rng, 1, 6);

      const term1 = simplifyRadical(m * n);
      const term2 = simplifyRadical(m * p);
      const coeff1 = a * b * term1.coefficient;
      const coeff2 = a * c * term2.coefficient;

      return {
        questionLatex: `${a}\\sqrt{${m}}\\left(${b}\\sqrt{${n}} + ${c}\\sqrt{${p}}\\right) = \\, ?`,
        answer: `${signedRadicalTerm(coeff1, term1.radicand, true)} ${signedRadicalTerm(coeff2, term2.radicand, false)}`,
        checkAnswer: checkSingleNumeric(a * Math.sqrt(m) * (b * Math.sqrt(n) + c * Math.sqrt(p)))
      };
    }
  },
  {
    id: 'radicals-rationalize',
    label: 'Rationalize',
    category: 'Radicals',
    generate(rng) {
      const n = pickFrom(rng, NICE_RADICANDS);
      const a = randNonZeroInt(rng, -9, 9);
      return {
        questionLatex: `\\frac{${a}}{\\sqrt{${n}}} = \\, ?`,
        answer: `\\frac{${a}\\sqrt{${n}}}{${n}}`,
        checkAnswer: checkSingleNumeric(a / Math.sqrt(n))
      };
    }
  },
  {
    id: 'radicals-simplify',
    label: 'Simplify',
    category: 'Radicals',
    generate(rng) {
      const coefficient = randInt(rng, 2, 6);
      const radicand = pickFrom(rng, NICE_RADICANDS);
      const n = coefficient * coefficient * radicand;
      return {
        questionLatex: `\\sqrt{${n}} = \\, ?`,
        answer: formatRadicalTerm(coefficient, radicand),
        checkAnswer: checkSingleNumeric(Math.sqrt(n))
      };
    }
  },

  // ================= COMPLEX NUMBERS =================
  {
    id: 'complex-add',
    label: 'Add',
    category: 'Complex Numbers',
    generate(rng) {
      const a = randInt(rng, -9, 9), b = randNonZeroInt(rng, -9, 9);
      const c = randInt(rng, -9, 9), d = randNonZeroInt(rng, -9, 9);
      return {
        questionLatex: `(${formatComplex(a, b)}) + (${formatComplex(c, d)}) = \\, ?`,
        answer: formatComplex(a + c, b + d),
        checkAnswer: checkComplexEquality(a + c, b + d)
      };
    }
  },
  {
    id: 'complex-subtract',
    label: 'Subtract',
    category: 'Complex Numbers',
    generate(rng) {
      const a = randInt(rng, -9, 9), b = randNonZeroInt(rng, -9, 9);
      const c = randInt(rng, -9, 9), d = randNonZeroInt(rng, -9, 9);
      return {
        questionLatex: `(${formatComplex(a, b)}) - (${formatComplex(c, d)}) = \\, ?`,
        answer: formatComplex(a - c, b - d),
        checkAnswer: checkComplexEquality(a - c, b - d)
      };
    }
  },
  {
    id: 'complex-multiply',
    label: 'Multiply',
    category: 'Complex Numbers',
    generate(rng) {
      const a = randInt(rng, -9, 9), b = randNonZeroInt(rng, -6, 6);
      const c = randInt(rng, -9, 9), d = randNonZeroInt(rng, -6, 6);
      const re = a * c - b * d;
      const im = a * d + b * c;
      return {
        questionLatex: `(${formatComplex(a, b)})(${formatComplex(c, d)}) = \\, ?`,
        answer: formatComplex(re, im),
        checkAnswer: checkComplexEquality(re, im)
      };
    }
  },
  {
    id: 'complex-divide',
    label: 'Divide',
    category: 'Complex Numbers',
    generate(rng) {
      // Construct backward from a clean quotient so the division comes out
      // exactly, the way a textbook problem would.
      const p = randInt(rng, -6, 6), q = randNonZeroInt(rng, -6, 6);
      const c = randNonZeroInt(rng, -6, 6), d = randNonZeroInt(rng, -6, 6);
      const a = p * c - q * d;
      const b = p * d + q * c;
      return {
        questionLatex: `\\frac{${formatComplex(a, b)}}{${formatComplex(c, d)}} = \\, ?`,
        answer: formatComplex(p, q),
        checkAnswer: checkComplexEquality(p, q)
      };
    }
  },
  {
    id: 'complex-norm',
    label: 'Find the norm',
    category: 'Complex Numbers',
    generate(rng) {
      const a = randNonZeroInt(rng, -9, 9);
      const b = randNonZeroInt(rng, -9, 9);
      const { coefficient, radicand } = simplifyRadical(a * a + b * b);
      return {
        questionLatex: `\\left|${formatComplex(a, b)}\\right| = \\, ?`,
        answer: formatRadicalTerm(coefficient, radicand),
        checkAnswer: checkSingleNumeric(Math.sqrt(a * a + b * b))
      };
    }
  },

  // ================= POLYNOMIALS =================
  {
    id: 'poly-evaluate',
    label: 'Evaluate at a point',
    category: 'Polynomials',
    generate(rng) {
      const degree = randInt(rng, 2, 3);
      const coeffs = Array.from({ length: degree + 1 }, () => randInt(rng, -9, 9));
      coeffs[0] = randNonZeroInt(rng, -9, 9);
      const k = randNonZeroInt(rng, -4, 4);
      const value = coeffs.reduce((acc, c, i) => acc + c * Math.pow(k, degree - i), 0);
      return {
        questionLatex: `p(x) = ${termsToLatex(polynomialTerms(coeffs))}; \\quad p(${k}) = \\, ?`,
        answer: `${value}`,
        checkAnswer: checkSingleNumeric(value)
      };
    }
  },
  {
    id: 'poly-add',
    label: 'Add',
    category: 'Polynomials',
    generate(rng) { return addSubtractPolynomials(rng, 'add'); }
  },
  {
    id: 'poly-subtract',
    label: 'Subtract',
    category: 'Polynomials',
    generate(rng) { return addSubtractPolynomials(rng, 'subtract'); }
  },
  {
    id: 'poly-expand',
    label: 'Expand',
    category: 'Polynomials',
    generate(rng) { return expandFactorPolynomial(rng, 'expand'); }
  },
  {
    id: 'poly-factor',
    label: 'Factor',
    category: 'Polynomials',
    generate(rng) { return expandFactorPolynomial(rng, 'factor'); }
  },
  {
    id: 'poly-multiply-monomial',
    label: 'Multiply monomial and polynomial',
    category: 'Polynomials',
    generate(rng) {
      const monoCoeff = randNonZeroInt(rng, -6, 6);
      const monoPower = randInt(rng, 1, 2);
      const monoCoeffs = [monoCoeff, ...Array(monoPower).fill(0)];

      const polyDegree = randInt(rng, 1, 2);
      const polyCoeffs = Array.from({ length: polyDegree + 1 }, () => randInt(rng, -9, 9));
      polyCoeffs[0] = randNonZeroInt(rng, -9, 9);

      const product = multiplyPolynomials(monoCoeffs, polyCoeffs);
      const monoLatex = monoPower === 1 ? `${monoCoeff}x` : `${monoCoeff}x^{${monoPower}}`;

      return {
        questionLatex: `${monoLatex}\\left(${termsToLatex(polynomialTerms(polyCoeffs))}\\right) = \\, ?`,
        answer: termsToLatex(polynomialTerms(product)),
        checkAnswer: checkExpressionEquivalence(termsToExpr(polynomialTerms(product)), 'x')
      };
    }
  },
  {
    id: 'poly-multiply-polynomials',
    label: 'Multiply two polynomials',
    category: 'Polynomials',
    generate(rng) {
      const degreeA = randInt(rng, 1, 2);
      const degreeB = randInt(rng, 1, 2);
      const coeffsA = Array.from({ length: degreeA + 1 }, () => randInt(rng, -6, 6));
      const coeffsB = Array.from({ length: degreeB + 1 }, () => randInt(rng, -6, 6));
      coeffsA[0] = randNonZeroInt(rng, -6, 6);
      coeffsB[0] = randNonZeroInt(rng, -6, 6);

      const product = multiplyPolynomials(coeffsA, coeffsB);
      return {
        questionLatex: `\\left(${termsToLatex(polynomialTerms(coeffsA))}\\right)\\left(${termsToLatex(polynomialTerms(coeffsB))}\\right) = \\, ?`,
        answer: termsToLatex(polynomialTerms(product)),
        checkAnswer: checkExpressionEquivalence(termsToExpr(polynomialTerms(product)), 'x')
      };
    }
  },
  {
    id: 'poly-binomial-expansion',
    label: 'Binomial expansion',
    category: 'Polynomials',
    generate(rng) {
      const a = randNonZeroInt(rng, -4, 4);
      const b = randNonZeroInt(rng, -6, 6);
      const n = randInt(rng, 2, 4);
      const expanded = powerPolynomial([a, b], n);
      return {
        questionLatex: `(${termsToLatex(polynomialTerms([a, b]))})^{${n}} = \\, ?`,
        answer: termsToLatex(polynomialTerms(expanded)),
        checkAnswer: checkExpressionEquivalence(termsToExpr(polynomialTerms(expanded)), 'x')
      };
    }
  },
  {
    id: 'poly-x-intercepts',
    label: 'Horizontal axis intercepts',
    category: 'Polynomials',
    generate(rng) {
      const degree = randInt(rng, 2, 3);
      const roots = [];
      while (roots.length < degree) {
        const r = randNonZeroInt(rng, -7, 7);
        if (!roots.includes(r)) roots.push(r);
      }
      const coeffs = fromRoots(roots, 1);
      return {
        questionLatex: `${termsToLatex(polynomialTerms(coeffs))} = 0. \\quad x = \\, ?`,
        answer: roots.slice().sort((x, y) => x - y).join(' \\text{ or } '),
        checkAnswer: checkNumericSet(roots)
      };
    }
  },

  // ================= QUADRATIC POLYNOMIALS =================
  {
    id: 'quad-expand',
    label: 'Expand',
    category: 'Quadratic Polynomials',
    generate(rng) {
      const factorA = [randNonZeroInt(rng, -4, 4), randNonZeroInt(rng, -6, 6)];
      const factorB = [randNonZeroInt(rng, -4, 4), randNonZeroInt(rng, -6, 6)];
      const expandedTerms = polynomialTerms(multiplyPolynomials(factorA, factorB));
      return {
        questionLatex: `\\left(${termsToLatex(polynomialTerms(factorA))}\\right)\\left(${termsToLatex(polynomialTerms(factorB))}\\right) = \\, ?`,
        answer: termsToLatex(expandedTerms),
        checkAnswer: checkExpressionEquivalence(termsToExpr(expandedTerms), 'x')
      };
    }
  },
  {
    id: 'quad-factor',
    label: 'Factor',
    category: 'Quadratic Polynomials',
    generate(rng) {
      const factorA = [randNonZeroInt(rng, -4, 4), randNonZeroInt(rng, -6, 6)];
      const factorB = [randNonZeroInt(rng, -4, 4), randNonZeroInt(rng, -6, 6)];
      const expandedTerms = polynomialTerms(multiplyPolynomials(factorA, factorB));
      const factoredLatex = `\\left(${termsToLatex(polynomialTerms(factorA))}\\right)\\left(${termsToLatex(polynomialTerms(factorB))}\\right)`;
      return {
        questionLatex: `${termsToLatex(expandedTerms)} = \\, ?`,
        answer: factoredLatex,
        checkAnswer: checkExpressionEquivalence(termsToExpr(expandedTerms), 'x')
      };
    }
  },
  {
    id: 'quad-complete-square',
    label: 'Complete the square',
    category: 'Quadratic Polynomials',
    generate(rng) {
      const b = randInt(rng, -4, 4) * 2; // even, so h = -b/2 is an integer
      const c = randInt(rng, -9, 9);
      const h = -b / 2;
      const k = c - h * h;
      const terms = polynomialTerms([1, b, c]);

      const hTerm = h > 0 ? `x - ${h}` : h < 0 ? `x + ${Math.abs(h)}` : 'x';
      const squaredPart = h === 0 ? `${hTerm}^{2}` : `(${hTerm})^{2}`;
      const kTerm = k === 0 ? '' : (k > 0 ? ` + ${k}` : ` - ${Math.abs(k)}`);

      return {
        questionLatex: `${termsToLatex(terms)} = \\, ?`,
        answer: `${squaredPart}${kTerm}`,
        checkAnswer: checkExpressionEquivalence(termsToExpr(terms), 'x')
      };
    }
  },

  // ================= EQUATIONS: INTEGERS =================
  {
    id: 'eq-int-one-step',
    label: 'One step integer equations',
    category: 'Integer Equations',
    generate(rng) {
      const form = pickFrom(rng, ['add', 'sub', 'mul', 'div']);
      let x, questionLatex;

      if (form === 'add') {
        x = randNonZeroInt(rng, -15, 15);
        const a = randNonZeroInt(rng, -15, 15);
        const c = x + a;
        questionLatex = `x${constantTermLatex(a)} = ${c}`;
      } else if (form === 'sub') {
        x = randNonZeroInt(rng, -15, 15);
        const a = randNonZeroInt(rng, -15, 15);
        const c = x - a;
        questionLatex = `x${constantTermLatex(-a)} = ${c}`;
      } else if (form === 'mul') {
        const a = randNonZeroIntExcluding(rng, -9, 9, [1, -1]);
        x = randNonZeroInt(rng, -12, 12);
        const c = a * x;
        questionLatex = `${a}x = ${c}`;
      } else {
        const a = randNonZeroIntExcluding(rng, -9, 9, [1, -1]);
        const k = randNonZeroInt(rng, -9, 9);
        x = a * k;
        questionLatex = `\\frac{x}{${a}} = ${k}`;
      }

      return {
        questionLatex: `${questionLatex}; \\quad x = \\, ?`,
        answer: `${x}`,
        checkAnswer: checkSingleNumeric(x)
      };
    }
  },
  {
    id: 'eq-int-two-step',
    label: 'Two step integer equations',
    category: 'Integer Equations',
    generate(rng) {
      const a = randNonZeroIntExcluding(rng, -9, 9, [1, -1]);
      const b = randNonZeroInt(rng, -15, 15);
      const x = randNonZeroInt(rng, -12, 12);
      const c = a * x + b;

      return {
        questionLatex: `${a}x${constantTermLatex(b)} = ${c}; \\quad x = \\, ?`,
        answer: `${x}`,
        checkAnswer: checkSingleNumeric(x)
      };
    }
  },

  // ================= EQUATIONS: RATIONALS =================
  {
    id: 'eq-rat-one-step',
    label: 'One step rational equations',
    category: 'Rational Equations',
    generate(rng) {
      const form = pickFrom(rng, ['add', 'sub', 'mul']);
      const xFrac = randFraction(rng);
      let questionLatex;

      if (form === 'add') {
        const aFrac = randFraction(rng);
        const c = addFractionParts(xFrac.num, xFrac.den, aFrac.num, aFrac.den);
        questionLatex = `x${signedFracTerm(aFrac.num, aFrac.den, false)} = ${fracLatex(c[0], c[1])}`;
      } else if (form === 'sub') {
        const aFrac = randFraction(rng);
        const c = subFractionParts(xFrac.num, xFrac.den, aFrac.num, aFrac.den);
        questionLatex = `x${signedFracTerm(-aFrac.num, aFrac.den, false)} = ${fracLatex(c[0], c[1])}`;
      } else {
        const coeffFrac = randFraction(rng);
        const c = mulFractionParts(coeffFrac.num, coeffFrac.den, xFrac.num, xFrac.den);
        questionLatex = `${fracLatex(coeffFrac.num, coeffFrac.den)}x = ${fracLatex(c[0], c[1])}`;
      }

      return {
        questionLatex: `${questionLatex}; \\quad x = \\, ?`,
        answer: fracLatex(xFrac.num, xFrac.den),
        checkAnswer: checkSingleNumeric(xFrac.value)
      };
    }
  },
  {
    id: 'eq-rat-two-step',
    label: 'Two step rational equations',
    category: 'Rational Equations',
    generate(rng) {
      const xFrac = randFraction(rng);
      const coeffFrac = randFraction(rng);
      const constFrac = randFraction(rng);
      const product = mulFractionParts(coeffFrac.num, coeffFrac.den, xFrac.num, xFrac.den);
      const c = addFractionParts(product[0], product[1], constFrac.num, constFrac.den);

      const questionLatex =
        `${fracLatex(coeffFrac.num, coeffFrac.den)}x${signedFracTerm(constFrac.num, constFrac.den, false)} = ${fracLatex(c[0], c[1])}`;

      return {
        questionLatex: `${questionLatex}; \\quad x = \\, ?`,
        answer: fracLatex(xFrac.num, xFrac.den),
        checkAnswer: checkSingleNumeric(xFrac.value)
      };
    }
  },
  {
    id: 'eq-rat-multi-step',
    label: 'Multi-step rational equations',
    category: 'Rational Equations',
    generate(rng) {
      const xFrac = randFraction(rng);
      let coeffA, coeffB;
      do {
        coeffA = randFraction(rng);
        coeffB = randFraction(rng);
      } while (coeffA.value === coeffB.value);
      const constC = randFraction(rng);

      // Move everything to one side algebraically: aX + c = bX + g, so
      // g = (a - b)X + c -- computed exactly so it still renders as a
      // clean fraction rather than a decimal.
      const diff = subFractionParts(coeffA.num, coeffA.den, coeffB.num, coeffB.den);
      const term = mulFractionParts(diff[0], diff[1], xFrac.num, xFrac.den);
      const g = addFractionParts(term[0], term[1], constC.num, constC.den);

      const questionLatex =
        `${fracLatex(coeffA.num, coeffA.den)}x${signedFracTerm(constC.num, constC.den, false)} = ` +
        `${fracLatex(coeffB.num, coeffB.den)}x${signedFracTerm(g[0], g[1], false)}`;

      return {
        questionLatex: `${questionLatex}; \\quad x = \\, ?`,
        answer: fracLatex(xFrac.num, xFrac.den),
        checkAnswer: checkSingleNumeric(xFrac.value)
      };
    }
  },

  // ================= EQUATIONS: RADICALS =================
  {
    id: 'eq-rad-one-step',
    label: 'One step radical equations',
    category: 'Radicals',
    generate(rng) {
      const form = pickFrom(rng, ['sqrt', 'cbrt']);
      let x, questionLatex;

      if (form === 'sqrt') {
        const k = randInt(rng, 1, 12);
        x = k * k;
        questionLatex = `\\sqrt{x} = ${k}`;
      } else {
        const k = randNonZeroInt(rng, -6, 6);
        x = k * k * k;
        questionLatex = `\\sqrt[3]{x} = ${k}`;
      }

      return {
        questionLatex: `${questionLatex}; \\quad x = \\, ?`,
        answer: `${x}`,
        checkAnswer: checkSingleNumeric(x)
      };
    }
  },
  {
    id: 'eq-rad-two-step',
    label: 'Two step radical equations',
    category: 'Radicals',
    generate(rng) {
      const form = pickFrom(rng, ['isolate', 'inside']);
      let x, questionLatex;

      if (form === 'isolate') {
        // sqrt(x) + a = b -- isolate the radical, then square.
        const k = randInt(rng, 1, 10);
        const a = randInt(rng, -9, 9);
        const b = k + a;
        x = k * k;
        questionLatex = `\\sqrt{x}${constantTermLatex(a)} = ${b}`;
      } else {
        // sqrt(x + a) = b -- square immediately, then isolate x.
        const b = randInt(rng, 1, 10);
        const a = randInt(rng, -9, 9);
        x = b * b - a;
        questionLatex = `\\sqrt{x${constantTermLatex(a)}} = ${b}`;
      }

      return {
        questionLatex: `${questionLatex}; \\quad x = \\, ?`,
        answer: `${x}`,
        checkAnswer: checkSingleNumeric(x)
      };
    }
  },
  {
    id: 'eq-rad-multi-step',
    label: 'Multi-step radical equations',
    category: 'Radicals',
    generate(rng) {
      const a = randNonZeroIntExcluding(rng, -6, 6, [1, -1]);
      const x = randNonZeroInt(rng, -12, 12);
      const c = randInt(rng, 1, 9);
      const b = c * c - a * x;

      return {
        questionLatex: `\\sqrt{${a}x${constantTermLatex(b)}} = ${c}; \\quad x = \\, ?`,
        answer: `${x}`,
        checkAnswer: checkSingleNumeric(x)
      };
    }
  },

  // ================= EQUATIONS: ABSOLUTE VALUE =================
  {
    id: 'eq-abs-integer',
    label: 'Integer equations',
    category: 'Absolute Value',
    generate(rng) {
      const a = randInt(rng, -9, 9);
      const b = randInt(rng, 1, 12);
      const s1 = b - a;
      const s2 = -b - a;

      return {
        questionLatex: `\\left|x${constantTermLatex(a)}\\right| = ${b}; \\quad x = \\, ?`,
        answer: [s1, s2].sort((p, q) => p - q).join(' \\text{ or } '),
        checkAnswer: checkNumericSet([s1, s2])
      };
    }
  },
  {
    id: 'eq-abs-rational',
    label: 'Rational equations',
    category: 'Absolute Value',
    generate(rng) {
      const aFrac = randFraction(rng);
      let bFrac = randFraction(rng);
      if (bFrac.value < 0) bFrac = { num: -bFrac.num, den: bFrac.den, value: -bFrac.value };

      const s1 = subFractionParts(bFrac.num, bFrac.den, aFrac.num, aFrac.den); // b - a
      const s2 = subFractionParts(-bFrac.num, bFrac.den, aFrac.num, aFrac.den); // -b - a

      const labeled = [
        { value: s1[0] / s1[1], latex: fracLatex(s1[0], s1[1]) },
        { value: s2[0] / s2[1], latex: fracLatex(s2[0], s2[1]) }
      ].sort((p, q) => p.value - q.value);

      return {
        questionLatex: `\\left|x${signedFracTerm(aFrac.num, aFrac.den, false)}\\right| = ${fracLatex(bFrac.num, bFrac.den)}; \\quad x = \\, ?`,
        answer: labeled.map(l => l.latex).join(' \\text{ or } '),
        checkAnswer: checkNumericSet(labeled.map(l => l.value))
      };
    }
  },
  {
    id: 'eq-abs-radical',
    label: 'Radical equations',
    category: 'Absolute Value',
    generate(rng) {
      const n = pickFrom(rng, NICE_RADICANDS);
      const p = randNonZeroInt(rng, -8, 8);
      const q = randInt(rng, 1, 8);

      const s1 = (p + q) * Math.sqrt(n);
      const s2 = (p - q) * Math.sqrt(n);
      const coeff1 = p + q;
      const coeff2 = p - q;

      const labeled = [
        { value: s1, latex: coeff1 === 0 ? '0' : formatRadicalTerm(coeff1, n) },
        { value: s2, latex: coeff2 === 0 ? '0' : formatRadicalTerm(coeff2, n) }
      ].sort((a, b) => a.value - b.value);

      return {
        questionLatex: `\\left|x${signedRadicalTerm(-p, n, false)}\\right| = ${formatRadicalTerm(q, n)}; \\quad x = \\, ?`,
        answer: labeled.map(l => l.latex).join(' \\text{ or } '),
        checkAnswer: checkNumericSet([s1, s2])
      };
    }
  },

  // ================= EQUATIONS: QUADRATICS =================
  {
    id: 'eq-quad-completed-square',
    label: 'Completed squares',
    category: 'Quadratic Polynomials',
    generate(rng) {
      const h = randInt(rng, -6, 6);
      const m = randInt(rng, 1, 40);

      const hTerm = h > 0 ? `x - ${h}` : h < 0 ? `x + ${Math.abs(h)}` : 'x';
      const squaredPart = h === 0 ? `${hTerm}^{2}` : `\\left(${hTerm}\\right)^{2}`;

      const { coefficient, radicand } = simplifyRadical(m);
      const radicalPart = formatRadicalTerm(coefficient, radicand);
      const answer = h === 0 ? `\\pm ${radicalPart}` : `${h} \\pm ${radicalPart}`;

      return {
        questionLatex: `${squaredPart} = ${m}; \\quad x = \\, ?`,
        answer,
        checkAnswer: checkNumericSet([h + Math.sqrt(m), h - Math.sqrt(m)])
      };
    }
  },
  {
    id: 'eq-quad-integer',
    label: 'Integer solutions',
    category: 'Quadratic Polynomials',
    generate(rng) {
      let r1, r2;
      do {
        r1 = randNonZeroInt(rng, -9, 9);
        r2 = randNonZeroInt(rng, -9, 9);
      } while (r1 === r2);
      const a = randInt(rng, 1, 4);
      const coeffs = fromRoots([r1, r2], a);

      return {
        questionLatex: `${termsToLatex(polynomialTerms(coeffs))} = 0; \\quad x = \\, ?`,
        answer: [r1, r2].sort((p, q) => p - q).join(' \\text{ or } '),
        checkAnswer: checkNumericSet([r1, r2])
      };
    }
  },
  {
    id: 'eq-quad-diff-squares',
    label: 'Difference of squares',
    category: 'Quadratic Polynomials',
    generate(rng) {
      const a = randInt(rng, 1, 4);
      const b = randNonZeroInt(rng, 1, 12);
      const coeffA2 = a * a;
      const coeffB2 = b * b;
      const aTerm = coeffA2 === 1 ? 'x^{2}' : `${coeffA2}x^{2}`;

      return {
        questionLatex: `${aTerm} - ${coeffB2} = 0; \\quad x = \\, ?`,
        answer: `\\pm ${fracLatex(b, a)}`,
        checkAnswer: checkNumericSet([b / a, -b / a])
      };
    }
  },
  {
    id: 'eq-quad-complex',
    label: 'Complex number solutions',
    category: 'Quadratic Polynomials',
    generate(rng) {
      const p = randInt(rng, -6, 6);
      const q = randNonZeroInt(rng, 1, 6);
      const coeffs = [1, -2 * p, p * p + q * q];

      return {
        questionLatex: `${termsToLatex(polynomialTerms(coeffs))} = 0;\\quad x = \\, ?`,
        answer: `${formatComplex(p, q)} \\text{ or } ${formatComplex(p, -q)}`,
        checkAnswer: checkComplexSet([{ re: p, im: q }, { re: p, im: -q }])
      };
    }
  },
  {
    id: 'eq-quad-radical',
    label: 'Radical solutions',
    category: 'Quadratic Polynomials',
    generate(rng) {
      const p = randInt(rng, -6, 6);
      const n = pickFrom(rng, NICE_RADICANDS);
      const coeffs = [1, -2 * p, p * p - n];
      const radicalPart = formatRadicalTerm(1, n);

      return {
        questionLatex: `${termsToLatex(polynomialTerms(coeffs))} = 0; \\quad x = \\, ?`,
        answer: p === 0 ? `\\pm ${radicalPart}` : `${p} \\pm ${radicalPart}`,
        checkAnswer: checkNumericSet([p + Math.sqrt(n), p - Math.sqrt(n)])
      };
    }
  },

  // ================= EQUATIONS: GENERAL =================
  {
    id: 'eq-gen-factored',
    label: 'Factored equations',
    category: 'General Equations',
    generate(rng) {
      const factorCount = randInt(rng, 2, 3);
      const factors = [];
      for (let i = 0; i < factorCount; i++) {
        factors.push([randNonZeroInt(rng, -4, 4), randNonZeroInt(rng, -6, 6)]);
      }
      const factoredLatex = factors
        .map(f => `\\left(${termsToLatex(polynomialTerms(f))}\\right)`)
        .join('');

      const rootsInfo = factors
        .map(f => ({ value: -f[1] / f[0], latex: fracLatex(-f[1], f[0]) }))
        .sort((a, b) => a.value - b.value);

      return {
        questionLatex: `${factoredLatex} = 0; \\quad x = \\, ?`,
        answer: rootsInfo.map(r => r.latex).join(' \\text{ or } '),
        checkAnswer: checkNumericSet(rootsInfo.map(r => r.value))
      };
    }
  },
  {
    id: 'eq-gen-polynomial',
    label: 'Polynomial equations',
    category: 'General Equations',
    generate(rng) {
      const degree = randInt(rng, 3, 4);
      const roots = [];
      while (roots.length < degree) {
        const r = randNonZeroInt(rng, -6, 6);
        if (!roots.includes(r)) roots.push(r);
      }
      const coeffs = fromRoots(roots, 1);

      return {
        questionLatex: `${termsToLatex(polynomialTerms(coeffs))} = 0 \\quad x = \\, ?`,
        answer: roots.slice().sort((a, b) => a - b).join(' \\text{ or } '),
        checkAnswer: checkNumericSet(roots)
      };
    }
  },
  {
    id: 'eq-gen-multivariate',
    label: 'Multi-variate equations',
    category: 'General Equations',
    generate(rng) {
      const threeVar = rng() < 0.5;
      const a = randInt(rng, 2, 9);
      const b = randNonZeroInt(rng, -9, 9);
      const d = randInt(rng, -15, 15);

      if (!threeVar) {
        const questionLatex = `${a}x${variableTermLatex(b, 'y')} = ${d}. \\quad \\text{Solve for } x.`;
        const answer = `x = \\frac{${d}${variableTermLatex(-b, 'y')}}{${a}}`;
        const expectedExpr = `(${d} - (${b})*y)/(${a})`;
        return {
          questionLatex,
          answer,
          checkAnswer: checkExpressionEquivalenceMultiVar(expectedExpr, ['y'])
        };
      }

      const c = randNonZeroInt(rng, -9, 9);
      const questionLatex = `${a}x${variableTermLatex(b, 'y')}${variableTermLatex(c, 'z')} = ${d}. \\quad \\text{Solve for } x.`;
      const answer = `x = \\frac{${d}${variableTermLatex(-b, 'y')}${variableTermLatex(-c, 'z')}}{${a}}`;
      const expectedExpr = `(${d} - (${b})*y - (${c})*z)/(${a})`;

      return {
        questionLatex,
        answer,
        checkAnswer: checkExpressionEquivalenceMultiVar(expectedExpr, ['y', 'z'])
      };
    }
  },

  // ================= EQUATIONS: EXPONENTS & LOGS =================
  {
    id: 'eq-exp-exponential',
    label: 'Exponential equations',
    category: 'Exponents & Logs',
    generate(rng) {
      const b = randInt(rng, 2, 6);
      const x = randNonZeroInt(rng, -3, 4);
      const m = randInt(rng, 1, 4);
      const coeffLatex = m === 1 ? '' : `${m} \\cdot `;

      let cLatex;
      if (x >= 0) {
        cLatex = `${m * Math.pow(b, x)}`;
      } else {
        cLatex = fracLatex(m, Math.pow(b, -x));
      }

      return {
        questionLatex: `${coeffLatex}${b}^{x} = ${cLatex}; \\quad x = \\, ?`,
        answer: `${x}`,
        checkAnswer: checkSingleNumeric(x)
      };
    }
  },
  {
    id: 'eq-exp-logarithmic',
    label: 'Logarithmic equations',
    category: 'Exponents & Logs',
    generate(rng) {
      const b = randInt(rng, 2, 6);
      const k = randInt(rng, -3, 4);
      const a = randInt(rng, 1, 6);

      let num, den;
      if (k >= 0) {
        num = Math.pow(b, k);
        den = a;
      } else {
        num = 1;
        den = a * Math.pow(b, -k);
      }
      const [rn, rd] = reduceFraction(num, den);
      const argLatex = a === 1 ? 'x' : `${a}x`;

      return {
        questionLatex: `\\log_{${b}}(${argLatex}) = ${k}; \\quad x = \\, ?`,
        answer: fracLatex(rn, rd),
        checkAnswer: checkSingleNumeric(rn / rd)
      };
    }
  },

  // ================= EQUATIONS: SYSTEMS =================
  {
    id: 'eq-sys-two',
    label: 'Systems of two equations',
    category: 'Systems Equations',
    generate(rng) {
      const varNames = ['x', 'y'];
      const { answers, equations } = buildLinearSystem(rng, 2, varNames);

      return {
        questionLatex: systemQuestionLatex(equations, varNames),
        answer: varNames.map((v, i) => `${v} = ${answers[i]}`).join(', '),
        checkAnswer: checkOrderedNumericTuple(answers)
      };
    }
  },
  {
    id: 'eq-sys-three',
    label: 'Systems of three equations',
    category: 'Systems Equations',
    generate(rng) {
      const varNames = ['x', 'y', 'z'];
      const { answers, equations } = buildLinearSystem(rng, 3, varNames, 5, 8);

      return {
        questionLatex: systemQuestionLatex(equations, varNames),
        answer: varNames.map((v, i) => `${v} = ${answers[i]}`).join(', '),
        checkAnswer: checkOrderedNumericTuple(answers)
      };
    }
  },
  {
    id: 'eq-sys-four',
    label: 'Systems of four equations',
    category: 'Systems Equations',
    generate(rng) {
      const varNames = ['w', 'x', 'y', 'z'];
      const { answers, equations } = buildLinearSystem(rng, 4, varNames, 4, 6);

      return {
        questionLatex: systemQuestionLatex(equations, varNames),
        answer: varNames.map((v, i) => `${v} = ${answers[i]}`).join(', '),
        checkAnswer: checkOrderedNumericTuple(answers)
      };
    }
  }
];
