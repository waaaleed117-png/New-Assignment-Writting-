'use client'

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Message, FormattingSettings } from '@/lib/types'
import { defaultFormatting } from '@/lib/formatting'
import { Check, Copy, Download, X } from 'lucide-react'
import { convertMarkdownToHtml } from '@/lib/export'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

interface ChatMessageProps {
  message: Message
  formatting?: FormattingSettings
}

export default function ChatMessage({ message, formatting = defaultFormatting }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const [showPreview, setShowPreview] = useState(false)
  const [copied, setCopied] = useState(false)

  const chatFormatting = { ...formatting, pageBorder: 'none' as const }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    toast.success(isUser ? 'Message copied' : 'Assignment copied')
    window.setTimeout(() => setCopied(false), 1500)
  }

  const handleDownloadPDF = async () => {
    try {
      const { exportToPDF } = await import('@/lib/export')
      // PDF export mein false pass karna zaroori hai taake HTML ka double border na aaye
      const htmlContent = convertMarkdownToHtml(message.content, formatting, false)
      await exportToPDF(htmlContent, 'assignment.pdf', formatting)
      toast.success('PDF downloaded successfully')
    } catch (error) {
      toast.error('Failed to download PDF')
      console.error('Error downloading PDF:', error)
    }
  }

  const handleDownloadDocx = async () => {
    try {
      const { exportToDocx } = await import('@/lib/export')
      await exportToDocx(message.content, 'assignment.docx', formatting)
      toast.success('Word document downloaded successfully')
    } catch (error) {
      toast.error('Failed to download Word document')
      console.error('Error downloading DOCX:', error)
    }
  }

  return (
    <>
    <motion.div
      className={`flex gap-2 sm:gap-4 mb-6 ${isUser ? 'justify-end' : 'items-start justify-start'}`}
      initial={{ opacity: 0, x: isUser ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      {!isUser && (
        <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-xs font-bold text-white shadow-lg shadow-indigo-500/20">
          ✦
        </div>
      )}

      <div
          className={`min-w-0 rounded-2xl p-4 shadow-sm sm:p-5 ${
          isUser
            ? 'max-w-[min(86%,36rem)] bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-indigo-500/15'
            : 'w-full glass-surface text-slate-900 dark:text-slate-100'
        }`}
      >
        <div className="prose dark:prose-invert prose-sm max-w-none">
          {isUser ? (
            <div className="flex flex-col gap-2">
              <p className="whitespace-pre-wrap">{message.content}</p>
              <div className="flex justify-end border-t border-white/20 pt-2 mt-1">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-white/80 transition-colors hover:text-white"
                  title="Copy your message"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          ) : (
            <div
              dangerouslySetInnerHTML={{
                __html: convertMarkdownToHtml(message.content, chatFormatting, false),
              }}
                className="prose-content dark:prose-invert"
            />
          )}
        </div>

        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {message.attachments.map((attachment, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1 text-sm dark:bg-white/10"
              >
                {attachment.type === 'image' ? '🖼️' : '📄'} {attachment.name}
              </div>
            ))}
          </div>
        )}

        {!isUser && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-white/10">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 rounded-lg bg-rose-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-rose-600"
            >
              <Download size={16} />
              PDF
            </button>
            <button
              onClick={handleDownloadDocx}
              className="flex items-center gap-2 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-600"
            >
              <Download size={16} />
              Word
            </button>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-white/10 dark:hover:bg-white/20"
            >
              👁️ Document Preview
            </button>
          </div>
        )}
      </div>
    </motion.div>
    
    {showPreview && !isUser && createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowPreview(false)}>
        <div role="dialog" aria-modal="true" aria-labelledby="preview-title" className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-slate-900/90 shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between gap-4 border-b border-white/10 p-4 sm:p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-400">Document preview</p>
              <h2 id="preview-title" className="mt-1 text-lg font-bold text-white">How your assignment will look</h2>
            </div>
            <button type="button" onClick={() => setShowPreview(false)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10" aria-label="Close preview"><X size={18} /></button>
          </div>
          <div className="overflow-y-auto p-4 sm:p-6">
            <article className="preview-paper prose prose-sm mx-auto w-full max-w-2xl rounded-2xl bg-white p-6 text-slate-900 shadow-lg sm:p-10 sm:rounded-3xl"
              dangerouslySetInnerHTML={{ __html: convertMarkdownToHtml(message.content, formatting, true) }}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 p-4">
            <button type="button" onClick={() => setShowPreview(false)} className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10">Close</button>
            <button type="button" onClick={() => { setShowPreview(false); void handleDownloadPDF() }} className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-600">Download PDF</button>
            <button type="button" onClick={() => { setShowPreview(false); void handleDownloadDocx() }} className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-600">Download Word</button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  )
}
