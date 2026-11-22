import os
import secrets
from flask import Flask, render_template, session, send_from_directory, make_response
from dotenv import load_dotenv

# Muat variabel environment dari file .env jika tersedia
load_dotenv()

app = Flask(
    __name__,
    template_folder='templates',
    static_folder='static'
)

# Konfigurasi secret key untuk session & proteksi CSRF
app.secret_key = os.getenv('SECRET_KEY', os.getenv('APP_KEY', secrets.token_hex(32)))

# Batas ukuran payload file upload (16 MB)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

@app.route('/')
def index():
    """Halaman antarmuka utama Benggala OS Cockpit."""
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_hex(32)
    return render_template('index.html', csrf_token=session['csrf_token'])

@app.route('/manifest.json')
def manifest():
    """Menyajikan manifest.json PWA dari direktori static."""
    return send_from_directory('static', 'manifest.json', mimetype='application/manifest+json')

@app.route('/sw.js')
def service_worker():
    """Menyajikan sw.js Service Worker dengan header scope root."""
    response = make_response(send_from_directory('static', 'sw.js'))
    response.headers['Service-Worker-Allowed'] = '/'
    response.headers['Content-Type'] = 'application/javascript'
    return response

@app.route('/assets/<path:filename>')
def assets_fallback(filename):
    """Fallback route untuk kompatibilitas jika aset diakses via /assets/..."""
    return send_from_directory('static/assets', filename)

if __name__ == '__main__':
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() in ('true', '1', 't')
    app.run(host=host, port=port, debug=debug)
