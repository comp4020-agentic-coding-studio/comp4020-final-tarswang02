export class ValidationError extends Error {}

export function requireLength(value: string, field: string, min: number, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length < min) {
    throw new ValidationError(`${field} must be at least ${min} character(s)`);
  }
  if (trimmed.length > max) {
    throw new ValidationError(`${field} must be at most ${max} characters`);
  }
  return trimmed;
}

// Only http(s) may be used as a source link; anything else (javascript:,
// data:, file:, ...) is rejected rather than rendered as a clickable href.
export function validateSourceUrl(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ValidationError("source URL is not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ValidationError("source URL must be http or https");
  }
  if (trimmed.length > 2000) {
    throw new ValidationError("source URL is too long");
  }
  return trimmed;
}

export function validateRelation(value: string): "supports" | "challenges" {
  if (value !== "supports" && value !== "challenges") {
    throw new ValidationError('relation must be "supports" or "challenges"');
  }
  return value;
}
