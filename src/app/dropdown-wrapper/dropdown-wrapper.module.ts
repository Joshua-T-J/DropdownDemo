import { ModuleWithProviders, NgModule } from '@angular/core';
import { DropdownWrapperComponent } from './dropdown-wrapper.component';
import { DROPDOWN_ADAPTER_CLASS } from './dropdown-adapters/dropdown-adapter.interface';
import { WijmoDropdownAdapter } from './dropdown-adapters/wijmo-dropdown.adapter';
import { MaterialDropdownAdapter } from './dropdown-adapters/material-dropdown.adapter';

/**
 * DropdownWrapperModule
 *
 * ─── How per-instance adapters work ──────────────────────────────────────────
 *
 * The component constructor reads DROPDOWN_ADAPTER_CLASS (the class reference)
 * from the injector tree, then creates a throwaway child EnvironmentInjector
 * with only that class registered — guaranteeing a fresh instance every time.
 *
 * This module only needs to provide the CLASS TOKEN, not the class itself as a
 * service. No singleton is registered, so every dropdown gets its own adapter.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *  Default (Wijmo):
 *    imports: [DropdownWrapperModule]
 *
 *  Whole module uses Material:
 *    imports: [DropdownWrapperModule.forMaterial()]
 *
 *  Custom adapter for whole module:
 *    imports: [DropdownWrapperModule.forAdapter(MyAdapter)]
 *
 *  Single component override:
 *    @Component({
 *      providers: [{ provide: DROPDOWN_ADAPTER_CLASS, useValue: MaterialDropdownAdapter }]
 *    })
 *    // No need to register MaterialDropdownAdapter itself — the component
 *    // creates a fresh child injector that handles construction.
 */
@NgModule({
  imports: [DropdownWrapperComponent],
  exports: [DropdownWrapperComponent],
  providers: [{ provide: DROPDOWN_ADAPTER_CLASS, useValue: WijmoDropdownAdapter }],
})
export class DropdownWrapperModule {
  static forMaterial(): ModuleWithProviders<DropdownWrapperModule> {
    return {
      ngModule: DropdownWrapperModule,
      providers: [{ provide: DROPDOWN_ADAPTER_CLASS, useValue: MaterialDropdownAdapter }],
    };
  }

  static forAdapter(
    adapterClass: new (...args: any[]) => any,
  ): ModuleWithProviders<DropdownWrapperModule> {
    return {
      ngModule: DropdownWrapperModule,
      providers: [{ provide: DROPDOWN_ADAPTER_CLASS, useValue: adapterClass }],
    };
  }
}
