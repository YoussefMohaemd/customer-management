import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

import { CustomerRecord } from '@features/customers/models/customer.model';

export interface CustomerExportRow {
  ID: number;
  Code: string;
  Name: string;
  Email: string;
  Mobile: string;
  'Client Type': string | number;
  'Account Manager': string | number;
  City: string;
  Country: string;
}

const EXPORT_HEADERS: readonly (keyof CustomerExportRow)[] = [
  'ID',
  'Code',
  'Name',
  'Email',
  'Mobile',
  'Client Type',
  'Account Manager',
  'City',
  'Country',
];

/**
 * Excel export built on SheetJS. Exports the currently matched, filtered and
 * sorted dataset (all loaded rows — never only the visible page). The staging
 * API exposes no server-side export endpoint, so a full-server export is not
 * possible; this is documented in the README.
 */
@Injectable({ providedIn: 'root' })
export class CustomerExcelService {
  exportCustomers(records: CustomerRecord[]): void {
    if (records.length === 0) {
      return;
    }

    const rows: CustomerExportRow[] = records.map((record) => ({
      ID: record.id,
      Code: record.code,
      Name: record.commercialName,
      Email: record.email,
      Mobile: record.mobile,
      'Client Type': record.accountTypeId ?? '',
      'Account Manager': record.accountManagerId ?? '',
      City: record.city,
      Country: record.country,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: [...EXPORT_HEADERS] });
    worksheet['!cols'] = EXPORT_HEADERS.map((header) => ({
      wch: Math.max(header.length + 4, this.columnWidth(rows, header)),
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');

    XLSX.writeFile(workbook, this.filename(), { compression: true });
  }

  private columnWidth(rows: CustomerExportRow[], key: keyof CustomerExportRow): number {
    let max = 0;
    for (const row of rows) {
      const length = String(row[key] ?? '').length;
      if (length > max) {
        max = length;
      }
    }
    return max + 2;
  }

  private filename(): string {
    const now = new Date();
    const stamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
    return `customers_${stamp}.xlsx`;
  }
}
