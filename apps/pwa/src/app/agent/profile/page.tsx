'use client';

import { useRouter } from 'next/navigation';
import { getAgentProfile } from '@/lib/agent-api';

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  AGENT: 'Agent',
  SALES_REP: 'Sales Rep',
};

const ROLE_COLOR: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  AGENT: 'bg-green-100 text-green-700',
  SALES_REP: 'bg-orange-100 text-orange-700',
};

export default function ProfilePage() {
  const router = useRouter();
  const profile = getAgentProfile();

  function logout() {
    localStorage.removeItem('agent_token');
    localStorage.removeItem('agent_profile');
    router.replace('/agent/login');
  }

  if (!profile) return null;

  const initials = profile.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col h-full bg-[#F0F2F5]">
      <div className="bg-[#075E54] pt-safe px-4 pb-6 text-center">
        <div className="w-20 h-20 rounded-full bg-[#DFE5E7] flex items-center justify-center text-[#54656F] font-bold text-2xl mx-auto mb-3">
          {initials}
        </div>
        <h2 className="text-white font-bold text-lg">{profile.name}</h2>
        <span className={`inline-block mt-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${ROLE_COLOR[profile.role] ?? 'bg-gray-100 text-gray-600'}`}>
          {ROLE_LABEL[profile.role] ?? profile.role}
        </span>
      </div>

      <div className="flex-1 px-4 py-4 space-y-3">
        <div className="bg-white rounded-2xl divide-y divide-gray-50 overflow-hidden shadow-sm">
          {profile.email && (
            <Row label="Email" value={profile.email} />
          )}
          {profile.phone && (
            <Row label="Phone" value={profile.phone} />
          )}
          <Row label="Role" value={ROLE_LABEL[profile.role] ?? profile.role} />
        </div>

        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <button
            onClick={logout}
            className="w-full px-4 py-4 text-left text-sm font-semibold text-red-500 active:bg-red-50 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}
