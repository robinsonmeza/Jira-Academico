import React, { useState } from 'react';
import { useJira } from '../context/JiraContext';
import { User, Role, ROLE_BADGE_LABELS, ROLE_LABELS } from '../types/jira';
import { EditUserModal } from './EditUserModal';
import { CreateMemberModal } from './MemberModals';
import { CsvImportModal } from './CsvImportModal';
import {
  X,
  Users,
  Search,
  UserPlus,
  FileSpreadsheet,
  Pencil,
  Trash2,
  ShieldCheck,
  GraduationCap,
  Code2,
  Server,
  KeyRound,
  Eye,
  EyeOff,
  Filter,
  CheckCircle2,
  FolderKanban,
  UserCheck,
} from 'lucide-react';

interface ManageUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManageUsersModal: React.FC<ManageUsersModalProps> = ({ isOpen, onClose }) => {
  const { users, currentUser, members, projects, deleteUser } = useJira();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');
  const [selectedUserToEdit, setSelectedUserToEdit] = useState<User | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<number, boolean>>({});

  if (!isOpen) return null;

  const isPM = currentUser?.is_admin || currentUser?.role === 'admin';

  const toggleRevealPassword = (userId: number) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (roleFilter !== 'all') {
      const userRole = u.role || (u.is_admin ? 'admin' : 'frontend');
      return userRole === roleFilter;
    }

    return true;
  });

  const countByRole = {
    all: users.length,
    admin: users.filter((u) => u.is_admin || u.role === 'admin').length,
    po: users.filter((u) => u.role === 'po').length,
    frontend: users.filter((u) => u.role === 'frontend').length,
    backend: users.filter((u) => u.role === 'backend').length,
  };

  const getRoleBadge = (u: User) => {
    const role = u.role || (u.is_admin ? 'admin' : 'frontend');
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold px-2.5 py-0.5 rounded-full">
            <ShieldCheck className="w-3 h-3 text-amber-600" />
            Project Manager
          </span>
        );
      case 'po':
        return (
          <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold px-2.5 py-0.5 rounded-full">
            <GraduationCap className="w-3 h-3 text-indigo-600" />
            Product Owner (Docente)
          </span>
        );
      case 'frontend':
        return (
          <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 border border-sky-200 text-xs font-semibold px-2.5 py-0.5 rounded-full">
            <Code2 className="w-3 h-3 text-sky-600" />
            Frontend Dev
          </span>
        );
      case 'backend':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-0.5 rounded-full">
            <Server className="w-3 h-3 text-emerald-600" />
            Backend Dev
          </span>
        );
    }
  };

  const getUserProjectKeys = (userId: number, userRole?: Role, isAdmin?: boolean) => {
    if (isAdmin || userRole === 'admin' || userRole === 'po') {
      return projects.map((p) => p.key);
    }
    const userProjIds = members.filter((m) => m.user_id === userId).map((m) => m.project_id);
    return projects.filter((p) => userProjIds.includes(p.id)).map((p) => p.key);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 leading-tight">
                    Administración & Edición de Usuarios
                  </h2>
                  <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-mono font-bold px-2 py-0.5 rounded-md">
                    {users.length} usuarios
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Panel de permisos del Project Manager: edita nombres, claves, roles y asignación de proyectos.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCsvModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors shadow-2xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Importar CSV</span>
              </button>

              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors shadow-2xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Nuevo Usuario</span>
              </button>

              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors ml-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Subheader Toolbar: Search and Filter Tabs */}
          <div className="px-6 py-3 border-b border-slate-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, usuario (@) o correo..."
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-2xs"
              />
            </div>

            {/* Role Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs">
              <button
                onClick={() => setRoleFilter('all')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
                  roleFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>Todos</span>
                <span className="text-[10px] opacity-75 font-mono">({countByRole.all})</span>
              </button>

              <button
                onClick={() => setRoleFilter('admin')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 ${
                  roleFilter === 'admin'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                <span>PMs</span>
                <span className="text-[10px] opacity-85 font-mono">({countByRole.admin})</span>
              </button>

              <button
                onClick={() => setRoleFilter('po')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 ${
                  roleFilter === 'po'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100'
                }`}
              >
                <span>POs</span>
                <span className="text-[10px] opacity-85 font-mono">({countByRole.po})</span>
              </button>

              <button
                onClick={() => setRoleFilter('frontend')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 ${
                  roleFilter === 'frontend'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100'
                }`}
              >
                <span>Frontend</span>
                <span className="text-[10px] opacity-85 font-mono">({countByRole.frontend})</span>
              </button>

              <button
                onClick={() => setRoleFilter('backend')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 ${
                  roleFilter === 'backend'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <span>Backend</span>
                <span className="text-[10px] opacity-85 font-mono">({countByRole.backend})</span>
              </button>
            </div>
          </div>

          {/* Table of Users */}
          <div className="p-6 overflow-y-auto flex-1">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-700">No se encontraron usuarios</p>
                <p className="mt-1">Prueba con otro término de búsqueda o crea uno nuevo.</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Usuario & Identificador</th>
                      <th className="px-4 py-3">Rol & Permisos</th>
                      <th className="px-4 py-3 hidden md:table-cell">Credenciales (Clave)</th>
                      <th className="px-4 py-3 hidden lg:table-cell">Proyectos Asignados</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredUsers.map((u) => {
                      const isCurrent = u.id === currentUser?.id;
                      const projKeys = getUserProjectKeys(u.id, u.role, u.is_admin);
                      const isRevealed = !!revealedPasswords[u.id];

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/80 transition-colors group">
                          {/* User Avatar and info */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-inner ring-1 ring-white shrink-0"
                                style={{ backgroundColor: u.avatar_color || '#4A90D9' }}
                              >
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                  <span>{u.name}</span>
                                  {isCurrent && (
                                    <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                                      Tú
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono">@{u.username}</div>
                                {u.email && <div className="text-[11px] text-slate-500">{u.email}</div>}
                              </div>
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td className="px-4 py-3">{getRoleBadge(u)}</td>

                          {/* Credentials */}
                          <td className="px-4 py-3 hidden md:table-cell">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {isRevealed ? u.password || 'Sin clave' : '••••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleRevealPassword(u.id)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded"
                                title={isRevealed ? 'Ocultar clave' : 'Mostrar clave'}
                              >
                                {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>

                          {/* Projects */}
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {projKeys.length === 0 ? (
                                <span className="text-[11px] text-slate-400 italic">Sin asignar</span>
                              ) : (
                                projKeys.map((k) => (
                                  <span
                                    key={k}
                                    className="font-mono text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded"
                                  >
                                    {k}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedUserToEdit(u)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition-colors shadow-2xs"
                                title="Editar datos, rol o contraseña del usuario"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>Editar</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {filteredUsers.length} de {users.length} usuarios visualizados
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors shadow-2xs"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      <EditUserModal
        user={selectedUserToEdit}
        isOpen={!!selectedUserToEdit}
        onClose={() => setSelectedUserToEdit(null)}
      />

      {/* Create Modal */}
      <CreateMemberModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />

      {/* CSV Modal */}
      <CsvImportModal isOpen={isCsvModalOpen} onClose={() => setIsCsvModalOpen(false)} />
    </>
  );
};
