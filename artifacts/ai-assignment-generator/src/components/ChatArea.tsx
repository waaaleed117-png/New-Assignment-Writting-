'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { addMessage, createChat, getChatMessages, updateChat } from '@/lib/supabase'
import type { Attachment, Chat, Message, FormattingSettings } from '@/lib/types'
import { defaultFormatting } from '@/lib/formatting'
import ChatInput from '@/components/ChatInput'
import ChatMessage from '@/components/ChatMessage'

interface ChatAreaProps {
  chatId: string | null
  onChatCreated?: (chat: Chat) => void
  onMessageSaved?: () => void
}

export function ChatArea({ chatId, onChatCreated, onMessageSaved }: ChatAreaProps) {
  const { session } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [generating, setGenerating] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [formatting, setFormatting] = useState<FormattingSettings>({ ...defaultFormatting })
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    async function loadMessages() {
      if (!chatId || chatId.startsWith('local-')) {
        setMessages([])
        return
      }
      setLoadingMessages(true)
      const result = await getChatMessages(chatId)
      if (active) {
        if (result.error) toast.error('Could not load this assignment history')
        setMessages((result.data || []) as Message[])
        setLoadingMessages(false)
      }
    }
    void loadMessages()
    return () => { active = false }
  }, [chatId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, generating])

  async function handleSend(content: string, attachments: Attachment[] = [], pageLength = 0, nextFormatting = formatting) {
    if (!content.trim() || generating) return

    let currentChatId = chatId
    const title = content.trim().slice(0, 25)
    
    if (!currentChatId) {
      if (!session?.user.id) {
        toast.error('Please sign in before sending a message')
        return
      }
      const chatResult = await createChat(session.user.id, title)
      if (chatResult.error || !chatResult.data) {
        toast.error('Could not create this assignment')
        return
      }
      currentChatId = chatResult.data.id
      onChatCreated?.(chatResult.data as Chat)
    } else if (!currentChatId.startsWith('local-') && messages.length === 0) {
      const titleResult = await updateChat(currentChatId, title)
      if (titleResult.error) {
        toast.error('Could not update this assignment title')
        return
      }
    }
    if (!currentChatId) return

    const localId = `local-${Date.now()}`
    const userMessage: Message = {
      id: localId,
      chat_id: currentChatId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    }
    setMessages((current) => [...current, userMessage])
    setGenerating(true)
    setFormatting(nextFormatting)

    const userMessageResult = await addMessage(currentChatId, 'user', content)
    if (userMessageResult.error) {
      setMessages((current) => current.filter((message) => message.id !== localId))
      setGenerating(false)
      toast.error('Could not save your message')
      return
    }

    try {
      const response = await fetch('/api/generate-assignment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          prompt: content,
          pageLength,
          attachments,
          attachmentContext: attachments.map((attachment) => attachment.name).join(', '),
          formatting: nextFormatting,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Assignment generation failed')
      }

      if (!response.body) throw new Error('No response body from server')

      const assistantLocalId = `assistant-${Date.now()}`
      setMessages((current) => [
        ...current,
        {
          id: assistantLocalId,
          chat_id: currentChatId as string,
          role: 'assistant',
          content: '',
          created_at: new Date().toISOString(),
        },
      ])

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let aiText = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim() === '') continue
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim()
            if (dataStr === '[DONE]') continue

            try {
              const parsed = JSON.parse(dataStr)
              if (parsed.error) throw new Error(parsed.error)
              if (parsed.text) {
                aiText += parsed.text
                setMessages((current) =>
                  current.map((msg) =>
                    msg.id === assistantLocalId ? { ...msg, content: aiText } : msg
                  )
                )
              }
            } catch (e) {
              if (e instanceof Error && e.message !== "Unexpected end of JSON input") {
                 console.error('Stream parsing error:', e)
              }
            }
          }
        }
      }

      // Jab stream complete ho jaye, tab Supabase mein message save karein
      if (!aiText) throw new Error('The generated assignment was empty')
      
      const assistantMessageResult = await addMessage(currentChatId, 'assistant', aiText)
      if (assistantMessageResult.error) throw new Error('Could not save the generated assignment')
      
      onMessageSaved?.()
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== localId))
      toast.error(error instanceof Error ? error.message : 'Could not generate assignment')
    } finally {
      setGenerating(false)
    }
  }

  if (loadingMessages) {
    return <div className="flex flex-1 items-center justify-center text-sm text-slate-500 dark:text-slate-400">Loading assignment...</div>
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-6 sm:px-8 sm:py-10">
        {messages.length === 0 ? (
           <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center text-center">
             <div className="flex h-16 w-16 items-center justify-center" />
             <p className="mt-8 text-xs font-bold uppercase tracking-[0.24em] text-indigo-500 dark:text-indigo-300">Assignment Writing</p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">What are you working on today?</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">Start with an idea, question, or set of instructions. We will help you shape it into clear academic work.</p>
            <div className="mt-6 grid w-full max-w-3xl grid-cols-3 gap-2 text-left sm:mt-8 sm:gap-3">
              <div className="glass-surface rounded-xl p-2.5 transition duration-300 hover:-translate-y-1 hover:shadow-blue-500/10 sm:rounded-2xl sm:p-4"><p className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-200 sm:text-sm">Quick Draft</p><p className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400 sm:mt-2 sm:text-xs sm:leading-5">Generate a short outline or quick summary.</p></div>
              <div className="glass-surface rounded-xl p-2.5 transition duration-300 hover:-translate-y-1 hover:shadow-fuchsia-500/10 sm:rounded-2xl sm:p-4"><p className="text-[11px] font-semibold text-fuchsia-700 dark:text-fuchsia-200 sm:text-sm">Detailed Assignment</p><p className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400 sm:mt-2 sm:text-xs sm:leading-5">Create a full, structured assignment.</p></div>
              <div className="glass-surface rounded-xl p-2.5 transition duration-300 hover:-translate-y-1 hover:shadow-emerald-500/10 sm:rounded-2xl sm:p-4"><p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-200 sm:text-sm">Essay &amp; Structure</p><p className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400 sm:mt-2 sm:text-xs sm:leading-5">Develop a complex essay structure.</p></div>
            </div>
          </motion.div>
        ) : messages.map((message) => <ChatMessage key={message.id} message={message} formatting={formatting} />)}
        {generating && <div className="mx-auto mt-4 flex max-w-3xl items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" /> Writing your assignment...</div>}
        <div ref={endRef} />
      </div>
      <ChatInput onSendMessage={handleSend} disabled={generating} />
    </section>
  )
}
