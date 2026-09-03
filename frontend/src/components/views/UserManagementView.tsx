import React, { useEffect, useState } from 'react';
import { Users, UserPlus, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { User, RoleName } from '../../types';
import { api } from '../../services/api';

export const UserManagementView: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create User Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RoleName>('INVESTIGATING_OFFICER');
  const [creating, setCreating] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Unable to load user accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
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
      await fetchUsers();
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

  return (
    <div className="space-y-6 font-sans">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
            <Users className="w-7 h-7 text-amber-400" />
            User Management
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Manage authorized system personnel, operational role assignments, and security accounts.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/20"
        >
          <UserPlus className="w-4 h-4" />
          <span>Create User Account</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* DESKTOP USERS TABLE (hidden on small mobile screens) */}
      <div className="hidden md:block rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 font-bold">User</th>
                <th className="py-3.5 px-4 font-bold">Official Email</th>
                <th className="py-3.5 px-4 font-bold">Assigned Role</th>
                <th className="py-3.5 px-4 font-bold">Account Status</th>
                <th className="py-3.5 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                      <span>Loading user accounts...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No user accounts found.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white">
                      {u.fullName}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {u.email}
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={u.role}
                        onChange={(e) => handleChangeRole(u, e.target.value as RoleName)}
                        className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-amber-400 font-mono font-bold text-[11px] focus:outline-none cursor-pointer"
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="INVESTIGATING_OFFICER">INVESTIGATING_OFFICER</option>
                        <option value="SUPERVISOR">SUPERVISOR</option>
                        <option value="PROSECUTOR">PROSECUTOR</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                          <CheckCircle className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 border border-rose-500/30 text-rose-400">
                          <XCircle className="w-3 h-3" />
                          <span>Disabled</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleToggleStatus(u)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                          u.isActive
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                        }`}
                      >
                        {u.isActive ? 'Disable Account' : 'Enable Account'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOBILE STACKED CARDS (shown only on mobile viewports < md / ~390px) */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
            <span>Loading user accounts...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">No user accounts found.</div>
        ) : (
          users.map((u) => (
            <div key={u.id} className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-white text-sm">{u.fullName}</div>
                  <div className="font-mono text-[11px] text-slate-400">{u.email}</div>
                </div>

                {u.isActive ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
                    <CheckCircle className="w-3 h-3" />
                    <span>Active</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 border border-rose-500/30 text-rose-400 shrink-0">
                    <XCircle className="w-3 h-3" />
                    <span>Disabled</span>
                  </span>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <select
                  value={u.role}
                  onChange={(e) => handleChangeRole(u, e.target.value as RoleName)}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-amber-400 font-mono font-bold text-[11px] focus:outline-none cursor-pointer"
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="INVESTIGATING_OFFICER">INVESTIGATING_OFFICER</option>
                  <option value="SUPERVISOR">SUPERVISOR</option>
                  <option value="PROSECUTOR">PROSECUTOR</option>
                </select>

                <button
                  onClick={() => handleToggleStatus(u)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                    u.isActive
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  }`}
                >
                  {u.isActive ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-400" />
                Create Personnel Account
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Inspector A. Kumar"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Official Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="user@nyayavault.gov.in"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Initial Password (min 8 chars)</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Role Assignment</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as RoleName)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 font-bold focus:outline-none"
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
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
