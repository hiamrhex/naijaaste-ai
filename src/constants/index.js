/* ── CONSTANTS ───────────────────────────────────────────────── */

export const API =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.DEV
    ? 'http://localhost:3000'
    : 'https://naijaaste-ai-production.up.railway.app');

export const HERO_PHRASES = [
  { lang: "Yoruba",  text: "Se o ti jeun?",                  suffix: "" },
  { lang: "Hausa",   text: "Kun ci abinci?",                 suffix: "" },
  { lang: "Igbo",    text: "I rie nri?",                     suffix: "" },
  { lang: "Pidgin",  text: "You don chow?",                  suffix: "" },
  { lang: "Pidgin",  text: "Wetin you wan chop today?",      suffix: "" },
  { lang: "English", text: "Find your perfect place to eat", suffix: "" },
];

export const QUICK_PROMPTS = [
  "Student in Lagos, love pepper soup, budget is tight",
  "Family outing in Kano, halal food, casual spot",
  "Business lunch in Abuja, fine dining, mild spice",
  "Date night in Port Harcourt, seafood, mid-range budget",
  "Solo dinner in Ibadan, local buka, very spicy food",
  "Work team lunch in Enugu, mixed cuisine, indoor seating",
];

export const STAGES = ["gather", "confirm", "recommend", "refine"];

export const STAGE_LABELS = {
  gather: "Gathering",
  confirm: "Confirming",
  recommend: "Recommending",
  refine: "Refining",
};

export const STAGE_TIPS = {
  gather: "Collecting your city, budget, cravings, and vibe...",
  confirm: "Verifying your taste profile before I recommend...",
  recommend: "Matching you to the perfect restaurants...",
  refine: "Fine-tuning based on your feedback...",
};

export const BUDGET_MAP = {
  low: 1,
  budget: 1,
  mid: 2,
  medium: 2,
  high: 3,
  premium: 3,
};

export const SPICE_MAP = {
  none: 0,
  mild: 1,
  medium: 2,
  moderate: 2,
  hot: 3,
  very_hot: 4,
  extreme: 5,
};

export const PRICE_MAP = {
  low: "₦",
  mid: "₦₦",
  medium: "₦₦",
  high: "₦₦₦",
  premium: "₦₦₦",
};
