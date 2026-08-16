import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { AUTH_TOKEN_STORAGE_KEY, AuthService } from '@core/services/auth.service';

/** Creates a fresh service instance so the signal is rebuilt from localStorage. */
function createService(): AuthService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({});
  return TestBed.inject(AuthService);
}

describe('AuthService (token lifecycle)', () => {
  let service: AuthService;

  beforeEach(() => {
    window.localStorage.clear();
    service = createService();
  });

  it('starts without a token when localStorage is empty', () => {
    expect(service.getToken()).toBeNull();
    expect(service.hasToken()).toBe(false);
  });

  it('setToken persists the token to localStorage and activates it', () => {
    service.setToken('token-abc');

    expect(service.getToken()).toBe('token-abc');
    expect(service.hasToken()).toBe(true);
    expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe('token-abc');
  });

  it('removeToken clears localStorage and deactivates the token', () => {
    service.setToken('token-abc');
    service.removeToken();

    expect(service.getToken()).toBeNull();
    expect(service.hasToken()).toBe(false);
    expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('reads an already persisted token on startup', () => {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'persisted-token');
    service = createService();

    expect(service.getToken()).toBe('persisted-token');
    expect(service.hasToken()).toBe(true);
  });

  it('seedInitialToken writes the provided token exactly once', () => {
    service.seedInitialToken('initial-token');
    service.seedInitialToken('initial-token');

    expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe('initial-token');
    expect(service.getToken()).toBe('initial-token');
  });

  it('seedInitialToken never overwrites a token the user has set', () => {
    service.setToken('user-token');
    service.seedInitialToken('initial-token');

    expect(service.getToken()).toBe('user-token');
    expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe('user-token');
  });

  it('seedInitialToken re-seeds if token is absent in localStorage', () => {
    service.seedInitialToken('initial-token');
    service.removeToken();

    service.seedInitialToken('initial-token');

    expect(service.getToken()).toBe('initial-token');
    expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe('initial-token');
  });
});
