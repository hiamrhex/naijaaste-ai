// All user-facing text in one place (E). Warm, short, respectful.
// Serious errors keep technical/gentle generic copy — never playful.
// pidgin: optional flavor from Settings; never used on serious errors.
const dayPart = (h) => (h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening');

export const greet = (lang, name, hour = new Date().getHours()) => {
  const first = (name || '').split(' ')[0] || 'Foodie';
  const part = dayPart(hour);
  if (lang === 'pg') {
    if (part === 'morning') return `Good morning, ${first}. Wetin you wan chop today?`;
    if (part === 'afternoon') return `Good afternoon, ${first}. Belle dey call?`;
    return `Good evening, ${first}. Dinner don dey call.`;
  }
  return `Good ${part}, ${first}. What are we craving today?`;
};

export const copy = {
  en: {
    tagline: 'Your elite dining concierge',
    emptyFavorites: 'No favourites yet. Tap the heart on a place you like.',
    emptyHistory: 'No chats yet. Start a conversation on Home.',
    emptyPlans: 'No plans yet. Put together your first night out.',
    emptyResults: 'Nothing here yet — chat with NaijaTaste to get picks.',
    emptyReports: 'No reports. When something looks off, tell us here.',
    loading: 'Just a moment…',
    loadingMap: 'Finding spots near you…',
    loadingPlan: 'Putting your shortlist together…',
    netError: 'Network don wahala. Try again?',
    genericError: 'Something went wrong. Please try again.',
    saved: 'Saved.',
    removed: 'Removed.',
    planReady: 'Your shortlist is ready.',
    reportThanks: (ticket) => `Thank you — we got it. Ticket ${ticket}.`,
    checkinTitle: 'Did you go? How was it?',
    checkinSkip: 'Maybe later',
    checkinWrong: 'What went wrong?',
    installTitle: 'Put NaijaTaste on your home screen.',
    installBody: 'Opens like an app, no download.',
    installCta: 'Install app',
    installLater: 'Not now',
    iosGuide: 'Tap Share, then Add to Home Screen.',
    pushTitle: 'Get a nudge when it matters?',
    pushBody: 'One Thursday plan idea and the odd rating check-in. Nothing else.',
    pushAllow: 'Allow',
    pushMute: 'Mute notifications',
    voiceFail: "Sorry, I couldn't hear that — try typing instead.",
    voiceHint: 'Tap the mic and speak',
    sharePlan: 'Share plan',
    voteTitle: 'Vote for your pick',
    decide: 'Decide for me',
    whyPick: 'Why this pick?',
    signInTitle: 'Welcome back',
    signUpTitle: 'Create your account',
    deleteAccount: 'Delete my account',
    deleteAccountConfirm: 'This erases your profile, favourites, ratings and history. This cannot be undone.',
    exportData: 'Download my data',
    remembersTitle: 'What NaijaTaste remembers about me',
    autonomyAsk: 'Ask me first',
    autonomyAuto: 'Do low-stakes things alone',
    stop: 'Stop',
  },
  pg: {
    tagline: 'Your correct dining plug',
    emptyFavorites: 'No favourites yet. Tap heart for any place wey you like.',
    emptyHistory: 'No chats yet. Go Home go start gist.',
    emptyPlans: 'No plans yet. Arrange your first night out.',
    emptyResults: 'Nothing dey here yet — chat make we find beta spots.',
    emptyReports: 'No reports. If anything spoil, tell us here.',
    loading: 'Small time…',
    loadingMap: 'We dey find spots near you…',
    loadingPlan: 'We dey arrange your shortlist…',
    netError: 'Network don wahala. Try again?',
    genericError: 'Something no work. Abeg try again.',
    saved: 'Don save am.',
    removed: 'Don comot am.',
    planReady: 'Your shortlist don ready.',
    reportThanks: (ticket) => `We don hear you. Ticket ${ticket}.`,
    checkinTitle: 'You go? How e be?',
    checkinSkip: 'Later',
    checkinWrong: 'Wetin happen?',
    installTitle: 'Put NaijaTaste for home screen.',
    installBody: 'E go open like app, no download.',
    installCta: 'Install app',
    installLater: 'No be now',
    iosGuide: 'Tap Share, afta tap Add to Home Screen.',
    pushTitle: 'Make we nudge you?',
    pushBody: 'One Thursday plan idea and rating check-in. Nothing else.',
    pushAllow: 'Allow',
    pushMute: 'Mute notifications',
    voiceFail: 'Sorry, I no hear you — abeg type am.',
    voiceHint: 'Tap mic make you talk',
    sharePlan: 'Share plan',
    voteTitle: 'Vote your pick',
    decide: 'Choose for me',
    whyPick: 'Why dis pick?',
    signInTitle: 'Welcome back',
    signUpTitle: 'Create your account',
    deleteAccount: 'Delete my account',
    deleteAccountConfirm: 'E go erase your profile, favourites, ratings and history. No undo o.',
    exportData: 'Download my data',
    remembersTitle: 'Wetin NaijaTaste sabi about me',
    autonomyAsk: 'Ask me first',
    autonomyAuto: 'Do small things alone',
    stop: 'Stop',
  },
};

export const t = (lang, key, ...args) => {
  const table = copy[lang] || copy.en;
  const v = table[key] ?? copy.en[key] ?? key;
  return typeof v === 'function' ? v(...args) : v;
};
