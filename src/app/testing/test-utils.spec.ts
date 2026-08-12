/**
 * Shared test configuration and fixtures.
 *
 * This file intentionally ends in `.spec.ts` so it is excluded from the
 * application build (tsconfig.app excludes `src/**\/*.spec.ts`) while still
 * being compiled by the unit-test runner.
 */
import { Provider } from '@angular/core';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { ConfirmationService, MessageService } from 'primeng/api';

import { CustomerRecord } from '@features/customers/models/customer.model';

/** Provider set shared by every component spec (PrimeNG theme + toasts). */
export function provideTestConfig(): Provider[] {
  return [
    provideHttpClientTesting(),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: { darkModeSelector: false },
      },
      ripple: false,
    }),
    MessageService,
    ConfirmationService,
  ];
}

let nextFixtureId = 1;

/** Factory producing realistic customer records for tests. */
export function customerFixture(overrides: Partial<CustomerRecord> = {}): CustomerRecord {
  const id = overrides.id ?? nextFixtureId++;
  return {
    id,
    code: `CUST-${String(id).padStart(3, '0')}`,
    commercialName: `Customer ${id}`,
    nameEn: '',
    nameAr: '',
    mobile: '+20 100 000 0000',
    phone: '',
    phone2: '',
    fax: '',
    email: `customer${id}@example.com`,
    website: '',
    jobTitle: '',
    address: '',
    city: 'Cairo',
    cityId: 1,
    country: 'Egypt',
    countryId: 2,
    accountTypeId: 12,
    accountTypeName: 'Normal Tenant',
    clientType: 'Client',
    accountManagerId: 4,
    accountManagerName: 'Hamada Emp',
    classificationId: 34,
    classificationName: 'Indirect',
    businessFieldId: 13,
    businessFieldName: 'Hotel',
    regionName: 'The Arabian Gulf',
    birthDate: null,
    registrationDate: null,
    createdDate: null,
    status: null,
    gender: null,
    comment: '',
    taxFileNumber: '',
    commercialRegistrationNumber: '',
    vatRegistrationNumber: '',
    ...overrides,
  };
}