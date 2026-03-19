
import React, { useState, useMemo } from 'react';
import { AgendaTask, AppNote } from '../types';
import { CalendarBlank as CalendarIcon, Clock, Plus, Trash, CheckCircle, Circle, Note, ArrowSquareOut } from '@phosphor-icons/react';

// Lucide compat aliases
const Trash2 = Trash;
const StickyNote = Note;
const ExternalLink = ArrowSquareOut;
import { Field } from '../components/ui/Field';
import { IconButton } from '../components/ui/IconButton';

interface AgendaViewProps {
  tasks: AgendaTask[];
  notes: AppNote[];
  actions: {
    addTask: (t: Omit<AgendaTask, 'id'>) => void;
    updateTask: (t: AgendaTask) => void;
    deleteTask: (id: string) => void;
    addNote: (n: Omit<AppNote, 'id'>) => void;
    updateNote: (n: AppNote) => void;
    deleteNote: (id: string) => void;
  };
}

export const AgendaView = ({ tasks, notes, actions }: AgendaViewProps) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [activeTab, setActiveTab] = useState<'tasks' | 'notes'>('tasks');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', content: '', color: 'bg-white' });

  const hours = Array.from({ length: 18 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`);

  const filteredTasks = useMemo(() => tasks.filter(t => t.date === selectedDate), [tasks, selectedDate]);

  const handleAddTask = (hour: string) => {
    const title = prompt(`Nova tarefa para as ${hour}:`);
    if (title) actions.addTask({ date: selectedDate, hour, title, completed: false });
  };

  const colors = [
    { name: 'Branco', class: 'bg-white dark:bg-slate-800' },
    { name: 'Amarelo', class: 'bg-yellow-100 dark:bg-yellow-900/30' },
    { name: 'Azul', class: 'bg-blue-100 dark:bg-blue-900/30' },
    { name: 'Verde', class: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { name: 'Rosa', class: 'bg-rose-100 dark:bg-rose-900/30' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-black uppercase tracking-tight">Agenda e Lembretes</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase">Planeje seu dia e gerencie suas notas</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.open('https://keep.google.com', '_blank')} className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-[9px] font-black uppercase shadow-sm">
            <ExternalLink size={12} /> Google Keep
          </button>
          <button onClick={() => window.open('https://calendar.google.com', '_blank')} className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-[9px] font-black uppercase shadow-sm">
            <CalendarIcon size={12} /> Google Agenda
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lado Esquerdo: Calendário e Tabs */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border dark:border-slate-800">
            <label className="text-[9px] font-black uppercase text-slate-400 mb-2 block">Selecionar Data</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              aria-label="Selecionar data"
              title="Selecionar data"
              className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 ring-blue-500/20"
            />
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl">
            <button onClick={() => setActiveTab('tasks')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'tasks' ? 'bg-white dark:bg-slate-800 shadow text-blue-600' : 'text-slate-500'}`}>
              <Clock size={14} /> Tarefas
            </button>
            <button onClick={() => setActiveTab('notes')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'notes' ? 'bg-white dark:bg-slate-800 shadow text-yellow-600' : 'text-slate-500'}`}>
              <StickyNote size={14} /> Notas
            </button>
          </div>

          <div className="bg-blue-600 p-4 rounded-2xl text-white shadow-lg shadow-blue-600/20">
            <h4 className="text-xs font-black uppercase mb-1">Dica de Produtividade</h4>
            <p className="text-[10px] font-medium opacity-80 leading-relaxed">
              Organize suas tarefas por blocos de horários para aumentar o foco e reduzir a ansiedade do dia a dia.
            </p>
          </div>
        </div>

        {/* Lado Direito: Conteúdo Principal */}
        <div className="lg:col-span-8">
          {activeTab === 'tasks' ? (
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Linha do Tempo - {new Date(selectedDate).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
              </div>
              <div className="divide-y dark:divide-slate-800 max-h-[600px] overflow-y-auto custom-scrollbar">
                {hours.map(hour => {
                  const hourTasks = filteredTasks.filter(t => t.hour === hour);
                  return (
                    <div key={hour} className="group flex items-start gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <span className="text-[10px] font-black text-slate-400 mt-1 w-12">{hour}</span>
                      <div className="flex-1 space-y-2">
                        {hourTasks.map(task => (
                          <div key={task.id} className="flex items-center justify-between bg-white dark:bg-slate-800 p-2 rounded-lg border dark:border-slate-700 shadow-sm animate-fadeIn">
                            <div className="flex items-center gap-3">
                              <button onClick={() => actions.updateTask({ ...task, completed: !task.completed })} className={task.completed ? 'text-emerald-500' : 'text-slate-300'}>
                                {task.completed ? <CheckCircle size={18} /> : <Circle size={18} />}
                              </button>
                              <span className={`text-xs font-bold ${task.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>{task.title}</span>
                            </div>
                            <IconButton icon={<Trash2 size={14} />} color="rose" onClick={() => actions.deleteTask(task.id)} />
                          </div>
                        ))}
                        <button onClick={() => handleAddTask(hour)} className="opacity-0 group-hover:opacity-100 text-[9px] font-black uppercase text-blue-600 flex items-center gap-1 transition-all">
                          <Plus size={12} /> Adicionar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black uppercase text-slate-400">Minhas Notas</h3>
                <button onClick={() => setIsAddingNote(true)} className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-[9px] font-black uppercase flex items-center gap-2 shadow-md">
                  <Plus size={14} /> Nova Nota
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {notes.map(note => (
                  <div key={note.id} className={`${note.color} p-5 rounded-2xl shadow-sm border dark:border-slate-700 group relative`}>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-[11px] font-black uppercase tracking-tight dark:text-slate-100">{note.title}</h4>
                      <IconButton icon={<Trash2 size={14} />} color="rose" onClick={() => actions.deleteNote(note.id)} />
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                    <div className="mt-4 pt-3 border-t dark:border-slate-700/30 text-[8px] font-bold text-slate-400 uppercase">
                      {new Date(note.date).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal para Nova Nota */}
      {isAddingNote && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 animate-slideUp">
            <h4 className="text-xs font-black uppercase">Criar Lembrete</h4>
            <Field label="Título" value={newNote.title} onChange={v => setNewNote({ ...newNote, title: v })} />
            <div className="flex flex-col gap-1">
              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Conteúdo</label>
              <textarea
                value={newNote.content}
                onChange={e => setNewNote({ ...newNote, content: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-semibold h-32 outline-none focus:ring-2 ring-blue-500/20"
                placeholder="O que você está pensando?"
              />
            </div>
            <div className="flex gap-2">
              {colors.map(c => (
                <button key={c.name} onClick={() => setNewNote({ ...newNote, color: c.class })} className={`w-8 h-8 rounded-full border-2 ${newNote.color === c.class ? 'border-blue-500' : 'border-transparent'} ${c.class} shadow-sm transition-all`} title={c.name} />
              ))}
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setIsAddingNote(false)} className="flex-1 py-3 text-[10px] font-black uppercase text-slate-400">Cancelar</button>
              <button
                onClick={() => {
                  actions.addNote({ ...newNote, date: new Date().toISOString() });
                  setIsAddingNote(false);
                  setNewNote({ title: '', content: '', color: 'bg-white' });
                }}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase"
              >
                Salvar Nota
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
