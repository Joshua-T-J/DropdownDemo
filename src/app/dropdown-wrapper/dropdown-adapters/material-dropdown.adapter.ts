/**
 * MaterialDropdownAdapter — full implementation.
 *
 * Provide via: { provide: DROPDOWN_ADAPTER, useClass: MaterialDropdownAdapter }
 */

import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  EnvironmentInjector,
  Injectable,
  createComponent,
  inject,
  viewChild,
} from '@angular/core';
import { DropdownAdapter, DropdownAdapterOptions } from './dropdown-adapter.interface';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-material-dropdown-adapter-host',
  standalone: true,
  imports: [MatFormFieldModule, MatSelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-form-field style="width: 100%;">
      <mat-select
        #matSelect
        [placeholder]="placeholder"
        [disabled]="disabled"
        [panelClass]="panelClass"
        [value]="value">
        @for (item of items; track $index) {
          <mat-option [value]="resolveValue(item)">
            {{ resolveText(item) }}
          </mat-option>
        }
      </mat-select>
    </mat-form-field>
  `,
})
class MaterialDropdownAdapterHostComponent {
  matSelect = viewChild.required<MatSelect>('matSelect');

  items: any[] = [];
  displayMemberPath = '';
  selectedValuePath = '';
  placeholder = '';
  panelClass = '';
  disabled = false;
  value: any = null;

  resolveText(item: any): string {
    if (!this.displayMemberPath) return `${item ?? ''}`;
    return `${item?.[this.displayMemberPath] ?? ''}`;
  }

  resolveValue(item: any): any {
    if (!this.selectedValuePath) return item;
    return item?.[this.selectedValuePath];
  }
}

@Injectable()
export class MaterialDropdownAdapter implements DropdownAdapter<MatSelect> {
  private readonly _appRef = inject(ApplicationRef);
  private readonly _environmentInjector = inject(EnvironmentInjector);

  private _hostEl: HTMLElement | null = null;
  private _value: any = null;
  private _opts: DropdownAdapterOptions | null = null;
  private _componentRef: ComponentRef<MaterialDropdownAdapterHostComponent> | null = null;
  private _matSelect: MatSelect | null = null;
  private _destroy$ = new Subject<void>();
  private _removeFocusListener: (() => void) | null = null;
  private _removeBlurListener: (() => void) | null = null;

  init(options: DropdownAdapterOptions): void {
    this._opts = options;
    this._hostEl = options.hostElement;
    this._destroy$.complete();
    this._destroy$ = new Subject<void>();

    const componentRef = createComponent(MaterialDropdownAdapterHostComponent, {
      environmentInjector: this._environmentInjector,
    });

    componentRef.instance.items = options.itemsSource ?? [];
    componentRef.instance.displayMemberPath = options.displayMemberPath;
    componentRef.instance.selectedValuePath = options.selectedValuePath;
    componentRef.instance.placeholder = options.placeholder;
    componentRef.instance.panelClass = options.dropDownCssClass;
    componentRef.instance.disabled = options.isDisabled || options.isReadOnly;
    componentRef.instance.value = this._value;

    this._appRef.attachView(componentRef.hostView);
    this._hostEl.replaceChildren(componentRef.location.nativeElement);
    componentRef.changeDetectorRef.detectChanges();

    this._componentRef = componentRef;
    this._matSelect = componentRef.instance.matSelect();

    this._matSelect.selectionChange
      .pipe(takeUntil(this._destroy$))
      .subscribe((event) => {
        const selectedItem =
          options.itemsSource?.find(
            (item, index) =>
              componentRef.instance.resolveValue(item) === event.value &&
              index === event.source.options.toArray().findIndex((o) => o.value === event.value)
          ) ??
          options.itemsSource?.find((item) => componentRef.instance.resolveValue(item) === event.value) ??
          null;

        this._value = event.value;
        options.onValueChange({
          value: event.value,
          item: selectedItem,
          index: options.itemsSource?.indexOf(selectedItem) ?? -1,
          text: selectedItem != null ? componentRef.instance.resolveText(selectedItem) : '',
        });
      });

    this._matSelect.openedChange
      .pipe(takeUntil(this._destroy$))
      .subscribe((isOpen) => options.onDroppedDownChange(isOpen));

    this._removeFocusListener = this._bindHostEvent('focus', () => options.onFocus());
    this._removeBlurListener = this._bindHostEvent('blur', () => options.onBlur());
  }

  getValue(): any { return this._value; }

  setValue(value: any): void {
    this._value = value;
    if (this._componentRef) {
      this._componentRef.instance.value = value;
      this._componentRef.changeDetectorRef.detectChanges();
    }
    if (this._matSelect) {
      this._matSelect.value = value;
    }
  }

  setItemsSource(items: any[]): void {
    if (this._componentRef) {
      this._componentRef.instance.items = items;
      this._componentRef.changeDetectorRef.detectChanges();
    }
  }

  setDisabled(isDisabled: boolean): void {
    if (this._componentRef) {
      this._componentRef.instance.disabled = isDisabled;
      this._componentRef.changeDetectorRef.detectChanges();
    }
    if (this._matSelect) {
      this._matSelect.disabled = isDisabled;
    }
  }

  setReadOnly(isReadOnly: boolean): void {
    this.setDisabled(isReadOnly);
    if (this._componentRef?.location?.nativeElement) {
      this._componentRef.location.nativeElement.style.pointerEvents = isReadOnly ? 'none' : '';
    }
  }

  open(): void { this._matSelect?.open(); }
  close(): void { this._matSelect?.close(); }
  toggle(): void { this._matSelect?.toggle(); }

  focus(): void {
    if (this._matSelect) {
      this._matSelect.focus();
    } else {
      const el = this._componentRef?.location.nativeElement.querySelector('mat-select');
      el?.focus();
    }
  }

  clear(): void {
    this._value = null;
    if (this._componentRef) {
      this._componentRef.instance.value = null;
      this._componentRef.changeDetectorRef.detectChanges();
    }
    if (this._matSelect) {
      this._matSelect.value = null;
    }
  }

  refresh(): void {
    this._componentRef?.changeDetectorRef.detectChanges();
  }

  getControlInstance(): MatSelect | null {
    return this._matSelect;
  }

  destroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    this._removeFocusListener?.();
    this._removeBlurListener?.();
    if (this._componentRef) {
      this._appRef.detachView(this._componentRef.hostView);
      this._componentRef.destroy();
    }
    this._componentRef = null;
    this._matSelect = null;
    this._removeFocusListener = null;
    this._removeBlurListener = null;
    this._hostEl = null;
    this._opts = null;
  }

  private _bindHostEvent(eventName: 'focus' | 'blur', handler: () => void): () => void {
    if (!this._hostEl) return () => undefined;
    this._hostEl.addEventListener(eventName, handler, true);
    return () => this._hostEl?.removeEventListener(eventName, handler, true);
  }
}
