import http.server
import socket
import socketserver
import webbrowser
import os
import sys

PORT = 8000

def get_local_ip():
    """Finds the local IP address of this computer on Wi-Fi/LAN."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def do_GET(self):
        # Gracefully handle favicon requests
        if self.path == '/favicon.ico' and not os.path.exists('favicon.ico'):
            self.send_response(204)
            self.end_headers()
            return
        super().do_GET()

def run_server():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    local_ip = get_local_ip()

    print("\n" + "=" * 56)
    print("  🚀 Signature Extractor Server Running")
    print("=" * 56)
    print(f"  💻 Laptop / PC : http://localhost:{PORT}")
    print(f"  📱 Mobile Phone: http://{local_ip}:{PORT}")
    print("=" * 56)
    print("  Press Ctrl+C to stop.\n")

    webbrowser.open(f"http://localhost:{PORT}")

    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
            sys.exit(0)

if __name__ == '__main__':
    run_server()
