export type Role = 'admin' | 'po' | 'frontend' | 'backend';

export type TaskType = 'story' | 'task' | 'bug' | 'epic' | 'sub-task';
export type Priority = 'highest' | 'high' | 'medium' | 'low' | 'lowest';
export type SprintStatus = 'planned' | 'active' | 'completed';

export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  avatar_color: string;
  is_admin: boolean;
  role?: Role;
  password?: string;
  created_at?: string;
}

export interface Project {
  id: number;
  name: string;
  key: string;
  description: string;
  created_at: string;
}

export interface ProjectMember {
  id: number;
  project_id: number;
  user_id: number;
  role: Role;
  created_at: string;
  user?: User;
}

export interface BoardColumn {
  id: number;
  project_id: number;
  name: string;
  position: number;
  color: string;
  is_done_column: boolean;
}

export interface TaskAttachment {
  id: number;
  task_id: number;
  filename: string;
  stored_name: string;
  data_url?: string;
  content_type?: string;
  size: number;
  uploaded_by: number;
  created_at: string;
  uploader?: User;
}

export interface TaskComment {
  id: number;
  task_id: number;
  user_id: number;
  content: string;
  created_at: string;
  author?: User;
}

export interface ActivityLog {
  id: number;
  task_id: number;
  user_id: number;
  action: 'created' | 'moved' | 'edited' | 'commented' | 'attached' | 'deleted';
  field_changed?: string;
  old_value?: string;
  new_value?: string;
  created_at: string;
  user?: User;
}

export interface Task {
  id: number;
  project_id: number;
  column_id: number | null;
  sprint_id: number | null;
  title: string;
  description: string;
  task_type: TaskType;
  priority: Priority;
  status: string;
  story_points: number | null;
  assignee_id: number | null; // Primary assignee (for backwards compatibility)
  assignee_ids?: number[];    // Multiple assignees
  reporter_id: number | null;
  due_date: string | null;
  position: number;
  labels: string[];
  created_at: string;
  updated_at: string;
  task_key?: string;
  assignee?: User;
  assignees?: User[];
  reporter?: User;
  attachments?: TaskAttachment[];
}

export function getTaskAssigneeIds(task?: Partial<Task> | null): number[] {
  if (!task) return [];
  if (Array.isArray(task.assignee_ids) && task.assignee_ids.length > 0) {
    return task.assignee_ids;
  }
  if (task.assignee_id !== null && task.assignee_id !== undefined) {
    return [task.assignee_id];
  }
  return [];
}

export interface Sprint {
  id: number;
  project_id: number;
  name: string;
  goal: string;
  start_date: string | null;
  end_date: string | null;
  status: SprintStatus;
  created_at: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Project Manager (Admin)',
  po: 'Product Owner (Docente)',
  frontend: 'Frontend Developer',
  backend: 'Backend Developer',
};

export const ROLE_BADGE_LABELS: Record<Role, string> = {
  admin: 'Project Manager',
  po: 'Product Owner',
  frontend: 'Frontend',
  backend: 'Backend',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Gestión total del sistema: proyectos, miembros, importación masiva CSV y configuración.',
  po: 'Product Owner (Docente): Acceso global a todos los proyectos con permisos completos de edición, planificación y supervisión.',
  frontend: 'Desarrollador Frontend: Crear, editar y mover tareas, adjuntar evidencias, estimar y comentar.',
  backend: 'Desarrollador Backend: Crear, editar y mover tareas, adjuntar evidencias, estimar y comentar.',
};

export type Permission =
  | 'manage_project'
  | 'manage_columns'
  | 'manage_sprints'
  | 'manage_members'
  | 'manage_users'
  | 'manage_tasks'
  | 'move_tasks'
  | 'attach'
  | 'delete_any'
  | 'edit_any'
  | 'import_csv';

export const PERMISSIONS: Record<Role, Record<Permission, boolean>> = {
  admin: {
    manage_project: true,
    manage_columns: true,
    manage_sprints: true,
    manage_members: true,
    manage_users: true,
    manage_tasks: true,
    move_tasks: true,
    attach: true,
    delete_any: true,
    edit_any: true,
    import_csv: true,
  },
  po: {
    manage_project: true,
    manage_columns: true,
    manage_sprints: true,
    manage_members: true,
    manage_users: false, // Edición y administración total de usuarios restringida a PM (Admin)
    manage_tasks: true,
    move_tasks: true,
    attach: true,
    delete_any: true,
    edit_any: true,
    import_csv: false, // Solo desde el rol de product manager se accede a importar CSV
  },
  frontend: {
    manage_project: false,
    manage_columns: false,
    manage_sprints: true,
    manage_members: false,
    manage_users: false,
    manage_tasks: true,
    move_tasks: true,
    attach: true,
    delete_any: false,
    edit_any: true,
    import_csv: false,
  },
  backend: {
    manage_project: false,
    manage_columns: false,
    manage_sprints: true,
    manage_members: false,
    manage_users: false,
    manage_tasks: true,
    move_tasks: true,
    attach: true,
    delete_any: false,
    edit_any: true,
    import_csv: false,
  },
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role]?.[permission] ?? false;
}

export function canEditTask(role: Role, task: Task, userId: number): boolean {
  if (hasPermission(role, 'edit_any')) return true;
  const ids = getTaskAssigneeIds(task);
  if (ids.includes(userId)) return true;
  if (task.reporter_id === userId) return true;
  return false;
}
