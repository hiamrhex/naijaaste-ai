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

  // Callers usually pass inline handlers. Keeping them in a ref means the
  // worker is created once per script instead of being torn down and rebuilt
  // on every render.
  const callbacksRef = useRef({ onMessage, onError, onReady });
  useEffect(() => {
    callbacksRef.current = { onMessage, onError, onReady };
  });

  useEffect(() => {
    // Create blob from worker code
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);

    // Create worker
    const worker = new Worker(workerUrl);
    workerRef.current = worker;

    // Set up event listeners
    worker.onmessage = (event) => {
      callbacksRef.current.onMessage?.(event.data);
    };

    worker.onerror = (event) => {
      const error = new Error(`Worker error: ${event.message}`);
      setError(error);
      callbacksRef.current.onError?.(error);
    };

    worker.onmessageerror = (event) => {
      const error = new Error(`Worker message error: ${event.data}`);
      setError(error);
      callbacksRef.current.onError?.(error);
    };

    // Mark worker as ready
    setIsReady(true);
    callbacksRef.current.onReady?.();

    return () => {
      // `terminate()` may already have run; the ref is null in that case.
      workerRef.current?.terminate();
      workerRef.current = null;
      URL.revokeObjectURL(workerUrl);
    };
  }, [workerCode]);

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
  const availableRef = useRef([]);
  const busyRef = useRef(new Set());
  const [availableCount, setAvailableCount] = useState(0);
  const [busyWorkers, setBusyWorkers] = useState(new Set());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Initialize worker pool
    const urls = [];
    const workers = [];
    for (let i = 0; i < poolSize; i++) {
      const url = URL.createObjectURL(new Blob([workerCode], { type: 'application/javascript' }));
      urls.push(url);
      workers.push(new Worker(url));
    }

    workersRef.current = workers;
    availableRef.current = workers.slice();
    busyRef.current = new Set();
    setAvailableCount(workers.length);
    setBusyWorkers(new Set());
    setIsReady(true);

    return () => {
      workers.forEach((worker) => worker.terminate());
      urls.forEach((url) => URL.revokeObjectURL(url));
      workersRef.current = [];
      availableRef.current = [];
      busyRef.current = new Set();
    };
  }, [workerCode, poolSize]);

  const execute = useCallback((message, transferables = []) => {
    return new Promise((resolve, reject) => {
      // Reserve the worker synchronously. Picking from the `availableWorkers`
      // state gave concurrent calls (same render) the same worker, so two
      // jobs were posted to one worker and another sat idle.
      const worker = availableRef.current.shift();
      if (!worker) {
        reject(new Error('No available workers'));
        return;
      }

      busyRef.current.add(worker);
      setAvailableCount(availableRef.current.length);
      setBusyWorkers(new Set(busyRef.current));

      const release = () => {
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);

        if (!workersRef.current.includes(worker)) return;
        availableRef.current.push(worker);
        busyRef.current.delete(worker);
        setAvailableCount(availableRef.current.length);
        setBusyWorkers(new Set(busyRef.current));
      };

      const onMessage = (event) => {
        release();
        resolve(event.data);
      };

      const onError = (event) => {
        release();
        reject(event.error || new Error('Worker failed'));
      };

      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      worker.postMessage(message, transferables);
    });
  }, []);

  const getStats = useCallback(() => {
    const total = workersRef.current.length;
    const busy = busyWorkers.size;
    return {
      total,
      available: availableCount,
      busy,
      utilization: total === 0 ? 0 : (busy / total) * 100,
    };
  }, [availableCount, busyWorkers.size]);

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