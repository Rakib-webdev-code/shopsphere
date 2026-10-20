export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, string>;

  constructor(
    status: number,
    message: string,
    code = "REQUEST_FAILED",
    details?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: Record<string, string>) {
    super(400, message, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

export function unauthorized(message = "Sign in to continue.") {
  return new ApiError(401, message, "UNAUTHORIZED");
}

export function forbidden(message = "You do not have access to this resource.") {
  return new ApiError(403, message, "FORBIDDEN");
}

export function notFound(message = "The requested resource was not found.") {
  return new ApiError(404, message, "NOT_FOUND");
}

export function conflict(message = "That action conflicts with existing data.") {
  return new ApiError(409, message, "CONFLICT");
}
