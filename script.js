const STORAGE_KEY = 'google_pfp_custom_fonts';

const defaultColors = [
    '#AA47BD', '#7B1FA2', '#77919D', '#455A65', '#EC417A', '#C1175C',
    '#5D6AC0', '#0388D2', '#00579B', '#0098A7', '#00897B', '#004D40',
    '#68A039', '#34691E', '#8C6E63', '#5D4138', '#7D57C1', '#512DA7',
    '#EF6C00', '#F6511E', '#BE360B', '#1a73e8', '#34a853', '#fbbc05'
];

const canvas = document.getElementById('pfpCanvas');
const ctx = canvas.getContext('2d');

let state = {
    text: '?',
    font: 'Yantramanav',
    fontWeight: 400,
    textSize: 280,
    textRotation: 0,
    textColor: '#ffffff',
    textOutlineColor: '#000000',
    textOutlineWidth: 0,
    caseMode: 'first', // 'first', 'lower'
    limitEnabled: true,
    unicodeFallback: true,
    allowSymbols: false,
    bgPattern: 'solid', // 'solid', 'split-v', 'split-h', 'diagonal', 'quadrant', 'segments-5', 'segments-6', 'segments-7', 'segments-8'
    isGradient: false,
    diagonalAngle: 45,
    colors: Array(8).fill('#77919D'),
    activeSlotIndex: 0,
    bgImage: null,
    darkMode: true,
    hasTinkered: false
};

async function init() {
    buildPalette();
    setupEventListeners();
    applyTheme();
    await loadStoredFonts();
    render();
}

function setupEventListeners() {
    const listen = (id, event, fn) => document.getElementById(id)?.addEventListener(event, fn);

    listen('initialInput', 'input', (e) => {
        state.text = formatText(e.target.value) || '?';
        if (e.target.value.trim().length > 0) state.hasTinkered = true;
        render();
    });

    listen('fontFamily', 'change', (e) => { state.font = e.target.value; render(); });
    listen('fontWeight', 'change', (e) => { state.fontWeight = e.target.value; render(); });
    listen('textSize', 'input', (e) => { state.textSize = parseInt(e.target.value); render(); });
    listen('textRotation', 'input', (e) => { state.textRotation = parseInt(e.target.value); render(); });
    listen('textColor', 'input', (e) => { state.textColor = e.target.value; render(); });
    listen('textOutlineColor', 'input', (e) => { state.textOutlineColor = e.target.value; render(); });
    listen('textOutlineWidth', 'input', (e) => { state.textOutlineWidth = parseInt(e.target.value); render(); });

    listen('caseToggle', 'click', () => {
        state.caseMode = state.caseMode === 'first' ? 'lower' : 'first';
        document.getElementById('caseToggle').classList.toggle('active', state.caseMode === 'lower');
        state.text = formatText(document.getElementById('initialInput').value) || '?';
        render();
    });

    listen('limitToggle', 'click', () => {
        state.limitEnabled = !state.limitEnabled;
        document.getElementById('limitToggle').classList.toggle('active', state.limitEnabled);
        state.text = formatText(document.getElementById('initialInput').value) || '?';
        render();
    });

    listen('unicodeToggle', 'click', () => {
        state.unicodeFallback = !state.unicodeFallback;
        document.getElementById('unicodeToggle').classList.toggle('active', state.unicodeFallback);
        render();
    });

    listen('symbolsToggle', 'click', () => {
        state.allowSymbols = !state.allowSymbols;
        document.getElementById('symbolsToggle').classList.toggle('active', state.allowSymbols);
        state.text = formatText(document.getElementById('initialInput').value) || '?';
        render();
    });

    listen('toggleFontImport', 'click', () => {
        const panel = document.getElementById('fontImportPanel');
        panel.classList.toggle('hidden');
    });

    document.querySelectorAll('.import-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.import-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.import-content').forEach(c => c.classList.add('hidden'));
            btn.classList.add('active');
            const type = btn.getAttribute('data-import-type');
            document.getElementById(type + 'Import').classList.remove('hidden');
        });
    });

    listen('loadGoogleFont', 'click', async () => {
        const fontName = document.getElementById('googleFontInput').value.trim();
        if (!fontName) return;
        
        const success = await loadGoogleFont(fontName);
        if (success) {
            saveFontToStorage({ type: 'google', name: fontName });
            addFontToSelect(fontName);
        } else {
            alert("Could not load this font from Google Fonts. Please check the name.");
        }
    });

    listen('fontFileUpload', 'change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const fontName = file.name.split('.')[0];
            const dataUrl = event.target.result;
            
            const success = await loadDiskFont(fontName, dataUrl);
            if (success) {
                saveFontToStorage({ type: 'disk', name: fontName, data: dataUrl });
                addFontToSelect(fontName);
            } else {
                alert("Invalid font file.");
            }
        };
        reader.readAsDataURL(file);
    });

    listen('patternToggle', 'click', () => {
        const patterns = ['solid', 'split-v', 'split-h', 'diagonal', 'quadrant', 'segments-5', 'segments-6', 'segments-7', 'segments-8'];
        state.bgPattern = patterns[(patterns.indexOf(state.bgPattern) + 1) % patterns.length];
        state.hasTinkered = true;
        updatePatternUI();
        render();
    });

    listen('gradientToggle', 'click', () => {
        state.isGradient = !state.isGradient;
        state.hasTinkered = true;
        document.getElementById('gradientToggle').classList.toggle('active', state.isGradient);
        render();
    });

    listen('diagonalAngle', 'input', (e) => { state.diagonalAngle = parseInt(e.target.value); render(); });

    listen('customColorInput', 'input', (e) => {
        updateActiveColor(e.target.value);
    });

    listen('bgImageUpload', 'change', (e) => {
        const file = e.target.files[0];
        if (file) {
            state.hasTinkered = true;
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    state.bgImage = img;
                    document.getElementById('clearBgImage').classList.remove('hidden');
                    render();
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    listen('clearBgImage', 'click', () => {
        state.bgImage = null;
        document.getElementById('bgImageUpload').value = '';
        document.getElementById('clearBgImage').classList.add('hidden');
        render();
    });

    listen('themeToggle', 'click', () => {
        state.darkMode = !state.darkMode;
        applyTheme();
    });

    listen('changelogBtn', 'click', () => {
        document.getElementById('changelogModal').classList.remove('hidden');
    });

    listen('closeModal', 'click', (e) => {
        e.stopPropagation();
        document.getElementById('changelogModal').classList.add('hidden');
    });

    window.addEventListener('click', (e) => {
        const modal = document.getElementById('changelogModal');
        if (e.target === modal) modal.classList.add('hidden');
    });

    listen('downloadBtn', 'click', download);
    listen('mobileDownload', 'click', download);
    
    const handleCommentPost = async () => {
        try {
            await uploadCanvasAndPostComment();
            alert('Posted image to comments.');
        } catch (err) {
            console.error(err);
            alert('Failed to post image to comments.');
        }
    };

    listen('commentImageBtn', 'click', handleCommentPost);
    listen('mobileCommentBtn', 'click', handleCommentPost);

    // Mobile Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tool-section').forEach(s => s.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

async function loadStoredFonts() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return;
        const fonts = JSON.parse(stored);
        for (const font of fonts) {
            if (font.type === 'google') {
                await loadGoogleFont(font.name);
            } else if (font.type === 'disk') {
                await loadDiskFont(font.name, font.data);
            }
            addFontToSelect(font.name);
        }
    } catch (e) {
        console.error("Failed to load stored fonts", e);
    }
}

async function loadGoogleFont(name) {
    const family = name.replace(/\s+/g, '+');
    // Request multiple weights for Google Fonts as requested
    const url = `https://fonts.googleapis.com/css2?family=${family}:wght@400;500;600;700&display=swap`;
    
    return new Promise((resolve) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.onload = () => resolve(true);
        link.onerror = () => resolve(false);
        document.head.appendChild(link);
    });
}

async function loadDiskFont(name, dataUrl) {
    try {
        const font = new FontFace(name, `url(${dataUrl})`);
        const loadedFont = await font.load();
        document.fonts.add(loadedFont);
        return true;
    } catch (e) {
        console.error("Font loading error:", e);
        return false;
    }
}

function saveFontToStorage(fontObj) {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const fonts = stored ? JSON.parse(stored) : [];
        if (!fonts.find(f => f.name === fontObj.name)) {
            fonts.push(fontObj);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(fonts));
        }
    } catch (e) {
        console.error("Failed to save font", e);
    }
}

function addFontToSelect(name) {
    const select = document.getElementById('fontFamily');
    for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value === name) return;
    }
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
}

function buildPalette() {
    const palette = document.getElementById('colorPalette');
    const custom = document.querySelector('.custom-color-container');
    
    defaultColors.forEach((hex, idx) => {
        const btn = document.createElement('button');
        btn.className = 'palette-color';
        btn.style.backgroundColor = hex;
        btn.addEventListener('click', () => {
            state.hasTinkered = true;
            if (state.activeSlotIndex === 0 && state.bgPattern !== 'solid') {
                // Feature: Dynamic multi-color logic
                state.colors[0] = hex;
                state.colors[1] = defaultColors[(idx + 1) % defaultColors.length];
                for (let i = 2; i < 8; i++) {
                    state.colors[i] = darken(hex, i * 15);
                }
                updateSlotUI();
            } else {
                updateActiveColor(hex);
            }
            render();
        });
        palette.insertBefore(btn, custom);
    });
}

function updateActiveColor(hex) {
    state.hasTinkered = true;
    state.colors[state.activeSlotIndex] = hex;
    updateSlotUI();
    render();
}

function updateSlotUI() {
    const container = document.getElementById('slotSelector');
    container.innerHTML = '';
    
    let count = 1;
    if (state.bgPattern === 'quadrant') count = 4;
    else if (state.bgPattern.startsWith('segments-')) count = parseInt(state.bgPattern.split('-')[1]);
    else if (state.bgPattern !== 'solid') count = 2;

    for (let i = 0; i < count; i++) {
        const dot = document.createElement('div');
        dot.className = 'slot-dot' + (i === state.activeSlotIndex ? ' active' : '');
        dot.style.backgroundColor = state.colors[i];
        dot.addEventListener('click', () => {
            state.activeSlotIndex = i;
            updateSlotUI();
        });
        container.appendChild(dot);
    }
}

function updatePatternUI() {
    const slotSelector = document.getElementById('slotSelector');
    const angleControl = document.getElementById('angleControl');
    const icon = document.getElementById('patternIcon');

    slotSelector.classList.toggle('hidden', state.bgPattern === 'solid');
    angleControl.classList.toggle('hidden', state.bgPattern !== 'diagonal');
    
    // Icon update
    if (state.bgPattern === 'solid') icon.innerHTML = '<rect x="3" y="3" width="18" height="18" rx="2"></rect>';
    else if (state.bgPattern === 'split-v') icon.innerHTML = '<rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="12" y1="3" x2="12" y2="21"></line>';
    else if (state.bgPattern === 'split-h') icon.innerHTML = '<rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="12" x2="21" y2="12"></line>';
    else if (state.bgPattern === 'diagonal') icon.innerHTML = '<rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="3" x2="21" y2="21"></line>';
    else if (state.bgPattern === 'quadrant') icon.innerHTML = '<rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="12" y1="3" x2="12" y2="21"></line><line x1="3" y1="12" x2="21" y2="12"></line>';
    else if (state.bgPattern.startsWith('segments-')) {
        const n = parseInt(state.bgPattern.split('-')[1]);
        let p = '<circle cx="12" cy="12" r="9"></circle>';
        for (let i = 0; i < n; i++) {
            const a = (i * 2 * Math.PI / n) - Math.PI / 2;
            p += `<line x1="12" y1="12" x2="${12 + 9 * Math.cos(a)}" y2="${12 + 9 * Math.sin(a)}"></line>`;
        }
        icon.innerHTML = p;
    }
    
    updateSlotUI();
}

function formatText(raw) {
    let clean = state.allowSymbols ? raw : raw.replace(/[^\p{L}\p{N}\s]/gu, '');
    if (state.limitEnabled) clean = [...clean].slice(0, 2).join('');
    if (!clean) return '';
    if (state.caseMode === 'lower') return clean.toLowerCase();
    const chars = [...clean];
    const first = chars.shift();
    return first.toUpperCase() + chars.join('').toLowerCase();
}

function darken(hex, amount) {
    let usePound = false;
    if (hex[0] == "#") { hex = hex.slice(1); usePound = true; }
    let num = parseInt(hex, 16);
    let r = (num >> 16) - amount;
    let b = ((num >> 8) & 0x00FF) - amount;
    let g = (num & 0x0000FF) - amount;
    if (r > 255) r = 255; else if (r < 0) r = 0;
    if (b > 255) b = 255; else if (b < 0) b = 0;
    if (g > 255) g = 255; else if (g < 0) g = 0;
    return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
}

function render() {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    
    // Background Clipping
    ctx.save();
    ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.clip();
    
    // Draw Background
    if (state.bgImage) {
        ctx.drawImage(state.bgImage, 0, 0, w, h);
    } else {
        if (state.bgPattern === 'solid') {
            ctx.fillStyle = state.colors[0]; ctx.fillRect(0,0,w,h);
        } else if (state.isGradient) {
            // Gradient Logic
            if (state.bgPattern === 'split-v') {
                const grad = ctx.createLinearGradient(0, 0, w, 0);
                grad.addColorStop(0, state.colors[0]); grad.addColorStop(1, state.colors[1]);
                ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
            } else if (state.bgPattern === 'split-h') {
                const grad = ctx.createLinearGradient(0, 0, 0, h);
                grad.addColorStop(0, state.colors[0]); grad.addColorStop(1, state.colors[1]);
                ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
            } else if (state.bgPattern === 'diagonal') {
                const rad = (state.diagonalAngle) * Math.PI / 180;
                const x1 = w/2 - (w/2) * Math.cos(rad);
                const y1 = h/2 - (h/2) * Math.sin(rad);
                const x2 = w/2 + (w/2) * Math.cos(rad);
                const y2 = h/2 + (h/2) * Math.sin(rad);
                const grad = ctx.createLinearGradient(x1, y1, x2, y2);
                grad.addColorStop(0, state.colors[0]); grad.addColorStop(1, state.colors[1]);
                ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
            } else if (state.bgPattern === 'quadrant' || state.bgPattern.startsWith('segments-')) {
                const n = state.bgPattern === 'quadrant' ? 4 : parseInt(state.bgPattern.split('-')[1]);
                const grad = ctx.createConicGradient(-Math.PI/2, w/2, h/2);
                for (let i = 0; i <= n; i++) {
                    grad.addColorStop(i / n, state.colors[i % n]);
                }
                ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
            }
        } else {
            // Hard Edges Logic (Original)
            if (state.bgPattern === 'split-v') {
                ctx.fillStyle = state.colors[0]; ctx.fillRect(0,0,w/2,h);
                ctx.fillStyle = state.colors[1]; ctx.fillRect(w/2,0,w/2,h);
            } else if (state.bgPattern === 'split-h') {
                ctx.fillStyle = state.colors[0]; ctx.fillRect(0,0,w,h/2);
                ctx.fillStyle = state.colors[1]; ctx.fillRect(0,h/2,w,h/2);
            } else if (state.bgPattern === 'diagonal') {
                ctx.fillStyle = state.colors[1]; ctx.fillRect(0,0,w,h);
                ctx.save();
                ctx.translate(w/2, h/2); ctx.rotate((state.diagonalAngle - 45) * Math.PI / 180);
                ctx.fillStyle = state.colors[0]; ctx.fillRect(-w, 0, w*2, h);
                ctx.restore();
            } else if (state.bgPattern === 'quadrant') {
                ctx.fillStyle = state.colors[0]; ctx.fillRect(0,0,w/2,h/2);
                ctx.fillStyle = state.colors[1]; ctx.fillRect(w/2,0,w/2,h/2);
                ctx.fillStyle = state.colors[2]; ctx.fillRect(0,h/2,w/2,h/2);
                ctx.fillStyle = state.colors[3]; ctx.fillRect(w/2,h/2,w/2,h/2);
            } else if (state.bgPattern.startsWith('segments-')) {
                const n = parseInt(state.bgPattern.split('-')[1]);
                const step = (Math.PI*2)/n;
                const offset = -Math.PI/2;
                for (let i=0; i<n; i++) {
                    ctx.fillStyle = state.colors[i];
                    ctx.beginPath(); ctx.moveTo(w/2, h/2);
                    ctx.arc(w/2, h/2, w+10, offset+i*step, offset+(i+1)*step);
                    ctx.fill();
                }
            }
        }
    }
    ctx.restore();

    // Draw Text
    ctx.save();
    ctx.translate(w/2, h/2);
    ctx.rotate(state.textRotation * Math.PI / 180);
    
    let display = state.text;
    if (state.unicodeFallback) {
        display = [...state.text].map(char => {
            const cp = char.codePointAt(0);
            const ok = (cp >= 0x0000 && cp <= 0x024F) || (cp >= 0x0900 && cp <= 0x097F) || (cp >= 0x2000 && cp <= 0x20CF);
            return ok ? char : '\u25AF';
        }).join('');
    }

    ctx.font = `${state.fontWeight} ${state.textSize}px ${state.font}, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    const metrics = ctx.measureText(display);
    // Calculate the precise vertical offset to center the text visually based on its actual glyph bounds
    // This handles different fonts and characters (like those with descenders) much better than 'middle' baseline.
    const visualCenterOffsetY = (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
    
    if (state.textOutlineWidth > 0) {
        ctx.strokeStyle = state.textOutlineColor;
        ctx.lineWidth = state.textOutlineWidth;
        ctx.strokeText(display, 0, visualCenterOffsetY);
    }
    
    ctx.fillStyle = state.textColor;
    ctx.fillText(display, 0, visualCenterOffsetY);
    ctx.restore();

    const isTinkered = state.hasTinkered || state.text !== '?' || state.bgPattern !== 'solid' || state.bgImage !== null;
    document.getElementById('defaultHint').style.opacity = isTinkered ? '0' : '1';
}

function applyTheme() {
    document.body.classList.toggle('dark-mode', state.darkMode);
    document.body.classList.toggle('light-mode', !state.darkMode);
    document.querySelector('.sun-icon').style.display = state.darkMode ? 'none' : 'block';
    document.querySelector('.moon-icon').style.display = state.darkMode ? 'block' : 'none';
}

function download() {
    const link = document.createElement('a');
    link.download = `pfp_${state.text.substring(0,5)}_${state.bgPattern}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

/**
 * Convert the canvas to a Blob, upload via websim.upload, then post as a comment.
 * Uses window.websim.upload() to get a hosted image URL and window.websim.postComment() to create the comment.
 */
async function uploadCanvasAndPostComment() {
    if (!window.websim || typeof window.websim.upload !== 'function' || typeof window.websim.postComment !== 'function') {
        throw new Error('websim API not available.');
    }

    // Get blob from canvas
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Failed to get canvas blob.');

    // Upload via websim.upload - this returns a URL string
    const url = await window.websim.upload(blob);

    // Build a short caption using current text and pattern
    const caption = `PFP: ${state.text} — ${state.bgPattern}`;

    // Post the comment with the uploaded image (websim.postComment opens editor flow)
    const result = await window.websim.postComment({
        content: caption,
        images: [url]
    });

    // postComment returns {} on success, or { error } on fail — check and throw if needed
    if (result && result.error) throw new Error(result.error);
    return result;
}

init();