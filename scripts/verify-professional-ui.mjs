import fs from 'node:fs';
const p='apps/mobile/app/carrier-mode.tsx';
const s=fs.readFileSync(p,'utf8');
for(const token of ['CARGOGO PRO','Business Carrier','PRO WORKSPACE','LEGAL IDENTITY','Professional','ProMetric','ProAction']){
 if(!s.includes(token)) throw new Error(`professional UI fixture missing: ${token}`);
}
if(!s.includes("p?.professionalStatus==='verified'")) throw new Error('verified professional state missing');
console.log('PASS professional carrier workspace UI fixture');
