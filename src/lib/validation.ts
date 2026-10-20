import { ObjectId } from "mongodb";
import { ValidationError } from "@/lib/errors";
import { SORT_OPTIONS } from "@/lib/constants";
import type { SortOption } from "@/lib/types";

type StringOptions = {
  label?: string;
  min?: number;
  max?: number;
  optional?: boolean;
  pattern?: RegExp;
  patternMessage?: string;
};

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("Request body must be a JSON object.");
  }

  return value as Record<string, unknown>;
}

export async function readJsonBody(
  request: Request,
  maxBytes = 100_000,
): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new ValidationError("Request body is too large.");
  }

  let text: string;

  try {
    text = await request.text();
  } catch {
    throw new ValidationError("Unable to read the request body.");
  }

  if (text.length > maxBytes) {
    throw new ValidationError("Request body is too large.");
  }

  if (!text.trim()) {
    throw new ValidationError("Request body is required.");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ValidationError("Request body must be valid JSON.");
  }
}

function cleanText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
}

export function readString(
  value: unknown,
  {
    label = "Value",
    min = 1,
    max = 500,
    optional = false,
    pattern,
    patternMessage,
  }: StringOptions = {},
): string {
  if (value === undefined || value === null || value === "") {
    if (optional) {
      return "";
    }

    throw new ValidationError(`${label} is required.`);
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${label} must be text.`);
  }

  const cleaned = cleanText(value);

  if (cleaned.length < min) {
    throw new ValidationError(
      `${label} must be at least ${min} character${min === 1 ? "" : "s"}.`,
    );
  }

  if (cleaned.length > max) {
    throw new ValidationError(
      `${label} must be ${max} characters or fewer.`,
    );
  }

  if (pattern && !pattern.test(cleaned)) {
    throw new ValidationError(patternMessage ?? `${label} is not valid.`);
  }

  return cleaned;
}

export function readOptionalString(
  value: unknown,
  options: Omit<StringOptions, "optional"> = {},
): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const cleaned = readString(value, { ...options, optional: true });
  return cleaned || null;
}

export function readInt(
  value: unknown,
  {
    label = "Value",
    min = Number.MIN_SAFE_INTEGER,
    max = Number.MAX_SAFE_INTEGER,
  }: { label?: string; min?: number; max?: number } = {},
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new ValidationError(
      `${label} must be a whole number between ${min} and ${max}.`,
    );
  }

  return value;
}

export function readBoolean(
  value: unknown,
  label = "Value",
): boolean {
  if (typeof value !== "boolean") {
    throw new ValidationError(`${label} must be true or false.`);
  }

  return value;
}

export function readEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label = "Value",
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new ValidationError(
      `${label} must be one of: ${allowed.join(", ")}.`,
    );
  }

  return value as T;
}

export function readStringArray(
  value: unknown,
  {
    label = "Items",
    maxItems = 20,
    maxLength = 200,
    optional = true,
  }: {
    label?: string;
    maxItems?: number;
    maxLength?: number;
    optional?: boolean;
  } = {},
): string[] {
  if (value === undefined || value === null) {
    if (optional) {
      return [];
    }

    throw new ValidationError(`${label} are required.`);
  }

  if (!Array.isArray(value)) {
    throw new ValidationError(`${label} must be a list.`);
  }

  if (value.length > maxItems) {
    throw new ValidationError(`${label} can contain at most ${maxItems} items.`);
  }

  return value
    .map((entry, index) =>
      readString(entry, {
        label: `${label} item ${index + 1}`,
        max: maxLength,
      }),
    )
    .filter(Boolean);
}

export function parseObjectId(value: unknown, label = "ID"): ObjectId {
  if (typeof value !== "string" || !ObjectId.isValid(value)) {
    throw new ValidationError(`${label} is not valid.`);
  }

  return new ObjectId(value);
}

export function parseObjectIdParam(value: string, label = "ID"): ObjectId {
  return parseObjectId(value, label);
}

export function isValidObjectId(value: string): boolean {
  return ObjectId.isValid(value);
}

export function normalizeSlug(value: unknown, label = "Slug"): string {
  return readString(value, {
    label,
    min: 2,
    max: 80,
    pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    patternMessage:
      `${label} must use lowercase letters, numbers, and single hyphens.`,
  });
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[-\s]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function parsePage(value: string | null, max = 10_000): number {
  if (!value) {
    return 1;
  }

  if (!/^\d+$/.test(value)) {
    throw new ValidationError("Page must be a positive whole number.");
  }

  const page = Number(value);

  if (!Number.isSafeInteger(page) || page < 1 || page > max) {
    throw new ValidationError(
      `Page must be a whole number between 1 and ${max}.`,
    );
  }

  return page;
}

export function parsePageSize(
  value: string | null,
  defaultSize: number,
  max = 48,
): number {
  if (!value) {
    return defaultSize;
  }

  if (!/^\d+$/.test(value)) {
    throw new ValidationError("Page size must be a positive whole number.");
  }

  const pageSize = Number(value);

  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > max) {
    throw new ValidationError(
      `Page size must be a whole number between 1 and ${max}.`,
    );
  }

  return pageSize;
}

export function parseSort(value: string | null): SortOption {
  if (!value) {
    return "featured";
  }

  if (!SORT_OPTIONS.some((option) => option.value === value)) {
    throw new ValidationError(
      "Sort must be one of the supported catalog sort options.",
    );
  }

  return value as SortOption;
}

export function parseMoneyToCents(
  value: unknown,
  label = "Price",
): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const text =
    typeof value === "number" ? String(value) : typeof value === "string" ? value : "";

  if (!/^\d+(?:\.\d{1,2})?$/.test(text.trim())) {
    throw new ValidationError(
      `${label} must be a positive amount with up to two decimal places.`,
    );
  }

  const amount = Number(text);
  const cents = Math.round(amount * 100);

  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 10_000_000) {
    throw new ValidationError(`${label} is outside the supported range.`);
  }

  return cents;
}

export function readPriceCents(
  value: unknown,
  label = "Price",
): number {
  return readInt(value, { label, min: 0, max: 10_000_000 });
}

export function readOptionalPriceCents(
  value: unknown,
  label = "Compare-at price",
): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return readPriceCents(value, label);
}

export function normalizeEmail(value: unknown): string {
  const email = readString(value, {
    label: "Email",
    max: 254,
  }).toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError("Email is not valid.");
  }

  return email;
}

export function parseDateInput(
  value: unknown,
  label = "Date",
): Date | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${label} must be a date string.`);
  }

  const text = value.trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
  const date = new Date(dateOnly ? `${text}T23:59:59.999Z` : text);

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`${label} is not a valid date.`);
  }

  return date;
}

export function validateImageUrl(
  value: unknown,
  label = "Image URL",
): string {
  const url = readString(value, { label, max: 1_000 });

  if (url.startsWith("/") && !url.startsWith("//")) {
    return url;
  }

  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }

    return parsed.toString();
  } catch {
    throw new ValidationError(
      `${label} must be a local path or an https URL.`,
    );
  }
}

export function validateImageUrls(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new ValidationError("Images must be a list of URLs.");
  }

  if (value.length > 6) {
    throw new ValidationError("A product can have at most 6 images.");
  }

  return value.map((entry, index) =>
    validateImageUrl(entry, `Image ${index + 1}`),
  );
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function firstSearchParam(
  value: string | string[] | undefined,
): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
