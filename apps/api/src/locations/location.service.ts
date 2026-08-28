import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { CITIES, COUNTRIES, type City } from './location.catalog';

type ResolvedPlace = {
  countryCode:string;
  countryName:string;
  cityId:string;
  cityName:string;
  street:string;
  lat:number;
  lng:number;
  publicLabel:string;
  geocoded:boolean;
  geocodingSource:'osm-nominatim'|'city-centre';
};

@Injectable()
export class LocationService {
  private usageWarningShown=false;
  constructor(private readonly config:ConfigService,private readonly db:DatabaseService){}

  listCountries() { return COUNTRIES; }
  listCities(countryCode: string, query?: string) {
    const cc = countryCode.trim().toUpperCase();
    if (!COUNTRIES.some((c) => c.code === cc)) throw new BadRequestException({ code:'COUNTRY_UNSUPPORTED', message:'Country is not available in the current catalog' });
    const q = query?.trim().toLocaleLowerCase('uk-UA') ?? '';
    return CITIES.filter((c) => c.countryCode === cc && (!q || c.name.toLocaleLowerCase('uk-UA').includes(q))).slice(0, 100);
  }
  requireCity(countryCode: string, cityId: string): City {
    const city = CITIES.find((c) => c.countryCode === countryCode.toUpperCase() && c.id === cityId);
    if (!city) throw new NotFoundException({ code:'CITY_NOT_FOUND', message:'Selected city is not available' });
    return city;
  }
  countryName(code: string) {
    const c = COUNTRIES.find((x) => x.code === code.toUpperCase());
    if (!c) throw new NotFoundException({ code:'COUNTRY_NOT_FOUND', message:'Selected country is not available' });
    return c.name;
  }

  normalizeStreet(value:string){
    return value.trim().toLocaleLowerCase('uk-UA').replace(/[.,]/g,' ').replace(/\s+/g,' ');
  }

  private async usage(metricKey:string,delta=1){
    try{
      await this.db.query(`INSERT INTO service_usage_counter(service_key,metric_key,period_start,usage_value) VALUES('osm_nominatim',$1,date_trunc('month',now())::date,$2) ON CONFLICT(service_key,metric_key,period_start) DO UPDATE SET usage_value=service_usage_counter.usage_value+EXCLUDED.usage_value,updated_at=now()`,[metricKey,delta]);
    }catch(error){
      if(!this.usageWarningShown){
        this.usageWarningShown=true;
        console.warn('[locations] geocoding usage counter unavailable:',error instanceof Error?error.message:error);
      }
    }
  }

  private nextNominatimAt=0;
  private nominatimQueue=Promise.resolve();
  private async throttleNominatim(){
    // Public Nominatim policy: absolute maximum 1 request/second per application.
    // Serialize calls on this API process and keep the provider configurable so it can be
    // switched server-side without shipping a new mobile build.
    let release!:()=>void;
    const previous=this.nominatimQueue;
    this.nominatimQueue=new Promise<void>(resolve=>{release=resolve});
    await previous;
    const wait=Math.max(0,this.nextNominatimAt-Date.now());
    if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));
    this.nextNominatimAt=Date.now()+1050;
    release();
  }

  private async geocodeAddress(street:string,city:City,countryName:string,countryCode:string):Promise<{lat:number;lng:number}|null>{
    if(!street.trim())return null;
    const provider=this.config.get<string>('GEOCODING_PROVIDER')?.trim()||'nominatim';
    if(provider==='off')return null;
    if(provider!=='nominatim')return null;

    const base=(this.config.get<string>('NOMINATIM_BASE_URL')?.trim()||'https://nominatim.openstreetmap.org').replace(/\/$/,'');
    const userAgent=this.config.get<string>('NOMINATIM_USER_AGENT')?.trim()||'CargoGo/1.8.8';
    const query=[street,city.name,countryName].filter(Boolean).join(', ');
    try{
      await this.throttleNominatim();
      await this.usage('requests');
      const url=`${base}/search?format=jsonv2&limit=1&addressdetails=1&countrycodes=${encodeURIComponent(countryCode.toLowerCase())}&q=${encodeURIComponent(query)}`;
      const response=await fetch(url,{headers:{accept:'application/json','user-agent':userAgent},signal:AbortSignal.timeout(6500)});
      if(!response.ok){await this.usage('errors');return null;}
      const body=await response.json() as any;
      const feature=Array.isArray(body)?body[0]:null;
      const lat=Number(feature?.lat),lng=Number(feature?.lon);
      if(!Number.isFinite(lat)||!Number.isFinite(lng)){await this.usage('misses');return null;}
      // Do not accept broad city/region fallbacks when the user supplied an address.
      const kind=String(feature?.addresstype??feature?.type??'').toLowerCase();
      if(['country','state','region','county','city','town','village','municipality','postcode'].includes(kind)){await this.usage('misses');return null;}
      await this.usage('resolved');
      return {lng,lat};
    }catch(error){
      await this.usage('errors');
      console.warn('[locations] Nominatim geocoding unavailable; falling back to city centre:',error instanceof Error?error.message:error);
      return null;
    }
  }

  async resolve(input: { countryCode:string; cityId:string; street:string }):Promise<ResolvedPlace> {
    const countryCode = input.countryCode.toUpperCase();
    const city = this.requireCity(countryCode,input.cityId);
    const countryName=this.countryName(countryCode);
    const street=input.street.trim();
    const geocoded=await this.geocodeAddress(street,city,countryName,countryCode);
    return {
      countryCode,countryName,cityId:city.id,cityName:city.name,street,
      lat:geocoded?.lat??city.lat,lng:geocoded?.lng??city.lng,
      publicLabel:`${city.name}, ${countryName}`,
      geocoded:!!geocoded,
      geocodingSource:geocoded?'osm-nominatim':'city-centre',
    };
  }
}
