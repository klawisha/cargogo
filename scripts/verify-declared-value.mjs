import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const schema=read('apps/api/src/cargo/cargo.schemas.ts');
const cargo=read('apps/api/src/cargo/cargo.service.ts');
const deals=read('apps/api/src/deals/deal.service.ts');
const disputes=read('apps/api/src/disputes/dispute.service.ts');
const migration=read('infra/postgres/migrations/024_cargo_declared_value.sql');
const create=read('apps/mobile/app/create-cargo.tsx');
const reviewer=read('apps/mobile/app/dispute-review.tsx');
const economics=read('apps/api/src/economics/economics.service.ts');
const checks=[
 ['schema optional declared value',schema.includes('declaredValueMinor:declaredValueMinor.nullable().optional()')],
 ['cargo minor-unit persistence',cargo.includes('declared_value_minor')&&cargo.includes('declared_value_currency')],
 ['deal acceptance snapshot',deals.includes('declared_value_minor_snapshot')&&deals.includes('cargo.declared_value_minor')],
 ['reviewer receives snapshot',disputes.includes('declaredValueMinor')&&disputes.includes('declared_value_minor_snapshot')],
 ['mobile disclosure',create.includes('не є страхуванням')&&create.includes('declaredValueMinor')],
 ['reviewer disclosure',reviewer.includes('Не є страховою сумою')&&reviewer.includes('declaredValueMinor')],
 ['db snapshot immutability',migration.includes('OLD.declared_value_minor_snapshot IS DISTINCT FROM NEW.declared_value_minor_snapshot')],
 ['economics independent',!economics.includes('declaredValue')&&!economics.includes('declared_value')],
];
for(const [name,ok] of checks){if(!ok){console.error('FAIL',name);process.exit(1)}console.log('PASS',name)}
console.log('PASS declared cargo value fixture');
