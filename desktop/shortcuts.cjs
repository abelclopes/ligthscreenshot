const keys = ['PrintScreen', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', ...'0123456789',
  ...Array.from({ length: 24 }, (_, i) => `F${i + 1}`), 'Insert', 'Home', 'End', 'PageUp', 'PageDown', 'Pause'];
const modifiers = ['Control', 'Alt', 'Shift', 'Super'];
function validateShortcut(value) {
  if (typeof value !== 'string' || value.length > 90) throw new Error('Atalho inválido.');
  const parts = value.split('+');
  const key = parts.pop();
  if (!keys.includes(key) || parts.some(p => !modifiers.includes(p)) || new Set(parts).size !== parts.length)
    throw new Error('Escolha uma tecla e os modificadores válidos.');
  return [...modifiers.filter(p => parts.includes(p)), key].join('+');
}
function defaultShortcut(platform) { return platform === 'darwin' ? 'Control+Shift+S' : 'PrintScreen'; }
module.exports = { keys, modifiers, validateShortcut, defaultShortcut };
