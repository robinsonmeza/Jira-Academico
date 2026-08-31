import React, { useState, useEffect } from 'react';
import { useJira } from '../context/JiraContext';
import { User, Role, ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_BADGE_LABELS } from '../types/jira';
import {
  X,
  UserCog,
  ShieldCheck,
  GraduationCap,
  Code2,
  Server,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FolderKanban,
  Check,
  Lock,
  Mail,
  User as UserIcon,
  Palette,
} from 'lucide-react';

interface EditUserModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onUserDeleted?: (deletedUserId: number) => void;
}

const AVATAR_COLORS = [
  '#4A90D9', // Blue
  '#36B37E', // Green
  '#FF5630', // Red
  '#6554C0', // Purple
  '#00B8D9', // Cyan
  '#FFAB00', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Violet
  '#10B981', // Emerald
  '#F97316', // Orange
  '#0EA5E9', // Sky
  '#64748B', // Slate
];

export const EditUserModal: React.FC<EditUserModalProps> = ({
  user,
  isOpen,
  onClose,
  onUserDeleted,
}) => {
  const {
    currentUser,
    users,
    projects,
    members,
    updateUser,
    deleteUser,
  } = useJira();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('frontend');
  const [avatarColor, setAvatarColor] = useState('#4A90D9');
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setUsername(user.username);
      setPassword(user.password || '');
      setEmail(user.email || '');
      setRole(user.role || (user.is_admin ? 'admin' : 'frontend'));
      setAvatarColor(user.avatar_color || '#4A90D9');

      const userProjects = members
        .filter((m) => m.user_id === user.id)
        .map((m) => m.project_id);
      setSelectedProjectIds(userProjects);

      setError(null);
      setSuccessMsg(null);
      setShowDeleteConfirm(false);
    }
  }, [user, members, isOpen]);

  if (!isOpen || !user) return null;

  const isCurrentUser = currentUser?.id === user.id;
  const adminCount = users.filter((u) => u.is_admin || u.role === 'admin').length;
  const isOnlyAdmin = (user.is_admin || user.role === 'admin') && adminCount <= 1;

  const handleToggleProject = (pId: number) => {
    setSelectedProjectIds((prev) =>
      prev.includes(pId) ? prev.filter((id) => id !== pId) : [...prev, pId]
    );
  };

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let gen = '';
    for (let i = 0; i < 10; i++) {
      gen += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(gen);
    setShowPassword(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!name.trim()) {
      setError('El nombre completo es requerido');
      return;
    }
    if (!username.trim()) {
      setError('El nombre de usuario es requerido');
      return;
    }

    if (isOnlyAdmin && role !== 'admin') {
      setError('No puedes cambiar el rol del único Project Manager (Admin) del sistema');
      return;
    }

    const res = updateUser(
      user.id,
      {
        name: name.trim(),
        username: username.trim().toLowerCase(),
        password: password.trim(),
        email: email.trim(),
        role,
        avatar_color: avatarColor,
      },
      selectedProjectIds
    );

    if (res.success) {
      setSuccessMsg('¡Usuario actualizado exitosamente!');
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1000);
    } else {
      setError(res.error || 'Error al actualizar el usuario');
    }
  };

  const handleDelete = () => {
    if (isOnlyAdmin) {
      setError('No es posible eliminar al único Project Manager activo');
      return;
    }

    const res = deleteUser(user.id);
    if (res.success) {
      if (onUserDeleted) {
        onUserDeleted(user.id);
      }
      onClose();
    } else {
      setError(res.error || 'Error al eliminar usuario');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-md ring-2 ring-white"
              style={{ backgroundColor: avatarColor }}
            >
              {name ? name.charAt(0).toUpperCase() : user.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 leading-tight">
                  Editar Usuario: {user.name}
                </h2>
                {isCurrentUser && (
                  <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] px-2 py-0.5 rounded-full font-bold">
                    Tu Cuenta
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-mono">@{user.username} · ID: {user.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Section: Basic Data */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Nombre Completo *</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ej. Robinson Meza"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-2xs transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <span>Usuario (Login) *</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  placeholder="robinson_meza"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-2xs transition-all"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Contraseña</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    Generar
                  </button>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Contraseña de acceso"
                    className="w-full pl-3.5 pr-10 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-2xs transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Correo Electrónico</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@institucion.edu"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-2xs transition-all"
                />
              </div>
            </div>
          </div>

          {/* Section: Role and Permissions */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                <span>Rol en el Sistema & Nivel de Permisos *</span>
              </span>
              {isOnlyAdmin && (
                <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Único Administrador
                </span>
              )}
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                {
                  id: 'admin',
                  title: 'Project Manager',
                  badge: 'Admin Global',
                  icon: ShieldCheck,
                  color: 'border-amber-400 bg-amber-50/50 text-amber-900',
                  desc: 'Control total, gestión de usuarios, importación masiva CSV y todos los proyectos.',
                },
                {
                  id: 'po',
                  title: 'Product Owner',
                  badge: 'Docente / Global',
                  icon: GraduationCap,
                  color: 'border-indigo-400 bg-indigo-50/50 text-indigo-900',
                  desc: 'Acceso global a todos los proyectos y tableros. Edición completa sin gestión de usuarios.',
                },
                {
                  id: 'frontend',
                  title: 'Frontend Dev',
                  badge: 'Desarrollador',
                  icon: Code2,
                  color: 'border-sky-400 bg-sky-50/50 text-sky-900',
                  desc: 'Crear, editar, mover tareas y adjuntos solo en sus proyectos asignados.',
                },
                {
                  id: 'backend',
                  title: 'Backend Dev',
                  badge: 'Desarrollador',
                  icon: Server,
                  color: 'border-emerald-400 bg-emerald-50/50 text-emerald-900',
                  desc: 'Crear, editar, mover tareas y adjuntos solo en sus proyectos asignados.',
                },
              ].map((r) => {
                const isSelected = role === r.id;
                const IconComponent = r.icon;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id as Role)}
                    disabled={isOnlyAdmin && r.id !== 'admin'}
                    className={`text-left p-3 rounded-xl border-2 transition-all flex flex-col justify-between ${
                      isSelected
                        ? `${r.color} shadow-2xs font-semibold ring-2 ring-indigo-500/20`
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    } ${isOnlyAdmin && r.id !== 'admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <IconComponent className="w-4 h-4 shrink-0" />
                        <span>{r.title}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight line-clamp-2">{r.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: Avatar Color */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-slate-400" />
              <span>Color de Avatar</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAvatarColor(c)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                    avatarColor === c
                      ? 'ring-2 ring-offset-2 ring-indigo-600 scale-110 shadow-sm'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {avatarColor === c && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Section: Project Assignments */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5 text-indigo-600" />
                <span>Asignación de Proyectos</span>
              </span>
              <span className="text-[11px] font-normal text-slate-500">
                {role === 'admin' || role === 'po'
                  ? 'Acceso global inherente por su rol'
                  : `${selectedProjectIds.length} proyectos asignados`}
              </span>
            </label>

            {role === 'admin' || role === 'po' ? (
              <div className="p-3 bg-indigo-50/60 border border-indigo-200/80 rounded-xl text-xs text-indigo-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  Los usuarios con rol <strong>{ROLE_BADGE_LABELS[role]}</strong> tienen acceso y visibilidad sobre <strong>todos los proyectos</strong> automáticamente.
                </span>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto p-1">
                {projects.map((p) => {
                  const isChecked = selectedProjectIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isChecked
                          ? 'border-indigo-300 bg-indigo-50/40 text-indigo-950 font-medium'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleProject(p.id)}
                          className="w-4 h-4 text-indigo-600 rounded-md border-slate-300 focus:ring-indigo-500"
                        />
                        <span className="font-bold font-mono text-[11px] bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded">
                          {p.key}
                        </span>
                        <span>{p.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{p.key}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Delete Danger Section */}
          {!isOnlyAdmin && (
            <div className="pt-2 border-t border-slate-100">
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar este usuario del sistema</span>
                </button>
              ) : (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-xs">
                  <div className="font-bold text-rose-900 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>¿Confirmar eliminación de {user.name}?</span>
                  </div>
                  <p className="text-rose-700 text-[11px]">
                    Se removerá su cuenta, asignaciones de proyectos y acceso. Las tareas asignadas quedarán sin asignar.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold shadow-2xs transition-colors"
                    >
                      Sí, eliminar usuario
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg font-semibold transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Modal Footer Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors shadow-2xs shadow-indigo-600/20"
            >
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
