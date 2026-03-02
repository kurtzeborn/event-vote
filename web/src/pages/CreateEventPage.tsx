import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext.tsx';
import { api, ApiError } from '../api.ts';
import ThemePicker from '../components/ThemePicker.tsx';
import { DEFAULT_THEME } from '../themes.ts';

export default function CreateEventPage() {
  const { isVotekeeper, isLoading: authLoading, login } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [votesPerAttendee, setVotesPerAttendee] = useState(3);
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      api.createEvent({
        name: name.trim(),
        config: { votesPerAttendee, theme },
      }),
    onSuccess: (event) => {
      navigate(`/manage/${event.id}`);
    },
    onError: (err: Error) => {
      setError(err instanceof ApiError ? err.message : 'Failed to create event');
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!isVotekeeper) {
    login();
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Event name is required');
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/dashboard" className="text-gray-400 hover:text-gray-600">
            ← Back
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Create Event</h1>
        </div>
      </header>

      {/* Form */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Event Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-1">
              Event Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="e.g., Best Team Presentation"
              maxLength={200}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none text-lg"
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1">
              Displayed prominently to voters. Max 200 characters.
            </p>
          </div>

          {/* Votes Per Attendee */}
          <div>
            <label htmlFor="votes" className="block text-sm font-semibold text-gray-700 mb-1">
              Votes Per Attendee
            </label>
            <select
              id="votes"
              value={votesPerAttendee}
              onChange={(e) => setVotesPerAttendee(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n} vote{n !== 1 ? 's' : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Each voter can distribute this many votes across options.
            </p>
          </div>

          {/* Color Theme */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Color Theme
            </label>
            <ThemePicker value={theme} onChange={setTheme} />
            <p className="text-xs text-gray-400 mt-2">
              Sets the look and feel for voters and results.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-700 rounded-xl p-3 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors text-lg"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Event'}
          </button>
        </form>
      </main>
    </div>
  );
}
