import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

import { ApiError, toUserFriendlyMessage } from '@core/models/api-error';

/**
 * Transforms raw {@link HttpErrorResponse} instances into user-friendly
 * {@link ApiError} objects so that feature code never has to parse raw
 * backend errors or expose them directly in the UI.
 */
export const apiErrorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  return next(req).pipe(catchError((error: unknown) => throwError(() => toApiError(error))));
};

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof HttpErrorResponse) {
    const status = error.status === 0 ? 0 : error.status;
    const technical = {
      status: error.status,
      statusText: error.statusText,
      url: error.url,
      message: typeof error.error === 'string' ? error.error : undefined,
    };
    return new ApiError(status, toUserFriendlyMessage(status), technical);
  }
  if (error instanceof Error) {
    return new ApiError(0, toUserFriendlyMessage(0), { message: error.message });
  }
  return new ApiError(0, toUserFriendlyMessage(0), error);
}
