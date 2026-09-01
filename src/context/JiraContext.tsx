import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  User,
  Project,
  ProjectMember,
  BoardColumn,
  Task,
  Sprint,
  SprintStatus,
  TaskComment,
  ActivityLog,
  TaskAttachment,
  Role,
  Permission,
  ImportUserPayload,
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

  // Sync refs to always have the latest state in callbacks & async handlers
  const usersRef = useRef<User[]>(users);
  usersRef.current = users;
  const projectsRef = useRef<Project[]>(projects);
  projectsRef.current = projects;
  const membersRef = useRef<ProjectMember[]>(members);
  membersRef.current = members;
  const columnsRef = useRef<BoardColumn[]>(columns);
  columnsRef.current = columns;
  const tasksRef = useRef<Task[]>(tasks);
  tasksRef.current = tasks;
  const sprintsRef = useRef<Sprint[]>(sprints);
  sprintsRef.current = sprints;
  const commentsRef = useRef<TaskComment[]>(comments);
  commentsRef.current = comments;
  const activityLogsRef = useRef<ActivityLog[]>(activityLogs);
  activityLogsRef.current = activityLogs;
  const attachmentsRef = useRef<TaskAttachment[]>(attachments);
  attachmentsRef.current = attachments;

  const isRemoteUpdate = useRef<boolean>(false);
  const isInitialized = useRef<boolean>(false);

  // Immediate and robust state persister to LocalStorage & Firestore
  const persistState = useCallback(
    async (partial?: {
      users?: User[];
      projects?: Project[];
      members?: ProjectMember[];
      columns?: BoardColumn[];
      tasks?: Task[];
      sprints?: Sprint[];
      comments?: TaskComment[];
      activityLogs?: ActivityLog[];
      attachments?: TaskAttachment[];
    }) => {
      const u = partial?.users ?? usersRef.current;
      const p = partial?.projects ?? projectsRef.current;
      const m = partial?.members ?? membersRef.current;
      const col = partial?.columns ?? columnsRef.current;
      const t = partial?.tasks ?? tasksRef.current;
      const sp = partial?.sprints ?? sprintsRef.current;
      const c = partial?.comments ?? commentsRef.current;
      const a = partial?.activityLogs ?? activityLogsRef.current;
      const att = partial?.attachments ?? attachmentsRef.current;

      // Update LocalStorage immediately for instant local reliability
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(u));
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(p));
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(m));
      localStorage.setItem(STORAGE_KEYS.COLUMNS, JSON.stringify(col));
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(t));
      localStorage.setItem(STORAGE_KEYS.SPRINTS, JSON.stringify(sp));
      localStorage.setItem(STORAGE_KEYS.COMMENTS, JSON.stringify(c));
      localStorage.setItem(STORAGE_KEYS.ACTIVITY, JSON.stringify(a));
      localStorage.setItem(STORAGE_KEYS.ATTACHMENTS, JSON.stringify(att));

      try {
        setIsSyncing(true);
        const appDocRef = doc(db, 'app_state', 'main');
        await setDoc(appDocRef, {
          id: 'main',
          users: u,
          projects: p,
          members: m,
          columns: col,
          tasks: t,
          sprints: sp,
          comments: c,
          activityLogs: a,
          attachments: att,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUserId ? `user_${currentUserId}` : 'system',
        });
        setIsCloudConnected(true);
      } catch (err) {
        console.error('Error saving state directly to Firestore:', err);
      } finally {
        setIsSyncing(false);
      }
    },
    [currentUserId]
  );

  // Real-time Firestore Synchronizer (Multi-user safe merge)
  useEffect(() => {
    const appDocRef = doc(db, 'app_state', 'main');

    const unsubscribe = onSnapshot(
      appDocRef,
      (snapshot) => {
        setIsCloudConnected(true);
        if (snapshot.exists()) {
          const data = snapshot.data();
          isRemoteUpdate.current = true;

          if (Array.isArray(data.users)) {
            setUsers(data.users);
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(data.users));
          }
          if (Array.isArray(data.projects)) {
            setProjects(data.projects);
            localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(data.projects));
          }
          if (Array.isArray(data.members)) {
            setMembers(data.members);
            localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(data.members));
          }
          if (Array.isArray(data.columns)) {
            setColumns(data.columns);
            localStorage.setItem(STORAGE_KEYS.COLUMNS, JSON.stringify(data.columns));
          }

          // Smart merge tasks: ensure no newly created local task is accidentally wiped by a stale snapshot
          if (Array.isArray(data.tasks)) {
            const remoteTasks: Task[] = data.tasks;
            const localTasks = tasksRef.current;

            // Map remote tasks by id
            const remoteMap = new Map<number, Task>();
            remoteTasks.forEach((rt) => remoteMap.set(rt.id, rt));

            // Include local tasks that were created/updated very recently (within 2 minutes) and haven't synced yet
            const now = Date.now();
            const mergedTasks = [...remoteTasks];

            localTasks.forEach((lt) => {
              if (!remoteMap.has(lt.id)) {
                const taskTime = lt.updated_at ? new Date(lt.updated_at).getTime() : lt.id;
                // If created in the last 2 minutes, keep it
                if (now - taskTime < 120000) {
                  mergedTasks.push(lt);
                }
              }
            });

            setTasks(mergedTasks);
            localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(mergedTasks));
          }

          if (Array.isArray(data.sprints)) {
            setSprints(data.sprints);
            localStorage.setItem(STORAGE_KEYS.SPRINTS, JSON.stringify(data.sprints));
          }
          if (Array.isArray(data.comments)) {
            setComments(data.comments);
            localStorage.setItem(STORAGE_KEYS.COMMENTS, JSON.stringify(data.comments));
          }
          if (Array.isArray(data.activityLogs)) {
            setActivityLogs(data.activityLogs);
            localStorage.setItem(STORAGE_KEYS.ACTIVITY, JSON.stringify(data.activityLogs));
          }
          if (Array.isArray(data.attachments)) {
            setAttachments(data.attachments);
            localStorage.setItem(STORAGE_KEYS.ATTACHMENTS, JSON.stringify(data.attachments));
          }

          setTimeout(() => {
            isRemoteUpdate.current = false;
            isInitialized.current = true;
          }, 100);
        } else {
          // Initialize Firebase database with initial state if empty
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
      // Product Owner has all project-level permissions, but no admin user/csv import permissions
      if (currentUser.role === 'po') {
        if (perm === 'manage_users' || perm === 'import_csv') return false;
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

      const updatedProjects = [...projectsRef.current, newProj];
      const updatedCols = [...columnsRef.current, ...defaultCols];
      const updatedMembers = newMembers.length > 0 ? [...membersRef.current, ...newMembers] : membersRef.current;
      persistState({ projects: updatedProjects, columns: updatedCols, members: updatedMembers });

      return { success: true };
    },
    [hasPerm, currentUser, persistState]
  );

  const updateProject = useCallback(
    (id: number, name: string, description: string) => {
      if (!hasPerm('manage_project')) {
        return { success: false, error: 'No tienes permisos para editar proyectos' };
      }
      const updated = projectsRef.current.map((p) =>
        p.id === id ? { ...p, name: name.trim(), description: description.trim() } : p
      );
      setProjects(updated);
      persistState({ projects: updated });
      return { success: true };
    },
    [hasPerm, persistState]
  );

  const deleteProject = useCallback(
    (id: number) => {
      if (!hasPerm('manage_project')) {
        return { success: false, error: 'No tienes permisos para eliminar proyectos' };
      }
      const updatedProj = projectsRef.current.filter((p) => p.id !== id);
      const updatedCols = columnsRef.current.filter((c) => c.project_id !== id);
      const updatedTasks = tasksRef.current.filter((t) => t.project_id !== id);
      const updatedSprints = sprintsRef.current.filter((s) => s.project_id !== id);
      const updatedMembers = membersRef.current.filter((m) => m.project_id !== id);

      setProjects(updatedProj);
      setColumns(updatedCols);
      setTasks(updatedTasks);
      setSprints(updatedSprints);
      setMembers(updatedMembers);

      if (currentProjectId === id) {
        setCurrentProjectId(updatedProj[0]?.id || null);
      }

      persistState({
        projects: updatedProj,
        columns: updatedCols,
        tasks: updatedTasks,
        sprints: updatedSprints,
        members: updatedMembers,
      });

      return { success: true };
    },
    [hasPerm, currentProjectId, persistState]
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

      const existingUser = usersRef.current.find(
        (u) => u.username.toLowerCase() === data.username.trim().toLowerCase()
      );
      let userId: number;
      let updatedUsers = usersRef.current;

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
        updatedUsers = [...usersRef.current, newUser];
        setUsers(updatedUsers);
      }

      // Check if already member
      const isAlreadyMember = membersRef.current.some(
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

      const updatedMembers = [...membersRef.current, newMember];
      setMembers(updatedMembers);
      persistState({ users: updatedUsers, members: updatedMembers });

      return { success: true };
    },
    [hasPerm, persistState]
  );

  const addMemberToProject = useCallback(
    (projectId: number, userId: number, role: Role) => {
      if (!hasPerm('manage_members')) {
        return { success: false, error: 'No tienes permisos para agregar miembros' };
      }
      const isAlready = membersRef.current.some((m) => m.project_id === projectId && m.user_id === userId);
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
      const updated = [...membersRef.current, newMember];
      setMembers(updated);
      persistState({ members: updated });
      return { success: true };
    },
    [hasPerm, persistState]
  );

  const updateMemberRole = useCallback(
    (memberId: number, role: Role) => {
      if (!hasPerm('manage_members')) return;
      const updated = membersRef.current.map((m) => (m.id === memberId ? { ...m, role } : m));
      setMembers(updated);
      persistState({ members: updated });
    },
    [hasPerm, persistState]
  );

  const removeMemberFromProject = useCallback(
    (memberId: number) => {
      if (!hasPerm('manage_members')) return;
      const updated = membersRef.current.filter((m) => m.id !== memberId);
      setMembers(updated);
      persistState({ members: updated });
    },
    [hasPerm, persistState]
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

      const targetUser = usersRef.current.find((u) => u.id === userId);
      if (!targetUser) {
        return { success: false, error: 'Usuario no encontrado' };
      }

      if (data.username && data.username.trim().toLowerCase() !== targetUser.username.toLowerCase()) {
        const isTaken = usersRef.current.some(
          (u) => u.id !== userId && u.username.toLowerCase() === data.username?.trim().toLowerCase()
        );
        if (isTaken) {
          return { success: false, error: 'El nombre de usuario ya está en uso' };
        }
      }

      const updatedUsers = usersRef.current.map((u) => {
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
      });

      let updatedMembers = membersRef.current;
      if (projectIds !== undefined) {
        const assignedRole: Role = data.role || targetUser.role || (targetUser.is_admin ? 'admin' : 'frontend');
        const filtered = membersRef.current.filter((m) => m.user_id !== userId);
        const newEntries: ProjectMember[] = projectIds.map((pId, idx) => ({
          id: Date.now() + idx + Math.floor(Math.random() * 1000),
          project_id: pId,
          user_id: userId,
          role: assignedRole,
          created_at: new Date().toISOString(),
        }));
        updatedMembers = [...filtered, ...newEntries];
      } else if (data.role !== undefined) {
        updatedMembers = membersRef.current.map((m) =>
          m.user_id === userId ? { ...m, role: data.role as Role } : m
        );
      }

      setUsers(updatedUsers);
      setMembers(updatedMembers);
      persistState({ users: updatedUsers, members: updatedMembers });

      return { success: true };
    },
    [currentUser, persistState]
  );

  const deleteUser = useCallback(
    (userId: number) => {
      if (!currentUser?.is_admin && currentUser?.role !== 'admin') {
        return { success: false, error: 'Solo el Project Manager (Admin) puede eliminar usuarios' };
      }

      const adminCount = usersRef.current.filter((u) => u.is_admin || u.role === 'admin').length;
      const targetUser = usersRef.current.find((u) => u.id === userId);
      if ((targetUser?.is_admin || targetUser?.role === 'admin') && adminCount <= 1) {
        return { success: false, error: 'No es posible eliminar al único Project Manager activo del sistema' };
      }

      const updatedUsers = usersRef.current.filter((u) => u.id !== userId);
      const updatedMembers = membersRef.current.filter((m) => m.user_id !== userId);
      const updatedTasks = tasksRef.current.map((t) => {
        const currentIds = getTaskAssigneeIds(t);
        const newIds = currentIds.filter((uid) => uid !== userId);
        return {
          ...t,
          assignee_id: newIds[0] ?? null,
          assignee_ids: newIds,
        };
      });

      setUsers(updatedUsers);
      setMembers(updatedMembers);
      setTasks(updatedTasks);

      if (currentUserId === userId) {
        const remainingAdmin = updatedUsers.find((u) => u.is_admin || u.role === 'admin');
        if (remainingAdmin) {
          setCurrentUserId(remainingAdmin.id);
        } else {
          const firstRemaining = updatedUsers[0];
          setCurrentUserId(firstRemaining ? firstRemaining.id : null);
        }
      }

      persistState({ users: updatedUsers, members: updatedMembers, tasks: updatedTasks });
      return { success: true };
    },
    [currentUser, currentUserId, persistState]
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
      const newProjectsToAdd: Project[] = [];
      const newColsToAdd: BoardColumn[] = [];

      let currentMaxUserId = usersRef.current.reduce((max, u) => Math.max(max, u.id), 0);
      let currentMaxMemberId = membersRef.current.reduce((max, m) => Math.max(max, m.id), 0);
      let currentMaxProjId = projectsRef.current.reduce((max, p) => Math.max(max, p.id), 0);
      let currentMaxColId = columnsRef.current.reduce((max, c) => Math.max(max, c.id), 0);

      const existingUsernames = new Map<string, User>();
      usersRef.current.forEach((u) => existingUsernames.set(u.username.toLowerCase(), u));

      // Helper to find or create project by key or name
      const findOrCreateProject = (nameOrKey?: string): number | undefined => {
        if (!nameOrKey || !nameOrKey.trim()) return defaultProjectId;
        const query = nameOrKey.trim().toLowerCase();

        // 1. Check existing projects
        const allKnownProjects = [...projectsRef.current, ...newProjectsToAdd];
        const match = allKnownProjects.find(
          (p) =>
            p.id.toString() === query ||
            p.key.toLowerCase() === query ||
            p.name.toLowerCase() === query ||
            p.name.toLowerCase().includes(query)
        );

        if (match) return match.id;

        // 2. Auto-create project if missing
        currentMaxProjId += 1;
        const newProjId = currentMaxProjId;
        const cleanName = nameOrKey.trim();
        let derivedKey = cleanName
          .replace(/[^a-zA-Z0-9]/g, '')
          .slice(0, 4)
          .toUpperCase();
        if (derivedKey.length < 2) {
          derivedKey = `P${newProjId}`;
        }
        // Ensure unique key
        while (allKnownProjects.some((p) => p.key === derivedKey)) {
          derivedKey = `${derivedKey}${Math.floor(Math.random() * 9)}`;
        }

        const newProj: Project = {
          id: newProjId,
          name: cleanName,
          key: derivedKey,
          description: `Proyecto / Grupo creado automáticamente vía importación CSV`,
          created_at: new Date().toISOString(),
        };
        newProjectsToAdd.push(newProj);

        // Add default Scrum columns for the new project
        const defaultColNames = [
          { name: 'Backlog', color: '#DFE1E6', isDone: false },
          { name: 'To Do', color: '#C3CFE2', isDone: false },
          { name: 'In Progress', color: '#FFF3CD', isDone: false },
          { name: 'In Review', color: '#FFE0B2', isDone: false },
          { name: 'Done', color: '#D4EDDA', isDone: true },
        ];
        defaultColNames.forEach((d, idx) => {
          currentMaxColId += 1;
          newColsToAdd.push({
            id: currentMaxColId,
            project_id: newProjId,
            name: d.name,
            position: idx,
            color: d.color,
            is_done_column: d.isDone,
          });
        });

        // Add creator / PM as admin member of the new project
        if (currentUser) {
          currentMaxMemberId += 1;
          newMembersToAdd.push({
            id: currentMaxMemberId,
            project_id: newProjId,
            user_id: currentUser.id,
            role: 'admin',
            created_at: new Date().toISOString(),
          });
        }

        return newProjId;
      };

      for (const item of importedUsers) {
        const normalizedUsername = item.username.trim().toLowerCase();
        let targetUser = existingUsernames.get(normalizedUsername);

        if (!targetUser) {
          currentMaxUserId += 1;
          const avatarColor = colors[Math.floor(Math.random() * colors.length)];
          const createdUser: User = {
            id: currentMaxUserId,
            name: item.name.trim(),
            username: normalizedUsername,
            email: item.email?.trim() || `${normalizedUsername}@institucion.edu`,
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

        // Determine target project ID
        let resolvedProjectId = item.projectId;
        if (!resolvedProjectId && (item.projectName || item.projectKey)) {
          resolvedProjectId = findOrCreateProject(item.projectName || item.projectKey);
        }
        if (!resolvedProjectId) {
          resolvedProjectId = defaultProjectId;
        }

        if (resolvedProjectId && targetUser) {
          const alreadyMember =
            membersRef.current.some((m) => m.project_id === resolvedProjectId && m.user_id === targetUser?.id) ||
            newMembersToAdd.some((m) => m.project_id === resolvedProjectId && m.user_id === targetUser?.id);

          if (!alreadyMember) {
            currentMaxMemberId += 1;
            newMembersToAdd.push({
              id: currentMaxMemberId,
              project_id: resolvedProjectId,
              user_id: targetUser.id,
              role: item.role,
              created_at: new Date().toISOString(),
            });
          }
        }
      }

      const finalUsers = newUsersToAdd.length > 0 ? [...usersRef.current, ...newUsersToAdd] : usersRef.current;
      const finalMembers = newMembersToAdd.length > 0 ? [...membersRef.current, ...newMembersToAdd] : membersRef.current;
      const finalProjects = newProjectsToAdd.length > 0 ? [...projectsRef.current, ...newProjectsToAdd] : projectsRef.current;
      const finalCols = newColsToAdd.length > 0 ? [...columnsRef.current, ...newColsToAdd] : columnsRef.current;

      if (newUsersToAdd.length > 0) setUsers(finalUsers);
      if (newMembersToAdd.length > 0) setMembers(finalMembers);
      if (newProjectsToAdd.length > 0) setProjects(finalProjects);
      if (newColsToAdd.length > 0) setColumns(finalCols);

      persistState({
        users: finalUsers,
        members: finalMembers,
        projects: finalProjects,
        columns: finalCols,
      });

      return { success: true, count: importedUsers.length };
    },
    [hasPerm, currentUser, persistState]
  );

  // Column operations
  const addColumn = useCallback(
    (name: string, color = '#DFE1E6', isDone = false) => {
      if (!currentProject || !hasPerm('manage_columns')) return;
      const projectCols = columnsRef.current.filter((c) => c.project_id === currentProject.id);
      const newCol: BoardColumn = {
        id: Date.now(),
        project_id: currentProject.id,
        name: name.trim(),
        position: projectCols.length,
        color,
        is_done_column: isDone,
      };
      const updated = [...columnsRef.current, newCol];
      setColumns(updated);
      persistState({ columns: updated });
    },
    [currentProject, hasPerm, persistState]
  );

  const updateColumn = useCallback(
    (id: number, updates: Partial<BoardColumn>) => {
      if (!hasPerm('manage_columns')) return;
      const updated = columnsRef.current.map((c) => (c.id === id ? { ...c, ...updates } : c));
      setColumns(updated);
      persistState({ columns: updated });
    },
    [hasPerm, persistState]
  );

  const deleteColumn = useCallback(
    (id: number) => {
      if (!hasPerm('manage_columns')) return;
      const updatedCols = columnsRef.current.filter((c) => c.id !== id);
      const updatedTasks = tasksRef.current.map((t) => (t.column_id === id ? { ...t, column_id: null } : t));
      setColumns(updatedCols);
      setTasks(updatedTasks);
      persistState({ columns: updatedCols, tasks: updatedTasks });
    },
    [hasPerm, persistState]
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

      const allTasks = tasksRef.current;
      const projectTasks = allTasks.filter((t) => t.project_id === currentProject.id);
      const nextNum = projectTasks.length + 1;
      const taskKey = `${currentProject.key}-${nextNum}`;

      const assignedIds =
        data.assignee_ids !== undefined
          ? data.assignee_ids
          : data.assignee_id !== undefined && data.assignee_id !== null
          ? [data.assignee_id]
          : [];
      const primaryAssignee = assignedIds.length > 0 ? assignedIds[0] : data.assignee_id ?? null;

      // Robust column and status resolution
      const projectCols = columnsRef.current.filter((c) => c.project_id === currentProject.id);
      let targetColId: number | null = data.column_id ?? null;
      let targetStatus: string = data.status || 'To Do';

      if (targetColId !== null) {
        const found = projectCols.find((c) => c.id === targetColId);
        if (found) {
          targetStatus = found.name;
        }
      } else if (data.status) {
        const found = projectCols.find((c) => c.name.toLowerCase() === data.status?.toLowerCase());
        if (found) {
          targetColId = found.id;
        }
      } else if (projectCols.length > 0) {
        const defaultCol = projectCols.find((c) => !c.name.toLowerCase().includes('backlog')) || projectCols[0];
        targetColId = defaultCol.id;
        targetStatus = defaultCol.name;
      }

      // Robust sprint resolution: if not specified and not backlog, associate with active sprint if any
      let targetSprintId: number | null = data.sprint_id ?? null;
      if (targetSprintId === null && targetStatus.toLowerCase() !== 'backlog') {
        const activeSprint = sprintsRef.current.find(
          (s) => s.project_id === currentProject.id && s.status === 'active'
        );
        if (activeSprint) {
          targetSprintId = activeSprint.id;
        }
      }

      const taskId = Date.now();
      const newTask: Task = {
        id: taskId,
        project_id: currentProject.id,
        column_id: targetColId,
        sprint_id: targetSprintId,
        title: data.title?.trim() || 'Nueva Tarea',
        description: data.description || '',
        task_type: data.task_type || 'task',
        priority: data.priority || 'medium',
        status: targetStatus,
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

      const newLog: ActivityLog = {
        id: Date.now() + 1,
        task_id: taskId,
        user_id: currentUser.id,
        action: 'created',
        created_at: new Date().toISOString(),
        user: currentUser,
      };

      const updatedTasks = [...allTasks, newTask];
      const updatedLogs = [newLog, ...activityLogsRef.current];

      setTasks(updatedTasks);
      setActivityLogs(updatedLogs);

      // Persist immediately to avoid any race conditions or stale snapshot drops
      persistState({ tasks: updatedTasks, activityLogs: updatedLogs });

      return { success: true, task: newTask };
    },
    [currentProject, currentUser, hasPerm, persistState]
  );

  const updateTask = useCallback(
    (id: number, data: Partial<Task>) => {
      const allTasks = tasksRef.current;
      const task = allTasks.find((t) => t.id === id);
      if (!task) return { success: false, error: 'Tarea no encontrada' };
      if (!canEdit(task)) {
        return { success: false, error: 'No tienes permisos para editar esta tarea' };
      }

      const newLogs: ActivityLog[] = [];

      // Log changes
      if (data.status && data.status !== task.status) {
        newLogs.push({
          id: Date.now() + Math.floor(Math.random() * 100),
          task_id: id,
          user_id: currentUser?.id || 1,
          action: 'moved',
          field_changed: 'estado',
          old_value: task.status,
          new_value: data.status,
          created_at: new Date().toISOString(),
          user: currentUser || undefined,
        });
      }

      // Handle assignee updates
      let updatedAssigneeIds =
        data.assignee_ids !== undefined
          ? data.assignee_ids
          : data.assignee_id !== undefined
          ? data.assignee_id
            ? [data.assignee_id]
            : []
          : task.assignee_ids ?? (task.assignee_id ? [task.assignee_id] : []);
      let updatedAssigneeId = updatedAssigneeIds.length > 0 ? updatedAssigneeIds[0] : null;

      if (data.assignee_ids !== undefined || data.assignee_id !== undefined) {
        const oldIds = getTaskAssigneeIds(task);
        const oldNames =
          oldIds.map((uid) => usersRef.current.find((u) => u.id === uid)?.name || `ID:${uid}`).join(', ') ||
          'Sin asignar';
        const newNames =
          updatedAssigneeIds
            .map((uid) => usersRef.current.find((u) => u.id === uid)?.name || `ID:${uid}`)
            .join(', ') || 'Sin asignar';
        if (oldNames !== newNames) {
          newLogs.push({
            id: Date.now() + Math.floor(Math.random() * 100) + 1,
            task_id: id,
            user_id: currentUser?.id || 1,
            action: 'edited',
            field_changed: 'asignados',
            old_value: oldNames,
            new_value: newNames,
            created_at: new Date().toISOString(),
            user: currentUser || undefined,
          });
        }
      }

      if (data.priority && data.priority !== task.priority) {
        newLogs.push({
          id: Date.now() + Math.floor(Math.random() * 100) + 2,
          task_id: id,
          user_id: currentUser?.id || 1,
          action: 'edited',
          field_changed: 'prioridad',
          old_value: task.priority,
          new_value: data.priority,
          created_at: new Date().toISOString(),
          user: currentUser || undefined,
        });
      }

      const updatedTasks = allTasks.map((t) =>
        t.id === id
          ? {
              ...t,
              ...data,
              assignee_id: updatedAssigneeId,
              assignee_ids: updatedAssigneeIds,
              updated_at: new Date().toISOString(),
            }
          : t
      );
      const updatedLogs = [...newLogs, ...activityLogsRef.current];

      setTasks(updatedTasks);
      if (newLogs.length > 0) {
        setActivityLogs(updatedLogs);
      }

      persistState({ tasks: updatedTasks, activityLogs: newLogs.length > 0 ? updatedLogs : undefined });
      return { success: true };
    },
    [canEdit, currentUser, persistState]
  );

  const deleteTask = useCallback(
    (id: number) => {
      const allTasks = tasksRef.current;
      const task = allTasks.find((t) => t.id === id);
      if (!task) return { success: false, error: 'Tarea no encontrada' };
      if (!hasPerm('delete_any') && task.reporter_id !== currentUser?.id) {
        return { success: false, error: 'Solo puedes eliminar tareas que tú creaste o ser Administrador' };
      }

      const updatedTasks = allTasks.filter((t) => t.id !== id);
      const updatedComments = commentsRef.current.filter((c) => c.task_id !== id);
      const updatedAttachments = attachmentsRef.current.filter((a) => a.task_id !== id);

      setTasks(updatedTasks);
      setComments(updatedComments);
      setAttachments(updatedAttachments);

      persistState({ tasks: updatedTasks, comments: updatedComments, attachments: updatedAttachments });
      return { success: true };
    },
    [hasPerm, currentUser, persistState]
  );

  const moveTask = useCallback(
    (taskId: number, newColumnId: number | null, newPosition?: number) => {
      const allTasks = tasksRef.current;
      const task = allTasks.find((t) => t.id === taskId);
      if (!task) return;
      if (!hasPerm('move_tasks')) return;

      const projectCols = columnsRef.current;
      const oldCol = projectCols.find((c) => c.id === task.column_id);
      const newCol = projectCols.find((c) => c.id === newColumnId);

      const newLogs: ActivityLog[] = [];
      if (oldCol && newCol && oldCol.id !== newCol.id) {
        newLogs.push({
          id: Date.now(),
          task_id: taskId,
          user_id: currentUser?.id || 1,
          action: 'moved',
          field_changed: 'columna',
          old_value: oldCol.name,
          new_value: newCol.name,
          created_at: new Date().toISOString(),
          user: currentUser || undefined,
        });
      }

      const updatedTasks = allTasks.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          column_id: newColumnId,
          position: newPosition !== undefined ? newPosition : t.position,
          status: newCol ? newCol.name : t.status,
          updated_at: new Date().toISOString(),
        };
      });
      const updatedLogs = [...newLogs, ...activityLogsRef.current];

      setTasks(updatedTasks);
      if (newLogs.length > 0) setActivityLogs(updatedLogs);

      persistState({ tasks: updatedTasks, activityLogs: newLogs.length > 0 ? updatedLogs : undefined });
    },
    [hasPerm, currentUser, persistState]
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

      const updated = [...sprintsRef.current, newSprint];
      setSprints(updated);
      persistState({ sprints: updated });
      return newSprint;
    },
    [currentProject, hasPerm, persistState]
  );

  const updateSprint = useCallback(
    (id: number, updates: Partial<Sprint>) => {
      if (!hasPerm('manage_sprints')) return;
      const updated = sprintsRef.current.map((s) => (s.id === id ? { ...s, ...updates } : s));
      setSprints(updated);
      persistState({ sprints: updated });
    },
    [hasPerm, persistState]
  );

  const startSprint = useCallback(
    (sprintId: number) => {
      if (!hasPerm('manage_sprints')) return;
      const updated = sprintsRef.current.map((s) => (s.id === sprintId ? { ...s, status: 'active' as SprintStatus } : s));
      setSprints(updated);
      persistState({ sprints: updated });
    },
    [hasPerm, persistState]
  );

  const completeSprint = useCallback(
    (sprintId: number) => {
      if (!hasPerm('manage_sprints')) return;
      const updated = sprintsRef.current.map((s) =>
        s.id === sprintId ? { ...s, status: 'completed' as SprintStatus } : s
      );
      setSprints(updated);
      persistState({ sprints: updated });
    },
    [hasPerm, persistState]
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

      const newLog: ActivityLog = {
        id: Date.now() + 1,
        task_id: taskId,
        user_id: currentUser.id,
        action: 'commented',
        field_changed: 'comentario',
        new_value: content.substring(0, 30),
        created_at: new Date().toISOString(),
        user: currentUser,
      };

      const updatedComments = [...commentsRef.current, newComment];
      const updatedLogs = [newLog, ...activityLogsRef.current];

      setComments(updatedComments);
      setActivityLogs(updatedLogs);
      persistState({ comments: updatedComments, activityLogs: updatedLogs });
    },
    [currentUser, persistState]
  );

  const deleteComment = useCallback(
    (commentId: number) => {
      const comm = commentsRef.current.find((c) => c.id === commentId);
      if (!comm) return;
      if (!hasPerm('delete_any') && comm.user_id !== currentUser?.id) return;

      const updated = commentsRef.current.filter((c) => c.id !== commentId);
      setComments(updated);
      persistState({ comments: updated });
    },
    [hasPerm, currentUser, persistState]
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
            uploader: currentUser,
          };

          const newLog: ActivityLog = {
            id: Date.now() + 1,
            task_id: taskId,
            user_id: currentUser.id,
            action: 'attached',
            field_changed: 'adjunto',
            new_value: file.name,
            created_at: new Date().toISOString(),
            user: currentUser,
          };

          const updatedAtt = [newAttachment, ...attachmentsRef.current];
          const updatedLogs = [newLog, ...activityLogsRef.current];

          setAttachments(updatedAtt);
          setActivityLogs(updatedLogs);
          persistState({ attachments: updatedAtt, activityLogs: updatedLogs });
          resolve({ success: true });
        };
        reader.onerror = () => {
          resolve({ success: false, error: 'Error al leer el archivo' });
        };
        reader.readAsDataURL(file);
      });
    },
    [hasPerm, currentUser, persistState]
  );

  const deleteAttachment = useCallback(
    (attachmentId: number) => {
      const att = attachmentsRef.current.find((a) => a.id === attachmentId);
      if (!att) return;
      if (!hasPerm('delete_any')) return;

      const newLog: ActivityLog = {
        id: Date.now(),
        task_id: att.task_id,
        user_id: currentUser?.id || 1,
        action: 'deleted',
        field_changed: 'adjunto',
        old_value: att.filename,
        created_at: new Date().toISOString(),
        user: currentUser || undefined,
      };

      const updatedAtt = attachmentsRef.current.filter((a) => a.id !== attachmentId);
      const updatedLogs = [newLog, ...activityLogsRef.current];

      setAttachments(updatedAtt);
      setActivityLogs(updatedLogs);
      persistState({ attachments: updatedAtt, activityLogs: updatedLogs });
    },
    [hasPerm, currentUser, persistState]
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
