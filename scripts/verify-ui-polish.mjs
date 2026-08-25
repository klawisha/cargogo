import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const must=[
  'apps/mobile/assets/brand/badger-mark-512.png',
  'apps/mobile/assets/brand/badger-run-hero.png',
  'apps/mobile/assets/brand/badger-run-token.png',
  'apps/mobile/assets/brand/app-icon.png',
  'apps/mobile/src/ui/brand-logo.tsx',
  'apps/mobile/src/ui/brand-icons.tsx',
  'apps/mobile/src/ui/motion.tsx',
];
for(const rel of must){const p=path.join(root,rel);if(!fs.existsSync(p)||fs.statSync(p).size<100)throw new Error(`Missing/empty ${rel}`)}
const mark=fs.readFileSync(path.join(root,'apps/mobile/src/ui/badger-mark.tsx'),'utf8');
if(!mark.includes('resizeMode="contain"')||!mark.includes('badger-mark-512.png'))throw new Error('Badger mark must use contained dedicated asset');
const pulse=fs.readFileSync(path.join(root,'apps/mobile/src/ui/waiting-pulse.tsx'),'utf8');
for(const needle of ['badger-run-hero.png','badger-run-token.png','Animated.loop','useNativeDriver:true'])if(!pulse.includes(needle))throw new Error(`WaitingPulse missing ${needle}`);
const tabs=fs.readFileSync(path.join(root,'apps/mobile/app/(tabs)/_layout.tsx'),'utf8');
if(!tabs.includes('BrandIcon'))throw new Error('Bottom navigation is not using brand icons');
const profile=fs.readFileSync(path.join(root,'apps/mobile/app/(tabs)/profile.tsx'),'utf8');
for(const needle of ['ThemeOption','SIGNATURE','UI 1.4.2','miniCard'])if(!profile.includes(needle))throw new Error(`Theme selector missing ${needle}`);
const app=JSON.parse(fs.readFileSync(path.join(root,'apps/mobile/app.json'),'utf8'));
if(app.expo?.icon!=='./assets/brand/app-icon.png')throw new Error('Brand app icon not configured');
console.log('PASS CargoGo UI 1.4.2 polish fixture');
