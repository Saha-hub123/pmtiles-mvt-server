/**
 * Cloudflare Worker: Serverless MVT & TileJSON Server from PMTiles on R2
 * Menghasilkan endpoint MVT XYZ standar (/archive/{z}/{x}/{y}.mvt)
 * dan TileJSON (/archive.json) yang dapat langsung dipakai di QGIS, ArcGIS, Mapbox, Leaflet.
 */

import { PMTiles } from 'pmtiles';

// Implementasi R2Source untuk PMTiles
class R2Source {
  constructor(bucket, key) {
    this.bucket = bucket;
    this.key = key;
  }

  getKey() {
    return this.key;
  }

  async getBytes(offset, length, signal) {
    const resp = await this.bucket.get(this.key, {
      range: { offset, length }
    });

    if (!resp) {
      throw new Error(`Objek tidak ditemukan di bucket R2: ${this.key}`);
    }

    const data = await resp.arrayBuffer();
    return { data, etag: resp.etag };
  }
}

// In-memory cache instance PMTiles agar pembacaan header efisien
const pmtilesCache = new Map();

function getPMTilesInstance(bucket, key) {
  if (!pmtilesCache.has(key)) {
    const source = new R2Source(bucket, key);
    pmtilesCache.set(key, new PMTiles(source));
  }
  return pmtilesCache.get(key);
}

export default {
  async fetch(request, env, ctx) {
    // 1. Tangani CORS Preflight (OPTIONS)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range, Content-Type, Accept',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    // Homepage info
    if (pathname === '/' || pathname === '') {
      return new Response(
        JSON.stringify(
          {
            service: 'Cloudflare Worker MVT Tile Server',
            engine: 'PMTiles + Cloudflare R2',
            usage: {
              tilejson: `${url.origin}/{nama_arsip}.json`,
              xyz_tile: `${url.origin}/{nama_arsip}/{z}/{x}/{y}.mvt`
            },
            status: 'running'
          },
          null,
          2
        ),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    try {
      // 2. Routing TileJSON: /{archive}.json
      const tileJsonMatch = pathname.match(/^\/([a-zA-Z0-9_\-\.]+)\.json$/);
      if (tileJsonMatch) {
        const archiveName = tileJsonMatch[1];
        const key = archiveName.endsWith('.pmtiles') ? archiveName : `${archiveName}.pmtiles`;
        const p = getPMTilesInstance(env.BUCKET, key);

        const header = await p.getHeader();
        const metadata = await p.getMetadata();

        const tileJson = {
          tilejson: '3.0.0',
          name: archiveName,
          description: metadata.description || `MVT Tile Server for ${archiveName}`,
          version: '1.0.0',
          scheme: 'xyz',
          tiles: [`${url.origin}/${archiveName}/{z}/{x}/{y}.mvt`],
          minzoom: header.minZoom,
          maxzoom: header.maxZoom,
          bounds: [header.minLon, header.minLat, header.maxLon, header.maxLat],
          center: [header.centerLon, header.centerLat, header.centerZoom],
          vector_layers: metadata.vector_layers || []
        };

        return new Response(JSON.stringify(tileJson, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': `public, max-age=${env.CACHE_MAX_AGE || 86400}`
          }
        });
      }

      // 3. Routing Tile MVT: /{archive}/{z}/{x}/{y}.(mvt|pbf)
      const tileMatch = pathname.match(/^\/([a-zA-Z0-9_\-\.]+)\/(\d+)\/(\d+)\/(\d+)\.(mvt|pbf)$/);
      if (tileMatch) {
        const archiveName = tileMatch[1];
        const z = parseInt(tileMatch[2], 10);
        const x = parseInt(tileMatch[3], 10);
        const y = parseInt(tileMatch[4], 10);

        const key = archiveName.endsWith('.pmtiles') ? archiveName : `${archiveName}.pmtiles`;
        const p = getPMTilesInstance(env.BUCKET, key);

        const tile = await p.getZxy(z, x, y);

        if (!tile) {
          return new Response(null, {
            status: 204, // No Content jika tile kosong di koordinat tsb
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': `public, max-age=${env.CACHE_MAX_AGE || 86400}`
            }
          });
        }

        const headers = new Headers({
          'Content-Type': 'application/x-protobuf',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': `public, max-age=${env.CACHE_MAX_AGE || 86400}`
        });

        // Tangani kompresi gzip bawaan PMTiles
        if (tile.compression === 1 || tile.compression === 'gzip') {
          headers.set('Content-Encoding', 'gzip');
        }

        return new Response(tile.data, {
          status: 200,
          headers
        });
      }

      return new Response('Endpoint tidak ditemukan. Format: /{archive}/{z}/{x}/{y}.mvt atau /{archive}.json', {
        status: 404,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    } catch (err) {
      console.error('Worker Error:', err);
      return new Response(
        JSON.stringify({ error: err.message || 'Internal Server Error' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  }
};
