"use client";

import { X, Settings, LogOut, Mail } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, signOut } = useAuth();
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="glass-surface max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl p-5 sm:max-w-md sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-fuchsia-500 text-white">
              <Settings size={18} />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
              Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-xl p-2 text-slate-500 transition hover:scale-105 hover:bg-white/50 dark:text-slate-400 dark:hover:bg-white/10"
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>
        <section className="mt-6 rounded-2xl border border-indigo-300/30 bg-gradient-to-br from-indigo-950/90 via-slate-950/90 to-fuchsia-950/80 p-4 text-white shadow-lg shadow-indigo-500/10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-200">
            Account
          </p>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-fuchsia-300/40 bg-gradient-to-br from-indigo-400 to-fuchsia-500">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={`${user.full_name || "Account"} profile`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full items-center justify-center text-lg font-bold">
                  {(user?.full_name || user?.email || "A")
                    .slice(0, 1)
                    .toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {user?.full_name || "Google account"}
              </p>
              <p className="mt-1 flex min-w-0 items-center gap-1 truncate text-xs text-indigo-100/70">
                <Mail size={13} /> {user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={() => void signOut()}
            className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20"
          >
            <LogOut size={16} /> Logout
          </button>
        </section>
      </div>
    </div>
  );
}
