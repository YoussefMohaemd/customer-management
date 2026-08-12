/**
 * Robust, normalized view of the SaveCustomerWithContactPerson response.
 *
 * Verified staging contract: `{ "Result": boolean, "ErrorMessage": string }`
 * with e.g. `"Saved Successfully || Customer Code:..., Id: 18813"` on success
 * or `"Sorry, Mobile already Exist."` on failure. The parser also tolerates
 * boolean / number / other common shapes so it stays defensive across hosts.
 */
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

function parseSuccess(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return !['false', 'failed', 'error', '0', ''].includes(value.toLowerCase());
  }
  return !!value;
}

/** Extracts the created/updated customer id from a success message such as
 *  `"Saved Successfully || Customer Code:PROBE-OK-1 ,  Id : 18813"`. */
function extractIdFromMessage(message: string): number | null {
  const match = message.match(/Id\s*:\s*(\d+)/i);
  return match ? readNumber(match[1]) : null;
}

export function normalizeSaveCustomerResult(raw: unknown): SaveCustomerResult {
  if (typeof raw === 'boolean') {
    return {
      success: raw,
      message: raw ? 'Customer saved successfully.' : 'The customer could not be saved.',
      id: null,
      raw,
    };
  }
  if (typeof raw === 'number') {
    return { success: true, message: 'Customer saved successfully.', id: raw, raw };
  }
  if (typeof raw === 'string') {
    return { success: raw.toLowerCase() === 'true', message: raw, id: null, raw };
  }
  if (typeof raw === 'object' && raw !== null) {
    const record = raw as Record<string, unknown>;
    const success = parseSuccess(
      record['Result'] ??
        record['result'] ??
        record['Success'] ??
        record['success'] ??
        record['IsSuccess'] ??
        record['succeeded'],
    );
    const message = readString(
      record['ErrorMessage'] ??
        record['errorMessage'] ??
        record['Message'] ??
        record['message'] ??
        record['Error'] ??
        record['error'],
    );
    return {
      success,
      message,
      id: readNumber(record['Id'] ?? record['id'] ?? record['CustomerId']) ?? extractIdFromMessage(message),
      raw,
    };
  }
  return { success: false, message: 'The customer could not be saved.', id: null, raw };
}