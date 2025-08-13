import { useState, useEffect, useCallback } from 'react';

export interface PWAInstallPrompt {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PWACapabilities {
  isInstallable: boolean;
  isInstalled: boolean;
  isOnline: boolean;
  hasServiceWorker: boolean;
  canShare: boolean;
  canNotify: boolean;
  hasBackgroundSync: boolean;
  hasPersistentStorage: boolean;
}

export interface PWAUpdateInfo {
  isUpdateAvailable: boolean;
  skipWaiting: () => void;
  reload: () => void;
}

export interface OfflineAction {
  id: string;
  type: 'create' | 'update' | 'delete';
  endpoint: string;
  method: string;
  data: any;
  timestamp: Date;
  retryCount: number;
}

export function usePWA() {
  const [installPrompt, setInstallPrompt] = useState<PWAInstallPrompt | null>(null);
  const [capabilities, setCapabilities] = useState<PWACapabilities>({
    isInstallable: false,
    isInstalled: false,
    isOnline: navigator.onLine,
    hasServiceWorker: 'serviceWorker' in navigator,
    canShare: 'share' in navigator,
    canNotify: 'Notification' in window,
    hasBackgroundSync: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype,
    hasPersistentStorage: 'storage' in navigator && 'persist' in navigator.storage
  });
  const [updateInfo, setUpdateInfo] = useState<PWAUpdateInfo>({
    isUpdateAvailable: false,
    skipWaiting: () => {},
    reload: () => window.location.reload()
  });
  const [offlineActions, setOfflineActions] = useState<OfflineAction[]>([]);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('Service Worker registered:', reg);
          setRegistration(reg);

          // Check for updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setUpdateInfo({
                    isUpdateAvailable: true,
                    skipWaiting: () => {
                      newWorker.postMessage({ type: 'SKIP_WAITING' });
                    },
                    reload: () => window.location.reload()
                  });
                }
              });
            }
          });

          // Handle service worker messages
          navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'SW_UPDATE_READY') {
              setUpdateInfo(prev => ({ ...prev, isUpdateAvailable: true }));
            }
          });
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, []);

  // Handle install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const installEvent = event as any;
      setInstallPrompt(installEvent);
      setCapabilities(prev => ({ ...prev, isInstallable: true }));
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setCapabilities(prev => ({ 
        ...prev, 
        isInstalled: true, 
        isInstallable: false 
      }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setCapabilities(prev => ({ ...prev, isOnline: true }));
      syncOfflineActions();
    };

    const handleOffline = () => {
      setCapabilities(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check if app is installed
  useEffect(() => {
    const checkInstallStatus = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isInWebAppiOS = (window.navigator as any).standalone === true;
      const isInstalled = isStandalone || isInWebAppiOS;
      
      setCapabilities(prev => ({ ...prev, isInstalled }));
    };

    checkInstallStatus();
    window.matchMedia('(display-mode: standalone)').addEventListener('change', checkInstallStatus);
  }, []);

  // Install PWA
  const installPWA = useCallback(async () => {
    if (!installPrompt) return false;

    try {
      await installPrompt.prompt();
      const choiceResult = await installPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        setInstallPrompt(null);
        setCapabilities(prev => ({ 
          ...prev, 
          isInstalled: true, 
          isInstallable: false 
        }));
        return true;
      }
    } catch (error) {
      console.error('PWA installation failed:', error);
    }
    
    return false;
  }, [installPrompt]);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;

    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Notification permission request failed:', error);
      return false;
    }
  }, []);

  // Send notification
  const sendNotification = useCallback(async (title: string, options?: NotificationOptions) => {
    if (!capabilities.canNotify || Notification.permission !== 'granted') {
      return false;
    }

    try {
      if (registration) {
        await registration.showNotification(title, {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          ...options
        });
      } else {
        new Notification(title, {
          icon: '/icons/icon-192x192.png',
          ...options
        });
      }
      return true;
    } catch (error) {
      console.error('Notification failed:', error);
      return false;
    }
  }, [capabilities.canNotify, registration]);

  // Share content
  const shareContent = useCallback(async (shareData: ShareData) => {
    if (!capabilities.canShare) return false;

    try {
      await navigator.share(shareData);
      return true;
    } catch (error) {
      console.error('Share failed:', error);
      return false;
    }
  }, [capabilities.canShare]);

  // Add offline action
  const addOfflineAction = useCallback(async (action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>) => {
    const offlineAction: OfflineAction = {
      ...action,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      retryCount: 0
    };

    // Store in IndexedDB
    try {
      await storeOfflineAction(offlineAction);
      setOfflineActions(prev => [...prev, offlineAction]);
      
      // Register background sync if available
      if (registration && capabilities.hasBackgroundSync) {
        await registration.sync.register('sync-offline-actions');
      }
    } catch (error) {
      console.error('Failed to store offline action:', error);
    }
  }, [registration, capabilities.hasBackgroundSync]);

  // Sync offline actions
  const syncOfflineActions = useCallback(async () => {
    if (!capabilities.isOnline) return;

    try {
      const actions = await getOfflineActions();
      
      for (const action of actions) {
        try {
          const response = await fetch(action.endpoint, {
            method: action.method,
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(action.data)
          });

          if (response.ok) {
            await removeOfflineAction(action.id);
            setOfflineActions(prev => prev.filter(a => a.id !== action.id));
          } else {
            // Increment retry count
            action.retryCount++;
            await storeOfflineAction(action);
          }
        } catch (error) {
          console.error('Failed to sync offline action:', error);
          action.retryCount++;
          await storeOfflineAction(action);
        }
      }
    } catch (error) {
      console.error('Offline sync failed:', error);
    }
  }, [capabilities.isOnline]);

  // Request persistent storage
  const requestPersistentStorage = useCallback(async () => {
    if (!capabilities.hasPersistentStorage) return false;

    try {
      const granted = await navigator.storage.persist();
      return granted;
    } catch (error) {
      console.error('Persistent storage request failed:', error);
      return false;
    }
  }, [capabilities.hasPersistentStorage]);

  // Get storage estimate
  const getStorageEstimate = useCallback(async () => {
    if (!('storage' in navigator && 'estimate' in navigator.storage)) {
      return null;
    }

    try {
      const estimate = await navigator.storage.estimate();
      return {
        quota: estimate.quota || 0,
        usage: estimate.usage || 0,
        usagePercentage: estimate.quota ? (estimate.usage || 0) / estimate.quota * 100 : 0
      };
    } catch (error) {
      console.error('Storage estimate failed:', error);
      return null;
    }
  }, []);

  // Cache geological data
  const cacheGeologicalData = useCallback(async (data: any) => {
    if (registration) {
      registration.active?.postMessage({
        type: 'CACHE_GEOLOGICAL_DATA',
        data
      });
    }
  }, [registration]);

  // Clear all caches
  const clearCaches = useCallback(async () => {
    if (registration) {
      registration.active?.postMessage({
        type: 'CLEAR_CACHE'
      });
    }
  }, [registration]);

  return {
    // Installation
    installPWA,
    installPrompt,
    
    // Capabilities
    capabilities,
    
    // Updates
    updateInfo,
    
    // Notifications
    requestNotificationPermission,
    sendNotification,
    
    // Sharing
    shareContent,
    
    // Offline functionality
    offlineActions,
    addOfflineAction,
    syncOfflineActions,
    
    // Storage
    requestPersistentStorage,
    getStorageEstimate,
    
    // Caching
    cacheGeologicalData,
    clearCaches,
    
    // Service worker
    registration
  };
}

// IndexedDB helpers
async function storeOfflineAction(action: OfflineAction): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('GeoVisionOffline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['actions'], 'readwrite');
      const store = transaction.objectStore('actions');
      const putRequest = store.put(action);
      
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('actions')) {
        db.createObjectStore('actions', { keyPath: 'id' });
      }
    };
  });
}

async function getOfflineActions(): Promise<OfflineAction[]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('GeoVisionOffline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['actions'], 'readonly');
      const store = transaction.objectStore('actions');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('actions')) {
        db.createObjectStore('actions', { keyPath: 'id' });
      }
    };
  });
}

async function removeOfflineAction(id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('GeoVisionOffline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['actions'], 'readwrite');
      const store = transaction.objectStore('actions');
      const deleteRequest = store.delete(id);
      
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };
  });
}