import React from 'react';
import { useJira } from '../context/JiraContext';
import { TaskType, Priority } from '../types/jira';
import { Search, Filter, X, Tag, User as UserIcon } from 'lucide-react';

interface FilterBarProps {
  search: string;
  setSearch: (s: string) => void;
  typeFilter: string;
  setTypeFilter: (t: string) => void;
  priorityFilter: string;
  setPriorityFilter: (p: string) => void;
  assigneeFilter: string;
  setAssigneeFilter: (a: string) => void;
  labelFilter: string;
  setLabelFilter: (l: string) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  search,
  setSearch,
  typeFilter,
  setTypeFilter,
  priorityFilter,
  setPriorityFilter,
  assigneeFilter,
  setAssigneeFilter,
  labelFilter,
  setLabelFilter,
}) => {
  const { currentProject, members, users, tasks } = useJira();

  if (!currentProject) return null;

  // Project members
  const projectMemberIds = new Set(
    members.filter((m) => m.project_id === currentProject.id).map((m) => m.user_id)
  );
  const projectUsers = users.filter((u) => projectMemberIds.has(u.id));

  // Collect all unique labels in this project
  const projectTasks = tasks.filter((t) => t.project_id === currentProject.id);
  const uniqueLabels = Array.from(new Set(projectTasks.flatMap((t) => t.labels || [])));

  const hasActiveFilters =
    search.trim() !== '' ||
    typeFilter !== '' ||
    priorityFilter !== '' ||
    assigneeFilter !== '' ||
    labelFilter !== '';

  const clearAllFilters = () => {
    setSearch('');
    setTypeFilter('');
    setPriorityFilter('');
    setAssigneeFilter('');
    setLabelFilter('');
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5 mb-4 text-xs">
      {/* Search Input */}
      <div className="relative min-w-[200px] flex-1 sm:flex-initial">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título o clave..."
          className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-2xs transition-all"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Type Filter */}
      <select
        value={typeFilter}
        onChange={(e) => setTypeFilter(e.target.value)}
        className={`px-3 py-1.5 border rounded-xl bg-white outline-none shadow-2xs transition-colors ${
          typeFilter ? 'border-indigo-500 bg-indigo-50/40 text-indigo-800 font-semibold' : 'border-slate-300 text-slate-700'
        }`}
      >
        <option value="">Todos los tipos</option>
        <option value="story">📘 Story</option>
        <option value="task">☑️ Task</option>
        <option value="bug">🐞 Bug</option>
        <option value="epic">⚡ Epic</option>
        <option value="sub-task">🔗 Sub-task</option>
      </select>

      {/* Priority Filter */}
      <select
        value={priorityFilter}
        onChange={(e) => setPriorityFilter(e.target.value)}
        className={`px-3 py-1.5 border rounded-xl bg-white outline-none shadow-2xs transition-colors ${
          priorityFilter ? 'border-indigo-500 bg-indigo-50/40 text-indigo-800 font-semibold' : 'border-slate-300 text-slate-700'
        }`}
      >
        <option value="">Todas las prioridades</option>
        <option value="highest">🔴 Muy Alta (Highest)</option>
        <option value="high">🟠 Alta (High)</option>
        <option value="medium">🟡 Media (Medium)</option>
        <option value="low">🟢 Baja (Low)</option>
        <option value="lowest">🔵 Muy Baja (Lowest)</option>
      </select>

      {/* Assignee Filter */}
      <select
        value={assigneeFilter}
        onChange={(e) => setAssigneeFilter(e.target.value)}
        className={`px-3 py-1.5 border rounded-xl bg-white outline-none shadow-2xs transition-colors ${
          assigneeFilter ? 'border-indigo-500 bg-indigo-50/40 text-indigo-800 font-semibold' : 'border-slate-300 text-slate-700'
        }`}
      >
        <option value="">Todos los asignados</option>
        <option value="unassigned">Sin asignar</option>
        {projectUsers.map((u) => (
          <option key={u.id} value={String(u.id)}>
            {u.name}
          </option>
        ))}
      </select>

      {/* Label Filter */}
      {uniqueLabels.length > 0 && (
        <select
          value={labelFilter}
          onChange={(e) => setLabelFilter(e.target.value)}
          className={`px-3 py-1.5 border rounded-xl bg-white outline-none shadow-2xs transition-colors ${
            labelFilter ? 'border-indigo-500 bg-indigo-50/40 text-indigo-800 font-semibold' : 'border-slate-300 text-slate-700'
          }`}
        >
          <option value="">Todas las etiquetas</option>
          {uniqueLabels.map((lbl) => (
            <option key={lbl} value={lbl}>
              🏷️ {lbl}
            </option>
          ))}
        </select>
      )}

      {/* Clear Filters button */}
      {hasActiveFilters && (
        <button
          onClick={clearAllFilters}
          className="px-2.5 py-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 hover:border-rose-200 transition-colors flex items-center gap-1 font-semibold shadow-2xs"
        >
          <X className="w-3.5 h-3.5" />
          <span>Limpiar Filtros</span>
        </button>
      )}
    </div>
  );
};
