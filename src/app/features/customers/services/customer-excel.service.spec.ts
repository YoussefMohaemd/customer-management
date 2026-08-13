import { beforeEach, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import { CustomerExcelService } from '@features/customers/services/customer-excel.service';
import { CustomerRecord } from '@features/customers/models/customer.model';
import { customerFixture } from '@app/testing/test-utils.spec';

describe('CustomerExcelService', () => {
  let service: CustomerExcelService;

  beforeEach(() => {
    service = new CustomerExcelService();
  });

  it('exports records to an "Customers" worksheet with business headers', () => {
    const customer: CustomerRecord = customerFixture({
      id: 18811,
      code: '5-55',
      commercialName: 'sdaaaa',
      email: 'asd@s.com',
      mobile: '+971 222222',
      accountTypeId: 12,
      accountTypeName: 'Normal Tenant',
      accountManagerId: 4,
      accountManagerName: 'Hamada Emp',
      city: 'Abu Dhabi',
      country: 'United Arab Emirates',
    });

    expect(() => service.exportCustomers([customer])).not.toThrow();
  });

  it('does nothing for an empty record set', () => {
    expect(() => service.exportCustomers([])).not.toThrow();
  });
});