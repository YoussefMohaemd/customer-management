/** Robust, normalized view of the SaveCustomerWithContactPerson response. */
export interface SaveCustomerResult {
  success: boolean;
  message: string;
  id: number | null;
  raw: unknown;
}

function readString(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value);
}

function readNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Normalizes the Save response. The staging API contract is not documented,
 * so both boolean and message-shaped responses are tolerated.
 */
export function normalizeSaveCustomerResult(raw: unknown): SaveCustomerResult {
  if (typeof raw === 'boolean') {
    return { success: raw, message: raw ? 'Customer saved successfully.' : 'The customer could not be saved.', id: null, raw };
  }
  if (typeof raw === 'number') {
    return { success: true, message: 'Customer saved successfully.', id: raw, raw };
  }
  if (typeof raw === 'string') {
    return { success: raw.toLowerCase() === 'true', message: raw, id: null, raw };
  }
  if (typeof raw === 'object' && raw !== null) {
    const record = raw as Record<string, unknown>;
    const successValue = record['Success'] ?? record['success'] ?? record['IsSuccess'] ?? record['succeeded'] ?? record['Status'];
    const success =
      typeof successValue === 'boolean'
        ? successValue
        : typeof successValue === 'string'
          ? !['false', 'failed', 'error', '0'].includes(successValue.toLowerCase())
          : true;
    return {
      success,
      message: readString(record['Message'] ?? record['message'] ?? record['Error'] ?? record['error']),
      id: readNumber(record['Id'] ?? record['id'] ?? record['CustomerId']),
      raw
    };
  }
  return { success: false, message: 'The customer could not be saved.', id: null, raw };
}