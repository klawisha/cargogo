import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const guard=read('apps/api/src/auth/auth.guard.ts');
const screen=read('apps/mobile/app/legal-consent.tsx');
const layout=read('apps/mobile/app/_layout.tsx');
const legal=read('apps/api/src/legal/legal.service.ts');
const checks=[
 ['backend 428 code',guard.includes('LEGAL_RECONSENT_REQUIRED')&&guard.includes('428')],
 ['backend checks current legal version',guard.includes('LEGAL_VERSION')&&guard.includes('terms-of-use')&&guard.includes('privacy-policy')],
 ['marketplace mutation gate',guard.includes("'/cargo'")&&guard.includes("'/trips'")&&guard.includes("'/offers'")&&guard.includes("'/deals'")],
 ['read-only requests allowed',guard.includes("['GET','HEAD','OPTIONS']")],
 ['staff exempt',guard.includes('!user.staffRole')],
 ['mobile consent route',layout.includes('legal-consent')&&layout.includes('LegalReconsentWatcher')],
 ['mobile checks legal status',layout.includes("apiFetch('/legal/me')")&&layout.includes('currentRequiredAccepted')],
 ['current documents readable',screen.includes("terms-of-use")&&screen.includes("privacy-policy")&&screen.includes("/legal/[key]")],
 ['explicit confirmation',screen.includes('checked')&&screen.includes('ПІДТВЕРДИТИ ТА ПРОДОВЖИТИ')],
 ['accepts every missing required doc',screen.includes('for(const key of missing)')&&screen.includes('/legal/accept/${key}')],
 ['acceptance audited by legal service',legal.includes("'legal.accepted'")&&legal.includes('legal_acceptance')],
];
let ok=0;for(const [name,pass] of checks){console.log(`${pass?'PASS':'FAIL'} ${name}`);if(pass)ok++;}
console.log(`\n${ok}/${checks.length} checks passed`);if(ok!==checks.length)process.exit(1);
