export enum ApiErrorCode {
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  Conflict = 409,
  UnprocessableEntity = 422,
  TooManyRequests = 429,
  ServerError = 500,
  NetworkError = 0,
}

const CODE_BY_STATUS: Partial<Record<number, keyof typeof ApiErrorCode>> = {
  [ApiErrorCode.NetworkError]: 'NetworkError',
  [ApiErrorCode.BadRequest]: 'BadRequest',
  [ApiErrorCode.Unauthorized]: 'Unauthorized',
  [ApiErrorCode.Forbidden]: 'Forbidden',
  [ApiErrorCode.NotFound]: 'NotFound',
  [ApiErrorCode.Conflict]: 'Conflict',
  [ApiErrorCode.UnprocessableEntity]: 'UnprocessableEntity',
  [ApiErrorCode.TooManyRequests]: 'TooManyRequests',
  [ApiErrorCode.ServerError]: 'ServerError',
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: keyof typeof ApiErrorCode | 'Unknown';
  readonly userMessage: string;
  readonly technical?: unknown;

  constructor(status: number, userMessage: string, technical?: unknown) {
    super(userMessage);
    this.name = 'ApiError';
    this.status = status;
    this.code = CODE_BY_STATUS[status] ?? 'Unknown';
    this.userMessage = userMessage;
    this.technical = technical;
  }
}

const USER_MESSAGES: Record<number, string> = {
  0: 'Unable to reach the server. Check your network connection and try again.',
  400: 'The request is invalid. Review the entered data and try again.',
  401: 'Your session is not authorized. Check the API credentials in config/app-config.json.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found on the server.',
  409: 'A conflict occurred while saving this record. The record may already exist.',
  422: 'The server could not process the submitted data. Review the form fields.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Something went wrong on the server. Please try again later.',
  502: 'The server returned an invalid response. Please try again later.',
  503: 'The service is temporarily unavailable. Please try again later.',
  504: 'The server took too long to respond. Please try again later.',
};

export function toUserFriendlyMessage(status: number): string {
  return USER_MESSAGES[status] ?? `Unexpected error (HTTP ${status}). Please try again.`;
}
