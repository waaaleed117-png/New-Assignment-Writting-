'use client'

import React, { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Send, Plus, X, SlidersHorizontal } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import type { FormattingSettings } from '@/lib/types'
import {
  BODY_SIZE_OPTIONS,
  defaultFormatting,
  FONT_OPTIONS,
  HEADING_SIZE_OPTIONS,
  PAGE_MARGIN_OPTIONS,
  PAGE_SIZE_OPTIONS,
} from '@/lib/formatting'

interface Attachment {
  id: string
  file: File
  preview?: string
}

interface ChatInputProps {
  onSendMessage: (content: string, attachments?: any[], pageLength?: number, formatting?: FormattingSettings) => Promise<void>
  disabled?: boolean
}

export default function ChatInput({ onSendMessage, disabled = false }: ChatInputProps) {
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [sending, setSending] = useState(false)
  const [pageLength, setPageLength] = useState(1)
  const [formatting, setFormatting] = useState<FormattingSettings>({ ...defaultFormatting })
  const [formattingOpen, setFormattingOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleAttachFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])

    files.forEach((file) => {
      // Validate file type and size
      const maxSize = 10 * 1024 * 1024 // 10MB
      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ]

      if (file.size > maxSize) {
        toast.error(`File ${file.name} is too large (max 10MB)`)
        return
      }

      if (!allowedTypes.includes(file.type)) {
        toast.error(`File type not supported: ${file.type}`)
        return
      }

      // Create preview for images
      let preview: string | undefined

      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (event) => {
          setAttachments((prev) =>
            prev.map((att) =>
              att.file.name === file.name
                ? { ...att, preview: event.target?.result as string }
                : att
            )
          )
        }
        reader.readAsDataURL(file)
      }

      setAttachments((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          file,
          preview,
        },
      ])

      toast.success(`${file.name} attached`)
    })

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((att) => att.id !== id))
  }

  const handleAutoExpand = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }

  const readFileAsDataURL = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })

  const handleSend = async () => {
    if (!input.trim() && attachments.length === 0) {
      toast.error('Please enter a message or attach a file')
      return
    }

    setSending(true)
    try {
      const attachmentPayloads = await Promise.all(
        attachments.map(async (att) => ({
          name: att.file.name,
          mimeType: att.file.type,
          data: await readFileAsDataURL(att.file),
        }))
      )
      // pageLength 0 is forwarded as-is so the server can tell "Select" apart
      // from a real choice.
      await onSendMessage(input, attachmentPayloads, pageLength, formatting)
      setInput('')
      setAttachments([])

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch (error) {
      toast.error('Failed to send message')
      console.error('Error sending message:', error)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <motion.div
      className="glass-surface rounded-none border-x-0 border-b-0 p-4 backdrop-blur-xl sm:p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <motion.div
          className="flex flex-wrap gap-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {attachments.map((att) => (
            <motion.div
              key={att.id}
              className="relative group"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              {att.preview ? (
                <img
                  src={att.preview}
                  alt={att.file.name}
                  className="h-20 w-20 rounded-xl border border-slate-200 object-cover dark:border-white/10"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-100 text-2xl dark:bg-white/10">
                  📄
                </div>
              )}
              <button
                onClick={() => handleRemoveAttachment(att.id)}
                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Input Area */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        {/* Attach Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || sending}
          className="flex-shrink-0 rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Attach file"
        >
          <Plus size={20} />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleAttachFile}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx"
        />

        {/* Text Input */}
        <div className="flex min-w-0 flex-1 items-end gap-2 rounded-2xl border border-white/70 bg-white/35 px-3 py-3 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/10 sm:px-4">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              handleAutoExpand()
            }}
            onKeyDown={handleKeyDown}
            placeholder="Enter your topic, instructions, or research questions here..."
            disabled={disabled || sending}
            className="flex-1 resize-none bg-transparent text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white dark:placeholder:text-slate-500"
            rows={1}
            style={{ maxHeight: '200px', minHeight: '44px' }}
          />

          {/* Send Button */}
          <motion.button
            onClick={handleSend}
            disabled={disabled || sending || (!input.trim() && attachments.length === 0)}
            className="flex-shrink-0 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 p-2.5 text-white shadow-md shadow-indigo-500/20 transition duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:grayscale"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Send message"
          >
            {sending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </motion.button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
        <button type="button" onClick={() => setFormattingOpen(true)} className="btn-secondary px-3 py-2 text-xs" aria-label="Open assignment formatting"><SlidersHorizontal size={15} /> Formatting</button>
        <label className="flex items-center gap-2">
        Pages
        <select
          value={pageLength}
          onChange={(event) => setPageLength(event.target.value === '' ? 0 : Number(event.target.value))}
          disabled={disabled || sending}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-900 dark:border-white/10 dark:bg-white/10 dark:text-white"
        >
          <option value="" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Select</option>
          {Array.from({ length: 15 }, (_, index) => index + 1).map((pages) => (
            <option key={pages} value={pages} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">{pages}</option>
          ))}
        </select>
        </label>
      </div>

      {formattingOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm pt-6 pb-6" onClick={() => setFormattingOpen(false)}>
        <div role="dialog" aria-modal="true" aria-labelledby="formatting-title" className="bg-slate-50 dark:bg-slate-900 w-full max-w-lg self-start rounded-3xl p-4 sm:p-6 border border-slate-200 dark:border-slate-700 shadow-2xl shrink-0" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">Document style</p><h2 id="formatting-title" className="mt-2 text-xl font-bold text-slate-950 dark:text-white">Format your assignment</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Choose the type and scale for the generated document.</p></div>
            <button type="button" onClick={() => setFormattingOpen(false)} className="min-h-11 min-w-11 rounded-xl p-2 text-slate-600 transition hover:bg-slate-200/70 dark:text-slate-400 dark:hover:bg-white/10" aria-label="Close formatting"><X size={18} /></button>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Body font<select value={formatting.bodyFont} onChange={(event) => setFormatting((current) => ({ ...current, bodyFont: event.target.value }))} className="input-field mt-2">{FONT_OPTIONS.map((font) => <option key={font} value={font}>{font}</option>)}</select></label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Body size<select value={formatting.bodySize} onChange={(event) => setFormatting((current) => ({ ...current, bodySize: Number(event.target.value) }))} className="input-field mt-2">{BODY_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} pt</option>)}</select></label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Heading font<select value={formatting.headingFont} onChange={(event) => setFormatting((current) => ({ ...current, headingFont: event.target.value }))} className="input-field mt-2">{FONT_OPTIONS.map((font) => <option key={font} value={font}>{font}</option>)}</select></label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Heading size<select value={formatting.headingSize} onChange={(event) => setFormatting((current) => ({ ...current, headingSize: Number(event.target.value) }))} className="input-field mt-2">{HEADING_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} pt</option>)}</select></label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Page margin<select value={formatting.pageMargin} onChange={(event) => setFormatting((current) => ({ ...current, pageMargin: event.target.value as FormattingSettings['pageMargin'] }))} className="input-field mt-2">{PAGE_MARGIN_OPTIONS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select></label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Page size<select value={formatting.pageSize} onChange={(event) => setFormatting((current) => ({ ...current, pageSize: event.target.value as FormattingSettings['pageSize'] }))} className="input-field mt-2">{PAGE_SIZE_OPTIONS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select></label>
          </div>
          <button type="button" onClick={() => setFormattingOpen(false)} className="btn-primary mt-6 w-full">Apply formatting</button>
        </div>
      </div>,
        document.body
      )}

      {/* Help Text */}
      <p className="text-center text-xs text-slate-400 dark:text-slate-500">
        Press Enter to send, Shift+Enter for new line
      </p>
    </motion.div>
  )
}
