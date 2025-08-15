/**
 * Clean HTML artifacts that might be mixed into markdown content.
 */
export function cleanHtmlArtifacts(text: string): string {
  if (!text) return "";
  
  // Remove HTML list artifacts that commonly get mixed in
  text = text.replace(/<\/li><li>/g, '\n* ');
  text = text.replace(/<\/?ul>/g, '');
  text = text.replace(/<\/?ol>/g, '');
  text = text.replace(/<li[^>]*>/g, '* ');
  text = text.replace(/<\/li>/g, '');
  
  // Remove any remaining HTML tags
  text = text.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');
  
  return text;
}

/**
 * Normalize markdown text by:
 * - Cleaning HTML artifacts
 * - Collapsing 3+ consecutive blank lines to 2 blank lines
 * - Removing trailing whitespace from lines
 * - Ensuring consistent spacing
 */
export function normalizeMarkdown(text: string): string {
  if (!text) return "";
  
  // Clean HTML artifacts first
  text = cleanHtmlArtifacts(text);
  
  // Convert Windows line endings to Unix
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Remove trailing whitespace from each line
  text = text.replace(/[ \t]+$/gm, '');
  
  // Collapse 3+ consecutive blank lines to 2 blank lines
  // This handles multiple patterns of blank lines
  text = text.replace(/\n\s*\n\s*\n\s*\n+/g, '\n\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  
  // Remove any leading blank lines
  text = text.replace(/^\n+/, '');
  
  // Ensure file ends with exactly one newline
  text = text.replace(/\n*$/, '\n');
  
  return text;
} 