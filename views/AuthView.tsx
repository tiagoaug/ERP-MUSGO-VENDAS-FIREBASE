import React, { useState } from 'react';
import { 
  auth, 
  db 
} from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup,
  updateProfile,
  signInWithCredential
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { 
  Envelope, 
  Lock, 
  Eye, 
  EyeSlash, 
  GoogleLogo, 
  Lightning,
  User,
  ArrowRight,
  CircleNotch
} from '@phosphor-icons/react';

interface AuthViewProps {
  onAuthSuccess: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (name) {
          await updateProfile(userCredential.user, { displayName: name });
        }
      }
      onAuthSuccess();
    } catch (err: any) {
      console.error('Auth error:', err);
      let message = 'Ocorreu um erro na autenticação.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        message = 'E-mail ou senha incorretos.';
      } else if (err.code === 'auth/email-already-in-use') {
        message = 'Este e-mail já está em uso.';
      } else if (err.code === 'auth/weak-password') {
        message = 'A senha deve ter pelo menos 6 caracteres.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'E-mail inválido.';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithGoogle({
          webClientId: '106422037058-o6nfd5rdni63ds5jel795edqhc41nuqg.apps.googleusercontent.com'
        });
        const credential = GoogleAuthProvider.credential(result.credential?.idToken);
        await signInWithCredential(auth, credential);
      } else {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      }
      onAuthSuccess();
    } catch (err: any) {
      console.error('Google Auth error:', err);
      // 'auth/cancelled' is often returned by the native plugin if dismissed
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled') {
        setError('Falha ao entrar com Google. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-6 font-sans">
      <div className="w-full max-w-md animate-fadeIn">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-xl shadow-blue-600/30 mb-4 text-white">
            <Lightning size={32} weight="fill" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">
            Musgo ERP <span className="text-blue-600 text-sm align-top">PRO</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">
            {isLogin ? 'Bem-vindo de volta! Faça login para continuar.' : 'Crie sua conta e comece a gerenciar seu negócio.'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 shadow-2xl shadow-slate-200 dark:shadow-none border border-slate-100 dark:border-slate-800">
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <User size={18} />
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-850 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/50 transition-all dark:text-white placeholder:text-slate-400"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <Envelope size={18} />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@email.com"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-850 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/50 transition-all dark:text-white placeholder:text-slate-400"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Senha</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock size={18} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-3.5 bg-slate-50 dark:bg-slate-850 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/50 transition-all dark:text-white placeholder:text-slate-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl animate-shake">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4"
            >
              {loading ? <CircleNotch size={18} className="animate-spin" /> : (
                <>
                  {isLogin ? 'Entrar Agora' : 'Criar minha conta'}
                  <ArrowRight size={16} weight="bold" />
                </>
              )}
            </button>
          </form>

          <div className="relative my-8 text-center px-4">
            <hr className="border-slate-100 dark:border-slate-800" />
            <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-900 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">OU</span>
          </div>

          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full py-4 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest border border-slate-100 dark:border-slate-800 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            <GoogleLogo size={20} weight="bold" className="text-blue-500" />
            Continuar com Google
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-slate-500 dark:text-slate-400 text-xs font-bold hover:text-blue-600 transition-colors"
          >
            {isLogin ? (
              <>Não tem uma conta? <span className="text-blue-600">Cadastre-se grátis</span></>
            ) : (
              <>Já possui uma conta? <span className="text-blue-600">Fazer login</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
