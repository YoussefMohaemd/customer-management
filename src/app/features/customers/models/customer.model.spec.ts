import { describe, expect, it } from 'vitest';

import {
  normalizeCustomerList,
  normalizeCustomerRecord,
} from '@features/customers/models/customer.model';

/**
 * Two records captured verbatim from the real staging API response
 * (2026-08-12, `ReadAllCRMClients`). They prove the mapping layer handles
 * the *actual* payload shape, including `CountryName`/`CityName` display
 * fields and zero-valued reference ids.
 */
const REAL_API_RECORD_1: Record<string, unknown> = {
  Id: 18811,
  NameAR: 'dfg',
  NameEN: 'dfg',
  Name: 'dfg',
  CommercialName: 'sdaaaa',
  Code: '5-55',
  MobileWithPrefix: '+971 222222',
  PhoneWithPrefix: '+971 22222222',
  Mobile: '222222',
  Phone: '22222222',
  Fax: '',
  Email: 'asd@s.com',
  Website: '',
  Country: '',
  CountryName: 'United Arab Emirates',
  City: 'Abu Dhabi',
  CityName: 'Abu Dhabi',
  CountryId: 2799,
  CityId: 2779,
  RegionName: 'The Arabian Gulf',
  ClientType: 'Client',
  ClassificationId: 34,
  ClassificationNam: 'Indirect',
  AccountManagerId: 4,
  AccountManagerName: 'Hamada Emp',
  BusinessFieldName: 'Hotel',
  BusinessFieldId: 13,
  AccountTypeName: 'Normal Tenant',
  AccountTypeId: 12,
  CreatedDate: '2026-08-12T09:05:35.807',
};

const REAL_API_RECORD_2: Record<string, unknown> = {
  Id: 18810,
  NameAR: '',
  NameEN: 'salma',
  Name: 'salma',
  CommercialName: 'salmakhaled ',
  Code: '5-54',
  Mobile: '9182927826',
  Phone: '2727910',
  Email: 'salma283990@gmail.com',
  Country: '',
  CountryName: '',
  City: '',
  CityName: '',
  CountryId: 0,
  CityId: 0,
  ClassificationId: 1,
  ClassificationNam: '',
  AccountManagerId: 0,
  AccountManagerName: '',
  AccountTypeId: 0,
  AccountTypeName: '',
};

describe('normalizeCustomerRecord', () => {
  it('maps a real API record with display names', () => {
    const record = normalizeCustomerRecord(REAL_API_RECORD_1);

    expect(record).not.toBeNull();
    expect(record?.id).toBe(18811);
    expect(record?.code).toBe('5-55');
    expect(record?.commercialName).toBe('sdaaaa');
    expect(record?.email).toBe('asd@s.com');
    expect(record?.mobile).toBe('+971 222222');
    expect(record?.country).toBe('United Arab Emirates');
    expect(record?.countryId).toBe(2799);
    expect(record?.city).toBe('Abu Dhabi');
    expect(record?.cityId).toBe(2779);
    expect(record?.accountManagerName).toBe('Hamada Emp');
    expect(record?.accountManagerId).toBe(4);
    expect(record?.accountTypeName).toBe('Normal Tenant');
    expect(record?.accountTypeId).toBe(12);
    expect(record?.businessFieldName).toBe('Hotel');
    expect(record?.createdDate).toBe('2026-08-12');
  });

  it('treats zero-valued reference ids as null and keeps display fallbacks', () => {
    const record = normalizeCustomerRecord(REAL_API_RECORD_2);

    expect(record?.countryId).toBeNull();
    expect(record?.cityId).toBeNull();
    expect(record?.accountManagerId).toBeNull();
    expect(record?.accountTypeId).toBeNull();
    expect(record?.country).toBe('');
    expect(record?.city).toBe('');
    expect(record?.nameEn).toBe('salma');
  });

  it('returns null for non-object payloads', () => {
    expect(normalizeCustomerRecord(null)).toBeNull();
    expect(normalizeCustomerRecord(42)).toBeNull();
    expect(normalizeCustomerRecord('text')).toBeNull();
  });
});

describe('normalizeCustomerList', () => {
  it('extracts records and total from the verified {Data, Total} envelope', () => {
    const result = normalizeCustomerList({
      Data: [REAL_API_RECORD_1, REAL_API_RECORD_2],
      Total: 14104,
    });

    expect(result.total).toBe(14104);
    expect(result.records).toHaveLength(2);
    expect(result.records[0].id).toBe(18811);
    expect(result.records[1].id).toBe(18810);
  });

  it('accepts a top-level array', () => {
    const result = normalizeCustomerList([REAL_API_RECORD_1]);

    expect(result.records).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('digs into nested wrapper shapes (Result.Data and ASP.NET d envelopes)', () => {
    const nested = normalizeCustomerList({
      Result: { Data: [REAL_API_RECORD_1] },
    });
    expect(nested.records).toHaveLength(1);

    const aspnet = normalizeCustomerList({ d: [{ Id: 7, Name: 'legacy' }] });
    expect(aspnet.records).toHaveLength(1);
    expect(aspnet.records[0].id).toBe(7);
  });

  it('returns an empty result for garbage, null or unknown shapes', () => {
    expect(normalizeCustomerList(null)).toEqual({ records: [], total: 0 });
    expect(normalizeCustomerList('oops')).toEqual({ records: [], total: 0 });
    expect(normalizeCustomerList({ Unknown: 'shape' })).toEqual({ records: [], total: 0 });
    expect(normalizeCustomerList({ Data: 'not-an-array' })).toEqual({
      records: [],
      total: 0,
    });
  });
});