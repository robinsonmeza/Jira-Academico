import React, { useState } from 'react';
import { useJira } from '../context/JiraContext';
import { Kanban, Lock, User as UserIcon, ShieldAlert, Sparkles, ShieldCheck, GraduationCap, Code2, Server } from 'lucide-react';
import { ROLE_LABELS } from '../types/jira';

export const LoginView: React.FC = () => {
  const { login, users } = useJira();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim()) {
      setError('Por favor ingresa tu nombre de usuario');
      return;
    }
    const res = login(username, password);
    if (!res.success) {
      setError(res.error || 'Credenciales incorrectas');
    }
  };

  const quickLogin = (userUsername: string, userPass?: string) => {
    setUsername(userUsername);
    setPassword(userPass || 'Clave123.');
    setError(null);
    login(userUsername, userPass || 'Clave123.');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 shadow-xl shadow-indigo-500/25 mb-4 text-white">
          <Kanban className="w-9 h-9" />
        </div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">Jira Board</h2>
        <p className="mt-2 text-sm text-slate-400">
          Inicia sesión para acceder a tus proyectos, tableros Kanban y sprints asignados.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-slate-900 py-8 px-6 shadow-2xl rounded-2xl border border-slate-800 sm:px-10">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Usuario
              </label>
              <div className="relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ej. Robinson_meza, docente_maria, etc."
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-medium"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Contraseña
              </label>
              <div className="relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex justify-center py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-md shadow-indigo-500/25 cursor-pointer mt-2"
            >
              Ingresar al Sistema
            </button>
          </form>

          {/* Quick Login Section */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Cuentas de acceso rápido
              </span>
              <span className="text-[11px] text-amber-400 flex items-center gap-1 font-medium">
                <Sparkles className="w-3 h-3" /> 1 Clic
              </span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {users.map((u) => {
                const isPM = u.is_admin || u.role === 'admin';
                const isPO = u.role === 'po';
                const isFE = u.role === 'frontend';
                const isBE = u.role === 'backend';

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => quickLogin(u.username, u.password)}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-indigo-500/80 hover:bg-slate-950 transition-all flex items-center justify-between group shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs text-white font-bold shrink-0 shadow-inner"
                        style={{ backgroundColor: u.avatar_color }}
                      >
                        {u.name.charAt(0)}
                      </span>
                      <div>
                        <div className="text-xs font-semibold text-slate-200 group-hover:text-indigo-400 transition-colors flex items-center gap-1.5">
                          <span>{u.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Usuario: <span className="font-mono text-slate-300">@{u.username}</span> | Clave:{' '}
                          <span className="font-mono text-slate-300">{u.password || 'Clave123.'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      {isPM && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md font-semibold">
                          <ShieldCheck className="w-3 h-3" /> PM (Admin)
                        </span>
                      )}
                      {isPO && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-md font-semibold">
                          <GraduationCap className="w-3 h-3" /> Product Owner
                        </span>
                      )}
                      {isFE && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-md font-semibold">
                          <Code2 className="w-3 h-3" /> Frontend
                        </span>
                      )}
                      {isBE && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md font-semibold">
                          <Server className="w-3 h-3" /> Backend
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
