import React, { useState } from 'react';
import { JiraProvider, useJira } from './context/JiraContext';
import { Navbar } from './components/Navbar';
import { LoginView } from './components/LoginView';
import { ProjectsView } from './components/ProjectsView';
import { BoardView } from './components/BoardView';
import {
  HelpCircle,
  X,
  Server,
  Terminal,
  ShieldCheck,
  CheckCircle2,
  FileSpreadsheet,
  GraduationCap,
  Code2,
} from 'lucide-react';

const JiraAppContent: React.FC = () => {
  const { currentUser, currentProject, selectProject } = useJira();
  const [currentView, setCurrentView] = useState<'projects' | 'board'>('board');
  const [showDocsModal, setShowDocsModal] = useState(false);

  if (!currentUser) {
    return <LoginView />;
  }

  const handleOpenBoard = (projectId: number) => {
    selectProject(projectId);
    setCurrentView('board');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Navbar currentView={currentView} setCurrentView={setCurrentView} />

      <main className="flex-1">
        {currentView === 'projects' || !currentProject ? (
          <ProjectsView onOpenBoard={handleOpenBoard} />
        ) : (
          <BoardView onBackToProjects={() => setCurrentView('projects')} />
        )}
      </main>

      {/* Footer Floating Guide Button */}
      <div className="fixed bottom-4 right-4 z-30">
        <button
          onClick={() => setShowDocsModal(true)}
          className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-full text-xs font-semibold shadow-lg hover:shadow-xl border border-slate-700 flex items-center gap-2 transition-all group"
        >
          <HelpCircle className="w-4 h-4 text-indigo-400 group-hover:rotate-12 transition-transform" />
          <span>Diagnóstico & Roles</span>
        </button>
      </div>

      {/* Deployment and Roles Guide Modal */}
      {showDocsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Estructura de Roles & Importación Masiva
                  </h2>
                  <p className="text-xs text-slate-500">
                    Sistema de permisos adaptado: Backend, Frontend, Product Owner y Project Manager
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDocsModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700">
              {/* Status Banner */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-emerald-900 text-xs uppercase tracking-wider">
                    Sistema Configurado y Listo para CSV
                  </h3>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Se han eliminado los usuarios de prueba genéricos. Puedes importar tu archivo CSV directamente desde la cuenta de <strong>Project Manager</strong>.
                  </p>
                </div>
              </div>

              {/* Roles Matrix */}
              <div className="space-y-2">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-500" />
                  1. Matriz de Roles y Alcance
                </h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                      <tr>
                        <th className="p-2.5">Rol</th>
                        <th className="p-2.5">Alcance de Proyectos</th>
                        <th className="p-2.5">Permisos de Edición</th>
                        <th className="p-2.5">Importar CSV</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="bg-amber-50/40">
                        <td className="p-2.5 font-bold flex items-center gap-1.5 text-amber-900">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                          Project Manager (Admin)
                        </td>
                        <td className="p-2.5">Todos los proyectos</td>
                        <td className="p-2.5">Total (crear, editar, borrar)</td>
                        <td className="p-2.5 text-emerald-600 font-bold">Habilitado</td>
                      </tr>
                      <tr className="bg-indigo-50/30">
                        <td className="p-2.5 font-bold flex items-center gap-1.5 text-indigo-900">
                          <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                          Product Owner (Docente)
                        </td>
                        <td className="p-2.5">Todos los proyectos (Global)</td>
                        <td className="p-2.5">Edición completa de proyectos y tableros</td>
                        <td className="p-2.5 text-slate-400">No</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold flex items-center gap-1.5 text-sky-900">
                          <Code2 className="w-3.5 h-3.5 text-sky-600" />
                          Frontend Developer
                        </td>
                        <td className="p-2.5">Solo proyectos asignados</td>
                        <td className="p-2.5">Crear, mover tareas, adjuntos, comentarios</td>
                        <td className="p-2.5 text-slate-400">No</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold flex items-center gap-1.5 text-emerald-900">
                          <Server className="w-3.5 h-3.5 text-emerald-600" />
                          Backend Developer
                        </td>
                        <td className="p-2.5">Solo proyectos asignados</td>
                        <td className="p-2.5">Crear, mover tareas, adjuntos, comentarios</td>
                        <td className="p-2.5 text-slate-400">No</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CSV Import Instructions */}
              <div className="space-y-2">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  2. Cómo Importar tu archivo CSV de Usuarios
                </h3>
                <div className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-xs space-y-2 overflow-x-auto">
                  <div className="text-slate-400 font-sans">
                    Formato de columnas soportado (con o sin encabezados):
                  </div>
                  <div className="text-emerald-400 bg-slate-950 p-2.5 rounded-lg">
                    Nombre,Usuario,Contrasena,Rol,Correo,Proyecto
                    <br />
                    Docente Evaluador,docente_maria,Docente2026..,Product Owner,maria@institucion.edu,PRO
                    <br />
                    Carlos Perez,carlos_perez,Clave123.,Frontend,carlos@institucion.edu,PRO
                    <br />
                    Valentina Gomez,valentina_gomez,Clave123.,Backend,valentina@institucion.edu,PRO
                  </div>
                  <div className="text-slate-400 font-sans text-[11px] pt-1">
                    * El botón <strong>"Importar CSV"</strong> está visible en la esquina superior de la vista de Proyectos al iniciar sesión como <strong>Robinson Meza (Project Manager)</strong>.
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowDocsModal(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <JiraProvider>
      <JiraAppContent />
    </JiraProvider>
  );
}
