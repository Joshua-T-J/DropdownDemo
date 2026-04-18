import { Component, inject, OnInit } from '@angular/core';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import {
  DropdownChangeEvent,
  DropdownWrapperComponent,
  DropdownWrapperModule,
} from '../dropdown-wrapper';
import { Data } from '../data';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { JsonPipe } from '@angular/common';

@Component({
  selector: 'app-form',
  imports: [DropdownWrapperModule, ReactiveFormsModule, JsonPipe],
  templateUrl: './form.html',
  styleUrl: './form.scss',
})
export class Form implements OnInit {
  private dataService = inject(Data);
  private fb = inject(FormBuilder);
  Contries: any[] = [];
  States: any[] = [];
  Cities: any[] = [];
  FilteredStates: any[] = [];
  FilteredCities: any[] = [];
  UserForm!: FormGroup;
  Disabled = true;

  ngOnInit(): void {
    this.UserForm = this.fb.group({
      name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      country: ['', [Validators.required]],
      state: ['', [Validators.required]],
      city: ['', [Validators.required]],
    });
    if (this.Disabled) {
      this.UserForm.disable();
    }
    this.getData();
  }

  loadFormData() {
    this.UserForm.setValue({
      name: 'John Doe',
      email: 'john.doe@example.com',
      country: 1, // Assuming this is the ID for a country
      state: 1, // Assuming this is the ID for a state
      city: 1, // Assuming this is the ID for a city
    });
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

  countryChange(country: DropdownChangeEvent) {
    console.log(country);
    const countryId = country.value;
    const filteredStates = this.States.filter((state) => state.countryId === countryId);
    this.UserForm.get('state')?.setValue('');
    this.UserForm.get('city')?.setValue('');
    this.FilteredStates = filteredStates;
  }

  stateChange(state: DropdownChangeEvent) {
    console.log(state);
    const stateId = state.value;
    const filteredCities = this.Cities.filter((city) => city.stateId === stateId);
    this.UserForm.get('city')?.setValue('');
    this.FilteredCities = filteredCities;
  }
  formSubmit() {
    if (this.UserForm.valid) {
      console.log('Form Data:', this.UserForm.value);
    } else {
      console.log('Form is invalid');
    }
  }
}
