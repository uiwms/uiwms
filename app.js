const FRAME_LAYOUTS = {
  classic: { name: '2 × 2 클래식', cols: 2, rows: 2, cells: 4, canvasW: 600, contentW: 520, cellH: 400, gap: 14, pad: 24, footerH: 80 },
  grid8: { name: '2 × 4 그리드', cols: 2, rows: 4, cells: 8, canvasW: 600, contentW: 520, cellH: 254, gap: 12, pad: 24, footerH: 80 },
  grid6: { name: '2 × 3 그리드', cols: 2, rows: 3, cells: 6, canvasW: 600, contentW: 520, cellH: 254, gap: 12, pad: 24, footerH: 80 },
  strip4: { name: '세로 4컷', cols: 1, rows: 4, cells: 4, canvasW: 600, contentW: 532, cellH: 360, gap: 18, pad: 34, footerH: 70, topOffset: 48 },
  square: { name: '2 × 2 스퀘어', cols: 2, rows: 2, cells: 4, canvasW: 600, contentW: 520, cellH: 260, gap: 12, pad: 24, footerH: 80 }
};
const state = { photos: Array(8).fill(null), frameImage: null, filter: 'color', camera: null, cameraPhotos: Array(8).fill(null), selectedPhoto: 0, caption: '', layout: 'strip4', capturePending: false };
const $ = id => document.getElementById(id);
const slots = $('slots'), input = $('fileInput'), message = $('message'), toast = $('toast'), previewCanvas = $('previewCanvas');
const previewCtx = previewCanvas.getContext('2d');
const today = new Date();
const dateText = `${today.getFullYear()}. ${String(today.getMonth() + 1).padStart(2, '0')}. ${String(today.getDate()).padStart(2, '0')}`;

function layoutInfo() { const layout = FRAME_LAYOUTS[state.layout]; return { ...layout, height: layout.pad * 2 + (layout.topOffset || 0) + layout.rows * layout.cellH + (layout.rows - 1) * layout.gap + layout.footerH }; }
function activeCount() { return layoutInfo().cells; }

function renderFrameChoices() {
  const root = $('frameChoices');
  root.innerHTML = Object.entries(FRAME_LAYOUTS).map(([key, layout]) => `<button class="frame-choice ${key === state.layout ? 'selected' : ''}" type="button" data-layout="${key}" role="radio" aria-checked="${key === state.layout}"><span class="frame-thumb" data-cols="${layout.cols}" style="grid-template-columns:repeat(${layout.cols},1fr);grid-template-rows:repeat(${layout.rows},1fr)">${Array.from({ length: layout.cells }, () => '<i></i>').join('')}</span><span>${layout.name}</span></button>`).join('');
  root.querySelectorAll('[data-layout]').forEach(btn => btn.onclick = () => { state.layout = btn.dataset.layout; state.selectedPhoto = Math.min(state.selectedPhoto, activeCount() - 1); renderFrameChoices(); render(); renderCameraThumbs(); });
}

function renderSlots() {
  const count = activeCount(); slots.innerHTML = '';
  state.photos.slice(0, count).forEach((photo, i) => {
    const slot = document.createElement('div'); slot.className = 'slot';
    slot.innerHTML = photo
      ? `<img src="${photo.url}" alt="${i + 1}번 사진"><span class="slot-num">${i + 1}</span><button class="slot-replace" type="button" aria-label="${i + 1}번 사진 바꾸기">바꾸기</button><div class="slot-actions"><button type="button" data-move="-1" aria-label="앞으로 이동" ${i === 0 ? 'disabled' : ''}>←</button><button type="button" data-move="1" aria-label="뒤로 이동" ${i === count - 1 ? 'disabled' : ''}>→</button><button type="button" data-remove aria-label="사진 삭제">×</button></div>`
      : `<button class="slot-add" type="button"><span class="slot-empty"><b>＋</b><small>사진 ${i + 1} 추가</small></span></button>`;
    const openPicker = () => { state.selectedPhoto = i; input.dataset.index = i; input.click(); };
    slot.querySelector('.slot-replace, .slot-add')?.addEventListener('click', openPicker);
    slot.querySelector('[data-remove]')?.addEventListener('click', () => removePhoto(i));
    slot.querySelectorAll('[data-move]').forEach(btn => btn.addEventListener('click', () => movePhoto(i, Number(btn.dataset.move))));
    slots.append(slot);
  });
  $('photoCount').textContent = `${state.photos.slice(0, count).filter(Boolean).length} / ${count}`;
  $('uploadTitle').textContent = `사진 ${count}장을 선택해주세요`;
}

function removePhoto(index) {
  const photo = state.photos[index]; if (photo) URL.revokeObjectURL(photo.url);
  state.photos[index] = null; state.cameraPhotos[index] = null; render(); renderCameraThumbs();
}
function movePhoto(index, delta) {
  const next = index + delta; if (next < 0 || next >= activeCount()) return;
  [state.photos[index], state.photos[next]] = [state.photos[next], state.photos[index]];
  [state.cameraPhotos[index], state.cameraPhotos[next]] = [state.cameraPhotos[next], state.cameraPhotos[index]];
  state.selectedPhoto = next; render(); renderCameraThumbs();
}

function setPhoto(index, photo) { state.photos[index] = photo ? { zoom: 1, x: 50, y: 50, ...photo } : null; render(); }
input.addEventListener('change', e => {
  const start = Number(input.dataset.index || 0), count = activeCount();
  [...e.target.files].forEach((file, j) => {
    const index = start + j; if (index >= count || !file.type.startsWith('image/')) return;
    const previous = state.photos[index]; if (previous) URL.revokeObjectURL(previous.url); state.cameraPhotos[index] = null;
    const url = URL.createObjectURL(file), image = new Image(); image.onload = () => setPhoto(index, { url, image }); image.onerror = () => URL.revokeObjectURL(url); image.src = url;
  });
  input.value = '';
});

function renderAdjustments() {
  const photo = state.photos[state.selectedPhoto], box = $('photoAdjustments');
  if (!photo) { box.innerHTML = '<span class="adjust-hint">사진을 넣은 뒤 프레임을 선택해 확대 비율과 위치를 조절하세요.</span>'; return; }
  box.innerHTML = `<div class="adjust-select">${state.photos.slice(0, activeCount()).map((p, i) => `<button type="button" class="adjust-tab ${i === state.selectedPhoto ? 'active' : ''}" data-frame="${i}">사진 ${i + 1}${p ? '' : ' · 비어 있음'}</button>`).join('')}</div><div class="adjust-title">사진 ${state.selectedPhoto + 1} 조정 <span>프레임 안에서 확대하고 위치를 맞춰보세요</span></div><label class="range-control"><span>확대</span><input data-adjust="zoom" type="range" min="100" max="250" value="${Math.round(photo.zoom * 100)}"><output>${Math.round(photo.zoom * 100)}%</output></label><label class="range-control"><span>가로 위치</span><input data-adjust="x" type="range" min="0" max="100" value="${photo.x}"><output>${photo.x}%</output></label><label class="range-control"><span>세로 위치</span><input data-adjust="y" type="range" min="0" max="100" value="${photo.y}"><output>${photo.y}%</output></label>`;
  box.querySelectorAll('[data-frame]').forEach(btn => btn.onclick = () => { state.selectedPhoto = +btn.dataset.frame; renderAdjustments(); });
  box.querySelectorAll('[data-adjust]').forEach(input => input.oninput = () => {
    const key = input.dataset.adjust; photo[key] = key === 'zoom' ? +input.value / 100 : +input.value; input.nextElementSibling.value = `${input.value}%`;
    redrawPreview();
  });
}

document.querySelectorAll('[data-filter]').forEach(btn => btn.addEventListener('click', () => {
  state.filter = btn.dataset.filter; document.querySelectorAll('[data-filter]').forEach(option => option.classList.toggle('selected', option === btn)); redrawPreview();
}));
$('chooseFramePhoto').onclick = () => $('framePhotoInput').click();
$('framePhotoInput').addEventListener('change', event => {
  const file = event.target.files?.[0]; if (!file || !file.type.startsWith('image/')) return;
  if (state.frameImage?.url) URL.revokeObjectURL(state.frameImage.url);
  const url = URL.createObjectURL(file), image = new Image();
  image.onload = () => { state.frameImage = { url, image }; $('framePhotoName').textContent = file.name; $('clearFramePhoto').classList.remove('hidden'); redrawPreview(); };
  image.onerror = () => { URL.revokeObjectURL(url); showMessage('프레임 사진을 불러오지 못했어요.'); };
  image.src = url; event.target.value = '';
});
$('clearFramePhoto').onclick = () => { if (state.frameImage?.url) URL.revokeObjectURL(state.frameImage.url); state.frameImage = null; $('framePhotoName').textContent = '선택 안 함 · 프레임은 흰색'; $('clearFramePhoto').classList.add('hidden'); redrawPreview(); };
$('captionInput').addEventListener('input', () => { state.caption = $('captionInput').value; redrawPreview(); });
$('dateToggle').addEventListener('change', redrawPreview);

function showMessage(text) { toast.textContent = text; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2600); }
function showPanel(which) {
  const upload = which === 'upload'; if (upload && state.camera) stopCamera();
  $('uploadPanel').classList.toggle('hidden', !upload); $('cameraPanel').classList.toggle('hidden', upload);
  $('uploadTab').classList.toggle('active', upload); $('cameraTab').classList.toggle('active', !upload);
  $('uploadTab').setAttribute('aria-selected', upload); $('cameraTab').setAttribute('aria-selected', !upload);
}
$('uploadTab').onclick = () => showPanel('upload'); $('cameraTab').onclick = () => showPanel('camera');

async function startCamera() {
  try {
    state.camera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    $('video').srcObject = state.camera; $('video').classList.remove('hidden'); $('cameraPlaceholder').classList.add('hidden'); $('captureBtn').disabled = false; $('stopCamera').disabled = false;
    showMessage('카메라가 준비됐어요. 타이머를 고르고 촬영하세요.');
  } catch (err) { showMessage(err.name === 'NotAllowedError' ? '카메라 권한을 허용해주세요.' : '카메라를 사용할 수 없어요. 파일 업로드를 이용해주세요.'); }
}
function stopCamera() { if (state.camera) { state.camera.getTracks().forEach(t => t.stop()); state.camera = null; } $('video').srcObject = null; $('video').classList.add('hidden'); $('cameraPlaceholder').classList.remove('hidden'); $('captureBtn').disabled = true; $('stopCamera').disabled = true; }
$('startCamera').onclick = startCamera; $('stopCamera').onclick = stopCamera;

function takePhoto() {
  return new Promise(resolve => {
    const index = state.photos.slice(0, activeCount()).findIndex(p => !p);
    if (index < 0) { showMessage('현재 프레임의 사진을 모두 촬영했어요. 순서를 바꾸거나 사진을 삭제해 다시 촬영할 수 있어요.'); resolve(); return; }
    const video = $('video'), captureCanvas = $('captureCanvas'); captureCanvas.width = video.videoWidth; captureCanvas.height = video.videoHeight; captureCanvas.getContext('2d').drawImage(video, 0, 0);
    captureCanvas.toBlob(blob => {
      if (!blob) { showMessage('사진을 저장하지 못했어요. 다시 촬영해주세요.'); resolve(); return; }
      const previous = state.photos[index]; if (previous) URL.revokeObjectURL(previous.url);
      const url = URL.createObjectURL(blob), image = new Image(); image.onload = () => {
        state.cameraPhotos[index] = { url, image }; state.selectedPhoto = index; setPhoto(index, state.cameraPhotos[index]); renderCameraThumbs();
        const total = activeCount(); $('shotBadge').textContent = `${index + 1} / ${total} 촬영 완료`; $('shotBadge').classList.remove('hidden'); $('cameraTip').textContent = index + 1 === total ? `${total}장 촬영 완료!` : `${index + 1}장 촬영 완료 · ${total - index - 1}장 더 찍어주세요`; resolve();
      }; image.onerror = () => { URL.revokeObjectURL(url); showMessage('사진을 불러오지 못했어요. 다시 촬영해주세요.'); resolve(); }; image.src = url;
    }, 'image/jpeg', .94);
  });
}
$('captureBtn').onclick = async () => {
  if (state.capturePending) return; state.capturePending = true; $('captureBtn').disabled = true;
  const seconds = +$('timerSelect').value;
  if (seconds) { $('shotBadge').classList.remove('hidden'); for (let n = seconds; n > 0 && state.camera; n--) { $('shotBadge').textContent = `${n}초 후 촬영`; await new Promise(resolve => setTimeout(resolve, 1000)); } }
  if (state.camera) await takePhoto();
  state.capturePending = false; $('captureBtn').disabled = !state.camera;
};

function renderCameraThumbs() {
  $('cameraThumbs').innerHTML = '';
  state.cameraPhotos.slice(0, activeCount()).forEach((p, i) => {
    const el = document.createElement('div'); el.className = 'camera-thumb'; el.innerHTML = p ? `<img src="${p.url}" alt="촬영 사진 ${i + 1}"><span>${i + 1}</span>` : ''; el.title = p ? '눌러서 사진 삭제' : '';
    if (p) el.onclick = () => removePhoto(i); $('cameraThumbs').append(el);
  });
}

function drawCrop(ctx, img, x, y, w, h, photo) {
  const scale = Math.max(w / img.width, h / img.height) * photo.zoom, sw = w / scale, sh = h / scale;
  const sx = (img.width - sw) * photo.x / 100, sy = (img.height - sh) * photo.y / 100;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.filter = state.filter === 'grayscale' ? 'grayscale(100%)' : 'none'; ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h); ctx.restore();
}
function contrastText(ctx, x, y) {
  const [r, g, b] = ctx.getImageData(Math.max(0, Math.min(ctx.canvas.width - 1, Math.round(x))), Math.max(0, Math.min(ctx.canvas.height - 1, Math.round(y))), 1, 1).data;
  return (r * .2126 + g * .7152 + b * .0722) > 145 ? '#29271f' : '#fffdf5';
}
function drawPreview() {
  const layout = layoutInfo(), canvas = previewCanvas, ctx = previewCtx;
  canvas.width = layout.canvasW; canvas.height = layout.height;
  const scale = Math.min(1, 220 / layout.canvasW, 380 / layout.height);
  canvas.style.width = `${layout.canvasW * scale}px`; canvas.style.height = `${layout.height * scale}px`;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (state.frameImage) drawCrop(ctx, state.frameImage.image, 0, 0, canvas.width, canvas.height, { zoom: 1, x: 50, y: 50 });
  const cellW = (layout.contentW - layout.gap * (layout.cols - 1)) / layout.cols;
  const startX = (layout.canvasW - layout.contentW) / 2, startY = layout.pad + (layout.topOffset || 0);
  for (let i = 0; i < layout.cells; i++) {
    const photo = state.photos[i];
    const col = i % layout.cols, row = Math.floor(i / layout.cols);
    const x = startX + col * (cellW + layout.gap), y = startY + row * (layout.cellH + layout.gap);
    if (photo) drawCrop(ctx, photo.image, x, y, cellW, layout.cellH, photo);
    else { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, cellW, layout.cellH); }
  }
  if ($('dateToggle').checked) { ctx.font = `500 ${Math.max(12, layout.canvasW * .026)}px "DM Sans", sans-serif`; const width = ctx.measureText(dateText).width; ctx.fillStyle = contrastText(ctx, layout.canvasW - layout.pad - width / 2, layout.height - layout.pad - 16); ctx.fillText(dateText, layout.canvasW - layout.pad - width, layout.height - layout.pad - 12); }
  if (state.caption.trim()) { ctx.font = `600 ${Math.max(13, layout.canvasW * .03)}px "Noto Sans KR", sans-serif`; state.caption.split('\n').slice(0, 3).forEach((line, i) => { const y = layout.height - layout.pad - 44 + i * Math.max(16, layout.canvasW * .036); ctx.fillStyle = contrastText(ctx, layout.pad + 2, y - 4); ctx.fillText(line, layout.pad, y, layout.contentW * .62); }); }
}
function redrawPreview() { drawPreview(); }
function renderAll() {
  renderSlots(); renderAdjustments(); drawPreview();
  const count = activeCount(), filled = state.photos.slice(0, count).filter(Boolean).length;
  $('photoCount').textContent = `${filled} / ${count}`; $('uploadTitle').textContent = `사진 ${count}장을 선택해주세요`;
  $('downloadBtn').disabled = filled !== count;
  message.textContent = filled === count ? '좋아요! 나만의 네컷 사진이 완성됐어요.' : `사진 ${count - filled}장을 더 추가하면 저장할 수 있어요.`;
  $('layoutSummary').textContent = FRAME_LAYOUTS[state.layout].name; $('imageDimensions').textContent = `${layoutInfo().canvasW} × ${layoutInfo().height} px`;
}

$('downloadBtn').onclick = () => {
  const count = activeCount(); if (!state.photos.slice(0, count).every(Boolean)) return;
  previewCanvas.toBlob(blob => {
    if (!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `fourcut-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}.jpg`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000); showMessage('네컷 사진을 기기에 저장했어요.');
  }, 'image/jpeg', .95);
};
$('resetBtn').onclick = () => {
  state.photos.forEach(photo => photo && URL.revokeObjectURL(photo.url)); state.photos = Array(8).fill(null); state.cameraPhotos = Array(8).fill(null);
  renderAll(); renderCameraThumbs(); $('cameraTip').textContent = '촬영한 사진은 아래 프레임에 담겨요'; $('shotBadge').classList.add('hidden'); showMessage('새로운 네컷 사진을 만들어보세요.');
};

function render() { renderAll(); }
renderFrameChoices(); renderAll();
