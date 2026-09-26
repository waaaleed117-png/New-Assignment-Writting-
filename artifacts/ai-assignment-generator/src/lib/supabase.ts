import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anonKey = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
let client: SupabaseClient | null = null

export function getSupabaseClient() {
  if (!client && url && anonKey) {
    client = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  }
  return client
}

export const supabase = {
  get auth() { return getSupabaseClient()?.auth },
}

export async function getSession() {
  const supabaseClient = getSupabaseClient()
  if (!supabaseClient) return { session: null, error: new Error('Database service is not configured') }
  const { data, error } = await supabaseClient.auth.getSession()
  return { session: data.session, error }
}

export async function getUserProfile(userId: string) {
  const supabaseClient = getSupabaseClient()
  if (!supabaseClient) return { data: null, error: new Error('Database service is not configured') }
  return supabaseClient.from('profiles').select('*').eq('id', userId).single()
}

export async function getUserChats(userId: string) {
  const supabaseClient = getSupabaseClient()
  if (!supabaseClient) return { data: [], error: new Error('Database service is not configured') }
  return supabaseClient.from('chats').select('*').eq('user_id', userId).order('created_at', { ascending: false })
}

export async function createChat(userId: string, title: string) {
  const supabaseClient = getSupabaseClient()
  if (!supabaseClient) return { data: null, error: new Error('Database service is not configured') }
  return supabaseClient.from('chats').insert({ user_id: userId, title }).select().single()
}

export async function deleteChat(chatId: string) {
  const supabaseClient = getSupabaseClient()
  if (!supabaseClient) return { error: new Error('Database service is not configured') }
  return supabaseClient.from('chats').delete().eq('id', chatId)
}

export async function getChatMessages(chatId: string) {
  const supabaseClient = getSupabaseClient()
  if (!supabaseClient) return { data: [], error: new Error('Database service is not configured') }
  return supabaseClient.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true })
}

export async function addMessage(chatId: string, role: 'user' | 'assistant', content: string) {
  const supabaseClient = getSupabaseClient()
  if (!supabaseClient) return { data: null, error: new Error('Database service is not configured') }
  return supabaseClient.from('messages').insert({ id: crypto.randomUUID(), chat_id: chatId, role, content }).select().single()
}

export async function updateChat(chatId: string, title: string) {
  const supabaseClient = getSupabaseClient()
  if (!supabaseClient) return { data: null, error: new Error('Database service is not configured') }
  return supabaseClient.from('chats').update({ title }).eq('id', chatId).select().single()
}
