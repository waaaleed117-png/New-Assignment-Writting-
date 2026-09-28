Ai-assignment-generator/src/lib/export.ts

Yalo yr iska code achy sy dkeh kr is msly ko hmesha kalia fix krdo yr plz or plz koi error na create kr dena ab bs jo kaha ha wohi krna

import { Document, ImageRun, Packer, Paragraph, HeadingLevel, TextRun } from 'docx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { FormattingSettings } from '@/lib/types'
import {
  defaultFormatting,
  getContentBox,
  getPageMargin,
  getPageSize,
} from '@/lib/formatting'
import { normalizeAssignmentContent, stripInlineMarkers } from '@/lib/content'

/** CSS pixels per inch, so a rendered px matches its physical size on paper. */
const CSS_PX_PER_INCH = 96
/** DOCX stores page geometry in twips (1 inch = 1440 twips). */
const TWIPS_PER_INCH = 1440
/** DOCX image geometry is expressed in pixels at 96 dpi. */
const DOCX_IMAGE_MAX_WIDTH_PX = 560
/** Every exported glyph is forced to pure black, whatever the source markup. */
const DOCX_TEXT_COLOR = '000000'

/**
 * Word stores font size in half-points, so a 12pt selection must be written as
 * 24. Keeping the conversion in one place stops the units being guessed.
 */
function toHalfPoints(points: number): number {
  return Math.round(points * 2)
}

function headingParagraph(
  text: string,
  heading: (typeof HeadingLevel)[keyof typeof HeadingLevel],
  spacingAfter: number,
  formatting: FormattingSettings
): Paragraph {
  return new Paragraph({
    heading,
    spacing: { after: spacingAfter },
    children: [
      new TextRun({
        text,
        font: formatting.headingFont,
        size: toHalfPoints(formatting.headingSize),
        color: DOCX_TEXT_COLOR,
        // Only the selected font and size are applied, so bold is turned off
        // explicitly rather than left to inherit from a style.
        bold: false,
      }),
    ],
  })
}

function bodyParagraph(
  text: string,
  formatting: FormattingSettings,
  spacing: { line: number; after: number } = { line: 360, after: 100 }
): Paragraph {
  return new Paragraph({
    spacing,
    children: [
      new TextRun({
        text,
        font: formatting.bodyFont,
        size: toHalfPoints(formatting.bodySize),
        color: DOCX_TEXT_COLOR,
      }),
    ],
  })
}

/**
 * The `docx` package ships Word's own built-in heading styles, which are blue
 * (Heading1/2 = 2E74B5, Heading3 = 1F4D78) and carry their own font sizes.
 * `styles.default` overrides those definitions in place — unlike
 * `styles.paragraphStyles`, which merely appends and would leave two
 * `<w:style>` elements sharing a `w:styleId`, which is invalid OOXML.
 * `document.run` also stops Word falling back to 10pt Calibri for any run
 * without an explicit size.
 */
function buildDocxStyles(formatting: FormattingSettings) {
  const headingRun = {
    color: DOCX_TEXT_COLOR,
    font: formatting.headingFont,
    size: toHalfPoints(formatting.headingSize),
    bold: false,
  }
  const blackRun = { color: DOCX_TEXT_COLOR }

  return {
    default: {
      document: {
        run: {
          color: DOCX_TEXT_COLOR,
          font: formatting.bodyFont,
          size: toHalfPoints(formatting.bodySize),
        },
      },
      title: { run: headingRun },
      heading1: { run: headingRun },
      heading2: { run: headingRun },
      heading3: { run: headingRun },
      heading4: { run: headingRun },
      heading5: { run: headingRun },
      heading6: { run: headingRun },
      strong: { run: { ...blackRun, bold: true } },
      listParagraph: { run: blackRun },
      hyperlink: { run: blackRun },
      footnoteReference: { run: blackRun },
      footnoteText: { run: blackRun },
      footnoteTextChar: { run: blackRun },
      endnoteReference: { run: blackRun },
      endnoteText: { run: blackRun },
      endnoteTextChar: { run: blackRun },
    },
  }
}

export async function exportToPDF(
  htmlContent: string,
  filename: string = 'assignment.pdf',
  formatting: FormattingSettings = defaultFormatting
) {
  const pageSize = getPageSize(formatting.pageSize)
  const pageMargin = getPageMargin(formatting.pageMargin)
  const content = getContentBox(pageSize, pageMargin)

  const container = document.createElement('article')
  container.innerHTML = htmlContent
  container.style.cssText = [
    'position: fixed',
    'left: -10000px',
    'top: 0',
    // Render at the real printable width so the page size and margins are
    // physically reflected in the PDF instead of being scaled away.
    `width: ${Math.round(content.width * CSS_PX_PER_INCH)}px`,
    'color: #111827',
    'background: #ffffff',
    `font-family: ${formatting.bodyFont}, sans-serif`,
    'line-height: 1.6',
  ].join('; ')
  document.body.appendChild(container)

  normalizeInlineStyles(container)

  // Wait for remote diagrams to load before rendering.
  const images = Array.from(container.querySelectorAll('img'))
  await Promise.all(
    images.map(
      (image) =>
        image.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              image.onload = () => resolve()
              image.onerror = () => resolve()
            })
    )
  )

  try {
    const canvas = await html2canvas(container, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: container.scrollWidth,
      width: container.scrollWidth,
      height: container.scrollHeight,
      scrollX: 0,
      scrollY: 0,
    })

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'in',
      format: [pageSize.width, pageSize.height],
      compress: true,
    })

    const pagePixels = Math.floor((canvas.width * content.height) / content.width)
    const totalPages = Math.max(1, Math.ceil(canvas.height / pagePixels))

    for (let page = 0; page < totalPages; page += 1) {
      if (page > 0) doc.addPage()

      // Slice the canvas to prevent image bleeding into the margins
      const sliceCanvas = document.createElement('canvas')
      sliceCanvas.width = canvas.width
      sliceCanvas.height = Math.min(pagePixels, canvas.height - page * pagePixels)

      const ctx = sliceCanvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height)
        ctx.drawImage(
          canvas,
          0,
          page * pagePixels,
          canvas.width,
          sliceCanvas.height,
          0,
          0,
          sliceCanvas.width,
          sliceCanvas.height
        )
      }

      const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92)
      const sliceHeightInches = (sliceCanvas.height * content.width) / sliceCanvas.width

      doc.addImage(
        sliceData,
        'JPEG',
        pageMargin.left,
        pageMargin.top,
        content.width,
        sliceHeightInches,
        undefined,
        'FAST'
      )
    }

    doc.save(filename)
  } finally {
    container.remove()
  }
}

export function normalizeInlineStyles(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('*').forEach((node) => {
    const style = node.style
    const c = node.classList

    if (c.contains('font-bold')) style.fontWeight = 'bold'
    if (c.contains('italic')) style.fontStyle = 'italic'
    if (c.contains('underline')) style.textDecoration = 'underline'

    if (
      c.contains('text-slate-900') ||
      c.contains('text-slate-100') ||
      c.contains('dark:text-slate-100')
    ) {
      style.color = '#111827'
    }
    if (
      c.contains('text-slate-500') ||
      c.contains('text-slate-600') ||
      c.contains('text-gray-600') ||
      c.contains('dark:text-gray-400') ||
      c.contains('dark:text-slate-400')
    ) {
      style.color = '#4b5563'
    }
    if (c.contains('text-blue-600') || c.contains('dark:text-blue-400')) {
      style.color = '#1d4ed8'
    }
    if (
      c.contains('bg-gray-100') ||
      c.contains('dark:bg-gray-700') ||
      c.contains('dark:bg-white/10')
    ) {
      style.backgroundColor = '#f1f5f9'
    }

    if (c.contains('border-gray-300') || c.contains('dark:border-gray-600')) {
      style.border = '1px solid #d1d5db'
    }
    if (c.contains('border-blue-500') || c.contains('dark:border-blue-500')) {
      style.borderLeft = '4px solid #3b82f6'
    }

    if (c.contains('rounded-lg')) style.borderRadius = '8px'
    if (c.contains('rounded')) style.borderRadius = '6px'
    if (c.contains('list-disc')) style.listStyleType = 'disc'
    if (c.contains('leading-relaxed')) style.lineHeight = '1.625'
    if (c.contains('max-w-full')) style.maxWidth = '100%'
    if (c.contains('max-w-none')) style.maxWidth = 'none'
    if (c.contains('h-auto')) style.height = 'auto'
    if (c.contains('whitespace-pre-wrap')) style.whiteSpace = 'pre-wrap'
    if (c.contains('overflow-x-auto')) style.overflowX = 'auto'
    if (c.contains('p-4')) style.padding = '1rem'
    if (c.contains('px-2')) {
      style.paddingLeft = '0.5rem'
      style.paddingRight = '0.5rem'
    }
    if (c.contains('py-1')) {
      style.paddingTop = '0.25rem'
      style.paddingBottom = '0.25rem'
    }
    if (c.contains('pl-4')) style.paddingLeft = '1rem'
    if (c.contains('ml-4')) style.marginLeft = '1rem'

    // A heading already carries an inline font-size from the Formatting
    // settings, so the `text-*` utility class must not overwrite it.
    if (!style.fontSize) {
      if (c.contains('text-sm')) style.fontSize = '0.875rem'
      if (c.contains('text-base')) style.fontSize = '1rem'
      if (c.contains('text-lg')) style.fontSize = '1.125rem'
      if (c.contains('text-xl')) style.fontSize = '1.25rem'
      if (c.contains('text-2xl')) style.fontSize = '1.5rem'
      if (c.contains('text-3xl')) style.fontSize = '1.875rem'
      if (c.contains('text-4xl')) style.fontSize = '2.25rem'
    }

    const verticalMargin = c.contains('my-2')
      ? '0.5rem'
      : c.contains('my-3')
      ? '0.75rem'
      : c.contains('my-4')
      ? '1rem'
      : null
    if (verticalMargin) {
      style.marginTop = verticalMargin
      style.marginBottom = verticalMargin
    }
    const marginTop = c.contains('mt-2')
      ? '0.5rem'
      : c.contains('mt-4')
      ? '1rem'
      : c.contains('mt-6')
      ? '1.5rem'
      : c.contains('mt-8')
      ? '2rem'
      : null
    if (marginTop) style.marginTop = marginTop
    const marginBottom = c.contains('mb-2')
      ? '0.5rem'
      : c.contains('mb-3')
      ? '0.75rem'
      : c.contains('mb-4')
      ? '1rem'
      : c.contains('mb-8')
      ? '2rem'
      : null
    if (marginBottom) style.marginBottom = marginBottom

    if (c.length > 0) node.removeAttribute('class')
  })

  if (!root.style.color) root.style.color = '#111827'
}

export async function exportToDocx(
  markdownContent: string,
  filename: string = 'assignment.docx',
  formatting: FormattingSettings = defaultFormatting
) {
  try {
    const pageSize = getPageSize(formatting.pageSize)
    const pageMargin = getPageMargin(formatting.pageMargin)
    const content = getContentBox(pageSize, pageMargin)
    const maxImageWidth = Math.min(
      DOCX_IMAGE_MAX_WIDTH_PX,
      Math.round(content.width * CSS_PX_PER_INCH)
    )

    // Parse markdown-like content into DOCX paragraphs
    const lines = normalizeAssignmentContent(markdownContent).split('\n')
    const paragraphs: Paragraph[] = []

    for (const line of lines) {
      if (line.startsWith('# ')) {
        paragraphs.push(
          headingParagraph(line.replace('# ', ''), HeadingLevel.HEADING_1, 200, formatting)
        )
      } else if (line.startsWith('## ')) {
        paragraphs.push(
          headingParagraph(line.replace('## ', ''), HeadingLevel.HEADING_2, 150, formatting)
        )
      } else if (line.startsWith('### ')) {
        paragraphs.push(
          headingParagraph(line.replace('### ', ''), HeadingLevel.HEADING_3, 100, formatting)
        )
      } else if (line.trim()) {
        const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
        if (imageMatch) {
          try {
            const response = await fetch(imageMatch[2])
            const contentType = response.headers.get('content-type') || ''
            const imageType = contentType.includes('png')
              ? 'png'
              : contentType.includes('jpeg') || contentType.includes('jpg')
              ? 'jpg'
              : contentType.includes('svg')
              ? 'svg'
              : 'png'
            if (imageType === 'svg') {
              // DOCX only supports SVG images with a PNG fallback, which we
              // cannot produce client-side, so skip embedding this image.
              throw new Error('SVG images are not supported in Word export')
            }
            const imageBuffer = await response.arrayBuffer()
            paragraphs.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    type: imageType,
                    data: imageBuffer,
                    transformation: { width: maxImageWidth, height: Math.round((maxImageWidth * 315) / 560) },
                  }),
                ],
                spacing: { after: 100 },
              })
            )
            paragraphs.push(
              bodyParagraph(stripInlineMarkers(imageMatch[1]), formatting, { line: 360, after: 150 })
            )
            // The image line is fully handled, but the rest of the assignment
            // must still be exported.
            continue
          } catch (error) {
            console.warn('Could not embed assignment image in Word export:', error)
          }
        }
        paragraphs.push(bodyParagraph(stripInlineMarkers(line), formatting))
      }
    }

    const doc = new Document({
      styles: buildDocxStyles(formatting),
      sections: [
        {
          properties: {
            page: {
              size: {
                width: Math.round(pageSize.width * TWIPS_PER_INCH),
                height: Math.round(pageSize.height * TWIPS_PER_INCH),
              },
              margin: {
                top: Math.round(pageMargin.top * TWIPS_PER_INCH),
                right: Math.round(pageMargin.right * TWIPS_PER_INCH),
                bottom: Math.round(pageMargin.bottom * TWIPS_PER_INCH),
                left: Math.round(pageMargin.left * TWIPS_PER_INCH),
              },
            },
          },
          children: paragraphs,
        },
      ],
    })

    const blob = await Packer.toBlob(doc)
    saveAs(blob, filename)
  } catch (error) {
    console.error('Error exporting to DOCX:', error)
    throw error
  }
}

export function convertMarkdownToHtml(markdown: string, formatting: FormattingSettings = defaultFormatting): string {
  let html = normalizeAssignmentContent(markdown)

  // Headers (must be done in order from h6 to h1 to avoid conflicts)
  // `font-weight:normal` is required because browsers render h1-h6 bold by
  // default, which would add weight the user never asked for.
  const headingStyle = `font-family:${formatting.headingFont};font-size:${formatting.headingSize}pt;font-weight:normal`
  const bodyStyle = `font-family:${formatting.bodyFont};font-size:${formatting.bodySize}pt`
  // Headings carry only the selected font and size, so no weight class is added.
  const headingClass = 'text-slate-900 dark:text-slate-100'
  html = html.replace(/^###### (.*?)$/gm, `<h6 class="mt-4 mb-2 text-base ${headingClass}" style="${headingStyle}">$1</h6>`)
  html = html.replace(/^##### (.*?)$/gm, `<h5 class="mt-4 mb-2 text-lg ${headingClass}" style="${headingStyle}">$1</h5>`)
  html = html.replace(/^#### (.*?)$/gm, `<h4 class="mt-4 mb-2 text-xl ${headingClass}" style="${headingStyle}">$1</h4>`)
  html = html.replace(/^### (.*?)$/gm, `<h3 class="mt-4 mb-2 text-2xl ${headingClass}" style="${headingStyle}">$1</h3>`)
  html = html.replace(/^## (.*?)$/gm, `<h2 class="mt-6 mb-3 text-3xl ${headingClass}" style="${headingStyle}">$1</h2>`)
  html = html.replace(/^# (.*?)$/gm, `<h1 class="mt-8 mb-4 text-4xl ${headingClass}" style="${headingStyle}">$1</h1>`)

  // Code blocks (preserve before other replacements)
  html = html.replace(
    /```([\s\S]*?)```/g,
    '<pre class="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg overflow-x-auto my-4"><code>$1</code></pre>'
  )

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-sm">$1</code>')

  // Bold (both ** and __)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>')
  html = html.replace(/__(.*?)__/g, '<strong class="font-bold">$1</strong>')

  // Italic (both * and _)
  html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
  html = html.replace(/_(.*?)_/g, '<em class="italic">$1</em>')

  // Images
  html = html.replace(
    /!\[(.*?)\]\((.*?)\)/g,
    '<figure class="my-4"><img src="$2" alt="$1" class="max-w-full h-auto rounded-lg border border-gray-300 dark:border-gray-600" /><figcaption class="text-sm text-gray-600 dark:text-gray-400 mt-2">$1</figcaption></figure>'
  )

  // Links
  html = html.replace(
    /\[(.*?)\]\((.*?)\)/g,
    '<a href="$2" class="text-blue-600 dark:text-blue-400 underline hover:no-underline" target="_blank" rel="noopener noreferrer">$1</a>'
  )

  // Bullet lists
  html = html.replace(/^\* (.*?)$/gm, '<li class="ml-4">$1</li>')
  html = html.replace(/^- (.*?)$/gm, '<li class="ml-4">$1</li>')
  html = html.replace(/^(\d+)\. (.*?)$/gm, '<li class="ml-4">$2</li>')

  // Wrap list items
  html = html.replace(/(<li.*?<\/li>(?:\n<li.*?<\/li>)*)/g, '<ul class="list-disc my-2">$1</ul>')

  // Blockquotes
  html = html.replace(
    /^&gt; (.*?)$/gm,
    '<blockquote class="border-l-4 border-blue-500 pl-4 py-2 my-2 italic text-gray-600 dark:text-gray-400">$1</blockquote>'
  )

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr class="my-4 border-t-2 border-gray-300 dark:border-gray-600" />')

  // Paragraphs (wrap remaining text)
  const paragraphs = html.split('\n\n')
  const wrappedParagraphs = paragraphs.map((para: string) => {
    para = para.trim()
    if (
      para.startsWith('<h') ||
      para.startsWith('<ul') ||
      para.startsWith('<blockquote') ||
      para.startsWith('<pre') ||
      para.startsWith('<figure') ||
      para.startsWith('<hr') ||
      para.startsWith('<li')
    ) {
      return para
    }
    if (para.startsWith('<')) {
      return para
    }
    if (para === '') {
      return ''
    }
    return `<p class="my-3 leading-relaxed text-slate-900 dark:text-slate-100" style="${bodyStyle}">${para}</p>`
  })

  return `<div class="prose dark:prose-invert max-w-none">${wrappedParagraphs.join('')}</div>`
}
