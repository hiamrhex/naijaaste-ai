export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details; // optional: array of { path, message }
  }
}

export const badRequest = (message, details) =>
  new ApiError(400, 'VALIDATION_ERROR', message, details);

export const notFound = (code, message) => new ApiError(404, code, message);

export const isApiError = (err) => err instanceof ApiError;
