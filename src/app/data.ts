import { Injectable } from '@angular/core';
import { of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class Data {
  getCountriesAndStates() {
    return of(COUNTRIESANDSTATES);
  }
}

const COUNTRIESANDSTATES = {
  Table: [
    { id: 1, CountryName: 'United States' },
    { id: 2, CountryName: 'Canada' },
    { id: 3, CountryName: 'Mexico' },
    { id: 4, CountryName: 'United Kingdom' },
    { id: 5, CountryName: 'France' },
  ],
  Table1: [
    { id: 1, StateName: 'California', countryId: 1 },
    { id: 2, StateName: 'Texas', countryId: 1 },
    { id: 3, StateName: 'Ontario', countryId: 2 },
    { id: 4, StateName: 'Quebec', countryId: 2 },
    { id: 5, StateName: 'Mexico City', countryId: 3 },
    { id: 6, StateName: 'Paris', countryId: 5 },
  ],
  // City data
  Table2: [
    { id: 1, CityName: 'Los Angeles', stateId: 1 },
    { id: 2, CityName: 'San Francisco', stateId: 1 },
    { id: 3, CityName: 'Houston', stateId: 2 },
    { id: 4, CityName: 'Dallas', stateId: 2 },
    { id: 5, CityName: 'Toronto', stateId: 3 },
    { id: 6, CityName: 'Paris', stateId: 6 },
  ],
};
