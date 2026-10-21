import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import { getUnreadNotificationsCount, getNotifications, markNotificationRead, markAllNotificationsRead } from '../api/client';
import dayjs from 'dayjs';

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const fetchCount = async () => {
    try {
      const res = await getUnreadNotificationsCount();
      setUnreadCount(res.unread || 0);
    } catch (e) {}
  };

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await getNotifications();
      setNotifications(res.data || []);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000); // Poll every 30s as per spec
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchList();
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (id, link) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.notificationId === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      if (link) {
        window.location.href = link;
      }
    } catch (e) {}
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (e) {}
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition focus:outline-none"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-500 rounded-full ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80 border-b border-slate-100">
            <span className="text-sm font-bold text-slate-800">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="inline-flex items-center text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No notifications yet.</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.notificationId}
                  onClick={() => handleMarkRead(n.notificationId, n.link)}
                  className={`p-3.5 hover:bg-slate-50 transition cursor-pointer ${
                    !n.isRead ? 'bg-brand-50/30' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-xs font-semibold ${!n.isRead ? 'text-brand-900' : 'text-slate-700'}`}>
                      {n.title}
                    </p>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {dayjs(n.createdAt).format('DD MMM, hh:mm A')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                    {n.message}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
