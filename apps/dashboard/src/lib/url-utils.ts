/**
 * URL utilities for converting between internal IDs (with underscores)
 * and URL-friendly slugs (with dashes) for SEO purposes.
 */

/**
 * Convert an internal ID to a URL-friendly slug.
 * Replaces underscores with dashes.
 *
 * @example
 * toSlug("italy_serie_a") // "italy-serie-a"
 * toSlug("as_roma_como_2025-12-15") // "as-roma-como-2025-12-15"
 */
export function toSlug(id: string): string {
  return id.replace(/_/g, "-");
}

/**
 * Convert a URL slug back to an internal ID.
 * Replaces dashes with underscores, except for date patterns (YYYY-MM-DD).
 *
 * @example
 * fromSlug("italy-serie-a") // "italy_serie_a"
 * fromSlug("as-roma-como-2025-12-15") // "as_roma_como_2025-12-15"
 */
export function fromSlug(slug: string): string {
  // Match date pattern at the end (YYYY-MM-DD) and preserve it
  const datePattern = /(\d{4}-\d{2}-\d{2})$/;
  const match = slug.match(datePattern);

  if (match) {
    // Replace dashes with underscores except for the date part
    const withoutDate = slug.slice(0, -match[1].length);
    const date = match[1];
    return withoutDate.replace(/-/g, "_") + date;
  }

  // No date pattern, replace all dashes
  return slug.replace(/-/g, "_");
}
