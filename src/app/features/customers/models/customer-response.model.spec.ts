import { describe, expect, it } from 'vitest';

import { normalizeSaveCustomerResult } from '@features/customers/models/customer-response.model';

describe('normalizeSaveCustomerResult (verified API contract)', () => {
  it('maps a successful save response {Result: true, ErrorMessage} and extracts the id', () => {
    const result = normalizeSaveCustomerResult({
      Result: true,
      ErrorMessage: 'Saved Successfully || Customer Code:PROBE-OK-777163 ,  Id : 18813',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Saved Successfully');
    expect(result.id).toBe(18813);
  });

  it('maps a failed save response {Result: false, ErrorMessage}', () => {
    const result = normalizeSaveCustomerResult({
      Result: false,
      ErrorMessage: 'Sorry,Mobile already Exist.',
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe('Sorry,Mobile already Exist.');
    expect(result.id).toBeNull();
  });

  it('treats a missing Result key as failure instead of guessing success', () => {
    const result = normalizeSaveCustomerResult({ Error: 'boom' });

    expect(result.success).toBe(false);
    expect(result.message).toBe('boom');
  });

  it('still tolerates legacy boolean and number shapes', () => {
    expect(normalizeSaveCustomerResult(true).success).toBe(true);
    expect(normalizeSaveCustomerResult(false).success).toBe(false);
    expect(normalizeSaveCustomerResult(123).success).toBe(true);
    expect(normalizeSaveCustomerResult(123).id).toBe(123);
  });
});