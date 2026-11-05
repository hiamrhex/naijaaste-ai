import { useState, useEffect } from 'react';
import { loadLeaflet } from '../utils/dynamicImports.js';

// Dynamic Map component that loads Leaflet only when needed
export function DynamicMap({ children, ...props }) {
  const [MapComponent, setMapComponent] = useState(null);

  useEffect(() => {
    let cancelled = false;
    
    const loadMap = async () => {
      try {
        // Warm the Leaflet chunk so the real map mounts without a second
        // network round trip. The module value itself is not needed here.
        await loadLeaflet();
        const Map = ({ children, ...props }) => {
          // Map implementation would go here
          return <div {...props}>{children}</div>;
        };
        if (!cancelled) {
          setMapComponent(() => Map);
        }
      } catch (error) {
        console.error('Failed to load map:', error);
      }
    };

    loadMap();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!MapComponent) {
    return <div>Loading map...</div>;
  }

  return <MapComponent {...props}>{children}</MapComponent>;
}

// Dynamic Icon component that loads Lucide icons only when needed
export function DynamicIcon({ name, size = 24, className, ...props }) {
  const [IconComponent, setIconComponent] = useState(null);

  useEffect(() => {
    let cancelled = false;
    
    const loadIcon = async () => {
      try {
        const iconModule = await import('lucide-react');
        const Icon = iconModule[name];
        if (!cancelled && Icon) {
          setIconComponent(() => Icon);
        }
      } catch (error) {
        console.error(`Failed to load icon ${name}:`, error);
      }
    };

    loadIcon();

    return () => {
      cancelled = true;
    };
  }, [name]);

  if (!IconComponent) {
    return <div className={className}>Loading...</div>;
  }

  return <IconComponent size={size} className={className} {...props} />;
}