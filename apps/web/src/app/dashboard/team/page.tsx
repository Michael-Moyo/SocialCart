'use client';

import { useState } from 'react';
import {
  Users, Plus, ChevronRight, Shield, UserCheck, TrendingUp,
  Edit2, Trash2, MoreVertical, Mail, Phone, CheckCircle, XCircle,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { cn, formatPhone } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type TeamRole = 'OWNER' | 'MANAGER' | 'AGENT' | 'SALES_REP';

interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: TeamRole;
  managerId: string | null;
  isActive: boolean;
  createdAt: string;
  manager?: { id: string; name: string; role: TeamRole } | null;
  reports?: { id: string; name: string; role: TeamRole; isActive: boolean }[];
  _count?: { assignedConversations: number };
}

interface HierarchyNode extends TeamMember {
  children: HierarchyNode[];
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useTeam() {
  return useQuery({
    queryKey: ['team'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: TeamMember[] }>('/api/v1/team');
      return res.data.data;
    },
  });
}

function useHierarchy() {
  return useQuery({
    queryKey: ['team-hierarchy'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: HierarchyNode[] }>('/api/v1/team/hierarchy');
      return res.data.data;
    },
  });
}

function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string; email?: string; phone?: string;
      role: string; managerId?: string; password: string;
    }) => {
      const res = await api.post('/api/v1/team', data);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['team'] });
      void qc.invalidateQueries({ queryKey: ['team-hierarchy'] });
    },
  });
}

function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<TeamMember> & { id: string }) => {
      const res = await api.patch(`/api/v1/team/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['team'] });
      void qc.invalidateQueries({ queryKey: ['team-hierarchy'] });
    },
  });
}

function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/v1/team/${id}`);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['team'] });
      void qc.invalidateQueries({ queryKey: ['team-hierarchy'] });
    },
  });
}

// ─── Role meta ────────────────────────────────────────────────────────────────

const ROLE_META: Record<TeamRole, { label: string; color: string; bg: string; icon: React.ElementType; description: string }> = {
  OWNER:     { label: 'Owner',     color: 'text-purple-700', bg: 'bg-purple-100', icon: Shield,    description: 'Full platform access' },
  MANAGER:   { label: 'Manager',   color: 'text-blue-700',   bg: 'bg-blue-100',   icon: UserCheck, description: 'Manages a sales team' },
  AGENT:     { label: 'Agent',     color: 'text-green-700',  bg: 'bg-green-100',  icon: Users,     description: 'Handles customer conversations' },
  SALES_REP: { label: 'Sales Rep', color: 'text-orange-700', bg: 'bg-orange-100', icon: TrendingUp, description: 'Manages leads and sales' },
};

function RoleBadge({ role }: { role: TeamRole }) {
  const meta = ROLE_META[role];
  const Icon = meta.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold', meta.color, meta.bg)}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({
  open, onClose, managers,
}: {
  open: boolean; onClose: () => void; managers: TeamMember[];
}) {
  const invite = useInviteMember();
  const [form, setForm] = useState({
    name: '', email: '', phone: '', role: 'AGENT', managerId: '', password: '',
  });
  const [error, setError] = useState('');

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  async function submit() {
    if (!form.name || !form.password) { setError('Name and password are required'); return; }
    if (!form.email && !form.phone) { setError('Email or phone is required'); return; }
    try {
      await invite.mutateAsync({
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        role: form.role,
        managerId: form.managerId || undefined,
        password: form.password,
      });
      setForm({ name: '', email: '', phone: '', role: 'AGENT', managerId: '', password: '' });
      setError('');
      onClose();
    } catch {
      setError('Failed to invite member — email may already be in use');
    }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]';

  return (
    <Modal open={open} onOpenChange={onClose} title="Invite team member" maxWidth="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
            <input className={inputCls} placeholder="Jane Doe" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select className={inputCls} value={form.role} onChange={(e) => set('role', e.target.value)}>
              {(['MANAGER', 'AGENT', 'SALES_REP'] as const).map((r) => (
                <option key={r} value={r}>{ROLE_META[r].label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" className={inputCls} placeholder="jane@company.com" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input className={inputCls} placeholder="+234..." value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
        </div>
        {managers.length > 0 && form.role !== 'MANAGER' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reports to</label>
            <select className={inputCls} value={form.managerId} onChange={(e) => set('managerId', e.target.value)}>
              <option value="">— No manager —</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Temporary password</label>
          <input type="password" className={inputCls} placeholder="Min 8 characters" value={form.password} onChange={(e) => set('password', e.target.value)} />
          <p className="text-xs text-gray-400 mt-1">Member should change this on first login</p>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-2 pt-2">
          <Button onClick={submit} loading={invite.isPending} className="flex-1">Send invite</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Org Chart Node ───────────────────────────────────────────────────────────

function OrgNode({ node, depth = 0 }: { node: HierarchyNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const meta = ROLE_META[node.role];
  const Icon = meta.icon;
  const hasChildren = node.children.length > 0;

  return (
    <div className={cn('pl-4', depth > 0 && 'border-l-2 border-gray-100 ml-4')}>
      <div className="flex items-center gap-3 py-2 group">
        <div className={cn('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-sm', meta.bg, meta.color)}>
          {node.name[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{node.name}</span>
            <RoleBadge role={node.role} />
            {!node.isActive && <span className="text-xs text-red-500">Inactive</span>}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
            {node.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{node.email}</span>}
            {node.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{formatPhone(node.phone)}</span>}
            {node._count && <span>{node._count.assignedConversations} conversations</span>}
          </div>
        </div>
        {hasChildren && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <ChevronRight className={cn('h-4 w-4 transition-transform', expanded && 'rotate-90')} />
          </button>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <OrgNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Member Table Row ─────────────────────────────────────────────────────────

function MemberRow({ member }: { member: TeamMember }) {
  const update = useUpdateMember();
  const remove = useRemoveMember();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
            ROLE_META[member.role].bg, ROLE_META[member.role].color)}>
            {member.name[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{member.name}</p>
            {member.email && <p className="text-xs text-gray-400">{member.email}</p>}
            {member.phone && <p className="text-xs text-gray-400">{formatPhone(member.phone)}</p>}
          </div>
        </div>
      </td>
      <td className="px-5 py-3"><RoleBadge role={member.role} /></td>
      <td className="px-5 py-3 text-sm text-gray-500">
        {member.manager ? (
          <span className="flex items-center gap-1">
            <UserCheck className="h-3.5 w-3.5 text-gray-300" />
            {member.manager.name}
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
      <td className="px-5 py-3">
        <span className="text-sm font-medium text-gray-900">
          {member._count?.assignedConversations ?? 0}
        </span>
        <span className="text-xs text-gray-400 ml-1">convos</span>
      </td>
      <td className="px-5 py-3">
        {member.isActive ? (
          <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle className="h-3.5 w-3.5" />Active</span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-gray-400"><XCircle className="h-3.5 w-3.5" />Inactive</span>
        )}
      </td>
      <td className="px-5 py-3">
        <div className="relative">
          <button onClick={() => setMenuOpen((v) => !v)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 w-40 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
              <button
                onClick={() => { update.mutate({ id: member.id, isActive: !member.isActive }); setMenuOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                {member.isActive ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                {member.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={() => { if (confirm(`Remove ${member.name}?`)) remove.mutate(member.id); setMenuOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const [view, setView] = useState<'list' | 'org'>('list');
  const [showInvite, setShowInvite] = useState(false);

  const { data: members = [], isLoading } = useTeam();
  const { data: hierarchy = [] } = useHierarchy();

  const managers = members.filter((m) => ['OWNER', 'MANAGER'].includes(m.role));
  const byRole = {
    OWNER: members.filter((m) => m.role === 'OWNER'),
    MANAGER: members.filter((m) => m.role === 'MANAGER'),
    AGENT: members.filter((m) => m.role === 'AGENT'),
    SALES_REP: members.filter((m) => m.role === 'SALES_REP'),
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="Team" description="Manage your team members and sales hierarchy" />

      <div className="p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {(['OWNER', 'MANAGER', 'AGENT', 'SALES_REP'] as const).map((role) => {
            const meta = ROLE_META[role];
            const Icon = meta.icon;
            const count = byRole[role].length;
            return (
              <div key={role} className={cn('rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3')}>
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', meta.bg)}>
                  <Icon className={cn('h-5 w-5', meta.color)} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{meta.label}s</p>
                  <p className="text-xl font-bold text-gray-900">{count}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setView('list')}
              className={cn('px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                view === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}
            >
              List
            </button>
            <button
              onClick={() => setView('org')}
              className={cn('px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                view === 'org' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}
            >
              Org chart
            </button>
          </div>
          <Button onClick={() => setShowInvite(true)}>
            <Plus className="h-4 w-4" />
            Invite member
          </Button>
        </div>

        {/* List view */}
        {view === 'list' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Member', 'Role', 'Reports to', 'Conversations', 'Status', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(6)].map((__, j) => (
                        <td key={j} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : members.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <Users className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">No team members yet</p>
                      <Button size="sm" className="mt-3" onClick={() => setShowInvite(true)}>
                        <Plus className="h-4 w-4" /> Invite first member
                      </Button>
                    </td>
                  </tr>
                ) : (
                  members.map((m) => <MemberRow key={m.id} member={m} />)
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Org chart view */}
        {view === 'org' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <p className="text-xs text-gray-400 mb-4 font-medium uppercase tracking-wide">Reporting structure</p>
            {hierarchy.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Invite team members to see the org chart</p>
            ) : (
              hierarchy.map((node) => <OrgNode key={node.id} node={node} />)
            )}
          </div>
        )}
      </div>

      <InviteModal open={showInvite} onClose={() => setShowInvite(false)} managers={managers} />
    </div>
  );
}
