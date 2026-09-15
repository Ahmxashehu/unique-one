import React, { useState, useEffect, useCallback } from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, Video, AlertCircle, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import firebaseConfig from '../../firebase-applet-config.json';

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  hangoutLink?: string;
}

export default function BookingsPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tokenClient, setTokenClient] = useState<any>(null);

  const fetchEvents = useCallback(async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/calendar/events', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch calendar events');
      }
      
      const data = await response.json();
      setEvents(data.items || []);
      setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching events');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initialize Google Identity Services
    const initClient = () => {
      const globalWindow = window as any;
      const clientId = firebaseConfig.oAuthClientId || '';
      
      if (!clientId) {
        setError('OAuth Client ID is missing from configuration.');
        return;
      }

      if (globalWindow.google && globalWindow.google.accounts && globalWindow.google.accounts.oauth2) {
        const client = globalWindow.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/calendar.events',
          callback: (tokenResponse: any) => {
            if (tokenResponse && tokenResponse.access_token) {
              fetchEvents(tokenResponse.access_token);
            }
          },
        });
        setTokenClient(client);
      } else {
        // Retry if script hasn't loaded yet
        setTimeout(initClient, 1000);
      }
    };
    
    initClient();
  }, [fetchEvents]);

  const handleConnect = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken();
    } else {
      setError('Google Identity Services not loaded yet. Please try again in a moment.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Bookings</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your schedule and appointments across UniqueOS.</p>
        </div>
        {isAuthenticated && (
          <button 
            onClick={handleConnect}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
      </div>

      {!isAuthenticated ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center mt-6">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CalendarIcon className="w-10 h-10 text-indigo-600" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900">Connect your Calendar</h3>
          <p className="text-slate-500 mt-2 max-w-sm mx-auto">
            UniqueOS uses Google Calendar to seamlessly sync and manage your bookings. Connect your account to continue.
          </p>
          <button 
            onClick={handleConnect}
            className="mt-6 bg-slate-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-800 transition-colors flex items-center gap-2 mx-auto"
          >
            <CalendarIcon className="w-5 h-5" />
            Connect Google Calendar
          </button>
          
          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg text-sm inline-flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 font-semibold text-slate-900 flex justify-between items-center">
            <span>Upcoming Bookings</span>
          </div>
          
          {loading ? (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center">
              <RefreshCw className="w-8 h-8 animate-spin text-slate-300 mb-4" />
              <p>Syncing calendar...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-500">No upcoming bookings found in your calendar.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {events.map((event) => {
                const startTime = event.start.dateTime 
                  ? parseISO(event.start.dateTime)
                  : event.start.date ? parseISO(event.start.date) : new Date();
                
                return (
                  <div key={event.id} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 bg-indigo-50 text-indigo-700 flex flex-col items-center justify-center rounded-xl shrink-0">
                        <span className="text-xs font-semibold uppercase">{format(startTime, 'MMM')}</span>
                        <span className="text-xl font-bold leading-none">{format(startTime, 'd')}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-base font-semibold text-slate-900 truncate">{event.summary || 'Untitled Booking'}</h4>
                        <div className="mt-2 space-y-1">
                          {event.start.dateTime && (
                            <div className="flex items-center text-sm text-slate-500">
                              <Clock className="w-4 h-4 mr-2 shrink-0" />
                              <span>{format(startTime, 'h:mm a')}</span>
                            </div>
                          )}
                          {event.location && (
                            <div className="flex items-center text-sm text-slate-500">
                              <MapPin className="w-4 h-4 mr-2 shrink-0" />
                              <span className="truncate">{event.location}</span>
                            </div>
                          )}
                          {event.hangoutLink && (
                            <div className="flex items-center text-sm text-blue-600 mt-2">
                              <Video className="w-4 h-4 mr-2 shrink-0" />
                              <a href={event.hangoutLink} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                                Join Video Call
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
