import fs from 'node:fs';
function read(p){return fs.readFileSync(p,'utf8')}
const trip=read('apps/api/src/trips/trip.service.ts');
if(!trip.includes('FOR UPDATE OF t')) throw new Error('trip lock must target only trip row');
if(trip.includes('WHERE t.id=$1 AND t.driver_id=$2 FOR UPDATE`')) throw new Error('unsafe bare FOR UPDATE remains');
const tokens=read('apps/mobile/src/theme/tokens.ts');
if(!tokens.includes("'dark' | 'light' | 'badger'")) throw new Error('badger theme missing');
if(!tokens.includes('badger: {')) throw new Error('badger palette missing');
const pulse=read('apps/mobile/src/ui/waiting-pulse.tsx');
if(!pulse.includes('BADGER RUN')||!pulse.includes('BadgerMark')) throw new Error('Badger Run missing');
const mark=read('apps/mobile/src/ui/badger-mark.tsx');
if(!mark.includes('CargoGo badger mark')) throw new Error('brand mark missing');
console.log('PASS trip edit lock + badger brand fixture');
