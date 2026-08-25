import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { LocationService } from './location.service';
@Controller('locations') @UseGuards(AuthGuard)
export class LocationController {
  constructor(private readonly locations: LocationService) {}
  @Get('countries') countries(){ return this.locations.listCountries(); }
  @Get('cities') cities(@Query('country') country='UA',@Query('q') q?:string){ return this.locations.listCities(country,q); }
}
