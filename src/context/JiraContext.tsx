import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  User,
  Project,
  ProjectMember,
  BoardColumn,
  Task,
  Sprint,
  TaskComment,
  ActivityLog,
  TaskAttachment,
  Role,
  Permission,
  hasPermission,
  canEditTask,
} from '../types/jira';
import {
  INITIAL_USERS,
  INITIAL_PROJECTS,
  INITIAL_COLUMNS,
  INITIAL_MEMBERS,
  INITIAL_SPRINTS,
  INITIAL_TASKS,
  INITIAL_COMMENTS,
  INITIAL_ACTIVITY,
} from '../data/seedData';

interface ImportUserPayload {
  name: string;
  username: string;
  password?: string;
  email?: string;
  role: Role;
  projectId?: number;
}

interface JiraContextType {
  currentUser: User | null;
  currentProject: Project | null;
  users: User[];
  projects: Project[];
  accessibleProjects: Project[];
  members: ProjectMember[];
  columns: BoardColumn[];
  tasks: Task[];
  sprints: Sprint[];
  comments: TaskComment[];
  activityLogs: ActivityLog[];
  attachments: TaskAttachment[];
  currentRole: Role;
  hasPerm: (perm: Permission) => boolean;
  canEdit: (task: Task) => boolean;
  // Auth
  login: (username: string, password?: string) => { success: boolean; error?: string };
  logout: () => void;
  switchUser: (userId: number) => void;
  // Projects
  selectProject: (projectId: number) => void;
  createProject: (name: string, key: string, description: string) => { success: boolean; error?: string };
  updateProject: (id: number, name: string, description: string) => { success: boolean; error?: string };
  deleteProject: (id: number) => { success: boolean; error?: string };
  // Members
  createMemberWithCredentials: (data: {
    name: string;
    username: string;
    password?: string;
    role: Role;
    project_id: number;
    email?: string;
  }) => { success: boolean; error?: string };
  addMemberToProject: (projectId: number, userId: number, role: Role) => { success: boolean; error?: string };
  updateMemberRole: (memberId: number, role: Role) => void;
  removeMemberFromProject: (memberId: number) => void;
  // Users Administration (Admin / Project Manager)
  updateUser: (
    userId: number,
    data: {
      name?: string;
      username?: string;
      password?: string;
      email?: string;
      role?: Role;
      avatar_color?: string;
    },
    projectIds?: number[]
  ) => { success: boolean; error?: string };
  deleteUser: (userId: number) => { success: boolean; error?: string };
  // Batch CSV Import
  importUsersBatch: (
    importedUsers: ImportUserPayload[],
    defaultProjectId?: number
  ) => { success: boolean; count: number; error?: string };
  // Columns
  addColumn: (name: string, color?: string, isDone?: boolean) => void;
  updateColumn: (id: number, updates: Partial<BoardColumn>) => void;
  deleteColumn: (id: number) => void;
  // Tasks
  createTask: (data: Partial<Task>) => { success: boolean; error?: string; task?: Task };
  updateTask: (id: number, data: Partial<Task>) => { success: boolean; error?: string };
  deleteTask: (id: number) => { success: boolean; error?: string };
  moveTask: (taskId: number, newColumnId: number | null, newPosition?: number) => void;
  // Sprints
  createSprint: (name: string, goal: string, startDate?: string, endDate?: string) => Sprint;
  updateSprint: (id: number, updates: Partial<Sprint>) => void;
  startSprint: (sprintId: number) => void;
  completeSprint: (sprintId: number) => void;
  // Comments & Activity
  addComment: (taskId: number, content: string) => void;
  deleteComment: (commentId: number) => void;
  // Attachments
  uploadAttachment: (taskId: number, file: File) => Promise<{ success: boolean; error?: string }>;
  deleteAttachment: (attachmentId: number) => void;
  // Reset
  resetToDemoData: () => void;
}

const STORAGE_KEYS = {
  USERS: 'jira_clone_users_v3',
  PROJECTS: 'jira_clone_projects_v3',
  MEMBERS: 'jira_clone_members_v3',
  COLUMNS: 'jira_clone_columns_v3',
  TASKS: 'jira_clone_tasks_v3',
  SPRINTS: 'jira_clone_sprints_v3',
  COMMENTS: 'jira_clone_comments_v3',
  ACTIVITY: 'jira_clone_activity_v3',
  ATTACHMENTS: 'jira_clone_attachments_v3',
  CURRENT_USER_ID: 'jira_clone_current_user_id_v3',
  CURRENT_PROJECT_ID: 'jira_clone_current_project_id_v3',
};

const JiraContext = createContext<JiraContextType | undefined>(undefined);

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error loading ${key} from storage:`, err);
    return fallback;
  }
}

export const JiraProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(() => loadFromStorage(STORAGE_KEYS.USERS, INITIAL_USERS));
  const [projects, setProjects] = useState<Project[]>(() => loadFromStorage(STORAGE_KEYS.PROJECTS, INITIAL_PROJECTS));
  const [members, setMembers] = useState<ProjectMember[]>(() => loadFromStorage(STORAGE_KEYS.MEMBERS, INITIAL_MEMBERS));
  const [columns, setColumns] = useState<BoardColumn[]>(() => loadFromStorage(STORAGE_KEYS.COLUMNS, INITIAL_COLUMNS));
  const [tasks, setTasks] = useState<Task[]>(() => loadFromStorage(STORAGE_KEYS.TASKS, INITIAL_TASKS));
  const [sprints, setSprints] = useState<Sprint[]>(() => loadFromStorage(STORAGE_KEYS.SPRINTS, INITIAL_SPRINTS));
  const [comments, setComments] = useState<TaskComment[]>(() => loadFromStorage(STORAGE_KEYS.COMMENTS, INITIAL_COMMENTS));
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => loadFromStorage(STORAGE_KEYS.ACTIVITY, INITIAL_ACTIVITY));
  const [attachments, setAttachments] = useState<TaskAttachment[]>(() => loadFromStorage(STORAGE_KEYS.ATTACHMENTS, []));

  const [currentUserId, setCurrentUserId] = useState<number | null>(() =>
    loadFromStorage(STORAGE_KEYS.CURRENT_USER_ID, 1) // default to Robinson Meza (PM)
  );

  const [currentProjectId, setCurrentProjectId] = useState<number | null>(() =>
    loadFromStorage(STORAGE_KEYS.CURRENT_PROJECT_ID, 1)
  );

  // Sync to localStorage
  useEffect(() => localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users)), [users]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects)), [projects]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members)), [members]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.COLUMNS, JSON.stringify(columns)), [columns]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks)), [tasks]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.SPRINTS, JSON.stringify(sprints)), [sprints]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.COMMENTS, JSON.stringify(comments)), [comments]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.ACTIVITY, JSON.stringify(activityLogs)), [activityLogs]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.ATTACHMENTS, JSON.stringify(attachments)), [attachments]);
  useEffect(() => {
    if (currentUserId !== null) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, JSON.stringify(currentUserId));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
    }
  }, [currentUserId]);
  useEffect(() => {
    if (currentProjectId !== null) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_PROJECT_ID, JSON.stringify(currentProjectId));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_PROJECT_ID);
    }
  }, [currentProjectId]);

  const currentUser = useMemo(() => {
    if (!currentUserId) return null;
    return users.find((u) => u.id === currentUserId) || null;
  }, [users, currentUserId]);

  // Accessible Projects:
  // - Project Manager (is_admin) & Product Owner (Docente, role: 'po') have global access to ALL projects
  // - Frontend & Backend developers see ONLY their assigned projects
  const accessibleProjects = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.is_admin || currentUser.role === 'admin' || currentUser.role === 'po') {
      return projects;
    }
    const assignedProjectIds = new Set(
      members.filter((m) => m.user_id === currentUser.id).map((m) => m.project_id)
    );
    return projects.filter((p) => assignedProjectIds.has(p.id));
  }, [currentUser, projects, members]);

  const currentProject = useMemo(() => {
    if (!currentProjectId) {
      return accessibleProjects[0] || null;
    }
    const found = projects.find((p) => p.id === currentProjectId);
    if (!found) return accessibleProjects[0] || null;
    // Check if user has access to it
    const isGlobal = currentUser?.is_admin || currentUser?.role === 'admin' || currentUser?.role === 'po';
    if (isGlobal) return found;
    const isMember = members.some((m) => m.project_id === found.id && m.user_id === currentUser?.id);
    return isMember ? found : accessibleProjects[0] || null;
  }, [projects, currentProjectId, accessibleProjects, currentUser, members]);

  // Current Role calculation
  const currentRole: Role = useMemo(() => {
    if (!currentUser) return 'frontend';
    if (currentUser.is_admin || currentUser.role === 'admin') return 'admin';
    if (currentUser.role === 'po') return 'po';
    if (!currentProjectId) return currentUser.role || 'frontend';
    const membership = members.find((m) => m.project_id === currentProjectId && m.user_id === currentUser.id);
    if (membership) return membership.role;
    return currentUser.role || 'frontend';
  }, [currentUser, currentProjectId, members]);

  const hasPerm = useCallback(
    (perm: Permission) => {
      if (!currentUser) return false;
      // Admin has everything
      if (currentUser.is_admin || currentUser.role === 'admin') return true;
      // Product Owner has all permissions except import_csv
      if (currentUser.role === 'po') {
        if (perm === 'import_csv') return false;
        return true;
      }
      return hasPermission(currentRole, perm);
    },
    [currentUser, currentRole]
  );

  const canEdit = useCallback(
    (task: Task) => {
      if (!currentUser) return false;
      if (currentUser.is_admin || currentUser.role === 'admin' || currentUser.role === 'po') {
        return true;
      }
      return canEditTask(currentRole, task, currentUser.id);
    },
    [currentRole, currentUser]
  );

  // Activity logger helper
  const logActivity = useCallback(
    (
      taskId: number,
      action: ActivityLog['action'],
      field?: string,
      oldVal?: string | null,
      newVal?: string | null
    ) => {
      if (!currentUser) return;
      const newLog: ActivityLog = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        task_id: taskId,
        user_id: currentUser.id,
        action,
        field_changed: field,
        old_value: oldVal || undefined,
        new_value: newVal || undefined,
        created_at: new Date().toISOString(),
      };
      setActivityLogs((prev) => [newLog, ...prev]);
    },
    [currentUser]
  );

  // Authentication
  const login = useCallback(
    (username: string, password?: string) => {
      const trimmed = username.trim().toLowerCase();
      const user = users.find((u) => u.username.toLowerCase() === trimmed);
      if (!user) {
        return { success: false, error: 'Usuario no encontrado' };
      }
      if (password && user.password && user.password !== password) {
        return { success: false, error: 'Contraseña incorrecta' };
      }
      setCurrentUserId(user.id);
      return { success: true };
    },
    [users]
  );

  const logout = useCallback(() => {
    setCurrentUserId(null);
  }, []);

  const switchUser = useCallback((userId: number) => {
    setCurrentUserId(userId);
  }, []);

  // Projects
  const selectProject = useCallback((projectId: number) => {
    setCurrentProjectId(projectId);
  }, []);

  const createProject = useCallback(
    (name: string, key: string, description: string) => {
      if (!currentUser?.is_admin && currentUser?.role !== 'admin' && currentUser?.role !== 'po') {
        return { success: false, error: 'Solo el Project Manager o Product Owner pueden crear proyectos' };
      }
      const cleanKey = key.trim().toUpperCase();
      const cleanName = name.trim();
      if (!cleanName || !cleanKey) {
        return { success: false, error: 'Nombre y clave son requeridos' };
      }
      if (projects.some((p) => p.key === cleanKey)) {
        return { success: false, error: `La clave '${cleanKey}' ya existe` };
      }

      const newProjId = Date.now();
      const newProj: Project = {
        id: newProjId,
        name: cleanName,
        key: cleanKey,
        description: description.trim(),
        created_at: new Date().toISOString(),
      };

      // Default 5 columns
      const defaultCols: BoardColumn[] = [
        { id: newProjId * 10 + 1, project_id: newProjId, name: 'Backlog', position: 0, color: '#DFE1E6', is_done_column: false },
        { id: newProjId * 10 + 2, project_id: newProjId, name: 'To Do', position: 1, color: '#C3CFE2', is_done_column: false },
        { id: newProjId * 10 + 3, project_id: newProjId, name: 'In Progress', position: 2, color: '#FFF3CD', is_done_column: false },
        { id: newProjId * 10 + 4, project_id: newProjId, name: 'In Review', position: 3, color: '#FFE0B2', is_done_column: false },
        { id: newProjId * 10 + 5, project_id: newProjId, name: 'Done', position: 4, color: '#D4EDDA', is_done_column: true },
      ];

      // Add creator as member
      const newMember: ProjectMember = {
        id: Date.now() + 1,
        project_id: newProjId,
        user_id: currentUser.id,
        role: currentUser.is_admin ? 'admin' : (currentUser.role || 'admin'),
        created_at: new Date().toISOString(),
      };

      setProjects((prev) => [newProj, ...prev]);
      setColumns((prev) => [...prev, ...defaultCols]);
      setMembers((prev) => [...prev, newMember]);
      setCurrentProjectId(newProjId);

      return { success: true };
    },
    [currentUser, projects]
  );

  const updateProject = useCallback(
    (id: number, name: string, description: string) => {
      if (!currentUser?.is_admin && currentUser?.role !== 'admin' && currentUser?.role !== 'po') {
        return { success: false, error: 'Solo el Project Manager o Product Owner pueden editar proyectos' };
      }
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name: name.trim(), description: description.trim() } : p))
      );
      return { success: true };
    },
    [currentUser]
  );

  const deleteProject = useCallback(
    (id: number) => {
      if (!currentUser?.is_admin && currentUser?.role !== 'admin') {
        return { success: false, error: 'Solo el Project Manager puede eliminar proyectos' };
      }
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setColumns((prev) => prev.filter((c) => c.project_id !== id));
      setTasks((prev) => prev.filter((t) => t.project_id !== id));
      setMembers((prev) => prev.filter((m) => m.project_id !== id));
      setSprints((prev) => prev.filter((s) => s.project_id !== id));
      if (currentProjectId === id) {
        const remaining = projects.filter((p) => p.id !== id);
        setCurrentProjectId(remaining.length > 0 ? remaining[0].id : null);
      }
      return { success: true };
    },
    [currentUser, currentProjectId, projects]
  );

  // Members Management
  const createMemberWithCredentials = useCallback(
    (data: { name: string; username: string; password?: string; role: Role; project_id: number; email?: string }) => {
      if (!currentUser?.is_admin && currentUser?.role !== 'admin' && currentUser?.role !== 'po') {
        return { success: false, error: 'Solo el Project Manager o Product Owner pueden crear nuevos miembros' };
      }
      const username = data.username.trim();
      const name = data.name.trim();
      if (!name || !username || !data.password) {
        return { success: false, error: 'Nombre, usuario y contraseña son requeridos' };
      }
      if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
        return { success: false, error: 'El nombre de usuario ya está registrado' };
      }

      const email =
        data.email?.trim() || `${username.toLowerCase().replace(/\s+/g, '.')}@institucion.edu`;
      if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
        return { success: false, error: 'El correo electrónico ya está en uso' };
      }

      const colors = ['#4A90D9', '#36B37E', '#FF5630', '#6554C0', '#00B8D9', '#FFAB00', '#EC4899', '#8B5CF6'];
      const avatarColor = colors[users.length % colors.length];

      const newUserId = Date.now();
      const newUser: User = {
        id: newUserId,
        name,
        username,
        email,
        avatar_color: avatarColor,
        is_admin: data.role === 'admin',
        role: data.role,
        password: data.password,
        created_at: new Date().toISOString(),
      };

      const newMember: ProjectMember = {
        id: Date.now() + 1,
        project_id: data.project_id,
        user_id: newUserId,
        role: data.role,
        created_at: new Date().toISOString(),
      };

      setUsers((prev) => [...prev, newUser]);
      setMembers((prev) => [...prev, newMember]);

      return { success: true };
    },
    [currentUser, users]
  );

  // Batch CSV Import Method - Exclusively for Project Manager (Admin)
  const importUsersBatch = useCallback(
    (importedUsers: ImportUserPayload[], defaultProjectId?: number) => {
      if (!currentUser?.is_admin && currentUser?.role !== 'admin') {
        return { success: false, count: 0, error: 'Solo desde el rol de Project Manager se puede acceder a la importación CSV' };
      }

      if (!importedUsers || importedUsers.length === 0) {
        return { success: false, count: 0, error: 'No se enviaron usuarios para importar' };
      }

      const colors = ['#4A90D9', '#36B37E', '#FF5630', '#6554C0', '#00B8D9', '#FFAB00', '#EC4899', '#8B5CF6', '#10B981', '#F59E0B'];
      const baseTime = Date.now();

      const newUsersList: User[] = [];
      const newMembersList: ProjectMember[] = [];
      const existingUsernames = new Set(users.map((u) => u.username.toLowerCase()));

      importedUsers.forEach((item, index) => {
        let cleanUsername = item.username.trim().toLowerCase().replace(/[^a-zA-Z0-9._-]/g, '');
        if (!cleanUsername) {
          cleanUsername = item.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
        }

        // Avoid collision if already used
        if (existingUsernames.has(cleanUsername)) {
          cleanUsername = `${cleanUsername}_${index + 1}`;
        }
        existingUsernames.add(cleanUsername);

        const newId = baseTime + index;
        const color = colors[(users.length + index) % colors.length];

        const newUser: User = {
          id: newId,
          name: item.name.trim(),
          username: cleanUsername,
          email: item.email?.trim() || `${cleanUsername}@institucion.edu`,
          avatar_color: color,
          is_admin: item.role === 'admin',
          role: item.role,
          password: item.password?.trim() || 'Clave123.',
          created_at: new Date().toISOString(),
        };

        newUsersList.push(newUser);

        // Assign to project
        const targetProjId = item.projectId || defaultProjectId || projects[0]?.id;
        if (targetProjId) {
          newMembersList.push({
            id: baseTime + 10000 + index,
            project_id: targetProjId,
            user_id: newId,
            role: item.role,
            created_at: new Date().toISOString(),
          });
        }
      });

      setUsers((prev) => [...prev, ...newUsersList]);
      setMembers((prev) => [...prev, ...newMembersList]);

      return { success: true, count: newUsersList.length };
    },
    [currentUser, users, projects]
  );

  const addMemberToProject = useCallback(
    (projectId: number, userId: number, role: Role) => {
      if (!hasPerm('manage_members')) {
        return { success: false, error: 'No tienes permiso para gestionar miembros' };
      }
      if (members.some((m) => m.project_id === projectId && m.user_id === userId)) {
        return { success: false, error: 'El usuario ya es miembro de este proyecto' };
      }
      const newMember: ProjectMember = {
        id: Date.now(),
        project_id: projectId,
        user_id: userId,
        role,
        created_at: new Date().toISOString(),
      };
      setMembers((prev) => [...prev, newMember]);
      return { success: true };
    },
    [hasPerm, members]
  );

  const updateMemberRole = useCallback(
    (memberId: number, role: Role) => {
      if (!hasPerm('manage_members')) return;
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role } : m)));
    },
    [hasPerm]
  );

  const removeMemberFromProject = useCallback(
    (memberId: number) => {
      if (!hasPerm('manage_members')) return;
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    },
    [hasPerm]
  );

  // User Management & Editing - Exclusively for Project Manager (Admin)
  const updateUser = useCallback(
    (
      userId: number,
      data: {
        name?: string;
        username?: string;
        password?: string;
        email?: string;
        role?: Role;
        avatar_color?: string;
      },
      projectIds?: number[]
    ) => {
      const isPM = currentUser?.is_admin || currentUser?.role === 'admin';
      if (!isPM) {
        return { success: false, error: 'Solo el Project Manager (Admin) tiene permisos para editar usuarios' };
      }

      const targetUser = users.find((u) => u.id === userId);
      if (!targetUser) {
        return { success: false, error: 'Usuario no encontrado' };
      }

      // Check username collision
      if (data.username) {
        const cleanUsername = data.username.trim().toLowerCase();
        if (users.some((u) => u.id !== userId && u.username.toLowerCase() === cleanUsername)) {
          return { success: false, error: 'El nombre de usuario ya está en uso por otra persona' };
        }
      }

      // Check email collision
      if (data.email) {
        const cleanEmail = data.email.trim().toLowerCase();
        if (users.some((u) => u.id !== userId && u.email.toLowerCase() === cleanEmail)) {
          return { success: false, error: 'El correo electrónico ya está en uso por otra persona' };
        }
      }

      const newRole = data.role !== undefined ? data.role : targetUser.role || 'frontend';
      const isAdmin = newRole === 'admin';

      setUsers((prev) =>
        prev.map((u) => {
          if (u.id !== userId) return u;
          return {
            ...u,
            name: data.name !== undefined ? data.name.trim() : u.name,
            username: data.username !== undefined ? data.username.trim().toLowerCase() : u.username,
            password: data.password !== undefined ? data.password : u.password,
            email: data.email !== undefined ? data.email.trim() : u.email,
            role: newRole,
            is_admin: isAdmin,
            avatar_color: data.avatar_color !== undefined ? data.avatar_color : u.avatar_color,
          };
        })
      );

      // Synchronize memberships and project assignments
      setMembers((prev) => {
        let updated = prev.map((m) => {
          if (m.user_id !== userId) return m;
          return { ...m, role: newRole };
        });

        if (projectIds) {
          // Remove memberships from projects not in projectIds
          updated = updated.filter((m) => m.user_id !== userId || projectIds.includes(m.project_id));

          // Add to newly selected projects
          const currentProjectIds = new Set(updated.filter((m) => m.user_id === userId).map((m) => m.project_id));
          projectIds.forEach((pId) => {
            if (!currentProjectIds.has(pId)) {
              updated.push({
                id: Date.now() + Math.floor(Math.random() * 10000),
                project_id: pId,
                user_id: userId,
                role: newRole,
                created_at: new Date().toISOString(),
              });
            }
          });
        }

        return updated;
      });

      return { success: true };
    },
    [currentUser, users]
  );

  const deleteUser = useCallback(
    (userId: number) => {
      const isPM = currentUser?.is_admin || currentUser?.role === 'admin';
      if (!isPM) {
        return { success: false, error: 'Solo el Project Manager (Admin) tiene permisos para eliminar usuarios' };
      }

      const adminCount = users.filter((u) => u.is_admin || u.role === 'admin').length;
      const targetUser = users.find((u) => u.id === userId);
      if (targetUser && (targetUser.is_admin || targetUser.role === 'admin') && adminCount <= 1) {
        return { success: false, error: 'No se puede eliminar el único administrador del sistema' };
      }

      if (currentUser?.id === userId) {
        const nextUser = users.find((u) => u.id !== userId);
        if (nextUser) {
          setCurrentUserId(nextUser.id);
        }
      }

      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      setTasks((prev) =>
        prev.map((t) => ({
          ...t,
          assignee_id: t.assignee_id === userId ? null : t.assignee_id,
        }))
      );

      return { success: true };
    },
    [currentUser, users]
  );

  // Column management
  const addColumn = useCallback(
    (name: string, color: string = '#DFE1E6', isDone: boolean = false) => {
      if (!hasPerm('manage_columns') || !currentProjectId) return;
      const cleanName = name.trim();
      if (!cleanName) return;
      const projCols = columns.filter((c) => c.project_id === currentProjectId);
      const maxPos = projCols.length ? Math.max(...projCols.map((c) => c.position)) : 0;
      const newCol: BoardColumn = {
        id: Date.now(),
        project_id: currentProjectId,
        name: cleanName,
        position: maxPos + 1,
        color,
        is_done_column: isDone,
      };
      setColumns((prev) => [...prev, newCol]);
    },
    [hasPerm, currentProjectId, columns]
  );

  const updateColumn = useCallback(
    (id: number, updates: Partial<BoardColumn>) => {
      if (!hasPerm('manage_columns')) return;
      setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    },
    [hasPerm]
  );

  const deleteColumn = useCallback(
    (id: number) => {
      if (!hasPerm('manage_columns')) return;
      const targetCol = columns.find((c) => c.id === id);
      if (!targetCol) return;
      const fallback = columns.find((c) => c.project_id === targetCol.project_id && c.id !== id);

      // Reassign tasks to fallback or backlog
      setTasks((prev) =>
        prev.map((t) => {
          if (t.column_id === id) {
            return {
              ...t,
              column_id: fallback ? fallback.id : null,
              status: fallback ? fallback.name : 'backlog',
            };
          }
          return t;
        })
      );
      setColumns((prev) => prev.filter((c) => c.id !== id));
    },
    [hasPerm, columns]
  );

  // Tasks Management
  const createTask = useCallback(
    (data: Partial<Task>) => {
      if (!hasPerm('manage_tasks') || !currentProject) {
        return { success: false, error: 'No tienes permiso para crear tareas' };
      }
      if (!data.title?.trim()) {
        return { success: false, error: 'El título es requerido' };
      }

      const newId = Date.now();
      const projTasks = tasks.filter((t) => t.project_id === currentProject.id);
      const taskKey = `${currentProject.key}-${projTasks.length + 1}`;

      const newTask: Task = {
        id: newId,
        project_id: currentProject.id,
        column_id: data.column_id ?? null,
        sprint_id: data.sprint_id ?? null,
        title: data.title.trim(),
        description: data.description?.trim() || '',
        task_type: data.task_type || 'task',
        priority: data.priority || 'medium',
        status: data.status || 'Backlog',
        story_points: data.story_points ?? null,
        assignee_id: data.assignee_id ?? null,
        reporter_id: currentUser?.id ?? null,
        due_date: data.due_date || null,
        position: projTasks.length,
        labels: data.labels || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        task_key: taskKey,
      };

      setTasks((prev) => [...prev, newTask]);
      logActivity(newId, 'created');

      return { success: true, task: newTask };
    },
    [hasPerm, currentProject, tasks, currentUser, logActivity]
  );

  const updateTask = useCallback(
    (id: number, data: Partial<Task>) => {
      const existing = tasks.find((t) => t.id === id);
      if (!existing) return { success: false, error: 'Tarea no encontrada' };
      if (!canEdit(existing)) {
        return { success: false, error: 'No tienes permiso para editar esta tarea' };
      }

      // Log changes
      Object.keys(data).forEach((key) => {
        const k = key as keyof Task;
        if (k !== 'updated_at' && k !== 'attachments' && k !== 'labels') {
          const oldVal = existing[k];
          const newVal = data[k];
          if (oldVal !== undefined && newVal !== undefined && String(oldVal) !== String(newVal)) {
            logActivity(id, 'edited', k, String(oldVal), String(newVal));
          }
        }
      });

      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                ...data,
                updated_at: new Date().toISOString(),
              }
            : t
        )
      );

      return { success: true };
    },
    [tasks, canEdit, logActivity]
  );

  const deleteTask = useCallback(
    (id: number) => {
      if (!hasPerm('delete_any')) {
        return { success: false, error: 'No tienes permiso para eliminar tareas' };
      }
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setComments((prev) => prev.filter((c) => c.task_id !== id));
      setActivityLogs((prev) => prev.filter((a) => a.task_id !== id));
      setAttachments((prev) => prev.filter((a) => a.task_id !== id));
      return { success: true };
    },
    [hasPerm]
  );

  const moveTask = useCallback(
    (taskId: number, newColumnId: number | null, newPosition?: number) => {
      if (!hasPerm('move_tasks')) return;
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;

      const newCol = newColumnId ? columns.find((c) => c.id === newColumnId) : null;
      const newStatus = newCol ? newCol.name : 'Backlog';

      if (target.column_id !== newColumnId || target.status !== newStatus) {
        logActivity(taskId, 'moved', 'status', target.status, newStatus);
      }

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                column_id: newColumnId,
                status: newStatus,
                position: newPosition ?? t.position,
                updated_at: new Date().toISOString(),
              }
            : t
        )
      );
    },
    [hasPerm, tasks, columns, logActivity]
  );

  // Sprints
  const createSprint = useCallback(
    (name: string, goal: string, startDate?: string, endDate?: string) => {
      if (!hasPerm('manage_sprints') || !currentProjectId) throw new Error('No autorizado');
      const newSprint: Sprint = {
        id: Date.now(),
        project_id: currentProjectId,
        name: name.trim() || `Sprint ${sprints.length + 1}`,
        goal: goal.trim(),
        start_date: startDate || null,
        end_date: endDate || null,
        status: 'planned',
        created_at: new Date().toISOString(),
      };
      setSprints((prev) => [newSprint, ...prev]);
      return newSprint;
    },
    [hasPerm, currentProjectId, sprints]
  );

  const updateSprint = useCallback(
    (id: number, updates: Partial<Sprint>) => {
      if (!hasPerm('manage_sprints')) return;
      setSprints((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    },
    [hasPerm]
  );

  const startSprint = useCallback(
    (sprintId: number) => {
      if (!hasPerm('manage_sprints') || !currentProjectId) return;
      const today = new Date().toISOString().split('T')[0];

      // Mark other active sprints in this project as completed
      setSprints((prev) =>
        prev.map((s) => {
          if (s.project_id === currentProjectId) {
            if (s.id === sprintId) {
              return { ...s, status: 'active', start_date: s.start_date || today };
            }
            if (s.status === 'active') {
              return { ...s, status: 'completed', end_date: s.end_date || today };
            }
          }
          return s;
        })
      );

      // Move backlog tasks to this sprint
      const firstCol =
        columns.find((c) => c.project_id === currentProjectId && c.name.toLowerCase().includes('to do')) ||
        columns.find((c) => c.project_id === currentProjectId && !c.is_done_column);

      setTasks((prev) =>
        prev.map((t) => {
          if (t.project_id === currentProjectId && !t.sprint_id) {
            return {
              ...t,
              sprint_id: sprintId,
              column_id: firstCol ? firstCol.id : t.column_id,
              status: firstCol ? firstCol.name : t.status,
            };
          }
          return t;
        })
      );
    },
    [hasPerm, currentProjectId, columns]
  );

  const completeSprint = useCallback(
    (sprintId: number) => {
      if (!hasPerm('manage_sprints') || !currentProjectId) return;
      const today = new Date().toISOString().split('T')[0];

      setSprints((prev) =>
        prev.map((s) => (s.id === sprintId ? { ...s, status: 'completed', end_date: s.end_date || today } : s))
      );

      // Incomplete tasks move back to backlog
      const doneCol = columns.find((c) => c.project_id === currentProjectId && c.is_done_column);
      const backlogCol = columns.find((c) => c.project_id === currentProjectId && c.name.toLowerCase() === 'backlog');

      setTasks((prev) =>
        prev.map((t) => {
          if (t.sprint_id === sprintId) {
            const isCompleted = doneCol && t.column_id === doneCol.id;
            if (!isCompleted) {
              return {
                ...t,
                sprint_id: null,
                column_id: backlogCol ? backlogCol.id : null,
                status: backlogCol ? backlogCol.name : 'Backlog',
              };
            }
          }
          return t;
        })
      );
    },
    [hasPerm, currentProjectId, columns]
  );

  // Comments
  const addComment = useCallback(
    (taskId: number, content: string) => {
      if (!currentUser || !content.trim()) return;
      const newComment: TaskComment = {
        id: Date.now(),
        task_id: taskId,
        user_id: currentUser.id,
        content: content.trim(),
        created_at: new Date().toISOString(),
      };
      setComments((prev) => [newComment, ...prev]);
      logActivity(taskId, 'commented', undefined, undefined, content.trim().slice(0, 100));
    },
    [currentUser, logActivity]
  );

  const deleteComment = useCallback((commentId: number) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }, []);

  // Attachments
  const uploadAttachment = useCallback(
    async (taskId: number, file: File) => {
      if (!hasPerm('attach') || !currentUser) {
        return { success: false, error: 'No tienes permiso para adjuntar archivos' };
      }

      return new Promise<{ success: boolean; error?: string }>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const newAttachment: TaskAttachment = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            task_id: taskId,
            filename: file.name,
            stored_name: `${Date.now()}_${file.name}`,
            data_url: dataUrl,
            content_type: file.type,
            size: file.size,
            uploaded_by: currentUser.id,
            created_at: new Date().toISOString(),
          };

          setAttachments((prev) => [newAttachment, ...prev]);
          logActivity(taskId, 'attached', 'adjunto', undefined, file.name);
          resolve({ success: true });
        };
        reader.onerror = () => {
          resolve({ success: false, error: 'Error al leer el archivo' });
        };
        reader.readAsDataURL(file);
      });
    },
    [hasPerm, currentUser, logActivity]
  );

  const deleteAttachment = useCallback(
    (attachmentId: number) => {
      const att = attachments.find((a) => a.id === attachmentId);
      if (!att) return;
      if (!hasPerm('delete_any')) return;

      logActivity(att.task_id, 'deleted', 'adjunto', att.filename, undefined);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    },
    [attachments, hasPerm, logActivity]
  );

  // Reset to initial seed
  const resetToDemoData = useCallback(() => {
    setUsers(INITIAL_USERS);
    setProjects(INITIAL_PROJECTS);
    setMembers(INITIAL_MEMBERS);
    setColumns(INITIAL_COLUMNS);
    setTasks(INITIAL_TASKS);
    setSprints(INITIAL_SPRINTS);
    setComments(INITIAL_COMMENTS);
    setActivityLogs(INITIAL_ACTIVITY);
    setAttachments([]);
    setCurrentUserId(1);
    setCurrentProjectId(1);
    localStorage.clear();
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      currentProject,
      users,
      projects,
      accessibleProjects,
      members,
      columns,
      tasks,
      sprints,
      comments,
      activityLogs,
      attachments,
      currentRole,
      hasPerm,
      canEdit,
      login,
      logout,
      switchUser,
      selectProject,
      createProject,
      updateProject,
      deleteProject,
      createMemberWithCredentials,
      addMemberToProject,
      updateMemberRole,
      removeMemberFromProject,
      updateUser,
      deleteUser,
      importUsersBatch,
      addColumn,
      updateColumn,
      deleteColumn,
      createTask,
      updateTask,
      deleteTask,
      moveTask,
      createSprint,
      updateSprint,
      startSprint,
      completeSprint,
      addComment,
      deleteComment,
      uploadAttachment,
      deleteAttachment,
      resetToDemoData,
    }),
    [
      currentUser,
      currentProject,
      users,
      projects,
      accessibleProjects,
      members,
      columns,
      tasks,
      sprints,
      comments,
      activityLogs,
      attachments,
      currentRole,
      hasPerm,
      canEdit,
      login,
      logout,
      switchUser,
      selectProject,
      createProject,
      updateProject,
      deleteProject,
      createMemberWithCredentials,
      addMemberToProject,
      updateMemberRole,
      removeMemberFromProject,
      updateUser,
      deleteUser,
      importUsersBatch,
      addColumn,
      updateColumn,
      deleteColumn,
      createTask,
      updateTask,
      deleteTask,
      moveTask,
      createSprint,
      updateSprint,
      startSprint,
      completeSprint,
      addComment,
      deleteComment,
      uploadAttachment,
      deleteAttachment,
      resetToDemoData,
    ]
  );

  return <JiraContext.Provider value={value}>{children}</JiraContext.Provider>;
};

export const useJira = () => {
  const context = useContext(JiraContext);
  if (!context) {
    throw new Error('useJira debe ser utilizado dentro de un JiraProvider');
  }
  return context;
};
