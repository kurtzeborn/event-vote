import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';

export default function LandingPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { isAuthenticated, isVotekeeper, login } = useAuth();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 4) {
      setError('Enter a 4-letter event code');
      return;
    }
    navigate(`/vote/${trimmed}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
          🗳️ Event Vote
        </h1>
        <p className="text-center text-gray-500 mb-8">
          Live audience voting for your event
        </p>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
              Event Code
            </label>
            <input
              id="code"
              type="text"
              maxLength={4}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError('');
              }}
              placeholder="ABCD"
              className="w-full text-center text-3xl font-mono tracking-[0.5em] border-2 border-gray-300 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none"
              autoFocus
              autoComplete="off"
            />
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors text-lg"
          >
            Join Vote
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          {isVotekeeper ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Go to Dashboard →
            </button>
          ) : isAuthenticated ? (
            <p className="text-sm text-gray-500">
              Signed in. Contact an admin for votekeeper access.
            </p>
          ) : (
            <button
              onClick={login}
              className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
            >
              Votekeeper Sign In
            </button>
          )}
        </div>
      </div>

      <p className="text-white/60 text-sm mt-6">
        evote.k61.dev
      </p>
    </div>
  );
}
