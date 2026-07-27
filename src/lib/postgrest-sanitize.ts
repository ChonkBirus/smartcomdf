/**
 * Sanitize free-text user input before interpolating it into a PostgREST
 * `.or(...)` / `.ilike(...)` filter expression. Strips PostgREST reserved
 * characters that could otherwise break out of the current filter clause
 * (e.g. commas, dots, parentheses) or act as unintended wildcards.
 */
export function sanitizePostgrestSearch(input: string, maxLen = 100): string {
  if (!input) return "";
  return input
    .replace(/[,\.()%*\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}
