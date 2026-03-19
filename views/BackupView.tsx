
import React, { useState, useEffect, useRef } from 'react';
import { Database, FileArrowDown, FileArrowUp, ArrowCounterClockwise, Cloud, CloudArrowUp, CloudArrowDown, Monitor, CheckCircle, ArrowClockwise, HardDrives, ArrowRight, Warning, Trash, Eye, ShieldWarning, X } from '@phosphor-icons/react';

// Lucide compat aliases
const FileDown = FileArrowDown;
const FileUp = FileArrowUp;
const RotateCcw = ArrowCounterClockwise;
const CloudUpload = CloudArrowUp;
const CloudDownload = CloudArrowDown;
const CheckCircle2 = CheckCircle;
const RefreshCw = ArrowClockwise;
const Server = HardDrives;
const AlertTriangle = Warning;
const Trash2 = Trash;
const ShieldAlert = ShieldWarning;
import { migrateLocalDataToFirebase } from '../lib/migration';

declare const gapi: any;
declare const google: any;

// --- CONFIGURAÇÃO DO GOOGLE CLOUD ---
const CLIENT_ID = "";
const API_KEY = "";
// ------------------------------------

const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";
const SCOPES = "https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file";
const BACKUP_FILENAME = "gestao_pro_backup_v1.json";

interface BackupViewProps {
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  getRawData: () => any;
  restoreData: (data: any) => void;
  onBack: () => void;
  onReset?: () => void;
  onSync: () => Promise<void>;
  onTestConnection: () => Promise<{ success: boolean; message?: string }>;
}

export const BackupView = ({ onExport, onImport, getRawData, restoreData, onBack, onReset, onSync, onTestConnection }: BackupViewProps) => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isGapiReady, setIsGapiReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(localStorage.getItem('last_cloud_sync'));
  const [authError, setAuthError] = useState<string | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<string>('');
  const [isMigrating, setIsMigrating] = useState(false);
  const tokenClient = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Status Firebase
  const [isTestingFirebase, setIsTestingFirebase] = useState(false);
  const [firebaseStatus, setFirebaseStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);

  // Reset de Fábrica
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Preview de Backup antes de restaurar
  const [pendingFile, setPendingFile] = useState<{ data: any, file: File } | null>(null);

  useEffect(() => {
    const initClient = async () => {
      if (!CLIENT_ID || !API_KEY) {
        setAuthError("Para usar a Nuvem, insira suas chaves no código. O Backup Local funciona normalmente.");
        return;
      }
      try {
        await new Promise((resolve) => gapi.load('client', resolve));
        await gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY_DOC] });
        tokenClient.current = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: async (resp: any) => {
            if (resp.error) { setAuthError(`Erro Google: ${resp.error}`); return; }
            setIsSignedIn(true);
            setAuthError(null);
            localStorage.setItem('g_drive_token', JSON.stringify(resp));
          },
        });
        const savedToken = localStorage.getItem('g_drive_token');
        if (savedToken) { gapi.client.setToken(JSON.parse(savedToken)); setIsSignedIn(true); }
        setIsGapiReady(true);
      } catch (err) {
        setAuthError("Falha ao carregar bibliotecas Google.");
      }
    };
    const scriptCheck = setInterval(() => {
      if (typeof gapi !== 'undefined' && typeof google !== 'undefined' && google.accounts) {
        clearInterval(scriptCheck);
        initClient();
      }
    }, 500);
    return () => clearInterval(scriptCheck);
  }, []);

  const handleLogin = () => { if (tokenClient.current) tokenClient.current.requestAccessToken({ prompt: 'consent' }); };

  const handleLogout = () => {
    const token = gapi.client.getToken();
    if (token) {
      google.accounts.oauth2.revoke(token.access_token);
      gapi.client.setToken(null);
      localStorage.removeItem('g_drive_token');
      setIsSignedIn(false);
    }
  };

  const findCloudFile = async () => {
    const response = await gapi.client.drive.files.list({
      q: `name='${BACKUP_FILENAME}' and trashed=false`,
      spaces: 'appDataFolder',
      fields: 'files(id, name)',
    });
    return response.result.files?.[0] || null;
  };

  const saveToCloud = async () => {
    if (!isSignedIn) return handleLogin();
    setIsProcessing(true);
    try {
      const data = getRawData();
      const content = JSON.stringify(data);
      const metadata = { name: BACKUP_FILENAME, parents: ['appDataFolder'] };
      const existingFile = await findCloudFile();
      const boundary = '-------314159265358979323846';
      const delimiter = "\r\n--" + boundary + "\r\n";
      const close_delim = "\r\n--" + boundary + "--";
      const multipartRequestBody =
        delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) +
        delimiter + 'Content-Type: application/json\r\n\r\n' + content + close_delim;
      const path = existingFile
        ? `/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`
        : '/upload/drive/v3/files?uploadType=multipart';
      await gapi.client.request({
        path,
        method: existingFile ? 'PATCH' : 'POST',
        headers: { 'Content-Type': `multipart/related; boundary="${boundary}"` },
        body: multipartRequestBody,
      });
      const now = new Date().toLocaleString();
      setLastSync(now);
      localStorage.setItem('last_cloud_sync', now);
      alert("Nuvem atualizada com sucesso!");
    } catch (err) {
      alert("Erro ao enviar dados para o Drive.");
    } finally {
      setIsProcessing(false);
    }
  };

  const loadFromCloud = async () => {
    if (!isSignedIn) return handleLogin();
    if (!confirm("Isso irá substituir todos os dados atuais pelos dados da nuvem. Continuar?")) return;
    setIsProcessing(true);
    try {
      const file = await findCloudFile();
      if (!file) return alert("Nenhum backup encontrado na nuvem.");
      const response = await gapi.client.drive.files.get({ fileId: file.id, alt: 'media' });
      restoreData(response.result);
      alert("Dados restaurados com sucesso!");
    } catch (err) {
      alert("Erro ao baixar dados da nuvem.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        setPendingFile({ data, file });
      } catch {
        alert("Arquivo inválido. Certifique-se que é um backup JSON válido.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmRestore = () => {
    if (!pendingFile) return;
    restoreData(pendingFile.data);
    setPendingFile(null);
    alert("✅ Dados restaurados com sucesso!");
  };

  const handleFactoryReset = async () => {
    if (resetConfirmText !== 'RESETAR') return alert("Digite RESETAR para confirmar.");
    setIsResetting(true);
    try {
      if (onReset) await onReset();
      setShowResetModal(false);
      setResetConfirmText('');
      alert("✅ Reset de fábrica concluído. Configurações do sistema foram mantidas.");
    } catch (err) {
      alert("Erro ao realizar reset. Tente novamente.");
    } finally {
      setIsResetting(false);
    }
  };

  const BackupPreviewModal = () => {
    if (!pendingFile) return null;
    const d = pendingFile.data;
    const counts = [
      { label: 'Vendas', value: d.sales?.length || 0, color: 'text-blue-600' },
      { label: 'Compras', value: d.purchases?.length || 0, color: 'text-indigo-600' },
      { label: 'Clientes', value: d.customers?.length || 0, color: 'text-emerald-600' },
      { label: 'Fornecedores', value: d.suppliers?.length || 0, color: 'text-purple-600' },
      { label: 'Produtos', value: d.products?.length || 0, color: 'text-orange-600' },
      { label: 'Transações', value: d.transactions?.length || 0, color: 'text-rose-600' },
    ];
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
        <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] animate-slideUp border dark:border-slate-800 overflow-hidden">
          <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-amber-50 dark:bg-amber-900/20">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-lg"><Eye size={20} /></div>
              <div>
                <h4 className="text-sm font-black uppercase text-amber-800 dark:text-amber-400">Preview do Backup</h4>
                <p className="text-[9px] font-bold text-amber-600 dark:text-amber-500 uppercase mt-0.5">{pendingFile.file.name}</p>
              </div>
            </div>
            <button onClick={() => setPendingFile(null)} title="Fechar" aria-label="Fechar" className="p-2 bg-white dark:bg-slate-800 border dark:border-slate-700 text-slate-400 rounded-full hover:scale-110 transition-all"><X size={16} /></button>
          </div>
          <div className="p-6 space-y-4 flex-1 overflow-y-auto">
            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-3">
              <AlertTriangle className="text-amber-500 shrink-0" size={20} />
              <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase leading-relaxed">
                Os dados atuais serão SUBSTITUÍDOS. Esta ação não pode ser desfeita!
              </p>
            </div>
            <h5 className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-2">Conteúdo do Arquivo</h5>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {counts.map(({ label, value, color }) => (
                <div key={label} className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-2 sm:p-4 text-center border dark:border-slate-700">
                  <p className={`text-lg sm:text-xl font-black ${color}`}>{value}</p>
                  <p className="text-[8px] font-black uppercase text-slate-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-800 flex gap-3">
            <button onClick={() => setPendingFile(null)} className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-200 transition-colors">Cancelar</button>
            <button onClick={handleConfirmRestore} className="flex-[2] py-3.5 bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-amber-500/20 hover:bg-amber-600 active:scale-95 transition-all flex items-center justify-center gap-2">
              <CheckCircle2 size={16} /> Confirmar Restauração
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto py-8 animate-fadeIn px-2 sm:px-4 space-y-6 pb-20">
      {pendingFile && <BackupPreviewModal />}

      {/* MODAL RESET DE FÁBRICA */}
      {showResetModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 flex flex-col animate-slideUp border-2 border-rose-200 dark:border-rose-900">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <ShieldAlert size={32} />
            </div>
            <h4 className="text-base font-black uppercase text-center dark:text-white mb-2">Reset de Fábrica</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase text-center mb-6 leading-relaxed">
              Isso apagará <span className="text-rose-500 font-black">TODAS</span> as vendas, compras, clientes, fornecedores e produtos. Suas configurações (cores, grades) serão mantidas.
            </p>
            <div className="space-y-3 mb-6">
              <label className="text-[9px] font-black uppercase text-slate-400 block">Digite <span className="text-rose-500">RESETAR</span> para confirmar</label>
              <input
                type="text"
                value={resetConfirmText}
                onChange={e => setResetConfirmText(e.target.value.toUpperCase())}
                placeholder="RESETAR"
                title="Confirmação de reset"
                aria-label="Digite RESETAR para confirmar"
                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-rose-200 dark:border-rose-900 rounded-2xl px-4 py-3 text-sm font-black text-center tracking-widest outline-none focus:border-rose-500 dark:text-white"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => { setShowResetModal(false); setResetConfirmText(''); }} className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-200 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleFactoryReset}
                disabled={resetConfirmText !== 'RESETAR' || isResetting}
                className="flex-[2] py-3.5 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-rose-600/20 hover:bg-rose-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isResetting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {isResetting ? 'Resetando...' : 'RESETAR AGORA'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="text-center mb-8">
        <h2 className="text-2xl font-black uppercase tracking-tight dark:text-white">Opções Avançadas e Backup</h2>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[4px]">Segurança e Migração</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CARD NUVEM */}
        <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-6 rounded-[32px] shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl"><Cloud size={24} /></div>
              <div>
                <h3 className="text-xs font-black uppercase dark:text-white">Nuvem Google</h3>
                <p className="text-[8px] font-bold text-slate-400 uppercase">Sincronização automática</p>
              </div>
            </div>
            {authError && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
                <p className="text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase leading-tight">{authError}</p>
              </div>
            )}
            <div className="space-y-2">
              {!isSignedIn ? (
                <button onClick={handleLogin} disabled={!isGapiReady || !CLIENT_ID} className="w-full py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-center gap-3 hover:border-blue-600 transition-all active:scale-95 disabled:opacity-50">
                  <Monitor size={16} className="text-slate-400" />
                  <span className="text-[10px] font-black uppercase dark:text-white">Conectar Drive</span>
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-2">
                    <span className="text-[9px] font-black uppercase text-emerald-500 flex items-center gap-1.5"><CheckCircle2 size={12} /> Online</span>
                    {lastSync && <span className="text-[8px] font-bold text-slate-400 uppercase">Sinc: {lastSync.split(',')[0]}</span>}
                  </div>
                  <button onClick={saveToCloud} disabled={isProcessing} className="w-full py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-600/20">
                    {isProcessing ? <RefreshCw size={14} className="animate-spin" /> : <CloudUpload size={14} />} Enviar para Nuvem
                  </button>
                  <button onClick={loadFromCloud} disabled={isProcessing} className="w-full py-3 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-slate-50">
                    <CloudDownload size={14} /> Restaurar da Nuvem
                  </button>
                  <button onClick={handleLogout} className="w-full py-2 text-[8px] font-black uppercase text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">Sair do Google</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CARD LOCAL */}
        <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-6 rounded-[32px] shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-2xl"><Database size={24} /></div>
              <div>
                <h3 className="text-xs font-black uppercase dark:text-white">Backup Offline</h3>
                <p className="text-[8px] font-bold text-slate-400 uppercase">Arquivos Locais (.json)</p>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase leading-relaxed">
              Exporte seus dados para um arquivo com data e hora. Útil para guardar em pendrives ou enviar por e-mail.
            </p>
            <div className="space-y-2 pt-2">
              <button onClick={onExport} className="w-full py-4 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-amber-600 shadow-lg shadow-amber-500/20 transition-all active:scale-95">
                <FileDown size={16} /> Exportar Backup com Data
              </button>
              <div className="relative">
                <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileSelect} className="hidden" title="Selecionar arquivo de backup" aria-label="Selecionar arquivo de backup" />
                <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-slate-200 transition-all border dark:border-slate-700">
                  <FileUp size={16} /> Selecionar e Restaurar Backup
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SINCRONIZAÇÃO E TESTE FIREBASE */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border-2 border-blue-200 dark:border-blue-800 p-6 rounded-[32px] shadow-lg mt-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 mb-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl"><Cloud size={24} /></div>
          <div>
            <h3 className="text-sm font-black uppercase text-blue-800 dark:text-blue-400">Sincronização Firebase</h3>
            <p className="text-[10px] font-bold text-blue-600 dark:text-blue-500 uppercase">Verificação e Atualização</p>
          </div>
        </div>

        <p className="text-xs text-blue-700 dark:text-blue-300 font-bold mb-6 leading-relaxed">
          Verifique se a conexão com o banco de dados está ativa e force uma atualização manual para baixar os dados mais recentes do servidor.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <button
              onClick={async () => {
                setIsTestingFirebase(true);
                setFirebaseStatus(null);
                const res = await onTestConnection();
                setFirebaseStatus(res);
                setIsTestingFirebase(false);
              }}
              disabled={isTestingFirebase}
              className="w-full py-4 bg-white dark:bg-slate-800 border-2 border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 rounded-2xl font-black uppercase tracking-wider text-[10px] shadow-lg shadow-blue-500/10 active:scale-95 transition-all flex justify-center items-center gap-2 hover:border-blue-500"
            >
              {isTestingFirebase ? <RefreshCw size={16} className="animate-spin" /> : <ShieldAlert size={16} />}
              Testar Conexão
            </button>

            {firebaseStatus && (
              <div className={`p-3 rounded-xl animate-fadeIn border-l-4 ${firebaseStatus.success ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border-emerald-500' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 border-rose-500'}`}>
                <div className="flex items-center gap-2">
                  {firebaseStatus.success ? <CheckCircle2 size={14} /> : <X size={14} />}
                  <span className="text-[10px] font-black uppercase">
                    {firebaseStatus.success ? 'Conexão Estabelecida!' : `Falha: ${firebaseStatus.message}`}
                  </span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={async () => {
              if (isSyncingFirebase) return;
              setIsSyncingFirebase(true);
              try {
                await onSync();
                alert("✅ Sincronização concluída com sucesso!");
              } catch (err) {
                alert("❌ Erro ao sincronizar dados.");
              } finally {
                setIsSyncingFirebase(false);
              }
            }}
            disabled={isSyncingFirebase}
            className="w-full h-fit py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-wider text-[10px] shadow-xl shadow-blue-600/20 active:scale-95 transition-all flex justify-center items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
          >
            {isSyncingFirebase ? <RefreshCw size={18} className="animate-spin" /> : <ArrowClockwise size={18} />}
            Sincronizar Agora
          </button>
        </div>
      </div>

      {/* MIGRAÇÃO FIREBASE */}
      <div className="bg-emerald-50 dark:bg-emerald-900/10 border-2 border-emerald-200 dark:border-emerald-800 p-6 rounded-[32px] shadow-lg mt-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 mb-4">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl"><Server size={24} /></div>
          <div>
            <h3 className="text-sm font-black uppercase text-emerald-800 dark:text-emerald-400">Migração para Banco de Dados</h3>
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase">LocalStorage {'-> '} Firebase Firestore</p>
          </div>
        </div>
        <p className="text-xs text-emerald-700 dark:text-emerald-300 font-bold mb-4">
          Use esta opção para migrar todos os dados locais de uma vez para o Firebase. Os relacionamentos serão mantidos com novos UUIDs seguros.
        </p>
        {migrationStatus && (
          <div className={`p-3 rounded-xl mb-4 text-xs font-bold uppercase tracking-wide border-l-4 ${migrationStatus.includes('Erro') || migrationStatus.includes('Falha') ? 'bg-red-50 text-red-600 border-red-500' : 'bg-white/50 dark:bg-black/20 text-emerald-800 dark:text-emerald-200 border-emerald-500'}`}>
            {migrationStatus}
          </div>
        )}
        <button
          onClick={async () => {
            if (!confirm('Deseja iniciar a migração de todos os dados locais para o Firebase?')) return;
            setIsMigrating(true);
            setMigrationStatus('');
            try {
              const raw = getRawData();
              await migrateLocalDataToFirebase(raw, (msg) => setMigrationStatus(msg));
            } catch (error: any) {
              setMigrationStatus(error.message || 'Falha na migração');
            } finally {
              setIsMigrating(false);
            }
          }}
          disabled={isMigrating}
          className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-wider text-xs shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex justify-center items-center gap-2 hover:bg-emerald-700 disabled:opacity-50"
        >
          {isMigrating ? <RefreshCw size={18} className="animate-spin" /> : <ArrowRight size={18} />}
          Iniciar Migração Completa
        </button>
      </div>

      {/* RESET DE FÁBRICA */}
      <div className="bg-rose-50 dark:bg-rose-900/10 border-2 border-rose-200 dark:border-rose-800 p-6 rounded-[32px] shadow-lg">
        <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 mb-4">
          <div className="p-3 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-2xl"><ShieldAlert size={24} /></div>
          <div>
            <h3 className="text-sm font-black uppercase text-rose-700 dark:text-rose-400">Reset de Fábrica</h3>
            <p className="text-[10px] font-bold text-rose-500 dark:text-rose-600 uppercase">Apaga dados operacionais — mantém configurações</p>
          </div>
        </div>
        <p className="text-xs text-rose-700 dark:text-rose-300 font-bold mb-4">
          Remove permanentemente <strong>todas as vendas, compras, clientes, fornecedores e produtos</strong>. Suas grades, cores e unidades de medida serão preservadas.
        </p>
        <button onClick={() => setShowResetModal(true)} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-rose-600/20 active:scale-95 transition-all flex justify-center items-center gap-2 hover:bg-rose-700">
          <Trash2 size={18} /> Iniciar Reset de Fábrica
        </button>
      </div>

      <div className="flex justify-center pt-8">
        <button onClick={onBack} className="text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 flex items-center gap-2 transition-colors">
          <RotateCcw size={14} /> Voltar para o Início
        </button>
      </div>
    </div>
  );
};
