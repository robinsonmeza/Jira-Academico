import React from 'react';
import { Task, TaskType, Priority } from '../types/jira';
import { useJira } from '../context/JiraContext';
import {
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
  Paperclip,
  MessageSquare,
  Calendar,
} from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onOpenModal: (taskId: number) => void;
  onDragStart: (e: React.DragEvent, taskId: number) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onOpenModal, onDragStart }) => {
  const { users, comments, attachments } = useJira();

  const assignee = task.assignee_id ? users.find((u) => u.id === task.assignee_id) : null;
  const taskComments = comments.filter((c) => c.task_id === task.id);
  const taskAttachments = attachments.filter((a) => a.task_id === task.id);

  // Type rendering
  const renderTypeIcon = (type: TaskType) => {
    switch (type) {
      case 'story':
        return <Bookmark className="w-3.5 h-3.5 text-emerald-600 fill-emerald-100" />;
      case 'bug':
        return <AlertCircle className="w-3.5 h-3.5 text-rose-600" />;
      case 'epic':
        return <Zap className="w-3.5 h-3.5 text-purple-600 fill-purple-100" />;
      case 'sub-task':
        return <GitCommit className="w-3.5 h-3.5 text-slate-500" />;
      case 'task':
      default:
        return <CheckSquare className="w-3.5 h-3.5 text-blue-600" />;
    }
  };

  // Priority rendering
  const renderPriority = (priority: Priority) => {
    switch (priority) {
      case 'highest':
        return (
          <span title="Prioridad Muy Alta (Highest)" className="text-rose-600 flex items-center">
            <ChevronsUp className="w-3.5 h-3.5" />
          </span>
        );
      case 'high':
        return (
          <span title="Prioridad Alta (High)" className="text-rose-500 flex items-center">
            <ArrowUp className="w-3.5 h-3.5" />
          </span>
        );
      case 'medium':
        return (
          <span title="Prioridad Media (Medium)" className="text-amber-500 flex items-center">
            <Equal className="w-3.5 h-3.5" />
          </span>
        );
      case 'low':
        return (
          <span title="Prioridad Baja (Low)" className="text-emerald-500 flex items-center">
            <ArrowDown className="w-3.5 h-3.5" />
          </span>
        );
      case 'lowest':
        return (
          <span title="Prioridad Muy Baja (Lowest)" className="text-blue-500 flex items-center">
            <ChevronsDown className="w-3.5 h-3.5" />
          </span>
        );
    }
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={() => onOpenModal(task.id)}
      className="bg-white rounded-xl p-3.5 border border-slate-200 hover:border-indigo-400 shadow-2xs hover:shadow-md cursor-grab active:cursor-grabbing transition-all space-y-2.5 group select-none"
    >
      {/* Key & Type & Due Date */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-mono text-slate-500 font-semibold text-[11px]">
          {renderTypeIcon(task.task_type)}
          <span className="group-hover:text-indigo-600 transition-colors">{task.task_key}</span>
        </div>

        <div className="flex items-center gap-2">
          {task.due_date && (
            <span
              className="text-[10px] font-medium text-slate-600 flex items-center gap-1 bg-slate-100/90 border border-slate-200/60 px-1.5 py-0.5 rounded-md"
              title={`Fecha límite: ${task.due_date}`}
            >
              <Calendar className="w-3 h-3 text-slate-400" />
              {task.due_date.slice(5)}
            </span>
          )}
          {renderPriority(task.priority)}
        </div>
      </div>

      {/* Title */}
      <div className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2">
        {task.title}
      </div>

      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.labels.map((lbl) => (
            <span
              key={lbl}
              className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded-md"
            >
              {lbl}
            </span>
          ))}
        </div>
      )}

      {/* Footer Meta: Story points, attachments, comments, assignee */}
      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2">
          {task.story_points !== null && task.story_points !== undefined && (
            <span
              className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shadow-2xs"
              title={`${task.story_points} Story Points`}
            >
              {task.story_points}
            </span>
          )}

          {taskAttachments.length > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] font-medium text-slate-400" title={`${taskAttachments.length} adjuntos`}>
              <Paperclip className="w-3 h-3" />
              <span>{taskAttachments.length}</span>
            </span>
          )}

          {taskComments.length > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] font-medium text-slate-400" title={`${taskComments.length} comentarios`}>
              <MessageSquare className="w-3 h-3" />
              <span>{taskComments.length}</span>
            </span>
          )}
        </div>

        {/* Assignee avatar */}
        {assignee ? (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold shadow-inner ring-1 ring-slate-200"
            style={{ backgroundColor: assignee.avatar_color }}
            title={`Asignado a: ${assignee.name}`}
          >
            {assignee.name.charAt(0)}
          </div>
        ) : (
          <div
            className="w-6 h-6 rounded-full border border-dashed border-slate-300 text-slate-300 text-[10px] flex items-center justify-center"
            title="Sin asignar"
          >
            ?
          </div>
        )}
      </div>
    </div>
  );
};
