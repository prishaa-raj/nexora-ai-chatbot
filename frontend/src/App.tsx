import React, { useState, useEffect } from 'react';
import { Radio, ShieldCheck } from 'lucide-react';
import AuthScreen from './components/AuthScreen';
import CustomerPortal from './components/CustomerPortal';
import AdminDashboard from './components/AdminDashboard';
import { StatusDot, DotState } from './components/StatusDot';
import { apiFetch } from './api';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; name: string; email: string; role: 'admin' | 'user' } | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendStatus, setBackendStatus] = useState<DotState>('idle');

  // Check localStorage on boot
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  // Real connection indicator, not a decoration: ping the API on an
  // interval and reflect the actual result in the header's status dot.
  useEffect(() => {
    let cancelled = false;

    const ping = async () => {
      try {
        const res = await apiFetch('/api/health');
        if (!cancelled) setBackendStatus(res.ok ? 'live' : 'error');
      } catch {
        if (!cancelled) setBackendStatus('error');
      }
    };

    ping();
    const interval = setInterval(ping, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleLoginSuccess = (newToken: string, newUser: { id: string; name: string; email: string; role: 'admin' | 'user' }) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-hub border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-ink-soft text-sm font-medium">Loading SmartHelp Portal…</p>
        </div>
      </div>
    );
  }

  if (!token || !user) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col font-sans">
      <header className="bg-card border-b border-line h-16 px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-hub" strokeWidth={2.25} />
            <span className="font-display font-semibold text-ink text-base tracking-tight">
              SmartHelp
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 pl-3 border-l border-line">
            <StatusDot state={backendStatus} pulse={backendStatus === 'live'} />
            <span className="text-xs font-mono text-ink-faint">
              {backendStatus === 'live' ? 'connected' : backendStatus === 'error' ? 'offline' : 'checking…'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-lg">
            {user.role === 'admin' ? (
              <ShieldCheck className="w-4 h-4 text-hub" />
            ) : (
              <span className="w-4 h-4 rounded-full bg-hub-soft text-hub text-[10px] font-bold flex items-center justify-center font-mono">
                {user.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="text-xs font-semibold text-ink-soft">
              {user.role === 'admin' ? 'Admin' : 'Customer'}
            </span>
          </div>

          <div className="hidden sm:block text-right">
            <p className="text-xs font-semibold text-ink leading-tight truncate max-w-[140px]">{user.name}</p>
            <p className="text-[11px] text-ink-faint font-mono">{user.email}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {user.role === 'admin' ? (
          <AdminDashboard user={user} token={token} onLogout={handleLogout} />
        ) : (
          <CustomerPortal user={user} token={token} onLogout={handleLogout} />
        )}
      </main>
    </div>
  );
}
