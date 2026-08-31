import React from 'react';
import { useJira } from '../context/JiraContext';
import { Play, CheckCircle2, Plus, Calendar, Target, Layers } from 'lucide-react';
import { Sprint } from '../types/jira';

interface SprintBarProps {
  selectedSprintId: number | 'all' | 'backlog';
  setSelectedSprintId: (id: number | 'all' | 'backlog') => void;
  onOpenCreateSprint: () => void;
}

export const SprintBar: React.FC<SprintBarProps> = ({
  selectedSprintId,
  setSelectedSprintId,
  onOpenCreateSprint,
}) => {
  const { currentProject, sprints, tasks, columns, hasPerm, startSprint, completeSprint } = useJira();

  if (!currentProject) return null;

  const projectSprints = sprints.filter((s) => s.project_id === currentProject.id);
  const activeSprint = projectSprints.find((s) => s.status === 'active');

  // Currently focused sprint for metrics
  const displayedSprint =
    typeof selectedSprintId === 'number'
      ? projectSprints.find((s) => s.id === selectedSprintId)
      : activeSprint || null;

  const sprintTasks = displayedSprint
    ? tasks.filter((t) => t.sprint_id === displayedSprint.id)
    : [];

  const doneCol = columns.find((c) => c.project_id === currentProject.id && c.is_done_column);
  const doneTasks = sprintTasks.filter((t) => doneCol && t.column_id === doneCol.id);

  const totalPoints = sprintTasks.reduce((acc, t) => acc + (t.story_points || 0), 0);
  const donePoints = doneTasks.reduce((acc, t) => acc + (t.story_points || 0), 0);

  const handleCompleteSprint = () => {
    if (!displayedSprint) return;
    const incompleteCount = sprintTasks.length - doneTasks.length;
    const message =
      incompleteCount > 0
        ? `¿Completar el '${displayedSprint.name}'? Hay ${incompleteCount} tareas incompletas que volverán al Backlog.`
        : `¿Completar el '${displayedSprint.name}'? Todas las tareas fueron finalizadas.`;

    if (confirm(message)) {
      completeSprint(displayedSprint.id);
    }
  };

  const handleStartSprint = () => {
    if (!displayedSprint) return;
    if (confirm(`¿Iniciar el '${displayedSprint.name}'? Se moverán las tareas del backlog al tablero activo.`)) {
      startSprint(displayedSprint.id);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
      {/* Left: Sprint Status & Info */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          {displayedSprint?.status === 'active' ? (
            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-xs font-bold px-2.5 py-1 rounded-lg shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Sprint Activo
            </span>
          ) : displayedSprint?.status === 'planned' ? (
            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200/80 text-xs font-bold px-2.5 py-1 rounded-lg shadow-2xs">
              Planificado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-lg">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              {projectSprints.length === 0 ? 'Sin Sprints' : 'Selector'}
            </span>
          )}

          {/* Sprint Selector Dropdown */}
          <select
            value={selectedSprintId}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'all' || val === 'backlog') {
                setSelectedSprintId(val);
              } else {
                setSelectedSprintId(Number(val));
              }
            }}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-2xs transition-all"
          >
            <option value="all">Todas las Tareas del Proyecto</option>
            {projectSprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.status === 'active' ? '🟢 Activo' : s.status === 'completed' ? '✔️ Finalizado' : '⏳ Planificado'})
              </option>
            ))}
            <option value="backlog">Solo Tareas en Backlog (Sin Sprint)</option>
          </select>
        </div>

        {/* Sprint Meta */}
        {displayedSprint && (
          <div className="flex items-center gap-3 text-xs text-slate-500 border-l border-slate-200 pl-3">
            {displayedSprint.goal && (
              <div className="flex items-center gap-1 truncate max-w-xs" title={displayedSprint.goal}>
                <Target className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="truncate italic font-medium">"{displayedSprint.goal}"</span>
              </div>
            )}

            {(displayedSprint.start_date || displayedSprint.end_date) && (
              <div className="flex items-center gap-1 text-[11px] whitespace-nowrap">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>
                  {displayedSprint.start_date || 'Sin inicio'} - {displayedSprint.end_date || 'Sin fin'}
                </span>
              </div>
            )}

            <div className="flex items-center gap-1.5 font-bold text-slate-700 bg-slate-100/80 border border-slate-200/60 px-2.5 py-0.5 rounded-lg text-[11px] shadow-2xs">
              <span>
                {donePoints} / {totalPoints} SP
              </span>
              <span className="text-slate-400 font-normal">({doneTasks.length}/{sprintTasks.length} tareas)</span>
            </div>
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 self-end md:self-auto">
        {hasPerm('manage_sprints') && (
          <>
            {displayedSprint && displayedSprint.status === 'planned' && (
              <button
                onClick={handleStartSprint}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all shadow-2xs"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Iniciar Sprint</span>
              </button>
            )}

            {displayedSprint && displayedSprint.status === 'active' && (
              <button
                onClick={handleCompleteSprint}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl transition-all shadow-2xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Completar Sprint</span>
              </button>
            )}

            <button
              onClick={onOpenCreateSprint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-slate-300 hover:border-slate-400 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-xl transition-all shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-600" />
              <span>Nuevo Sprint</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
