/**
 * MVT Vector Tile Server & Viewer Client
 * Powered by MapLibre GL JS + Protomaps PMTiles
 * Kompatibel dengan GitHub Pages, Cloudflare R2, dan File Lokal
 */

// ==========================================
// 1. Inisialisasi Protokol PMTiles
// ==========================================
const protocol = new pmtiles.Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

// ==========================================
// 2. Definisi Peta Dasar (Basemaps) - 100% Gratis & Bebas API Key
// ==========================================
const BASEMAP_STYLES = {
  osm: {
    version: 8,
    sources: {
      'osm-standard': {
        type: 'raster',
        tiles: [
          'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
        ],
        tileSize: 256,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }
    },
    layers: [
      {
        id: 'osm-layer',
        type: 'raster',
        source: 'osm-standard',
        minzoom: 0,
        maxzoom: 19
      }
    ]
  },
  streets: {
    version: 8,
    sources: {
      'esri-streets': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
        ],
        tileSize: 256,
        attribution: 'Tiles &copy; Esri, DeLorme, NAVTEQ'
      }
    },
    layers: [
      {
        id: 'esri-streets-layer',
        type: 'raster',
        source: 'esri-streets',
        minzoom: 0,
        maxzoom: 19
      }
    ]
  },
  light: {
    version: 8,
    sources: {
      'esri-gray': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
        ],
        tileSize: 256,
        attribution: 'Tiles &copy; Esri, HERE, Garmin'
      }
    },
    layers: [
      {
        id: 'esri-gray-layer',
        type: 'raster',
        source: 'esri-gray',
        minzoom: 0,
        maxzoom: 16
      }
    ]
  },
  satellite: {
    version: 8,
    sources: {
      'esri-satellite': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        ],
        tileSize: 256,
        attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics'
      }
    },
    layers: [
      {
        id: 'esri-satellite-layer',
        type: 'raster',
        source: 'esri-satellite',
        minzoom: 0,
        maxzoom: 19
      }
    ]
  }
};

// ==========================================
// 3. Konfigurasi State & Variabel Global
// ==========================================
// File lokal bawaan di repository GitHub Pages ini
const DEFAULT_LOCAL_PMTILES = './sample-data/rute_bandung.pmtiles';
const SAMPLE_PROTOMAPS_URL = 'https://r2-public.protomaps.com/protomaps_sample_nz.pmtiles';

let currentStyle = 'osm';
let currentPmtilesInstance = null;
let currentMetadata = null;
let currentLayers = [];
let map = null;

// DOM Elements
const pmtilesUrlInput = document.getElementById('pmtilesUrl');
const btnLoadUrl = document.getElementById('btnLoadUrl');
const presetBandung = document.getElementById('presetBandung');
const presetSample = document.getElementById('presetSample');
const btnBrowseFile = document.getElementById('btnBrowseFile');
const pmtilesFileInput = document.getElementById('pmtilesFileInput');

const loadBadge = document.getElementById('loadBadge');
const metaZoom = document.getElementById('metaZoom');
const metaBounds = document.getElementById('metaBounds');
const metaType = document.getElementById('metaType');
const metaLayers = document.getElementById('metaLayers');
const btnFitBounds = document.getElementById('btnFitBounds');
const controlPanel = document.getElementById('controlPanel');
const togglePanelBtn = document.getElementById('togglePanelBtn');
const floatingOpenBtn = document.getElementById('floatingOpenBtn');
const featureDrawer = document.getElementById('featureDrawer');
const closeDrawerBtn = document.getElementById('closeDrawerBtn');
const drawerBody = document.getElementById('drawerBody');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');

// Styling Controls
const colorPicker = document.getElementById('colorPicker');
const opacitySlider = document.getElementById('opacitySlider');
const opacityVal = document.getElementById('opacityVal');
const lineWidthSlider = document.getElementById('lineWidthSlider');
const lineWidthVal = document.getElementById('lineWidthVal');

// Helper: Menghitung URL Absolut yang valid untuk protokol PMTiles
function resolveAbsoluteUrl(rawUrl) {
  try {
    return new URL(rawUrl, window.location.href).href;
  } catch (e) {
    return rawUrl;
  }
}

// ==========================================
// 4. Inisialisasi Peta
// ==========================================
function initMap() {
  map = new maplibregl.Map({
    container: 'map',
    style: BASEMAP_STYLES[currentStyle],
    center: [107.575, -6.885], // Bandung, Indonesia (Default koordinat rute ULBI)
    zoom: 12,
    pitch: 0,
    bearing: 0
  });

  // Tambahkan Kontrol Navigasi (Zoom, Rotasi) & Skala
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
  map.addControl(new maplibregl.FullscreenControl(), 'top-right');

  map.on('load', () => {
    // 1. Cek apakah ada query param ?url= di address bar
    const urlParams = new URLSearchParams(window.location.search);
    const queryUrl = urlParams.get('url');

    // 2. Jika dibuka lewat file:/// (double click di file explorer)
    if (window.location.protocol === 'file:') {
      console.warn('Halaman dibuka via protokol file://. HTTP fetch diblokir oleh kebijakan keamanan browser.');
      pmtilesUrlInput.value = DEFAULT_LOCAL_PMTILES;
      showLocalFileBanner();
      return;
    }

    if (queryUrl) {
      pmtilesUrlInput.value = queryUrl;
      loadPMTilesFromUrl(queryUrl);
    } else {
      // Default: Muat data rute_bandung.pmtiles dari repo
      pmtilesUrlInput.value = DEFAULT_LOCAL_PMTILES;
      loadPMTilesFromUrl(DEFAULT_LOCAL_PMTILES);
    }
  });

  // Handler Klik Fitur MVT untuk Inspect Data
  setupFeatureInspection();
}

function showLocalFileBanner() {
  updateStatusBadge('idle', 'Mode Offline');
  alert(
    'PERHATIAN (Membuka via file://):\n\n' +
    'Browser memblokir permintaan file lokal lewat URL jika dibuka langsung (file:///C:/...).\n\n' +
    'Solusi sangat mudah (pilih salah satu):\n' +
    '1. Klik tombol "Pilih File .pmtiles dari Laptop" lalu pilih file rute_bandung.pmtiles Anda.\n' +
    '2. Atau jalankan server lokal: ketik "python -m http.server 8000" di terminal lalu buka http://localhost:8000\n' +
    '3. Atau buka web ini yang sudah terpasang di GitHub Pages.'
  );
}

// ==========================================
// 5. Muat Data PMTiles dari URL (GitHub Pages / R2)
// ==========================================
async function loadPMTilesFromUrl(rawUrl) {
  if (!rawUrl || rawUrl.trim() === '') {
    alert('Silakan masukkan URL file PMTiles Anda!');
    return;
  }

  // Cek jika berjalan di file:///
  if (window.location.protocol === 'file:') {
    showLocalFileBanner();
    return;
  }

  const fullUrl = resolveAbsoluteUrl(rawUrl.trim());
  let displayHost = 'Server';
  try {
    displayHost = new URL(fullUrl).hostname || 'Lokal';
  } catch (e) {
    displayHost = 'Lokal';
  }

  showLoading(`Membaca header PMTiles dari ${displayHost}...`);
  updateStatusBadge('loading', 'Loading');

  try {
    // 1. Buat instance PMTiles client dengan URL absolut
    const pmtilesInstance = new pmtiles.PMTiles(fullUrl);
    protocol.add(pmtilesInstance);
    currentPmtilesInstance = pmtilesInstance;

    // 2. Baca Header arsip (menggunakan HTTP Range Request)
    const header = await pmtilesInstance.getHeader();
    const metadata = await pmtilesInstance.getMetadata();
    currentMetadata = { header, metadata };

    console.log('PMTiles Header:', header);
    console.log('PMTiles Metadata:', metadata);

    // 3. Tampilkan informasi metadata di UI
    displayMetadata(header, metadata);

    // 4. Update atau Pasang Layer ke MapLibre
    let vectorLayerNames = extractLayerNames(metadata);
    renderMvtLayers(fullUrl, header, vectorLayerNames);

    // 5. Auto zoom ke batas data (bounds)
    fitToBounds(header);

    // 6. Update URL query param & status
    try {
      const currentUrl = new URL(window.location);
      currentUrl.searchParams.set('url', rawUrl);
      window.history.replaceState({}, '', currentUrl);
    } catch (e) {}

    updateStatusBadge('success', 'Terkoneksi');
    hideLoading();
  } catch (err) {
    console.error('Gagal memuat PMTiles:', err);
    updateStatusBadge('error', 'Error');
    hideLoading();

    let errorMsg = `Gagal memuat PMTiles: ${err.message}.\n\n`;
    if (err.message && err.message.toLowerCase().includes('cors')) {
      errorMsg += 'PENYEBAB: Terhalang CORS!\nJika menggunakan Cloudflare R2, pastikan aturan CORS sudah terpasang sesuai cors-r2.json.';
    } else if (err.message && (err.message.includes('404') || err.message.includes('Not Found'))) {
      errorMsg += 'PENYEBAB: File tidak ditemukan (404)!\nPastikan file rute_bandung.pmtiles sudah ter-upload di folder sample-data/ pada GitHub Pages.';
    } else {
      errorMsg += 'Tips:\n1. Pastikan URL benar.\n2. Jika di lokal, gunakan tombol "Pilih File .pmtiles dari Laptop" atau jalankan server lokal: python -m http.server 8000';
    }
    alert(errorMsg);
  }
}

// ==========================================
// 5B. Muat Data PMTiles Langsung dari File Lokal (File API)
// ==========================================
async function loadPMTilesFromFile(file) {
  if (!file) return;

  showLoading(`Membaca file lokal: ${file.name}...`);
  updateStatusBadge('loading', 'Loading File');

  try {
    // 1. Gunakan FileSource dari library PMTiles (tanpa perlu web server!)
    const fileSource = new pmtiles.FileSource(file);
    const pmtilesInstance = new pmtiles.PMTiles(fileSource);
    
    // Daftarkan ke protokol dengan key unik nama file
    const uniqueSourceKey = `file://${file.name}_${Date.now()}`;
    protocol.add(pmtilesInstance);
    currentPmtilesInstance = pmtilesInstance;

    // 2. Baca Header arsip langsung dari disk
    const header = await pmtilesInstance.getHeader();
    const metadata = await pmtilesInstance.getMetadata();
    currentMetadata = { header, metadata };

    console.log('File Header:', header);
    console.log('File Metadata:', metadata);

    // 3. Update UI
    pmtilesUrlInput.value = `[File Lokal: ${file.name}]`;
    displayMetadata(header, metadata);

    // 4. Render ke peta
    let vectorLayerNames = extractLayerNames(metadata);
    renderMvtLayers(uniqueSourceKey, header, vectorLayerNames);

    // 5. Zoom ke batas data
    fitToBounds(header);

    updateStatusBadge('success', 'File Aktif');
    hideLoading();
  } catch (err) {
    console.error('Gagal membaca file PMTiles lokal:', err);
    updateStatusBadge('error', 'Gagal');
    hideLoading();
    alert(`Gagal membaca file ${file.name}: ${err.message}`);
  }
}

function extractLayerNames(metadata) {
  let names = [];
  if (metadata && metadata.vector_layers) {
    names = metadata.vector_layers.map(l => l.id);
  } else if (metadata && metadata.layers) {
    names = metadata.layers.map(l => l.id || l.name);
  }
  return names;
}

function displayMetadata(header, metadata) {
  metaZoom.textContent = `z${header.minZoom} - z${header.maxZoom}`;
  metaBounds.textContent = `[${header.minLon.toFixed(3)}, ${header.minLat.toFixed(3)}] ke [${header.maxLon.toFixed(3)}, ${header.maxLat.toFixed(3)}]`;
  metaType.textContent = header.tileType === 1 ? 'MVT (Vector)' : (header.tileType === 2 ? 'PNG' : 'Raster');

  const vectorLayerNames = extractLayerNames(metadata);
  metaLayers.textContent = vectorLayerNames.length > 0 
    ? vectorLayerNames.slice(0, 3).join(', ') + (vectorLayerNames.length > 3 ? ` (+${vectorLayerNames.length - 3})` : '')
    : 'Default / Single';

  btnFitBounds.disabled = false;
}

// ==========================================
// 6. Rendering Layer MVT di Peta
// ==========================================
function renderMvtLayers(sourceKey, header, vectorLayerNames) {
  const sourceId = 'r2-pmtiles-source';

  // Hapus layer lama jika sudah ada
  removeExistingMvtLayers();

  // Tambahkan vector source PMTiles ke MapLibre
  // Format protokol: pmtiles://<sourceKey>
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: 'vector',
      url: `pmtiles://${sourceKey}`,
      minzoom: header.minZoom,
      maxzoom: header.maxZoom
    });
  }

  const primaryColor = colorPicker.value;
  const opacity = parseFloat(opacitySlider.value);
  const lineWidth = parseFloat(lineWidthSlider.value);

  const layersToCreate = vectorLayerNames.length > 0 ? vectorLayerNames : ['default'];

  currentLayers = [];

  layersToCreate.forEach((sourceLayerName) => {
    // 1. Polygon Fill Layer (Area / Zona)
    const fillLayerId = `pmtiles-fill-${sourceLayerName}`;
    map.addLayer({
      id: fillLayerId,
      type: 'fill',
      source: sourceId,
      ...(sourceLayerName !== 'default' ? { 'source-layer': sourceLayerName } : {}),
      filter: ['==', '$type', 'Polygon'],
      paint: {
        'fill-color': primaryColor,
        'fill-opacity': opacity
      }
    });
    currentLayers.push(fillLayerId);

    // 2. Line Layer (Rute Jalan / Garis Batas)
    const lineLayerId = `pmtiles-line-${sourceLayerName}`;
    map.addLayer({
      id: lineLayerId,
      type: 'line',
      source: sourceId,
      ...(sourceLayerName !== 'default' ? { 'source-layer': sourceLayerName } : {}),
      paint: {
        'line-color': '#0284c7', // Warna garis tegas
        'line-width': lineWidth,
        'line-opacity': 0.95
      }
    });
    currentLayers.push(lineLayerId);

    // 3. Point / Circle Layer (Titik Jemput / Driver / Stasiun)
    const circleLayerId = `pmtiles-circle-${sourceLayerName}`;
    map.addLayer({
      id: circleLayerId,
      type: 'circle',
      source: sourceId,
      ...(sourceLayerName !== 'default' ? { 'source-layer': sourceLayerName } : {}),
      filter: ['==', '$type', 'Point'],
      paint: {
        'circle-color': '#f43f5e', // Warna merah terang untuk POI / Titik
        'circle-radius': 6,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });
    currentLayers.push(circleLayerId);
  });
}

function removeExistingMvtLayers() {
  currentLayers.forEach(layerId => {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
  });
  currentLayers = [];

  const sourceId = 'r2-pmtiles-source';
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }
}

// ==========================================
// 7. Auto-Fit Bounds
// ==========================================
function fitToBounds(header) {
  if (!header) return;
  const { minLon, minLat, maxLon, maxLat } = header;
  if (minLon !== undefined && minLat !== undefined && maxLon !== undefined && maxLat !== undefined) {
    if (minLon === -180 && maxLon === 180 && minLat <= -85 && maxLat >= 85) {
      if (header.centerLon && header.centerLat) {
        map.flyTo({ center: [header.centerLon, header.centerLat], zoom: header.centerZoom || 12 });
      }
      return;
    }

    map.fitBounds(
      [
        [minLon, minLat],
        [maxLon, maxLat]
      ],
      { padding: 80, duration: 1500 }
    );
  }
}

// ==========================================
// 8. Inspeksi Fitur (Click to Inspect)
// ==========================================
function setupFeatureInspection() {
  const popup = new maplibregl.Popup({
    closeButton: true,
    closeOnClick: false,
    maxWidth: '360px'
  });

  map.on('click', (e) => {
    if (currentLayers.length === 0) return;

    const features = map.queryRenderedFeatures(e.point, {
      layers: currentLayers.filter(l => map.getLayer(l))
    });

    if (!features || features.length === 0) {
      popup.remove();
      return;
    }

    const feature = features[0];
    const props = feature.properties || {};
    const layerName = feature.sourceLayer || feature.layer.id;

    let titleText = props.name || props.titik_jemput || props.titik_tujuan || `Fitur ${feature.geometry.type}`;

    let tableHtml = `<div style="max-height: 220px; overflow-y: auto;">
      <h4 style="color: #38bdf8; font-size: 0.9rem; margin-bottom: 4px;">${escapeHtml(titleText)}</h4>
      <div style="font-size: 0.72rem; color: #94a3b8; margin-bottom: 6px;">Layer: ${escapeHtml(layerName)} | Tipe: ${feature.geometry.type}</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 0.75rem;">`;

    const propKeys = Object.keys(props);
    if (propKeys.length === 0) {
      tableHtml += `<tr><td style="color: #94a3b8; font-style: italic;">Tidak ada atribut properti.</td></tr>`;
    } else {
      propKeys.forEach(key => {
        tableHtml += `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
            <td style="padding: 3px 6px; color: #94a3b8; font-weight: 500;">${escapeHtml(key)}</td>
            <td style="padding: 3px 6px; font-weight: 600;">${escapeHtml(String(props[key]))}</td>
          </tr>
        `;
      });
    }
    tableHtml += `</table></div>`;

    popup.setLngLat(e.lngLat).setHTML(tableHtml).addTo(map);
    showFeatureInDrawer(feature);
  });

  map.on('mousemove', (e) => {
    if (currentLayers.length === 0) return;
    const features = map.queryRenderedFeatures(e.point, {
      layers: currentLayers.filter(l => map.getLayer(l))
    });
    map.getCanvas().style.cursor = features.length > 0 ? 'pointer' : '';
  });
}

function showFeatureInDrawer(feature) {
  featureDrawer.classList.remove('hidden');
  const props = feature.properties || {};
  const keys = Object.keys(props);

  let html = `
    <div style="margin-bottom: 10px;">
      <span class="meta-label">Source Layer</span>
      <strong style="color: var(--primary-color);">${escapeHtml(feature.sourceLayer || 'Default')}</strong>
      <span style="margin-left: 8px; font-size: 0.72rem; color: var(--text-muted);">Tipe: ${feature.geometry.type}</span>
    </div>
    <table class="attr-table">
      <tbody>
  `;

  if (keys.length === 0) {
    html += `<tr><td colspan="2" class="empty-state">Fitur ini tidak memiliki properti atribut.</td></tr>`;
  } else {
    keys.forEach(k => {
      html += `
        <tr>
          <th>${escapeHtml(k)}</th>
          <td>${escapeHtml(String(props[k]))}</td>
        </tr>
      `;
    });
  }

  html += `</tbody></table>`;
  drawerBody.innerHTML = html;
}

// ==========================================
// 9. Event Listeners UI
// ==========================================
btnLoadUrl.addEventListener('click', () => {
  loadPMTilesFromUrl(pmtilesUrlInput.value);
});

pmtilesUrlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    loadPMTilesFromUrl(pmtilesUrlInput.value);
  }
});

btnFitBounds.addEventListener('click', () => {
  if (currentMetadata && currentMetadata.header) {
    fitToBounds(currentMetadata.header);
  }
});

// Pilihan Cepat: Rute Bandung Lokal
presetBandung.addEventListener('click', () => {
  pmtilesUrlInput.value = DEFAULT_LOCAL_PMTILES;
  loadPMTilesFromUrl(DEFAULT_LOCAL_PMTILES);
});

// Pilihan Cepat: Sample Protomaps Selandia Baru
presetSample.addEventListener('click', () => {
  pmtilesUrlInput.value = SAMPLE_PROTOMAPS_URL;
  loadPMTilesFromUrl(SAMPLE_PROTOMAPS_URL);
});

// Tombol Browse File Lokal Komputer
btnBrowseFile.addEventListener('click', () => {
  pmtilesFileInput.click();
});

pmtilesFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    loadPMTilesFromFile(file);
  }
});

// Ganti Basemap
document.querySelectorAll('.basemap-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const styleKey = btn.dataset.style;
    if (styleKey === currentStyle) return;

    document.querySelectorAll('.basemap-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentStyle = styleKey;

    const activeUrl = pmtilesUrlInput.value;
    const header = currentMetadata ? currentMetadata.header : null;
    let vectorLayerNames = extractLayerNames(currentMetadata ? currentMetadata.metadata : null);

    map.setStyle(BASEMAP_STYLES[styleKey]);

    map.once('style.load', () => {
      if (currentPmtilesInstance && header) {
        renderMvtLayers(currentPmtilesInstance.source.key || activeUrl, header, vectorLayerNames);
      }
    });
  });
});

// Live Styling Controls
colorPicker.addEventListener('input', (e) => {
  const color = e.target.value;
  currentLayers.forEach(id => {
    if (id.includes('fill') && map.getLayer(id)) map.setPaintProperty(id, 'fill-color', color);
  });
});

opacitySlider.addEventListener('input', (e) => {
  const opacity = parseFloat(e.target.value);
  opacityVal.textContent = opacity.toFixed(2);
  currentLayers.forEach(id => {
    if (id.includes('fill') && map.getLayer(id)) map.setPaintProperty(id, 'fill-opacity', opacity);
  });
});

lineWidthSlider.addEventListener('input', (e) => {
  const width = parseFloat(e.target.value);
  lineWidthVal.textContent = `${width}px`;
  currentLayers.forEach(id => {
    if (id.includes('line') && map.getLayer(id)) map.setPaintProperty(id, 'line-width', width);
  });
});

// Panel Toggle
togglePanelBtn.addEventListener('click', () => {
  controlPanel.classList.add('collapsed');
  floatingOpenBtn.classList.remove('hidden');
});

floatingOpenBtn.addEventListener('click', () => {
  controlPanel.classList.remove('collapsed');
  floatingOpenBtn.classList.add('hidden');
});

closeDrawerBtn.addEventListener('click', () => {
  featureDrawer.classList.add('hidden');
});

// Helper Functions
function showLoading(msg) {
  loadingText.textContent = msg;
  loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  loadingOverlay.classList.add('hidden');
}

function updateStatusBadge(type, label) {
  loadBadge.className = `status-badge status-${type}`;
  loadBadge.textContent = label;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Inisialisasi peta
initMap();
