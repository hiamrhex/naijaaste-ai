export const PLANS_KEY = 'nt.plans.v1';

export const readPlans = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(PLANS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

export const writePlans = (plans) => {
  try {
    // Keep the most recent plans: callers append, so the tail is the newest.
    localStorage.setItem(PLANS_KEY, JSON.stringify(plans.slice(-20)));
  } catch { /* private mode */ }
};

export const deletePlan = (id) => {
  writePlans(readPlans().filter((p) => p.id !== id));
};
