/**
 * What is new in this release (#1032, #1308). Shown once per screen after the
 * update and kept in Help. Bump `id` for a later release's list, so every
 * screen that saw the last one sees this one once.
 *
 * Each item is one string; the words between ** are drawn bold.
 */
export const WHATS_NEW = {
  id: '2026-11-new-look-2',
  title: "What's new in Prism",
  changelog: 'https://sandydargoport.github.io/prism/CHANGELOG/',
  items: [
    "**Glance, a new front page layout.** The clock, the weather, what's next and the coming days, written as sentences over your photos. To use it: More > Edit layout > Dashboard > Glance > Make the default. Your own dashboards are unchanged.",
    '**Navigation is at the bottom of the screen.** Your main pages sit in a bar along the bottom. Its **More** button opens the other pages, Settings and Help.',
    '**Each screen can switch dashboards on its own schedule**, at set times or when the bus is due: More > Edit layout > Screen > Switch at set times. Through the day, beside it, sets what the screen shows when nobody is using it and at night. From your phone: More > Settings > Screens > Edit.',
    '**Photos fade from one to the next with a slow Ken Burns zoom**, and can show when and where they were taken: More > Settings > Appearance.',
    '**Users can now set alphanumeric PINs** of letters and numbers: More > Settings > Family Members.',
    '**Chores for pets**, and **subtasks** from Google Tasks and steps from Microsoft To Do.',
    "**Tandoor and Mealie sync both ways**, after you review what's sent.",
  ],
} as const;

/** An item as runs of text, bold or not, in order. */
export function whatsNewRuns(item: string): Array<{ text: string; bold: boolean }> {
  return item
    .split('**')
    .map((text, i) => ({ text, bold: i % 2 === 1 }))
    .filter((r) => r.text !== '');
}

/** Per screen: the id of the last list seen here. */
export const WHATS_NEW_SEEN_KEY = 'prism-whats-new-seen';

/**
 * A wall screen is named and set up once, so the marker is kept for years.
 * localStorage alone was not enough: a screen that loses it (or cannot write
 * it) showed the note on every reload or restart.
 */
const SEEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 10;

function readSeenCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${WHATS_NEW_SEEN_KEY}=`;
  for (const part of document.cookie.split(';')) {
    const item = part.trim();
    if (!item.startsWith(prefix)) continue;
    try { return decodeURIComponent(item.slice(prefix.length)); } catch { return null; }
  }
  return null;
}

/** Write the same marker as a cookie, and report whether it was really kept. */
function writeSeenCookie(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
    document.cookie =
      `${WHATS_NEW_SEEN_KEY}=${encodeURIComponent(WHATS_NEW.id)}; ` +
      `Max-Age=${SEEN_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
    return readSeenCookie() === WHATS_NEW.id;
  } catch {
    return false;
  }
}

/**
 * Remember that this screen has seen this release's list, in both places a
 * browser can keep it. Returns whether either one actually kept it: a screen
 * that can keep neither would show the note again on every load, so it is
 * better to leave the note in Help than to repeat it forever.
 */
export function markWhatsNewSeen(): boolean {
  let kept = false;
  try {
    localStorage.setItem(WHATS_NEW_SEEN_KEY, WHATS_NEW.id);
    kept = localStorage.getItem(WHATS_NEW_SEEN_KEY) === WHATS_NEW.id;
  } catch {
    // The cookie may still be kept.
  }
  // Write both, so clearing one does not bring the note back.
  return writeSeenCookie() || kept;
}

export function whatsNewUnseen(): boolean {
  try {
    if (localStorage.getItem(WHATS_NEW_SEEN_KEY) === WHATS_NEW.id) return false;
  } catch {
    // Ask the cookie instead.
  }
  return readSeenCookie() !== WHATS_NEW.id;
}
