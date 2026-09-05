import React, { useEffect, useState } from 'react';
import { Users, UserPlus, CheckCircle, XCircle, AlertCircle, RefreshCw, Clock, Check, X, ShieldCheck } from 'lucide-react';
import { User, RoleName, RegistrationRequest } from '../../types';
import { api } from '../../services/api';

export const UserManagementView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'USERS' | 'REGISTRATIONS'>('USERS');

  const [users, setUsers] = useState<User[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create User Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RoleName>('INVESTIGATING_OFFICER');
  const [creating, setCreating] = useState(false);

  // Rejection Modal State
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [uData, rData] = await Promise.all([
        api.getUsers().catch(() => []),
        api.getPendingRegistrations().catch(() => []),
      ]);
      setUsers(uData);
      setRegistrations(rData);
    } catch (err: any) {
      setError(err.message || 'Unable to load user accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.createUser({ email, fullName, password, role });
      setIsCreateModalOpen(false);
      setEmail('');
      setFullName('');
      setPassword('');
      setRole('INVESTIGATING_OFFICER');
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to create user account.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (userItem: User) => {
    const newStatus = !userItem.isActive;
    try {
      await api.updateUserStatus(userItem.id, newStatus);
      setUsers((prev) =>
        prev.map((u) => (u.id === userItem.id ? { ...u, isActive: newStatus } : u))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to update user status.');
    }
  };

  const handleChangeRole = async (userItem: User, newRole: RoleName) => {
    try {
      await api.updateUserRole(userItem.id, newRole);
      setUsers((prev) =>
        prev.map((u) => (u.id === userItem.id ? { ...u, role: newRole } : u))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to update user role.');
    }
  };

  const handleApproveRegistration = async (id: string) => {
    try {
      await api.approveRegistration(id);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to approve registration request.');
    }
  };

  const handleRejectRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingId) return;
    setRejecting(true);
    try {
      await api.rejectRegistration(rejectingId, rejectionReason);
      setRejectingId(null);
      setRejectionReason('');
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to reject registration request.');
    } finally {
      setRejecting(false);
    }
  };

  const pendingRequests = registrations.filter((r) => r.status === 'PENDING');

  return (
    <div className="space-y-6 font-sans">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
            <Users className="w-7 h-7 text-amber-400" />
            User Management & Access Control
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Manage authorized system personnel, review account registration requests, and assign operational roles.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/20"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create User Account</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('USERS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'USERS'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Active Personnel Accounts ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('REGISTRATIONS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 relative ${
            activeTab === 'REGISTRATIONS'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Pending Registrations ({pendingRequests.length})</span>
          {pendingRequests.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping absolute -top-1 -right-1" />
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center space-y-3 text-slate-400 text-xs">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading user registry data...</span>
        </div>
      ) : activeTab === 'USERS' ? (
        /* ACTIVE USERS LIST */
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block rounded-3xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-4 px-6 font-semibold">User Details</th>
                  <th className="py-4 px-6 font-semibold">Role</th>
                  <th className="py-4 px-6 font-semibold">Status</th>
                  <th className="py-4 px-6 font-semibold">Created Date</th>
                  <th className="py-4 px-6 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-white text-sm">{u.fullName}</div>
                      <div className="text-slate-400 font-mono text-[11px]">{u.email}</div>
                    </td>
                    <td className="py-4 px-6">
                      <select
                        value={u.role}
                        onChange={(e) => handleChangeRole(u, e.target.value as RoleName)}
                        className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 font-mono font-bold text-xs focus:outline-none focus:border-amber-500"
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="INVESTIGATING_OFFICER">INVESTIGATING_OFFICER</option>
                        <option value="SUPERVISOR">SUPERVISOR</option>
                        <option value="PROSECUTOR">PROSECUTOR</option>
                      </select>
                    </td>
                    <td className="py-4 px-6">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20 font-bold text-[11px]">
                          <CheckCircle className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-xl border border-rose-500/20 font-bold text-[11px]">
                          <XCircle className="w-3.5 h-3.5" /> Deactivated
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 font-mono text-slate-400 text-[11px]">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Active'}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleToggleStatus(u)}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs border transition-colors cursor-pointer ${
                          u.isActive
                            ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {u.isActive ? 'Deactivate' : 'Enable Access'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Cards */}
          <div className="block md:hidden space-y-3">
            {users.map((u) => (
              <div key={u.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-white text-sm">{u.fullName}</h3>
                    <p className="text-slate-400 font-mono text-xs">{u.email}</p>
                  </div>
                  {u.isActive ? (
                    <span className="text-emerald-400 font-bold text-xs bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Active
                    </span>
                  ) : (
                    <span className="text-rose-400 font-bold text-xs bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                      Disabled
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <select
                    value={u.role}
                    onChange={(e) => handleChangeRole(u, e.target.value as RoleName)}
                    className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-amber-400 font-mono font-bold text-xs"
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="INVESTIGATING_OFFICER">INVESTIGATING_OFFICER</option>
                    <option value="SUPERVISOR">SUPERVISOR</option>
                    <option value="PROSECUTOR">PROSECUTOR</option>
                  </select>

                  <button
                    onClick={() => handleToggleStatus(u)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold ${
                      u.isActive ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {u.isActive ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* PENDING REGISTRATIONS TAB */
        <div className="space-y-4">
          {registrations.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/80 rounded-3xl border border-slate-800 text-slate-400 text-xs space-y-2">
              <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="font-bold text-slate-300">No Pending Registration Requests</p>
              <p className="text-slate-500">All submitted account requests have been reviewed by system administrators.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {registrations.map((r) => (
                <div
                  key={r.id}
                  className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl"
                >
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-base">{r.fullName}</h3>
                        <span
                          className={`px-2.5 py-0.5 rounded-lg font-mono text-[10px] font-bold border ${
                            r.status === 'PENDING'
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                              : r.status === 'APPROVED'
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                      <p className="text-slate-400 font-mono text-xs">{r.email}</p>
                      <p className="text-slate-400 text-xs">
                        Requested Role:{' '}
                        <strong className="text-amber-400 font-mono">{r.requestedRole}</strong>
                      </p>
                    </div>

                    <div className="text-right font-mono text-[11px] text-slate-400">
                      Submitted: {new Date(r.createdAt).toLocaleString()}
                    </div>
                  </div>

                  {r.status === 'PENDING' && (
                    <div className="flex items-center gap-2 justify-end pt-3 border-t border-slate-800">
                      <button
                        onClick={() => {
                          setRejectingId(r.id);
                          setRejectionReason('');
                        }}
                        className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                        <span>Reject Request</span>
                      </button>

                      <button
                        onClick={() => handleApproveRegistration(r.id)}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
                      >
                        <Check className="w-4 h-4" />
                        <span>Approve Account</span>
                      </button>
                    </div>
                  )}

                  {r.status === 'REJECTED' && r.rejectionReason && (
                    <p className="text-rose-400 text-xs italic bg-slate-950 p-3 rounded-xl border border-rose-500/20">
                      Rejection Reason: "{r.rejectionReason}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-400" />
              Create Official User Account
            </h3>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Full Name & Rank</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="e.g. Inspector R. Sharma"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Official Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="officer@nyayavault.gov.in"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Assigned Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as RoleName)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                >
                  <option value="INVESTIGATING_OFFICER">INVESTIGATING_OFFICER</option>
                  <option value="SUPERVISOR">SUPERVISOR</option>
                  <option value="PROSECUTOR">PROSECUTOR</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer disabled:opacity-50"
                >
                  {creating ? 'Creating User...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-500" />
              Reject Registration Request
            </h3>

            <form onSubmit={handleRejectRegistration} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Rejection Reason (Optional)</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  placeholder="Specify why the registration request is being rejected..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-rose-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingId(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejecting}
                  className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {rejecting ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
