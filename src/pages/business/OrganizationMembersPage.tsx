import React, { useState, useEffect } from 'react';
import { Users, Plus, Shield, Search, MoreVertical, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { OrganizationMember, UniqueUser } from '../../lib/os/types';

export default function OrganizationMembersPage() {
  const { currentUser, hasRole } = useAuth();
  const [members, setMembers] = useState<(OrganizationMember & { user?: UniqueUser })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real implementation, you would query the 'organization_members' collection
    // where organizationId == currentBusinessId
    // For now, we simulate fetching the owner
    const fetchMembers = async () => {
      setLoading(true);
      setTimeout(() => {
        setMembers([
          {
            id: '1',
            organizationId: 'bus_123',
            uid: currentUser?.uid || '',
            roleId: 'owner',
            status: 'active',
            user: {
              fullName: 'Current User',
              email: currentUser?.email || '',
              roles: ['business_owner'],
              status: 'active'
            } as any
          }
        ]);
        setLoading(false);
      }, 1000);
    };
    
    fetchMembers();
  }, [currentUser]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Organization & Staff</h1>
          <p className="text-sm text-slate-500 mt-1">Manage team members, roles, and branch assignments.</p>
        </div>
        <button className="bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" /> Invite Member
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search members by name or email..." 
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none w-full sm:w-auto">
              <option value="all">All Roles</option>
              <option value="admin">Admins</option>
              <option value="staff">Staff</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <p>Loading members...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-white">
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Member</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Branch</th>
                  <th className="p-4 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map(member => (
                  <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                          <Users className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{member.user?.fullName}</p>
                          <p className="text-sm text-slate-500">{member.user?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-indigo-500" />
                        <span className="font-medium text-slate-900 capitalize">{member.roleId}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full capitalize">
                        {member.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-600">Headquarters</td>
                    <td className="p-4">
                      <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
