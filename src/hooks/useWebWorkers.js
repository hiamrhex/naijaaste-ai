import { useState, useEffect, useRef, useCallback } from 'react';

// Web Worker wrapper for off-thread processing
export function useWebWorker(workerCode, options = {}) {
  const { 
    onMessage, 
    onError, 
    onReady
  } = options;

  const workerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Create blob from worker code
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);

    // Create worker
    workerRef.current = new Worker(workerUrl);

    // Set up event listeners
    workerRef.current.onmessage = (event) => {
      onMessage?.(event.data);
    };

    workerRef.current.onerror = (event) => {
      const error = new Error(`Worker error: ${event.message}`);
      setError(error);
      onError?.(error);
    };

    workerRef.current.onmessageerror = (event) => {
      const error = new Error(`Worker message error: ${event.data}`);
      setError(error);
      onError?.(error);
    };

    // Mark worker as ready
    setIsReady(true);
    onReady?.();

    return () => {
      workerRef.current.terminate();
      URL.revokeObjectURL(workerUrl);
    };
  }, [workerCode, onMessage, onError, onReady]);

  const postMessage = useCallback((message, transferables = []) => {
    if (!workerRef.current) {
      throw new Error('Worker not initialized');
    }

    workerRef.current.postMessage(message, transferables);
  }, []);

  const terminate = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
      setIsReady(false);
    }
  }, []);

  return {
    postMessage,
    terminate,
    isReady,
    error,
  };
}

// Common worker code for heavy computations
export const HEAVY_COMPUTATION_WORKER = `
  // Heavy computation worker
  self.onmessage = function(e) {
    const { type, data } = e.data;
    
    switch(type) {
      case 'fibonacci':
        const result = fibonacci(data.n);
        self.postMessage({ type, result });
        break;
        
      case 'prime-check':
        const isPrime = isPrimeNumber(data.number);
        self.postMessage({ type, result: isPrime });
        break;
        
      case 'matrix-multiply':
        const matrixResult = multiplyMatrices(data.a, data.b);
        self.postMessage({ type, result: matrixResult });
        break;
        
      case 'sort-array':
        const sortedArray = data.array.slice().sort((a, b) => a - b);
        self.postMessage({ type, result: sortedArray });
        break;
        
      default:
        self.postMessage({ error: 'Unknown operation type' });
    }
  };
  
  function fibonacci(n) {
    if (n <= 1) return n;
    let a = 0, b = 1;
    for (let i = 2; i <= n; i++) {
      [a, b] = [b, a + b];
    }
    return b;
  }
  
  function isPrimeNumber(n) {
    if (n <= 1) return false;
    if (n <= 3) return true;
    if (n % 2 === 0 || n % 3 === 0) return false;
    for (let i = 5; i * i <= n; i += 6) {
      if (n % i === 0 || n % (i + 2) === 0) return false;
    }
    return true;
  }
  
  function multiplyMatrices(a, b) {
    const result = [];
    for (let i = 0; i < a.length; i++) {
      result[i] = [];
      for (let j = 0; j < b[0].length; j++) {
        let sum = 0;
        for (let k = 0; k < b.length; k++) {
          sum += a[i][k] * b[k][j];
        }
        result[i][j] = sum;
      }
    }
    return result;
  }
`;

// Worker pool for managing multiple workers
export function useWorkerPool(workerCode, poolSize = 4) {
  const workersRef = useRef([]);
  const [availableWorkers, setAvailableWorkers] = useState([]);
  const [busyWorkers, setBusyWorkers] = useState(new Set());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Initialize worker pool
    const workers = [];
    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(URL.createObjectURL(new Blob([workerCode])));
      workers.push(worker);
    }

    workersRef.current = workers;
    setAvailableWorkers(workers);
    setIsReady(true);

    return () => {
      workers.forEach(worker => worker.terminate());
    };
  }, [workerCode, poolSize]);

  const execute = useCallback(async (message, transferables = []) => {
    return new Promise((resolve, reject) => {
      if (availableWorkers.length === 0) {
        reject(new Error('No available workers'));
        return;
      }

      const worker = availableWorkers[0];
      setAvailableWorkers(prev => prev.slice(1));
      setBusyWorkers(prev => new Set(prev).add(worker));

      const onMessage = (event) => {
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
        
        setAvailableWorkers(prev => [...prev, worker]);
        setBusyWorkers(prev => {
          const newSet = new Set(prev);
          newSet.delete(worker);
          return newSet;
        });

        resolve(event.data);
      };

      const onError = (event) => {
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
        
        setAvailableWorkers(prev => [...prev, worker]);
        setBusyWorkers(prev => {
          const newSet = new Set(prev);
          newSet.delete(worker);
          return newSet;
        });

        reject(event.error);
      };

      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      worker.postMessage(message, transferables);
    });
  }, [availableWorkers]);

  const getStats = useCallback(() => ({
    total: workersRef.current.length,
    available: availableWorkers.length,
    busy: busyWorkers.size,
    utilization: (busyWorkers.size / workersRef.current.length) * 100,
  }), [availableWorkers.length, busyWorkers.size]);

  return {
    execute,
    getStats,
    isReady,
  };
}

// Service Worker integration for caching and offline support
export function useServiceWorker(swUrl, options = {}) {
  const [registration, setRegistration] = useState(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(swUrl)
        .then(reg => {
          setRegistration(reg);
          
          // Listen for updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateReady(true);
              }
            });
          });
        })
        .catch(err => {
          setError(err);
        });
    }
  }, [swUrl]);

  const updateServiceWorker = useCallback(() => {
    if (registration) {
      registration.update();
      setUpdateReady(false);
    }
  }, [registration]);

  const skipWaiting = useCallback(() => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [registration]);

  const cacheStrategy = useCallback((request) => {
    const { cacheStrategy = 'cache-first' } = options;
    
    switch (cacheStrategy) {
      case 'cache-first':
        return caches.match(request)
          .then(response => response || fetch(request));
      case 'network-first':
        return fetch(request)
          .then(response => {
            if (response.status === 200) {
              caches.open('runtime').then(cache => cache.put(request, response.clone()));
            }
            return response;
          })
          .catch(() => caches.match(request));
      case 'network-only':
        return fetch(request);
      case 'cache-only':
        return caches.match(request);
      default:
        return fetch(request);
    }
  }, [options]);

  return {
    registration,
    updateReady,
    error,
    updateServiceWorker,
    skipWaiting,
    cacheStrategy,
  };
}

// Common service worker code
export const SERVICE_WORKER_CODE = `
  const CACHE_NAME = 'naija-taste-cache-v1';
  const urlsToCache = [
    '/',
    '/index.html',
    '/static/js/main.js',
    '/static/css/main.css'
  ];

  self.addEventListener('install', event => {
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then(cache => cache.addAll(urlsToCache))
    );
  });

  self.addEventListener('fetch', event => {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          return response || fetch(event.request);
        })
    );
  });

  self.addEventListener('activate', event => {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    );
  });

  self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
  });
`;