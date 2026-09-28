import React, { useEffect, useState } from 'react';
import { Bell, CheckCircle2 } from 'lucide-react';
import { collection, getDocs, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type NotificationRecord = {
  id: string;
  title?: string;
  message?: string;
  createdAt?: { toDate?: () => Date };
  read?: boolean;
};

export default function NotificationsPage() {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadNotifications = async () => {
      if (!currentUser) {
        setNotifications([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const snapshot = await getDocs(query(
          collection(db, 'notifications'),
          where('uid', '==', currentUser.uid),
          orderBy('createdAt', 'desc'),
        ));
        if (!mounted) return;
        setNotifications(snapshot.docs.map(document => ({
          id: document.id,
          ...(document.data() as Omit<NotificationRecord, 'id'>),
        })));
      } catch (error) {
        console.error('Unable to load notifications:', error);
        if (mounted) setNotifications([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void loadNotifications();
    return () => { mounted = false; };
  }, [currentUser?.uid]);

  const markAllAsRead = async () => {
    if (!currentUser || markingRead) return;
    const unread = notifications.filter(notification => !notification.read);
    if (unread.length === 0) return;
    setMarkingRead(true);
    try {
      await Promise.all(unread.map(notification =>
        updateDoc(notificationRef(notification.id), { read: true }),
      ));
      setNotifications(current => current.map(notification => ({ ...notification, read: true })));
    } catch (error) {
      console.error('Unable to mark notifications as read:', error);
    } finally {
      setMarkingRead(false);
    }
  };

  const notificationRef = (id: string) => {
    return requireNotificationDocument(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">Updates and alerts from UniqueOS.</p>
        </div>
        <button
          type="button"
          onClick={() => void markAllAsRead()}
          disabled={markingRead || notifications.every(notification => notification.read)}
          className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40 flex items-center gap-1"
        >
          <CheckCircle2 className="w-4 h-4" />
          {markingRead ? 'Marking…' : 'Mark all as read'}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading notifications…</div>
        ) : notifications.length === 0 ? (
          <div className="p-10 text-center">
            <Bell className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-900">No notifications</p>
            <p className="text-xs text-slate-500 mt-1">New account and activity alerts will appear here.</p>
          </div>
        ) : (
          notifications.map(notification => {
            const date = notification.createdAt?.toDate?.();
            return (
              <div key={notification.id} className="p-6 flex items-start gap-4 border-b border-slate-100 last:border-b-0">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-slate-900">{notification.title || 'UniqueOS notification'}</h4>
                  <p className="text-sm text-slate-600 mt-1">{notification.message || 'You have a new update.'}</p>
                  {date && <p className="text-xs text-slate-400 mt-2">{date.toLocaleString()}</p>}
                </div>
                {!notification.read && <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 shrink-0" />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function requireNotificationDocument(id: string) {
  return { id };
}
