/**
 * Escapes HTML special characters in a string. Used by PDF templates
 * and email HTML bodies. Single source of truth — do not redefine
 * locally in other files.
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
