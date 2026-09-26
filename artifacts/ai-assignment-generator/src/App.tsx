import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Check, LockKeyhole, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Providers } from '@/components/Providers';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { ChatArea } from '@/components/ChatArea';
import { SettingsModal } from '@/components/SettingsModal';
import { getUserChats, deleteChat } from '@/lib/supabase';
import type { Chat } from '@/lib/types';
import toast from 'react-hot-toast';

function SignInScreen() {
  const { loading, signIn, error } = useAuth();

  return (
    <main className="mesh-bg relative flex min-h-screen items-center justify-center overflow-hidden p-5 text-slate-900 dark:text-white">
      <div className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl" />
      <section className="glass-surface relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] text-slate-900 shadow-2xl shadow-indigo-950/10 dark:text-white lg:grid-cols-[1.1fr_.9fr]">
        <div className="hidden flex-col justify-between border-r border-slate-200/80 p-10 lg:flex dark:border-white/10">
          <div>
            <div className="flex items-center gap-3">
              <img src="https://i.ibb.co/vxJhjmsb/file-00000000d538820ba71ac50a1b516eac.png" alt="Website Logo" style={{ height: 30, width: 'auto' }} />
              <span className="font-semibold tracking-tight">Assignment Writing</span>
            </div>
            <div className="mt-24 max-w-md">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-700/30 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-300/20 dark:text-emerald-200">
                <Sparkles size={13} /> AI-powered writing desk
              </span>
              <h1 className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight">Turn a rough idea into your best work.</h1>
              <p className="mt-6 text-base leading-7 text-slate-600 dark:text-slate-400">A focused space to think, generate, refine, and keep every assignment beautifully organized.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-500">
            <Check size={15} className="text-emerald-500 dark:text-emerald-400" /> Private workspace · Built for deep work
          </div>
        </div>
        <div className="p-7 sm:p-12">
          <div className="flex items-center gap-3 lg:hidden">
            <img src="https://i.ibb.co/vxJhjmsb/file-00000000d538820ba71ac50a1b516eac.png" alt="Website Logo" style={{ height: 30, width: 'auto' }} />
            <span className="font-semibold">Assignment Writing</span>
          </div>
          <div className="mt-14 lg:mt-16">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-200">Welcome</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Welcome to Assignment Writing</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">Sign in to start creating your academic assignments effortlessly.</p>
            <button
              className="mt-9 flex min-h-14 w-full items-center justify-between rounded-2xl border border-white/15 bg-gradient-to-r from-blue-500/90 via-violet-500/90 to-fuchsia-500/90 px-4 py-4 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-fuchsia-500/25 disabled:opacity-50"
              onClick={() => void signIn()}
              disabled={loading}
            >
              <span className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
                  <span className="text-lg font-bold text-[#4285f4]">G</span>
                </span>
                {loading ? 'Connecting...' : 'Continue with Google'}
              </span>
              <ArrowRight size={17} />
            </button>
            {error && <p className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">{error}</p>}
            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-300">
              <LockKeyhole size={13} /> Secure sign-in
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function LoadingScreen() {
  return (
    <div className="mesh-bg flex min-h-screen items-center justify-center">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
    </div>
  );
}

function Workspace() {
  const { session, loading, isAuthenticated } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const loadChats = useCallback(async () => {
    if (!session?.user.id) {
      setChats([]);
      return;
    }
    const result = await getUserChats(session.user.id);
    if (result.error) {
      toast.error('Could not load your assignments');
      return;
    }
    setChats((result.data || []) as Chat[]);
  }, [session?.user.id]);

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  const handleDeleteChat = async (chat: Chat) => {
    const result = await deleteChat(chat.id);
    if (result.error) {
      toast.error('Could not delete this assignment');
      return;
    }
    if (activeChatId === chat.id) setActiveChatId(null);
    void loadChats();
    toast.success('Assignment deleted');
  };

  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <SignInScreen />;

  return (
    <div className="mesh-bg flex h-[100dvh] flex-col text-slate-900 dark:text-white">
      <div className="fixed inset-0 z-0" />
      <div className="relative z-10 flex h-full flex-col">
        <Header onMenu={() => setSidebarOpen(true)} onSettings={() => setSettingsOpen(true)} />
        <Sidebar
          chats={chats}
          activeChat={activeChatId}
          onSelect={(id) => {
            setActiveChatId(id);
            setSidebarOpen(false);
          }}
          onNew={() => {
            setActiveChatId(null);
            setSidebarOpen(false);
          }}
          onDelete={(chat) => void handleDeleteChat(chat)}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex min-h-0 flex-1 flex-col">
          <ChatArea
            chatId={activeChatId}
            onChatCreated={(chat) => setActiveChatId(chat.id)}
            onMessageSaved={() => void loadChats()}
          />
        </main>
      </div>
      {settingsOpen && <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <Providers>
      <Workspace />
    </Providers>
  );
}