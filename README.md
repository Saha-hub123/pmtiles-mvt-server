# 🗺️ Server MVT Gratis: Cloudflare R2 + PMTiles + GitHub Pages

Solusi modern **Serverless Web GIS** untuk menyajikan data vektor spasial berukuran besar dalam bentuk **Mapbox Vector Tiles (MVT)** tanpa memerlukan VPS (Virtual Private Server), GeoServer, atau database PostGIS yang berbayar.

---

## ⚡ Mengapa Kombinasi Arsitektur Ini Sangat Optimal?

1. **PMTiles (Protomaps):** Seluruh piramida *vector tile* (ribuan hingga jutaan tile MVT) dikemas ke dalam **satu file tunggal (`.pmtiles`)**.
2. **Cloudflare R2 (Object Storage):**
   - **$0 Biaya Egress (Bandwidth Transfer Gratis Selamanya!):** Berbeda dengan AWS S3 atau Google Cloud Storage yang mengenakan biaya per GB transfer bandwidth, Cloudflare R2 **tidak memungut biaya egress sama sekali**.
   - **Kapasitas Free Tier:** 10 GB penyimpanan data gratis, 10 juta permintaan baca (Class B operations) per bulan.
   - **Mendukung HTTP Range Requests:** Browser hanya mendownload byte (potongan 2 KB – 50 KB) tile yang sedang dilihat pada layar pengguna.
3. **GitHub Pages (Frontend Hosting):** Gratis 100% untuk menampung web viewer (MapLibre GL JS + pustaka `pmtiles.js`).

---

## 📁 Struktur Direktori Proyek

```text
pmtiles-mvt-server/
│
├── index.html                   # Halaman utama Web Viewer (MapLibre GL JS + PMTiles)
├── style.css                    # Desain antarmuka modern (Glassmorphism & Responsif)
├── app.js                       # Logika peta, HTTP Range handler, & feature inspector
├── cors-r2.json                 # Konfigurasi CORS wajib untuk Cloudflare R2 Bucket
│
├── sample-data/                 # Folder data uji coba
│   └── sample_rute.geojson      # Contoh data rute spasial GeoJSON
│
├── cloudflare-worker/           # (Opsional) Worker jika ingin URL MVT standar untuk QGIS
│   ├── worker.js                # Kode serverless MVT XYZ & TileJSON
│   ├── wrangler.toml            # Konfigurasi Cloudflare Wrangler
│   └── package.json
│
└── .github/workflows/           # Otomasi CI/CD
    ├── deploy.yml               # Auto deploy ke GitHub Pages saat push
    └── convert-pmtiles.yml      # Otomatis konversi GeoJSON ke PMTiles via Tippecanoe
```

---

## 🛠️ Langkah-Langkah Manual Setup

### 1. Setup Cloudflare R2 Bucket

1. Buka [Cloudflare Dashboard](https://dash.cloudflare.com/) dan login ke akun Anda (buat akun gratis jika belum punya).
2. Pada menu samping kiri, klik **R2 Object Storage** → **Create bucket**.
3. Beri nama bucket Anda (misalnya: `geo-tiles` atau `mvt-data`), lalu klik **Create Bucket**.
4. **Wajib: Aktifkan Akses Publik (Public Access):**
   - Masuk ke tab **Settings** pada bucket yang baru dibuat.
   - Cari bagian **Public access**.
   - Anda bisa mengaktifkan **R2.dev subdomain** (contoh: `https://pub-xxxxxx.r2.dev`) atau hubungkan dengan **Custom Domain** Anda sendiri (misal: `tiles.domainanda.com`).
5. **Wajib: Pasang Aturan CORS (Cross-Origin Resource Sharing):**
   - Di tab **Settings**, scroll ke bagian **CORS Policy** → klik **Edit CORS policy**.
   - Salin isi dari file [`cors-r2.json`](cors-r2.json) yang ada di repo ini:
     ```json
     [
       {
         "AllowedOrigins": ["*"],
         "AllowedMethods": ["GET", "HEAD"],
         "AllowedHeaders": ["Range", "Origin", "Accept", "Content-Type"],
         "ExposeHeaders": ["Content-Range", "Accept-Ranges", "Content-Length", "ETag"],
         "MaxAgeSeconds": 3600
       }
     ]
     ```
   - Klik **Save**.
   > ⚠️ **Catatan Kritis:** Header `Range` di `AllowedHeaders` serta `Content-Range` & `Accept-Ranges` di `ExposeHeaders` **wajib ada**! Jika tidak, browser akan menolak membaca byte-chunk dari file PMTiles.

---

### 2. Konversi Data Spasial Menjadi File `.pmtiles`

Ada beberapa cara mudah untuk mengubah file Shapefile / GeoJSON / GeoPackage Anda menjadi `.pmtiles`:

#### Opsi A: Menggunakan GitHub Actions (Paling Praktis, Tanpa Perlu Install Apapun)
Proyek ini sudah dilengkapi file workflow [`.github/workflows/convert-pmtiles.yml`](.github/workflows/convert-pmtiles.yml).
1. Masukkan file GeoJSON Anda ke dalam folder `sample-data/`.
2. Push commit ke repository GitHub Anda.
3. Buka tab **Actions** di repo GitHub Anda → pilih workflow **"Convert GeoJSON to PMTiles (Tippecanoe)"** → klik **Run workflow**.
4. GitHub Actions akan menjalankan Tippecanoe di server Ubuntu dan menghasilkan file `.pmtiles` yang bisa langsung Anda download dari bagian **Artifacts**.

#### Opsi B: Menggunakan Felt Tippecanoe Online
1. Kunjungi layanan konversi online gratis dari Felt: [Felt Tippecanoe Online / PMTiles](https://felt.com/resources/tippecanoe-online).
2. Upload file GeoJSON Anda, dan sistem akan langsung menghasilkan file `.pmtiles`.

#### Opsi C: Menggunakan QGIS (Desktop GIS)
1. Buka software QGIS (versi 3.32+).
2. Install plugin **Vector Tiles Reader** atau gunakan fitur ekspor bawaan.
3. Anda bisa mengekspor layer ke format MBTiles atau langsung menggunakan script konversi PMTiles.

#### Opsi D: Menggunakan Tippecanoe CLI (WSL / Linux / Mac / Docker)
Jika Anda memiliki WSL (Ubuntu di Windows) atau Docker:
```bash
# Menghasilkan PMTiles dengan batas zoom otomatis
tippecanoe -zg \
  --projection=EPSG:4326 \
  -o rute_bandung.pmtiles \
  -l rute_layer \
  --drop-densest-as-needed \
  sample-data/sample_rute.geojson
```

---

### 3. Upload File `.pmtiles` ke Cloudflare R2

1. Buka bucket Cloudflare R2 Anda di dashboard web.
2. Klik tombol **Upload** → pilih file `.pmtiles` yang sudah dibuat (misal: `rute_bandung.pmtiles`).
3. Tunggu hingga upload selesai.
4. Salin URL publik file tersebut:
   - Format: `https://pub-xxxxxx.r2.dev/rute_bandung.pmtiles`
   - Atau (jika pakai Custom Domain): `https://tiles.domainanda.com/rute_bandung.pmtiles`

---

### 4. Menggunakan & Publish ke GitHub Pages

#### Uji Coba di Lokal:
1. Anda dapat menjalankan web server lokal ringan (misalnya via VSCode Live Server atau python):
   ```powershell
   python -m http.server 8000
   ```
2. Buka `http://localhost:8000` di browser.
3. Masukkan URL R2 file PMTiles Anda pada kolom input di panel samping, lalu klik **Muat**. Peta akan otomatis terbang (auto-zoom) ke batas koordinat data Anda!

#### Publish ke GitHub Pages:
1. Buat repository baru di akun GitHub Anda (misal: `pmtiles-mvt-server`).
2. Push seluruh file di folder ini ke repo tersebut:
   ```bash
   git init
   git add .
   git commit -m "Initial commit MVT PMTiles Server"
   git branch -M main
   git remote add origin https://github.com/<username>/<nama-repo>.git
   git push -u origin main
   ```
3. Buka GitHub Repo Anda → tab **Settings** → menu **Pages**.
4. Di bagian **Build and deployment**:
   - Source: pilih **GitHub Actions** (akan otomatis berjalan menggunakan file `.github/workflows/deploy.yml`).
5. Selesai! Web GIS Anda aktif di `https://<username>.github.io/<nama-repo>/`.

---

## 🚀 Fitur Lanjutan: Cloudflare Worker (Opsional)

### Kapan Anda Memerlukan Cloudflare Worker?
Secara *default*, web viewer pada GitHub Pages berkomunikasi **langsung** dengan Cloudflare R2 melalui protokol client-side PMTiles tanpa perlu server backend sama sekali.

Namun, jika Anda ingin data MVT tersebut dapat diakses oleh aplikasi GIS eksternal seperti:
- **QGIS Desktop** (sebagai koneksi Vector Tiles XYZ)
- **ArcGIS Online / ArcGIS Pro**
- **Leaflet standar** (yang membutuhkan format URL `/{z}/{x}/{y}.pbf`)
- Standar spesifikasi **TileJSON 3.0.0** (`https://worker.dev/data.json`)

Anda dapat mengaktifkan Cloudflare Worker yang sudah kami siapkan di folder [`cloudflare-worker/`](cloudflare-worker/):

1. Masuk ke folder worker:
   ```bash
   cd cloudflare-worker
   npm install
   ```
2. Sesuaikan nama bucket R2 Anda di file `wrangler.toml`:
   ```toml
   bucket_name = "NAMA_BUCKET_R2_ANDA"
   ```
3. Deploy dengan satu perintah:
   ```bash
   npx wrangler deploy
   ```
4. Anda akan mendapatkan URL endpoint:
   - **MVT Tile:** `https://mvt-pmtiles-worker.<subdomain>.workers.dev/{nama_arsip}/{z}/{x}/{y}.mvt`
   - **TileJSON:** `https://mvt-pmtiles-worker.<subdomain>.workers.dev/{nama_arsip}.json`

---

## 💡 Saran & Rekomendasi Optimal

1. **Gunakan Custom Domain di Cloudflare R2:**
   - Menghubungkan domain sendiri (misal `tiles.kampus.ac.id` atau domain gratis) ke R2 bucket akan mengaktifkan Cloudflare CDN Caching secara penuh di level DNS, mempercepat loading tile di seluruh dunia.
2. **Optimasi Ukuran Tile dengan Tippecanoe:**
   - Gunakan flag `--drop-densest-as-needed` dan `--simplify-only-low-zooms` saat membuat PMTiles agar ukuran tile pada zoom rendah tetap di bawah 500 KB per tile.
3. **Keamanan URL R2:**
   - Jika data bersifat privat atau berbayar, Anda dapat membuat Cloudflare Worker yang memverifikasi API Key / token sebelum menyajikan tile dari R2.

---

*Dibuat untuk kebutuhan GIS Kampus & Proyek Spasial Terbuka.*
