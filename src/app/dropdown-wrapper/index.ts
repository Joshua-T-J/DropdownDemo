// ─── Public API barrel ────────────────────────────────────────────────────────

export { DropdownWrapperComponent } from './dropdown-wrapper.component';
export type { DropdownConfig } from './dropdown-wrapper.component';
export {
  DROPDOWN_ADAPTER,
} from './dropdown-adapters/dropdown-adapter.interface';
export type {
  DropdownAdapter,
  DropdownAdapterOptions,
  DropdownChangeEvent,
} from './dropdown-adapters/dropdown-adapter.interface';
export { WijmoDropdownAdapter } from './dropdown-adapters/wijmo-dropdown.adapter';
export { MaterialDropdownAdapter } from './dropdown-adapters/material-dropdown.adapter';
export { DropdownWrapperModule } from './dropdown-wrapper.module';

/*
──────────────────────────────────────────────────────────────────────────────
USAGE — Reactive Forms
──────────────────────────────────────────────────────────────────────────────

  form = new FormGroup({
    country: new FormControl(null, Validators.required),
  });

  <app-dropdown-wrapper
    label="Country"
    [required]="true"
    [itemsSource]="countries"
    displayMemberPath="name"
    selectedValuePath="code"
    formControlName="country" />

──────────────────────────────────────────────────────────────────────────────
USAGE — Template-driven / ngModel
──────────────────────────────────────────────────────────────────────────────

  <app-dropdown-wrapper
    label="Country"
    [required]="true"
    [itemsSource]="countries"
    displayMemberPath="name"
    selectedValuePath="code"
    [(ngModel)]="selectedCountry" />

──────────────────────────────────────────────────────────────────────────────
USAGE — Standalone two-way binding (no forms module)
──────────────────────────────────────────────────────────────────────────────

  <app-dropdown-wrapper
    label="Country"
    [itemsSource]="countries"
    displayMemberPath="name"
    selectedValuePath="code"
    [(selectedValue)]="selectedCountry"
    (selectedValueChange)="onCountryChange($event)" />

──────────────────────────────────────────────────────────────────────────────
USAGE — Accessing the adapter from the parent
──────────────────────────────────────────────────────────────────────────────

  @ViewChild(DropdownWrapperComponent) dropdown!: DropdownWrapperComponent;

  onDropdownReady(adapter: DropdownAdapter): void {
    adapter.open();
    adapter.setValue('US');
    adapter.refresh();

    // Raw Wijmo control access:
    const combo = adapter.getControlInstance() as wjcInput.ComboBox;
    combo.formatItem.addHandler((s, e) => { ... });
  }

──────────────────────────────────────────────────────────────────────────────
USAGE — Switching adapters
──────────────────────────────────────────────────────────────────────────────

  // Per-component override:
  @Component({
    providers: [{ provide: DROPDOWN_ADAPTER, useClass: MaterialDropdownAdapter }]
  })

  // Global override in app.config.ts:
  providers: [
    { provide: DROPDOWN_ADAPTER, useClass: MyCustomAdapter }
  ]

──────────────────────────────────────────────────────────────────────────────
USAGE — Custom validators
──────────────────────────────────────────────────────────────────────────────

  mustBePositive: ValidatorFn = (ctrl) =>
    (ctrl.value ?? 0) > 0 ? null : { custom: 'Must be positive' };

  <app-dropdown-wrapper
    label="Quantity"
    [required]="true"
    [customValidators]="[mustBePositive]"
    [(selectedValue)]="qty" />

──────────────────────────────────────────────────────────────────────────────
ADDING A NEW ADAPTER — checklist
──────────────────────────────────────────────────────────────────────────────

  1. Create  my-lib-dropdown.adapter.ts  inside dropdown-adapters/
  2. Implement  DropdownAdapter<MyControlType>
  3. Register   { provide: DROPDOWN_ADAPTER, useClass: MyLibDropdownAdapter }
  4. Done — DropdownWrapperComponent needs zero changes.

*/
