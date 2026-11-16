"""
Local Development Server with HTTP Range Request Support for PMTiles
Jalankan:
    python serve.py
Lalu buka:
    http://localhost:8000
"""

import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

class RangeRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Range, Content-Type')
        self.send_header('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, ETag')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def send_head(self):
        if 'Range' not in self.headers:
            return super().send_head()

        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            return super().send_head()

        try:
            f = open(path, 'rb')
        except OSError:
            self.send_error(404, "File not found")
            return None

        fs = os.fstat(f.fileno())
        total_len = fs.st_size

        range_header = self.headers['Range']
        try:
            parts = range_header.strip().split('=')[1].split('-')
            start = int(parts[0]) if parts[0] else 0
            end = int(parts[1]) if parts[1] else total_len - 1
            if end >= total_len:
                end = total_len - 1
        except Exception:
            self.send_error(400, "Invalid Range Header")
            f.close()
            return None

        content_len = end - start + 1
        self.send_response(206, "Partial Content")
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{total_len}")
        self.send_header("Content-Length", str(content_len))
        self.end_headers()

        f.seek(start)

        class RangeWrapper:
            def __init__(self, file_obj, length):
                self.f = file_obj
                self.rem = length
            def read(self, n=-1):
                if self.rem <= 0:
                    return b""
                read_size = min(n, self.rem) if n > 0 else self.rem
                chunk = self.f.read(read_size)
                self.rem -= len(chunk)
                return chunk
            def close(self):
                self.f.close()

        return RangeWrapper(f, content_len)

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print(f"\n=======================================================")
    print(f"🚀 PMTiles Local Server aktif di: http://localhost:{port}")
    print(f"   Buka browser Anda dan tuju alamat di atas.")
    print(f"   Tekan Ctrl + C untuk mematikan server.")
    print(f"=======================================================\n")
    server = HTTPServer(('127.0.0.1', port), RangeRequestHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer dihentikan.")
