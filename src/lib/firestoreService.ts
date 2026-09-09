import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  query,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
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
} from '../types/jira';
import {
  INITIAL_USERS,
  INITIAL_PROJECTS,
  INITIAL_MEMBERS,
  INITIAL_COLUMNS,
  INITIAL_TASKS,
  INITIAL_SPRINTS,
  INITIAL_COMMENTS,
  INITIAL_ACTIVITY,
} from '../data/seedData';

// Collection names
export const COLLECTIONS = {
  USERS: 'users',
  PROJECTS: 'projects',
  MEMBERS: 'members',
  COLUMNS: 'columns',
  TASKS: 'tasks',
  SPRINTS: 'sprints',
  COMMENTS: 'comments',
  ACTIVITY_LOGS: 'activity_logs',
  ATTACHMENTS: 'attachments',
  LEGACY_APP_STATE: 'app_state',
} as const;

/**
 * Execute operations in chunks of up to 400 to respect Firestore's 500-op batch limit
 */
async function commitBatchOperations(
  operations: Array<{ type: 'set' | 'delete'; ref: any; data?: any }>
) {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunk = operations.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      if (op.type === 'set') {
        batch.set(op.ref, op.data, { merge: true });
      } else if (op.type === 'delete') {
        batch.delete(op.ref);
      }
    }
    await batch.commit();
  }
}

/**
 * Automatic one-time migration from legacy monolithic app_state/main
 * or initialization with seed data if collections are empty.
 */
export async function initializeOrMigrateCollections(): Promise<boolean> {
  try {
    // Check if tasks collection already has any data
    const tasksQuery = query(collection(db, COLLECTIONS.TASKS), limit(1));
    const tasksSnapshot = await getDocs(tasksQuery);

    if (!tasksSnapshot.empty) {
      // Granular collections already active and populated
      return false;
    }

    console.log('[Firestore] No granular tasks found. Checking legacy app_state/main for migration...');

    // Check if legacy monolithic document exists
    const legacyRef = doc(db, COLLECTIONS.LEGACY_APP_STATE, 'main');
    const legacySnap = await getDoc(legacyRef);

    let users = INITIAL_USERS;
    let projects = INITIAL_PROJECTS;
    let members = INITIAL_MEMBERS;
    let columns = INITIAL_COLUMNS;
    let tasks = INITIAL_TASKS;
    let sprints = INITIAL_SPRINTS;
    let comments = INITIAL_COMMENTS;
    let activityLogs = INITIAL_ACTIVITY;
    let attachments: TaskAttachment[] = [];

    if (legacySnap.exists()) {
      const legacyData = legacySnap.data();
      console.log('[Firestore] Migrating existing legacy data to granular collections...');
      if (Array.isArray(legacyData.users) && legacyData.users.length > 0) users = legacyData.users;
      if (Array.isArray(legacyData.projects) && legacyData.projects.length > 0) projects = legacyData.projects;
      if (Array.isArray(legacyData.members) && legacyData.members.length > 0) members = legacyData.members;
      if (Array.isArray(legacyData.columns) && legacyData.columns.length > 0) columns = legacyData.columns;
      if (Array.isArray(legacyData.tasks) && legacyData.tasks.length > 0) tasks = legacyData.tasks;
      if (Array.isArray(legacyData.sprints) && legacyData.sprints.length > 0) sprints = legacyData.sprints;
      if (Array.isArray(legacyData.comments) && legacyData.comments.length > 0) comments = legacyData.comments;
      if (Array.isArray(legacyData.activityLogs) && legacyData.activityLogs.length > 0) activityLogs = legacyData.activityLogs;
      if (Array.isArray(legacyData.attachments) && legacyData.attachments.length > 0) attachments = legacyData.attachments;
    } else {
      console.log('[Firestore] Initializing fresh database with seed data into granular collections...');
    }

    const ops: Array<{ type: 'set'; ref: any; data: any }> = [];

    users.forEach((u) => ops.push({ type: 'set', ref: doc(db, COLLECTIONS.USERS, String(u.id)), data: u }));
    projects.forEach((p) => ops.push({ type: 'set', ref: doc(db, COLLECTIONS.PROJECTS, String(p.id)), data: p }));
    members.forEach((m) => ops.push({ type: 'set', ref: doc(db, COLLECTIONS.MEMBERS, String(m.id)), data: m }));
    columns.forEach((c) => ops.push({ type: 'set', ref: doc(db, COLLECTIONS.COLUMNS, String(c.id)), data: c }));
    tasks.forEach((t) => ops.push({ type: 'set', ref: doc(db, COLLECTIONS.TASKS, String(t.id)), data: t }));
    sprints.forEach((s) => ops.push({ type: 'set', ref: doc(db, COLLECTIONS.SPRINTS, String(s.id)), data: s }));
    comments.forEach((c) => ops.push({ type: 'set', ref: doc(db, COLLECTIONS.COMMENTS, String(c.id)), data: c }));
    activityLogs.forEach((a) => ops.push({ type: 'set', ref: doc(db, COLLECTIONS.ACTIVITY_LOGS, String(a.id)), data: a }));
    attachments.forEach((att) => ops.push({ type: 'set', ref: doc(db, COLLECTIONS.ATTACHMENTS, String(att.id)), data: att }));

    await commitBatchOperations(ops);

    // Mark legacy document as migrated
    if (legacySnap.exists()) {
      await setDoc(legacyRef, { migrated_at: new Date().toISOString(), status: 'migrated_to_granular' }, { merge: true });
    }

    console.log(`[Firestore] Granular migration completed: ${tasks.length} tasks, ${projects.length} projects migrated.`);
    return true;
  } catch (error) {
    console.error('[Firestore] Error during migration/initialization:', error);
    return false;
  }
}

/**
 * Generic Real-time subscription to a collection
 */
export function subscribeToCollection<T extends { id: number | string }>(
  collectionName: string,
  onData: (items: T[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, collectionName);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: T[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as T);
      });
      onData(items);
    },
    (err) => {
      console.warn(`[Firestore] Listener error on '${collectionName}':`, err);
      if (onError) onError(err);
    }
  );
}

// ----------------------------------------------------
// Granular Task CRUD Operations (Zero-collision)
// ----------------------------------------------------

export async function saveTask(task: Task): Promise<void> {
  const taskRef = doc(db, COLLECTIONS.TASKS, String(task.id));
  await setDoc(taskRef, task);
}

export async function updateTaskPartial(taskId: number, updates: Partial<Task>): Promise<void> {
  const taskRef = doc(db, COLLECTIONS.TASKS, String(taskId));
  await setDoc(taskRef, { ...updates, updated_at: new Date().toISOString() }, { merge: true });
}

export async function deleteTask(taskId: number): Promise<void> {
  const taskRef = doc(db, COLLECTIONS.TASKS, String(taskId));
  await deleteDoc(taskRef);
}

// ----------------------------------------------------
// Granular Project CRUD Operations
// ----------------------------------------------------

export async function saveProject(project: Project): Promise<void> {
  const projRef = doc(db, COLLECTIONS.PROJECTS, String(project.id));
  await setDoc(projRef, project);
}

export async function updateProjectPartial(projectId: number, updates: Partial<Project>): Promise<void> {
  const projRef = doc(db, COLLECTIONS.PROJECTS, String(projectId));
  await setDoc(projRef, updates, { merge: true });
}

export async function deleteProjectAndAssociated(
  projectId: number,
  taskIds: number[],
  columnIds: number[],
  memberIds: number[],
  sprintIds: number[]
): Promise<void> {
  const ops: Array<{ type: 'delete'; ref: any }> = [
    { type: 'delete', ref: doc(db, COLLECTIONS.PROJECTS, String(projectId)) },
  ];

  taskIds.forEach((id) => ops.push({ type: 'delete', ref: doc(db, COLLECTIONS.TASKS, String(id)) }));
  columnIds.forEach((id) => ops.push({ type: 'delete', ref: doc(db, COLLECTIONS.COLUMNS, String(id)) }));
  memberIds.forEach((id) => ops.push({ type: 'delete', ref: doc(db, COLLECTIONS.MEMBERS, String(id)) }));
  sprintIds.forEach((id) => ops.push({ type: 'delete', ref: doc(db, COLLECTIONS.SPRINTS, String(id)) }));

  await commitBatchOperations(ops);
}

// ----------------------------------------------------
// Granular Member Operations
// ----------------------------------------------------

export async function saveMember(member: ProjectMember): Promise<void> {
  const memRef = doc(db, COLLECTIONS.MEMBERS, String(member.id));
  await setDoc(memRef, member);
}

export async function updateMemberPartial(memberId: number, updates: Partial<ProjectMember>): Promise<void> {
  const memRef = doc(db, COLLECTIONS.MEMBERS, String(memberId));
  await setDoc(memRef, updates, { merge: true });
}

export async function deleteMember(memberId: number): Promise<void> {
  const memRef = doc(db, COLLECTIONS.MEMBERS, String(memberId));
  await deleteDoc(memRef);
}

// ----------------------------------------------------
// Granular Column Operations
// ----------------------------------------------------

export async function saveColumn(column: BoardColumn): Promise<void> {
  const colRef = doc(db, COLLECTIONS.COLUMNS, String(column.id));
  await setDoc(colRef, column);
}

export async function updateColumnPartial(columnId: number, updates: Partial<BoardColumn>): Promise<void> {
  const colRef = doc(db, COLLECTIONS.COLUMNS, String(columnId));
  await setDoc(colRef, updates, { merge: true });
}

export async function deleteColumn(columnId: number): Promise<void> {
  const colRef = doc(db, COLLECTIONS.COLUMNS, String(columnId));
  await deleteDoc(colRef);
}

// ----------------------------------------------------
// Granular Sprint Operations
// ----------------------------------------------------

export async function saveSprint(sprint: Sprint): Promise<void> {
  const sprintRef = doc(db, COLLECTIONS.SPRINTS, String(sprint.id));
  await setDoc(sprintRef, sprint);
}

export async function updateSprintPartial(sprintId: number, updates: Partial<Sprint>): Promise<void> {
  const sprintRef = doc(db, COLLECTIONS.SPRINTS, String(sprintId));
  await setDoc(sprintRef, updates, { merge: true });
}

// ----------------------------------------------------
// Granular Comment Operations
// ----------------------------------------------------

export async function saveComment(comment: TaskComment): Promise<void> {
  const commRef = doc(db, COLLECTIONS.COMMENTS, String(comment.id));
  await setDoc(commRef, comment);
}

export async function deleteComment(commentId: number): Promise<void> {
  const commRef = doc(db, COLLECTIONS.COMMENTS, String(commentId));
  await deleteDoc(commRef);
}

// ----------------------------------------------------
// Granular Activity Log & Attachment Operations
// ----------------------------------------------------

export async function saveActivityLog(log: ActivityLog): Promise<void> {
  const logRef = doc(db, COLLECTIONS.ACTIVITY_LOGS, String(log.id));
  await setDoc(logRef, log);
}

export async function saveAttachment(attachment: TaskAttachment): Promise<void> {
  const attRef = doc(db, COLLECTIONS.ATTACHMENTS, String(attachment.id));
  await setDoc(attRef, attachment);
}

export async function deleteAttachment(attachmentId: number): Promise<void> {
  const attRef = doc(db, COLLECTIONS.ATTACHMENTS, String(attachmentId));
  await deleteDoc(attRef);
}

// ----------------------------------------------------
// Granular User Management Operations
// ----------------------------------------------------

export async function saveUser(user: User): Promise<void> {
  const userRef = doc(db, COLLECTIONS.USERS, String(user.id));
  await setDoc(userRef, user);
}

export async function updateUserPartial(userId: number, updates: Partial<User>): Promise<void> {
  const userRef = doc(db, COLLECTIONS.USERS, String(userId));
  await setDoc(userRef, updates, { merge: true });
}

export async function deleteUserAndAssociated(
  userId: number,
  memberIds: number[],
  updatedTasks: Task[]
): Promise<void> {
  const ops: Array<{ type: 'set' | 'delete'; ref: any; data?: any }> = [
    { type: 'delete', ref: doc(db, COLLECTIONS.USERS, String(userId)) },
  ];

  memberIds.forEach((mId) => {
    ops.push({ type: 'delete', ref: doc(db, COLLECTIONS.MEMBERS, String(mId)) });
  });

  updatedTasks.forEach((t) => {
    ops.push({ type: 'set', ref: doc(db, COLLECTIONS.TASKS, String(t.id)), data: t });
  });

  await commitBatchOperations(ops);
}

// ----------------------------------------------------
// Batch Imports (e.g. CSV batch with multiple groups)
// ----------------------------------------------------

export async function batchSaveEntities({
  users = [],
  members = [],
  projects = [],
  columns = [],
}: {
  users?: User[];
  members?: ProjectMember[];
  projects?: Project[];
  columns?: BoardColumn[];
}): Promise<void> {
  const ops: Array<{ type: 'set'; ref: any; data: any }> = [];

  users.forEach((u) => ops.push({ type: 'set', ref: doc(db, COLLECTIONS.USERS, String(u.id)), data: u }));
  members.forEach((m) => ops.push({ type: 'set', ref: doc(db, COLLECTIONS.MEMBERS, String(m.id)), data: m }));
  projects.forEach((p) => ops.push({ type: 'set', ref: doc(db, COLLECTIONS.PROJECTS, String(p.id)), data: p }));
  columns.forEach((c) => ops.push({ type: 'set', ref: doc(db, COLLECTIONS.COLUMNS, String(c.id)), data: c }));

  await commitBatchOperations(ops);
}

// ----------------------------------------------------
// Full Reset (Demo Data)
// ----------------------------------------------------

export async function resetAllCollectionsToDemo(): Promise<void> {
  const collectionsToClear = [
    COLLECTIONS.USERS,
    COLLECTIONS.PROJECTS,
    COLLECTIONS.MEMBERS,
    COLLECTIONS.COLUMNS,
    COLLECTIONS.TASKS,
    COLLECTIONS.SPRINTS,
    COLLECTIONS.COMMENTS,
    COLLECTIONS.ACTIVITY_LOGS,
    COLLECTIONS.ATTACHMENTS,
  ];

  // 1. Fetch and delete existing docs in all collections
  for (const colName of collectionsToClear) {
    const snap = await getDocs(collection(db, colName));
    const deleteOps: Array<{ type: 'delete'; ref: any }> = [];
    snap.forEach((docSnap) => {
      deleteOps.push({ type: 'delete', ref: docSnap.ref });
    });
    if (deleteOps.length > 0) {
      await commitBatchOperations(deleteOps);
    }
  }

  // 2. Insert initial demo data
  const insertOps: Array<{ type: 'set'; ref: any; data: any }> = [];
  INITIAL_USERS.forEach((u) => insertOps.push({ type: 'set', ref: doc(db, COLLECTIONS.USERS, String(u.id)), data: u }));
  INITIAL_PROJECTS.forEach((p) => insertOps.push({ type: 'set', ref: doc(db, COLLECTIONS.PROJECTS, String(p.id)), data: p }));
  INITIAL_MEMBERS.forEach((m) => insertOps.push({ type: 'set', ref: doc(db, COLLECTIONS.MEMBERS, String(m.id)), data: m }));
  INITIAL_COLUMNS.forEach((c) => insertOps.push({ type: 'set', ref: doc(db, COLLECTIONS.COLUMNS, String(c.id)), data: c }));
  INITIAL_TASKS.forEach((t) => insertOps.push({ type: 'set', ref: doc(db, COLLECTIONS.TASKS, String(t.id)), data: t }));
  INITIAL_SPRINTS.forEach((s) => insertOps.push({ type: 'set', ref: doc(db, COLLECTIONS.SPRINTS, String(s.id)), data: s }));
  INITIAL_COMMENTS.forEach((c) => insertOps.push({ type: 'set', ref: doc(db, COLLECTIONS.COMMENTS, String(c.id)), data: c }));
  INITIAL_ACTIVITY.forEach((a) => insertOps.push({ type: 'set', ref: doc(db, COLLECTIONS.ACTIVITY_LOGS, String(a.id)), data: a }));

  await commitBatchOperations(insertOps);
}
