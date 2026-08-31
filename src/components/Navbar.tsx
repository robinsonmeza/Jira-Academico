import React, { useState } from 'react';
import { useJira } from '../context/JiraContext';
import { ROLE_LABELS } from '../types/jira';
import {
  Kanban,
  FolderKanban,
  UserCheck,
  LogOut,
  ShieldCheck,
  ChevronDown,
  UserCog,
  Cloud,
  CloudOff,
  RefreshCw,
} from 'lucide-react';
import { ManageUsersModal } from './ManageUsersModal';

interface NavbarProps {
  currentView: 'projects' | 'board';
  setCurrentView: (view: 'projects' | 'board') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, setCurrentView }) => {
  const {
    currentUser,
    currentProject,
    projects,
    users,
    currentRole,
    isCloudConnected,
    isSyncing,
    selectProject,
    switchUser,
    logout,
    resetToDemoData,
  } = useJira();

  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showManageUsersModal, setShowManageUsersModal] = useState(false);

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand & Project Selector */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => setCurrentView('projects')}
            className="flex items-center gap-2.5 text-white hover:text-indigo-400 transition-colors font-bold text-lg tracking-tight group"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 group-hover:bg-indigo-500 transition-all">
              <Kanban className="w-5 h-5" />
            </div>
            <span className="font-bold tracking-tight">Jira Board</span>
          </button>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5">
            <button
              onClick={() => setCurrentView('projects')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center gap-2 ${
                currentView === 'projects'
                  ? 'bg-slate-800 text-indigo-400 border border-slate-700 shadow-2xs'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <FolderKanban className="w-4 h-4" />
              Proyectos
            </button>

            {currentProject && (
              <div className="relative">
                <button
                  onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center gap-2 ${
                    currentView === 'board'
                      ? 'bg-slate-800 text-indigo-400 border border-slate-700 shadow-2xs'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] px-2 py-0.5 rounded font-mono font-bold">
                    {currentProject.key}
                  </span>
                  <span className="truncate max-w-[140px]">{currentProject.name}</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </button>

                {showProjectDropdown && (
                  <div
                    className="absolute left-0 mt-2 w-64 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                    onMouseLeave={() => setShowProjectDropdown(false)}
                  >
                    <div className="px-3.5 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                      Cambiar Proyecto
                    </div>
                    <div className="p-1 space-y-0.5">
                      {projects.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            selectProject(p.id);
                            setCurrentView('board');
                            setShowProjectDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center gap-2.5 hover:bg-slate-800 transition-colors ${
                            p.id === currentProject?.id ? 'text-indigo-400 bg-slate-800/80 font-bold' : 'text-slate-200'
                          }`}
                        >
                          <span className="bg-slate-950 text-slate-300 text-[11px] px-1.5 py-0.5 rounded font-mono font-semibold border border-slate-800">
                            {p.key}
                          </span>
                          <span className="truncate">{p.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>

        {/* Right Section: User & Role controls */}
        {currentUser && (
          <div className="flex items-center gap-3">
            {/* Realtime Cloud Sync Status */}
            <div
              className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                isSyncing
                  ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60'
                  : isCloudConnected
                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60'
                  : 'bg-amber-950/70 text-amber-300 border-amber-800/60'
              }`}
              title={
                isSyncing
                  ? 'Sincronizando cambios con la nube Firebase...'
                  : isCloudConnected
                  ? 'Conectado a Firebase Cloud Firestore (Colaboración en tiempo real activa)'
                  : 'Modo local activo'
              }
            >
              {isSyncing ? (
                <RefreshCw className="w-3 h-3 text-indigo-400 animate-spin" />
              ) : isCloudConnected ? (
                <Cloud className="w-3 h-3 text-emerald-400" />
              ) : (
                <CloudOff className="w-3 h-3 text-amber-400" />
              )}
              <span>{isSyncing ? 'Guardando...' : isCloudConnected ? 'Cloud Activo' : 'Offline'}</span>
            </div>

            {/* Project Manager Admin Button */}
            {currentUser.is_admin && (
              <button
                onClick={() => setShowManageUsersModal(true)}
                className="hidden sm:inline-flex items-center gap-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold px-2.5 py-1 rounded-lg shadow-2xs transition-colors"
                title="Administrar y editar usuarios del sistema"
              >
                <UserCog className="w-3.5 h-3.5 text-amber-400" />
                <span>Gestionar Usuarios</span>
              </button>
            )}
            {!currentUser.is_admin && currentProject && (
              <span className="hidden sm:inline-flex items-center gap-1.5 bg-slate-800/80 text-slate-300 border border-slate-700 text-xs px-2.5 py-1 rounded-full font-medium">
                Rol: <strong className="text-indigo-400 font-semibold">{ROLE_LABELS[currentRole]}</strong>
              </span>
            )}

            {/* Quick user role switcher for testing */}
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-2.5 p-1 pr-3 rounded-full hover:bg-slate-800 transition-colors border border-slate-700 bg-slate-950/60 shadow-2xs"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-inner ring-1 ring-white/20"
                  style={{ backgroundColor: currentUser.avatar_color }}
                >
                  {currentUser.name.charAt(0)}
                </div>
                <div className="text-left hidden lg:block">
                  <div className="text-xs font-semibold leading-tight text-slate-100">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">@{currentUser.username}</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showUserDropdown && (
                <div
                  className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl py-2 z-50 text-slate-200"
                  onMouseLeave={() => setShowUserDropdown(false)}
                >
                  <div className="px-4 py-3 border-b border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Sesión activa</div>
                    <div className="font-bold text-white text-sm mt-0.5">{currentUser.name}</div>
                    <div className="text-xs text-slate-400 font-mono">@{currentUser.username}</div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">{currentUser.email}</div>
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1 text-[11px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-md font-semibold">
                        Rol: {ROLE_LABELS[currentRole]}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1.5 px-1">
                    {currentUser.is_admin && (
                      <button
                        onClick={() => {
                          setShowManageUsersModal(true);
                          setShowUserDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-amber-300 hover:bg-slate-800/80 rounded-lg flex items-center gap-2 transition-colors font-medium"
                      >
                        <UserCog className="w-3.5 h-3.5 text-amber-400" />
                        Administrar Usuarios & Permisos
                      </button>
                    )}
                    <button
                      onClick={() => {
                        logout();
                        setShowUserDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-rose-400 hover:bg-slate-800/80 rounded-lg flex items-center gap-2 transition-colors font-medium"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Cerrar Sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* User Management Modal */}
      <ManageUsersModal
        isOpen={showManageUsersModal}
        onClose={() => setShowManageUsersModal(false)}
      />
    </header>
  );
};
