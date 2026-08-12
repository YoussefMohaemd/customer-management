import { Routes } from '@angular/router';

import { MainLayoutComponent } from '@core/layout/main-layout.component';

export const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'customers',
      },
      {
        path: 'customers',
        loadComponent: () =>
          import('@features/customers/components/customer-page/customer-page.component').then(
            (m) => m.CustomerPageComponent,
          ),
      },
      {
        path: '**',
        redirectTo: 'customers',
      },
    ],
  },
];
