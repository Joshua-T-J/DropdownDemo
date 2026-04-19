import { Component, inject, OnInit } from '@angular/core';
import {
  DROPDOWN_ADAPTER_CLASS,
  DropdownChangeEvent,
  DropdownWrapperModule,
  MaterialDropdownAdapter,
} from '../dropdown-wrapper';
import { Data } from '../data';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { JsonPipe } from '@angular/common';

@Component({
  selector: 'app-form',
  imports: [DropdownWrapperModule, ReactiveFormsModule, JsonPipe],
  // providers: [{ provide: DROPDOWN_ADAPTER_CLASS, useValue: MaterialDropdownAdapter }],
  templateUrl: './form.html',
  styleUrl: './form.scss',
})
export class Form implements OnInit {
  private dataService = inject(Data);
  private fb = inject(FormBuilder);
  Contries: any[] = [];
  States: any[] = [];
  Cities: any[] = [];
  Types: any[] = [{ id: 1, type: 'Type 1' }];
  FilteredStates: any[] = [];
  FilteredCities: any[] = [];
  UserForm!: FormGroup;
  Disabled = true;
  LoadData = false;

  selectedCountry: any;

  ngOnInit(): void {
    this.UserForm = this.fb.group({
      name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      type: [null],
      country: [null, [Validators.required]],
      state: [null, [Validators.required]],
      city: [null, [Validators.required]],
    });
    if (this.Disabled) {
      this.UserForm.disable();
    }
    this.getData();
  }

  loadFormData() {
    this.LoadData = true;
    this.UserForm.patchValue({
      name: 'John Doe',
      email: 'john.doe@example.com',
      country: 1, // Assuming this is the ID for a country
      state: 1, // Assuming this is the ID for a state
      city: 1, // Assuming this is the ID for a city
      type: 1, // Assuming this is the ID for a type
    });
    this.selectedCountry = 4; // Set the selected country to trigger state filtering
  }

  resetForm() {
    this.LoadData = false; // ← first
    this.FilteredStates = []; // ← second
    this.FilteredCities = []; // ← third
    this.UserForm.reset(); // ← last: triggers writeValue(null) + microtask emissions
    this.selectedCountry = undefined;
  }

  getData() {
    this.dataService.getCountriesAndStates().subscribe({
      next: (data) => {
        console.log('Data received:', data);
        this.Contries = data.Table || [];
        this.States = data.Table1 || [];
        this.Cities = data.Table2 || [];
      },
    });
  }

  toggleForm() {
    this.Disabled = !this.Disabled;
    if (this.Disabled) {
      this.UserForm.disable();
    } else {
      this.UserForm.enable();
    }
  }

  countryChange(country: DropdownChangeEvent) {
    const countryId = country.value;
    const filteredStates = this.States.filter((state) => state.countryId === countryId);
    this.FilteredStates = filteredStates;
    if (!this.LoadData) {
      this.UserForm.get('state')?.setValue(null);
      this.UserForm.get('city')?.setValue(null);
    }
  }

  stateChange(state: DropdownChangeEvent) {
    const stateId = state.value;
    const filteredCities = this.Cities.filter((city) => city.stateId === stateId);
    this.FilteredCities = filteredCities;
    if (!this.LoadData) {
      this.UserForm.get('city')?.setValue(null);
    }
  }
  formSubmit() {
    this.UserForm.markAllAsTouched();
    if (this.UserForm.valid) {
      console.log('Form Data:', this.UserForm.value);
    } else {
      console.log('Form is invalid');
    }
  }

  onItemsSourceLoaded(type: 'State' | 'City', event: any) {
    // console.log(`${type} dropdown initialized:`, event);
    if (!this.LoadData) return;
    if (type === 'State') {
      this.UserForm.get('state')?.setValue(1);
    } else if (type === 'City') {
      this.UserForm.get('city')?.setValue(1);
    }
  }
}
