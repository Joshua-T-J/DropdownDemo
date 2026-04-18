import { NgModule } from '@angular/core';
import { DropdownWrapperComponent } from './dropdown-wrapper.component';
import { DROPDOWN_ADAPTER } from './dropdown-adapters/dropdown-adapter.interface';
import { WijmoDropdownAdapter } from './dropdown-adapters/wijmo-dropdown.adapter';

@NgModule({
  imports: [DropdownWrapperComponent],
  exports: [DropdownWrapperComponent],
  providers: [
    // Default adapter — override per-module or per-component as needed
    { provide: DROPDOWN_ADAPTER, useClass: WijmoDropdownAdapter },
  ],
})
export class DropdownWrapperModule {}
