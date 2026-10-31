// Dynamic imports for heavy dependencies to improve initial load performance
export const loadLeaflet = async () => {
  const L = await import('leaflet');
  await import('leaflet/dist/leaflet.css');
  return L;
};

export const loadLucideIcon = async (iconName) => {
  const iconModule = await import('lucide-react');
  return iconModule[iconName];
};

export const loadGoogleGenAI = async () => {
  return await import('@google/genai');
};

// Preload critical icons
export const preloadCriticalIcons = async () => {
  const criticalIcons = ['Send', 'ChefHat', 'Utensils', 'MapPin', 'Heart'];
  const promises = criticalIcons.map(iconName => loadLucideIcon(iconName));
  await Promise.all(promises);
};