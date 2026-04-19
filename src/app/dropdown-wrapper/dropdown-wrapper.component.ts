import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EnvironmentInjector,
  Inject,
  Injector,
  OnDestroy,
  Optional,
  ViewChild,
  computed,
  createEnvironmentInjector,
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
  ValidationErrors,
  Validator,
  ValidatorFn,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';

import {
  DropdownAdapter,
  DropdownAdapterOptions,
  DropdownChangeEvent,
  DROPDOWN_ADAPTER,
  DROPDOWN_ADAPTER_CLASS,
} from './dropdown-adapters/dropdown-adapter.interface';

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
    // CVA — lets Angular forms (formControlName, formControl, ngModel) bind here
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DropdownWrapperComponent),
      multi: true,
    },
    // Validator — integrates required/custom validators with the forms API
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => DropdownWrapperComponent),
      multi: true,
    },
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
  private readonly _envInjector = inject(EnvironmentInjector);

  /**
   * The adapter instance — one per component, never shared.
   *
   * We create a child EnvironmentInjector per component instance. This is the
   * only way to get Angular to construct the adapter class fresh each time
   * (useClass at module level creates a singleton). The child injector MUST
   * stay alive for as long as the adapter lives, because the adapter's own
   * inject() calls (ApplicationRef, EnvironmentInjector, etc.) are satisfied
   * through it. We destroy it in ngOnDestroy after destroying the adapter.
   */
  private readonly _adapter: DropdownAdapter;
  private readonly _adapterInjector: EnvironmentInjector;

  constructor() {
    const AdapterClass = this._injector.get(DROPDOWN_ADAPTER_CLASS, null);

    if (!AdapterClass) {
      throw new Error(
        '[DropdownWrapperComponent] No DROPDOWN_ADAPTER_CLASS found in the injector tree. ' +
          'Import DropdownWrapperModule (provides WijmoDropdownAdapter by default), or ' +
          'provide { provide: DROPDOWN_ADAPTER_CLASS, useValue: YourAdapterClass }.',
      );
    }

    // Create a child injector with AdapterClass as a local (non-singleton) provider.
    // Parent is the real app EnvironmentInjector so ApplicationRef etc. resolve normally.
    // Do NOT destroy this injector early — the adapter holds references to services
    // resolved through it (e.g. EnvironmentInjector stored in WijmoDropdownAdapter).
    this._adapterInjector = createEnvironmentInjector([AdapterClass], this._envInjector);

    this._adapter = this._adapterInjector.get(AdapterClass);
  }

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
   * When true, a "-- Select --" option is prepended to the list.
   * Only meaningful for adapters that render it as a real list item (e.g. Material).
   * Wijmo uses its native placeholder instead — no sentinel item is needed.
   * Defaults to true.
   */
  readonly showSelect = input<boolean>(true);

  /**
   * The text shown for the empty/sentinel option and as the Wijmo placeholder.
   * Defaults to '-- Select --'.
   */
  readonly selectLabel = input<string>('-- Select --');

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

  /**
   * Tracks disabled state set by Angular forms (form.disable() / control.disable()).
   * Angular calls setDisabledState() automatically — we store it here so it can
   * be merged with the [disabled] input without either one overwriting the other.
   */
  private readonly _formDisabled = signal(false);

  /**
   * Single source of truth for disabled state fed to the adapter.
   * True when EITHER [disabled]="true" is bound on the element OR
   * the parent form/control has been disabled programmatically.
   */
  readonly effectiveDisabled = computed(() => this.disabled() || this._formDisabled());

  // ─── CVA callbacks ─────────────────────────────────────────────────────────

  private _onChange: (value: any) => void = () => {};
  private _onTouched: () => void = () => {};
  private _onValidatorChange: () => void = () => {};

  // ─── Computed: effective items ─────────────────────────────────────────────

  /**
   * Items passed to the adapter. When showSelect is true, a sentinel object is
   * prepended — both Wijmo and Material treat it as a real selectable item at
   * the top of the list. Selecting it emits null (handled in _onAdapterValueChange).
   */
  readonly effectiveItems = computed(() => {
    const raw = this.itemsSource() ?? [];
    if (!this.showSelect()) return raw;
    return [this._makeSentinel(), ...raw];
  });

  /** CSS class string for the wrapper */
  readonly _cssClass = computed(() => {
    const parts: string[] = [];
    if (this.cssClass()) parts.push(this.cssClass());
    if (this.isFocused()) parts.push('wj-state-focused');
    if (this.isDroppedDown()) parts.push('wj-state-dropped-down');
    if (this.effectiveDisabled()) parts.push('wj-state-disabled');
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

    // React to disabled changes — covers both [disabled] input and form.disable()
    effect(
      () => {
        if (this._adapterReady()) {
          this._adapter.setDisabled(this.effectiveDisabled());
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
    // Destroy the per-instance child injector AFTER the adapter,
    // so any cleanup the adapter does can still resolve injected services.
    this._adapterInjector.destroy();
  }

  // ─── ControlValueAccessor ──────────────────────────────────────────────────

  writeValue(value: any): void {
    this._value.set(value);
    this.selectedValue.set(value); // keep model in sync with form CVA writes
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
    // Write to the internal signal — the effect() watching effectiveDisabled()
    // will pick this up and forward it to the adapter, keeping a single code path.
    this._formDisabled.set(isDisabled);
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

    // When showSelect is true and no explicit placeholder is set, use selectLabel
    // as the placeholder text. Wijmo renders this natively; Material uses a sentinel item.
    const placeholder = this.placeholder() || (this.showSelect() ? this.selectLabel() : '');

    const options: DropdownAdapterOptions = {
      hostElement: this.adapterHostRef.nativeElement,
      itemsSource: items,
      displayMemberPath: this.displayMemberPath(),
      selectedValuePath: this.selectedValuePath(),
      isEditable: cfg.isEditable ?? false,
      showDropDownButton: cfg.showDropDownButton ?? true,
      maxDropDownHeight: cfg.maxDropDownHeight ?? 200,
      dropDownCssClass: cfg.dropDownCssClass ?? '',
      placeholder,
      isAnimated: cfg.isAnimated ?? true,
      caseSensitiveSearch: cfg.caseSensitiveSearch ?? false,
      autoExpandSelection: cfg.autoExpandSelection ?? true,
      header: cfg.header ?? '',
      isDisabled: this.effectiveDisabled(),
      isReadOnly: this.readonly(),
      showSelect: this.showSelect(),
      selectLabel: this.selectLabel(),

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
    // Exclude the sentinel — only count real data items
    const real = items.filter((i) => !i?.__sentinel__);
    if (real.length !== 1) return;
    const item = real[0];
    const value = this.selectedValuePath() ? item[this.selectedValuePath()] : item;
    // Only auto-select if no value is already set
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
    const key = this.displayMemberPath() || 'label';
    return { __sentinel__: true, [key]: this.selectLabel() };
  }
}
