import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';

type Point = { lat: number; lng: number };
export type RouteResult = {
  wkt: string;
  distanceM: number;
  durationS: number | null;
  source: string;
  quality: 'rough' | 'routed';
};

function haversineMeters(a: Point,b: Point) {
  const radius = 6_371_008.8;
  const rad = (value:number) => value * Math.PI / 180;
  const dLat = rad(b.lat-a.lat);
  const dLng = rad(b.lng-a.lng);
  const lat1 = rad(a.lat);
  const lat2 = rad(b.lat);
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return Math.round(2*radius*Math.asin(Math.sqrt(h)));
}
function lineStringWkt(coordinates:number[][]){
  const clean=coordinates.filter((p)=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1]));
  if(clean.length<2) throw new Error('Routing provider returned an invalid geometry');
  return `LINESTRING(${clean.map(([lng,lat])=>`${lng} ${lat}`).join(',')})`;
}

@Injectable()
export class RoutingService {
  constructor(private readonly config:ConfigService,private readonly db:DatabaseService){}
  private async usage(metricKey:string,delta=1){
    try{await this.db.query(`INSERT INTO service_usage_counter(service_key,metric_key,period_start,usage_value) VALUES('mapbox_directions',$1,date_trunc('month',now())::date,$2) ON CONFLICT(service_key,metric_key,period_start) DO UPDATE SET usage_value=service_usage_counter.usage_value+EXCLUDED.usage_value,updated_at=now()`,[metricKey,delta]);}catch{}
  }
  async buildRoute(origin: Point,destination: Point): Promise<RouteResult> {
    const provider=this.config.get<string>('ROUTING_PROVIDER')??'auto';
    const token=this.config.get<string>('MAPBOX_ACCESS_TOKEN')?.trim();
    if(provider!=='fallback'&&token){
      try {
        const url=`https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?alternatives=false&geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(token)}`;
        await this.usage('requests');
        const response=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(8000)});
        if(!response.ok){await this.usage('errors');throw new Error(`Mapbox directions HTTP ${response.status}`);}
        const body=await response.json() as any;
        const route=body?.routes?.[0];
        if(!route?.geometry?.coordinates?.length) throw new Error('Mapbox returned no route');
        await this.usage('routed');
        return {wkt:lineStringWkt(route.geometry.coordinates),distanceM:Math.round(route.distance),durationS:Math.round(route.duration),source:'mapbox-directions-v5',quality:'routed'};
      } catch(error){
        if(provider==='mapbox') throw error;
        console.warn('[routing] Mapbox unavailable; using fallback route:',error instanceof Error?error.message:error);
      }
    }
    return {wkt:`LINESTRING(${origin.lng} ${origin.lat},${destination.lng} ${destination.lat})`,distanceM:haversineMeters(origin,destination),durationS:null,source:'fallback-straightline',quality:'rough'};
  }
}
