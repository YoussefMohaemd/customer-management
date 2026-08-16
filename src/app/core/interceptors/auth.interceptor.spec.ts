import { HttpClient } from '@angular/common/http';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { authInterceptor } from '@core/interceptors/auth.interceptor';
import { AuthService } from '@core/services/auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    auth.removeToken();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('attaches `Authorization: Bearer <token>` when a token is stored', () => {
    auth.setToken('jwt-token-123');

    http.get('/api/customers').subscribe();

    const request = httpMock.expectOne('/api/customers');
    expect(request.request.headers.get('Authorization')).toBe('Bearer jwt-token-123');
    request.flush({ data: [], totalCount: 0 });
  });

  it('leaves the request unchanged when no token is stored', () => {
    http.get('/api/customers').subscribe();

    const request = httpMock.expectOne('/api/customers');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ data: [], totalCount: 0 });
  });

  it('stops attaching the header after the token is removed', () => {
    auth.setToken('jwt-token-123');
    auth.removeToken();

    http.get('/api/customers').subscribe();

    const request = httpMock.expectOne('/api/customers');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ data: [], totalCount: 0 });
  });

  it('never doubles an existing Authorization header', () => {
    auth.setToken('jwt-token-123');

    http
      .get('/api/customers', {
        headers: { Authorization: 'Basic dXNlcjpwYXNz' },
      })
      .subscribe();

    const request = httpMock.expectOne('/api/customers');
    expect(request.request.headers.get('Authorization')).toBe('Basic dXNlcjpwYXNz');
    request.flush({ data: [], totalCount: 0 });
  });

  it('does not add the header to public endpoints even with a stored token', () => {
    auth.setToken('jwt-token-123');

    http.post('/api/auth/login', {}).subscribe();
    http.post('/api/auth/register', {}).subscribe();
    http.post('/api/auth/refresh-token', {}).subscribe();
    http.get('/api/public/countries').subscribe();

    const login = httpMock.expectOne('/api/auth/login');
    const register = httpMock.expectOne('/api/auth/register');
    const refresh = httpMock.expectOne('/api/auth/refresh-token');
    const countries = httpMock.expectOne('/api/public/countries');
    for (const request of [login, register, refresh, countries]) {
      expect(request.request.headers.has('Authorization')).toBe(false);
    }
    for (const request of [login, register, refresh, countries]) {
      request.flush({});
    }
  });
});
