import React, { useState, useRef } from 'react';
import { useJira } from '../context/JiraContext';
import { Role, ROLE_BADGE_LABELS } from '../types/jira';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Users,
  ShieldCheck,
  FileText,
  Sparkles,
} from 'lucide-react';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedUserRow {
  id: string;
  name: string;
  username: string;
  password: string;
  email: string;
  role: Role;
  projectKey?: string;
  isValid: boolean;
  validationError?: string;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, projects, importUsersBatch, users } = useJira();
  const [activeMode, setActiveMode] = useState<'upload' | 'paste'>('upload');
  const [csvText, setCsvText] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<number>(projects[0]?.id || 1);
  const [defaultRole, setDefaultRole] = useState<Role>('frontend');
  const [parsedRows, setParsedRows] = useState<ParsedUserRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Only Project Manager (is_admin) can access
  if (!currentUser?.is_admin) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full text-center border border-slate-200 shadow-2xl">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">Acceso Restringido</h3>
          <p className="text-xs text-slate-600 mt-2">
            Solo los usuarios con rol de <strong>Project Manager (Admin)</strong> tienen permiso para importar usuarios masivamente vía CSV.
          </p>
          <button
            onClick={onClose}
            className="mt-5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold"
          >
            Entendido
          </button>
        </div>
      </div>
    );
  }

  // Parse Role String Helper
  const parseRole = (rawRole?: string): Role => {
    if (!rawRole) return defaultRole;
    const r = rawRole.toLowerCase().trim();
    if (r.includes('po') || r.includes('owner') || r.includes('docente') || r.includes('profesor') || r.includes('teacher')) {
      return 'po';
    }
    if (r.includes('back') || r.includes('api') || r.includes('server')) {
      return 'backend';
    }
    if (r.includes('front') || r.includes('ui') || r.includes('client') || r.includes('web')) {
      return 'frontend';
    }
    if (r.includes('admin') || r.includes('pm') || r.includes('manager')) {
      return 'admin';
    }
    return defaultRole;
  };

  // CSV Parsing Engine
  const parseCsvContent = (content: string) => {
    setError(null);
    setSuccessMessage(null);

    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      setError('El archivo CSV está vacío.');
      setParsedRows([]);
      return;
    }

    // Determine delimiter: comma, semicolon, or tab
    const firstLine = lines[0];
    let delimiter = ',';
    if ((firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length) {
      delimiter = ';';
    } else if ((firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length) {
      delimiter = '\t';
    }

    const splitLine = (line: string): string[] => {
      // Basic regex or split accounting for quotes
      const result: string[] = [];
      let current = '';
      let insideQuote = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          insideQuote = !insideQuote;
        } else if (char === delimiter && !insideQuote) {
          result.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      return result;
    };

    const rawHeaders = splitLine(lines[0]).map((h) => h.toLowerCase().trim());

    // Check if first line is header
    const hasHeader = rawHeaders.some((h) =>
      ['nombre', 'name', 'usuario', 'username', 'correo', 'email', 'rol', 'role', 'clave', 'password', 'pass'].includes(h)
    );

    const dataLines = hasHeader ? lines.slice(1) : lines;

    const nameIdx = hasHeader ? rawHeaders.findIndex((h) => h.includes('nom') || h.includes('name')) : 0;
    const userIdx = hasHeader ? rawHeaders.findIndex((h) => h.includes('usu') || h.includes('user') || h.includes('login')) : 1;
    const passIdx = hasHeader ? rawHeaders.findIndex((h) => h.includes('pass') || h.includes('cla') || h.includes('contra')) : 2;
    const roleIdx = hasHeader ? rawHeaders.findIndex((h) => h.includes('rol') || h.includes('role') || h.includes('tipo')) : 3;
    const emailIdx = hasHeader ? rawHeaders.findIndex((h) => h.includes('mail') || h.includes('corr')) : 4;
    const projIdx = hasHeader ? rawHeaders.findIndex((h) => h.includes('proy') || h.includes('proj')) : -1;

    const existingUsernames = new Set(users.map((u) => u.username.toLowerCase()));
    const existingEmails = new Set(users.map((u) => u.email.toLowerCase()));

    const rows: ParsedUserRow[] = [];
    const seenInCsv = new Set<string>();

    dataLines.forEach((line, index) => {
      const cols = splitLine(line);
      if (cols.length === 0 || cols.every((c) => !c)) return;

      const rawName = (nameIdx >= 0 && cols[nameIdx]) ? cols[nameIdx] : `Usuario ${index + 1}`;
      let rawUser = (userIdx >= 0 && cols[userIdx]) ? cols[userIdx] : rawName.toLowerCase().replace(/\s+/g, '_');
      rawUser = rawUser.replace(/[^a-zA-Z0-9._-]/g, '');

      const rawPass = (passIdx >= 0 && cols[passIdx]) ? cols[passIdx] : 'Clave123.';
      const rawRole = (roleIdx >= 0 && cols[roleIdx]) ? cols[roleIdx] : '';
      const parsedRole = parseRole(rawRole);

      let rawEmail = (emailIdx >= 0 && cols[emailIdx]) ? cols[emailIdx] : `${rawUser.toLowerCase()}@institucion.edu`;
      if (!rawEmail.includes('@')) {
        rawEmail = `${rawUser.toLowerCase()}@institucion.edu`;
      }

      const rawProjKey = (projIdx >= 0 && cols[projIdx]) ? cols[projIdx] : undefined;

      let isValid = true;
      let validationError = '';

      if (!rawName.trim()) {
        isValid = false;
        validationError = 'Nombre requerido';
      } else if (!rawUser.trim()) {
        isValid = false;
        validationError = 'Usuario requerido';
      } else if (existingUsernames.has(rawUser.toLowerCase())) {
        isValid = false;
        validationError = 'Usuario ya existe en el sistema';
      } else if (seenInCsv.has(rawUser.toLowerCase())) {
        isValid = false;
        validationError = 'Usuario duplicado en el CSV';
      }

      seenInCsv.add(rawUser.toLowerCase());

      rows.push({
        id: `row-${index}-${Date.now()}`,
        name: rawName,
        username: rawUser,
        password: rawPass,
        email: rawEmail,
        role: parsedRole,
        projectKey: rawProjKey,
        isValid,
        validationError,
      });
    });

    setParsedRows(rows);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvText(content);
      parseCsvContent(content);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handlePasteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setCsvText(text);
    if (text.trim()) {
      parseCsvContent(text);
    } else {
      setParsedRows([]);
    }
  };

  const handleRemoveRow = (rowId: string) => {
    setParsedRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  const handleRoleChangeForRow = (rowId: string, newRole: Role) => {
    setParsedRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, role: newRole } : r))
    );
  };

  const handleExecuteImport = () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setError('No hay filas válidas para importar. Revisa los errores en la tabla.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    const payload = validRows.map((r) => {
      // Resolve project if projectKey was specified
      let matchedProjId = selectedProjectId;
      if (r.projectKey) {
        const found = projects.find((p) => p.key.toLowerCase() === r.projectKey?.toLowerCase());
        if (found) matchedProjId = found.id;
      }

      return {
        name: r.name,
        username: r.username,
        password: r.password,
        email: r.email,
        role: r.role,
        projectId: matchedProjId,
      };
    });

    const res = importUsersBatch(payload, selectedProjectId);

    setIsProcessing(false);
    if (res.success) {
      setSuccessMessage(`¡Se han importado exitosamente ${res.count} usuarios al sistema y sus respectivos proyectos!`);
      setParsedRows([]);
      setCsvText('');
      setFileName(null);
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1500);
    } else {
      setError(res.error || 'Error durante la importación');
    }
  };

  // Download Sample Template CSV
  const handleDownloadTemplate = () => {
    const sampleCsv = `Nombre,Usuario,Contrasena,Rol,Correo,Proyecto
Docente Evaluador,docente_maria,Docente2026..,Product Owner,maria.docente@institucion.edu,PRO
Carlos Mendez,carlos_mendez,Dev2026..,Frontend,carlos.m@institucion.edu,PRO
Valentina Rios,valentina_rios,Dev2026..,Frontend,valentina.r@institucion.edu,PRO
Andres Gomez,andres_gomez,Dev2026..,Backend,andres.g@institucion.edu,PRO
Santiago Herrera,santiago_herrera,Dev2026..,Backend,santiago.h@institucion.edu,PRO`;

    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'plantilla_usuarios_scrum.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.length - validCount;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/25">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Importación Masiva de Usuarios vía CSV
                </h2>
                <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-amber-600" />
                  Exclusivo Project Manager
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Carga estudiantes y docentes asignándoles roles: <strong>Backend</strong>, <strong>Frontend</strong> o <strong>Product Owner (Docente)</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 rounded-xl text-xs font-semibold transition-all shadow-2xs hover:bg-slate-50"
              title="Descargar plantilla de ejemplo con roles Frontend, Backend y PO"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>Plantilla CSV</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 font-medium shadow-2xs">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Mode Switch & General Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Input Mode Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveMode('upload')}
                className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeMode === 'upload'
                    ? 'bg-white text-indigo-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                Subir Archivo
              </button>
              <button
                type="button"
                onClick={() => setActiveMode('paste')}
                className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeMode === 'paste'
                    ? 'bg-white text-indigo-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Pegar CSV
              </button>
            </div>

            {/* Default Project */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Proyecto de Destino
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-2xs"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.key})
                  </option>
                ))}
              </select>
            </div>

            {/* Fallback Role */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Rol por Defecto (si falta en CSV)
              </label>
              <select
                value={defaultRole}
                onChange={(e) => setDefaultRole(e.target.value as Role)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-2xs"
              >
                <option value="frontend">Frontend Developer</option>
                <option value="backend">Backend Developer</option>
                <option value="po">Product Owner (Docente)</option>
                <option value="admin">Project Manager (Admin)</option>
              </select>
            </div>
          </div>

          {/* Upload Area or Text Area */}
          {activeMode === 'upload' ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer bg-slate-50/60 hover:bg-indigo-50/20 transition-all group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .txt, .tsv, text/csv, text/plain"
                onChange={handleFileUpload}
                className="hidden"
              />
              <UploadCloud className="w-10 h-10 text-indigo-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-bold text-slate-800">
                {fileName ? `Archivo seleccionado: ${fileName}` : 'Haz clic para seleccionar o arrastra tu archivo CSV'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Formatos compatibles: .csv, .txt delimitado por comas, punto y coma o tabulaciones.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Pega aquí el contenido de tu tabla o archivo CSV:
              </label>
              <textarea
                value={csvText}
                onChange={handlePasteChange}
                placeholder="Nombre,Usuario,Contrasena,Rol,Correo&#10;Docente Evaluador,docente_maria,Docente2026..,Product Owner,maria@institucion.edu&#10;Carlos Mendez,carlos_m,Clave123.,Frontend,carlos@institucion.edu&#10;Valentina Rios,valentina_r,Clave123.,Backend,valentina@institucion.edu"
                rows={5}
                className="w-full p-3 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50/50 shadow-2xs leading-relaxed"
              />
            </div>
          )}

          {/* Parsed Rows Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Vista Previa de Usuarios ({parsedRows.length})
                  </h3>
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] px-2 py-0.5 rounded-md font-semibold">
                    {validCount} Válidos
                  </span>
                  {invalidCount > 0 && (
                    <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[11px] px-2 py-0.5 rounded-md font-semibold">
                      {invalidCount} Con Errores
                    </span>
                  )}
                </div>

                <span className="text-[11px] text-slate-400">
                  Puedes ajustar el rol directamente en cada fila antes de importar.
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="px-3.5 py-2.5">Estado</th>
                      <th className="px-3.5 py-2.5">Nombre</th>
                      <th className="px-3.5 py-2.5">Usuario</th>
                      <th className="px-3.5 py-2.5">Contraseña</th>
                      <th className="px-3.5 py-2.5">Rol Asignado</th>
                      <th className="px-3.5 py-2.5">Correo</th>
                      <th className="px-3.5 py-2.5 text-right">Quitar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {parsedRows.map((row) => (
                      <tr
                        key={row.id}
                        className={`transition-colors ${row.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/40 hover:bg-rose-50/70'}`}
                      >
                        <td className="px-3.5 py-2">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Listo
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-rose-600 font-semibold text-[11px]"
                              title={row.validationError}
                            >
                              <AlertCircle className="w-3.5 h-3.5" />
                              {row.validationError}
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-2 font-semibold text-slate-900">{row.name}</td>
                        <td className="px-3.5 py-2 font-mono text-slate-600">{row.username}</td>
                        <td className="px-3.5 py-2 font-mono text-slate-400">••••••••</td>
                        <td className="px-3.5 py-2">
                          <select
                            value={row.role}
                            onChange={(e) => handleRoleChangeForRow(row.id, e.target.value as Role)}
                            className="px-2 py-0.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                          >
                            <option value="frontend">Frontend Developer</option>
                            <option value="backend">Backend Developer</option>
                            <option value="po">Product Owner (Docente)</option>
                            <option value="admin">Project Manager (Admin)</option>
                          </select>
                        </td>
                        <td className="px-3.5 py-2 text-slate-500">{row.email}</td>
                        <td className="px-3.5 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>Los usuarios importados podrán iniciar sesión inmediatamente con su usuario y clave.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={validCount === 0 || isProcessing}
              onClick={handleExecuteImport}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-sm shadow-indigo-500/25 flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              <span>
                {isProcessing
                  ? 'Importando...'
                  : validCount > 0
                  ? `Importar ${validCount} Usuarios`
                  : 'Importar Usuarios'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
