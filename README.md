# Jira Board Clone - Documentación Técnica y Funcional

> **Versión**: 3.1.0  
> **Estado**: Producción / Desplegado en Vercel & Firebase Cloud Firestore  
> **Autor Principal / Project Manager**: Robinson Meza (`RobinsonAmeza@gmail.com`)  
> **Arquitectura**: Full-stack (React 18 + Vite + Express Backend + Google GenAI SDK + Cloud Firestore)

---

## 1. Visión General del Proyecto

**Jira Board Clone** es una plataforma web colaborativa y multiusuario diseñada para la gestión ágil de proyectos de software académico y profesional. Permite planificar Sprints, gestionar Backlogs, administrar tableros Kanban interactivos, registrar métricas y controlar el acceso de usuarios mediante un modelo robusto de control de acceso basado en roles (**RBAC**).

A partir de la versión **v3.1.0**, la plataforma integra **ScrumBot (Tutor Pedagógico con IA Gemini)** para orientar a los estudiantes en la redacción de Historias de Usuario, criterios de aceptación (INVEST/BDD) y conceptos ágiles, reduciendo drásticamente la carga de consultas recurrentes del docente.

---

## 2. Tutor Académico Virtual con IA (ScrumBot) - v3.1.0

### 2.1 Propósito Pedagógico
En talleres universitarios y cursos de Ingeniería de Software, los estudiantes suelen presentar dudas recurrentes respecto a cómo estructurar historias de usuario, cómo estimar Story Points o cuáles son las responsabilidades según su rol asignado en el proyecto. 

Para **disminuir la carga del docente y empoderar al estudiante**, se incorporó un chatbot pedagógico en tiempo real con IA (`gemini-3.8-flash`) accesible mediante un botón flotante permanente y contextualizado por proyecto:

1. **Guía para Documentar Historias de Usuario (HU)**:
   - Enseñanza del estándar canónico:
     > *"Como [rol], quiero [funcionalidad] para [beneficio]"*.
   - Redacción de Criterios de Aceptación con enfoque **BDD / Given-When-Then** (*Dado que... Cuando... Entonces...*).
   - Principios de calidad **INVEST** (Independiente, Negociable, Valiosa, Estimable, Small, Testeable).
2. **Definiciones y Roles del Equipo**:
   - Explicación de responsabilidades de **Product Owner**, **Frontend**, **Backend** y **Project Manager**.
   - Definición de Sprint, Product Backlog, Definition of Done (DoD) y Story Points (serie Fibonacci 1, 2, 3, 5, 8).
3. **Consciencia del Contexto del Proyecto**:
   - El bot recibe el nombre del proyecto activo, su clave (`key`), descripción, sprint activo y flujo de columnas del tablero, adaptando sus respuestas a la realidad de cada equipo.
4. **Inserción Rápida de Plantillas**:
   - En el modal de creación y edición de tareas, se incluyó el botón **"Insertar Plantilla HU"** para poblar al instante la estructura requerida.
5. **Chips de Preguntas Frecuentes**:
   - Acceso en un clic a guías preparadas (BDD, roles, estimación en Fibonacci y contexto del proyecto).

### 2.2 Blindaje Académico (Guardrails Estrictos) y Resiliencia en Servidor (v3.2.0)
Para proteger el propósito educativo de la plataforma y evitar desvíos o costos imprevistos:
- **Blindaje Anti-Desvío de Tema (Strict Guardrails)**:
  - Instrucción de sistema estricta en `server.ts` que rechaza automáticamente cualquier solicitud que no pertenezca a Metodologías Ágiles (Scrum/Kanban) o Ingeniería de Software (ej. redacción de poemas, tareas de otras materias, juegos, etc.).
  - Respuesta estandarizada y cortés: *"Como tutor pedagógico de Scrum y Jira para tu proyecto académico, solo puedo orientarte en temas de metodologías ágiles, historias de usuario, roles de equipo y tareas de este tablero. ¿En qué funcionalidad o historia de tu Sprint podemos avanzar hoy?"*
  - **Protección Anti-Jailbreak / Prompt Injection**: Ignora intentos de "modo DAN", olvido de instrucciones o suplantación de identidad.
  - **Enfoque Pedagógico**: Orienta con contratos de API, escenarios BDD y criterios técnicos, sin hacerle la tarea completa de codificación al estudiante para preservar el aprendizaje.

### 2.3 Integración de IA Multimodelo (Opción 1 y Opción 2)
1. **Opción 1 - Alta Disponibilidad y Resiliencia (Fallback Cascade)**:
   - Cascada multinivel en servidor para soportar picos transitorios: `gemini-3.5-flash` (alta estabilidad) -> `gemini-flash-latest` -> `gemini-3.8-flash` -> `NVIDIA NIM Llama 3.3 70B`.
2. **Opción 2 - Auditoría Técnica y Pedagógica de Calidad (QA Tool)**:
   - Pestaña interactiva **"Auditoría QA (NVIDIA AI)"** en el modal de tareas (`TaskModal.tsx`).
   - Endpoint `/api/ai/audit-task` que analiza la tarea seleccionada y emite un dictamen académico exhaustivo:
     - Cumplimiento del formato "Como / Quiero / Para".
     - Evaluación de criterios INVEST y BDD (*Dado / Cuando / Entonces*).
     - Validación técnica (Frontend, Backend, Seguridad, Manejo de errores y UX).
     - Dictamen del estado: `✅ LISTA PARA SPRINT`, `⚠️ REQUIERE REFINAMIENTO` o `❌ INCOMPLETA`.
     - Sugerencia redactada de mejora con escenarios de prueba completos.

### 2.4 Pruebas Automatizadas de Funcionalidad del Chatbot y Auditoría (Verificadas)
- **Prueba 1 (Consulta teórica e INVEST)**: Respuesta clara y en 2 líneas del principio INVEST (`HTTP 200 OK`).
- **Prueba 2 (Blindaje ante temas ajenos - Poema)**: Rechazo exitoso de prompt de poesía con la respuesta de guardrail académica.
- **Prueba 3 (Auditoría Técnica de Tarea - Login con Google)**: Reporte exhaustivo con diagnóstico BDD, preguntas de seguridad y sugerencia técnica de redacción emitido correctamente (`HTTP 200 OK`).
- **Prueba 4 (Inserción de plantilla en UI)**: Botón *Insertar Plantilla HU* y pestaña *Auditoría QA* plenamente integrados en `TaskModal.tsx`.

---

## 3. Novedades y Arquitectura de Concurrencia v3.0.0 (Solución de Concurrencia Multi-Estudiante)

### 2.1 Diagnóstico de la Problemática Anterior (v2.5.0)
En versiones previas, todo el estado de la aplicación se guardaba en un único documento monolítico (`app_state/main`). Cuando dos o más estudiantes trabajaban en el mismo proyecto al mismo tiempo (por ejemplo, el Estudiante A movía una tarea mientras el Estudiante B creaba o editaba otra), la operación `setDoc` de uno sobreescribía todo el documento, borrando los cambios del compañero (condición de carrera o *last-write-wins*).

### 2.2 Arquitectura Granular de Colecciones (Opción A Implementada)
Para resolver de forma definitiva este problema y permitir alta concurrencia:

1. **Colecciones Granulares en Firestore**:
   - Cada entidad ahora reside en su propia colección independiente:
     - `tasks/{taskId}`: Cada tarea se crea, actualiza o mueve como un documento atómico.
     - `projects/{projectId}`: Proyectos de trabajo.
     - `members/{memberId}`: Membresías y roles por proyecto.
     - `columns/{columnId}`: Columnas del tablero Kanban/Scrum.
     - `sprints/{sprintId}`: Sprints planificados, activos y completados.
     - `comments/{commentId}`: Comentarios individuales en tareas.
     - `activity_logs/{logId}`: Registro de auditoría y movimientos.
     - `users/{userId}`: Cuentas y credenciales de usuario.
     - `attachments/{attachmentId}`: Archivos adjuntos en tareas.

2. **Cero Conflictos entre Estudiantes**:
   - Si el Estudiante 1 edita la descripción de la tarea `PRJ-4` y el Estudiante 2 mueve la tarea `PRJ-8` a *In Progress*, Firestore actualiza exclusivamente el documento `tasks/PRJ-4` y `tasks/PRJ-8` respectivamente. **Ningún cambio se pisa ni se elimina**.

3. **Migración Automática e Inicialización Transparente**:
   - El servicio `firestoreService.ts` inspecciona si las nuevas colecciones ya cuentan con datos. Si no, migra automáticamente los datos existentes desde el documento legacy `app_state/main` o desde las semillas iniciales sin perder ningún proyecto o tarea.

4. **Reactividad Inmediata + Sincronización en Tiempo Real**:
   - Los componentes reaccionan instantáneamente gracias al estado local reactivo y suscripciones individuales `onSnapshot` por colección.

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
├── firebase-blueprint.json         # Esquema de entidades granulares de Firestore
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
│   │   ├── firebase.ts             # Inicialización de la instancia Firestore
│   │   └── firestoreService.ts     # CRUD granular, batch operations y migración atómica
│   ├── data/
│   │   └── seedData.ts             # Datos semilla iniciales del sistema
│   ├── context/
│   │   └── JiraContext.tsx         # Estado global y suscripciones en tiempo real
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

## 5. Modelo de Datos Granular (Firestore Collections)

A partir de la versión 3.0.0, Firestore utiliza colecciones independientes:

- `tasks`: Documentos identificados por `taskId` con propiedades (`title`, `status`, `column_id`, `assignee_ids`, etc.).
- `projects`: Documentos identificados por `projectId`.
- `columns`: Documentos identificados por `columnId`.
- `members`: Documentos identificados por `memberId`.
- `sprints`: Documentos identificados por `sprintId`.
- `comments`: Documentos identificados por `commentId`.
- `activity_logs`: Documentos identificados por `logId`.
- `users`: Documentos identificados por `userId`.
- `attachments`: Documentos identificados por `attachmentId`.

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
git commit -m "feat: Arquitectura granular de colecciones Firestore para soporte multiusuario"
git push origin main
```

---

## 7. Próximos Pasos Sugeridos
- [ ] Exportación de reportes de Sprint en formato PDF / Excel.
- [ ] Notificaciones en tiempo real al ser mencionado en comentarios de tareas.
- [ ] Filtros avanzados por etiquetas y múltiples responsables.
