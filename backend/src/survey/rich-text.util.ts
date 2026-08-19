import * as sanitizeHtml from 'sanitize-html';

/**
 * Server-side trust boundary for founder-authored rich survey descriptions.
 * The whitelist mirrors exactly what the frontend editor can produce — any
 * other tag, attribute, class or inline style (including everything Google
 * Docs / Word paste smuggles in that survived the client editor) is dropped,
 * keeping only its text content. Plain-text descriptions pass through with
 * their newlines intact since they contain no tags.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li', 'img', 'hr', 'blockquote'],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt'],
    ol: ['start'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  // Images must come from the platform's own Cloudinary uploads — a foreign
  // <img> URL would let a pasted page turn respondents into tracking pixels.
  allowedSchemesByTag: { img: ['https'] },
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...(attribs.href ? { href: attribs.href } : {}),
        // target is founder's choice; rel is always forced.
        ...(attribs.target === '_blank' ? { target: '_blank' } : {}),
        rel: 'noopener noreferrer',
      },
    }),
    // Google Docs wraps its whole clipboard payload in
    // <b id="docs-internal-guid-…" style="font-weight:normal"> — semantically
    // NOT bold. Renaming it to a disallowed tag makes sanitize-html unwrap it
    // (children kept), while real <b> bold survives untouched.
    b: (tagName, attribs) => {
      const isDocsWrapper =
        (attribs.id || '').startsWith('docs-internal-guid') ||
        /font-weight\s*:\s*normal/i.test(attribs.style || '');
      return { tagName: isDocsWrapper ? 'span' : tagName, attribs: {} };
    },
  },
};

export function sanitizeDescription(input: string | undefined | null): string {
  if (!input) return '';
  return sanitizeHtml(String(input), OPTIONS).trim();
}
