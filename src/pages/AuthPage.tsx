import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { GameIcon } from '../../components/icons';

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { signInWithPassword, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const credentials = { email, password };
    const { error: authError } = isLogin 
      ? await signInWithPassword(credentials) 
      : await signUp(credentials);

    if (authError) {
      setError(authError.message);
    } else if (!isLogin) {
      setMessage('Check your email for the confirmation link!');
    } else if (isLogin) {
      // 登录成功，跳转到首页
      console.log('✅ Login successful, navigating to home...');
      navigate('/');
    }
    
    setLoading(false);
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gray-100 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
            <GameIcon className="w-16 h-16 text-indigo-500 mb-2" />
            <h1 className="text-3xl font-bold font-serif text-gray-800 dark:text-zinc-200">Gemini Adventure</h1>
            <p className="text-gray-500 dark:text-zinc-400">Welcome to the community</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg shadow-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="password"  className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-t-2 border-white rounded-full animate-spin border-t-transparent"></div>
              ) : (isLogin ? 'Sign In' : 'Sign Up')}
            </button>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            {message && <p className="text-green-500 text-sm text-center">{message}</p>}
          </form>
          <p className="mt-4 text-center text-sm text-gray-600 dark:text-zinc-400">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button onClick={() => { setIsLogin(!isLogin); setError(null); setMessage(null); }} className="font-medium text-indigo-600 hover:text-indigo-500 ml-1">
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
