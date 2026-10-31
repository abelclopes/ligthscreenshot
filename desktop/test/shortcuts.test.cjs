const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateShortcut, defaultShortcut } = require('../shortcuts.cjs');
test('normalizes modifiers and accepts platform keys', () => {
  assert.equal(validateShortcut('Shift+Control+S'), 'Control+Shift+S');
  assert.equal(validateShortcut('Super+Alt+F12'), 'Alt+Super+F12');
  assert.equal(validateShortcut('PrintScreen'), 'PrintScreen');
});
test('rejects incomplete, duplicate, unknown or malformed combinations', () => {
  for (const value of [null, {}, '', 'Control', 'Control+', 'Control+Control+S', 'Meta+S', 'Control+bogus', 'A+B', 'S\n'])
    assert.throws(() => validateShortcut(value));
});
test('Mac default avoids Print Screen and system screenshot combinations', () => {
  assert.equal(defaultShortcut('darwin'), 'Control+Shift+S');
  assert.equal(defaultShortcut('linux'), 'PrintScreen');
  assert.equal(defaultShortcut('win32'), 'PrintScreen');
});
