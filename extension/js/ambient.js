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
  root.PurrpleAmbient = Object.freeze({ createClock, lines: Object.freeze(lines), timings });
  if (typeof module !== 'undefined') module.exports = root.PurrpleAmbient;
})(globalThis);
