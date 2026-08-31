import React, { useState } from 'react';
import { useJira } from '../context/JiraContext';
import { Task, BoardColumn } from '../types/jira';
import {
  ArrowLeft,
  Kanban,
  ListPlus,
  BarChart3,
  Users,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Lock,
  Layers,
  Sparkles,
} from 'lucide-react';
import { TaskCard } from './TaskCard';
import { SprintBar } from './SprintBar';
import { FilterBar } from './FilterBar';
import { BacklogView } from './BacklogView';
import { ReportsView } from './ReportsView';
import { TaskModal } from './TaskModal';
import { SprintModal } from './SprintModal';
import { MembersModal } from './MemberModals';

interface BoardViewProps {
  onBackToProjects: () => void;
}

export const BoardView: React.FC<BoardViewProps> = ({ onBackToProjects }) => {
  const {
    currentProject,
    columns,
    tasks,
    currentRole,
    hasPerm,
    moveTask,
    addColumn,
    updateColumn,
    deleteColumn,
  } = useJira();

  // Active View Tab: 'board' | 'backlog' | 'reports'
  const [activeTab, setActiveTab] = useState<'board' | 'backlog' | 'reports'>('board');

  // Filters State
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState('');

  // Selected Sprint Filter ('all' | 'backlog' | sprintId)
  const [selectedSprintId, setSelectedSprintId] = useState<number | 'all' | 'backlog'>('all');

  // Modals state
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [targetColumnId, setTargetColumnId] = useState<number | null>(null);
  const [isSprintModalOpen, setIsSprintModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColColor, setNewColColor] = useState('#C3CFE2');

  // Drag over tracking
  const [dragOverColId, setDragOverColId] = useState<number | null>(null);
  const [columnMenuId, setColumnMenuId] = useState<number | null>(null);

  if (!currentProject) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <p className="text-slate-500">No hay ningún proyecto seleccionado.</p>
        <button
          onClick={onBackToProjects}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold"
        >
          Volver a Proyectos
        </button>
      </div>
    );
  }

  const projectColumns = columns
    .filter((c) => c.project_id === currentProject.id)
    .sort((a, b) => a.position - b.position);

  const projectTasks = tasks.filter((t) => t.project_id === currentProject.id);

  // Apply Sprint & Attribute Filters
  const filteredTasks = projectTasks.filter((t) => {
    // Sprint filter
    if (selectedSprintId === 'backlog') {
      if (t.sprint_id !== null && t.status.toLowerCase() !== 'backlog') return false;
    } else if (typeof selectedSprintId === 'number') {
      if (t.sprint_id !== selectedSprintId) return false;
    }

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchKey = t.task_key?.toLowerCase().includes(q) ?? false;
      if (!matchTitle && !matchKey) return false;
    }

    // Type filter
    if (typeFilter && t.task_type !== typeFilter) return false;

    // Priority filter
    if (priorityFilter && t.priority !== priorityFilter) return false;

    // Assignee filter
    if (assigneeFilter) {
      if (assigneeFilter === 'unassigned') {
        if (t.assignee_id !== null) return false;
      } else {
        if (String(t.assignee_id) !== assigneeFilter) return false;
      }
    }

    // Label filter
    if (labelFilter && !(t.labels || []).includes(labelFilter)) return false;

    return true;
  });

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    if (!hasPerm('move_tasks')) return;
    e.dataTransfer.setData('text/plain', String(taskId));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, colId: number) => {
    if (!hasPerm('move_tasks')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColId !== colId) {
      setDragOverColId(colId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, colId: number) => {
    if (dragOverColId === colId) {
      setDragOverColId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, colId: number) => {
    e.preventDefault();
    setDragOverColId(null);
    if (!hasPerm('move_tasks')) return;

    const rawTaskId = e.dataTransfer.getData('text/plain');
    if (!rawTaskId) return;

    const taskId = Number(rawTaskId);
    moveTask(taskId, colId);
  };

  const handleOpenCreateTask = (columnId?: number | null) => {
    setSelectedTaskId(null);
    setTargetColumnId(columnId ?? null);
    setIsTaskModalOpen(true);
  };

  const handleOpenEditTask = (taskId: number) => {
    setSelectedTaskId(taskId);
    setIsTaskModalOpen(true);
  };

  const handleAddColumnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    addColumn(newColName.trim(), newColColor);
    setNewColName('');
    setIsAddColumnModalOpen(false);
  };

  const handleRenameColumn = (col: BoardColumn) => {
    const newName = prompt('Nuevo nombre para la columna:', col.name);
    if (newName && newName.trim() && newName.trim() !== col.name) {
      updateColumn(col.id, { name: newName.trim() });
    }
  };

  const handleDeleteColumn = (col: BoardColumn) => {
    if (confirm(`¿Eliminar la columna '${col.name}'? Las tareas se reasignarán a otra columna o al backlog.`)) {
      deleteColumn(col.id);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToProjects}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition-colors border border-transparent hover:border-slate-300 shadow-2xs"
            title="Volver a lista de proyectos"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="bg-indigo-600 text-white font-mono text-xs font-bold px-2 py-0.5 rounded-md shadow-2xs">
                {currentProject.key}
              </span>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{currentProject.name}</h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{currentProject.description || 'Tablero Ágil'}</p>
          </div>
        </div>

        {/* Navigation Tabs and Members action */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-200/80 p-1 rounded-xl flex items-center gap-1 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('board')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'board'
                  ? 'bg-white text-indigo-600 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Board</span>
            </button>

            <button
              onClick={() => setActiveTab('backlog')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'backlog'
                  ? 'bg-white text-indigo-600 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListPlus className="w-3.5 h-3.5" />
              <span>Backlog</span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'reports'
                  ? 'bg-white text-indigo-600 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Reportes</span>
            </button>
          </div>

          <button
            onClick={() => setIsMembersModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-semibold rounded-xl shadow-2xs transition-colors"
          >
            <Users className="w-4 h-4 text-indigo-600" />
            <span>Miembros</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mt-5">
        {/* Sprint Bar */}
        <SprintBar
          selectedSprintId={selectedSprintId}
          setSelectedSprintId={setSelectedSprintId}
          onOpenCreateSprint={() => setIsSprintModalOpen(true)}
        />

        {/* Filter Bar */}
        <FilterBar
          search={search}
          setSearch={setSearch}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          priorityFilter={priorityFilter}
          setPriorityFilter={setPriorityFilter}
          assigneeFilter={assigneeFilter}
          setAssigneeFilter={setAssigneeFilter}
          labelFilter={labelFilter}
          setLabelFilter={setLabelFilter}
        />

        {/* 1. Board View (Kanban) */}
        {activeTab === 'board' && (
          <div className="overflow-x-auto pb-6">
            <div className="flex items-start gap-4 min-h-[580px] min-w-max">
              {projectColumns.map((col) => {
                const colTasks = filteredTasks
                  .filter((t) => t.column_id === col.id)
                  .sort((a, b) => a.position - b.position);

                const isDragOver = dragOverColId === col.id;

                return (
                  <div
                    key={col.id}
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDragLeave={(e) => handleDragLeave(e, col.id)}
                    onDrop={(e) => handleDrop(e, col.id)}
                    className={`w-72 bg-slate-200/60 rounded-xl border flex flex-col shrink-0 transition-all ${
                      isDragOver
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-md ring-2 ring-indigo-400/20'
                        : 'border-slate-300/80 shadow-2xs'
                    }`}
                  >
                    {/* Column Header */}
                    <div
                      className="px-3.5 py-2.5 border-b border-slate-300/70 rounded-t-xl flex items-center justify-between"
                      style={{
                        backgroundColor: col.color ? `${col.color}40` : undefined,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: col.color || '#4A90D9' }}
                        />
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          {col.name}
                        </h3>
                        <span className="bg-slate-300/80 text-slate-700 text-[11px] font-bold px-1.5 py-0.2 rounded-full">
                          {colTasks.length}
                        </span>
                      </div>

                      {hasPerm('manage_columns') && (
                        <div className="relative">
                          <button
                            onClick={() => setColumnMenuId(columnMenuId === col.id ? null : col.id)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-black/5"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {columnMenuId === col.id && (
                            <div
                              className="absolute right-0 mt-1 w-32 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-30 text-xs"
                              onMouseLeave={() => setColumnMenuId(null)}
                            >
                              <button
                                onClick={() => {
                                  handleRenameColumn(col);
                                  setColumnMenuId(null);
                                }}
                                className="w-full text-left px-3 py-1.5 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                              >
                                <Pencil className="w-3 h-3" />
                                Renombrar
                              </button>
                              {projectColumns.length > 1 && (
                                <button
                                  onClick={() => {
                                    handleDeleteColumn(col);
                                    setColumnMenuId(null);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-rose-600 hover:bg-rose-50 flex items-center gap-1.5"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Eliminar
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Task Cards Container */}
                    <div className="p-2.5 flex-1 flex flex-col gap-2 min-h-[160px] max-h-[calc(100vh-320px)] overflow-y-auto">
                      {colTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onOpenModal={handleOpenEditTask}
                          onDragStart={handleDragStart}
                        />
                      ))}

                      {colTasks.length === 0 && (
                        <div className="flex-1 border-2 border-dashed border-slate-300/60 rounded-lg flex items-center justify-center p-4 text-center">
                          <span className="text-[11px] text-slate-400">Arrastra tareas aquí</span>
                        </div>
                      )}
                    </div>

                    {/* Add task button in column */}
                    {hasPerm('manage_tasks') && (
                      <div className="p-2 border-t border-slate-300/50 bg-slate-100/50 rounded-b-xl">
                        <button
                          onClick={() => handleOpenCreateTask(col.id)}
                          className="w-full py-1.5 px-2 rounded-lg border border-transparent hover:border-slate-300 hover:bg-white text-slate-600 hover:text-indigo-600 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Crear Tarea</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add Column Card */}
              {hasPerm('manage_columns') && (
                <button
                  onClick={() => setIsAddColumnModalOpen(true)}
                  className="w-60 h-36 border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl flex flex-col items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/20 transition-all shrink-0 p-4"
                >
                  <Plus className="w-6 h-6 mb-1" />
                  <span className="text-xs font-bold">Agregar Columna</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 2. Backlog View */}
        {activeTab === 'backlog' && (
          <BacklogView onOpenTaskModal={handleOpenCreateTask} tasksList={filteredTasks} />
        )}

        {/* 3. Reports View */}
        {activeTab === 'reports' && <ReportsView />}
      </div>

      {/* Task Creation & Detail Modal */}
      <TaskModal
        taskId={selectedTaskId}
        initialColumnId={targetColumnId}
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
      />

      {/* Sprint Modal */}
      <SprintModal isOpen={isSprintModalOpen} onClose={() => setIsSprintModalOpen(false)} />

      {/* Members Modal */}
      <MembersModal isOpen={isMembersModalOpen} onClose={() => setIsMembersModalOpen(false)} />

      {/* Add Column Modal */}
      {isAddColumnModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-800 mb-3">Agregar Nueva Columna</h3>
            <form onSubmit={handleAddColumnSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Nombre de Columna *
                </label>
                <input
                  type="text"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  placeholder="ej. QA Testing"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-2xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Color de Cabecera
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newColColor}
                    onChange={(e) => setNewColColor(e.target.value)}
                    className="w-9 h-9 p-0.5 border border-slate-300 rounded-lg cursor-pointer shadow-2xs"
                  />
                  <span className="text-xs text-slate-500 font-mono">{newColColor}</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddColumnModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
                >
                  Crear Columna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
