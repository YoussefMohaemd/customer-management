import { HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';

import { AuthService } from '@core/services/auth.service';

/**
 * Endpoints that must never receive the JWT. Public/identity routes authenticate
 * themselves (or are anonymous) and would reject or ignore a bearer token.
 */
const PUBLIC_URL_MARKERS: readonly string[] = ['/login', '/register', '/refresh-token', '/public/'];

function isPublicUrl(url: string): boolean {
  return PUBLIC_URL_MARKERS.some((marker) => url.includes(marker));
}

/**
 * Attaches the JWT as `Authorization: Bearer <token>` to every outgoing
 * request, read dynamically from {@link AuthService} at request time.
 *
 * - Public endpoints are left untouched.
 * - A request that already carries an explicit `Authorization` header is
 *   preserved as-is (never doubled into `Bearer Bearer <token>`).
 * - Without a stored token the request is forwarded unchanged.
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  if (isPublicUrl(req.url) || req.headers.has('Authorization')) {
    return next(req);
  }

  const token = inject(AuthService).getToken();
  if (!token) {
    if (typeof console !== 'undefined' && console.debug) {
      console.debug('[AuthInterceptor] token present: false');
    }
    return next(req);
  }

  if (typeof console !== 'undefined' && console.debug) {
    console.debug('[AuthInterceptor] token present: true');
    console.debug('[AuthInterceptor] Authorization header added: true');
  }

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  );
};

