import React, { useState } from 'react';
import { useJira } from '../context/JiraContext';
import { Project, ROLE_LABELS } from '../types/jira';
import {
  FolderKanban,
  Plus,
  UserPlus,
  MoreVertical,
  Pencil,
  Trash2,
  Kanban,
  Users,
  Search,
  ShieldCheck,
  GraduationCap,
  FileSpreadsheet,
  AlertCircle,
  UserCog,
  LayoutDashboard,
  LayoutGrid,
} from 'lucide-react';
import { CreateProjectModal, EditProjectModal } from './ProjectModals';
import { CreateMemberModal } from './MemberModals';
import { CsvImportModal } from './CsvImportModal';
import { ManageUsersModal } from './ManageUsersModal';
import { ProjectDashboardView } from './ProjectDashboardView';

interface ProjectsViewProps {
  onOpenBoard: (projectId: number) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({ onOpenBoard }) => {
  const {
    projects,
    accessibleProjects,
    members,
    tasks,
    users,
    currentUser,
    currentRole,
    selectProject,
    deleteProject,
  } = useJira();

  const isPM = currentUser?.is_admin || currentUser?.role === 'admin';
  const isPO = currentUser?.role === 'po';
  const canManageProjects = isPM || isPO;

  // Default to 'dashboard' view for PM and PO, or 'grid' for others
  const [viewMode, setViewMode] = useState<'dashboard' | 'grid'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isCreateMemberOpen, setIsCreateMemberOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isManageUsersOpen, setIsManageUsersOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  const filteredProjects = accessibleProjects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = (proj: Project) => {
    if (confirm(`¿Estás seguro de eliminar el proyecto '${proj.name}' (${proj.key})? Esta acción no se puede deshacer.`)) {
      deleteProject(proj.id);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <FolderKanban className="w-7 h-7 text-indigo-600" />
              <span>Proyectos</span>
            </h1>
            {isPM && (
              <span className="bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                Project Manager (Global)
              </span>
            )}
            {isPO && (
              <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                Product Owner (Gestión Total de Proyectos)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isPM
              ? 'Supervisa el rendimiento, estado de sprints y asignación de tareas de todos los proyectos activos.'
              : isPO
              ? 'Visualiza el dashboard interactivo de tus proyectos, gestiona sprints, tableros y miembros del equipo.'
              : `Proyectos asignados a tu perfil de ${ROLE_LABELS[currentUser?.role || 'frontend']}.`}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* User Management Button - STRICTLY FOR PROJECT MANAGER (ADMIN) */}
          {isPM && (
            <button
              onClick={() => setIsManageUsersOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold rounded-xl transition-all shadow-2xs"
              title="Administrar, editar nombres, roles y contraseñas de usuarios"
            >
              <UserCog className="w-4 h-4 text-indigo-600" />
              <span>Gestionar Usuarios</span>
            </button>
          )}

          {/* CSV Import Button - STRICTLY FOR PROJECT MANAGER */}
          {isPM && (
            <button
              onClick={() => setIsCsvModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all shadow-2xs shadow-emerald-600/20"
              title="Importar grupo masivo de usuarios desde archivo CSV con asignación automática a grupos"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Importar CSV</span>
            </button>
          )}

          {canManageProjects && (
            <>
              <button
                onClick={() => setIsCreateMemberOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-300 hover:border-slate-400 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-xl transition-all shadow-2xs"
              >
                <UserPlus className="w-4 h-4 text-indigo-600" />
                <span>Crear Usuario</span>
              </button>

              <button
                onClick={() => setIsCreateProjectOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all shadow-sm shadow-indigo-500/25"
              >
                <Plus className="w-4 h-4" />
                <span>Crear Proyecto</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* View Mode Switcher and Global Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Toggle between Dashboard and Grid */}
        <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold self-start">
          <button
            type="button"
            onClick={() => setViewMode('dashboard')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all ${
              viewMode === 'dashboard'
                ? 'bg-white text-indigo-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Dashboard Interactivo</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all ${
              viewMode === 'grid'
                ? 'bg-white text-indigo-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Vista de Cuadrícula</span>
          </button>
        </div>

        {viewMode === 'grid' && (
          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar proyectos..."
              className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-2xs"
            />
          </div>
        )}
      </div>

      {/* Main Content: Dashboard or Grid */}
      {viewMode === 'dashboard' ? (
        <ProjectDashboardView
          onOpenBoard={onOpenBoard}
          onEditProject={(p) => setEditingProject(p)}
          onDeleteProject={handleDelete}
          canManageProjects={canManageProjects}
        />
      ) : (
        /* Traditional Grid View */
        filteredProjects.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-2xs p-8">
            <FolderKanban className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">
              {searchTerm ? 'No se encontraron proyectos' : 'Sin proyectos asignados'}
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
              {searchTerm
                ? 'Intenta con otro término de búsqueda.'
                : isPM || isPO
                ? 'Crea un nuevo proyecto o importa usuarios para comenzar la gestión de los equipos.'
                : `Hola ${currentUser?.name}, actualmente estás registrado como ${
                    ROLE_LABELS[currentUser?.role || 'frontend']
                  }. Aún no has sido asignado a ningún proyecto.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => {
              const projectTasks = tasks.filter((t) => t.project_id === project.id);
              const projectMembers = members.filter((m) => m.project_id === project.id);
              const doneTasks = projectTasks.filter((t) => t.status === 'Done');
              const progress = projectTasks.length ? Math.round((doneTasks.length / projectTasks.length) * 100) : 0;

              return (
                <div
                  key={project.id}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                >
                  <div className="p-5">
                    {/* Top Bar */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <span className="font-mono text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/70 px-2.5 py-0.5 rounded-lg shadow-2xs">
                        {project.key}
                      </span>

                      {/* Options dropdown */}
                      {canManageProjects && (
                        <div className="relative">
                          <button
                            onClick={() => setActiveMenuId(activeMenuId === project.id ? null : project.id)}
                            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeMenuId === project.id && (
                            <div
                              className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-30 text-xs"
                              onMouseLeave={() => setActiveMenuId(null)}
                            >
                              <button
                                onClick={() => {
                                  setEditingProject(project);
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <Pencil className="w-3.5 h-3.5 text-slate-500" />
                                Editar
                              </button>
                              {canManageProjects && (
                                <button
                                  onClick={() => {
                                    handleDelete(project);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Eliminar
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <h3 className="font-bold text-slate-900 text-lg group-hover:text-indigo-600 transition-colors leading-snug">
                      {project.name}
                    </h3>
                    <p className="text-slate-500 text-xs mt-1.5 line-clamp-2 leading-relaxed">
                      {project.description || 'Sin descripción detallada.'}
                    </p>

                    {/* Metrics snippet */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Kanban className="w-3.5 h-3.5 text-slate-400" />
                        <span>{projectTasks.length} tareas</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{projectMembers.length} miembros</span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-[11px] font-medium text-slate-400 mb-1">
                        <span>Progreso ({doneTasks.length}/{projectTasks.length})</span>
                        <span className="font-semibold text-slate-700">{progress}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
                    {/* Member avatars */}
                    <div className="flex -space-x-1.5 overflow-hidden">
                      {projectMembers.slice(0, 4).map((m) => {
                        const u = users.find((usr) => usr.id === m.user_id);
                        return (
                          <div
                            key={m.id}
                            className="inline-block h-6 w-6 rounded-full ring-2 ring-white text-[10px] font-bold text-white flex items-center justify-center shadow-inner"
                            style={{ backgroundColor: u?.avatar_color || '#4A90D9' }}
                            title={`${u?.name} (${ROLE_LABELS[m.role]})`}
                          >
                            {u?.name.charAt(0)}
                          </div>
                        );
                      })}
                      {projectMembers.length > 4 && (
                        <div className="inline-block h-6 w-6 rounded-full bg-slate-200 ring-2 ring-white text-[10px] font-semibold text-slate-600 flex items-center justify-center">
                          +{projectMembers.length - 4}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        selectProject(project.id);
                        onOpenBoard(project.id);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs"
                    >
                      <Kanban className="w-3.5 h-3.5" />
                      <span>Abrir Tablero</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Modals */}
      <CreateProjectModal isOpen={isCreateProjectOpen} onClose={() => setIsCreateProjectOpen(false)} />
      <EditProjectModal
        project={editingProject}
        isOpen={!!editingProject}
        onClose={() => setEditingProject(null)}
      />
      <CreateMemberModal isOpen={isCreateMemberOpen} onClose={() => setIsCreateMemberOpen(false)} />
      <CsvImportModal isOpen={isCsvModalOpen} onClose={() => setIsCsvModalOpen(false)} />
      <ManageUsersModal isOpen={isManageUsersOpen} onClose={() => setIsManageUsersOpen(false)} />
    </div>
  );
};
