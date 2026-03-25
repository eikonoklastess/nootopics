import { useMemo } from 'react';
import { StatusIndicator } from '../../components/StatusIndicator';
import type { PresenceStatus, ServerMember } from './types';

interface MemberListPanelProps {
  members: ServerMember[];
  onClose: () => void;
}

const ROLE_ORDER = ['ADMIN', 'MODERATOR', 'GUEST'] as const;
const ROLE_LABELS: Record<(typeof ROLE_ORDER)[number], string> = {
  ADMIN: 'Admin',
  MODERATOR: 'Moderator',
  GUEST: 'Guest',
};

function statusSortKey(status?: PresenceStatus): number {
  switch (status) {
    case 'ONLINE':
      return 0;
    case 'IDLE':
      return 1;
    case 'DND':
      return 2;
    default:
      return 3;
  }
}

function resolveRole(member: ServerMember): (typeof ROLE_ORDER)[number] {
  if (member.role === 'ADMIN' || member.role === 'MODERATOR' || member.role === 'GUEST') {
    return member.role;
  }
  return 'GUEST';
}

function isOffline(status?: PresenceStatus): boolean {
  return status === 'OFFLINE' || status === undefined;
}

export function MemberListPanel({ members, onClose }: MemberListPanelProps) {
  const grouped = useMemo(() => {
    const buckets: Record<(typeof ROLE_ORDER)[number], ServerMember[]> = {
      ADMIN: [],
      MODERATOR: [],
      GUEST: [],
    };
    for (const member of members) {
      buckets[resolveRole(member)].push(member);
    }
    for (const key of ROLE_ORDER) {
      buckets[key].sort((a, b) => {
        const byStatus = statusSortKey(a.status) - statusSortKey(b.status);
        if (byStatus !== 0) return byStatus;
        return a.name.localeCompare(b.name);
      });
    }
    return buckets;
  }, [members]);

  return (
    <div className="absolute inset-0 md:relative md:inset-auto w-full md:w-60 bg-white dark:bg-[#2B2D31] border-l border-zinc-200 dark:border-zinc-700 flex flex-col z-30 shrink-0">
      <div className="h-12 shrink-0 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 px-4">
        <h2 className="text-base font-semibold">Members</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          aria-label="Close member list"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {ROLE_ORDER.map((roleKey) => {
          const list = grouped[roleKey];
          if (list.length === 0) return null;
          return (
            <section key={roleKey} className="mb-4 last:mb-0">
              <h3 className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                {ROLE_LABELS[roleKey]} — {list.length}
              </h3>
              <ul className="space-y-1">
                {list.map((member) => {
                  const offline = isOffline(member.status);
                  return (
                    <li key={member._id}>
                      <div
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${offline ? 'opacity-50' : ''}`}
                      >
                        <div className="relative shrink-0">
                          <img
                            src={member.imageUrl}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover"
                          />
                          <StatusIndicator status={member.status} />
                        </div>
                        <span className="min-w-0 truncate text-sm font-semibold">{member.name}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
