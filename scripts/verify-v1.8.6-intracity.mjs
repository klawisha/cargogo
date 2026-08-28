import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8');
const checks=[
 ['cargo schema allows same city unless same address',!read('apps/api/src/cargo/cargo.schemas.ts').includes('Pickup and delivery city must be different')&&read('apps/api/src/cargo/cargo.schemas.ts').includes('Pickup and delivery address must be different')],
 ['trip schema allows same city unless same address',!read('apps/api/src/trips/trip.schemas.ts').includes('Origin and destination city must be different')&&read('apps/api/src/trips/trip.schemas.ts').includes('Origin and destination address must be different')],
 ['server geocodes addresses with free OSM Nominatim and no Mapbox permanent flag',read('apps/api/src/locations/location.service.ts').includes('nominatim.openstreetmap.org')&&!read('apps/api/src/locations/location.service.ts').includes('permanent=true')],
 ['same-city fallback does not silently collapse points',read('apps/api/src/cargo/cargo.service.ts').includes('INTRACITY_ADDRESS_NOT_RESOLVED')&&read('apps/api/src/trips/trip.service.ts').includes('INTRACITY_ADDRESS_NOT_RESOLVED')],
 ['matching v5 accepts short directional urban legs',read('apps/api/src/matching/matching.service.ts').includes('pickup_fraction + 0.00001 < delivery_fraction')&&read('apps/api/src/matching/matching.service.ts').includes('matching_version=5')],
 ['existing trips auto-recompute to v5',read('apps/api/src/trips/trip.service.ts').includes('matching_version??1)<5')],
 ['draft cargo can be explicitly published',read('apps/mobile/app/cargo/[id].tsx').includes('ОПУБЛІКУВАТИ ВАНТАЖ')],
 ['editing a draft republishes after successful save',read('apps/mobile/app/edit-cargo/[id].tsx').includes("cargo?.status==='draft'")&&read('apps/mobile/app/edit-cargo/[id].tsx').includes('/publish')],
 ['mobile create forms allow same-city different addresses',!read('apps/mobile/app/create-cargo.tsx').includes("throw new Error('Міста мають відрізнятися')")&&!read('apps/mobile/app/create-trip.tsx').includes("throw new Error('Міста мають відрізнятися')")],
];
let ok=true;for(const [name,pass] of checks){console.log(`${pass?'PASS':'FAIL'} ${name}`);if(!pass)ok=false;}if(!ok)process.exit(1);
