import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CITIES, COUNTRIES, type City } from './location.catalog';

@Injectable()
export class LocationService {
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
  resolve(input: { countryCode:string; cityId:string; street:string }) {
    const countryCode = input.countryCode.toUpperCase(); const city = this.requireCity(countryCode,input.cityId); const countryName=this.countryName(countryCode);
    return { countryCode,countryName,cityId:city.id,cityName:city.name,street:input.street.trim(),lat:city.lat,lng:city.lng,publicLabel:`${city.name}, ${countryName}` };
  }
}
