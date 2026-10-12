// Benchmarks argon2id on THIS machine to choose parameters.  node scripts/bench-argon2.mjs
// Target: roughly 150-400 ms per hash on the production class of hardware (OWASP minimum: m=19 MiB, t=2, p=1).
import { hash, verify } from "@node-rs/argon2";
const candidates = [
  { memoryCost: 19456, timeCost: 2, parallelism: 1 },
  { memoryCost: 47104, timeCost: 1, parallelism: 1 },
  { memoryCost: 65536, timeCost: 2, parallelism: 1 },
  { memoryCost: 65536, timeCost: 3, parallelism: 1 },
  { memoryCost: 131072, timeCost: 3, parallelism: 1 },
];
const pw = "Benchmark-Password-1!";
for (const c of candidates) {
  const times = [];
  for (let i = 0; i < 5; i++) { const t = performance.now(); await hash(pw, c); times.push(performance.now() - t); }
  const h = await hash(pw, c);
  const t0 = performance.now(); const ok = await verify(h, pw); const vt = performance.now() - t0;
  const med = times.sort((a, b) => a - b)[2];
  console.log(`m=${String(c.memoryCost / 1024).padStart(4)} MiB  t=${c.timeCost}  p=${c.parallelism}   hash ~${med.toFixed(0)} ms   verify ~${vt.toFixed(0)} ms  ok=${ok}`);
}
