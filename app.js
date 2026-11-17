/**
 * Signature Extractor
 * Upload/photograph a paper with a signature → extract & download.
 */
(function () {
  'use strict';

  const state = {
    originalImage: null,
    rotation: 0,
    crop: { x: 0, y: 0, w: 100, h: 50 },
    threshold: 28,
    cleanliness: 15,
    inkColor: '#0b0f19',
    previewBg: 'checker',
    isDragging: false,
    isResizing: false,
    activeHandle: null,
    dragStart: { x: 0, y: 0 },
    cropStart: { x: 0, y: 0, w: 0, h: 0 },
    scaleX: 1,
    scaleY: 1
  };

  const el = {
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    themeIconMoon:  document.getElementById('themeIconMoon'),
    themeIconSun:   document.getElementById('themeIconSun'),

    uploadSection:  document.getElementById('uploadSection'),
    dropZone:       document.getElementById('dropZone'),
    fileInput:      document.getElementById('fileInput'),
    cameraInput:    document.getElementById('cameraInput'),
    webcamModalBtn: document.getElementById('webcamModalBtn'),

    webcamModal:     document.getElementById('webcamModal'),
    webcamVideo:     document.getElementById('webcamVideo'),
    closeWebcamBtn:  document.getElementById('closeWebcamBtn'),
    cancelWebcamBtn: document.getElementById('cancelWebcamBtn'),
    captureWebcamBtn:document.getElementById('captureWebcamBtn'),

    workspaceSection: document.getElementById('workspaceSection'),
    cropWrapper:      document.getElementById('cropWrapper'),
    canvasContainer:  document.getElementById('canvasContainer'),
    cardCanvas:       document.getElementById('cardCanvas'),
    cropBox:          document.getElementById('cropBox'),
    cropDimBadge:     document.getElementById('cropDimBadge'),
    autoDetectBtn:    document.getElementById('autoDetectBtn'),
    rotateCWBtn:      document.getElementById('rotateCWBtn'),
    rotateCCWBtn:     document.getElementById('rotateCCWBtn'),
    uploadNewBtn:     document.getElementById('uploadNewBtn'),

    previewContainer:    document.getElementById('previewContainer'),
    signaturePreviewImg: document.getElementById('signaturePreviewImg'),
    sigResolutionLabel:  document.getElementById('sigResolutionLabel'),
    bgCheckerBtn:        document.getElementById('bgCheckerBtn'),
    bgWhiteBtn:          document.getElementById('bgWhiteBtn'),
    bgDarkBtn:           document.getElementById('bgDarkBtn'),
    downloadPngBtn:      document.getElementById('downloadPngBtn'),
    downloadJpgBtn:      document.getElementById('downloadJpgBtn'),
    downloadSvgBtn:      document.getElementById('downloadSvgBtn'),
    copyClipboardBtn:    document.getElementById('copyClipboardBtn'),

    thresholdSlider:  document.getElementById('thresholdSlider'),
    thresholdVal:     document.getElementById('thresholdVal'),
    cleanlinessSlider:document.getElementById('cleanlinessSlider'),
    cleanlinessVal:   document.getElementById('cleanlinessVal'),
    colorBtns:        document.querySelectorAll('.color-btn'),

    toast:    document.getElementById('toast'),
    toastMsg: document.getElementById('toastMsg')
  };

  let webcamStream = null;

  /* ─── Init ─── */
  function init() {
    initTheme();
    setupEvents();
    setupCropInteractions();
    lucide.createIcons();
  }

  function initTheme() {
    const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) {
      document.documentElement.classList.add('dark');
      el.themeIconMoon.classList.remove('hidden');
      el.themeIconSun.classList.add('hidden');
    }
  }

  function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    el.themeIconMoon.classList.toggle('hidden', !isDark);
    el.themeIconSun.classList.toggle('hidden', isDark);
  }

  function showToast(msg) {
    el.toastMsg.textContent = msg;
    el.toast.classList.remove('translate-y-16', 'opacity-0');
    el.toast.classList.add('translate-y-0', 'opacity-100');
    setTimeout(() => {
      el.toast.classList.remove('translate-y-0', 'opacity-100');
      el.toast.classList.add('translate-y-16', 'opacity-0');
    }, 2200);
  }

  /* ─── Events ─── */
  function setupEvents() {
    el.themeToggleBtn.addEventListener('click', toggleTheme);

    el.fileInput.addEventListener('change',  e => handleFiles(e.target.files));
    el.cameraInput.addEventListener('change', e => handleFiles(e.target.files));

    // Drop zone click → file picker
    el.dropZone.addEventListener('click', e => {
      if (e.target === el.dropZone) el.fileInput.click();
    });

    el.dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      el.dropZone.classList.add('border-brand-500');
    });
    ['dragleave', 'dragend'].forEach(t => el.dropZone.addEventListener(t, () => el.dropZone.classList.remove('border-brand-500')));
    el.dropZone.addEventListener('drop', e => {
      e.preventDefault();
      el.dropZone.classList.remove('border-brand-500');
      if (e.dataTransfer.files && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    });

    window.addEventListener('paste', e => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) { handleImageFile(file); showToast('Image pasted'); break; }
        }
      }
    });

    el.webcamModalBtn.addEventListener('click', openWebcam);
    el.closeWebcamBtn.addEventListener('click', closeWebcam);
    el.cancelWebcamBtn.addEventListener('click', closeWebcam);
    el.captureWebcamBtn.addEventListener('click', captureWebcam);

    el.rotateCWBtn.addEventListener('click',  () => rotate(90));
    el.rotateCCWBtn.addEventListener('click', () => rotate(-90));
    el.autoDetectBtn.addEventListener('click', () => { autoDetect(); showToast('Signature detected'); });
    el.uploadNewBtn.addEventListener('click', () => {
      el.workspaceSection.classList.add('hidden');
      el.uploadSection.classList.remove('hidden');
    });

    el.thresholdSlider.addEventListener('input', e => {
      state.threshold = +e.target.value;
      el.thresholdVal.textContent = state.threshold;
      extractAndRender();
    });
    el.cleanlinessSlider.addEventListener('input', e => {
      state.cleanliness = +e.target.value;
      el.cleanlinessVal.textContent = state.cleanliness;
      extractAndRender();
    });

    el.colorBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        el.colorBtns.forEach(b => { b.classList.remove('border-brand-500'); b.classList.add('border-transparent'); });
        btn.classList.add('border-brand-500');
        btn.classList.remove('border-transparent');
        state.inkColor = btn.dataset.color;
        extractAndRender();
      });
    });

    el.bgCheckerBtn.addEventListener('click', () => setPreviewBg('checker'));
    el.bgWhiteBtn.addEventListener('click',   () => setPreviewBg('white'));
    el.bgDarkBtn.addEventListener('click',    () => setPreviewBg('dark'));

    el.downloadPngBtn.addEventListener('click',  downloadPNG);
    el.downloadJpgBtn.addEventListener('click',  downloadJPG);
    el.downloadSvgBtn.addEventListener('click',  downloadSVG);
    el.copyClipboardBtn.addEventListener('click', copyToClipboard);

    window.addEventListener('resize', debounce(() => {
      if (state.originalImage) { renderCanvas(); updateCropUI(); }
    }, 150));
  }

  /* ─── Background preview toggle ─── */
  function setPreviewBg(type) {
    state.previewBg = type;
    el.previewContainer.classList.remove('checker-bg', 'bg-white', 'bg-slate-900');
    [el.bgCheckerBtn, el.bgWhiteBtn, el.bgDarkBtn].forEach(b => {
      b.classList.remove('bg-white', 'dark:bg-slate-700', 'shadow-sm');
      b.classList.add('text-slate-400');
    });
    if (type === 'checker') { el.previewContainer.classList.add('checker-bg'); el.bgCheckerBtn.classList.add('bg-white', 'dark:bg-slate-700', 'shadow-sm'); }
    else if (type === 'white') { el.previewContainer.classList.add('bg-white'); el.bgWhiteBtn.classList.add('bg-white', 'dark:bg-slate-700', 'shadow-sm'); }
    else { el.previewContainer.classList.add('bg-slate-900'); el.bgDarkBtn.classList.add('bg-white', 'dark:bg-slate-700', 'shadow-sm'); }
  }

  /* ─── File handling ─── */
  function handleFiles(files) {
    if (!files || !files.length) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) { alert('Please select an image file.'); return; }
    handleImageFile(file);
  }

  function handleImageFile(file) {
    const reader = new FileReader();
    reader.onload = e => loadImage(e.target.result);
    reader.readAsDataURL(file);
  }

  function loadImage(src) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setupWorkspace(img);
    img.src = src;
  }

  function setupWorkspace(img) {
    state.originalImage = img;
    state.rotation = 0;
    el.uploadSection.classList.add('hidden');
    el.workspaceSection.classList.remove('hidden');
    renderCanvas();
    autoDetect();
  }

  /* ─── Webcam ─── */
  function openWebcam() {
    el.webcamModal.classList.remove('hidden');
    el.webcamModal.classList.add('flex');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => { webcamStream = stream; el.webcamVideo.srcObject = stream; })
      .catch(() => alert('Could not access camera.'));
  }

  function closeWebcam() {
    if (webcamStream) { webcamStream.getTracks().forEach(t => t.stop()); webcamStream = null; }
    el.webcamModal.classList.add('hidden');
    el.webcamModal.classList.remove('flex');
  }

  function captureWebcam() {
    const v = el.webcamVideo;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    const img = new Image();
    img.onload = () => setupWorkspace(img);
    img.src = c.toDataURL('image/jpeg', 0.95);
    closeWebcam();
  }

  /* ─── Canvas Rendering ─── */
  function rotate(deg) {
    state.rotation = (state.rotation + deg + 360) % 360;
    renderCanvas();
    updateCropUI();
    extractAndRender();
  }

  function renderCanvas() {
    const img = state.originalImage;
    if (!img) return;
    const rot = state.rotation;
    const sideways = rot === 90 || rot === 270;
    const srcW = sideways ? img.height : img.width;
    const srcH = sideways ? img.width  : img.height;

    const availW = (el.cropWrapper.clientWidth || 460) - 16;
    const maxH   = Math.min(window.innerHeight * 0.6, 520);
    let dW = availW;
    let dH = (srcH / srcW) * dW;
    if (dH > maxH) { dH = maxH; dW = (srcW / srcH) * dH; }
    dW = Math.round(dW); dH = Math.round(dH);

    el.cardCanvas.width  = dW;
    el.cardCanvas.height = dH;
    el.cardCanvas.style.width  = dW + 'px';
    el.cardCanvas.style.height = dH + 'px';
    el.canvasContainer.style.width  = dW + 'px';
    el.canvasContainer.style.height = dH + 'px';

    const ctx = el.cardCanvas.getContext('2d');
    ctx.clearRect(0, 0, dW, dH);
    ctx.save();
    ctx.translate(dW / 2, dH / 2);
    ctx.rotate((rot * Math.PI) / 180);
    if (sideways) ctx.drawImage(img, -dH / 2, -dW / 2, dH, dW);
    else          ctx.drawImage(img, -dW / 2, -dH / 2, dW, dH);
    ctx.restore();

    state.scaleX = dW / srcW;
    state.scaleY = dH / srcH;
    clampCrop();
    updateCropUI();
  }

  /* ─── Crop clamping & UI ─── */
  function clampCrop() {
    const img = state.originalImage;
    if (!img) return;
    const sideways = state.rotation === 90 || state.rotation === 270;
    const maxW = sideways ? img.height : img.width;
    const maxH = sideways ? img.width  : img.height;
    state.crop.w = Math.max(20, Math.min(state.crop.w, maxW));
    state.crop.h = Math.max(10, Math.min(state.crop.h, maxH));
    state.crop.x = Math.max(0,  Math.min(state.crop.x, maxW - state.crop.w));
    state.crop.y = Math.max(0,  Math.min(state.crop.y, maxH - state.crop.h));
  }

  function updateCropUI() {
    const { x, y, w, h } = state.crop;
    const sx = state.scaleX, sy = state.scaleY;
    el.cropBox.style.left   = Math.round(x * sx) + 'px';
    el.cropBox.style.top    = Math.round(y * sy) + 'px';
    el.cropBox.style.width  = Math.round(w * sx) + 'px';
    el.cropBox.style.height = Math.round(h * sy) + 'px';
    el.cropDimBadge.textContent = Math.round(w) + ' × ' + Math.round(h) + ' px';
  }

  /* ─── AUTO-DETECT signature on paper ─── */
  function autoDetect() {
    const img = state.originalImage;
    if (!img) return;

    const sideways = state.rotation === 90 || state.rotation === 270;
    const sw = sideways ? img.height : img.width;
    const sh = sideways ? img.width  : img.height;

    // Render to offscreen canvas at native resolution
    const oc = document.createElement('canvas');
    oc.width = sw; oc.height = sh;
    const ctx = oc.getContext('2d');
    ctx.translate(sw / 2, sh / 2);
    ctx.rotate((state.rotation * Math.PI) / 180);
    if (sideways) ctx.drawImage(img, -sh / 2, -sw / 2, sh, sw);
    else          ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);

    try {
      const data = ctx.getImageData(0, 0, sw, sh).data;

      // ── Step 1: Estimate background luminance ──
      // Sample the entire image; paper background is light → 90th percentile
      const lums = [];
      for (let i = 0; i < data.length; i += 8) {
        lums.push(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
      }
      lums.sort((a, b) => a - b);
      const bgLum = lums[Math.floor(lums.length * 0.90)];

      // Ink threshold: pixels significantly darker than background
      const inkThresh = bgLum * 0.72; // pixel lum < 72% of bg = ink

      // ── Step 2: Find bounding box of ALL ink pixels ──
      let minX = sw, maxX = 0, minY = sh, maxY = 0;
      let hasInk = false;
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const i = (y * sw + x) * 4;
          const lum = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
          if (lum < inkThresh) {
            hasInk = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (!hasInk) {
        // Fallback: use centre third
        state.crop = { x: Math.round(sw*0.1), y: Math.round(sh*0.1), w: Math.round(sw*0.8), h: Math.round(sh*0.8) };
      } else {
        // ── Step 3: Scan horizontal ink density per row
        // Find the row band with the MOST concentrated ink
        // (signature typically occupies a narrow horizontal strip)
        const inkPerRow = new Array(sh).fill(0);
        for (let y = 0; y < sh; y++) {
          for (let x = 0; x < sw; x++) {
            const i = (y * sw + x) * 4;
            const lum = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
            if (lum < inkThresh) inkPerRow[y]++;
          }
        }

        // Build row bands (contiguous rows with ink)
        const bands = [];
        let inBand = false, bStart = 0, bSum = 0;
        for (let y = 0; y < sh; y++) {
          if (inkPerRow[y] > 2) {
            if (!inBand) { inBand = true; bStart = y; bSum = 0; }
            bSum += inkPerRow[y];
          } else if (inBand) {
            inBand = false;
            const bLen = y - bStart;
            if (bLen >= 3) bands.push({ y0: bStart, y1: y, density: bSum / bLen });
          }
        }
        if (inBand) {
          const bLen = sh - bStart;
          if (bLen >= 3) bands.push({ y0: bStart, y1: sh, density: bSum / bLen });
        }

        // ── Step 4: Pick the DENSEST band (most ink per row = signature stroke area)
        // Also weight by being somewhat central/below-centre (signatures are usually there)
        let best = null;
        const midY = sh * 0.5;
        for (const b of bands) {
          const bMid = (b.y0 + b.y1) / 2;
          // Score = density * (1 - 0.3 * abs(bMid/sh - 0.65))
          // Prefer bands around 65% down the page
          const posScore = 1 - 0.3 * Math.abs(bMid / sh - 0.65);
          b.score = b.density * posScore;
          if (!best || b.score > best.score) best = b;
        }

        if (best) {
          // Find column bounds within the best band
          let bMinX = sw, bMaxX = 0;
          for (let y = best.y0; y < best.y1; y++) {
            for (let x = 0; x < sw; x++) {
              const i = (y * sw + x) * 4;
              const lum = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
              if (lum < inkThresh) {
                if (x < bMinX) bMinX = x;
                if (x > bMaxX) bMaxX = x;
              }
            }
          }
          const pad = Math.round(Math.max(sh, sw) * 0.025); // 2.5% padding
          state.crop = {
            x: Math.max(0, bMinX - pad),
            y: Math.max(0, best.y0 - pad),
            w: Math.min(sw, (bMaxX - bMinX) + pad * 2),
            h: Math.min(sh, (best.y1 - best.y0) + pad * 2)
          };
        } else {
          // Fallback: full ink bounding box with padding
          const pad = 20;
          state.crop = {
            x: Math.max(0, minX - pad),
            y: Math.max(0, minY - pad),
            w: Math.min(sw - Math.max(0, minX - pad), (maxX - minX) + pad * 2),
            h: Math.min(sh - Math.max(0, minY - pad), (maxY - minY) + pad * 2)
          };
        }
      }
    } catch (e) {
      console.warn('Auto-detect failed:', e);
      const sw2 = state.originalImage.width, sh2 = state.originalImage.height;
      state.crop = { x: Math.round(sw2*0.1), y: Math.round(sh2*0.3), w: Math.round(sw2*0.8), h: Math.round(sh2*0.4) };
    }

    clampCrop();
    updateCropUI();
    extractAndRender();
  }

  /* ─── Crop Interactions (drag + resize) ─── */
  function setupCropInteractions() {
    const box = el.cropBox;

    function getPos(e) {
      return e.touches && e.touches.length
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
        : { x: e.clientX, y: e.clientY };
    }

    // Drag the whole box
    function onDragStart(e) {
      if (e.target.classList.contains('crop-handle')) return;
      e.preventDefault();
      state.isDragging = true;
      const p = getPos(e);
      state.dragStart = { x: p.x, y: p.y };
      state.cropStart = { ...state.crop };
      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('touchmove', onDragMove, { passive: false });
      document.addEventListener('mouseup',   onDragEnd);
      document.addEventListener('touchend',  onDragEnd);
    }
    function onDragMove(e) {
      if (!state.isDragging) return;
      e.preventDefault();
      const p = getPos(e);
      state.crop.x = Math.round(state.cropStart.x + (p.x - state.dragStart.x) / state.scaleX);
      state.crop.y = Math.round(state.cropStart.y + (p.y - state.dragStart.y) / state.scaleY);
      clampCrop(); updateCropUI(); extractDebounced();
    }
    function onDragEnd() {
      state.isDragging = false;
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('touchmove', onDragMove);
      document.removeEventListener('mouseup',   onDragEnd);
      document.removeEventListener('touchend',  onDragEnd);
      extractAndRender();
    }
    box.addEventListener('mousedown', onDragStart);
    box.addEventListener('touchstart', onDragStart, { passive: false });

    // Resize handles
    box.querySelectorAll('.crop-handle').forEach(handle => {
      const ht = handle.dataset.handle;
      function onResizeStart(e) {
        e.preventDefault(); e.stopPropagation();
        state.isResizing = true;
        state.activeHandle = ht;
        const p = getPos(e);
        state.dragStart = { x: p.x, y: p.y };
        state.cropStart = { ...state.crop };
        document.addEventListener('mousemove', onResizeMove);
        document.addEventListener('touchmove', onResizeMove, { passive: false });
        document.addEventListener('mouseup',   onResizeEnd);
        document.addEventListener('touchend',  onResizeEnd);
      }
      function onResizeMove(e) {
        if (!state.isResizing) return;
        e.preventDefault();
        const p = getPos(e);
        const dx = (p.x - state.dragStart.x) / state.scaleX;
        const dy = (p.y - state.dragStart.y) / state.scaleY;
        let { x, y, w, h } = state.cropStart;
        const h_ = ht;
        if (h_.includes('r')) w += dx;
        if (h_.includes('b')) h += dy;
        if (h_.includes('l')) { const nw = w - dx; if (nw >= 20) { x += dx; w = nw; } }
        if (h_.includes('t')) { const nh = h - dy; if (nh >= 10) { y += dy; h = nh; } }
        state.crop = { x: Math.round(x), y: Math.round(y), w: Math.round(Math.max(20, w)), h: Math.round(Math.max(10, h)) };
        clampCrop(); updateCropUI(); extractDebounced();
      }
      function onResizeEnd() {
        state.isResizing = false; state.activeHandle = null;
        document.removeEventListener('mousemove', onResizeMove);
        document.removeEventListener('touchmove', onResizeMove);
        document.removeEventListener('mouseup',   onResizeEnd);
        document.removeEventListener('touchend',  onResizeEnd);
        extractAndRender();
      }
      handle.addEventListener('mousedown', onResizeStart);
      handle.addEventListener('touchstart', onResizeStart, { passive: false });
    });
  }

  /* ─── Signature Extraction ─── */
  function extractAndRender() {
    const img = state.originalImage;
    if (!img) return;

    const rot = state.rotation;
    const sideways = rot === 90 || rot === 270;
    const sw = sideways ? img.height : img.width;
    const sh = sideways ? img.width  : img.height;

    const oc = document.createElement('canvas');
    oc.width = sw; oc.height = sh;
    const fctx = oc.getContext('2d');
    fctx.translate(sw / 2, sh / 2);
    fctx.rotate((rot * Math.PI) / 180);
    if (sideways) fctx.drawImage(img, -sh/2, -sw/2, sh, sw);
    else          fctx.drawImage(img, -sw/2, -sh/2, sw, sh);

    const { x, y, w, h } = state.crop;
    if (w <= 0 || h <= 0) return;

    let cropData;
    try { cropData = fctx.getImageData(x, y, w, h); }
    catch (e) { return; }

    const pixels = cropData.data;

    // Background luminance (90th percentile = paper white)
    const samples = [];
    const step = Math.max(1, Math.floor((w * h) / 1500));
    for (let i = 0; i < pixels.length; i += step * 4) {
      samples.push(0.299 * pixels[i] + 0.587 * pixels[i+1] + 0.114 * pixels[i+2]);
    }
    samples.sort((a, b) => a - b);
    const bgLum = samples[Math.floor(samples.length * 0.90)] || 200;

    const thr = state.threshold;
    const clean = state.cleanliness;
    const isOrig = state.inkColor === 'original';
    let tr = 11, tg = 15, tb = 25;
    if (!isOrig && state.inkColor.startsWith('#')) {
      tr = parseInt(state.inkColor.slice(1,3), 16);
      tg = parseInt(state.inkColor.slice(3,5), 16);
      tb = parseInt(state.inkColor.slice(5,7), 16);
    }

    const out = new Uint8ClampedArray(pixels.length);
    let iMinX = w, iMaxX = 0, iMinY = h, iMaxY = 0, hasInk = false;

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const idx = (py * w + px) * 4;
        const lum = 0.299*pixels[idx] + 0.587*pixels[idx+1] + 0.114*pixels[idx+2];
        const diff = bgLum - lum;
        let alpha = 0;
        if (diff > clean) {
          alpha = Math.round(Math.min(1, Math.max(0, (diff - clean) / thr)) * 255);
        }
        if (alpha > 10) {
          hasInk = true;
          if (px < iMinX) iMinX = px;
          if (px > iMaxX) iMaxX = px;
          if (py < iMinY) iMinY = py;
          if (py > iMaxY) iMaxY = py;
        }
        out[idx]   = isOrig ? pixels[idx]   : tr;
        out[idx+1] = isOrig ? pixels[idx+1] : tg;
        out[idx+2] = isOrig ? pixels[idx+2] : tb;
        out[idx+3] = alpha;
      }
    }

    // Auto-trim to ink bounding box
    let finalCanvas = document.createElement('canvas');
    finalCanvas.width = w; finalCanvas.height = h;
    finalCanvas.getContext('2d').putImageData(new ImageData(out, w, h), 0, 0);

    if (hasInk && iMaxX >= iMinX && iMaxY >= iMinY) {
      const pad = 6;
      const tx = Math.max(0, iMinX - pad),  ty = Math.max(0, iMinY - pad);
      const tw = Math.min(w, iMaxX - iMinX + pad*2 + (iMinX > pad ? 0 : pad));
      const th = Math.min(h, iMaxY - iMinY + pad*2 + (iMinY > pad ? 0 : pad));
      const trimmed = document.createElement('canvas');
      trimmed.width = tw; trimmed.height = th;
      trimmed.getContext('2d').drawImage(finalCanvas, tx, ty, tw, th, 0, 0, tw, th);
      finalCanvas = trimmed;
    }

    el.signaturePreviewImg.src = finalCanvas.toDataURL('image/png');
    el.sigResolutionLabel.textContent = finalCanvas.width + ' × ' + finalCanvas.height + ' px';
    window._extractedCanvas = finalCanvas;
  }

  const extractDebounced = debounce(extractAndRender, 40);

  /* ─── Downloads ─── */
  function downloadPNG() {
    const c = window._extractedCanvas;
    if (!c) return;
    const a = document.createElement('a');
    a.download = 'signature.png';
    a.href = c.toDataURL('image/png');
    a.click();
    showToast('Downloading PNG…');
  }

  function downloadJPG() {
    const c = window._extractedCanvas;
    if (!c) return;
    const bg = document.createElement('canvas');
    bg.width = c.width; bg.height = c.height;
    const bctx = bg.getContext('2d');
    bctx.fillStyle = '#ffffff';
    bctx.fillRect(0, 0, bg.width, bg.height);
    bctx.drawImage(c, 0, 0);
    const a = document.createElement('a');
    a.download = 'signature.jpg';
    a.href = bg.toDataURL('image/jpeg', 0.95);
    a.click();
    showToast('Downloading JPG…');
  }

  function downloadSVG() {
    const c = window._extractedCanvas;
    if (!c) return;
    const dataUrl = c.toDataURL('image/png');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${c.width}" height="${c.height}"><image href="${dataUrl}" width="${c.width}" height="${c.height}"/></svg>`;
    const a = document.createElement('a');
    a.download = 'signature.svg';
    a.href = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    a.click();
    showToast('Downloading SVG…');
  }

  async function copyToClipboard() {
    const c = window._extractedCanvas;
    if (!c) return;
    try {
      c.toBlob(async blob => {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast('Copied to clipboard!');
      }, 'image/png');
    } catch {
      showToast('Copy not supported on this browser');
    }
  }

  /* ─── Utils ─── */
  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  init();
})();
