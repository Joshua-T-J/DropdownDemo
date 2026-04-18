import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Inject,
  Injector,
  OnDestroy,
  Optional,
  Self,
  ViewChild,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NgControl,
  ReactiveFormsModule,
  ValidationErrors,
  Validator,
  ValidatorFn,
  Validators,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';

import {
  DropdownAdapter,
  DropdownAdapterOptions,
  DropdownChangeEvent,
  DROPDOWN_ADAPTER,
} from './dropdown-adapters/dropdown-adapter.interface';
import { WijmoDropdownAdapter } from './dropdown-adapters/wijmo-dropdown.adapter';

// ─── Public config type ───────────────────────────────────────────────────────

export interface DropdownConfig {
  isEditable?: boolean;
  showDropDownButton?: boolean;
  maxDropDownHeight?: number;
  dropDownCssClass?: string;
  isAnimated?: boolean;
  caseSensitiveSearch?: boolean;
  autoExpandSelection?: boolean;
  header?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-dropdown-wrapper',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    // Self-provide CVA so ngModel / formControl work without @Self injection issues
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DropdownWrapperComponent),
      multi: true,
    },
    // Self-provide Validator so required / custom validators integrate with forms
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => DropdownWrapperComponent),
      multi: true,
    },
    // Default adapter — can be overridden per-component or per-module
    { provide: DROPDOWN_ADAPTER, useClass: WijmoDropdownAdapter },
  ],
  templateUrl: './dropdown-wrapper.component.html',
  styleUrls: ['./dropdown-wrapper.component.scss'],
})
export class DropdownWrapperComponent
  implements AfterViewInit, OnDestroy, ControlValueAccessor, Validator
{
  // ─── View ref ──────────────────────────────────────────────────────────────

  @ViewChild('adapterHost', { static: true })
  adapterHostRef!: ElementRef<HTMLElement>;

  // ─── Injections ────────────────────────────────────────────────────────────

  private readonly _destroyRef = inject(DestroyRef);
  private readonly _injector = inject(Injector);

  constructor(@Inject(DROPDOWN_ADAPTER) private readonly _adapter: DropdownAdapter) {}

  // ─── Signal inputs ─────────────────────────────────────────────────────────

  /** Unique ID for ARIA linkage */
  readonly id = input<string>(`dw-${Math.random().toString(36).slice(2, 8)}`);

  /** Visible label text */
  readonly label = input<string>('');

  /** Show floating label */
  readonly showLabel = input<boolean>(true);

  /** Items array — reactive, updates the dropdown whenever this changes */
  readonly itemsSource = input<any[]>([]);

  /** Object property for display text */
  readonly displayMemberPath = input<string>('');

  /** Object property for bound value */
  readonly selectedValuePath = input<string>('');

  /** Placeholder text */
  readonly placeholder = input<string>('');

  /** Whether the field is required */
  readonly required = input<boolean>(false);

  /** Whether the control is disabled */
  readonly disabled = input<boolean>(false);

  /** Whether the control is read-only */
  readonly readonly = input<boolean>(false);

  /** Show a clear (×) button when a value is selected */
  readonly showClearButton = input<boolean>(false);

  /**
   * Show a "-- Select --" sentinel item when the list is empty or always.
   * Defaults to true.
   */
  readonly showSelect = input<boolean>(true);

  /**
   * Auto-select the item when only one exists in itemsSource.
   * Defaults to true.
   */
  readonly autoSelectSingle = input<boolean>(true);

  /** ARIA label override */
  readonly ariaLabel = input<string>('');

  /** ARIA describedby override */
  readonly ariaDescribedBy = input<string>('');

  /** Custom CSS class on the wrapper div */
  readonly cssClass = input<string>('');

  /** Advanced adapter config */
  readonly config = input<DropdownConfig>({});

  /** Custom validators from the parent */
  readonly customValidators = input<ValidatorFn[]>([]);

  // ─── Two-way binding: selectedValue ────────────────────────────────────────

  readonly selectedValue = model<any>(null);

  // ─── Outputs ───────────────────────────────────────────────────────────────

  /** Emits after the adapter has fully initialised */
  readonly initialized = output<DropdownAdapter>();

  /** Emits on every value change */
  readonly selectedValueChange = output<DropdownChangeEvent>();

  /** Emits on focus */
  readonly focused = output<void>();

  /** Emits on blur */
  readonly blurred = output<void>();

  /** Emits when the dropdown opens or closes */
  readonly droppedDownChange = output<boolean>();

  /** Emits on every keystroke */
  readonly textChange = output<string>();

  // ─── Internal state signals ────────────────────────────────────────────────

  readonly isFocused = signal(false);
  readonly isDroppedDown = signal(false);
  readonly inputText = signal('');
  readonly isTouched = signal(false);
  readonly isDirty = signal(false);

  /** Whether the adapter has been initialised */
  private readonly _adapterReady = signal(false);

  /** Current value held by this control (synced to/from CVA) */
  private readonly _value = signal<any>(null);

  // ─── CVA callbacks ─────────────────────────────────────────────────────────

  private _onChange: (value: any) => void = () => {};
  private _onTouched: () => void = () => {};
  private _onValidatorChange: () => void = () => {};

  // ─── Computed: effective items (with sentinel + auto-select logic) ──────────

  readonly effectiveItems = computed(() => {
    const raw = this.itemsSource() ?? [];
    const sentinel = this.showSelect() && this.displayMemberPath() ? [this._makeSentinel()] : [];
    return [...sentinel, ...raw];
  });

  /** CSS class string for the wrapper */
  readonly _cssClass = computed(() => {
    const parts: string[] = [];
    if (this.cssClass()) parts.push(this.cssClass());
    if (this.isFocused()) parts.push('wj-state-focused');
    if (this.isDroppedDown()) parts.push('wj-state-dropped-down');
    if (this.disabled()) parts.push('wj-state-disabled');
    if (this.readonly()) parts.push('wj-state-readonly');
    if (this.isInvalid()) parts.push('wj-state-invalid');
    return parts.join(' ');
  });

  // ─── Computed: validation ──────────────────────────────────────────────────

  readonly isInvalid = computed(() => {
    if (!this.isTouched()) return false;
    return this._runValidation() !== null;
  });

  readonly hasValue = computed(() => {
    const v = this._value();
    return v !== null && v !== undefined && v !== '';
  });

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  ngAfterViewInit(): void {
    this._initAdapter();

    // React to itemsSource changes after init
    effect(
      () => {
        const items = this.effectiveItems();
        if (this._adapterReady()) {
          this._adapter.setItemsSource(items);
          this._handleAutoSelect(items);
        }
      },
      { injector: this._injector },
    );

    // React to disabled changes
    effect(
      () => {
        if (this._adapterReady()) {
          this._adapter.setDisabled(this.disabled());
        }
      },
      { injector: this._injector },
    );

    // React to readonly changes
    effect(
      () => {
        if (this._adapterReady()) {
          this._adapter.setReadOnly(this.readonly());
        }
      },
      { injector: this._injector },
    );
  }

  ngOnDestroy(): void {
    this._adapter.destroy();
  }

  // ─── ControlValueAccessor ──────────────────────────────────────────────────

  writeValue(value: any): void {
    this._value.set(value);
    if (this._adapterReady()) {
      this._adapter.setValue(value);
    }
  }

  registerOnChange(fn: (value: any) => void): void {
    this._onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this._onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    // The form module may call this; we reflect it through the adapter
    if (this._adapterReady()) {
      this._adapter.setDisabled(isDisabled);
    }
  }

  // ─── Validator ─────────────────────────────────────────────────────────────

  validate(_control: AbstractControl): ValidationErrors | null {
    return this._runValidation();
  }

  registerOnValidatorChange(fn: () => void): void {
    this._onValidatorChange = fn;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  openDropDown(): void {
    this._adapter.open();
  }
  closeDropDown(): void {
    this._adapter.close();
  }
  toggleDropDown(): void {
    this._adapter.toggle();
  }
  focusControl(): void {
    this._adapter.focus();
  }
  refresh(): void {
    this._adapter.refresh();
  }
  getAdapter(): DropdownAdapter {
    return this._adapter;
  }

  clear(): void {
    this._adapter.clear();
    this._setValue(null, null, -1, '');
  }

  markAsTouched(): void {
    this.isTouched.set(true);
    this._onTouched();
    this._onValidatorChange();
  }

  markAsDirty(): void {
    this.isDirty.set(true);
  }

  // ─── Error message helper ──────────────────────────────────────────────────

  getErrorMessage(): string {
    const errors = this._runValidation();
    if (!errors) return '';
    if (errors['required']) return 'This field is required.';
    if (errors['custom']) return errors['custom'];
    return 'Invalid value.';
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private _initAdapter(): void {
    const cfg = this.config() ?? {};
    const items = this.effectiveItems();

    const options: DropdownAdapterOptions = {
      hostElement: this.adapterHostRef.nativeElement,
      itemsSource: items,
      displayMemberPath: this.displayMemberPath(),
      selectedValuePath: this.selectedValuePath(),
      isEditable: cfg.isEditable ?? false,
      showDropDownButton: cfg.showDropDownButton ?? true,
      maxDropDownHeight: cfg.maxDropDownHeight ?? 200,
      dropDownCssClass: cfg.dropDownCssClass ?? '',
      placeholder: this.placeholder(),
      isAnimated: cfg.isAnimated ?? true,
      caseSensitiveSearch: cfg.caseSensitiveSearch ?? false,
      autoExpandSelection: cfg.autoExpandSelection ?? true,
      header: cfg.header ?? '',
      isDisabled: this.disabled(),
      isReadOnly: this.readonly(),

      onValueChange: (event) => this._onAdapterValueChange(event),
      onFocus: () => this._onAdapterFocus(),
      onBlur: () => this._onAdapterBlur(),
      onDroppedDownChange: (open) => this.isDroppedDown.set(open),
      onTextChange: (text) => {
        this.inputText.set(text);
        this.textChange.emit(text);
      },
      onItemsSourceChange: () => {},
    };

    this._adapter.init(options);
    this._adapterReady.set(true);

    // Set initial value if one exists
    const initVal = this._value();
    if (initVal !== null && initVal !== undefined) {
      this._adapter.setValue(initVal);
    }

    // Handle auto-select for single-item lists
    this._handleAutoSelect(items);

    this.initialized.emit(this._adapter);
  }

  private _handleAutoSelect(items: any[]): void {
    if (!this.autoSelectSingle()) return;
    // Filter out the sentinel item
    const real = items.filter((i) => !i?.__sentinel__);
    if (real.length !== 1) return;
    const item = real[0];
    const value = this.selectedValuePath() ? item[this.selectedValuePath()] : item;
    // Only auto-select if no value already set
    if (this._value() === null || this._value() === undefined) {
      const text = this.displayMemberPath() ? item[this.displayMemberPath()] : `${item}`;
      this._setValue(value, item, 0, text);
      this._adapter.setValue(value);
    }
  }

  private _onAdapterValueChange(event: DropdownChangeEvent): void {
    // Ignore sentinel selection
    if (event.item?.__sentinel__) {
      this._setValue(null, null, -1, '');
      return;
    }
    this._setValue(event.value, event.item, event.index, event.text);
    this.isDirty.set(true);
    this.selectedValueChange.emit(event);
  }

  private _onAdapterFocus(): void {
    this.isFocused.set(true);
    this.focused.emit();
  }

  private _onAdapterBlur(): void {
    this.isFocused.set(false);
    this.isTouched.set(true);
    this._onTouched();
    this._onValidatorChange();
    this.blurred.emit();
  }

  private _setValue(value: any, _item: any, _index: number, _text: string): void {
    this._value.set(value);
    this.selectedValue.set(value);
    this._onChange(value);
  }

  private _runValidation(): ValidationErrors | null {
    const value = this._value();
    const errors: ValidationErrors = {};

    if (this.required() && (value === null || value === undefined || value === '')) {
      errors['required'] = true;
    }

    for (const fn of this.customValidators()) {
      const result = fn({ value } as AbstractControl);
      if (result) Object.assign(errors, result);
    }

    return Object.keys(errors).length ? errors : null;
  }

  private _makeSentinel(): any {
    return { __sentinel__: true, [this.displayMemberPath() || 'label']: '-- Select --' };
  }
}
