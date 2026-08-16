import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { environment } from '@environments/environment';
import { apiErrorInterceptor } from '@core/interceptors/api-error.interceptor';
import { CustomerService } from '@features/customers/services/customer.service';
import { CustomerListResult } from '@features/customers/models/customer.model';
import {
  CustomerLookups,
  createEmptyCustomerQuery,
} from '@features/customers/models/customer-query.model';

const READ_URL = `${environment.api.bffBaseUrl}${environment.api.bff.customers}`;
const EXPORT_URL = `${environment.api.bffBaseUrl}${environment.api.bff.exportCustomers}`;
const LOOKUPS_URL = `${environment.api.bffBaseUrl}${environment.api.bff.lookups}`;
const SAVE_URL = `${environment.api.bffBaseUrl}${environment.api.bff.saveCustomer}`;

describe('CustomerService (BFF contract)', () => {
  let service: CustomerService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(CustomerService);
    http = TestBed.inject(HttpTestingController);
  });

  it('GETs ONLY the requested page from the BFF with the full table state', () => {
    service
      .fetchCustomers({
        ...createEmptyCustomerQuery(),
        search: 'salma',
        page: 2,
        pageSize: 10,
        sortField: 'accountManagerName',
        sortDirection: 'desc',
      })
      .subscribe();

    const request = http.expectOne((req) => req.method === 'GET' && req.url === READ_URL);
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('10');
    expect(request.request.params.get('search')).toBe('salma');
    expect(request.request.params.get('sortField')).toBe('AccountManagerName');
    expect(request.request.params.get('sortDirection')).toBe('desc');
    // No pagination-inventing extra params — this IS the BFF pagination contract.
    request.flush({ data: [{ Id: 1, Name: 'Acme' }], totalCount: 14111 });
  });

  it('sends categorical filter ids and text filters as part of the query', () => {
    service
      .fetchCustomers({
        ...createEmptyCustomerQuery(),
        page: 1,
        pageSize: 5,
        textFilters: { name: 'acme', code: 'C-1' },
        textFilterOperators: { name: 'startsWith' },
        filters: { clientTypeId: 12, accountManagerId: 4, cityId: 7, countryId: 2 },
      })
      .subscribe();

    const request = http.expectOne((req) => req.url === READ_URL);
    expect(request.request.params.get('clientTypeId')).toBe('12');
    expect(request.request.params.get('accountManagerId')).toBe('4');
    expect(request.request.params.get('cityId')).toBe('7');
    expect(request.request.params.get('countryId')).toBe('2');
    expect(JSON.parse(request.request.params.get('textFilters')!)).toEqual({
      name: 'acme',
      code: 'C-1',
    });
    expect(JSON.parse(request.request.params.get('textOperators')!)).toEqual({
      name: 'startsWith',
    });
    request.flush({ data: [], totalCount: 0 });
  });

  it('normalizes the {data, totalCount} response into typed records', () => {
    let records: CustomerListResult | undefined;
    service.fetchCustomers(createEmptyCustomerQuery()).subscribe((result) => (records = result));

    const request = http.expectOne((req) => req.url === READ_URL);
    request.flush({
      data: [
        {
          Id: 18811,
          Code: '5-55',
          CommercialName: 'sdaaaa',
          Country: '',
          CountryName: 'United Arab Emirates',
          AccountManagerName: 'Hamada Emp',
          AccountTypeId: 0,
        },
      ],
      totalCount: 1,
    });

    expect(records?.total).toBe(1);
    expect(records?.records[0].id).toBe(18811);
    expect(records?.records[0].country).toBe('United Arab Emirates');
    expect(records?.records[0].accountTypeId).toBeNull();
  });

  it('fetchCustomersForExport omits pagination and returns all matching records', () => {
    let records: CustomerListResult['records'] | undefined;
    service
      .fetchCustomersForExport({ ...createEmptyCustomerQuery(), search: 'ahmed' })
      .subscribe((result) => (records = result));

    const request = http.expectOne((req) => req.url === EXPORT_URL);
    expect(request.request.params.get('page')).toBeNull();
    expect(request.request.params.get('pageSize')).toBeNull();
    expect(request.request.params.get('search')).toBe('ahmed');
    request.flush({ data: [{ Id: 1, CommercialName: 'Ahmed Co' }], totalCount: 14111 });

    expect(records?.length).toBe(1);
    expect(records?.[0].commercialName).toBe('Ahmed Co');
  });

  it('loads distinct filter options from the lookups endpoint', () => {
    let lookups: CustomerLookups | undefined;
    service.fetchLookups().subscribe((result) => (lookups = result));

    const request = http.expectOne((req) => req.url === LOOKUPS_URL);
    request.flush({
      clientTypes: [{ value: 12, label: 'Normal Tenant' }],
      accountManagers: [{ value: 4, label: 'Hamada Emp' }],
      cities: [],
      countries: [{ value: 2, label: 'Egypt' }],
    });

    expect(lookups?.clientTypes).toEqual([{ value: 12, label: 'Normal Tenant' }]);
    expect(lookups?.accountManagers).toEqual([{ value: 4, label: 'Hamada Emp' }]);
    expect(lookups?.countries).toEqual([{ value: 2, label: 'Egypt' }]);
  });

  it('POSTs the Save payload through the BFF and maps the {Result, ErrorMessage} response', () => {
    let saved: { success: boolean; id: number | null } | undefined;
    service.saveCustomer(createPayloadFixture()).subscribe((result) => (saved = result));

    const request = http.expectOne((req) => req.method === 'POST' && req.url === SAVE_URL);
    request.flush({
      Result: true,
      ErrorMessage: 'Saved Successfully || Customer Code:NEW ,  Id : 200',
    });

    expect(saved?.success).toBe(true);
    expect(saved?.id).toBe(200);
  });

  it('surfaces HTTP failures as user-friendly ApiError through the interceptor', () => {
    let thrown: Error | undefined;
    service.fetchCustomers(createEmptyCustomerQuery()).subscribe({
      error: (error: unknown) => (thrown = error as Error),
    });

    http
      .expectOne((req) => req.url === READ_URL)
      .flush(null, {
        status: 401,
        statusText: 'Unauthorized',
      });

    expect(thrown?.message).toContain('not authorized');
  });
});

function createPayloadFixture() {
  return {
    Id: 0,
    CommercialName: 'New',
    Code: '',
    Mobile: '',
    Phone: '',
    Name: '',
    JobTitle: '',
    Message: '',
    CommericialName: '',
    ProjectId: 0,
    UnitId: 0,
    Religion: '',
    InvitedEmployeesIds: '',
    NameAR: '',
    NameEN: '',
    Phone2: '',
    Fax: '',
    Email: '',
    Website: '',
    Country: '',
    City: '',
    Address: '',
    KeyWords: '',
    Latitude: null,
    Longitude: null,
    EmpId: 0,
    AccountTypeId: null,
    AccountManagerId: null,
    ClassificationId: null,
    BusinessFieldId: null,
    PaymentProfile: null,
    SchoolName: '',
    NationalID: '',
    BirthDate: null,
    RegistrationDate: null,
    RelatedEmpId: null,
    Gender: null,
    Status: null,
    BranchId: null,
    RequestSourceId: null,
    TaxFileNumber: '',
    TaxRegistrationNumber: '',
    BrothersId: '',
    PreCodeId: null,
    Comment: '',
    Direction: '',
    ContNameAR: '',
    ContNameEN: '',
    ContAddress: '',
    ContMobile: '',
    ContEmail: '',
    ContLatitude: 0,
    ContLongitude: 0,
    ContPhone: '',
    CountryId: null,
    CityId: null,
    RegionId: null,
    PassportNo: '',
    DistrictAR: '',
    DistrictEN: '',
    StreetAR: '',
    StreetEN: '',
    MainClientId: null,
    BuildingNumber: '',
    PostalCode: '',
    VATRegistrationNumber: '',
    GroupVATRegistrationNumber: '',
    AccountNo: '',
    SwiftCode: '',
    PayeeBank: '',
    CommercialRegistrationNumber: '',
    OtherId: null,
    OtherData: '',
    LeadRequestTypeId: null,
    AdditionalAddressNumber: '',
    SubAccountId: null,
    LegalRepresentative: '',
    LegalCapacity: '',
    xmlContactPersonGrid: [],
    Attachment: [],
    ServerIP: '',
    InCT: '',
  };
}