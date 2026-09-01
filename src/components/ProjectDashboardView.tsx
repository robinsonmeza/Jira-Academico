import React, { useState, useMemo } from 'react';
import { useJira } from '../context/JiraContext';
import { Project, ROLE_LABELS, Task, Sprint } from '../types/jira';
import {
  FolderKanban,
  Kanban,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Sparkles,
  Flame,
  ArrowRight,
  ShieldCheck,
  GraduationCap,
  Calendar,
  Layers,
  CheckSquare,
  BarChart3,
  Bookmark,
  Bug,
  BookOpen,
  ChevronRight,
  Pencil,
  Trash2,
  Search,
  Plus,
} from 'lucide-react';

interface ProjectDashboardViewProps {
  onOpenBoard: (projectId: number) => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  canManageProjects: boolean;
}

export const ProjectDashboardView: React.FC<ProjectDashboardViewProps> = ({
  onOpenBoard,
  onEditProject,
  onDeleteProject,
  canManageProjects,
}) => {
  const {
    projects,
    accessibleProjects,
    members,
    tasks,
    users,
    sprints,
    columns,
    currentUser,
    selectProject,
  } = useJira();

  const [selectedProjId, setSelectedProjId] = useState<number>(() => {
    return accessibleProjects[0]?.id || projects[0]?.id || 1;
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Filter projects by search
  const filteredProjects = useMemo(() => {
    return accessibleProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [accessibleProjects, searchTerm]);

  // Selected project object
  const activeProject = useMemo(() => {
    return (
      accessibleProjects.find((p) => p.id === selectedProjId) ||
      accessibleProjects[0] ||
      projects[0] ||
      null
    );
  }, [accessibleProjects, projects, selectedProjId]);

  // Calculated metrics for active project
  const projectTasks = useMemo(() => {
    if (!activeProject) return [];
    return tasks.filter((t) => t.project_id === activeProject.id);
  }, [tasks, activeProject]);

  const projectMembers = useMemo(() => {
    if (!activeProject) return [];
    return members.filter((m) => m.project_id === activeProject.id);
  }, [members, activeProject]);

  const projectSprints = useMemo(() => {
    if (!activeProject) return [];
    return sprints.filter((s) => s.project_id === activeProject.id);
  }, [sprints, activeProject]);

  const activeSprint = useMemo(() => {
    return projectSprints.find((s) => s.status === 'active') || null;
  }, [projectSprints]);

  // Task status distribution
  const statusStats = useMemo(() => {
    const total = projectTasks.length;
    const done = projectTasks.filter((t) => t.status === 'Done').length;
    const inReview = projectTasks.filter((t) => t.status === 'In Review').length;
    const inProgress = projectTasks.filter((t) => t.status === 'In Progress').length;
    const todo = projectTasks.filter((t) => t.status === 'To Do').length;
    const backlog = projectTasks.filter((t) => t.status === 'Backlog' || !t.status).length;
    const completionPercent = total > 0 ? Math.round((done / total) * 100) : 0;

    return { total, done, inReview, inProgress, todo, backlog, completionPercent };
  }, [projectTasks]);

  // Story points calculation
  const storyPointsStats = useMemo(() => {
    let totalPoints = 0;
    let donePoints = 0;
    projectTasks.forEach((t) => {
      const pts = t.story_points || 0;
      totalPoints += pts;
      if (t.status === 'Done') {
        donePoints += pts;
      }
    });
    const percentage = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;
    return { totalPoints, donePoints, percentage };
  }, [projectTasks]);

  // Issue types count
  const issueTypes = useMemo(() => {
    const stories = projectTasks.filter((t) => t.issue_type === 'story').length;
    const tasksCount = projectTasks.filter((t) => t.issue_type === 'task' || !t.issue_type).length;
    const bugs = projectTasks.filter((t) => t.issue_type === 'bug').length;
    const epics = projectTasks.filter((t) => t.issue_type === 'epic').length;
    return { stories, tasksCount, bugs, epics };
  }, [projectTasks]);

  // High priority / urgent tasks
  const criticalTasks = useMemo(() => {
    return projectTasks
      .filter((t) => (t.priority === 'highest' || t.priority === 'high') && t.status !== 'Done')
      .slice(0, 5);
  }, [projectTasks]);

  // Member workload breakdown
  const memberWorkload = useMemo(() => {
    return projectMembers.map((m) => {
      const u = users.find((usr) => usr.id === m.user_id);
      const assignedTasks = projectTasks.filter((t) => {
        const assignees = t.assignee_ids && t.assignee_ids.length > 0 ? t.assignee_ids : t.assignee_id ? [t.assignee_id] : [];
        return assignees.includes(m.user_id);
      });
      const doneCount = assignedTasks.filter((t) => t.status === 'Done').length;
      return {
        member: m,
        user: u,
        role: m.role,
        taskCount: assignedTasks.length,
        doneCount,
      };
    });
  }, [projectMembers, projectTasks, users]);

  // Global Executive Summary across accessible projects
  const globalSummary = useMemo(() => {
    const totalProjects = accessibleProjects.length;
    const allProjTasks = tasks.filter((t) => accessibleProjects.some((p) => p.id === t.project_id));
    const allDoneTasks = allProjTasks.filter((t) => t.status === 'Done');
    const globalPercent = allProjTasks.length > 0 ? Math.round((allDoneTasks.length / allProjTasks.length) * 100) : 0;
    const totalActiveSprints = sprints.filter(
      (s) => s.status === 'active' && accessibleProjects.some((p) => p.id === s.project_id)
    ).length;

    return {
      totalProjects,
      totalTasks: allProjTasks.length,
      doneTasks: allDoneTasks.length,
      globalPercent,
      totalActiveSprints,
    };
  }, [accessibleProjects, tasks, sprints]);

  if (!activeProject && accessibleProjects.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Executive Quick KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Proyectos Activos</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{globalSummary.totalProjects}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <FolderKanban className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Sprints en Curso</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{globalSummary.totalActiveSprints}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Flame className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tareas Globales</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">
              {globalSummary.doneTasks} / {globalSummary.totalTasks}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Avance General</p>
            <p className="text-xl font-bold text-indigo-600 mt-0.5">{globalSummary.globalPercent}%</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Interactive Master-Detail Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Project Selector List (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 flex flex-col space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Seleccionar Proyecto
              </h2>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              {filteredProjects.length} proyectos
            </span>
          </div>

          {/* Search box within list */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar proyectos..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>

          {/* Projects Interactive List */}
          <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
            {filteredProjects.map((p) => {
              const isSelected = activeProject?.id === p.id;
              const pTasks = tasks.filter((t) => t.project_id === p.id);
              const pDone = pTasks.filter((t) => t.status === 'Done');
              const pMembers = members.filter((m) => m.project_id === p.id);
              const pProgress = pTasks.length > 0 ? Math.round((pDone.length / pTasks.length) * 100) : 0;
              const pActiveSprint = sprints.find((s) => s.project_id === p.id && s.status === 'active');

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedProjId(p.id);
                    selectProject(p.id);
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-400/40 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {p.key}
                      </span>
                      <span className="text-xs font-bold text-slate-900 truncate max-w-[160px]">
                        {p.name}
                      </span>
                    </div>

                    <span className="text-[11px] font-bold text-indigo-700">{pProgress}%</span>
                  </div>

                  {/* Progress Line */}
                  <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isSelected ? 'bg-indigo-600' : 'bg-slate-500'
                      }`}
                      style={{ width: `${pProgress}%` }}
                    />
                  </div>

                  {/* Meta badges */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <CheckSquare className="w-3 h-3 text-slate-400" />
                        {pTasks.length} tareas
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-slate-400" />
                        {pMembers.length}
                      </span>
                    </div>

                    {pActiveSprint ? (
                      <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded">
                        {pActiveSprint.name}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Sin sprint activo</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Complete Project Dashboard (8 cols) */}
        {activeProject ? (
          <div className="lg:col-span-8 space-y-6">
            {/* Active Project Header Card with Primary "Ingresar al Board" CTA */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                      {activeProject.key}
                    </span>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                      {activeProject.name}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
                    {activeProject.description || 'Panel de métricas ejecutivas, avance de tareas y estado del sprint.'}
                  </p>
                </div>

                {/* Primary CTA & Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {canManageProjects && (
                    <button
                      onClick={() => onEditProject(activeProject)}
                      className="p-2 border border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
                      title="Editar Proyecto"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => {
                      selectProject(activeProject.id);
                      onOpenBoard(activeProject.id);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Kanban className="w-4 h-4" />
                    <span>Ingresar al Board</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Status breakdown bar */}
              <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">Progreso del Proyecto</span>
                    <span className="text-slate-500 text-[11px]">
                      ({statusStats.done} de {statusStats.total} tareas completadas)
                    </span>
                  </div>
                  <span className="font-bold text-indigo-700 text-sm">
                    {statusStats.completionPercent}%
                  </span>
                </div>

                {/* Multi-color segmented progress bar */}
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex gap-0.5 p-0.5">
                  {statusStats.total > 0 ? (
                    <>
                      <div
                        title={`Hecho (Done): ${statusStats.done}`}
                        className="bg-emerald-500 h-full rounded-l-full transition-all duration-300"
                        style={{ width: `${(statusStats.done / statusStats.total) * 100}%` }}
                      />
                      <div
                        title={`En Revisión (In Review): ${statusStats.inReview}`}
                        className="bg-amber-400 h-full transition-all duration-300"
                        style={{ width: `${(statusStats.inReview / statusStats.total) * 100}%` }}
                      />
                      <div
                        title={`En Progreso (In Progress): ${statusStats.inProgress}`}
                        className="bg-blue-500 h-full transition-all duration-300"
                        style={{ width: `${(statusStats.inProgress / statusStats.total) * 100}%` }}
                      />
                      <div
                        title={`Por Hacer (To Do): ${statusStats.todo}`}
                        className="bg-slate-400 h-full transition-all duration-300"
                        style={{ width: `${(statusStats.todo / statusStats.total) * 100}%` }}
                      />
                      <div
                        title={`Backlog: ${statusStats.backlog}`}
                        className="bg-slate-300 h-full rounded-r-full transition-all duration-300"
                        style={{ width: `${(statusStats.backlog / statusStats.total) * 100}%` }}
                      />
                    </>
                  ) : (
                    <div className="bg-slate-200 h-full w-full rounded-full" />
                  )}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-3.5 pt-1 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    Done ({statusStats.done})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                    In Review ({statusStats.inReview})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                    In Progress ({statusStats.inProgress})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />
                    To Do ({statusStats.todo})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />
                    Backlog ({statusStats.backlog})
                  </span>
                </div>
              </div>
            </div>

            {/* Dashboard Secondary Grid: Sprint KPI + Story Points + Task Types */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Active Sprint Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4.5 shadow-2xs space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Sprint Actual
                    </span>
                    {activeSprint ? (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Flame className="w-3 h-3 text-emerald-600" />
                        En Curso
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5 rounded-md">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {activeSprint ? activeSprint.name : 'Sin Sprint en Curso'}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                    {activeSprint?.goal ? `Meta: ${activeSprint.goal}` : 'Planifica el siguiente sprint desde el tablero.'}
                  </p>
                </div>

                {activeSprint && (
                  <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {activeSprint.end_date ? new Date(activeSprint.end_date).toLocaleDateString() : 'Sin fecha fin'}
                    </span>
                    <span className="font-semibold text-indigo-600">
                      {projectTasks.filter((t) => t.sprint_id === activeSprint.id && t.status === 'Done').length}/
                      {projectTasks.filter((t) => t.sprint_id === activeSprint.id).length} tareas
                    </span>
                  </div>
                )}
              </div>

              {/* Story Points Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4.5 shadow-2xs space-y-2 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Story Points (Estimación)
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900">
                      {storyPointsStats.donePoints}
                    </span>
                    <span className="text-xs text-slate-500">
                      / {storyPointsStats.totalPoints} pts entregados
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                    <span>Velocidad acumulada</span>
                    <span className="font-bold text-slate-700">{storyPointsStats.percentage}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${storyPointsStats.percentage}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Task Breakdown Types */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4.5 shadow-2xs space-y-2 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Distribución de Tipos
                </span>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-2 flex items-center gap-2">
                    <Bookmark className="w-3.5 h-3.5 text-emerald-600" />
                    <div>
                      <span className="text-[10px] text-slate-500 block">Historias</span>
                      <span className="font-bold text-slate-900">{issueTypes.stories}</span>
                    </div>
                  </div>

                  <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-2 flex items-center gap-2">
                    <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                    <div>
                      <span className="text-[10px] text-slate-500 block">Tareas</span>
                      <span className="font-bold text-slate-900">{issueTypes.tasksCount}</span>
                    </div>
                  </div>

                  <div className="bg-rose-50/70 border border-rose-100 rounded-xl p-2 flex items-center gap-2">
                    <Bug className="w-3.5 h-3.5 text-rose-600" />
                    <div>
                      <span className="text-[10px] text-slate-500 block">Bugs</span>
                      <span className="font-bold text-slate-900">{issueTypes.bugs}</span>
                    </div>
                  </div>

                  <div className="bg-purple-50/70 border border-purple-100 rounded-xl p-2 flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                    <div>
                      <span className="text-[10px] text-slate-500 block">Épicas</span>
                      <span className="font-bold text-slate-900">{issueTypes.epics}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Team Workload Allocation */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Carga de Trabajo del Equipo ({memberWorkload.length} miembros)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">
                  Distribución de tareas asignadas
                </span>
              </div>

              {memberWorkload.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">
                  No hay miembros asignados a este proyecto.
                </p>
              ) : (
                <div className="space-y-3">
                  {memberWorkload.map(({ member, user, role, taskCount, doneCount }) => {
                    const ratio = taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0;
                    return (
                      <div
                        key={member.id}
                        className="p-3 bg-slate-50/60 rounded-xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <div
                            className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center shadow-xs"
                            style={{ backgroundColor: user?.avatar_color || '#4A90D9' }}
                          >
                            {user?.name.charAt(0) || 'U'}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900 leading-tight">
                              {user?.name || 'Usuario'}
                            </p>
                            <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-1.5 py-0.2 rounded">
                              {ROLE_LABELS[role]}
                            </span>
                          </div>
                        </div>

                        {/* Task metrics & progress */}
                        <div className="flex-1 max-w-xs space-y-1">
                          <div className="flex justify-between text-[11px] text-slate-500">
                            <span>
                              {taskCount === 0
                                ? 'Sin tareas'
                                : `${doneCount} de ${taskCount} tareas completadas`}
                            </span>
                            {taskCount > 0 && <span className="font-bold text-slate-700">{ratio}%</span>}
                          </div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                              style={{ width: `${ratio}%` }}
                            />
                          </div>
                        </div>

                        {/* Task count badge */}
                        <div className="text-right sm:min-w-[80px]">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
                            <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />
                            {taskCount} {taskCount === 1 ? 'tarea' : 'tareas'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Critical Tasks (High / Highest Priority Pending) */}
            {criticalTasks.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Tareas Críticas Pendientes ({criticalTasks.length})
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-400">Prioridad Alta / Máxima</span>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                  {criticalTasks.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 bg-white hover:bg-slate-50/80 flex items-center justify-between gap-3 text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          {t.task_key}
                        </span>
                        <span className="font-semibold text-slate-900 truncate max-w-sm">
                          {t.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full uppercase">
                          {t.priority}
                        </span>
                        <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {t.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs">
            <FolderKanban className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">Selecciona un proyecto</h3>
            <p className="text-xs text-slate-500 mt-1">
              Elige un proyecto de la lista izquierda para visualizar su dashboard de métricas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
