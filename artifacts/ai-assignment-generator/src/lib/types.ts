export interface Chat {
  id: string
  user_id: string
  title: string
  created_at: string
}

export interface Message {
  id: string
  chat_id: string
  role: 'user' | 'assistant'
  content: string
  attachments?: Attachment[]
  created_at: string
}

export type PageMarginId = 'normal' | 'narrow' | 'moderate' | 'wide'

export type PageSizeId = 'a4' | 'a3' | 'letter' | 'legal' | 'executive'

// Border ke styles MS Word ki tarah define kar diye hain
export type PageBorderId = 'none' | 'solid' | 'dashed' | 'dotted' | 'double'

export interface FormattingSettings {
  bodyFont: string
  bodySize: number
  headingFont: string
  headingSize: number
  pageMargin: PageMarginId
  pageSize: PageSizeId
  // Yeh 3 naye options add kiye hain
  headingBold: boolean
  justifyAlignment: boolean
  pageBorder: PageBorderId
}

export interface UserProfile {
  id: string
  email?: string
  full_name?: string
  avatar_url?: string
}

export type User = UserProfile & { created_at?: string }

export interface Attachment {
  name: string
  type?: string
  url?: string
}
