import type { FormattingSettings, PageMarginId, PageSizeId } from '@/lib/types'

export const FONT_OPTIONS = [
  'Arial',
  'Calibri',
  'Times New Roman',
  'Georgia',
  'Verdana',
  'Elephant',
  'Garamond',
  'Tahoma',
  'Century Gothic',
  'Comic Sans MS',
  'Courier New',
] as const

export const BODY_SIZE_OPTIONS = Array.from({ length: 15 }, (_, index) => index + 10)
export const HEADING_SIZE_OPTIONS = Array.from({ length: 19 }, (_, index) => index + 14)

/** All measurements are in inches, matching the MS Word presets. */
export interface PageMarginPreset {
  id: PageMarginId
  label: string
  top: number
  right: number
  bottom: number
  left: number
}

export const PAGE_MARGIN_OPTIONS: readonly PageMarginPreset[] = [
  { id: 'normal', label: 'Normal', top: 1, right: 1, bottom: 1, left: 1 },
  { id: 'narrow', label: 'Narrow', top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 },
  { id: 'moderate', label: 'Moderate', top: 1, right: 0.75, bottom: 1, left: 0.75 },
  { id: 'wide', label: 'Wide', top: 1, right: 2, bottom: 1, left: 2 },
] as const

export interface PageSizePreset {
  id: PageSizeId
  label: string
  /** Portrait width in inches. */
  width: number
  /** Portrait height in inches. */
  height: number
}

export const PAGE_SIZE_OPTIONS: readonly PageSizePreset[] = [
  { id: 'a4', label: 'A4', width: 8.27, height: 11.69 },
  { id: 'a3', label: 'A3', width: 11.69, height: 16.54 },
  { id: 'letter', label: 'Letter', width: 8.5, height: 11 },
  { id: 'legal', label: 'Legal', width: 8.5, height: 14 },
  { id: 'executive', label: 'Executive', width: 7.25, height: 10.5 },
] as const

const FALLBACK_MARGIN = PAGE_MARGIN_OPTIONS[0]
const FALLBACK_SIZE = PAGE_SIZE_OPTIONS[0]

export function getPageMargin(id: PageMarginId | undefined): PageMarginPreset {
  return PAGE_MARGIN_OPTIONS.find((preset) => preset.id === id) ?? FALLBACK_MARGIN
}

export function getPageSize(id: PageSizeId | undefined): PageSizePreset {
  return PAGE_SIZE_OPTIONS.find((preset) => preset.id === id) ?? FALLBACK_SIZE
}

/** Printable area for a page preset once the margins are removed, in inches. */
export function getContentBox(
  pageSize: PageSizePreset,
  pageMargin: PageMarginPreset
) {
  return {
    width: pageSize.width - pageMargin.left - pageMargin.right,
    height: pageSize.height - pageMargin.top - pageMargin.bottom,
  }
}

export const defaultFormatting: FormattingSettings = {
  bodyFont: 'Arial',
  bodySize: 12,
  headingFont: 'Arial',
  headingSize: 18,
  pageMargin: 'normal',
  pageSize: 'a4',
}
