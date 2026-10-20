import { MongoServerError } from "mongodb";
import { connection } from "next/server";
import { ApiError } from "@/lib/errors";

type JsonOptions = {
  status?: number;
  cache?: "private" | "public";
  headers?: HeadersInit;
};

export function jsonResponse(data: unknown, options: JsonOptions = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set(
    "Cache-Control",
    options.cache === "public"
      ? "public, max-age=0, must-revalidate"
      : "private, no-store",
  );

  return new Response(JSON.stringify(data), {
    status: options.status ?? 200,
    headers,
  });
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return jsonResponse(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof MongoServerError && error.code === 11000) {
    return jsonResponse(
      {
        error: {
          code: "CONFLICT",
          message: "A record with that unique value already exists.",
        },
      },
      { status: 409 },
    );
  }

  // Log only on the server. Never return database details to the client.
  console.error("[api] Unhandled route error:", error);

  return jsonResponse(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
      },
    },
    { status: 500 },
  );
}

export async function runApi(handler: () => Promise<Response>) {
  // API routes read sessions and request URLs, so they must run per request.
  // Keep this outside the catch so prerender interruptions are not converted
  // into user-facing 500 responses.
  await connection();

  try {
    return await handler();
  } catch (error) {
    return apiErrorResponse(error);
  }
}
