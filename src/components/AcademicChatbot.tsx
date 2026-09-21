import React, { useState, useRef, useEffect } from 'react';
import { useJira } from '../context/JiraContext';
import {
  Bot,
  X,
  Send,
  Sparkles,
  BookOpen,
  HelpCircle,
  Minimize2,
  Maximize2,
  RefreshCw,
  Lightbulb,
  FileText,
  UserCheck,
  CheckCircle2,
  ArrowRight,
  GraduationCap,
  Copy,
  Check,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface QuickPrompt {
  label: string;
  prompt: string;
  category: 'guide' | 'definition' | 'context';
}

const QUICK_PROMPTS: QuickPrompt[] = [
  {
    label: '¿Cómo redactar una Historia de Usuario?',
    prompt: '¿Cuál es la estructura recomendada para redactar una buena Historia de Usuario (formato Como/Quiero/Para) y criterios de aceptación con INVEST?',
    category: 'guide',
  },
  {
    label: 'Plantilla de Criterios de Aceptación',
    prompt: 'Dame ejemplos de criterios de aceptación usando el formato BDD (Dado que / Cuando / Entonces) y lista de verificación.',
    category: 'guide',
  },
  {
    label: 'Roles en el equipo (PO, Frontend, Backend)',
    prompt: 'Explícame las responsabilidades de los roles del equipo en este proyecto: Product Owner, Frontend Developer, Backend Developer y Project Manager.',
    category: 'definition',
  },
  {
    label: '¿Qué son Story Points y cómo estimar?',
    prompt: '¿Qué son los Story Points, por qué usamos la serie Fibonacci (1, 2, 3, 5, 8) y cómo debemos estimar una tarea sin asociarla a horas exactas?',
    category: 'definition',
  },
  {
    label: 'Contexto de nuestro proyecto actual',
    prompt: 'Resume el contexto de nuestro proyecto actual, su objetivo y cómo deberíamos organizar las historias en las columnas del tablero.',
    category: 'context',
  },
];

export const AcademicChatbot: React.FC = () => {
  const { currentProject, columns, sprints, currentUser } = useJira();

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);

  // Active sprint context
  const activeSprint = sprints.find(
    (s) => s.project_id === currentProject?.id && s.status === 'active'
  );

  const initialGreeting: ChatMessage = {
    id: 'msg-welcome',
    role: 'assistant',
    content: `👋 **¡Hola ${currentUser?.name || 'estudiante'}!** Soy **ScrumBot**, tu tutor académico virtual de Metodologías Ágiles y Jira.

Estoy aquí para apoyarte en:
- 📝 **Estructurar y redactar Historias de Usuario (HU)** con formato *INVEST* y criterios de aceptación.
- 💡 **Aclarar conceptos de Scrum**: Sprints, Story Points, Definition of Done, Backlog.
- 👥 **Definir roles**: Product Owner, Frontend, Backend y Project Manager.
- 🎯 **Contextualizar tareas** para tu proyecto actual: **${currentProject?.name || 'General'}** (${currentProject?.key || 'PRJ'}).

Puedes hacerme cualquier pregunta o seleccionar una de las sugerencias rápidas abajo. ¡Disminuyamos dudas y avancemos con tu sprint!`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };

  const [messages, setMessages] = useState<ChatMessage[]>([initialGreeting]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Build project contextual payload
      const projectContext = currentProject
        ? {
            name: currentProject.name,
            key: currentProject.key,
            description: currentProject.description,
            currentSprint: activeSprint ? { name: activeSprint.name, status: activeSprint.status } : null,
            columns: columns.filter((c) => c.project_id === currentProject.id).map((c) => ({ name: c.name })),
          }
        : null;

      // Filter out greeting and previous error notices so Gemini only receives clean conversational turns
      const payloadMessages = updatedHistory
        .filter((m) => m.id !== 'msg-welcome' && !m.id.endsWith('-err') && m.content.trim().length > 0)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      // Transparent 1-time auto-retry on transient failure
      let responseData: any = null;
      let lastErrMessage = '';

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: payloadMessages,
              projectContext,
            }),
          });

          if (res.ok) {
            responseData = await res.json();
            break;
          } else {
            const errData = await res.json().catch(() => ({}));
            lastErrMessage = errData.error || `Error en servidor: ${res.status}`;
          }
        } catch (fetchErr: any) {
          lastErrMessage = fetchErr?.message || 'Error de conexión de red';
        }

        if (attempt === 0) {
          // Wait 1 second before silent second attempt
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      if (!responseData) {
        throw new Error(lastErrMessage || 'No fue posible obtener una respuesta');
      }

      const botMsg: ChatMessage = {
        id: `msg-${Date.now()}-bot`,
        role: 'assistant',
        content: responseData.reply || 'No fue posible obtener una respuesta.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
      setLastFailedPrompt(null);
    } catch (err: any) {
      console.error('Error in chat:', err);
      setLastFailedPrompt(text);
      let userFriendlyNotice = 'Hubo una intermitencia momentánea en los servidores de IA.';
      const rawMsg = err.message || '';
      if (rawMsg.includes('503') || rawMsg.includes('high demand') || rawMsg.includes('UNAVAILABLE')) {
        userFriendlyNotice = 'El servicio de IA experimentó un pico de alta demanda momentáneo en Google Cloud.';
      } else if (rawMsg.includes('429')) {
        userFriendlyNotice = 'Límite de solicitudes alcanzado momentáneamente. Por favor reintenta en unos segundos.';
      }

      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: `⚠️ **Aviso del Asistente**: ${userFriendlyNotice} \n\nPuedes volver a enviar tu consulta pulsando el botón **Reintentar consulta** aquí abajo o seleccionando una de las sugerencias.\n\n*Recuerda que una Historia de Usuario estándar sigue:* \n> "Como [rol], quiero [acción] para [beneficio]".`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResetChat = () => {
    setMessages([initialGreeting]);
  };

  return (
    <>
      {/* Floating Launcher Trigger */}
      {!isOpen && (
        <div className="fixed bottom-5 right-5 z-40 flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-full text-xs font-medium shadow-md border border-slate-700 animate-in fade-in slide-in-from-right-4 duration-300">
            <GraduationCap className="w-4 h-4 text-indigo-400" />
            <span>Tutor Scrum & Historias de Usuario</span>
          </div>

          <button
            onClick={() => setIsOpen(true)}
            className="relative bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white p-3.5 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-200 flex items-center justify-center border-2 border-indigo-400/40 focus:outline-hidden focus:ring-4 focus:ring-indigo-500/30 group"
            aria-label="Abrir Asistente Scrum y Guía de Historias"
            title="Abrir Asistente Scrum y Guía de Historias de Usuario"
          >
            <Bot className="w-6 h-6 group-hover:rotate-6 transition-transform" />
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-slate-900" />
            </span>
          </button>
        </div>
      )}

      {/* Main Chat Window */}
      {isOpen && (
        <div
          className={`fixed z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden transition-all duration-200 animate-in fade-in zoom-in-95 ${
            isExpanded
              ? 'inset-4 sm:inset-10'
              : 'bottom-5 right-5 w-[94vw] sm:w-[460px] h-[640px] max-h-[85vh]'
          }`}
        >
          {/* Header */}
          <div className="bg-slate-900 px-4 py-3.5 border-b border-slate-800 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white tracking-tight">ScrumBot Tutor</h3>
                  <span className="bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-[10px] font-semibold px-1.5 py-0.2 rounded-sm">
                    IA Académica
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  <span>Guía de Historias de Usuario & Definiciones</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-400">
              <button
                onClick={handleResetChat}
                className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-slate-200 transition-colors"
                title="Reiniciar conversación"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-slate-200 transition-colors"
                title={isExpanded ? 'Contraer' : 'Expandir ventana'}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
                title="Cerrar chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Project Context Badge Strip */}
          {currentProject && (
            <div className="bg-indigo-50/70 border-b border-indigo-100/80 px-4 py-1.5 flex items-center justify-between text-xs text-indigo-900 shrink-0">
              <div className="flex items-center gap-1.5 truncate">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="font-semibold text-slate-700">Contexto:</span>
                <span className="font-mono font-bold text-indigo-700">[{currentProject.key}]</span>
                <span className="truncate">{currentProject.name}</span>
              </div>
              {activeSprint && (
                <span className="bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded text-[10px] shrink-0 ml-2">
                  Sprint Activo
                </span>
              )}
            </div>
          )}

          {/* Messages Thread */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed group relative ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-xs shadow-xs'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs shadow-xs'
                  }`}
                >
                  {/* Markdown-style content formatting */}
                  <div className="whitespace-pre-wrap space-y-2 font-normal">
                    {msg.content}
                  </div>

                  {msg.role === 'assistant' && (msg.id.endsWith('-err') || msg.content.includes('⚠️ **Aviso')) && lastFailedPrompt && (
                    <div className="mt-2.5 pt-2 border-t border-amber-200/60 flex items-center">
                      <button
                        onClick={() => handleSendMessage(lastFailedPrompt)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-xs shadow-xs transition-all hover:scale-[1.02]"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Reintentar consulta</span>
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-black/5 text-[10px] opacity-70">
                    <span>{msg.timestamp}</span>

                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => handleCopyText(msg.content, msg.id)}
                        className="opacity-0 group-hover:opacity-100 hover:text-indigo-600 transition-opacity flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100"
                        title="Copiar texto de la respuesta"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-600 font-medium">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-200 flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold shadow-xs">
                    {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 items-center text-xs text-slate-500">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-xs px-4 py-2.5 shadow-xs flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                  <span className="text-slate-600">ScrumBot redactando respuesta pedagógica...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Carousel */}
          <div className="bg-slate-100/80 border-t border-slate-200 px-3 py-2 shrink-0">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mb-1.5">
              <Lightbulb className="w-3 h-3 text-amber-500" />
              <span>Guías rápidas para estudiantes:</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {QUICK_PROMPTS.map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(qp.prompt)}
                  disabled={isLoading}
                  className="whitespace-nowrap bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200/90 hover:border-indigo-300 text-[11px] px-2.5 py-1 rounded-full font-medium transition-all shadow-2xs shrink-0 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span>{qp.label}</span>
                  <ArrowRight className="w-2.5 h-2.5 opacity-60" />
                </button>
              ))}
            </div>
          </div>

          {/* Input Box */}
          <div className="p-3 bg-white border-t border-slate-200 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                rows={1}
                placeholder="Pide ayuda para redactar una Historia, consultar roles o Scrum..."
                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white resize-none"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl disabled:opacity-40 disabled:hover:bg-indigo-600 transition-colors shadow-sm flex items-center justify-center shrink-0"
                title="Enviar mensaje"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <p className="text-[10px] text-slate-400 text-center mt-1.5">
              Presiona Enter para enviar. Respuestas adaptadas para reducir dudas académicas.
            </p>
          </div>
        </div>
      )}
    </>
  );
};
