const assert = require('node:assert/strict');

async function verifyCompactWorkday({evaluate, waitFor, get, navigate}) {
  const element = selector => `document.querySelector(${JSON.stringify(selector)})`;
  const visible = selector => `${element(selector)}?.getClientRects().length > 0`;
  const click = async selector => {
    await waitFor(`${visible(selector)} && !${element(selector)}.disabled`);
    await evaluate(`${element(selector)}.click(); true`);
  };
  const fill = async (selector, value, event = 'input') => {
    await waitFor(visible(selector));
    await evaluate(`(() => {
      const input = ${element(selector)};
      input.value = ${JSON.stringify(value)};
      input.dispatchEvent(new Event(${JSON.stringify(event)}, {bubbles: true}));
      return true;
    })()`);
  };
  const current = expression => `(() => { const state = PurrpleCompact.getState(); return ${expression}; })()`;
  const initialWallet = (await get()).wallet.balance;

  await waitFor(visible('#compact-today'));
  await fill('#compact-task-title', 'Release smoke task');
  await click('#compact-task-add');
  await waitFor(current('state.tasks.some(task => task.title === "Release smoke task")'));
  const task = (await get()).tasks.find(item => item.title === 'Release smoke task');
  const rowAction = action => `[data-compact-action="${action}"][data-id="${task.id}"]`;
  await click(rowAction('edit-task'));
  await fill('#compact-edit-title', 'Edited release smoke task');
  await click('#compact-task-edit-save');
  await waitFor(current('state.tasks.some(task => task.title === "Edited release smoke task")'));

  await click(rowAction('schedule-task'));
  await waitFor(visible('#planner-dialog'));
  await click('#planner-save');
  await waitFor(current(`state.calendar.blocks.some(block => block.taskId === ${JSON.stringify(task.id)})`));
  await click('[data-compact-view="today"]');
  await click(rowAction('start-task'));
  await waitFor(current(`state.focus?.taskId === ${JSON.stringify(task.id)}`));
  await click('#compact-summary-pause');
  await waitFor(current('state.focus?.status === "paused"'));
  await click('#compact-summary-pause');
  await waitFor(current('state.focus?.status === "running"'));
  await click('[data-compact-view="focus"]');
  await click('#compact-focus-end');
  await waitFor(current('!state.focus'));
  await click('[data-compact-view="today"]');
  await click(rowAction('complete'));
  await waitFor(current(`state.tasks.some(task => task.id === ${JSON.stringify(task.id)} && task.done)`));
  assert.equal((await get()).wallet.balance, initialWallet + 1);

  await click('[data-compact-undo]');
  await waitFor(current(`state.tasks.some(task => task.id === ${JSON.stringify(task.id)} && !task.done)`));
  assert.equal((await get()).wallet.balance, initialWallet + 1, 'Undo does not remove the one-time task reward.');

  await click('[data-compact-view="calendar"]');
  await waitFor(visible('#compact-calendar'));
  await waitFor("document.querySelector('#compact-calendar .planner-entry')?.textContent.includes('Edited release smoke task')");
  const original = (await get()).settings.theme;
  const changed = original === 'night' ? 'light' : 'night';
  await click('#theme-toggle');
  await waitFor(`document.documentElement.dataset.theme === ${JSON.stringify(changed)}`);
  await navigate();
  await waitFor(visible('#compact-today'));
  await waitFor(`document.documentElement.dataset.theme === ${JSON.stringify(changed)}`);
  assert.equal((await get()).settings.theme, changed);
  await click('#theme-toggle');
  await waitFor(`document.documentElement.dataset.theme === ${JSON.stringify(original || 'light')}`);
  assert.equal(await evaluate("document.querySelector('[data-compact-view=play]') === null"), true);
}

module.exports = {verifyCompactWorkday};
