import { InjectionToken } from '@angular/core';

// ─── Core event payload ───────────────────────────────────────────────────────

export interface DropdownChangeEvent {
  value: any;
  item: any;
  index: number;
  text: string;
}

// ─── Adapter initialisation options ──────────────────────────────────────────

export interface DropdownAdapterOptions {
  /** Native element to attach the dropdown control to */
  hostElement: HTMLElement;

  /** Items to display in the dropdown list */
  itemsSource: any[];

  /** Object property to show as display text */
  displayMemberPath: string;

  /** Object property to use as the bound value */
  selectedValuePath: string;

  /** Allow the user to type free text */
  isEditable: boolean;

  /** Show the dropdown toggle chevron */
  showDropDownButton: boolean;

  /** Maximum height (px) of the dropdown popup */
  maxDropDownHeight: number;

  /** Extra CSS class applied to the popup overlay */
  dropDownCssClass: string;

  /** Placeholder shown when no value is selected */
  placeholder: string;

  /** Animate the dropdown open/close transition */
  isAnimated: boolean;

  /** Whether typeahead search is case-sensitive */
  caseSensitiveSearch: boolean;

  /** Auto-expand the input text on focus */
  autoExpandSelection: boolean;

  /** Optional header text rendered at the top of the popup */
  header: string;

  /** Disable user interaction */
  isDisabled: boolean;

  /** Make the input read-only */
  isReadOnly: boolean;

  /**
   * When true, the adapter should show an empty/placeholder option.
   * - Wijmo: uses native placeholder (no extra item in the list)
   * - Material: prepends a sentinel <mat-option> with selectLabel text
   */
  showSelect: boolean;

  /** Text for the empty sentinel option / Wijmo placeholder */
  selectLabel: string;

  // ─── Callbacks from wrapper → adapter ──────────────────────────────────────

  /** Called whenever the selected value changes */
  onValueChange: (event: DropdownChangeEvent) => void;

  /** Called when the input gains focus */
  onFocus: () => void;

  /** Called when the input loses focus */
  onBlur: () => void;

  /** Called when the dropdown popup opens or closes */
  onDroppedDownChange: (isOpen: boolean) => void;

  /** Called on every keystroke in the input */
  onTextChange: (text: string) => void;

  /** Called when the items source is replaced on the underlying control */
  onItemsSourceChange: (items: any[]) => void;
}

// ─── Adapter interface ────────────────────────────────────────────────────────

/**
 * Every dropdown library integration must implement this interface.
 * The wrapper component only depends on this contract — never on a
 * specific library like Wijmo or Material.
 */
export interface DropdownAdapter<TControl = unknown> {
  /** Initialise the underlying control and attach it to `hostElement`. */
  init(options: DropdownAdapterOptions): void;

  /** Return the currently selected value. */
  getValue(): any;

  /** Set the selected value programmatically. */
  setValue(value: any): void;

  /** Replace the items array on the underlying control. */
  setItemsSource(items: any[]): void;

  /** Enable or disable the control. */
  setDisabled(isDisabled: boolean): void;

  /** Set the control read-only state. */
  setReadOnly(isReadOnly: boolean): void;

  /** Open the dropdown popup. */
  open(): void;

  /** Close the dropdown popup. */
  close(): void;

  /** Toggle the dropdown popup. */
  toggle(): void;

  /** Focus the underlying input element. */
  focus(): void;

  /** Clear the selection and input text. */
  clear(): void;

  /** Refresh / re-filter the items list. */
  refresh(): void;

  /** Return the raw underlying control instance for advanced usage. */
  getControlInstance(): TControl | null;

  /** Tear down event listeners, dispose internal objects, remove DOM nodes. */
  destroy(): void;
}

// ─── Injection tokens ─────────────────────────────────────────────────────────

/**
 * Token for the adapter CLASS (constructor).
 *
 * Override this in a module or component to switch the adapter implementation.
 * A new instance is created per component via Angular's injector, so every
 * dropdown gets its own independent adapter — no shared-singleton problem.
 *
 * @example
 * // Whole module uses Material:
 * { provide: DROPDOWN_ADAPTER_CLASS, useValue: MaterialDropdownAdapter }
 *
 * // Single component override:
 * @Component({ providers: [{ provide: DROPDOWN_ADAPTER_CLASS, useValue: MyAdapter }] })
 */
export const DROPDOWN_ADAPTER_CLASS = new InjectionToken<new (...args: any[]) => DropdownAdapter>(
  'DropdownAdapterClass',
);

/**
 * Token for the adapter INSTANCE resolved per component.
 * Override DROPDOWN_ADAPTER_CLASS, not this token.
 */
export const DROPDOWN_ADAPTER = new InjectionToken<DropdownAdapter>('DropdownAdapter');
