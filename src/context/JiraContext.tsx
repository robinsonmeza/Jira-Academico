import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  getTaskAssigneeIds,
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
import { db } from '../lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

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
  isCloudConnected: boolean;
  isSyncing: boolean;
  // Auth
  login: (username: string, password?: string) => { success: boolean; error?: string };
  registerUser: (data: {
    name: string;
    username: string;
    password?: string;
    email?: string;
    role: Role;
    projectId?: number;
  }) => { success: boolean; error?: string };
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
    loadFromStorage(STORAGE_KEYS.CURRENT_USER_ID, null)
  );

  const [currentProjectId, setCurrentProjectId] = useState<number | null>(() =>
    loadFromStorage(STORAGE_KEYS.CURRENT_PROJECT_ID, 1)
  );

  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const isRemoteUpdate = useRef<boolean>(false);
  const isInitialized = useRef<boolean>(false);

  // Real-time Firestore Synchronizer (Colaboración Multi-usuario en tiempo real)
  useEffect(() => {
    const appDocRef = doc(db, 'app_state', 'main');

    const unsubscribe = onSnapshot(
      appDocRef,
      (snapshot) => {
        setIsCloudConnected(true);
        if (snapshot.exists()) {
          const data = snapshot.data();
          isRemoteUpdate.current = true;

          if (Array.isArray(data.users)) setUsers(data.users);
          if (Array.isArray(data.projects)) setProjects(data.projects);
          if (Array.isArray(data.members)) setMembers(data.members);
          if (Array.isArray(data.columns)) setColumns(data.columns);
          if (Array.isArray(data.tasks)) setTasks(data.tasks);
          if (Array.isArray(data.sprints)) setSprints(data.sprints);
          if (Array.isArray(data.comments)) setComments(data.comments);
          if (Array.isArray(data.activityLogs)) setActivityLogs(data.activityLogs);
          if (Array.isArray(data.attachments)) setAttachments(data.attachments);

          setTimeout(() => {
            isRemoteUpdate.current = false;
            isInitialized.current = true;
          }, 100);
        } else {
          // Initialize Firebase database with initial state
          const initialPayload = {
            id: 'main',
            users: INITIAL_USERS,
            projects: INITIAL_PROJECTS,
            members: INITIAL_MEMBERS,
            columns: INITIAL_COLUMNS,
            tasks: INITIAL_TASKS,
            sprints: INITIAL_SPRINTS,
            comments: INITIAL_COMMENTS,
            activityLogs: INITIAL_ACTIVITY,
            attachments: [],
            updatedAt: new Date().toISOString(),
            updatedBy: 'system',
          };
          setDoc(appDocRef, initialPayload)
            .then(() => {
              isInitialized.current = true;
            })
            .catch((err) => {
              console.error('Error seeding initial Firestore state:', err);
            });
        }
      },
      (error) => {
        console.warn('Firestore connection notice:', error.message);
        setIsCloudConnected(false);
        isInitialized.current = true;
      }
    );

    return () => unsubscribe();
  }, []);

  // Push local state mutations to Cloud Firestore & LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
    localStorage.setItem(STORAGE_KEYS.COLUMNS, JSON.stringify(columns));
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    localStorage.setItem(STORAGE_KEYS.SPRINTS, JSON.stringify(sprints));
    localStorage.setItem(STORAGE_KEYS.COMMENTS, JSON.stringify(comments));
    localStorage.setItem(STORAGE_KEYS.ACTIVITY, JSON.stringify(activityLogs));
    localStorage.setItem(STORAGE_KEYS.ATTACHMENTS, JSON.stringify(attachments));

    if (isRemoteUpdate.current || !isInitialized.current) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSyncing(true);
        const appDocRef = doc(db, 'app_state', 'main');
        await setDoc(appDocRef, {
          id: 'main',
          users,
          projects,
          members,
          columns,
          tasks,
          sprints,
          comments,
          activityLogs,
          attachments,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUserId ? `user_${currentUserId}` : 'unknown',
        });
      } catch (err) {
        console.error('Error saving state to Firestore:', err);
      } finally {
        setIsSyncing(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [users, projects, members, columns, tasks, sprints, comments, activityLogs, attachments, currentUserId]);

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
    [currentUser, currentRole]
  );

  // Helper: Log activity
  const logActivity = useCallback(
    (
      taskId: number,
      action: ActivityLog['action'],
      fieldChanged?: string,
      oldVal?: string,
      newVal?: string
    ) => {
      if (!currentUser) return;
      const newLog: ActivityLog = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        task_id: taskId,
        user_id: currentUser.id,
        action,
        field_changed: fieldChanged,
        old_value: oldVal,
        new_value: newVal,
        created_at: new Date().toISOString(),
        user: currentUser,
      };
      setActivityLogs((prev) => [newLog, ...prev]);
    },
    [currentUser]
  );

  // Auth operations
  const login = useCallback(
    (username: string, password?: string) => {
      const u = users.find(
        (x) => x.username.toLowerCase() === username.trim().toLowerCase()
      );
      if (!u) {
        return { success: false, error: 'Usuario no encontrado' };
      }
      if (password && u.password && u.password !== password) {
        return { success: false, error: 'Contraseña incorrecta' };
      }
      setCurrentUserId(u.id);
      return { success: true };
    },
    [users]
  );

  const registerUser = useCallback(
    (data: {
      name: string;
      username: string;
      password?: string;
      email?: string;
      role: Role;
      projectId?: number;
    }) => {
      const trimmedUsername = data.username.trim().toLowerCase();
      if (!trimmedUsername) {
        return { success: false, error: 'El nombre de usuario es obligatorio' };
      }
      if (!data.name.trim()) {
        return { success: false, error: 'El nombre completo es obligatorio' };
      }
      if (!data.password || data.password.length < 4) {
        return { success: false, error: 'La contraseña debe tener al menos 4 caracteres' };
      }

      const existing = users.find((u) => u.username.toLowerCase() === trimmedUsername);
      if (existing) {
        return { success: false, error: 'El nombre de usuario ya está registrado' };
      }

      const colors = ['#4A90D9', '#36B37E', '#FF5630', '#6554C0', '#00B8D9', '#FFAB00', '#EC4899', '#8B5CF6', '#10B981', '#F97316'];
      const avatarColor = colors[Math.floor(Math.random() * colors.length)];
      const newUserId = Date.now();

      const newUser: User = {
        id: newUserId,
        name: data.name.trim(),
        username: trimmedUsername,
        email: data.email?.trim() || `${trimmedUsername}@example.com`,
        avatar_color: avatarColor,
        is_admin: data.role === 'admin',
        role: data.role,
        password: data.password,
        created_at: new Date().toISOString(),
      };

      setUsers((prev) => [...prev, newUser]);

      // If user specified a project or there is at least one accessible project
      const targetProjectId = data.projectId || (projects[0]?.id);
      if (targetProjectId) {
        const newMember: ProjectMember = {
          id: Date.now() + 1,
          project_id: targetProjectId,
          user_id: newUserId,
          role: data.role,
          created_at: new Date().toISOString(),
        };
        setMembers((prev) => [...prev, newMember]);
        setCurrentProjectId(targetProjectId);
      }

      setCurrentUserId(newUserId);
      return { success: true };
    },
    [users, projects]
  );

  const logout = useCallback(() => {
    setCurrentUserId(null);
  }, []);

  const switchUser = useCallback((userId: number) => {
    setCurrentUserId(userId);
  }, []);

  // Project operations
  const selectProject = useCallback((projectId: number) => {
    setCurrentProjectId(projectId);
  }, []);

  const createProject = useCallback(
    (name: string, key: string, description: string) => {
      if (!hasPerm('manage_project')) {
        return { success: false, error: 'No tienes permisos para crear proyectos' };
      }
      const trimmedKey = key.trim().toUpperCase();
      if (!trimmedKey || trimmedKey.length < 2 || trimmedKey.length > 6) {
        return { success: false, error: 'La clave debe tener entre 2 y 6 caracteres' };
      }
      if (projects.some((p) => p.key === trimmedKey)) {
        return { success: false, error: 'Ya existe un proyecto con esa clave (Key)' };
      }

      const newProjectId = Date.now();
      const newProj: Project = {
        id: newProjectId,
        name: name.trim(),
        key: trimmedKey,
        description: description.trim(),
        created_at: new Date().toISOString(),
      };

      // Default columns
      const defaultCols: BoardColumn[] = [
        { id: Date.now() + 1, project_id: newProjectId, name: 'Backlog', position: 0, color: '#DFE1E6', is_done_column: false },
        { id: Date.now() + 2, project_id: newProjectId, name: 'To Do', position: 1, color: '#C3CFE2', is_done_column: false },
        { id: Date.now() + 3, project_id: newProjectId, name: 'In Progress', position: 2, color: '#FFF3CD', is_done_column: false },
        { id: Date.now() + 4, project_id: newProjectId, name: 'In Review', position: 3, color: '#FFE0B2', is_done_column: false },
        { id: Date.now() + 5, project_id: newProjectId, name: 'Done', position: 4, color: '#D4EDDA', is_done_column: true },
      ];

      // Add creator as member if user exists
      const newMembers: ProjectMember[] = [];
      if (currentUser) {
        newMembers.push({
          id: Date.now() + 10,
          project_id: newProjectId,
          user_id: currentUser.id,
          role: currentUser.is_admin ? 'admin' : (currentUser.role || 'po'),
          created_at: new Date().toISOString(),
        });
      }

      setProjects((prev) => [...prev, newProj]);
      setColumns((prev) => [...prev, ...defaultCols]);
      if (newMembers.length > 0) {
        setMembers((prev) => [...prev, ...newMembers]);
      }
      setCurrentProjectId(newProjectId);

      return { success: true };
    },
    [hasPerm, projects, currentUser]
  );

  const updateProject = useCallback(
    (id: number, name: string, description: string) => {
      if (!hasPerm('manage_project')) {
        return { success: false, error: 'No tienes permisos para editar proyectos' };
      }
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name: name.trim(), description: description.trim() } : p))
      );
      return { success: true };
    },
    [hasPerm]
  );

  const deleteProject = useCallback(
    (id: number) => {
      if (!hasPerm('manage_project')) {
        return { success: false, error: 'No tienes permisos para eliminar proyectos' };
      }
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setColumns((prev) => prev.filter((c) => c.project_id !== id));
      setTasks((prev) => prev.filter((t) => t.project_id !== id));
      setSprints((prev) => prev.filter((s) => s.project_id !== id));
      setMembers((prev) => prev.filter((m) => m.project_id !== id));

      if (currentProjectId === id) {
        const remaining = projects.filter((p) => p.id !== id);
        setCurrentProjectId(remaining[0]?.id || null);
      }
      return { success: true };
    },
    [hasPerm, currentProjectId, projects]
  );

  // Member operations
  const createMemberWithCredentials = useCallback(
    (data: {
      name: string;
      username: string;
      password?: string;
      role: Role;
      project_id: number;
      email?: string;
    }) => {
      if (!hasPerm('manage_members')) {
        return { success: false, error: 'No tienes permisos para agregar miembros' };
      }

      const existingUser = users.find(
        (u) => u.username.toLowerCase() === data.username.trim().toLowerCase()
      );
      let userId: number;

      if (existingUser) {
        userId = existingUser.id;
      } else {
        userId = Date.now();
        const colors = ['#4A90D9', '#36B37E', '#FF5630', '#6554C0', '#00B8D9', '#FFAB00', '#EC4899'];
        const avatarColor = colors[Math.floor(Math.random() * colors.length)];
        const newUser: User = {
          id: userId,
          name: data.name.trim(),
          username: data.username.trim().toLowerCase(),
          email: data.email?.trim() || `${data.username.trim().toLowerCase()}@example.com`,
          avatar_color: avatarColor,
          is_admin: data.role === 'admin',
          role: data.role,
          password: data.password || '123456',
          created_at: new Date().toISOString(),
        };
        setUsers((prev) => [...prev, newUser]);
      }

      // Check if already member
      const isAlreadyMember = members.some(
        (m) => m.project_id === data.project_id && m.user_id === userId
      );
      if (isAlreadyMember) {
        return { success: false, error: 'El usuario ya es miembro de este proyecto' };
      }

      const newMember: ProjectMember = {
        id: Date.now() + 1,
        project_id: data.project_id,
        user_id: userId,
        role: data.role,
        created_at: new Date().toISOString(),
      };

      setMembers((prev) => [...prev, newMember]);
      return { success: true };
    },
    [hasPerm, users, members]
  );

  const addMemberToProject = useCallback(
    (projectId: number, userId: number, role: Role) => {
      if (!hasPerm('manage_members')) {
        return { success: false, error: 'No tienes permisos para agregar miembros' };
      }
      const isAlready = members.some((m) => m.project_id === projectId && m.user_id === userId);
      if (isAlready) {
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

  // User Management (Admin / Project Manager)
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
      if (!currentUser?.is_admin && currentUser?.role !== 'admin') {
        return { success: false, error: 'Solo el Project Manager (Admin) puede editar usuarios' };
      }

      const targetUser = users.find((u) => u.id === userId);
      if (!targetUser) {
        return { success: false, error: 'Usuario no encontrado' };
      }

      if (data.username && data.username.trim().toLowerCase() !== targetUser.username.toLowerCase()) {
        const isTaken = users.some(
          (u) => u.id !== userId && u.username.toLowerCase() === data.username?.trim().toLowerCase()
        );
        if (isTaken) {
          return { success: false, error: 'El nombre de usuario ya está en uso' };
        }
      }

      setUsers((prev) =>
        prev.map((u) => {
          if (u.id !== userId) return u;
          const updatedRole = data.role !== undefined ? data.role : u.role || (u.is_admin ? 'admin' : 'frontend');
          const updatedIsAdmin = updatedRole === 'admin';
          return {
            ...u,
            name: data.name !== undefined ? data.name : u.name,
            username: data.username !== undefined ? data.username.toLowerCase() : u.username,
            password: data.password !== undefined ? data.password : u.password,
            email: data.email !== undefined ? data.email : u.email,
            role: updatedRole,
            is_admin: updatedIsAdmin,
            avatar_color: data.avatar_color !== undefined ? data.avatar_color : u.avatar_color,
          };
        })
      );

      if (projectIds !== undefined) {
        const assignedRole: Role = data.role || targetUser.role || (targetUser.is_admin ? 'admin' : 'frontend');
        setMembers((prev) => {
          const filtered = prev.filter((m) => m.user_id !== userId);
          const newEntries: ProjectMember[] = projectIds.map((pId, idx) => ({
            id: Date.now() + idx + Math.floor(Math.random() * 1000),
            project_id: pId,
            user_id: userId,
            role: assignedRole,
            created_at: new Date().toISOString(),
          }));
          return [...filtered, ...newEntries];
        });
      } else if (data.role !== undefined) {
        setMembers((prev) =>
          prev.map((m) => (m.user_id === userId ? { ...m, role: data.role as Role } : m))
        );
      }

      return { success: true };
    },
    [currentUser, users]
  );

  const deleteUser = useCallback(
    (userId: number) => {
      if (!currentUser?.is_admin && currentUser?.role !== 'admin') {
        return { success: false, error: 'Solo el Project Manager (Admin) puede eliminar usuarios' };
      }

      const adminCount = users.filter((u) => u.is_admin || u.role === 'admin').length;
      const targetUser = users.find((u) => u.id === userId);
      if ((targetUser?.is_admin || targetUser?.role === 'admin') && adminCount <= 1) {
        return { success: false, error: 'No es posible eliminar al único Project Manager activo del sistema' };
      }

      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      setTasks((prev) =>
        prev.map((t) => {
          const currentIds = getTaskAssigneeIds(t);
          const newIds = currentIds.filter((uid) => uid !== userId);
          return {
            ...t,
            assignee_id: newIds[0] ?? null,
            assignee_ids: newIds,
          };
        })
      );

      if (currentUserId === userId) {
        const remainingAdmin = users.find((u) => u.id !== userId && (u.is_admin || u.role === 'admin'));
        if (remainingAdmin) {
          setCurrentUserId(remainingAdmin.id);
        } else {
          const firstRemaining = users.find((u) => u.id !== userId);
          setCurrentUserId(firstRemaining ? firstRemaining.id : null);
        }
      }

      return { success: true };
    },
    [currentUser, users, currentUserId]
  );

  // Batch CSV Import
  const importUsersBatch = useCallback(
    (importedUsers: ImportUserPayload[], defaultProjectId?: number) => {
      if (!hasPerm('import_csv')) {
        return { success: false, count: 0, error: 'No tienes permisos para importar usuarios por CSV' };
      }

      if (!importedUsers || importedUsers.length === 0) {
        return { success: false, count: 0, error: 'La lista de usuarios está vacía' };
      }

      const colors = ['#4A90D9', '#36B37E', '#FF5630', '#6554C0', '#00B8D9', '#FFAB00', '#EC4899', '#8B5CF6', '#10B981', '#F97316'];
      const newUsersToAdd: User[] = [];
      const newMembersToAdd: ProjectMember[] = [];

      let currentMaxId = users.reduce((max, u) => Math.max(max, u.id), 0);
      let memberMaxId = members.reduce((max, m) => Math.max(max, m.id), 0);

      const existingUsernames = new Map<string, User>();
      users.forEach((u) => existingUsernames.set(u.username.toLowerCase(), u));

      for (const item of importedUsers) {
        const normalizedUsername = item.username.trim().toLowerCase();
        let targetUser = existingUsernames.get(normalizedUsername);

        if (!targetUser) {
          currentMaxId += 1;
          const avatarColor = colors[Math.floor(Math.random() * colors.length)];
          const createdUser: User = {
            id: currentMaxId,
            name: item.name.trim(),
            username: normalizedUsername,
            email: item.email?.trim() || `${normalizedUsername}@example.com`,
            avatar_color: avatarColor,
            is_admin: item.role === 'admin',
            role: item.role,
            password: item.password?.trim() || '123456',
            created_at: new Date().toISOString(),
          };
          newUsersToAdd.push(createdUser);
          existingUsernames.set(normalizedUsername, createdUser);
          targetUser = createdUser;
        }

        const projId = item.projectId || defaultProjectId;
        if (projId && targetUser) {
          const alreadyMember =
            members.some((m) => m.project_id === projId && m.user_id === targetUser?.id) ||
            newMembersToAdd.some((m) => m.project_id === projId && m.user_id === targetUser?.id);

          if (!alreadyMember) {
            memberMaxId += 1;
            newMembersToAdd.push({
              id: memberMaxId,
              project_id: projId,
              user_id: targetUser.id,
              role: item.role,
              created_at: new Date().toISOString(),
            });
          }
        }
      }

      if (newUsersToAdd.length > 0) {
        setUsers((prev) => [...prev, ...newUsersToAdd]);
      }
      if (newMembersToAdd.length > 0) {
        setMembers((prev) => [...prev, ...newMembersToAdd]);
      }

      return { success: true, count: importedUsers.length };
    },
    [hasPerm, users, members]
  );

  // Column operations
  const addColumn = useCallback(
    (name: string, color = '#DFE1E6', isDone = false) => {
      if (!currentProject || !hasPerm('manage_columns')) return;
      const projectCols = columns.filter((c) => c.project_id === currentProject.id);
      const newCol: BoardColumn = {
        id: Date.now(),
        project_id: currentProject.id,
        name: name.trim(),
        position: projectCols.length,
        color,
        is_done_column: isDone,
      };
      setColumns((prev) => [...prev, newCol]);
    },
    [currentProject, hasPerm, columns]
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
      setColumns((prev) => prev.filter((c) => c.id !== id));
      setTasks((prev) => prev.map((t) => (t.column_id === id ? { ...t, column_id: null } : t)));
    },
    [hasPerm]
  );

  // Task operations
  const createTask = useCallback(
    (data: Partial<Task>) => {
      if (!currentProject || !currentUser) {
        return { success: false, error: 'No hay proyecto activo' };
      }
      if (!hasPerm('manage_tasks')) {
        return { success: false, error: 'No tienes permisos para crear tareas' };
      }

      const projectTasks = tasks.filter((t) => t.project_id === currentProject.id);
      const nextNum = projectTasks.length + 1;
      const taskKey = `${currentProject.key}-${nextNum}`;

      const assignedIds = data.assignee_ids !== undefined
        ? data.assignee_ids
        : (data.assignee_id !== undefined && data.assignee_id !== null ? [data.assignee_id] : []);
      const primaryAssignee = assignedIds.length > 0 ? assignedIds[0] : (data.assignee_id ?? null);

      const newTask: Task = {
        id: Date.now(),
        project_id: currentProject.id,
        column_id: data.column_id ?? null,
        sprint_id: data.sprint_id ?? null,
        title: data.title?.trim() || 'Nueva Tarea',
        description: data.description || '',
        task_type: data.task_type || 'task',
        priority: data.priority || 'medium',
        status: data.status || 'To Do',
        story_points: data.story_points ?? null,
        assignee_id: primaryAssignee,
        assignee_ids: assignedIds,
        reporter_id: currentUser.id,
        due_date: data.due_date ?? null,
        position: projectTasks.length,
        labels: data.labels || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        task_key: taskKey,
      };

      setTasks((prev) => [...prev, newTask]);
      logActivity(newTask.id, 'created');
      return { success: true, task: newTask };
    },
    [currentProject, currentUser, hasPerm, tasks, logActivity]
  );

  const updateTask = useCallback(
    (id: number, data: Partial<Task>) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return { success: false, error: 'Tarea no encontrada' };
      if (!canEdit(task)) {
        return { success: false, error: 'No tienes permisos para editar esta tarea' };
      }

      // Log changes
      if (data.status && data.status !== task.status) {
        logActivity(id, 'moved', 'estado', task.status, data.status);
      }

      // Handle assignee updates
      let updatedAssigneeIds = data.assignee_ids !== undefined
        ? data.assignee_ids
        : (data.assignee_id !== undefined ? (data.assignee_id ? [data.assignee_id] : []) : task.assignee_ids ?? (task.assignee_id ? [task.assignee_id] : []));
      let updatedAssigneeId = updatedAssigneeIds.length > 0 ? updatedAssigneeIds[0] : null;

      if (data.assignee_ids !== undefined || data.assignee_id !== undefined) {
        const oldIds = getTaskAssigneeIds(task);
        const oldNames = oldIds.map((uid) => users.find((u) => u.id === uid)?.name || `ID:${uid}`).join(', ') || 'Sin asignar';
        const newNames = updatedAssigneeIds.map((uid) => users.find((u) => u.id === uid)?.name || `ID:${uid}`).join(', ') || 'Sin asignar';
        if (oldNames !== newNames) {
          logActivity(id, 'edited', 'asignados', oldNames, newNames);
        }
      }

      if (data.priority && data.priority !== task.priority) {
        logActivity(id, 'edited', 'prioridad', task.priority, data.priority);
      }

      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                ...data,
                assignee_id: updatedAssigneeId,
                assignee_ids: updatedAssigneeIds,
                updated_at: new Date().toISOString(),
              }
            : t
        )
      );
      return { success: true };
    },
    [tasks, canEdit, logActivity, users]
  );

  const deleteTask = useCallback(
    (id: number) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return { success: false, error: 'Tarea no encontrada' };
      if (!hasPerm('delete_any') && task.reporter_id !== currentUser?.id) {
        return { success: false, error: 'Solo puedes eliminar tareas que tú creaste o ser Administrador' };
      }

      setTasks((prev) => prev.filter((t) => t.id !== id));
      setComments((prev) => prev.filter((c) => c.task_id !== id));
      setAttachments((prev) => prev.filter((a) => a.task_id !== id));
      return { success: true };
    },
    [tasks, hasPerm, currentUser]
  );

  const moveTask = useCallback(
    (taskId: number, newColumnId: number | null, newPosition?: number) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      if (!hasPerm('move_tasks')) return;

      const oldCol = columns.find((c) => c.id === task.column_id);
      const newCol = columns.find((c) => c.id === newColumnId);

      if (oldCol && newCol && oldCol.id !== newCol.id) {
        logActivity(taskId, 'moved', 'columna', oldCol.name, newCol.name);
      }

      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            column_id: newColumnId,
            position: newPosition !== undefined ? newPosition : t.position,
            status: newCol ? newCol.name : t.status,
            updated_at: new Date().toISOString(),
          };
        })
      );
    },
    [tasks, hasPerm, columns, logActivity]
  );

  // Sprints
  const createSprint = useCallback(
    (name: string, goal: string, startDate?: string, endDate?: string) => {
      if (!currentProject || !hasPerm('manage_sprints')) {
        throw new Error('No autorizado');
      }

      const newSprint: Sprint = {
        id: Date.now(),
        project_id: currentProject.id,
        name: name.trim(),
        goal: goal.trim(),
        start_date: startDate || null,
        end_date: endDate || null,
        status: 'planned',
        created_at: new Date().toISOString(),
      };

      setSprints((prev) => [...prev, newSprint]);
      return newSprint;
    },
    [currentProject, hasPerm]
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
      if (!hasPerm('manage_sprints')) return;
      setSprints((prev) =>
        prev.map((s) => (s.id === sprintId ? { ...s, status: 'active' } : s))
      );
    },
    [hasPerm]
  );

  const completeSprint = useCallback(
    (sprintId: number) => {
      if (!hasPerm('manage_sprints')) return;
      setSprints((prev) =>
        prev.map((s) => (s.id === sprintId ? { ...s, status: 'completed' } : s))
      );
    },
    [hasPerm]
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
        author: currentUser,
      };

      setComments((prev) => [...prev, newComment]);
      logActivity(taskId, 'commented', 'comentario', undefined, content.substring(0, 30));
    },
    [currentUser, logActivity]
  );

  const deleteComment = useCallback(
    (commentId: number) => {
      const comm = comments.find((c) => c.id === commentId);
      if (!comm) return;
      if (!hasPerm('delete_any') && comm.user_id !== currentUser?.id) return;

      setComments((prev) => prev.filter((c) => c.id !== commentId));
    },
    [comments, hasPerm, currentUser]
  );

  // Attachments
  const uploadAttachment = useCallback(
    async (taskId: number, file: File): Promise<{ success: boolean; error?: string }> => {
      if (!hasPerm('attach')) {
        return { success: false, error: 'No tienes permisos para adjuntar archivos' };
      }
      if (!currentUser) {
        return { success: false, error: 'Usuario no identificado' };
      }

      // Check max size (5MB for cloud efficiency)
      if (file.size > 5 * 1024 * 1024) {
        return { success: false, error: 'El archivo no debe exceder 5MB' };
      }

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const newAttachment: TaskAttachment = {
            id: Date.now(),
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
  const resetToDemoData = useCallback(async () => {
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

    try {
      const appDocRef = doc(db, 'app_state', 'main');
      await setDoc(appDocRef, {
        id: 'main',
        users: INITIAL_USERS,
        projects: INITIAL_PROJECTS,
        members: INITIAL_MEMBERS,
        columns: INITIAL_COLUMNS,
        tasks: INITIAL_TASKS,
        sprints: INITIAL_SPRINTS,
        comments: INITIAL_COMMENTS,
        activityLogs: INITIAL_ACTIVITY,
        attachments: [],
        updatedAt: new Date().toISOString(),
        updatedBy: 'reset',
      });
    } catch (err) {
      console.error('Error resetting Firestore state:', err);
    }
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
      isCloudConnected,
      isSyncing,
      login,
      registerUser,
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
      isCloudConnected,
      isSyncing,
      login,
      registerUser,
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
