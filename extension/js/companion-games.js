/* Game boards for the extension’s Play views. All moves are validated by the shared domain. */
(() => {
  'use strict';

  const names = ['Far left', 'Left', 'Center', 'Right', 'Far right'];
  const icons = ['Moon', 'Spool', 'Teacup', 'Leaf', 'Notebook', 'Lantern', 'Feather', 'Star', 'Bell', 'Acorn', 'Key', 'Cloud'];
  const catalog = Object.freeze({
    'paw-pairs': {
      name: 'Paw Pairs',
      intro: 'Turn over two cards. Every pair is worth a point. Purrple takes a turn after yours.',
      modes: ['Gentle memory', 'Sharp memory'],
      image: 'Moon'
    },
    'cozy-clues': {
      name: 'Cozy Clues',
      intro: 'Solve five riddles from a favorite corner of the house, or trade places and clue Purrple in.',
      modes: ['Guess Purrple’s clues', 'Give Purrple clues'],
      locked: 'Open A note in the notebook at bond level 3.',
      image: 'Notebook'
    },
    'lantern-paths': {
      name: 'Lantern Paths',
      intro: 'Take turns extending the trail one square at a time. Avoid the hedges and reach the lantern before the tiles run out.',
      modes: ['Garden route', 'Woodland route'],
      locked: 'Open The light in the window at bond level 5.',
      image: 'Lantern'
    },
    'pocket-pong': {
      name: 'Pocket Pong',
      intro: 'Return a spool across the desk. Pick a reachable lane and aim beyond Purrple’s guards. First to three points.',
      modes: ['Soft rally', 'Quick rally'],
      locked: 'Finish a recorded round of Paw Pairs.',
      image: 'Spool'
    },
    'three-paws': {
      name: 'Three Paws',
      intro: 'Take turns marking the grid. A line of three leaves or three paws wins.',
      modes: ['Easygoing', 'Sharp opponent'],
      locked: 'Open The empty shelf at bond level 2.',
      image: 'Leaf'
    }
  });

  function icon(name) {
    return `<span class="cg-icon" style="--sprite:${Math.max(0, icons.indexOf(name))}" aria-hidden="true"></span>`;
  }
  function status(title, note) {
    return `<div class="cp-board-status cg-score"><strong>${title}</strong><p>${note}</p></div>`;
  }
  function cellAttributes(index, label, disabled) {
    return `type="button" data-cp="cell" data-cell="${index}" data-cp-key="cell-${index}" aria-label="${label}" ${disabled ? 'disabled' : ''}`;
  }
  function pairs(round, model) {
    const visible = new Set(model.seen.flatMap(turn => turn.cards));
    const turned = index => model.matched.includes(index) || model.pending === index || visible.has(index);
    const title = model.outcome ? 'Round complete' : model.pending === null ? 'Pick a card' : 'Pick a second card';
    return `${status(title, `You ${model.score[0]} <span aria-hidden="true">·</span> Purrple ${model.score[1]}`)}
      <div class="cp-pairs cg-pairs" style="--columns:${model.columns}" role="group" aria-label="${model.rows} by ${model.columns} Paw Pairs board">
        ${model.deck.map((picture, index) => {
          const matched = model.matched.includes(index), shown = turned(index);
          const label = `Card ${index + 1}${shown ? ', ' + picture : ''}${matched ? ', matched' : ''}`;
          return `<button class="cp-pair cg-card ${shown ? 'shown' : ''} ${matched ? 'matched' : ''}" ${cellAttributes(index, label, model.outcome || matched || model.pending === index)}>
            ${shown ? icon(picture) : '<span class="cg-card-back" aria-hidden="true"></span>'}
          </button>`;
        }).join('')}
      </div>
      ${model.seen.length ? `<ul class="cp-turns cg-turns">${model.seen.map(turn =>
        `<li><strong>${turn.owner}</strong> ${turn.pair ? 'matched' : 'flipped'} ${turn.cards.map(index => `${model.deck[index]} (${index + 1})`).join(' and ')}.</li>`).join('')}</ul>` : ''}`;
  }
  function clues(round, model, {escape, button, key, answerDraft, fieldId}) {
    const hints = model.clue?.hints ?? (model.hinted ? [model.clue.hint] : []);
    const hintLimit = round.variant ? 2 : 1;
    return `${status(model.outcome ? 'Case closed' : `Clue ${model.index + 1} of 5`, `${model.score} solved`)}
      ${model.feedback ? `<p class="cp-game-feedback">${escape(model.feedback)}</p>` : ''}
      ${model.clue ? `<section class="cp-clue cg-clue">
        <p class="cp-clue-text" tabindex="-1" ${key('clue')}>${escape(model.clue.prompt)}</p>
        ${hints.length ? `<ul class="cg-hints">${hints.map(hint => `<li>${escape(hint)}</li>`).join('')}</ul>` : ''}
        ${round.mode === 'guess' ? `<form data-cp-form="answer"><label for="${fieldId('answer')}">Your guess</label>
          <div class="cp-answer-form"><input id="${fieldId('answer')}" name="answer" required maxlength="60" placeholder="Type an answer" value="${escape(answerDraft)}" data-cp-input="answer" ${key('answer')}><button class="button subtle" type="submit">Guess</button></div></form>` : ''}
        ${model.clue.choices.length ? `<div class="cp-actions cg-clue-choices">${model.clue.choices.map((answer, index) => button(escape(answer),'clue-choice',`data-answer="${escape(answer)}" ${key('choice-' + index)}`)).join('')}</div>` : ''}
        <div class="cp-actions">
          ${hints.length < hintLimit ? button(hints.length ? 'Another hint' : 'Hint','clue-hint',key('clue-hint')) : ''}
          ${button('Reveal answer','clue-skip',key('clue-skip'))}
        </div>
      </section>` : ''}`;
  }
  function paths(round, model) {
    const tiles = new Map(model.path.map((tile, index) => [tile.cell, {...tile, index}]));
    const latest = model.path.at(-1);
    return `${status(model.outcome ? 'Trail ended' : 'Extend the trail', `${model.budget - (model.path.length - 1)} tiles left`)}
      <div class="cp-paths cg-paths" role="group" aria-label="Five by five lantern path board">
        ${Array.from({length:25}, (_, cell) => {
          const tile = tiles.get(cell), hedge = model.blocked.includes(cell), legal = model.legal.includes(cell), goal = cell === model.goal;
          const cue = tile ? (tile.owner === 'Start' ? 'S' : tile.owner === 'You' ? 'Y' : 'P') : hedge ? '×' : goal ? icon('Lantern') : legal ? '+' : '';
          const label = tile ? (tile.owner === 'Start' ? 'Start' : tile.owner + ' tile ' + tile.index) : hedge ? 'Hedge' : goal ? 'Lantern' : legal ? 'Available' : 'Empty';
          return `<button class="cp-square ${tile ? 'route' : ''} ${legal ? 'legal' : ''} ${hedge ? 'hedge' : ''} ${goal ? 'goal' : ''}" ${cellAttributes(cell, `${label}, row ${Math.floor(cell / 5) + 1}, column ${cell % 5 + 1}`, !legal)}>${cue}</button>`;
        }).join('')}
      </div>
      <p class="cp-help">S Start · Y Your tile · P Purrple’s tile</p>
      ${latest.owner === 'Purrple' ? `<p class="cp-game-feedback">Purrple chose row ${Math.floor(latest.cell / 5) + 1}, column ${latest.cell % 5 + 1}.</p>` : ''}`;
  }
  function pong(round, model) {
    const last = model.last;
    return `${status(model.outcome ? 'Match complete' : 'Choose a return lane', `You ${model.score[0]} <span aria-hidden="true">·</span> Purrple ${model.score[1]}`)}
      <div class="cg-pong" role="group" aria-label="Pocket Pong, five lanes">
        <div class="cg-pong-end" aria-label="Lanes Purrple is guarding">
          ${names.map((name, index) => `<span class="${model.guarding.includes(index) ? 'guarded' : ''}" aria-label="${name}, ${model.guarding.includes(index) ? 'guarded' : 'open'}"></span>`).join('')}
        </div>
        <div class="cg-pong-net" aria-hidden="true"></div>
        <div class="cg-pong-spool" style="--lane:${model.serveLane + 1}">${icon('Spool')}</div>
        <div class="cg-pong-pads">
          ${names.map((name, index) => `<button class="cg-pong-pad ${model.serveLane === index ? 'incoming' : ''}" ${cellAttributes(index,
            `${name} return${model.serveLane === index ? ', spool incoming' : ''}${model.guarding.includes(index) ? ', guarded' : ''}`, !model.legal.includes(index))}><span aria-hidden="true">${model.serveLane === index ? '●' : '↑'}</span></button>`).join('')}
        </div>
      </div>
      <p class="cp-game-feedback">${last?.point === 0 ? 'That slipped past Purrple. Your point.' : last?.point === 1 ? 'Purrple won the rally.' : last?.caught ? `Purrple returned it. ${model.rallyLimit - model.rally} more saves earn her a point.` : 'Purple marks her guards. Aim for an open lane you can reach.'}</p>`;
  }
  function three(round, model) {
    return `${status(model.outcome ? 'Round complete' : 'Your turn', `You ${icon('Leaf')} <span aria-hidden="true">·</span> Purrple <span class="cg-paw" aria-hidden="true"></span>`)}
      <div class="cg-three" role="group" aria-label="Three Paws board">
        ${model.board.map((owner, cell) => `<button class="cp-square cg-three-cell ${owner ?? ''} ${model.line.includes(cell) ? 'winning' : ''}" ${cellAttributes(cell,
          `${owner === 'you' ? 'Your leaf' : owner === 'purrple' ? 'Purrple’s paw' : 'Empty'}, row ${Math.floor(cell / 3) + 1}, column ${cell % 3 + 1}`, !!owner || model.outcome)}>
          ${owner === 'you' ? icon('Leaf') : owner === 'purrple' ? '<span class="cg-paw" aria-hidden="true"></span>' : ''}
        </button>`).join('')}
      </div>
      ${model.last === null ? '' : `<p class="cp-game-feedback">Purrple marked row ${Math.floor(model.last / 3) + 1}, column ${model.last % 3 + 1}.</p>`}`;
  }

  const boards = {'paw-pairs':pairs, 'cozy-clues':clues, 'lantern-paths':paths, 'pocket-pong':pong, 'three-paws':three};
  const variants = {
    'paw-pairs': {label:'Board size', options:[['3x4','3 × 4 · 6 pairs'], ['4x4','4 × 4 · 8 pairs'], ['4x6','4 × 6 · 12 pairs']]},
    'cozy-clues': {label:'Clue collection', options:[['desk','Writing desk'], ['kitchen','Kitchen'], ['garden','Garden']]}
  };
  function resultTitle(id, outcome, practice) {
    if (practice) return 'Practice finished';
    if (id === 'lantern-paths') return outcome === 'win' ? 'You lit the lantern' : 'The path ended';
    if (id === 'cozy-clues') return outcome === 'win' ? 'Case solved' : 'Case closed';
    return outcome === 'win' ? 'You won' : outcome === 'tie' ? 'A draw' : 'Purrple won';
  }

  globalThis.PurrpleCompanionGames = Object.freeze({catalog, variants, icon, boards:Object.freeze(boards), resultTitle});
})();
