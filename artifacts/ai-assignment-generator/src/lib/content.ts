/**
 * The generation model sometimes answers with HTML (it will wrap a whole
 * assignment in `<div style="...">` and emit `<h1 style="...">` headings) when
 * it interprets the font instructions as something it should apply itself.
 * Piping that straight into the exporters prints raw tags in Word and produces
 * broken nested lists in the PDF, so every content string is normalised back to
 * plain Markdown before it is rendered or exported.
 */

/** Matches any tag at all, used to detect and to strip leftovers. */
const ANY_TAG = /<[^>]*>/g
/** Tags that mean the payload is HTML rather than Markdown. */
const HTML_MARKER = /<\/?(?:div|p|h[1-6]|ul|ol|li|table|tr|td|th|span|section|article|blockquote|pre|body|html|font|br|hr|img|a|strong|em|b|i|u|code|figure|figcaption)\b[^>]*>/i

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    ndash: '-',
    mdash: '-',
    lsquo: "'",
    rsquo: "'",
    ldquo: '"',
    rdquo: '"',
    hellip: '...',
  }

  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match)
}

function collapseBlankLines(value: string): string {
  return value
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Turns one `<li>` payload into a Markdown list item. */
function toListItem(inner: string, marker: string): string {
  const text = inner.replace(ANY_TAG, '').trim()
  return text ? `\n${marker} ${text}` : ''
}

function htmlToMarkdown(html: string): string {
  let out = html

  // Anything inside these is tooling metadata, never assignment content.
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  out = out.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
  out = out.replace(/<!--[\s\S]*?-->/g, '')

  // Fenced wrappers the model sometimes adds around the whole answer.
  out = out.replace(/^\s*```(?:html|markdown|md)?\s*\n?([\s\S]*?)\n?```\s*$/i, '$1')

  out = out.replace(/<br\s*\/?>/gi, '\n')
  out = out.replace(/<hr\s*\/?>/gi, '\n\n---\n\n')

  out = out.replace(/<pre\b[^>]*>\s*<code\b[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_, body) => `\n\n\`\`\`\n${body.trim()}\n\`\`\`\n\n`)
  out = out.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_, body) => `\n\n\`\`\`\n${body.trim()}\n\`\`\`\n\n`)

  for (let level = 1; level <= 6; level += 1) {
    const hashes = '#'.repeat(level)
    out = out.replace(
      new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)</h${level}>`, 'gi'),
      (_, body) => `\n\n${hashes} ${body.replace(ANY_TAG, '').trim()}\n\n`
    )
  }

  out = out.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, body) => {
    const text = body.replace(/<\/?p\b[^>]*>/gi, '\n').replace(ANY_TAG, '').trim()
    return `\n\n${text
      .split('\n')
      .map((line: string) => `> ${line}`.trimEnd())
      .join('\n')}\n\n`
  })

  // Ordered lists keep their numbering; unordered lists become dashes.
  out = out.replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_, body) => {
    let n = 0
    return body.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m: string, item: string) => toListItem(item, `${(n += 1)}.`))
  })
  out = out.replace(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi, (_, body) =>
    body.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m: string, item: string) => toListItem(item, '-'))
  )
  out = out.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m: string, item: string) => toListItem(item, '-'))

  // Images and links are meaningful, so they become their Markdown equivalents.
  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] ?? ''
    const alt = tag.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] ?? ''
    return src ? `\n\n![${alt}](${src})\n\n` : ''
  })
  out = out.replace(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, body) => {
    const text = body.replace(ANY_TAG, '').trim()
    return text ? `[${text}](${href})` : ''
  })

  out = out.replace(/<(strong|b)\b[^>]*>/gi, '**').replace(/<\/(strong|b)>/gi, '**')
  out = out.replace(/<(em|i)\b[^>]*>/gi, '*').replace(/<\/(em|i)>/gi, '*')
  out = out.replace(/<(code|kbd|samp)\b[^>]*>/gi, '`').replace(/<\/(code|kbd|samp)>/gi, '`')

  // Any remaining tag is a wrapper or a stray leftover: turn block-level ones
  // into paragraph breaks, then drop the rest of the markup entirely.
  out = out.replace(/<\/?(?:div|p|section|article|main|header|footer|aside|nav|figure|figcaption|body|html|head|center|font|table|tr|td|th|thead|tbody|span|small|u|sup|sub)\b[^>]*>/gi, '\n\n')
  out = out.replace(/<\/?(?:ul|ol|dl|dt|dd|blockquote)\b[^>]*>/gi, '\n')
  out = out.replace(ANY_TAG, '')

  return collapseBlankLines(decodeEntities(out))
}

/**
 * Returns the content as clean Markdown, leaving ordinary Markdown untouched
 * so the fast path costs one regex test.
 */
export function normalizeAssignmentContent(raw: string): string {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return ''
  if (!HTML_MARKER.test(trimmed)) return trimmed
  return htmlToMarkdown(trimmed)
}

/** Strips the inline emphasis markers the docx writer does not model. */
export function stripInlineMarkers(value: string): string {
  return value
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]*)\]\(([^)]+)\)/g, '$1')
}
