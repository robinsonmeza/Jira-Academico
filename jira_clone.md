# Jira Board Clone - Documentación Técnica y Funcional

> **Versión**: 2.6.0  
> **Estado**: Producción / Desplegado en Vercel & Firebase Cloud Firestore  
> **Autor Principal / Project Manager**: Robinson Meza (`RobinsonAmeza@gmail.com`)  
> **Arquitectura**: React 18 + Vite + TypeScript + Tailwind CSS + Google Cloud Firestore (Firebase)

---

## 1. Visión General del Proyecto

**Jira Board Clone** es una plataforma web colaborativa y multiusuario diseñada para la gestión ágil de proyectos de software académico y profesional. Permite planificar Sprints, gestionar Backlogs, administrar tableros Kanban interactivos, registrar métricas y controlar el acceso de usuarios mediante un modelo robusto de control de acceso basado en roles (**RBAC**).

---

## 2. Novedades y Actualizaciones Recientes (v2.6.0)

1. **Asignación de Múltiples Responsables por Tarea (Multi-Assignee)**:
   - Soporte para asignar uno o más usuarios a una misma tarea (`assignee_ids: number[]`).
   - Selector intuitivo con buscador de usuarios por nombre, username y rol, selección rápida ("Asignarme a mí", "Todos", "Ninguno").
   - Pila de avatares superpuestos en las tarjetas del tablero Kanban y en la vista de Backlog con contador `+N`.
   - Compatibilidad total hacia atrás con el campo histórico `assignee_id`.
   - Permisos actualizados: Cualquier usuario asignado a la tarea tiene permiso para editar su contenido y estado.
   - Registro de auditoría detallado en el historial de actividades de la tarea cuando se modifican los asignados.

2. **Persistencia en la Nube con Google Cloud Firestore (Firebase)**:
   - Sincronización en tiempo real (`onSnapshot`) entre múltiples navegadores, dispositivos y usuarios concurrentes.
   - Guardado continuo de tareas, sprints, proyectos, usuarios, columnas, comentarios y registros de actividad.
   - Soporte offline con respaldo local en `localStorage`.
   - Indicador de estado en vivo en la barra superior (**Cloud Activo** / **Guardando...** / **Offline**).

3. **Acceso Seguro y Flujo de Entrada (Landing / Login)**:
   - Los usuarios aterrizan de forma obligatoria en la pantalla de **Inicio de Sesión**.
   - **Administración Centralizada**: Se descartó el autoregistro público. Solo el Project Manager (Admin) puede crear o importar cuentas de usuario.
   - **Eliminación de Accesos Rápidos de 1 Clic**: Se eliminaron los botones de cambio rápido de usuario que exponían la cuenta del administrador.

4. **Módulo de Administración y Creación de Usuarios**:
   - Creación individual con credenciales personalizadas, asignación de proyectos y rol.
   - **Importación Masiva vía CSV**: Carga por lotes de estudiantes o desarrolladores asignándoles usuario, contraseña, correo, rol y proyecto inicial.
   - Edición y eliminación de usuarios con protección para evitar borrar al único administrador.

---

## 3. Matriz de Roles y Permisos (RBAC)

La plataforma cuenta con 4 roles definidos:

| Rol | Identificador | Alcance de Proyectos | Permisos Principales |
| :--- | :--- | :--- | :--- |
| **Project Manager (Admin)** | `admin` | **Global (Todos los proyectos)** | Control total: Crear/editar/eliminar proyectos, administrar usuarios, importar CSV, gestionar columnas, sprints y cualquier tarea. |
| **Product Owner (Docente / Evaluador)** | `po` | **Global (Todos los proyectos)** | Supervisión y gestión de sprints, creación y priorización de historias/tareas, estimación de puntos de historia. No puede importar CSV de usuarios. |
| **Frontend Developer** | `frontend` | **Solo Proyectos Asignados** | Crear tareas de tipo UI/Frontend, mover tarjetas en el tablero, comentar y adjuntar archivos en sus tareas asignadas. |
| **Backend Developer** | `backend` | **Solo Proyectos Asignados** | Crear tareas de tipo Backend/API/DB, mover tarjetas en el tablero, comentar y adjuntar archivos en sus tareas asignadas. |

---

## 4. Estructura de Archivos del Proyecto

```text
├── firebase-applet-config.json     # Configuración de credenciales de Firebase
├── firebase-blueprint.json         # Esquema de entidades de Firestore
├── firestore.rules                 # Reglas de seguridad de Firestore
├── index.html                      # Punto de entrada HTML
├── package.json                    # Dependencias del proyecto
├── src/
│   ├── App.tsx                     # Enrutador principal y vistas
│   ├── main.tsx                    # Bootstrap de React
│   ├── index.css                   # Estilos globales y utilidades Tailwind
│   ├── types/
│   │   └── jira.ts                 # Interfaces TypeScript, Roles y Permisos
│   ├── lib/
│   │   └── firebase.ts             # Inicialización del cliente Firestore
│   ├── data/
│   │   └── seedData.ts             # Datos semilla iniciales del sistema
│   ├── context/
│   │   └── JiraContext.tsx         # Estado global y sincronización con Firestore
│   └── components/
│       ├── Navbar.tsx              # Barra superior, selector de proyecto y perfil
│       ├── LoginView.tsx           # Pantalla de inicio de sesión segura
│       ├── KanbanBoard.tsx         # Tablero Kanban interactivo con Drag & Drop
│       ├── BacklogView.tsx         # Gestión de Backlog y planificación de Sprints
│       ├── SprintsView.tsx         # Control de Sprints activos y completados
│       ├── MembersView.tsx         # Gestión de miembros por proyecto
│       ├── MetricsView.tsx         # Gráficas de rendimiento y velocidad
│       ├── TaskModal.tsx           # Detalle, edición, comentarios y adjuntos
│       ├── CreateTaskModal.tsx     # Creación de nuevas tareas
│       ├── ManageUsersModal.tsx    # Gestión de usuarios e importación CSV
│       └── CreateProjectModal.tsx  # Creación de nuevos proyectos
```

---

## 5. Modelo de Datos (Firestore Schema)

El documento principal se almacena en la colección `app_state` bajo el identificador `main`:

```typescript
interface AppStateDocument {
  id: "main";
  users: User[];
  projects: Project[];
  members: ProjectMember[];
  columns: BoardColumn[];
  tasks: Task[];
  sprints: Sprint[];
  comments: TaskComment[];
  activityLogs: ActivityLog[];
  attachments: TaskAttachment[];
  updatedAt: string; // ISO Date
  updatedBy: string;
}
```

---

## 6. Variables de Entorno y Despliegue

### Despliegue en Vercel
1. El proyecto cuenta con el archivo `vercel.json` configurado para SPA:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```
2. Comando de compilación: `npm run build`
3. Directorio de salida: `dist`

### Despliegue en GitHub
Para sincronizar las ramas y disparar el despliegue continuo:
```bash
git add .
git commit -m "feat: Sincronización Firestore en tiempo real y Login seguro"
git push origin main
```

---

## 7. Próximos Pasos Sugeridos
- [ ] Exportación de reportes de Sprint en formato PDF / Excel.
- [ ] Notificaciones en tiempo real al ser mencionado en comentarios de tareas.
- [ ] Asignación de múltiples responsables por tarea.
