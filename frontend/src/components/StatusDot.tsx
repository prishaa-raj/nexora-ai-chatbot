/**
 * StatusDot -- the app's recurring status indicator.
 *
 * Mirrors the physical hub's own LED behavior (documented in the
 * troubleshooting guide): solid blue = connected, amber = pending/resetting,
 * red = error, gray = idle/unknown. Used for backend connectivity, ticket
 * status, and message delivery state so the same three colors always mean
 * the same thing throughout the app.
 */
export type DotState = 'live' | 'pending' | 'error' | 'idle';

const STATE_STYLES: Record<DotState, string> = {
  live: 'bg-status-green',
  pending: 'bg-status-amber',
  error: 'bg-status-red',
  idle: 'bg-ink-faint',
};

export function StatusDot({
  state,
  pulse = false,
  className = '',
}: {
  state: DotState;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${STATE_STYLES[state]} ${pulse ? 'status-dot-live' : ''} ${className}`}
      aria-hidden="true"
    />
  );
}

const BADGE_STYLES: Record<DotState, string> = {
  live: 'bg-status-green-soft text-status-green',
  pending: 'bg-status-amber-soft text-status-amber',
  error: 'bg-status-red-soft text-status-red',
  idle: 'bg-surface text-ink-soft',
};

export function StatusBadge({
  state,
  label,
  pulse = false,
}: {
  state: DotState;
  label: string;
  pulse?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold font-mono ${BADGE_STYLES[state]}`}
    >
      <StatusDot state={state} pulse={pulse} />
      {label}
    </span>
  );
}
