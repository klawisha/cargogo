import { Injectable } from '@nestjs/common';

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

@Injectable()
export class RoutingService {
  async buildRoute(origin: Point,destination: Point): Promise<RouteResult> {
    // v0.4 fallback: intentionally NOT presented as road distance. The interface
    // stays stable when a production routing provider is introduced.
    return {
      wkt:`LINESTRING(${origin.lng} ${origin.lat},${destination.lng} ${destination.lat})`,
      distanceM:haversineMeters(origin,destination),
      durationS:null,
      source:'fallback-straightline',
      quality:'rough',
    };
  }
}
