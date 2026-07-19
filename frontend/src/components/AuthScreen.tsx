import React, { useState } from 'react';
import { Radio, MessageSquare, BookOpen, BarChart3, Ticket } from 'lucide-react';
import { apiJson } from '../api';

interface AuthScreenProps {
  onLoginSuccess: (token: string, user: { id: string; name: string; email: string; role: 'admin' | 'user' }) => void;
}

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    // Self-registration only ever creates a customer ('user') account -- the
    // backend ignores any role field sent to /api/auth/register.
    const payload = isRegister ? { email, name, password } : { email, password };

    try {
      const data = await apiJson(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink-soft flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full mx-auto space-y-7 bg-card p-8 rounded-2xl border border-line mt-8 shadow-sm">
        <div>
          <div className="flex items-center justify-center gap-2.5 mb-5">
            <Radio className="w-5 h-5 text-hub" strokeWidth={2.25} />
            <span className="font-display font-semibold text-lg tracking-tight text-ink">
              SmartHelp Portal
            </span>
          </div>
          <h2 className="text-center text-2xl font-display font-semibold text-ink tracking-tight">
            {isRegister ? 'Create your account' : 'Sign in'}
          </h2>
          <p className="mt-2 text-center text-sm text-ink-faint">
            {isRegister ? 'Already have an account? ' : "Don't have an account? "}
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              className="font-semibold text-hub hover:underline"
            >
              {isRegister ? 'Sign in' : 'Register'}
            </button>
          </p>
        </div>

        {error && (
          <div className="bg-status-red-soft border-l-2 border-status-red px-4 py-3 rounded-md">
            <p className="text-sm text-status-red font-medium">{error}</p>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          {isRegister && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-ink-faint mb-1">
                Full name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full px-3.5 py-2.5 bg-paper border border-line rounded-lg text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-hub/30 focus:border-hub text-sm transition-all"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-ink-faint mb-1">
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 bg-paper border border-line rounded-lg text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-hub/30 focus:border-hub text-sm transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-ink-faint mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 bg-paper border border-line rounded-lg text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-hub/30 focus:border-hub text-sm transition-all"
            />
          </div>

          {isRegister && (
            <p className="text-xs text-ink-faint -mt-1">
              New accounts are created as customer accounts. Admin accounts are provisioned separately by an existing administrator.
            </p>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-hub hover:bg-hub/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-hub/40 transition-colors disabled:opacity-50"
            >
              {loading ? 'Authenticating…' : isRegister ? 'Create account' : 'Sign in'}
            </button>
          </div>
        </form>

      </div>

      {/* Feature footer */}
      <div className="max-w-4xl w-full mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 px-4 mt-10 pt-8 border-t border-line text-center sm:text-left">
        <div>
          <div className="flex items-center justify-center sm:justify-start gap-2 text-hub mb-1">
            <BookOpen className="w-4 h-4" />
            <h4 className="font-semibold text-sm text-ink">Knowledge base</h4>
          </div>
          <p className="text-xs text-ink-faint">Indexes manuals, policies, and FAQs so answers are grounded in your own documents.</p>
        </div>
        <div>
          <div className="flex items-center justify-center sm:justify-start gap-2 text-hub mb-1">
            <MessageSquare className="w-4 h-4" />
            <h4 className="font-semibold text-sm text-ink">Support chat</h4>
          </div>
          <p className="text-xs text-ink-faint">Answers customer questions in real time, with sources cited on every reply.</p>
        </div>
        <div>
          <div className="flex items-center justify-center sm:justify-start gap-2 text-hub mb-1">
            <BarChart3 className="w-4 h-4" />
            <h4 className="font-semibold text-sm text-ink">Analytics</h4>
          </div>
          <p className="text-xs text-ink-faint">Tracks volume, ratings, and feedback trends across every conversation.</p>
        </div>
        <div>
          <div className="flex items-center justify-center sm:justify-start gap-2 text-hub mb-1">
            <Ticket className="w-4 h-4" />
            <h4 className="font-semibold text-sm text-ink">Ticketing</h4>
          </div>
          <p className="text-xs text-ink-faint">Low ratings automatically escalate to a ticket for a human to follow up on.</p>
        </div>
      </div>
    </div>
  );
}
