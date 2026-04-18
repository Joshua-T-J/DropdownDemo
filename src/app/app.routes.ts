import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./form/form').then((m) => m.Form) },
];
