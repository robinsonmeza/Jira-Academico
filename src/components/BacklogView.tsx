import React from 'react';
import { useJira } from '../context/JiraContext';
import { Task, TaskType, Priority } from '../types/jira';
import {
  ListPlus,
  Bookmark,
  CheckSquare,
  AlertCircle,
  Zap,
  GitCommit,
  ArrowUp,
  ArrowDown,
  Equal,
  ChevronsUp,
  ChevronsDown,
  Calendar,
  Layers,
  ArrowRight,
  Plus,
} from 'lucide-react';

interface BacklogViewProps {
  onOpenTaskModal: (taskId: number | null, columnId?: number | null) => void;
  tasksList: Task[];
}

export const BacklogView: React.FC<BacklogViewProps> = ({ onOpenTaskModal, tasksList }) => {
  const { currentProject, sprints, users, columns, updateTask, hasPerm } = useJira();

  if (!currentProject) return null;

  const projectSprints = sprints.filter((s) => s.project_id === currentProject.id);
  const activeSprint = projectSprints.find((s) => s.status === 'active');
  const plannedSprints = projectSprints.filter((s) => s.status === 'planned');

  // Backlog tasks (no sprint or in backlog column)
  const backlogTasks = tasksList.filter((t) => !t.sprint_id || t.status.toLowerCase() === 'backlog');

  const renderTypeIcon = (type: TaskType) => {
    switch (type) {
      case 'story':
        return <Bookmark className="w-4 h-4 text-emerald-600 fill-emerald-100" />;
      case 'bug':
        return <AlertCircle className="w-4 h-4 text-rose-600" />;
      case 'epic':
        return <Zap className="w-4 h-4 text-indigo-600 fill-indigo-100" />;
      case 'sub-task':
        return <GitCommit className="w-4 h-4 text-slate-500" />;
      case 'task':
      default:
        return <CheckSquare className="w-4 h-4 text-indigo-600" />;
    }
  };

  const renderPriority = (priority: Priority) => {
    switch (priority) {
      case 'highest':
        return <ChevronsUp className="w-4 h-4 text-rose-600" title="Muy Alta" />;
      case 'high':
        return <ArrowUp className="w-4 h-4 text-rose-500" title="Alta" />;
      case 'medium':
        return <Equal className="w-4 h-4 text-amber-500" title="Media" />;
      case 'low':
        return <ArrowDown className="w-4 h-4 text-emerald-500" title="Baja" />;
      case 'lowest':
        return <ChevronsDown className="w-4 h-4 text-slate-400" title="Muy Baja" />;
    }
  };

  const moveToSprint = (taskId: number, sprintId: number) => {
    const firstCol =
      columns.find((c) => c.project_id === currentProject.id && c.name.toLowerCase().includes('to do')) ||
      columns.find((c) => c.project_id === currentProject.id && !c.is_done_column);

    updateTask(taskId, {
      sprint_id: sprintId,
      column_id: firstCol ? firstCol.id : null,
      status: firstCol ? firstCol.name : 'To Do',
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200/80 text-indigo-700 flex items-center justify-center font-bold shadow-2xs">
            <ListPlus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Backlog del Producto</h2>
            <p className="text-xs text-slate-500">
              {backlogTasks.length} tareas pendientes de planificar o ingresar al sprint.
            </p>
          </div>
        </div>

        {hasPerm('manage_tasks') && (
          <button
            onClick={() => onOpenTaskModal(null, null)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Crear Tarea en Backlog</span>
          </button>
        )}
      </div>

      {/* Table List */}
      {backlogTasks.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-sm">
          <Layers className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="font-medium text-slate-500">No hay tareas en el Backlog actualmente.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 uppercase font-bold text-[11px] tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Tipo / Clave</th>
                <th className="px-4 py-3.5">Título</th>
                <th className="px-4 py-3.5">Prioridad</th>
                <th className="px-4 py-3.5">Story Points</th>
                <th className="px-4 py-3.5">Asignado</th>
                <th className="px-4 py-3.5">Fecha Límite</th>
                <th className="px-4 py-3.5 text-right">Asignar a Sprint</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {backlogTasks.map((task) => {
                const assignee = task.assignee_id ? users.find((u) => u.id === task.assignee_id) : null;
                return (
                  <tr
                    key={task.id}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => onOpenTaskModal(task.id)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2 font-mono font-bold text-slate-600 text-xs">
                        {renderTypeIcon(task.task_type)}
                        <span className="group-hover:text-indigo-600 transition-colors">{task.task_key}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3 font-semibold text-slate-800">
                      <div className="max-w-md truncate">{task.title}</div>
                      {task.labels && task.labels.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {task.labels.map((l) => (
                            <span key={l} className="text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200/60 px-1.5 py-0.2 rounded-md">
                              {l}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 capitalize text-slate-600 font-medium">
                        {renderPriority(task.priority)}
                        <span>{task.priority}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {task.story_points !== null ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-indigo-50 border border-indigo-200/80 text-indigo-700 font-bold text-[10px]">
                          {task.story_points}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {assignee ? (
                        <div className="flex items-center gap-2">
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-2xs"
                            style={{ backgroundColor: assignee.avatar_color }}
                          >
                            {assignee.name.charAt(0)}
                          </span>
                          <span className="text-slate-700 font-medium">{assignee.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Sin asignar</span>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-medium">
                      {task.due_date ? (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {task.due_date}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                      {hasPerm('manage_sprints') && (
                        <div className="inline-flex items-center gap-1">
                          {activeSprint && (
                            <button
                              onClick={() => moveToSprint(task.id, activeSprint.id)}
                              className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/80 rounded-lg font-semibold text-[11px] flex items-center gap-1 transition-colors shadow-2xs"
                              title={`Mover a ${activeSprint.name}`}
                            >
                              <span>{activeSprint.name}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}

                          {plannedSprints.length > 0 && !activeSprint && (
                            <select
                              onChange={(e) => {
                                if (e.target.value) moveToSprint(task.id, Number(e.target.value));
                              }}
                              defaultValue=""
                              className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-[11px] font-semibold text-slate-700 outline-none shadow-2xs"
                            >
                              <option value="" disabled>
                                Asignar a...
                              </option>
                              {plannedSprints.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
