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
  Self,
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
  untracked,
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NgControl,
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

/**
 * Payload emitted by (itemsSourceLoaded).
 *
 * Gives the parent everything it needs to restore a pre-fetched value into a
 * dependent dropdown after its items list has been replaced.
 */
export interface ItemsSourceLoadedEvent {
  /** The new items array, excluding the sentinel "-- Select --" item. */
  items: any[];
  /**
   * Call this to set a value in the dropdown immediately.
   * Updates both the adapter (visual selection) and the form control / model.
   */
  setValue: (value: any) => void;
  /** The value the control held before the new items arrived. */
  currentValue: any;
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

  // NgControl is resolved lazily in ngAfterViewInit via _injector.get() to
  // avoid NG0200 circular dependency:
  // DropdownWrapperComponent → NgControl → NG_VALIDATORS → DropdownWrapperComponent
  // Injecting it at field/constructor time triggers that cycle.
  private _ngControl: NgControl | null = null;

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

  /**
   * Auto-select the FIRST real item whenever items load (or change) and no
   * value is currently set. Works regardless of how many items exist.
   * Takes precedence over autoSelectSingle when both are true.
   * Defaults to false.
   */
  readonly autoSelectFirst = input<boolean>(false);

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

  /**
   * Emits the full change event (value + item + index + text) on every selection.
   * Use this when you need the selected item object or display text.
   */
  readonly selectedItemChange = output<DropdownChangeEvent>();

  /**
   * Emits every time the items list is replaced (i.e. [itemsSource] binding changes).
   *
   * Use this for dependent/cascading dropdowns: when a parent dropdown changes,
   * you update [itemsSource] on the child, and this output fires once the adapter
   * has loaded the new list — giving you the right moment to restore a pre-fetched
   * value (e.g. from a loaded form record) without racing against an empty list.
   *
   * Payload:
   *   items      — the new items array (excluding the sentinel)
   *   setValue   — call this with a value to select it immediately in the adapter;
   *                equivalent to patching the form control but works for standalone
   *                [(selectedValue)] usage too
   *   currentValue — the value the control currently holds before any setValue call
   *
   * @example — cascading state dropdown, restoring a saved value:
   *
   *   <app-dropdown-wrapper
   *     [itemsSource]="filteredStates"
   *     (itemsSourceLoaded)="onStatesLoaded($event)" />
   *
   *   onStatesLoaded({ items, setValue, currentValue }: ItemsSourceLoadedEvent) {
   *     // e.g. after countryChange filtered states, re-apply a pre-loaded state id
   *     const saved = this.UserForm.get('state')?.value;
   *     const exists = items.some(s => s.id === saved);
   *     if (exists) setValue(saved);   // adapter + form both update
   *   }
   */
  readonly itemsSourceLoaded = output<ItemsSourceLoadedEvent>();

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

  /**
   * Monotonically-increasing counter bumped every time writeValue(null) is called
   * (i.e. a programmatic reset). The items effect captures the generation at the
   * start of each run and compares it inside untracked() — if the generation has
   * advanced, a reset has occurred and auto-select must be skipped for that run.
   *
   * A plain boolean flag + Promise.resolve() microtask is NOT reliable here
   * because Angular's signal-based effects flush synchronously during change
   * detection with OnPush, meaning the microtask fires AFTER the effect body
   * has already run and the flag has been read.
   */
  private _resetGeneration = 0;

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

  /**
   * Coalescing queue for all outbound notifications.
   *
   * Multiple synchronous writes (e.g. _clearIfNotInSource → _handleAutoSelect,
   * or a rapid itemsSource swap) each update _value and the adapter immediately
   * so UI state is always current, but we must deliver only ONE emission per
   * microtask — the last written value — to both the CVA form (_onChange) and
   * the (selectedItemChange) output.
   *
   * Without this, Angular's form sees null → undefined → realValue in quick
   * succession, and parent (selectedItemChange) handlers fire 2-3 times for
   * a single logical user action (e.g. country change → state clear → city clear).
   *
   * Rule: every write path calls _scheduleEmit() instead of calling _onChange()
   * or selectedItemChange.emit() directly.  _scheduleEmit records the latest
   * event and, on the first call per synchronous burst, queues one microtask
   * flush that drains both outputs with the final settled value.
   */
  private _pendingEmitValue: any = undefined;
  private _pendingEmitEvent: DropdownChangeEvent | null = null;
  private _emitScheduled = false;

  private _scheduleEmit(value: any, event?: DropdownChangeEvent): void {
    // Always overwrite — earlier intermediate values are discarded.
    this._pendingEmitValue = value;
    // event is undefined when called from a non-user-initiated path (auto-select,
    // source-driven clear); in that case synthesise a minimal event so
    // selectedItemChange always carries a consistent payload.
    this._pendingEmitEvent = event ?? { value, item: null, index: -1, text: '' };

    if (this._emitScheduled) return; // one flush already queued for this burst
    this._emitScheduled = true;

    Promise.resolve().then(() => {
      this._emitScheduled = false;
      // Read at flush time to pick up the very last synchronous write.
      const finalValue = this._pendingEmitValue;
      const finalEvent = this._pendingEmitEvent!;
      this._onChange(finalValue);
      this.selectedItemChange.emit(finalEvent);
    });
  }

  // ─── Computed: effective items ─────────────────────────────────────────────

  /**
   * Items passed to the adapter.
   *
   * Sentinel suppression rule:
   *   When the list collapses to a single real item AND auto-selection is active
   *   (autoSelectSingle=true or autoSelectFirst=true), the "-- Select --" sentinel
   *   is omitted. There is nothing to choose from — the value is predetermined —
   *   so presenting a placeholder option would be misleading to both sighted users
   *   and screen readers.
   *
   * In all other cases where showSelect is true, a sentinel object is prepended.
   * Both Wijmo and Material treat it as a real selectable item at the top of the
   * list; selecting it emits null (handled in _onAdapterValueChange). The Material
   * adapter strips the sentinel internally and renders its own <mat-option> instead.
   */
  readonly effectiveItems = computed(() => {
    const raw = this.itemsSource() ?? [];

    // Suppress the sentinel when exactly one real item exists and auto-selection
    // will pick it automatically — a placeholder would never be needed.
    const singleAutoSelect =
      raw.length === 1 && (this.autoSelectSingle() || this.autoSelectFirst());

    if (!this.showSelect() || singleAutoSelect) return raw;
    return [this._makeSentinel(), ...raw];
  });

  /** CSS class string for the wrapper */
  readonly _cssClass = computed(() => {
    const parts: string[] = ['wj-labeled-input'];
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

    // ── Sync form control state → our internal signals ────────────────────────
    //
    // NgControl is resolved HERE (not at field/constructor time) to avoid NG0200.
    // By ngAfterViewInit, Angular has already finished setting up the CVA binding
    // so NgControl is fully available without a circular dependency.
    this._ngControl = this._injector.get(NgControl, null, { self: true, optional: true });

    if (this._ngControl?.control) {
      const ctrl = this._ngControl.control;

      // statusChanges doesn't fire for markAsTouched/markAsDirty etc., so we
      // patch those methods directly to mirror state into our signals.
      const original = {
        markAsTouched: ctrl.markAsTouched.bind(ctrl),
        markAsUntouched: ctrl.markAsUntouched.bind(ctrl),
        markAsDirty: ctrl.markAsDirty.bind(ctrl),
        markAsPristine: ctrl.markAsPristine.bind(ctrl),
      };

      ctrl.markAsTouched = (...args: any[]) => {
        original.markAsTouched(...args);
        this.isTouched.set(true);
        this._onValidatorChange();
      };

      ctrl.markAsUntouched = (...args: any[]) => {
        original.markAsUntouched(...args);
        this.isTouched.set(false);
        this._onValidatorChange();
      };

      ctrl.markAsDirty = (...args: any[]) => {
        original.markAsDirty(...args);
        this.isDirty.set(true);
      };

      ctrl.markAsPristine = (...args: any[]) => {
        original.markAsPristine(...args);
        this.isDirty.set(false);
        this.isTouched.set(false);
        this._onValidatorChange();
      };

      this._destroyRef.onDestroy(() => {
        ctrl.markAsTouched = original.markAsTouched;
        ctrl.markAsUntouched = original.markAsUntouched;
        ctrl.markAsDirty = original.markAsDirty;
        ctrl.markAsPristine = original.markAsPristine;
      });
    }

    // React to itemsSource changes after init.
    // Only effectiveItems() is tracked — everything else runs inside untracked()
    // so that writes to _value / selectedValue inside _handleAutoSelect or
    // the itemsSourceLoaded setValue callback cannot re-trigger this effect.
    let _firstItemsRun = true;
    effect(
      () => {
        const items = this.effectiveItems(); // ← the ONLY tracked read

        // Snapshot the reset generation at effect-schedule time (still inside the
        // reactive context). This is compared inside untracked() below — if reset
        // has been called between scheduling and execution, we skip auto-select.
        const generationAtSchedule = this._resetGeneration;

        untracked(() => {
          if (!this._adapterReady()) return;

          this._adapter.setItemsSource(items);

          // ── Value-invalidation ────────────────────────────────────────────
          // After the first run, whenever itemsSource changes we must check
          // whether the current value still exists in the new list. If it does
          // not (e.g. FilteredStates becomes [] after a country reset, or a
          // single-item list that was auto-selected is replaced), clear the
          // value so the adapter shows the placeholder and _handleAutoSelect
          // can re-evaluate from a clean slate.
          if (!_firstItemsRun) {
            this._clearIfNotInSource(items);
          }

          this._handleAutoSelect(items, generationAtSchedule);

          if (_firstItemsRun) {
            _firstItemsRun = false;
            return;
          }

          const realItems = items.filter((i) => !i?.__sentinel__);
          this.itemsSourceLoaded.emit({
            items: realItems,
            currentValue: this._value(),
            setValue: (value: any) => {
              this._setValue(value);
              this._adapter.setValue(value);
            },
          });
        });
      },
      { injector: this._injector },
    );

    // React to disabled changes — covers both [disabled] input and form.disable()
    effect(
      () => {
        const disabled = this.effectiveDisabled(); // tracked
        untracked(() => {
          if (this._adapterReady()) this._adapter.setDisabled(disabled);
        });
      },
      { injector: this._injector },
    );

    // React to readonly changes
    effect(
      () => {
        const readonly = this.readonly(); // tracked
        untracked(() => {
          if (this._adapterReady()) this._adapter.setReadOnly(readonly);
        });
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
    // Bump the reset generation whenever the form pushes null/undefined (i.e.
    // FormGroup.reset()). _handleAutoSelect captures this counter and skips
    // auto-selection if the generation has advanced since it was last read,
    // preventing an auto-select from immediately undoing the reset.
    if (value === null || value === undefined) {
      this._resetGeneration++;
    }
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
    this._setValue(null);
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
      ariaLabel: this.ariaLabel() || this.label(),
      required: this.required(),

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

    // Handle auto-select for single-item lists (generation 0 = no reset has occurred)
    this._handleAutoSelect(items, this._resetGeneration);

    this.initialized.emit(this._adapter);
  }

  /**
   * Called every time itemsSource is replaced (after the first init run).
   *
   * If the control currently holds a value that is not present in the new
   * items list, three things happen:
   *
   *  1. The internal value, model signal, and CVA form control are all set
   *     to null — the form sees the field as empty immediately.
   *  2. selectedItemChange is emitted with value=null so parent handlers
   *     (e.g. countryChange, stateChange) that listen to that output also
   *     learn about the clear and can cascade their own downstream resets.
   *  3. _resetGeneration is bumped so the _handleAutoSelect call that
   *     immediately follows in the items effect is suppressed — otherwise
   *     a single-item new list would be auto-selected right after we
   *     cleared, fighting the reset.
   *
   * Returns true when a clear was performed so the caller can decide
   * whether to skip further processing (currently unused but kept for
   * future flexibility).
   */
  private _clearIfNotInSource(items: any[]): boolean {
    const current = this._value();
    if (current === null || current === undefined) return false; // already clear

    const real = items.filter((i) => !i?.__sentinel__);

    // Determine whether the current value exists in the new list.
    const path = this.selectedValuePath();
    const exists = path
      ? real.some((item) => item[path] === current)
      : real.some((item) => item === current);

    if (exists) return false;

    // Bump generation so _handleAutoSelect is suppressed for this cycle.
    // Without this, a single-item replacement list would be auto-selected
    // immediately after clearing, undoing the reset.
    this._resetGeneration++;

    // Clear internal state.
    this._value.set(null);
    this.selectedValue.set(null);

    // Clear the adapter visual — show placeholder / empty state.
    this._adapter.setValue(null);

    // Route both CVA and selectedItemChange through the coalescing queue.
    // This null will be overwritten if _handleAutoSelect subsequently selects
    // a value in the same synchronous burst — only the final value is delivered.
    this._scheduleEmit(null);

    return true;
  }

  private _handleAutoSelect(items: any[], scheduledGeneration: number): void {
    // Skip auto-select if a reset has occurred since this call was scheduled.
    // _resetGeneration is incremented by writeValue(null); if it has advanced
    // beyond the generation captured when this call was queued, a reset happened
    // in between and we must not re-select — that would undo the reset.
    if (this._resetGeneration !== scheduledGeneration) return;
    // Never auto-select if a value is already set
    if (this._value() !== null && this._value() !== undefined) return;

    const real = items.filter((i) => !i?.__sentinel__);
    if (real.length === 0) return;

    let target: any = null;

    if (this.autoSelectFirst()) {
      // Select the first real item regardless of list size
      target = real[0];
    } else if (this.autoSelectSingle() && real.length === 1) {
      // Select only when exactly one real item exists
      target = real[0];
    }

    if (!target) return;

    const value = this.selectedValuePath() ? target[this.selectedValuePath()] : target;
    // Update signals immediately so adapter and UI are in sync.
    this._value.set(value);
    this.selectedValue.set(value);
    this._adapter.setValue(value);
    // Schedule emission so auto-select is coalesced with any preceding clear
    // from _clearIfNotInSource — parent gets one final event, not null then value.
    this._scheduleEmit(value, {
      value,
      item: target,
      index: -1, // index in the raw list is unknown here without a full lookup
      text: this.displayMemberPath()
        ? (target[this.displayMemberPath()] ?? '')
        : String(target ?? ''),
    });
  }

  private _onAdapterValueChange(event: DropdownChangeEvent): void {
    if (event.item?.__sentinel__) {
      // Sentinel selection = user explicitly cleared — treat as null.
      this._value.set(null);
      this.selectedValue.set(null);
      this._scheduleEmit(null);
      return;
    }
    this._value.set(event.value);
    this.selectedValue.set(event.value);
    this.isDirty.set(true);
    // Pass the real adapter event so selectedItemChange carries item/text/index.
    this._scheduleEmit(event.value, event);
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

  /**
   * Internal value setter used only by the public clear() method.
   * All other write paths (adapter change, auto-select, source-driven clear)
   * set _value / selectedValue directly and call _scheduleEmit explicitly,
   * so the full coalescing flow applies to them individually.
   */
  private _setValue(value: any): void {
    this._value.set(value);
    this.selectedValue.set(value);
    this._scheduleEmit(value);
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
