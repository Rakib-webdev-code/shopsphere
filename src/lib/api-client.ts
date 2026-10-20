export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code = "REQUEST_FAILED") {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

type ApiErrorBody = {
  error?: {
    message?: string;
    code?: string;
  };
};

export async function apiRequest<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  const data = (await response.json().catch(() => ({}))) as T & ApiErrorBody;

  if (!response.ok) {
    throw new ApiClientError(
      data.error?.message ?? "Request failed. Please try again.",
      response.status,
      data.error?.code,
    );
  }

  return data;
}
