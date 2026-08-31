import React, { useState } from 'react';
import { useJira } from '../context/JiraContext';
import {
  X,
  UserPlus,
  Users,
  Shield,
  Trash2,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Info,
  FileSpreadsheet,
  Pencil,
} from 'lucide-react';
import { Role, ROLE_LABELS, ROLE_DESCRIPTIONS, PERMISSIONS, User } from '../types/jira';
import { CsvImportModal } from './CsvImportModal';
import { EditUserModal } from './EditUserModal';

interface CreateMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateMemberModal: React.FC<CreateMemberModalProps> = ({ isOpen, onClose }) => {
  const { createMemberWithCredentials, projects, currentUser } = useJira();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('frontend');
  const [projectId, setProjectId] = useState<number>(projects[0]?.id || 1);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const res = createMemberWithCredentials({
      name,
      username,
      password,
      role,
      project_id: projectId,
      email: email || undefined,
    });

    if (res.success) {
      setSuccessMsg(`¡Usuario '${name}' creado y asignado como ${ROLE_LABELS[role]}!`);
      setName('');
      setUsername('');
      setPassword('');
      setEmail('');
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1200);
    } else {
      setError(res.error || 'Error al crear el usuario');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base tracking-tight">
              <UserPlus className="w-5 h-5 text-indigo-600" />
              <span>Crear Usuario Individual</span>
            </div>
            <div className="flex items-center gap-2">
              {currentUser?.is_admin && (
                <button
                  type="button"
                  onClick={() => setIsCsvModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Importar CSV</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!username) {
                      setUsername(e.target.value.toLowerCase().replace(/\s+/g, '_'));
                    }
                  }}
                  placeholder="ej. Carlos Morales"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-2xs transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Usuario (Login) *
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="carlos_morales"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-2xs transition-all"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Contraseña Inicial *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Clave123."
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-2xs transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Email (Opcional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="carlos@institucion.edu"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-2xs transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Rol del Usuario *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white shadow-2xs font-medium"
                >
                  <option value="frontend">Frontend Developer</option>
                  <option value="backend">Backend Developer</option>
                  <option value="po">Product Owner (Docente)</option>
                  <option value="admin">Project Manager (Admin)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Proyecto Asignado *
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(Number(e.target.value))}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white shadow-2xs font-medium"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.key})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-800">Privilegios para {ROLE_LABELS[role]}:</strong>{' '}
                {ROLE_DESCRIPTIONS[role]}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors shadow-2xs"
              >
                Crear Usuario
              </button>
            </div>
          </form>
        </div>
      </div>

      <CsvImportModal isOpen={isCsvModalOpen} onClose={() => setIsCsvModalOpen(false)} />
    </>
  );
};

interface MembersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MembersModal: React.FC<MembersModalProps> = ({ isOpen, onClose }) => {
  const {
    currentProject,
    members,
    users,
    currentUser,
    hasPerm,
    addMemberToProject,
    updateMemberRole,
    removeMemberFromProject,
  } = useJira();

  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<Role>('frontend');
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  if (!isOpen || !currentProject) return null;

  const projectMembers = members
    .filter((m) => m.project_id === currentProject.id)
    .map((m) => ({
      ...m,
      user: users.find((u) => u.id === m.user_id),
    }));

  const existingUserIds = new Set(projectMembers.map((m) => m.user_id));
  const availableUsers = users.filter((u) => !existingUserIds.has(u.id));

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setError('Selecciona un usuario existente');
      return;
    }
    setError(null);
    const res = addMemberToProject(currentProject.id, Number(selectedUserId), selectedRole);
    if (res.success) {
      setSelectedUserId('');
    } else {
      setError(res.error || 'Error al añadir miembro');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-base tracking-tight">
            <Users className="w-5 h-5 text-indigo-600" />
            <span>Equipo y Miembros de {currentProject.name}</span>
            <span className="font-mono text-xs bg-indigo-50 text-indigo-700 border border-indigo-200/80 px-2 py-0.5 rounded-md font-bold">
              {projectMembers.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Add member form */}
          {hasPerm('manage_members') && availableUsers.length > 0 && (
            <form onSubmit={handleAddMember} className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3 shadow-2xs">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Asignar usuario registrado a este proyecto
              </div>

              {error && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Usuario</label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-semibold bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-2xs"
                  >
                    <option value="">Selecciona un usuario...</option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} (@{u.username}) - {ROLE_LABELS[u.role || 'frontend']}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-full sm:w-48">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Rol en Proyecto</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as Role)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-semibold bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-2xs"
                  >
                    <option value="frontend">Frontend Developer</option>
                    <option value="backend">Backend Developer</option>
                    <option value="po">Product Owner (Docente)</option>
                    <option value="admin">Project Manager (Admin)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition-colors whitespace-nowrap shadow-2xs"
                >
                  Asignar
                </button>
              </div>
            </form>
          )}

          {/* Members Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3 hidden md:table-cell">Permisos y Alcance</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projectMembers.map((m) => {
                  const isCurrent = m.user_id === currentUser?.id;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs text-white font-bold shrink-0 shadow-2xs"
                            style={{ backgroundColor: m.user?.avatar_color || '#6366F1' }}
                          >
                            {m.user?.name.charAt(0) || '?'}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <span>{m.user?.name || 'Usuario'}</span>
                              {isCurrent && (
                                <span className="bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                                  Tú
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400">@{m.user?.username}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {hasPerm('manage_members') ? (
                          <select
                            value={m.role}
                            onChange={(e) => updateMemberRole(m.id, e.target.value as Role)}
                            className="px-2.5 py-1 border border-slate-300 rounded-xl text-xs font-semibold bg-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-2xs"
                          >
                            <option value="frontend">Frontend Developer</option>
                            <option value="backend">Backend Developer</option>
                            <option value="po">Product Owner (Docente)</option>
                            <option value="admin">Project Manager (Admin)</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold ${
                              m.role === 'admin'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : m.role === 'po'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : m.role === 'frontend'
                                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {ROLE_LABELS[m.role]}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-500">
                        {m.role === 'admin' && 'Control total del sistema y proyectos.'}
                        {m.role === 'po' && 'Acceso global y permisos completos de edición.'}
                        {m.role === 'frontend' && 'Crear, editar, mover tareas y adjuntos Frontend.'}
                        {m.role === 'backend' && 'Crear, editar, mover tareas y adjuntos Backend.'}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {currentUser?.is_admin && m.user && (
                            <button
                              onClick={() => setEditingUser(m.user || null)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Editar usuario (rol, nombre, clave, datos)"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {hasPerm('manage_members') && projectMembers.length > 1 && (
                            <button
                              onClick={() => {
                                if (confirm(`¿Quitar a ${m.user?.name} del proyecto?`)) {
                                  removeMemberFromProject(m.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Quitar miembro"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors shadow-2xs"
          >
            Cerrar
          </button>
        </div>
      </div>

      <EditUserModal
        user={editingUser}
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
      />
    </div>
  );
};
