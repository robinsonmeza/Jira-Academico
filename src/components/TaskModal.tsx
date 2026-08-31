import React, { useState, useEffect, useRef } from 'react';
import { useJira } from '../context/JiraContext';
import { Task, TaskType, Priority, getTaskAssigneeIds } from '../types/jira';
import {
  X,
  Trash2,
  Paperclip,
  MessageSquare,
  History,
  Calendar,
  Tag,
  Bookmark,
  CheckSquare,
  AlertCircle,
  Zap,
  GitCommit,
  Send,
  Upload,
  Eye,
  CheckCircle2,
  Lock,
  UserPlus,
  Users,
  Check,
  Search,
} from 'lucide-react';

interface TaskModalProps {
  taskId: number | null; // null for creating new task
  initialColumnId?: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  taskId,
  initialColumnId = null,
  isOpen,
  onClose,
}) => {
  const {
    tasks,
    columns,
    sprints,
    users,
    currentUser,
    comments,
    activityLogs,
    attachments,
    hasPerm,
    canEdit,
    createTask,
    updateTask,
    deleteTask,
    addComment,
    deleteComment,
    uploadAttachment,
    deleteAttachment,
  } = useJira();

  const isEditing = taskId !== null;
  const existingTask = isEditing ? tasks.find((t) => t.id === taskId) : null;

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('task');
  const [priority, setPriority] = useState<Priority>('medium');
  const [storyPoints, setStoryPoints] = useState<number | ''>('');
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [columnId, setColumnId] = useState<number | ''>('');
  const [sprintId, setSprintId] = useState<number | ''>('');
  const [dueDate, setDueDate] = useState('');
  const [labelsInput, setLabelsInput] = useState('');
  const assigneeDropdownRef = useRef<HTMLDivElement>(null);

  // Active Tab: 'details' | 'comments' | 'activity' | 'attachments'
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'activity' | 'attachments'>('details');
  const [newComment, setNewComment] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Editable permission check
  const isEditable = !isEditing || (existingTask && canEdit(existingTask));

  // Close assignee dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        assigneeDropdownRef.current &&
        !assigneeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsAssigneeDropdownOpen(false);
      }
    };
    if (isAssigneeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAssigneeDropdownOpen]);

  useEffect(() => {
    if (existingTask) {
      setTitle(existingTask.title);
      setDescription(existingTask.description || '');
      setTaskType(existingTask.task_type);
      setPriority(existingTask.priority);
      setStoryPoints(existingTask.story_points ?? '');
      setAssigneeIds(getTaskAssigneeIds(existingTask));
      setColumnId(existingTask.column_id ?? '');
      setSprintId(existingTask.sprint_id ?? '');
      setDueDate(existingTask.due_date || '');
      setLabelsInput((existingTask.labels || []).join(', '));
      setActiveTab('details');
    } else {
      setTitle('');
      setDescription('');
      setTaskType('task');
      setPriority('medium');
      setStoryPoints('');
      setAssigneeIds(currentUser ? [currentUser.id] : []);
      setColumnId(initialColumnId ?? columns[0]?.id ?? '');
      setSprintId('');
      setDueDate('');
      setLabelsInput('');
      setActiveTab('details');
    }
    setIsAssigneeDropdownOpen(false);
    setUserSearchQuery('');
    setFormError(null);
    setUploadError(null);
  }, [existingTask, initialColumnId, columns, currentUser, isOpen]);

  if (!isOpen) return null;

  const toggleAssignee = (userId: number) => {
    if (!isEditable) return;
    setAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const removeAssignee = (userId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditable) return;
    setAssigneeIds((prev) => prev.filter((id) => id !== userId));
  };

  const assignCurrentUser = () => {
    if (!currentUser || !isEditable) return;
    if (!assigneeIds.includes(currentUser.id)) {
      setAssigneeIds((prev) => [...prev, currentUser.id]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('El título de la tarea es requerido.');
      return;
    }

    const labels = labelsInput
      .split(',')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const taskPayload: Partial<Task> = {
      title: title.trim(),
      description: description.trim(),
      task_type: taskType,
      priority: priority,
      story_points: storyPoints === '' ? null : Number(storyPoints),
      assignee_id: assigneeIds.length > 0 ? assigneeIds[0] : null,
      assignee_ids: assigneeIds,
      column_id: columnId === '' ? null : Number(columnId),
      sprint_id: sprintId === '' ? null : Number(sprintId),
      due_date: dueDate || null,
      labels,
    };

    if (isEditing && taskId) {
      const res = updateTask(taskId, taskPayload);
      if (res.success) {
        onClose();
      } else {
        setFormError(res.error || 'Error al guardar los cambios.');
      }
    } else {
      const res = createTask(taskPayload);
      if (res.success) {
        onClose();
      } else {
        setFormError(res.error || 'Error al crear la tarea.');
      }
    }
  };

  const handleDelete = () => {
    if (taskId && confirm('¿Estás seguro de eliminar esta tarea definitivamente?')) {
      deleteTask(taskId);
      onClose();
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !taskId) return;
    addComment(taskId, newComment);
    setNewComment('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !taskId) return;
    const file = e.target.files[0];

    if (!file.type.startsWith('image/')) {
      setUploadError('Solo se permiten archivos de imagen (PNG, JPG, GIF, WebP).');
      return;
    }

    setUploadError(null);
    const res = await uploadAttachment(taskId, file);
    if (!res.success) {
      setUploadError(res.error || 'Error al subir la imagen.');
    }
    e.target.value = '';
  };

  // Activity, comments and attachments for this task
  const taskComments = comments.filter((c) => c.task_id === taskId);
  const taskActivity = activityLogs.filter((a) => a.task_id === taskId);
  const taskAttachments = attachments.filter((a) => a.task_id === taskId);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg shadow-2xs">
              {existingTask ? existingTask.task_key : 'NUEVA TAREA'}
            </span>
            <h2 className="text-base font-bold text-slate-900 tracking-tight truncate max-w-md">
              {isEditing ? existingTask?.title : 'Crear Tarea en el Board'}
            </h2>
            {!isEditable && (
              <span className="text-xs bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded-md flex items-center gap-1 font-medium">
                <Lock className="w-3 h-3" /> Solo lectura
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isEditing && hasPerm('delete_any') && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title="Eliminar tarea"
              >
                <Trash2 className="w-4 h-4" />
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

        {/* Tab Selector if editing */}
        {isEditing && (
          <div className="px-6 border-b border-slate-200 bg-white flex items-center gap-6 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`py-3 border-b-2 transition-colors ${
                activeTab === 'details'
                  ? 'border-indigo-600 text-indigo-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Detalles
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('comments')}
              className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'comments'
                  ? 'border-indigo-600 text-indigo-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Comentarios ({taskComments.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('attachments')}
              className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'attachments'
                  ? 'border-indigo-600 text-indigo-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Paperclip className="w-3.5 h-3.5" />
              Adjuntos ({taskAttachments.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('activity')}
              className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'activity'
                  ? 'border-indigo-600 text-indigo-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Historial ({taskActivity.length})
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {formError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{formError}</span>
            </div>
          )}

          {activeTab === 'details' && (
            <form id="task-form" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Main info */}
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Título de la Tarea *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="ej. Implementar pantalla de Login"
                    disabled={!isEditable}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-slate-100 shadow-2xs transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Descripción
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Añade una descripción detallada, criterios de aceptación o notas técnicas..."
                    rows={6}
                    disabled={!isEditable}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-slate-100 shadow-2xs transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-slate-400" />
                    Etiquetas / Labels (separadas por coma)
                  </label>
                  <input
                    type="text"
                    value={labelsInput}
                    onChange={(e) => setLabelsInput(e.target.value)}
                    placeholder="frontend, auth, api, urgent"
                    disabled={!isEditable}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-slate-100 shadow-2xs transition-all"
                  />
                </div>
              </div>

              {/* Right Col: Attributes panel */}
              <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2">
                  Atributos de Issue
                </div>

                {/* Task Type */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tipo de Issue</label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value as TaskType)}
                    disabled={!isEditable}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-slate-100 shadow-2xs"
                  >
                    <option value="story">Story (Historia de Usuario)</option>
                    <option value="task">Task (Tarea estándar)</option>
                    <option value="bug">Bug (Defecto / Error)</option>
                    <option value="epic">Epic (Iniciativa épica)</option>
                    <option value="sub-task">Sub-task (Subtarea)</option>
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Prioridad</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    disabled={!isEditable}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-slate-100 shadow-2xs"
                  >
                    <option value="highest">🔴 Muy Alta (Highest)</option>
                    <option value="high">🟠 Alta (High)</option>
                    <option value="medium">🟡 Media (Medium)</option>
                    <option value="low">🟢 Baja (Low)</option>
                    <option value="lowest">🔵 Muy Baja (Lowest)</option>
                  </select>
                </div>

                {/* Column / Status */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Estado (Columna)</label>
                  <select
                    value={columnId}
                    onChange={(e) => setColumnId(e.target.value === '' ? '' : Number(e.target.value))}
                    disabled={!isEditable}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-slate-100 shadow-2xs"
                  >
                    <option value="">Sin columna / Backlog</option>
                    {columns.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sprint */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Sprint Asociado</label>
                  <select
                    value={sprintId}
                    onChange={(e) => setSprintId(e.target.value === '' ? '' : Number(e.target.value))}
                    disabled={!isEditable}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-slate-100 shadow-2xs"
                  >
                    <option value="">Sin Sprint (Backlog)</option>
                    {sprints.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.status})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Story points */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Story Points (Fibonacci)
                  </label>
                  <select
                    value={storyPoints}
                    onChange={(e) => setStoryPoints(e.target.value === '' ? '' : Number(e.target.value))}
                    disabled={!isEditable}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-slate-100 shadow-2xs"
                  >
                    <option value="">Sin estimación (-)</option>
                    <option value="0">0 pts</option>
                    <option value="1">1 pt</option>
                    <option value="2">2 pts</option>
                    <option value="3">3 pts</option>
                    <option value="5">5 pts</option>
                    <option value="8">8 pts</option>
                    <option value="13">13 pts</option>
                  </select>
                </div>

                {/* Assignees (Multiple) */}
                <div className="relative" ref={assigneeDropdownRef}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                      <Users className="w-3 h-3 text-indigo-500" />
                      <span>Responsables ({assigneeIds.length})</span>
                    </label>
                    {currentUser && isEditable && !assigneeIds.includes(currentUser.id) && (
                      <button
                        type="button"
                        onClick={assignCurrentUser}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold hover:underline"
                      >
                        + Asignarme a mí
                      </button>
                    )}
                  </div>

                  {/* Selected Assignees Chips Container */}
                  <div
                    onClick={() => isEditable && setIsAssigneeDropdownOpen((prev) => !prev)}
                    className={`min-h-[38px] p-1.5 border rounded-xl bg-white flex flex-wrap items-center gap-1.5 transition-all ${
                      isEditable ? 'cursor-pointer hover:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500' : 'bg-slate-100 cursor-not-allowed'
                    } ${isAssigneeDropdownOpen ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-300'} shadow-2xs`}
                  >
                    {assigneeIds.length === 0 ? (
                      <span className="text-xs text-slate-400 italic px-1.5 py-0.5">
                        {isEditable ? 'Haz clic para asignar miembros...' : 'Sin asignar'}
                      </span>
                    ) : (
                      assigneeIds.map((uid) => {
                        const u = users.find((user) => user.id === uid);
                        if (!u) return null;
                        return (
                          <span
                            key={u.id}
                            className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 border border-slate-200/80 rounded-lg pl-1 pr-1.5 py-0.5 text-xs font-medium shadow-2xs"
                          >
                            <span
                              className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] text-white font-bold"
                              style={{ backgroundColor: u.avatar_color }}
                            >
                              {u.name.charAt(0).toUpperCase()}
                            </span>
                            <span className="truncate max-w-[90px]">{u.name}</span>
                            {isEditable && (
                              <button
                                type="button"
                                onClick={(e) => removeAssignee(u.id, e)}
                                className="text-slate-400 hover:text-rose-600 hover:bg-slate-200/60 rounded p-0.5 transition-colors"
                                title={`Quitar a ${u.name}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </span>
                        );
                      })
                    )}

                    {isEditable && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsAssigneeDropdownOpen((prev) => !prev);
                        }}
                        className="ml-auto p-1 text-slate-400 hover:text-indigo-600 rounded-md transition-colors text-xs flex items-center gap-1 font-semibold"
                        title="Gestionar asignaciones"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Dropdown Popover */}
                  {isAssigneeDropdownOpen && isEditable && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 text-xs animate-in fade-in zoom-in-95 duration-100">
                      {/* Search in user list */}
                      <div className="relative mb-2">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={userSearchQuery}
                          onChange={(e) => setUserSearchQuery(e.target.value)}
                          placeholder="Buscar usuario o rol..."
                          className="w-full pl-8 pr-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      </div>

                      {/* Quick actions */}
                      <div className="flex items-center justify-between px-1 pb-1.5 mb-1.5 border-b border-slate-100 text-[11px]">
                        <span className="text-slate-400">Seleccionar responsables</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setAssigneeIds(users.map((u) => u.id))}
                            className="text-indigo-600 hover:text-indigo-800 font-semibold"
                          >
                            Todos
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={() => setAssigneeIds([])}
                            className="text-slate-500 hover:text-rose-600 font-semibold"
                          >
                            Ninguno
                          </button>
                        </div>
                      </div>

                      {/* User list */}
                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                        {users
                          .filter((u) => {
                            if (!userSearchQuery.trim()) return true;
                            const q = userSearchQuery.toLowerCase();
                            return (
                              u.name.toLowerCase().includes(q) ||
                              u.username.toLowerCase().includes(q) ||
                              (u.role && u.role.toLowerCase().includes(q))
                            );
                          })
                          .map((u) => {
                            const isAssigned = assigneeIds.includes(u.id);
                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => toggleAssignee(u.id)}
                                className={`w-full px-2 py-1.5 rounded-lg flex items-center justify-between transition-colors text-left ${
                                  isAssigned
                                    ? 'bg-indigo-50/80 text-indigo-900 font-semibold'
                                    : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold shrink-0"
                                    style={{ backgroundColor: u.avatar_color }}
                                  >
                                    {u.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="text-xs leading-tight">{u.name}</div>
                                    <div className="text-[10px] text-slate-400 font-mono">
                                      @{u.username} • {u.role || (u.is_admin ? 'admin' : 'miembro')}
                                    </div>
                                  </div>
                                </div>

                                <div
                                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                    isAssigned
                                      ? 'bg-indigo-600 border-indigo-600 text-white'
                                      : 'border-slate-300 bg-white'
                                  }`}
                                >
                                  {isAssigned && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                              </button>
                            );
                          })}
                      </div>

                      <div className="pt-2 mt-1 border-t border-slate-100 text-right">
                        <button
                          type="button"
                          onClick={() => setIsAssigneeDropdownOpen(false)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                        >
                          Listo
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    Fecha Límite
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    disabled={!isEditable}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-slate-100 shadow-2xs"
                  />
                </div>
              </div>
            </form>
          )}

          {/* Comments Tab */}
          {activeTab === 'comments' && (
            <div className="space-y-4">
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Escribe un comentario o actualización..."
                  className="flex-1 px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-2xs"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Send className="w-4 h-4" />
                  <span>Enviar</span>
                </button>
              </form>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                {taskComments.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No hay comentarios en esta tarea aún.
                  </div>
                ) : (
                  taskComments.map((c) => {
                    const author = users.find((u) => u.id === c.user_id);
                    return (
                      <div key={c.id} className="p-3.5 hover:bg-slate-50 flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5"
                            style={{ backgroundColor: author?.avatar_color || '#6366F1' }}
                          >
                            {author?.name.charAt(0) || '?'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800">{author?.name || 'Usuario'}</span>
                              <span className="text-[11px] text-slate-400">
                                {new Date(c.created_at).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm text-slate-700 mt-1 leading-relaxed">{c.content}</p>
                          </div>
                        </div>

                        {currentUser && (currentUser.id === c.user_id || hasPerm('delete_any')) && (
                          <button
                            onClick={() => deleteComment(c.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                            title="Eliminar comentario"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Attachments Tab */}
          {activeTab === 'attachments' && (
            <div className="space-y-4">
              {hasPerm('attach') && (
                <div>
                  <label className="block p-4 border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-indigo-50/30">
                    <Upload className="w-6 h-6 text-indigo-600 mx-auto mb-1.5" />
                    <span className="text-xs font-semibold text-slate-700 block">
                      Haz clic para subir una imagen o evidencia
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Formatos soportados: PNG, JPG, JPEG, GIF, WebP
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {uploadError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {uploadError}
                </div>
              )}

              {/* Gallery */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {taskAttachments.length === 0 ? (
                  <div className="col-span-full py-8 text-center text-slate-400 text-xs">
                    No hay imágenes adjuntas en esta tarea.
                  </div>
                ) : (
                  taskAttachments.map((att) => (
                    <div
                      key={att.id}
                      className="group relative border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs hover:shadow-md transition-all"
                    >
                      <div
                        onClick={() => setPreviewImage(att.data_url || '')}
                        className="h-32 bg-slate-100 cursor-pointer overflow-hidden flex items-center justify-center"
                      >
                        {att.data_url ? (
                          <img
                            src={att.data_url}
                            alt={att.filename}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <Paperclip className="w-8 h-8 text-slate-400" />
                        )}
                      </div>

                      <div className="p-2.5 flex items-center justify-between text-xs">
                        <span className="truncate max-w-[120px] font-medium text-slate-700" title={att.filename}>
                          {att.filename}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setPreviewImage(att.data_url || '')}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-100"
                            title="Ver en grande"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {hasPerm('delete_any') && (
                            <button
                              onClick={() => deleteAttachment(att.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                              title="Eliminar adjunto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Activity Log Tab */}
          {activeTab === 'activity' && (
            <div className="space-y-3">
              {taskActivity.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No hay registro de actividad aún.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  {taskActivity.map((log) => {
                    const user = users.find((u) => u.id === log.user_id);
                    return (
                      <div key={log.id} className="p-3 hover:bg-slate-50 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                            style={{ backgroundColor: user?.avatar_color || '#6366F1' }}
                          >
                            {user?.name.charAt(0) || '?'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800">{user?.name || 'Sistema'}</span>{' '}
                            <span className="text-slate-600">
                              {log.action === 'created' && 'creó la tarea'}
                              {log.action === 'moved' && (
                                <>
                                  movió el estado de <em>{log.old_value}</em> a <em>{log.new_value}</em>
                                </>
                              )}
                              {log.action === 'edited' && (
                                <>
                                  modificó el campo <strong>{log.field_changed}</strong>
                                </>
                              )}
                              {log.action === 'commented' && 'agregó un comentario'}
                              {log.action === 'attached' && `adjuntó el archivo '${log.new_value}'`}
                              {log.action === 'deleted' && `eliminó el adjunto '${log.old_value}'`}
                            </span>
                          </div>
                        </div>

                        <span className="text-[11px] text-slate-400 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {existingTask && (
              <span>
                Creado: {new Date(existingTask.created_at).toLocaleDateString()} | Actualizado:{' '}
                {new Date(existingTask.updated_at).toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              Cerrar
            </button>
            {isEditable && activeTab === 'details' && (
              <button
                type="submit"
                form="task-form"
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors shadow-2xs"
              >
                {isEditing ? 'Guardar Cambios' : 'Crear Tarea'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Image Preview Lightbox Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-xl bg-black">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 text-white bg-black/50 p-2 rounded-full hover:bg-black transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <img src={previewImage} alt="Preview" className="max-w-full max-h-[85vh] object-contain" />
          </div>
        </div>
      )}
    </div>
  );
};
