import fs from 'node:fs';
const route=fs.readFileSync('apps/api/src/routing/routing.service.ts','utf8');
const trip=fs.readFileSync('apps/api/src/trips/trip.service.ts','utf8');
const map=fs.readFileSync('apps/mobile/src/ui/route-preview.tsx','utf8');
const pkg=JSON.parse(fs.readFileSync('apps/mobile/package.json','utf8'));
const env=fs.readFileSync('apps/api/src/config/env.ts','utf8');
for (const [ok,msg] of [
 [route.includes('api.mapbox.com/directions/v5/mapbox/driving'),'Mapbox Directions provider'],
 [route.includes("quality:'routed'"),'routed quality'],
 [route.includes('fallback-straightline'),'safe fallback'],
 [trip.includes('ST_AsGeoJSON(t.route::geometry)'),'route GeoJSON DTO'],
 [trip.includes('matching_version??1)<4'),'matching v4 refresh'],
 [map.includes("from 'react-native-maps'"),'native map'],
 [map.includes('fitToCoordinates'),'fit route camera'],
 [pkg.dependencies['react-native-maps']==='1.27.2','Expo SDK 57 compatible map version'],
 [env.includes('MAPBOX_ACCESS_TOKEN'),'routing env token']
]) { if(!ok) throw new Error(`Missing: ${msg}`); console.log(`PASS ${msg}`); }
console.log('PASS road-routing static verification');
