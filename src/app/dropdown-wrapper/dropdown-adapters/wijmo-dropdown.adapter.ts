import {
  Injectable,
  ApplicationRef,
  createComponent,
  EnvironmentInjector,
  inject,
  ComponentRef,
} from '@angular/core';
import * as wjcCore from '@mescius/wijmo';
import * as WjInputModule from '@mescius/wijmo.angular2.input';
import { DropdownAdapter, DropdownAdapterOptions } from './dropdown-adapter.interface';

/**
 * Wijmo ComboBox adapter using the Angular WjComboBox component.
 *
 * Creates a WjComboBox component instance dynamically via createComponent(),
 * attaches it to the host element provided by DropdownWrapperComponent, and
 * bridges its inputs/outputs to the DropdownAdapter contract.
 */
@Injectable()
export class WijmoDropdownAdapter implements DropdownAdapter<WjInputModule.WjComboBox> {
  private readonly _appRef = inject(ApplicationRef);
  private readonly _envInjector = inject(EnvironmentInjector);

  private _compRef: ComponentRef<WjInputModule.WjComboBox> | null = null;
  private _opts: DropdownAdapterOptions | null = null;

  private get _wj(): WjInputModule.WjComboBox | null {
    return this._compRef?.instance ?? null;
  }

  private get _combo(): any {
    return this._wj ?? null;
  }

  // ─── DropdownAdapter.init ─────────────────────────────────────────────────

  init(options: DropdownAdapterOptions): void {
    this._opts = options;

    this._compRef = createComponent(WjInputModule.WjComboBox, {
      environmentInjector: this._envInjector,
    });

    const wj = this._compRef.instance;
    const cdr = this._compRef.changeDetectorRef;

    wj.itemsSource = options.itemsSource;
    wj.displayMemberPath = options.displayMemberPath;
    wj.selectedValuePath = options.selectedValuePath;
    wj.isEditable = options.isEditable;
    wj.showDropDownButton = options.showDropDownButton;
    wj.maxDropDownHeight = options.maxDropDownHeight;
    wj.dropDownCssClass = options.dropDownCssClass;
    wj.placeholder = options.placeholder;
    wj.isAnimated = options.isAnimated;
    wj.caseSensitiveSearch = options.caseSensitiveSearch;
    wj.autoExpandSelection = options.autoExpandSelection;
    wj.isDisabled = options.isDisabled;
    wj.isReadOnly = options.isReadOnly;

    this._appRef.attachView(this._compRef.hostView);

    const domNode = (this._compRef.hostView as any).rootNodes[0] as HTMLElement;
    options.hostElement.appendChild(domNode);

    cdr.detectChanges();

    // Forward aria attributes onto the Wijmo input element directly.
    // The outer wrapper div's ARIA is not inherited by the inner focusable input,
    // so we must set them here after the DOM node exists.
    const inputEl = domNode.querySelector('input') as HTMLInputElement | null;
    if (inputEl) {
      if (options.ariaLabel) inputEl.setAttribute('aria-label', options.ariaLabel);
      if (options.required) inputEl.setAttribute('aria-required', 'true');
      // Wijmo renders placeholder natively — it already serves as the aria-placeholder.
      // Explicitly wire aria-placeholder so AT announces it in placeholder state.
      if (options.placeholder) inputEl.setAttribute('aria-placeholder', options.placeholder);
    }

    const combo = this._combo;

    combo.selectedIndexChanged.addHandler(() => {
      options.onValueChange({
        value: combo.selectedValue,
        item: combo.selectedItem,
        index: combo.selectedIndex,
        text: combo.text ?? '',
      });
    });

    combo.isDroppedDownChanged.addHandler(() => {
      options.onDroppedDownChange(combo.isDroppedDown);
    });

    combo.textChanged.addHandler(() => {
      options.onTextChange(combo.text ?? '');
    });

    combo.gotFocus.addHandler(() => options.onFocus());
    combo.lostFocus.addHandler(() => options.onBlur());

    combo.itemsSourceChanged.addHandler(() => {
      options.onItemsSourceChange(combo.itemsSource as any[]);
    });
  }

  getValue(): any {
    return this._combo?.selectedValue ?? null;
  }

  setValue(value: any): void {
    const combo = this._combo;
    if (!combo) return;
    if (value === null || value === undefined || value === '') {
      // Set selectedIndex first so Wijmo stops tracking the old item,
      // then null selectedValue so the internal CollectionView does not
      // restore the stale selection when itemsSource is next reassigned,
      // then blank the visible text so the placeholder shows.
      combo.selectedIndex = -1;
      combo.selectedValue = null;
      combo.text = '';
    } else {
      combo.selectedValue = value;
    }
    this._compRef?.changeDetectorRef.detectChanges();
  }

  setItemsSource(items: any[]): void {
    const wj = this._wj;
    if (!wj) return;

    // Store current logical value before Wijmo rebuilds its collectionView.
    // After itemsSource is replaced, Wijmo tries to restore the previous
    // selectedValue by searching the new list. If that value is no longer
    // present (e.g. after reset or cascade clear) Wijmo may either leave a
    // stale text in the input or silently re-select a match from the old
    // selection model. Re-applying the value we hold after the assignment
    // ensures Wijmo's state is always consistent with ours.
    const currentValue = this._combo?.selectedValue ?? null;

    wj.itemsSource = items;
    this._compRef?.changeDetectorRef.detectChanges();

    // Re-apply: if we hold null, force a full clear so placeholder shows.
    // If we hold a value, let Wijmo find it in the new list (or leave -1 if absent).
    this.setValue(currentValue);
  }

  setDisabled(isDisabled: boolean): void {
    const wj = this._wj;
    if (wj) {
      wj.isDisabled = isDisabled;
      this._compRef?.changeDetectorRef.detectChanges();
    }
  }

  setReadOnly(isReadOnly: boolean): void {
    const wj = this._wj;
    if (wj) {
      wj.isReadOnly = isReadOnly;
      this._compRef?.changeDetectorRef.detectChanges();
    }
  }

  open(): void {
    const combo = this._combo;
    if (combo) combo.isDroppedDown = true;
  }

  close(): void {
    const combo = this._combo;
    if (combo) combo.isDroppedDown = false;
  }

  toggle(): void {
    const combo = this._combo;
    if (combo) combo.isDroppedDown = !combo.isDroppedDown;
  }

  focus(): void {
    this._combo?.focus();
  }

  clear(): void {
    const combo = this._combo;
    if (combo) {
      combo.selectedIndex = -1;
      combo.selectedValue = null;
      combo.text = '';
      this._compRef?.changeDetectorRef.detectChanges();
    }
  }

  refresh(): void {
    (this._combo?.collectionView as wjcCore.CollectionView | null)?.refresh();
  }

  getControlInstance(): WjInputModule.WjComboBox | null {
    return this._wj;
  }

  destroy(): void {
    if (this._compRef) {
      this._appRef.detachView(this._compRef.hostView);
      this._compRef.destroy();
      this._compRef = null;
    }
    this._opts = null;
  }
}
