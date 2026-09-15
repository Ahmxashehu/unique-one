import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      // Show your customized install prompt
      setShowInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    window.addEventListener('appinstalled', () => {
      // Hide the app-provided install promotion
      setShowInstall(false);
      // Clear the deferredPrompt so it can be garbage collected
      setDeferredPrompt(null);
      console.log('Unique One App was installed successfully');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowInstall(false);
    }
    
    // Clear the deferredPrompt
    setDeferredPrompt(null);
  };

  if (!showInstall) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-sm bg-slate-900 text-white p-4 rounded-2xl shadow-2xl z-[100] flex items-center justify-between gap-4 border border-slate-700">
      <div className="flex-1">
        <h4 className="font-semibold text-sm">Install Unique One App</h4>
        <p className="text-xs text-slate-300 mt-0.5">Add to your home screen for the full ecosystem experience.</p>
      </div>
      <button 
        onClick={handleInstall} 
        className="flex-shrink-0 bg-white text-slate-900 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-100 transition-colors shadow-sm"
      >
        Install
      </button>
      <button 
        onClick={() => setShowInstall(false)} 
        className="text-slate-400 hover:text-white p-1 ml-1"
        aria-label="Dismiss install prompt"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
