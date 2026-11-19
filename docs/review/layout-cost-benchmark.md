# Full Pipeline Node Layout Cost Benchmark

> **Status:** Informational Only  
> **Rule R6 Compliance:** In accordance with Rule R6, this benchmark is reported for tracking and regression analysis. It is **never** used as a pass/fail timing gate in automated CI test suites. CI correctness and scaling are gated strictly by deterministic operation count complexity and minimum ratio bounds.

## Benchmark Configuration
- **Runtime:** Node.js v22.16.0 (win32 x64)
- **Score Types:** Full-featured scores (measures with notes, ties across barlines, slurs, dynamics, and articulations)
- **Runs:** 50 runs per score size (preceded by 15 JIT warmup runs)
- **Width:** 100 staff spaces

## Results Table

| Score Size | Min (ms) | Median (ms) | p95 (ms) | Max (ms) |
| :--- | :--- | :--- | :--- | :--- |
| **64 Measures** | 0.808 | 0.930 | 1.599 | 4.835 |
| **200 Measures** | 1.917 | 2.303 | 3.099 | 3.769 |
| **400 Measures** | 3.841 | 4.140 | 5.032 | 6.123 |

## Scaling Analysis
- **200m / 64m Ratio (Median):** 2.48x (Expected linear ~3.1x)
- **400m / 200m Ratio (Median):** 1.80x (Expected linear ~2.0x)

The O(1) indexed notehead lookup path ensures strictly linear O(N) scaling across all score sizes.
