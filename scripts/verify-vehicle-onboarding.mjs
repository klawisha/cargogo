import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const vehicle=read('apps/mobile/app/vehicles.tsx');
const verification=read('apps/mobile/app/verification.tsx');
const trip=read('apps/mobile/app/create-trip.tsx');
const readiness=read('apps/mobile/src/readiness/driver-readiness.ts');
const profile=read('apps/mobile/app/(tabs)/profile.tsx');
const checks=[
 ['standalone vehicle route',vehicle.includes("apiFetch('/vehicles'")&&vehicle.includes("router.push('/verification')")],
 ['profile garage entry',profile.includes("title=\"Мої автомобілі\"")&&profile.includes("router.push('/vehicles')")],
 ['verification can create vehicle',verification.includes("ДОДАТИ АВТО")&&verification.includes("router.push('/vehicles')")],
 ['trip has no inline vehicle creation',!trip.includes('ЗБЕРЕГТИ АВТО')&&!trip.includes('saveVehicle')],
 ['trip only shows verified vehicles',trip.includes('verifiedVehicles.map')&&trip.includes("v.status==='verified'")],
 ['readiness has four independent gates',readiness.includes('total:4')&&readiness.includes("!licenseReady?'license':!vehicleReady?'vehicle'")],
];
let failed=0;for(const[c,ok]of checks){console.log(`${ok?'PASS':'FAIL'} ${c}`);if(!ok)failed++}if(failed)process.exit(1);
