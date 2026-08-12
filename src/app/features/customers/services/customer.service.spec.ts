import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { environment } from '@environments/environment';
import { apiErrorInterceptor } from '@core/interceptors/api-error.interceptor';
import { CustomerService } from '@features/customers/services/customer.service';
import { createEmptyCustomerQuery } from '@features/customers/models/customer-query.model';

const READ_URL = `${environment.api.baseUrl}${environment.api.endpoints.readAllCrmClients}`;
const SAVE_URL = `${environment.api.baseUrl}${environment.api.endpoints.saveCustomerWithContactPerson}`;

describe('CustomerService', () => {
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

  it('GETs ReadAllCRMClients with the verified query parameters', () => {
    service.fetchCustomers({ ...createEmptyCustomerQuery(), search: 'salma' }).subscribe();

    const request = http.expectOne(
      (req) => req.method === 'GET' && req.url === `${READ_URL}`,
    );
    expect(request.request.params.get('Text')).toBe('salma');
    expect(request.request.params.get('Direction')).toBe('ltr');
    expect(request.request.params.get('InCT')).toBe('');

    request.flush({ Data: [{ Id: 1, Name: 'Acme' }], Total: 14104 });
  });

  it('normalizes the real {Data, Total} response into typed records', () => {
    let records: { records: { id: number }[]; total: number } | undefined;
    service
      .fetchCustomers(createEmptyCustomerQuery())
      .subscribe((result) => (records = result));

    const request = http.expectOne(`${READ_URL}`);
    request.flush({
      Data: [
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
      Total: 1,
    });

    expect(records?.total).toBe(1);
    expect(records?.records[0].id).toBe(18811);
    expect(records?.records[0].country).toBe('United Arab Emirates');
    expect(records?.records[0].accountTypeId).toBeNull();
  });

  it('composes free-text filter terms into the server Text parameter', () => {
    service
      .fetchCustomers({
        ...createEmptyCustomerQuery(),
        search: 'acme',
        textFilters: { name: 'acme co', code: 'C-1' },
      })
      .subscribe();

    const request = http.expectOne(`${READ_URL}`);
    expect(request.request.params.get('Text')).toBe('acme name:acme co code:C-1');
  });

  it('POSTs the Save payload and maps the {Result, ErrorMessage} response', () => {
    let saved: { success: boolean; id: number | null } | undefined;
    service
      .saveCustomer({
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
      })
      .subscribe((result) => (saved = result));

    const request = http.expectOne((req) => req.method === 'POST' && req.url === SAVE_URL);
    expect(request.request.params.get('InCT')).toBe('');
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

    http.expectOne(`${READ_URL}`).flush(null, {
      status: 401,
      statusText: 'Unauthorized',
    });

    expect(thrown?.message).toContain('not authorized');
  });
});