import { HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';

import { AppConfigService } from '@core/services/app-config.service';

/**
 * Adds the Authorization header to every outgoing request based on the
 * runtime configuration loaded from `config/app-config.json`.
 *
 * The credential is intentionally not hard-coded anywhere in the source:
 * it is provided at runtime through a git-ignored configuration file.
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const configService = inject(AppConfigService);
  const auth = configService.auth();

  if (!auth || !auth.token) {
    return next(req);
  }

  const authorizedRequest = req.clone({
    setHeaders: {
      Authorization: `${auth.scheme} ${auth.token}`,
    },
  });
  return next(authorizedRequest);
};
