/* Authored remarks, independent of the animation clock. */
(function (root) {
  'use strict';
  const lines = [
    'A little company for your corner.',
    'Prrr. Just checking in.',
    'My ears are on important listening duty.',
    'Want a little stretch? I can show you mine.',
    'Still here beside you.',
    'I found a sunny spot. You can have half.',
    'I have inspected the corner. Excellent corner.',
    'Tiny paws. Very serious company.',
    'If you need a minute, I can sit with you.',
    'A gentle reminder from your resident fluff: blink.',
    'My tail says hello, too.',
    'I took a tiny breath. Your turn, if you want.',
    'I am currently doing my best loaf impression.',
    'One small thing at a time suits me fine.',
    'I can stay right here while you work.',
    'The little house is lovely, but I like sitting with you.',
    'I would share my yarn. Probably.',
    'No rush. I can keep you company a little longer.'
  ];
  const modes = {
    balanced: { first: 60_000, interval: 120_000 },
    chatty: { first: 30_000, interval: 60_000 }
  };
  const timings = mode => Object.hasOwn(modes, mode) ? modes[mode] : null;
  const contexts = {
    video: {
      hosts: ['youtube.com', 'vimeo.com', 'twitch.tv', 'netflix.com'],
      lines: ['What are we watching? I brought the curls, you bring the popcorn.', 'Is there room for a loaf in the front row?', 'I’ll sit right here. No spoilers from me.']
    },
    writing: {
      hosts: ['docs.google.com', 'drive.google.com', 'notion.so', 'notion.site', 'overleaf.com', 'word.cloud.microsoft'],
      lines: ['Need a paperweight? I am very qualified.', 'I can guard your place while you think.', 'I’ll keep these paws off the keyboard. Mostly.']
    },
    reading: {
      hosts: ['wikipedia.org', 'scholar.google.com', 'jstor.org', 'arxiv.org', 'archive.org'],
      lines: ['I’ll hold your page. With one very small paw.', 'I like reading beside you. Turn the page whenever you’re ready.', 'I’m investigating the inside of this sunbeam. How’s your research going?']
    },
    code: {
      hosts: ['github.com', 'gitlab.com', 'stackoverflow.com', 'codepen.io', 'replit.com'],
      lines: ['I can supervise the little blinking line.', 'May I sit here while you figure it out?', 'If you find a bug, I call dibs on chasing it.']
    },
    audio: {
      hosts: ['open.spotify.com', 'music.apple.com', 'soundcloud.com', 'bandcamp.com'],
      lines: ['I promise to purr in a different key.', 'Room for one more listener?', 'I found a good listening spot. It overlaps yours a little.']
    }
  };
  function siteContext(hostname) {
    if (typeof hostname !== 'string') return null;
    const host = hostname.toLowerCase().replace(/\.$/, '');
    // Music YouTube has its own context before the parent YouTube domain.
    if (host === 'music.youtube.com') return 'audio';
    return Object.keys(contexts).find(key =>
      contexts[key].hosts.some(domain => host === domain || host.endsWith('.' + domain))) || null;
  }
  function contextRemark(hostname, previous, now) {
    const context = siteContext(hostname);
    if (!context) return null;
    const cycle = 75 * 60_000;
    if (previous && now >= previous.at && now - previous.at < cycle) return null;
    const choices = contexts[context].lines;
    const index = previous && Number.isInteger(previous.index) ? (previous.index + 1) % choices.length : 0;
    return { context, index, at: now, text: choices[index] };
  }
  function createClock() {
    let previousMode, previousTime, remaining = 0;
    return {
      update(mode, at, eligible, resting) {
        const timing = timings(mode);
        const elapsed = previousTime === undefined ? 0 : Math.max(0, at - previousTime);
        previousTime = at;
        if (mode !== previousMode) {
          previousMode = mode;
          remaining = timing?.first || 0;
          return false;
        }
        if (!eligible || !timing) return false;
        remaining = Math.max(0, remaining - Math.min(elapsed, 1000));
        if (remaining || !resting) return false;
        remaining = timing.interval;
        return true;
      },
      pause() { previousTime = undefined; }
    };
  }
  root.PurrpleAmbient = Object.freeze({ createClock, lines: Object.freeze(lines), timings, siteContext, contextRemark });
  if (typeof module !== 'undefined') module.exports = root.PurrpleAmbient;
})(globalThis);
