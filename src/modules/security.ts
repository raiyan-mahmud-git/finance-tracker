/**
 * Security utilities
 * Prevents XSS attacks by sanitizing all user-supplied input before rendering.
 * In the legacy version, transaction descriptions were inserted directly into
 * template literals via innerHTML without escaping, allowing `<img src=x onerror=...>`
 * and `<script>` injections.
 */

export function escapeHtml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Creates a text node to safely set text without HTML interpretation.
 */
export function safeText(text: string): Text {
  return document.createTextNode(text);
}
