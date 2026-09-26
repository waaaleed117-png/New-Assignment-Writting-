'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { getSupabaseClient, getUserProfile } from '@/lib/supabase'
import { User } from '@/lib/types'

interface AuthContextType {
  session: Session | null
  user: User | null
  loading: boolean
  error: string | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check current session on mount
    const checkSession = async () => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined
      try {
        const client = getSupabaseClient()
        if (!client) throw new Error('Authentication service is not configured')
        const sessionRequest = client.auth.getSession()
        const timeoutRequest = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Authentication is taking too long. Please sign in again.')), 8000)
        })
        const { data, error } = await Promise.race([sessionRequest, timeoutRequest])
        if (error) throw error

        setSession(data.session)

        if (data.session?.user) {
          const { data: profile, error: profileError } = await getUserProfile(
            data.session.user.id
          )
          if (profileError && (!('code' in profileError) || profileError.code !== 'PGRST116')) {
            console.error('Profile lookup error:', profileError)
          }
          setUser(
            profile || {
              id: data.session.user.id,
              email: data.session.user.email || '',
              full_name: data.session.user.user_metadata?.full_name || data.session.user.user_metadata?.name,
              avatar_url: data.session.user.user_metadata?.avatar_url,
              created_at: new Date().toISOString(),
            }
          )
        }
      } catch (err) {
        console.error('Session check error:', err)
        setError(err instanceof Error ? err.message : 'Authentication error')
      } finally {
        if (timeoutId) clearTimeout(timeoutId)
        setLoading(false)
      }
    }

    checkSession()

    // Listen for auth changes
    const client = getSupabaseClient()
    const authListener = client?.auth.onAuthStateChange(
      async (_event: string, newSession: any) => {
        setSession(newSession)

        if (newSession?.user) {
          try {
            const { data: profile } = await getUserProfile(newSession.user.id)
            setUser(
              profile || {
                id: newSession.user.id,
                email: newSession.user.email || '',
                  full_name: newSession.user.user_metadata?.full_name || newSession.user.user_metadata?.name,
                avatar_url: newSession.user.user_metadata?.avatar_url,
                created_at: new Date().toISOString(),
              }
            )
          } catch (err) {
            console.error('Error fetching user profile:', err)
            setUser({
              id: newSession.user.id,
              email: newSession.user.email || '',
              avatar_url: newSession.user.user_metadata?.avatar_url,
              created_at: new Date().toISOString(),
            })
          }
        } else {
          setUser(null)
        }
      }
    ).data

    return () => {
      authListener?.subscription.unsubscribe()
    }
  }, [])

  const signIn = async () => {
    try {
      setError(null)
      const client = getSupabaseClient()
      if (!client) throw new Error('Authentication service is not configured')
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      })

      if (error) throw error
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sign in failed'
      setError(errorMessage)
      throw err
    }
  }

  const signOut = async () => {
    try {
      setError(null)
      const client = getSupabaseClient()
      if (!client) throw new Error('Authentication service is not configured')
      const { error } = await client.auth.signOut()
      if (error) throw error

      setSession(null)
      setUser(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sign out failed'
      setError(errorMessage)
      throw err
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        error,
        signIn,
        signOut,
        isAuthenticated: !!session,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
