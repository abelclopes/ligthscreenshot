'use strict';
const $ = id => document.getElementById(id);
const api = window.captureApp;
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
let base = null, marks = [], pending = null, pointer = null, sources = [], revision = 0;
let prefs;
const status = text => { $('status').textContent = text; };
api.onShortcutStatus(value => status(`Atalho: ${value.shortcut}${value.shortcutActive ? '' : ' — confira Configurações ou use Nova captura.'}`));

function renderMark(context, mark) {
  context.save();
  context.strokeStyle = mark.color; context.fillStyle = mark.color;
  context.lineWidth = mark.width; context.lineCap = 'round'; context.lineJoin = 'round';
  const a = mark.points[0], b = mark.points.at(-1);
  if (mark.tool === 'text') {
    context.font = 'bold 24px sans-serif'; context.textBaseline = 'top';
    context.fillText(mark.text, a.x, a.y);
  } else if (mark.tool === 'rectangle') context.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  else {
    context.beginPath(); context.moveTo(a.x, a.y);
    for (const point of mark.points.slice(1)) context.lineTo(point.x, point.y);
    context.stroke();
    if (mark.tool === 'arrow') {
      const angle = Math.atan2(b.y - a.y, b.x - a.x), size = Math.max(12, mark.width * 4);
      context.beginPath(); context.moveTo(b.x, b.y);
      context.lineTo(b.x - size * Math.cos(angle - 0.45), b.y - size * Math.sin(angle - 0.45));
      context.lineTo(b.x - size * Math.cos(angle + 0.45), b.y - size * Math.sin(angle + 0.45));
      context.closePath(); context.fill();
    }
  }
  context.restore();
}

function paint(preview = true) {
  if (!base) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(base, 0, 0);
  marks.forEach(mark => renderMark(ctx, mark));
  if (preview && pending) {
    if (pending.tool === 'crop') {
      const [a, b] = pending.points;
      ctx.save(); ctx.strokeStyle = '#00aaff'; ctx.lineWidth = Math.max(1, canvas.width / 600);
      ctx.setLineDash([10, 6]); ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y); ctx.restore();
    } else renderMark(ctx, pending);
  }
  $('undo').disabled = marks.length === 0;
}

function point(event) {
  const bounds = canvas.getBoundingClientRect();
  return { x: Math.max(0, Math.min(canvas.width, (event.clientX - bounds.left) * canvas.width / bounds.width)),
    y: Math.max(0, Math.min(canvas.height, (event.clientY - bounds.top) * canvas.height / bounds.height)) };
}

async function loadImage(data) {
  const token = ++revision;
  const image = new Image(); image.src = data;
  await image.decode();
  if (token !== revision) return;
  base = image; marks = []; pending = null; pointer = null;
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  canvas.hidden = false; $('welcome').hidden = true; $('toolbar').hidden = false;
  $('tool').value = 'crop'; paint();
  status('Arraste na imagem para recortar a área ou escolha uma ferramenta para anotar.');
}

function crop(a, b) {
  const x = Math.floor(Math.min(a.x, b.x)), y = Math.floor(Math.min(a.y, b.y));
  const width = Math.floor(Math.abs(a.x - b.x)), height = Math.floor(Math.abs(a.y - b.y));
  if (width < 2 || height < 2) return;
  // Keep annotations as separate editable objects, including after cropping.
  const cropped = document.createElement('canvas'); cropped.width = width; cropped.height = height;
  cropped.getContext('2d').drawImage(base, x, y, width, height, 0, 0, width, height);
  base = cropped;
  marks = marks.map(mark => ({ ...mark, points: mark.points.map(p => ({ x: p.x - x, y: p.y - y })) }));
  canvas.width = width; canvas.height = height; $('tool').value = 'arrow';
  status(`Área selecionada: ${width} × ${height} pixels. Escolha uma ferramenta para anotar.`);
}

canvas.addEventListener('pointerdown', event => {
  if (!base || event.button !== 0) return;
  const start = point(event), tool = $('tool').value;
  const mark = { tool, color: $('color').value, width: Math.max(1, Math.min(30, Number($('width').value) || 3)), points: [start, start], text: $('text').value };
  if (tool === 'text') {
    if (mark.text.trim()) { marks.push(mark); paint(); }
    else { status('Digite a anotação no campo Texto antes de clicar na imagem.'); $('text').focus(); }
    return;
  }
  pointer = event.pointerId; pending = mark; canvas.setPointerCapture(pointer);
});
canvas.addEventListener('pointermove', event => {
  if (!pending || event.pointerId !== pointer) return;
  if (pending.tool === 'pen') pending.points.push(point(event));
  else pending.points[1] = point(event);
  paint();
});
canvas.addEventListener('pointerup', event => {
  if (!pending || event.pointerId !== pointer) return;
  if (pending.tool === 'pen') pending.points.push(point(event));
  else pending.points[1] = point(event);
  const completed = pending; pending = null;
  if (canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
  pointer = null;
  if (completed.tool === 'crop') crop(...completed.points);
  else marks.push(completed);
  paint();
});
canvas.addEventListener('pointercancel', () => { pending = null; pointer = null; paint(); });
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && pending) { pending = null; pointer = null; paint(); }
});
$('undo').onclick = () => { marks.pop(); paint(); };
$('tool').onchange = () => { pending = null; pointer = null; paint(); };
$('capture').onclick = () => safe(() => api.capture());
$('quit').onclick = () => api.quit();
async function safe(action) { try { await action(); } catch (error) { status(error.message); } }
function exportImage() { if (!base) throw new Error('Faça uma captura primeiro.'); paint(false); return canvas.toDataURL('image/png'); }
$('copy').onclick = () => safe(async () => { await api.copy(exportImage()); status('Imagem copiada.'); });
$('save').onclick = () => safe(async () => { status(await api.save(exportImage()) ? 'Imagem salva.' : 'Salvamento cancelado.'); });
api.onCaptured(images => {
  sources = images; $('sources').replaceChildren();
  images.forEach((source, index) => {
    const button = document.createElement('button'); button.textContent = source.name;
    button.onclick = () => safe(() => loadImage(sources[index].image));
    $('sources').append(button);
  });
  safe(() => loadImage(images[0].image));
});

async function openSettings() {
  if ($('preferences').open) return;
  prefs = await api.preferences();
  const parts = prefs.shortcut.split('+'), key = parts.pop();
  $('key').replaceChildren(...prefs.keys.map(key => new Option(key, key)));
  $('key').value = key;
  document.querySelectorAll('#modifiers input').forEach(input => { input.checked = parts.includes(input.value); });
  $('settings-error').textContent = '';
  $('platform-note').textContent = prefs.wayland
    ? 'No Wayland, o desktop pode pedir autorização ou definir a combinação nas configurações do sistema. É necessário um portal de atalhos compatível.'
    : prefs.platform === 'darwin' ? 'No Mac, Super corresponde a Command. A captura exige permissão de Gravação de Tela.' : 'O atalho não pode estar reservado por outro aplicativo.';
  await api.settingsOpen(true); $('preferences').showModal();
}
$('settings').onclick = () => safe(openSettings);
api.onSettings(() => safe(openSettings));
$('preferences').addEventListener('close', () => { api.settingsOpen(false); });
$('cancel').onclick = () => $('preferences').close();
$('default').onclick = () => {
  document.querySelectorAll('#modifiers input').forEach(input => { input.checked = prefs.platform === 'darwin' && ['Control', 'Shift'].includes(input.value); });
  $('key').value = prefs.platform === 'darwin' ? 'S' : 'PrintScreen';
};
$('settings-form').onsubmit = async event => {
  event.preventDefault();
  const parts = [...document.querySelectorAll('#modifiers input:checked')].map(input => input.value);
  parts.push($('key').value);
  try { const result = await api.shortcut(parts.join('+')); $('preferences').close(); status(`Atalho solicitado: ${result.shortcut}. No Wayland, confirme a autorização do sistema.`); }
  catch (error) { $('settings-error').textContent = error.message; }
};
safe(async () => { prefs = await api.preferences(); status(`Atalho: ${prefs.shortcut}${prefs.shortcutActive ? '' : ' — confira Configurações ou use Nova captura.'}`); });

// Exercised only by the main process when started with --smoke-test.
window.runSmokeTest = async () => {
  const source = document.createElement('canvas'); source.width = 160; source.height = 100;
  source.getContext('2d').fillStyle = '#ffffff'; source.getContext('2d').fillRect(0, 0, 160, 100);
  await loadImage(source.toDataURL());
  crop({ x: 10, y: 10 }, { x: 110, y: 70 }); paint();
  if (canvas.width !== 100 || canvas.height !== 60) throw new Error('Crop dimensions failed');
  const before = exportImage();
  for (const tool of ['arrow', 'rectangle', 'pen', 'text']) {
    marks.push({ tool, color: '#ff0000', width: 3, points: [{ x: 10, y: 10 }, { x: 70, y: 40 }], text: 'Teste' });
    const after = exportImage();
    if (after === before) throw new Error(`Annotation failed: ${tool}`);
    marks.pop();
    if (exportImage() !== before) throw new Error('Undo failed');
  }
  const image = new Image(); image.src = exportImage(); await image.decode();
  if (image.width !== 100 || image.height !== 60) throw new Error('PNG export failed');
  return { ok: true, crop: '100x60', annotations: 4, undo: true, png: true };
};
