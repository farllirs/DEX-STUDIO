#!/usr/bin/env python3
"""
{{APP_NAME}} — Aplicación Web
Creado por {{CREATOR}} con DEX STUDIO
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import os
import json

PORT = 8080

class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.join(
            os.path.dirname(os.path.abspath(__file__)), 'src'), **kwargs)

    def do_GET(self):
        if self.path == '/api/info':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            info = {
                "name": "{{APP_NAME}}",
                "version": "{{VERSION}}",
                "creator": "{{CREATOR}}"
            }
            self.wfile.write(json.dumps(info).encode())
        else:
            super().do_GET()

def main():
    server = HTTPServer(('0.0.0.0', PORT), AppHandler)
    print(f"🌐 {{APP_NAME}} corriendo en http://localhost:{PORT}")
    print("   Presiona Ctrl+C para detener")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n✓ Servidor detenido")

if __name__ == '__main__':
    main()
