/**
 * MVT Vector Tile Server & Viewer Client
 * Powered by MapLibre GL JS + Protomaps PMTiles
 * Designed for Cloudflare R2 & GitHub Pages
 */

// ==========================================
// 1. Inisialisasi Protokol PMTiles
// ==========================================
const protocol = new pmtiles.Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

// ==========================================
// 2. Definisi Peta Dasar (Basemaps)
// ==========================================
const BASEMAP_STYLES = {
  positron: {
    version: 8,
    sources: {
      'carto-positron': {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png'
        ],
        tileSize: 256,
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }
    },
    layers: [
      {
        id: 'carto-positron-layer',
        type: 'raster',
        source: 'carto-positron',
        minzoom: 0,
        maxzoom: 20
      }
    ]
  },
  dark: {
    version: 8,
    sources: {
      'carto-dark': {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'
        ],
        tileSize: 256,
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }
    },
    layers: [
      {
        id: 'carto-dark-layer',
        type: 'raster',
        source: 'carto-dark',
        minzoom: 0,
        maxzoom: 20
      }
    ]
  },
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
// Sample data publik PMTiles untuk demonstrasi langsung jika belum ada R2
const SAMPLE_PROTOMAPS_URL = 'https://r2-public.protomaps.com/protomaps_sample_nz.pmtiles';

let currentStyle = 'positron';
let currentPmtilesInstance = null;
let currentMetadata = null;
let currentLayers = [];
let map = null;

// DOM Elements
const pmtilesUrlInput = document.getElementById('pmtilesUrl');
const btnLoadUrl = document.getElementById('btnLoadUrl');
const presetSample = document.getElementById('presetSample');
const presetLocal = document.getElementById('presetLocal');
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

// ==========================================
// 4. Inisialisasi Peta
// ==========================================
function initMap() {
  map = new maplibregl.Map({
    container: 'map',
    style: BASEMAP_STYLES[currentStyle],
    center: [107.6098, -6.9175], // Bandung, Indonesia (Default)
    zoom: 10,
    pitch: 0,
    bearing: 0
  });

  // Tambahkan Kontrol Navigasi (Zoom, Rotasi) & Skala
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
  map.addControl(new maplibregl.FullscreenControl(), 'top-right');

  map.on('load', () => {
    // Cek apakah ada query param ?url= di address bar
    const urlParams = new URLSearchParams(window.location.search);
    const queryUrl = urlParams.get('url');

    if (queryUrl) {
      pmtilesUrlInput.value = queryUrl;
      loadPMTiles(queryUrl);
    } else {
      // Default: tawarkan sample atau biarkan input kosong
      pmtilesUrlInput.value = SAMPLE_PROTOMAPS_URL;
      loadPMTiles(SAMPLE_PROTOMAPS_URL);
    }
  });

  // Handler Klik Fitur MVT untuk Inspect Data
  setupFeatureInspection();
}

// ==========================================
// 5. Muat Data PMTiles dari R2 / URL
// ==========================================
async function loadPMTiles(rawUrl) {
  if (!rawUrl || rawUrl.trim() === '') {
    alert('Silakan masukkan URL file PMTiles Anda!');
    return;
  }

  const url = rawUrl.trim();
  showLoading(`Membaca header PMTiles dari ${new URL(url).hostname}...`);
  updateStatusBadge('loading', 'Loading');

  try {
    // 1. Buat instance PMTiles client
    const pmtilesInstance = new pmtiles.PMTiles(url);
    protocol.add(pmtilesInstance);
    currentPmtilesInstance = pmtilesInstance;

    // 2. Baca Header arsip (menggunakan HTTP Range Request ke R2)
    const header = await pmtilesInstance.getHeader();
    const metadata = await pmtilesInstance.getMetadata();
    currentMetadata = { header, metadata };

    console.log('PMTiles Header:', header);
    console.log('PMTiles Metadata:', metadata);

    // 3. Tampilkan informasi metadata di UI
    metaZoom.textContent = `z${header.minZoom} - z${header.maxZoom}`;
    metaBounds.textContent = `[${header.minLon.toFixed(3)}, ${header.minLat.toFixed(3)}] ke [${header.maxLon.toFixed(3)}, ${header.maxLat.toFixed(3)}]`;
    metaType.textContent = header.tileType === 1 ? 'MVT (Vector)' : (header.tileType === 2 ? 'PNG' : 'Raster');
    
    // Deteksi layers
    let vectorLayerNames = [];
    if (metadata && metadata.vector_layers) {
      vectorLayerNames = metadata.vector_layers.map(l => l.id);
    } else if (metadata && metadata.layers) {
      vectorLayerNames = metadata.layers.map(l => l.id || l.name);
    }

    metaLayers.textContent = vectorLayerNames.length > 0 
      ? vectorLayerNames.slice(0, 3).join(', ') + (vectorLayerNames.length > 3 ? ` (+${vectorLayerNames.length - 3})` : '')
      : 'Default / Single';

    btnFitBounds.disabled = false;

    // 4. Update atau Pasang Layer ke MapLibre
    renderMvtLayers(url, header, vectorLayerNames);

    // 5. Auto zoom ke batas data (bounds)
    fitToBounds(header);

    // 6. Update URL query param & status
    const currentUrl = new URL(window.location);
    currentUrl.searchParams.set('url', url);
    window.history.replaceState({}, '', currentUrl);

    updateStatusBadge('success', 'Terkoneksi');
    hideLoading();
  } catch (err) {
    console.error('Gagal memuat PMTiles:', err);
    updateStatusBadge('error', 'Error');
    hideLoading();

    let errorMsg = `Gagal memuat PMTiles: ${err.message}.\n\n`;
    if (err.message && err.message.toLowerCase().includes('cors')) {
      errorMsg += 'PENYEBAB: Terhalang CORS di Cloudflare R2!\nPastikan Anda telah memasang aturan CORS di Cloudflare R2 Bucket Settings sesuai petunjuk cors-r2.json.';
    } else {
      errorMsg += 'Tips:\n1. Pastikan URL publik R2 benar dan file bisa diakses.\n2. Pastikan file berformat .pmtiles valid.\n3. Periksa aturan CORS pada bucket Cloudflare R2 Anda.';
    }
    alert(errorMsg);
  }
}

// ==========================================
// 6. Rendering Layer MVT di Peta
// ==========================================
function renderMvtLayers(url, header, vectorLayerNames) {
  const sourceId = 'r2-pmtiles-source';

  // Hapus layer lama jika sudah ada
  removeExistingMvtLayers();

  // Tambahkan vector source PMTiles ke MapLibre
  // Format protokol: pmtiles://https://...
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: 'vector',
      url: `pmtiles://${url}`,
      minzoom: header.minZoom,
      maxzoom: header.maxZoom
    });
  }

  const primaryColor = colorPicker.value;
  const opacity = parseFloat(opacitySlider.value);
  const lineWidth = parseFloat(lineWidthSlider.value);

  // Jika arsip memiliki metadata vector_layers, buat layer untuk masing-masing
  // Jika tidak, gunakan layer generik
  const layersToCreate = vectorLayerNames.length > 0 ? vectorLayerNames : ['default'];

  currentLayers = [];

  layersToCreate.forEach((sourceLayerName) => {
    // 1. Polygon Fill Layer
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

    // 2. Line / Polygon Border Layer
    const lineLayerId = `pmtiles-line-${sourceLayerName}`;
    map.addLayer({
      id: lineLayerId,
      type: 'line',
      source: sourceId,
      ...(sourceLayerName !== 'default' ? { 'source-layer': sourceLayerName } : {}),
      paint: {
        'line-color': primaryColor,
        'line-width': lineWidth,
        'line-opacity': 0.9
      }
    });
    currentLayers.push(lineLayerId);

    // 3. Point / Circle Layer
    const circleLayerId = `pmtiles-circle-${sourceLayerName}`;
    map.addLayer({
      id: circleLayerId,
      type: 'circle',
      source: sourceId,
      ...(sourceLayerName !== 'default' ? { 'source-layer': sourceLayerName } : {}),
      filter: ['==', '$type', 'Point'],
      paint: {
        'circle-color': primaryColor,
        'circle-radius': 5,
        'circle-stroke-width': 1.5,
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
    // Tangani kemungkinan koordinat default dunia [-180, -90, 180, 90]
    if (minLon === -180 && maxLon === 180 && minLat <= -85 && maxLat >= 85) {
      if (header.centerLon && header.centerLat) {
        map.flyTo({ center: [header.centerLon, header.centerLat], zoom: header.centerZoom || 8 });
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
    maxWidth: '340px'
  });

  map.on('click', (e) => {
    if (currentLayers.length === 0) return;

    // Ambil semua fitur yang ter-render di titik klik
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

    // Format tabel properti
    let tableHtml = `<div style="max-height: 200px; overflow-y: auto;">
      <strong style="color: #38bdf8; font-size: 0.85rem;">Layer: ${escapeHtml(layerName)}</strong>
      <table style="width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 0.75rem;">`;

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

    // Tampilkan popup di titik koordinat
    popup.setLngLat(e.lngLat).setHTML(tableHtml).addTo(map);

    // Tampilkan juga di Feature Drawer di sudut kanan bawah
    showFeatureInDrawer(feature);
  });

  // Ganti cursor pointer saat hover fitur
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
  loadPMTiles(pmtilesUrlInput.value);
});

pmtilesUrlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    loadPMTiles(pmtilesUrlInput.value);
  }
});

btnFitBounds.addEventListener('click', () => {
  if (currentMetadata && currentMetadata.header) {
    fitToBounds(currentMetadata.header);
  }
});

// Presets
presetSample.addEventListener('click', () => {
  pmtilesUrlInput.value = SAMPLE_PROTOMAPS_URL;
  loadPMTiles(SAMPLE_PROTOMAPS_URL);
});

presetLocal.addEventListener('click', () => {
  alert(
    'CARA MEMAKAI CLOUDFLARE R2 ANDA:\n\n' +
    '1. Upload file .pmtiles ke R2 Bucket Anda.\n' +
    '2. Aktifkan Public Bucket / Custom Domain di R2 Settings.\n' +
    '3. Pasang CORS Policy (lihat cors-r2.json).\n' +
    '4. Salin URL publik file Anda (misal: https://pub-xxxx.r2.dev/data.pmtiles).\n' +
    '5. Paste ke kotak input di atas lalu klik "Muat"!'
  );
});

// Ganti Basemap
document.querySelectorAll('.basemap-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const styleKey = btn.dataset.style;
    if (styleKey === currentStyle) return;

    document.querySelectorAll('.basemap-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentStyle = styleKey;

    // Simpan state layer PMTiles sebelum ganti style
    const activeUrl = pmtilesUrlInput.value;
    const header = currentMetadata ? currentMetadata.header : null;
    let vectorLayerNames = [];
    if (currentMetadata && currentMetadata.metadata && currentMetadata.metadata.vector_layers) {
      vectorLayerNames = currentMetadata.metadata.vector_layers.map(l => l.id);
    }

    map.setStyle(BASEMAP_STYLES[styleKey]);

    // Pasang ulang layer PMTiles setelah basemap baru selesai termuat
    map.once('style.load', () => {
      if (activeUrl && header) {
        renderMvtLayers(activeUrl, header, vectorLayerNames);
      }
    });
  });
});

// Live Styling Controls
colorPicker.addEventListener('input', (e) => {
  const color = e.target.value;
  currentLayers.forEach(id => {
    if (id.includes('fill') && map.getLayer(id)) map.setPaintProperty(id, 'fill-color', color);
    if (id.includes('line') && map.getLayer(id)) map.setPaintProperty(id, 'line-color', color);
    if (id.includes('circle') && map.getLayer(id)) map.setPaintProperty(id, 'circle-color', color);
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

// Jalankan aplikasi
initMap();
