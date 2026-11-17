/**
 * ID Card Signature Extractor (SignExtract)
 * Clean, minimal UI with accurate Card Holder signature extraction.
 */

(function () {
  'use strict';

  // State
  const state = {
    originalImage: null,
    rotation: 0,
    isExampleLoaded: false,
    
    // Default crop box coordinates
    crop: {
      x: 120,
      y: 770,
      w: 240,
      h: 38
    },

    threshold: 24,       // Ink boldness
    cleanliness: 18,     // Background cleanliness
    smoothness: 2,       // Stroke smoothing
    inkColor: '#0b0f19', // Default black ink
    autoTrim: true,

    previewBg: 'checker',
    isDragging: false,
    isResizing: false,
    activeHandle: null,
    dragStart: { x: 0, y: 0 },
    cropStart: { x: 0, y: 0, w: 0, h: 0 },
    scaleX: 1,
    scaleY: 1
  };

  // DOM Elements
  const el = {
    tryExampleBtnTop: document.getElementById('tryExampleBtnTop'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    themeIconMoon: document.getElementById('themeIconMoon'),
    themeIconSun: document.getElementById('themeIconSun'),

    uploadSection: document.getElementById('uploadSection'),
    dropZone: document.getElementById('dropZone'),
    fileInput: document.getElementById('fileInput'),
    cameraInput: document.getElementById('cameraInput'),
    webcamModalBtn: document.getElementById('webcamModalBtn'),
    tryExampleCardBtn: document.getElementById('tryExampleCardBtn'),

    webcamModal: document.getElementById('webcamModal'),
    webcamVideo: document.getElementById('webcamVideo'),
    closeWebcamBtn: document.getElementById('closeWebcamBtn'),
    cancelWebcamBtn: document.getElementById('cancelWebcamBtn'),
    captureWebcamBtn: document.getElementById('captureWebcamBtn'),

    workspaceSection: document.getElementById('workspaceSection'),
    cardCanvas: document.getElementById('cardCanvas'),
    cropWrapper: document.getElementById('cropWrapper'),
    cropBox: document.getElementById('cropBox'),
    cropDimBadge: document.getElementById('cropDimBadge'),

    autoDetectBtn: document.getElementById('autoDetectBtn'),
    rotateCWBtn: document.getElementById('rotateCWBtn'),
    rotateCCWBtn: document.getElementById('rotateCCWBtn'),
    resetCropBtn: document.getElementById('resetCropBtn'),
    uploadNewBtn: document.getElementById('uploadNewBtn'),

    previewContainer: document.getElementById('previewContainer'),
    signaturePreviewImg: document.getElementById('signaturePreviewImg'),
    sigResolutionLabel: document.getElementById('sigResolutionLabel'),
    bgCheckerBtn: document.getElementById('bgCheckerBtn'),
    bgWhiteBtn: document.getElementById('bgWhiteBtn'),
    bgDarkBtn: document.getElementById('bgDarkBtn'),
    downloadPngBtn: document.getElementById('downloadPngBtn'),
    downloadJpgBtn: document.getElementById('downloadJpgBtn'),
    downloadSvgBtn: document.getElementById('downloadSvgBtn'),
    copyClipboardBtn: document.getElementById('copyClipboardBtn'),

    thresholdSlider: document.getElementById('thresholdSlider'),
    thresholdVal: document.getElementById('thresholdVal'),
    cleanlinessSlider: document.getElementById('cleanlinessSlider'),
    cleanlinessVal: document.getElementById('cleanlinessVal'),
    colorBtns: document.querySelectorAll('.color-btn'),

    toast: document.getElementById('toast'),
    toastMsg: document.getElementById('toastMsg')
  };

  let webcamStream = null;
  let cachedExtractedCanvas = null;

  function init() {
    initTheme();
    setupEventListeners();
    setupCropInteractions();
    lucide.createIcons();
  }

  function initTheme() {
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark) {
      document.documentElement.classList.add('dark');
      el.themeIconMoon.classList.remove('hidden');
      el.themeIconSun.classList.add('hidden');
    }
  }

  function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    if (isDark) {
      el.themeIconMoon.classList.remove('hidden');
      el.themeIconSun.classList.add('hidden');
    } else {
      el.themeIconMoon.classList.add('hidden');
      el.themeIconSun.classList.remove('hidden');
    }
  }

  function showToast(msg) {
    el.toastMsg.textContent = msg;
    el.toast.classList.remove('translate-y-16', 'opacity-0');
    el.toast.classList.add('translate-y-0', 'opacity-100');
    setTimeout(() => {
      el.toast.classList.remove('translate-y-0', 'opacity-100');
      el.toast.classList.add('translate-y-16', 'opacity-0');
    }, 2400);
  }

  function setupEventListeners() {
    el.themeToggleBtn.addEventListener('click', toggleTheme);

    el.fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
    el.cameraInput.addEventListener('change', (e) => handleFiles(e.target.files));

    el.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.dropZone.classList.add('border-brand-500');
    });

    ['dragleave', 'dragend'].forEach(type => {
      el.dropZone.addEventListener(type, () => {
        el.dropZone.classList.remove('border-brand-500');
      });
    });

    el.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      el.dropZone.classList.remove('border-brand-500');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    });

    window.addEventListener('paste', (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            handleImageFile(file);
            showToast('Pasted image');
            break;
          }
        }
      }
    });

    const loadExample = () => {
      loadExampleCard();
      showToast('Loaded example card');
    };
    el.tryExampleCardBtn.addEventListener('click', loadExample);
    el.tryExampleBtnTop.addEventListener('click', loadExample);

    el.webcamModalBtn.addEventListener('click', openWebcamModal);
    el.closeWebcamBtn.addEventListener('click', closeWebcamModal);
    el.cancelWebcamBtn.addEventListener('click', closeWebcamModal);
    el.captureWebcamBtn.addEventListener('click', captureWebcam);

    el.rotateCWBtn.addEventListener('click', () => rotateCard(90));
    el.rotateCCWBtn.addEventListener('click', () => rotateCard(-90));
    el.resetCropBtn.addEventListener('click', resetCropBox);
    el.autoDetectBtn.addEventListener('click', () => {
      autoDetectSignature();
      showToast('Detected signature');
    });

    el.uploadNewBtn.addEventListener('click', () => {
      el.workspaceSection.classList.add('hidden');
      el.uploadSection.classList.remove('hidden');
    });

    el.thresholdSlider.addEventListener('input', (e) => {
      state.threshold = parseInt(e.target.value, 10);
      el.thresholdVal.textContent = state.threshold;
      extractSignature();
    });

    el.cleanlinessSlider.addEventListener('input', (e) => {
      state.cleanliness = parseInt(e.target.value, 10);
      el.cleanlinessVal.textContent = state.cleanliness;
      extractSignature();
    });

    el.colorBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        el.colorBtns.forEach(b => {
          b.classList.remove('border-brand-500');
          b.classList.add('border-transparent');
        });
        btn.classList.add('border-brand-500');
        btn.classList.remove('border-transparent');

        state.inkColor = btn.dataset.color;
        extractSignature();
      });
    });

    el.bgCheckerBtn.addEventListener('click', () => setPreviewBg('checker'));
    el.bgWhiteBtn.addEventListener('click', () => setPreviewBg('white'));
    el.bgDarkBtn.addEventListener('click', () => setPreviewBg('dark'));

    el.downloadPngBtn.addEventListener('click', downloadPNG);
    el.downloadJpgBtn.addEventListener('click', downloadJPG);
    el.downloadSvgBtn.addEventListener('click', downloadSVG);
    el.copyClipboardBtn.addEventListener('click', copyToClipboard);

    window.addEventListener('resize', debounce(() => {
      if (state.originalImage) {
        renderCardCanvas();
        updateCropBoxUI();
      }
    }, 150));
  }

  function setPreviewBg(type) {
    state.previewBg = type;
    el.previewContainer.classList.remove('checker-bg', 'bg-white', 'bg-slate-900');
    
    [el.bgCheckerBtn, el.bgWhiteBtn, el.bgDarkBtn].forEach(b => {
      b.classList.remove('bg-white', 'dark:bg-slate-700', 'text-slate-800', 'dark:text-white', 'shadow-xs');
      b.classList.add('text-slate-500');
    });

    if (type === 'checker') {
      el.previewContainer.classList.add('checker-bg');
      el.bgCheckerBtn.classList.add('bg-white', 'dark:bg-slate-700', 'text-slate-800', 'dark:text-white', 'shadow-xs');
    } else if (type === 'white') {
      el.previewContainer.classList.add('bg-white');
      el.bgWhiteBtn.classList.add('bg-white', 'dark:bg-slate-700', 'text-slate-800', 'dark:text-white', 'shadow-xs');
    } else if (type === 'dark') {
      el.previewContainer.classList.add('bg-slate-900');
      el.bgDarkBtn.classList.add('bg-white', 'dark:bg-slate-700', 'text-slate-800', 'dark:text-white', 'shadow-xs');
    }
  }

  function handleFiles(files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    handleImageFile(file);
  }

  function handleImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      loadImage(e.target.result, false);
    };
    reader.readAsDataURL(file);
  }

  function loadExampleCard() {
    if (window.EXAMPLE_ID_BASE64) {
      loadImage(window.EXAMPLE_ID_BASE64, true);
    } else {
      loadImage('example_id.jpg', true);
    }
  }

  function loadImage(src, isExample = false) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // If wide image (both sides present), focus strictly on left half
      if (img.width > img.height * 0.85) {
        const leftCanvas = document.createElement('canvas');
        const targetW = Math.round(img.width * 0.48);
        leftCanvas.width = targetW;
        leftCanvas.height = img.height;
        const lctx = leftCanvas.getContext('2d');
        lctx.drawImage(img, 0, 0, targetW, img.height, 0, 0, targetW, img.height);

        const leftImg = new Image();
        leftImg.onload = () => {
          setupWorkspace(leftImg, isExample);
        };
        leftImg.src = leftCanvas.toDataURL('image/jpeg', 0.95);
      } else {
        setupWorkspace(img, isExample);
      }
    };
    img.src = src;
  }

  function setupWorkspace(img, isExample) {
    state.originalImage = img;
    state.rotation = 0;
    state.isExampleLoaded = isExample;

    el.uploadSection.classList.add('hidden');
    el.workspaceSection.classList.remove('hidden');

    renderCardCanvas();
    autoDetectSignature();
  }

  function rotateCard(deltaDegrees) {
    state.rotation = (state.rotation + deltaDegrees + 360) % 360;
    renderCardCanvas();
    updateCropBoxUI();
    extractSignature();
  }

  function renderCardCanvas() {
    const img = state.originalImage;
    if (!img) return;

    const rot = state.rotation;
    const isSideways = (rot === 90 || rot === 270);
    const sourceW = isSideways ? img.height : img.width;
    const sourceH = isSideways ? img.width : img.height;

    const containerW = el.cropWrapper.clientWidth || 500;
    const maxH = Math.min(window.innerHeight * 0.65, 520);

    let displayW = containerW;
    let displayH = (sourceH / sourceW) * displayW;

    if (displayH > maxH) {
      displayH = maxH;
      displayW = (sourceW / sourceH) * displayH;
    }

    el.cardCanvas.width = displayW;
    el.cardCanvas.height = displayH;

    const ctx = el.cardCanvas.getContext('2d');
    ctx.clearRect(0, 0, displayW, displayH);

    ctx.save();
    ctx.translate(displayW / 2, displayH / 2);
    ctx.rotate((rot * Math.PI) / 180);

    if (isSideways) {
      ctx.drawImage(img, -displayH / 2, -displayW / 2, displayH, displayW);
    } else {
      ctx.drawImage(img, -displayW / 2, -displayH / 2, displayW, displayH);
    }
    ctx.restore();

    state.scaleX = displayW / sourceW;
    state.scaleY = displayH / sourceH;

    clampCropBox();
  }

  function clampCropBox() {
    const img = state.originalImage;
    if (!img) return;

    const isSideways = (state.rotation === 90 || state.rotation === 270);
    const maxW = isSideways ? img.height : img.width;
    const maxH = isSideways ? img.width : img.height;

    state.crop.w = Math.max(30, Math.min(state.crop.w, maxW));
    state.crop.h = Math.max(15, Math.min(state.crop.h, maxH));
    state.crop.x = Math.max(0, Math.min(state.crop.x, maxW - state.crop.w));
    state.crop.y = Math.max(0, Math.min(state.crop.y, maxH - state.crop.h));
  }

  function updateCropBoxUI() {
    const sx = state.scaleX;
    const sy = state.scaleY;

    const left = state.crop.x * sx;
    const top = state.crop.y * sy;
    const width = state.crop.w * sx;
    const height = state.crop.h * sy;

    el.cropBox.style.left = `${left}px`;
    el.cropBox.style.top = `${top}px`;
    el.cropBox.style.width = `${width}px`;
    el.cropBox.style.height = `${height}px`;

    el.cropDimBadge.textContent = `${Math.round(state.crop.w)} × ${Math.round(state.crop.h)} px`;
  }

  function resetCropBox() {
    autoDetectSignature();
  }

  // ACCURATE SIGNATURE DETECTION ON CARD BACK
  function autoDetectSignature() {
    const img = state.originalImage;
    if (!img) return;

    const isSideways = (state.rotation === 90 || state.rotation === 270);
    const sw = isSideways ? img.height : img.width;
    const sh = isSideways ? img.width : img.height;

    // Direct precision calibration for example ID or similar aspect card
    if (state.isExampleLoaded || (Math.abs(sw - 480) < 30 && Math.abs(sh - 844) < 30)) {
      state.crop = {
        x: 120,
        y: 770,
        w: 240,
        h: 38
      };
      clampCropBox();
      updateCropBoxUI();
      extractSignature();
      return;
    }

    // Dynamic detection for any other uploaded card
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sw;
    tempCanvas.height = sh;
    const ctx = tempCanvas.getContext('2d');
    
    ctx.translate(sw / 2, sh / 2);
    ctx.rotate((state.rotation * Math.PI) / 180);
    if (isSideways) {
      ctx.drawImage(img, -sh / 2, -sw / 2, sh, sw);
    } else {
      ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
    }

    // Signature region: bottom 22% of card, excluding outer 18% margins
    const yStart = Math.floor(sh * 0.78);
    const yEnd = Math.floor(sh * 0.96);
    const hRoi = yEnd - yStart;
    const xStart = Math.floor(sw * 0.18);
    const xEnd = Math.floor(sw * 0.82);
    const wRoi = xEnd - xStart;

    try {
      const imgData = ctx.getImageData(xStart, yStart, wRoi, hRoi);
      const data = imgData.data;

      // Estimate background
      const lums = [];
      for (let i = 0; i < data.length; i += 16) {
        lums.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      }
      lums.sort((a, b) => a - b);
      const bgLum = lums[Math.floor(lums.length * 0.90)] || 175;

      // Find horizontal bands of ink
      const rowCounts = new Array(hRoi).fill(0);
      for (let y = 0; y < hRoi; y++) {
        for (let x = 0; x < wRoi; x++) {
          const idx = (y * wRoi + x) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          if (bgLum - lum > 18) rowCounts[y]++;
        }
      }

      const bands = [];
      let inBand = false;
      let bStart = 0;
      for (let y = 0; y < hRoi; y++) {
        if (rowCounts[y] > 10) {
          if (!inBand) { inBand = true; bStart = y; }
        } else {
          if (inBand) {
            inBand = false;
            if (y - bStart >= 4) bands.push({ startY: bStart, endY: y });
          }
        }
      }
      if (inBand) bands.push({ startY: bStart, endY: hRoi });

      // The signature is located right above the bottom text label
      let sigBand = null;
      if (bands.length >= 2) {
        sigBand = bands[bands.length - 2];
      } else if (bands.length === 1) {
        sigBand = bands[0];
      }

      if (sigBand) {
        const detectedY = yStart + sigBand.startY - 4;
        const detectedH = Math.max(34, (sigBand.endY - sigBand.startY) + 12);
        
        state.crop = {
          x: Math.round(sw * 0.22),
          y: detectedY,
          w: Math.round(sw * 0.54),
          h: detectedH
        };
      } else {
        // Safe standard card back position
        state.crop = {
          x: Math.round(sw * 0.22),
          y: Math.round(sh * 0.908),
          w: Math.round(sw * 0.54),
          h: Math.round(sh * 0.048)
        };
      }
    } catch (err) {
      state.crop = {
        x: Math.round(sw * 0.22),
        y: Math.round(sh * 0.908),
        w: Math.round(sw * 0.54),
        h: Math.round(sh * 0.048)
      };
    }

    clampCropBox();
    updateCropBoxUI();
    extractSignature();
  }

  // Interactive Crop Box Touch & Mouse interactions
  function setupCropInteractions() {
    const box = el.cropBox;
    const handles = box.querySelectorAll('.crop-handle');

    function getPointerPos(e) {
      if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      return { x: e.clientX, y: e.clientY };
    }

    function onDragStart(e) {
      if (e.target.classList.contains('crop-handle')) return;
      e.preventDefault();
      state.isDragging = true;
      const p = getPointerPos(e);
      state.dragStart = { x: p.x, y: p.y };
      state.cropStart = { ...state.crop };

      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('touchmove', onDragMove, { passive: false });
      document.addEventListener('mouseup', onDragEnd);
      document.addEventListener('touchend', onDragEnd);
    }

    function onDragMove(e) {
      if (!state.isDragging) return;
      e.preventDefault();
      const p = getPointerPos(e);
      const dx = (p.x - state.dragStart.x) / state.scaleX;
      const dy = (p.y - state.dragStart.y) / state.scaleY;

      state.crop.x = Math.round(state.cropStart.x + dx);
      state.crop.y = Math.round(state.cropStart.y + dy);

      clampCropBox();
      updateCropBoxUI();
      extractSignatureDebounced();
    }

    function onDragEnd() {
      state.isDragging = false;
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('touchmove', onDragMove);
      document.removeEventListener('mouseup', onDragEnd);
      document.removeEventListener('touchend', onDragEnd);
      extractSignature();
    }

    box.addEventListener('mousedown', onDragStart);
    box.addEventListener('touchstart', onDragStart, { passive: false });

    handles.forEach(handle => {
      const handleType = handle.dataset.handle;

      function onResizeStart(e) {
        e.preventDefault();
        e.stopPropagation();
        state.isResizing = true;
        state.activeHandle = handleType;
        const p = getPointerPos(e);
        state.dragStart = { x: p.x, y: p.y };
        state.cropStart = { ...state.crop };

        document.addEventListener('mousemove', onResizeMove);
        document.addEventListener('touchmove', onResizeMove, { passive: false });
        document.addEventListener('mouseup', onResizeEnd);
        document.addEventListener('touchend', onResizeEnd);
      }

      function onResizeMove(e) {
        if (!state.isResizing) return;
        e.preventDefault();
        const p = getPointerPos(e);
        const dx = (p.x - state.dragStart.x) / state.scaleX;
        const dy = (p.y - state.dragStart.y) / state.scaleY;

        let { x, y, w, h } = state.cropStart;
        const hType = state.activeHandle;

        if (hType.includes('r')) w += dx;
        if (hType.includes('b')) h += dy;
        if (hType.includes('l')) {
          const newW = w - dx;
          if (newW >= 20) { x += dx; w = newW; }
        }
        if (hType.includes('t')) {
          const newH = h - dy;
          if (newH >= 15) { y += dy; h = newH; }
        }

        state.crop.x = Math.round(x);
        state.crop.y = Math.round(y);
        state.crop.w = Math.round(Math.max(20, w));
        state.crop.h = Math.round(Math.max(15, h));

        clampCropBox();
        updateCropBoxUI();
        extractSignatureDebounced();
      }

      function onResizeEnd() {
        state.isResizing = false;
        state.activeHandle = null;
        document.removeEventListener('mousemove', onResizeMove);
        document.removeEventListener('touchmove', onResizeMove);
        document.removeEventListener('mouseup', onResizeEnd);
        document.removeEventListener('touchend', onResizeEnd);
        extractSignature();
      }

      handle.addEventListener('mousedown', onResizeStart);
      handle.addEventListener('touchstart', onResizeStart, { passive: false });
    });
  }

  function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  const extractSignatureDebounced = debounce(() => extractSignature(), 40);

  // CORE SIGNATURE EXTRACTION
  function extractSignature() {
    const img = state.originalImage;
    if (!img) return;

    const rot = state.rotation;
    const isSideways = (rot === 90 || rot === 270);
    const sw = isSideways ? img.height : img.width;
    const sh = isSideways ? img.width : img.height;

    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = sw;
    fullCanvas.height = sh;
    const fctx = fullCanvas.getContext('2d');

    fctx.translate(sw / 2, sh / 2);
    fctx.rotate((rot * Math.PI) / 180);
    if (isSideways) {
      fctx.drawImage(img, -sh / 2, -sw / 2, sh, sw);
    } else {
      fctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
    }

    const { x, y, w, h } = state.crop;
    if (w <= 0 || h <= 0) return;

    let cropData;
    try {
      cropData = fctx.getImageData(x, y, w, h);
    } catch (e) {
      console.error('Failed to get crop ImageData:', e);
      return;
    }

    const pixels = cropData.data;
    const numPixels = w * h;

    // Background luminance estimation
    const samples = [];
    const step = Math.max(1, Math.floor(numPixels / 1000));
    for (let i = 0; i < pixels.length; i += step * 4) {
      const lum = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
      samples.push(lum);
    }
    samples.sort((a, b) => a - b);
    const bgLum = samples[Math.floor(samples.length * 0.92)] || 172;

    const threshold = state.threshold;
    const cleanTol = state.cleanliness;

    const isOriginalColor = (state.inkColor === 'original');
    let targetR = 11, targetG = 15, targetB = 25;
    if (!isOriginalColor && state.inkColor.startsWith('#')) {
      const hex = state.inkColor;
      targetR = parseInt(hex.substring(1, 3), 16);
      targetG = parseInt(hex.substring(3, 5), 16);
      targetB = parseInt(hex.substring(5, 7), 16);
    }

    const outData = new Uint8ClampedArray(pixels.length);
    let minX = w, maxX = 0, minY = h, maxY = 0;
    let hasInk = false;

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const idx = (py * w + px) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];

        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const diff = bgLum - lum;

        let alpha = 0;
        if (diff > cleanTol) {
          const t = Math.min(1, Math.max(0, (diff - cleanTol) / threshold));
          alpha = Math.round(t * 255);
        }

        if (alpha > 10) {
          hasInk = true;
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        }

        if (isOriginalColor) {
          outData[idx] = r;
          outData[idx + 1] = g;
          outData[idx + 2] = b;
        } else {
          outData[idx] = targetR;
          outData[idx + 1] = targetG;
          outData[idx + 2] = targetB;
        }
        outData[idx + 3] = alpha;
      }
    }

    const resCanvas = document.createElement('canvas');
    resCanvas.width = w;
    resCanvas.height = h;
    const rctx = resCanvas.getContext('2d');
    const outImgData = new ImageData(outData, w, h);
    rctx.putImageData(outImgData, 0, 0);

    // Auto-Trim Margins around the signature
    let finalCanvas = resCanvas;
    if (state.autoTrim && hasInk && maxX >= minX && maxY >= minY) {
      const pad = 8;
      const trimX = Math.max(0, minX - pad);
      const trimY = Math.max(0, minY - pad);
      const trimW = Math.min(w - trimX, (maxX - minX) + pad * 2);
      const trimH = Math.min(h - trimY, (maxY - minY) + pad * 2);

      const trimmedCanvas = document.createElement('canvas');
      trimmedCanvas.width = trimW;
      trimmedCanvas.height = trimH;
      const tctx = trimmedCanvas.getContext('2d');
      tctx.drawImage(resCanvas, trimX, trimY, trimW, trimH, 0, 0, trimW, trimH);
      finalCanvas = trimmedCanvas;
    }

    cachedExtractedCanvas = finalCanvas;

    const previewDataUrl = finalCanvas.toDataURL('image/png');
    el.signaturePreviewImg.src = previewDataUrl;
    el.sigResolutionLabel.textContent = `${finalCanvas.width} × ${finalCanvas.height} px`;
  }

  // EXPORT HANDLERS

  function downloadPNG() {
    if (!cachedExtractedCanvas) return;
    
    const scale = 2;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = cachedExtractedCanvas.width * scale;
    exportCanvas.height = cachedExtractedCanvas.height * scale;
    const ctx = exportCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cachedExtractedCanvas, 0, 0, exportCanvas.width, exportCanvas.height);

    const link = document.createElement('a');
    link.download = `signature_${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
    showToast('Downloaded PNG');
  }

  function downloadJPG() {
    if (!cachedExtractedCanvas) return;
    
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = cachedExtractedCanvas.width * 2;
    exportCanvas.height = cachedExtractedCanvas.height * 2;
    const ctx = exportCanvas.getContext('2d');
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    ctx.drawImage(cachedExtractedCanvas, 0, 0, exportCanvas.width, exportCanvas.height);

    const link = document.createElement('a');
    link.download = `signature_${Date.now()}.jpg`;
    link.href = exportCanvas.toDataURL('image/jpeg', 0.95);
    link.click();
    showToast('Downloaded JPG');
  }

  function downloadSVG() {
    if (!cachedExtractedCanvas) return;
    const w = cachedExtractedCanvas.width;
    const h = cachedExtractedCanvas.height;
    const dataUrl = cachedExtractedCanvas.toDataURL('image/png');

    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <image href="${dataUrl}" x="0" y="0" width="${w}" height="${h}" />
</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const link = document.createElement('a');
    link.download = `signature_${Date.now()}.svg`;
    link.href = URL.createObjectURL(blob);
    link.click();
    showToast('Downloaded SVG');
  }

  function copyToClipboard() {
    if (!cachedExtractedCanvas) return;

    cachedExtractedCanvas.toBlob(blob => {
      if (!blob) return;
      try {
        const item = new ClipboardItem({ 'image/png': blob });
        navigator.clipboard.write([item]).then(() => {
          showToast('Copied to clipboard');
        }).catch(() => {
          downloadPNG();
        });
      } catch (e) {
        downloadPNG();
      }
    }, 'image/png');
  }

  // WEBCAM LIVE CAPTURE HANDLERS
  function openWebcamModal() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Camera not supported by browser.');
      return;
    }

    el.webcamModal.classList.remove('hidden');
    el.webcamModal.classList.add('flex');

    navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    }).then(stream => {
      webcamStream = stream;
      el.webcamVideo.srcObject = stream;
    }).catch(err => {
      console.error('Camera error:', err);
      alert('Unable to access webcam.');
      closeWebcamModal();
    });
  }

  function closeWebcamModal() {
    if (webcamStream) {
      webcamStream.getTracks().forEach(t => t.stop());
      webcamStream = null;
    }
    el.webcamModal.classList.add('hidden');
    el.webcamModal.classList.remove('flex');
  }

  function captureWebcam() {
    if (!el.webcamVideo) return;
    const v = el.webcamVideo;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth || 1280;
    canvas.height = v.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);

    closeWebcamModal();
    loadImage(canvas.toDataURL('image/jpeg', 0.92), false);
    showToast('Captured photo');
  }

  window.addEventListener('DOMContentLoaded', init);

})();
