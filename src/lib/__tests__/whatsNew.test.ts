/**
 * @jest-environment jsdom
 */
import { WHATS_NEW, WHATS_NEW_SEEN_KEY, markWhatsNewSeen, whatsNewRuns, whatsNewUnseen } from '../whatsNew';

function clearSeenCookie() {
  document.cookie = `${WHATS_NEW_SEEN_KEY}=; Max-Age=0; Path=/`;
}

describe("What's new (#1032)", () => {
  beforeEach(() => {
    localStorage.clear();
    clearSeenCookie();
  });

  it('is unseen until marked, then seen on this screen', () => {
    expect(whatsNewUnseen()).toBe(true);
    expect(markWhatsNewSeen()).toBe(true);
    expect(localStorage.getItem(WHATS_NEW_SEEN_KEY)).toBe(WHATS_NEW.id);
    expect(whatsNewUnseen()).toBe(false);
  });

  it('keeps the marker as a cookie too, so clearing localStorage does not bring it back', () => {
    expect(markWhatsNewSeen()).toBe(true);
    localStorage.clear();
    expect(document.cookie).toContain(`${WHATS_NEW_SEEN_KEY}=${WHATS_NEW.id}`);
    expect(whatsNewUnseen()).toBe(false);
  });

  it('a list from an earlier release counts as unseen', () => {
    localStorage.setItem(WHATS_NEW_SEEN_KEY, 'an-earlier-list');
    expect(whatsNewUnseen()).toBe(true);
  });

  it('reports when the browser can keep neither marker', () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage refused');
    });
    const ownCookie = Object.getOwnPropertyDescriptor(document, 'cookie');
    Object.defineProperty(document, 'cookie', { configurable: true, get: () => '', set: () => {} });
    try {
      expect(markWhatsNewSeen()).toBe(false);
    } finally {
      setItem.mockRestore();
      if (ownCookie) Object.defineProperty(document, 'cookie', ownCookie);
      else delete (document as { cookie?: string }).cookie;
    }
  });

  it('says each thing in sentences', () => {
    for (const i of WHATS_NEW.items) expect(i).toMatch(/\.$/);
  });

  it('draws the words between ** bold, and leaves no marker in the text', () => {
    expect(whatsNewRuns('**Chores for pets**, and **subtasks** too.')).toEqual([
      { text: 'Chores for pets', bold: true },
      { text: ', and ', bold: false },
      { text: 'subtasks', bold: true },
      { text: ' too.', bold: false },
    ]);
    // Every item has its markers in pairs.
    for (const i of WHATS_NEW.items) expect(i.split('**').length % 2).toBe(1);
  });
});
