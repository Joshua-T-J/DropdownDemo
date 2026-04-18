import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';

import { DropdownWrapperComponent } from './dropdown-wrapper.component';
import { DROPDOWN_ADAPTER } from './dropdown-adapters/dropdown-adapter.interface';
import { MaterialDropdownAdapterStub } from './dropdown-adapters/material-dropdown.adapter.stub.spec';

// ─── Stub adapter for tests ───────────────────────────────────────────────────

class StubDropdownAdapter {
  private _value: any = null;
  private _items: any[] = [];
  private _disabled = false;
  private _readOnly = false;
  private _opts: any = null;

  init(options: any): void { this._opts = options; this._items = options.itemsSource ?? []; }
  getValue(): any { return this._value; }
  setValue(v: any): void { this._value = v; }
  setItemsSource(items: any[]): void { this._items = items; }
  setDisabled(v: boolean): void { this._disabled = v; }
  setReadOnly(v: boolean): void { this._readOnly = v; }
  open(): void {}
  close(): void {}
  toggle(): void {}
  focus(): void {}
  clear(): void { this._value = null; }
  refresh(): void {}
  getControlInstance(): any { return null; }
  destroy(): void {}

  // Test helpers
  simulateValueChange(value: any, item: any, index: number, text: string): void {
    this._opts?.onValueChange({ value, item, index, text });
  }
  simulateBlur(): void { this._opts?.onBlur(); }
  simulateFocus(): void { this._opts?.onFocus(); }
  getItems(): any[] { return this._items; }
  isDisabled(): boolean { return this._disabled; }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DropdownWrapperComponent', () => {
  let component: DropdownWrapperComponent;
  let fixture: ComponentFixture<DropdownWrapperComponent>;
  let stubAdapter: StubDropdownAdapter;

  const items = [
    { id: 1, name: 'Apple' },
    { id: 2, name: 'Banana' },
    { id: 3, name: 'Cherry' },
  ];

  beforeEach(async () => {
    stubAdapter = new StubDropdownAdapter();

    await TestBed.configureTestingModule({
      imports: [DropdownWrapperComponent, ReactiveFormsModule, FormsModule],
      providers: [
        { provide: DROPDOWN_ADAPTER, useValue: stubAdapter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DropdownWrapperComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  // ── Rendering ───────────────────────────────────────────────────────────────

  it('should render the adapter host element', () => {
    fixture.detectChanges();
    const host = fixture.nativeElement.querySelector('.dropdown-adapter-host');
    expect(host).toBeTruthy();
  });

  it('should render label when showLabel is true and label is set', () => {
    fixture.componentRef.setInput('label', 'Country');
    fixture.componentRef.setInput('showLabel', true);
    fixture.detectChanges();
    const label = fixture.nativeElement.querySelector('label');
    expect(label?.textContent?.trim()).toContain('Country');
  });

  it('should not render label when showLabel is false', () => {
    fixture.componentRef.setInput('label', 'Country');
    fixture.componentRef.setInput('showLabel', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('label')).toBeNull();
  });

  // ── itemsSource reactivity ───────────────────────────────────────────────────

  it('should call setItemsSource on the adapter when itemsSource input changes', fakeAsync(() => {
    fixture.componentRef.setInput('itemsSource', items);
    fixture.detectChanges();
    tick();
    expect(stubAdapter.getItems().some((i) => i.name === 'Apple')).toBeTrue();

    fixture.componentRef.setInput('itemsSource', [{ id: 4, name: 'Durian' }]);
    fixture.detectChanges();
    tick();
    expect(stubAdapter.getItems().some((i) => i.name === 'Durian')).toBeTrue();
  }));

  it('should prepend sentinel item when showSelect is true and items present', fakeAsync(() => {
    fixture.componentRef.setInput('showSelect', true);
    fixture.componentRef.setInput('itemsSource', items);
    fixture.detectChanges();
    tick();
    const adapterItems = stubAdapter.getItems();
    expect(adapterItems[0].__sentinel__).toBeTrue();
  }));

  it('should not prepend sentinel when showSelect is false', fakeAsync(() => {
    fixture.componentRef.setInput('showSelect', false);
    fixture.componentRef.setInput('itemsSource', items);
    fixture.detectChanges();
    tick();
    expect(stubAdapter.getItems()[0]?.__sentinel__).toBeFalsy();
  }));

  // ── Auto-select single item ─────────────────────────────────────────────────

  it('should auto-select the only item when autoSelectSingle is true', fakeAsync(() => {
    fixture.componentRef.setInput('autoSelectSingle', true);
    fixture.componentRef.setInput('selectedValuePath', 'id');
    fixture.componentRef.setInput('displayMemberPath', 'name');
    fixture.componentRef.setInput('showSelect', false);
    fixture.componentRef.setInput('itemsSource', [{ id: 99, name: 'Solo' }]);
    fixture.detectChanges();
    tick();
    expect(component.selectedValue()).toBe(99);
  }));

  it('should not auto-select when autoSelectSingle is false', fakeAsync(() => {
    fixture.componentRef.setInput('autoSelectSingle', false);
    fixture.componentRef.setInput('selectedValuePath', 'id');
    fixture.componentRef.setInput('showSelect', false);
    fixture.componentRef.setInput('itemsSource', [{ id: 99, name: 'Solo' }]);
    fixture.detectChanges();
    tick();
    expect(component.selectedValue()).toBeNull();
  }));

  // ── ControlValueAccessor ────────────────────────────────────────────────────

  it('should call writeValue and forward to adapter', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    component.writeValue(2);
    expect(stubAdapter.getValue()).toBe(2);
  }));

  it('should call onChange when adapter emits a value change', fakeAsync(() => {
    let emitted: any = undefined;
    fixture.detectChanges();
    tick();
    component.registerOnChange((v) => (emitted = v));
    stubAdapter.simulateValueChange(2, items[1], 1, 'Banana');
    expect(emitted).toBe(2);
  }));

  it('should mark as touched on blur', fakeAsync(() => {
    let touched = false;
    fixture.detectChanges();
    tick();
    component.registerOnTouched(() => (touched = true));
    stubAdapter.simulateBlur();
    expect(touched).toBeTrue();
    expect(component.isTouched()).toBeTrue();
  }));

  // ── Validation ──────────────────────────────────────────────────────────────

  it('should return required error when required and no value', fakeAsync(() => {
    fixture.componentRef.setInput('required', true);
    fixture.detectChanges();
    tick();
    component.markAsTouched();
    const errors = component.validate({ value: null } as any);
    expect(errors?.['required']).toBeTrue();
  }));

  it('should return null validation errors when value is set and required', fakeAsync(() => {
    fixture.componentRef.setInput('required', true);
    fixture.detectChanges();
    tick();
    component.writeValue(1);
    const errors = component.validate({ value: 1 } as any);
    expect(errors).toBeNull();
  }));

  it('should run custom validators', fakeAsync(() => {
    const customValidator = () => ({ custom: 'Must be > 5' });
    fixture.componentRef.setInput('customValidators', [customValidator]);
    fixture.detectChanges();
    tick();
    component.markAsTouched();
    const errors = component.validate({ value: null } as any);
    expect(errors?.['custom']).toBe('Must be > 5');
  }));

  // ── isInvalid computed ──────────────────────────────────────────────────────

  it('should not show invalid before touched', () => {
    fixture.componentRef.setInput('required', true);
    fixture.detectChanges();
    expect(component.isInvalid()).toBeFalse();
  });

  it('should show invalid after touched with required and no value', fakeAsync(() => {
    fixture.componentRef.setInput('required', true);
    fixture.detectChanges();
    tick();
    component.markAsTouched();
    fixture.detectChanges();
    expect(component.isInvalid()).toBeTrue();
  }));

  // ── Disabled / readonly ─────────────────────────────────────────────────────

  it('should call setDisabled on adapter when setDisabledState is called', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    component.setDisabledState(true);
    expect(stubAdapter.isDisabled()).toBeTrue();
  }));

  // ── Clear ───────────────────────────────────────────────────────────────────

  it('should clear the value and emit null', fakeAsync(() => {
    let emitted: any = 'not-cleared';
    fixture.detectChanges();
    tick();
    component.registerOnChange((v) => (emitted = v));
    component.writeValue(1);
    component.clear();
    expect(emitted).toBeNull();
    expect(component.selectedValue()).toBeNull();
  }));

  // ── Public API ──────────────────────────────────────────────────────────────

  it('should expose getAdapter()', () => {
    fixture.detectChanges();
    expect(component.getAdapter()).toBe(stubAdapter as any);
  });
});
