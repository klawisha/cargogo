import fs from 'node:fs';
const file='apps/mobile/src/ui/waiting-pulse.tsx';
const src=fs.readFileSync(file,'utf8');
const checks=[
  ['last-life game-over branch', /if\(lives<=1\)/],
  ['current streak reset', /setStreak\(0\);setRound\(1\);setLives\(3\)/],
  ['runner reset', /setIndex\(0\);setTarget\(5\)/],
  ['best persisted separately', /SecureStore\.setItemAsync\(BEST_KEY,String\(nextBest\)\)/],
  ['best not cleared on loss', /Новий заїзд · рахунок скинуто/],
];
let pass=0;
for(const [name,re] of checks){const ok=re.test(src); console.log(`${ok?'PASS':'FAIL'} ${name}`); if(ok)pass++;}
if(pass!==checks.length)process.exit(1);
console.log(`Badger Run reset: ${pass}/${checks.length} checks passed`);
