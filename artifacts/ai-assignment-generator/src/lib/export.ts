import { Document, ImageRun, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType, BorderStyle, PageBorderOffsetFrom } from 'docx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { FormattingSettings, PageBorderId } from '@/lib/types'
import {
  defaultFormatting,
  getContentBox,
  getPageMargin,
  getPageSize,
} from '@/lib/formatting'
import { normalizeAssignmentContent, stripInlineMarkers } from '@/lib/content'

const CSS_PX_PER_INCH = 96
const TWIPS_PER_INCH = 1440
const DOCX_IMAGE_MAX_WIDTH_PX = 560
const DOCX_TEXT_COLOR = '000000'

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
    alignment: formatting.justifyAlignment ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
    spacing: { after: spacingAfter },
    children: [
      new TextRun({
        text,
        font: formatting.headingFont,
        size: toHalfPoints(formatting.headingSize),
        color: DOCX_TEXT_COLOR,
        bold: formatting.headingBold,
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
    alignment: formatting.justifyAlignment ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
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

// DOCX Border fixing - Moved to TEXT offset to force display in mobile apps
function getDocxBorder(borderId: PageBorderId) {
  if (borderId === 'none') return undefined;

  const mapping: Record<string, typeof BorderStyle[keyof typeof BorderStyle]> = {
    solid: BorderStyle.SINGLE,
    dashed: BorderStyle.DASHED, 
    dotted: BorderStyle.DOTTED,
    double: BorderStyle.DOUBLE,
  }

  const borderStyle = mapping[borderId] || BorderStyle.SINGLE;
  const bConfig = { style: borderStyle, size: 12, color: '000000', space: 24 };

  return {
    pageBorders: {
      offsetFrom: PageBorderOffsetFrom.TEXT, // Text se offset taake mobile hide na kare
    },
    top: bConfig,
    bottom: bConfig,
    left: bConfig,
    right: bConfig,
  }
}

function buildDocxStyles(formatting: FormattingSettings) {
  const headingRun = {
    color: DOCX_TEXT_COLOR,
    font: formatting.headingFont,
    size: toHalfPoints(formatting.headingSize),
    bold: formatting.headingBold,
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
    `width: ${Math.round(content.width * CSS_PX_PER_INCH)}px`,
    'color: #111827',
    'background: #ffffff',
    `font-family: ${formatting.bodyFont}, sans-serif`,
    'line-height: 1.6',
    formatting.justifyAlignment ? 'text-align: justify;' : 'text-align: left;'
  ].join('; ')
  document.body.appendChild(container)

  normalizeInlineStyles(container)

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
      
      // Clean PDF Border (No interference from HTML padding)
      if (formatting.pageBorder !== 'none') {
        const marginFromEdge = 0.33; 
        const rectX = marginFromEdge;
        const rectY = marginFromEdge;
        const rectW = pageSize.width - (marginFromEdge * 2);
        const rectH = pageSize.height - (marginFromEdge * 2);
        
        doc.setDrawColor(0); 
        doc.setLineWidth(0.015);
        
        if (formatting.pageBorder === 'solid') {
           doc.rect(rectX, rectY, rectW, rectH);
        } else if (formatting.pageBorder === 'double') {
           doc.rect(rectX, rectY, rectW, rectH);
           doc.rect(rectX + 0.04, rectY + 0.04, rectW - 0.08, rectH - 0.08);
        }
        else {
           if (typeof doc.setLineDash === 'function') {
               if (formatting.pageBorder === 'dashed') {
                   doc.setLineDash([0.1, 0.1], 0);
               } else if (formatting.pageBorder === 'dotted') {
                   doc.setLineDash([0.03, 0.05], 0);
               }
           }
           doc.rect(rectX, rectY, rectW, rectH);
           if (typeof doc.setLineDash === 'function') {
               doc.setLineDash([], 0);
           }
        }
      }
    }

    doc.save(filename)
  } finally {
    container.remove()
  }
}

// Added isWebPreview parameter!
export function convertMarkdownToHtml(markdown: string, formatting: FormattingSettings = defaultFormatting, isWebPreview: boolean = false): string {
  let html = normalizeAssignmentContent(markdown)

  const justifyStyle = formatting.justifyAlignment ? 'text-align: justify;' : '';
  const weightStyle = formatting.headingBold ? 'font-weight: bold;' : 'font-weight: normal;';

  const headingStyle = `font-family:${formatting.headingFont};font-size:${formatting.headingSize}pt;${weightStyle}${justifyStyle}`
  const bodyStyle = `font-family:${formatting.bodyFont};font-size:${formatting.bodySize}pt;${justifyStyle}`
  const headingClass = 'text-slate-900 dark:text-slate-100'
  
  html = html.replace(/^###### (.*?)$/gm, `<h6 class="mt-4 mb-2 text-base ${headingClass}" style="${headingStyle}">$1</h6>`)
  html = html.replace(/^##### (.*?)$/gm, `<h5 class="mt-4 mb-2 text-lg ${headingClass}" style="${headingStyle}">$1</h5>`)
  html = html.replace(/^#### (.*?)$/gm, `<h4 class="mt-4 mb-2 text-xl ${headingClass}" style="${headingStyle}">$1</h4>`)
  html = html.replace(/^### (.*?)$/gm, `<h3 class="mt-4 mb-2 text-2xl ${headingClass}" style="${headingStyle}">$1</h3>`)
  html = html.replace(/^## (.*?)$/gm, `<h2 class="mt-6 mb-3 text-3xl ${headingClass}" style="${headingStyle}">$1</h2>`)
  html = html.replace(/^# (.*?)$/gm, `<h1 class="mt-8 mb-4 text-4xl ${headingClass}" style="${headingStyle}">$1</h1>`)

  html = html.replace(
    /```([\s\S]*?)```/g,
    '<pre class="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg overflow-x-auto my-4"><code>$1</code></pre>'
  )

  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-sm">$1</code>')
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>')
  html = html.replace(/__(.*?)__/g, '<strong class="font-bold">$1</strong>')
  html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
  html = html.replace(/_(.*?)_/g, '<em class="italic">$1</em>')

  html = html.replace(
    /!\[(.*?)\]\((.*?)\)/g,
    '<figure class="my-4"><img src="$2" alt="$1" class="max-w-full h-auto rounded-lg border border-gray-300 dark:border-gray-600" /><figcaption class="text-sm text-gray-600 dark:text-gray-400 mt-2">$1</figcaption></figure>'
  )

  html = html.replace(
    /\[(.*?)\]\((.*?)\)/g,
    '<a href="$2" class="text-blue-600 dark:text-blue-400 underline hover:no-underline" target="_blank" rel="noopener noreferrer">$1</a>'
  )

  html = html.replace(/^\* (.*?)$/gm, '<li class="ml-4">$1</li>')
  html = html.replace(/^- (.*?)$/gm, '<li class="ml-4">$1</li>')
  html = html.replace(/^(\d+)\. (.*?)$/gm, '<li class="ml-4">$2</li>')

  html = html.replace(/(<li.*?<\/li>(?:\n<li.*?<\/li>)*)/g, `<ul class="list-disc my-2" style="${bodyStyle}">$1</ul>`)

  html = html.replace(
    /^&gt; (.*?)$/gm,
    `<blockquote class="border-l-4 border-blue-500 pl-4 py-2 my-2 italic text-gray-600 dark:text-gray-400" style="${bodyStyle}">$1</blockquote>`
  )

  html = html.replace(/^---$/gm, '<hr class="my-4 border-t-2 border-gray-300 dark:border-gray-600" />')

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
  
  // HTML Border sirf tab lagay ga jab Preview open ho, export mein nahi.
  const borderStyle = (isWebPreview && formatting.pageBorder !== 'none')
    ? `border: ${formatting.pageBorder === 'double' ? '4px double' : formatting.pageBorder === 'dashed' ? '2px dashed' : formatting.pageBorder === 'dotted' ? '2px dotted' : '2px solid'} #333; padding: 2rem; margin: 1rem 0;`
    : '';

  return `<div class="prose dark:prose-invert max-w-none" style="${borderStyle}">${wrappedParagraphs.join('')}</div>`
}
