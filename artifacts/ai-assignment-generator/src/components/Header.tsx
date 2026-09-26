'use client'

import { Menu, Settings, Sun, Moon } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from 'next-themes'

export function Header({ onMenu, onSettings }: { onMenu: () => void; onSettings?: () => void }) {
  const { user } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()
  return <header className="glass-surface flex h-[4.5rem] shrink-0 items-center justify-between rounded-none border-x-0 border-t-0 px-3 backdrop-blur-xl sm:px-7">
    <div className="flex min-w-0 items-center gap-2 sm:gap-3"><button className="min-h-11 min-w-11 rounded-xl p-2 text-slate-500 transition hover:scale-105 hover:bg-white/50 dark:text-slate-400 dark:hover:bg-white/10" onClick={onMenu} aria-label="Toggle chat history"><Menu size={20} /></button><img src="https://i.ibb.co/vxJhjmsb/file-00000000d538820ba71ac50a1b516eac.png" alt="Website Logo" style={{ height: 30, width: 'auto' }} /><div className="min-w-0"><p className="truncate text-xs font-bold tracking-wide text-slate-900 dark:text-white sm:text-sm">ASSIGNMENT WRITING</p><p className="hidden text-[11px] text-slate-500 dark:text-slate-400 sm:block">A calmer place to write</p></div></div>
    <div className="flex items-center gap-1">{user && <><button onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} className="min-h-11 min-w-11 rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10" title="Toggle theme">{resolvedTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button><button onClick={onSettings} className="flex min-h-11 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10" title="Settings"><Settings size={17} /><span className="hidden sm:inline">Settings</span></button></>}</div>
  </header>
}
