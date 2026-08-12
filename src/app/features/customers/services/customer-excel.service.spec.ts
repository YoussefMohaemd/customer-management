import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';

import { CustomerExcelService } from '@features/customers/services/customer-excel.service';
import { CustomerRecord } from '@features/customers/models/customer.model';
import { customerFixture } from '@app/testing/test-utils.spec';

describe('CustomerExcelService', () => {
  let service: CustomerExcelService;

  beforeEach(() => {
    service = new CustomerExcelService();
    vi.restoreAllMocks();
  });

  it('exports records to an "Customers" worksheet with business headers', () => {
    const writeFileSpy = vi.spyOn(XLSX, 'writeFile').mockImplementation(() => undefined);
    const sheetSpy = vi.spyOn(XLSX.utils, 'json_to_sheet');

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

    service.exportCustomers([customer]);

    expect(writeFileSpy).toHaveBeenCalledOnce();
    expect(sheetSpy).toHaveBeenCalledOnce();

    const rows = sheetSpy.mock.calls[0][0] as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      ID: 18811,
      Code: '5-55',
      Name: 'sdaaaa',
      Email: 'asd@s.com',
      Mobile: '+971 222222',
      'Client Type': 12,
      'Account Manager': 4,
      City: 'Abu Dhabi',
      Country: 'United Arab Emirates',
    });

    const filename = writeFileSpy.mock.calls[0][1] as string;
    expect(filename).toMatch(/^customers_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });

  it('does nothing for an empty record set', () => {
    const writeFileSpy = vi.spyOn(XLSX, 'writeFile').mockImplementation(() => undefined);

    service.exportCustomers([]);

    expect(writeFileSpy).not.toHaveBeenCalled();
  });
});