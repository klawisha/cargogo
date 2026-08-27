const amount = 100000;
const target = 290;
const acquiring = 130;
const payoutEstimate = 30;
const payoutActual = 30;
const bps = (minor, rate) => Number((BigInt(minor) * BigInt(rate) + 5000n) / 10000n);
const targetMinor = bps(amount, target);
const acquiringMinor = bps(amount, acquiring);
const payoutEstimateMinor = bps(amount, payoutEstimate);
const fee = targetMinor + acquiringMinor + payoutEstimateMinor;
const carrier = amount - fee;
const payoutActualMinor = bps(carrier, payoutActual);
const net = fee - acquiringMinor - payoutActualMinor;
const marginBps = Number((BigInt(net) * 10000n) / BigInt(amount));
const expected = { fee:4500, carrier:95500, acquiringMinor:1300, payoutActualMinor:287, net:2913, marginBps:291 };
const actual = { fee, carrier, acquiringMinor, payoutActualMinor, net, marginBps };
for (const [key, value] of Object.entries(expected)) {
  if (actual[key] !== value) throw new Error(`${key}: expected ${value}, got ${actual[key]}`);
}
console.log('PASS marketplace economics fixture', actual);
