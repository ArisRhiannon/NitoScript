import http.server
import socketserver
import json
import os
import subprocess
import tempfile

PORT = 8085
HOST = "127.0.0.1"  # Loopback only: the /api/run endpoint executes code, never expose it on a network.
WEB_DIR = os.path.join(os.path.dirname(__file__), 'web')

class NitoBlocksAPIHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def do_POST(self):
        if self.path == '/api/run':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                code_content = data.get('code', '')
                
                # Ejecutar NitoScript en un subproceso usando un archivo temporal aislado
                with tempfile.NamedTemporaryFile(suffix='.nito', delete=False) as f:
                    f.write(code_content.encode('utf-8'))
                    temp_filepath = f.name
                
                try:
                    # Invocar la VM de NitoScript de verdad
                    res = subprocess.run(
                        ['python3', os.path.join(os.path.dirname(__file__), 'nito.py'), temp_filepath],
                        capture_output=True,
                        text=True,
                        timeout=5.0  # Límite de ejecución de 5 segundos
                    )
                    stdout_output = res.stdout
                    stderr_output = res.stderr
                    success = res.returncode == 0
                except subprocess.TimeoutExpired:
                    stdout_output = ""
                    stderr_output = "Error: El tiempo de ejecución ha expirado (Límite de 5 segundos)."
                    success = False
                except Exception as e:
                    stdout_output = ""
                    stderr_output = f"Error al ejecutar el subproceso: {e}"
                    success = False
                finally:
                    # Limpieza del archivo temporal
                    if os.path.exists(temp_filepath):
                        os.remove(temp_filepath)
                
                response_data = {
                    'stdout': stdout_output,
                    'stderr': stderr_output,
                    'success': success
                }
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(response_data).encode('utf-8'))
                
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

# Evitar errores de 'Address already in use' al reiniciar
socketserver.TCPServer.allow_reuse_address = True

with socketserver.TCPServer((HOST, PORT), NitoBlocksAPIHandler) as httpd:
    print(f"[NitoBlocks Backend] Sirviendo en http://{HOST}:{PORT} e interactuando con nito.py...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[NitoBlocks Backend] Servidor detenido.")
