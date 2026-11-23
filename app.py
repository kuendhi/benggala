import os
import secrets
from flask import Flask, render_template, session, send_from_directory, make_response, jsonify, request
from dotenv import load_dotenv
from core.database import db_fetch_one
from routes.settings_history import settings_history_bp
from routes.ai_snapshot import ai_snapshot_bp
from routes.python_power import python_power_bp

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

# Daftarkan Blueprint API
app.register_blueprint(settings_history_bp)
app.register_blueprint(ai_snapshot_bp)
app.register_blueprint(python_power_bp)

@app.context_processor
def inject_helpers():
    """Menyediakan variabel base_path dan helper asset_url ke seluruh template Jinja2."""
    base_path = request.script_root.rstrip('/') or os.getenv('BASE_PATH', '').rstrip('/')

    def asset_url(filename):
        clean_file = filename.lstrip('/')
        if clean_file.startswith('static/'):
            clean_file = clean_file[len('static/'):]
        return f"{base_path}/static/{clean_file}"

    return {
        'base_path': base_path,
        'asset_url': asset_url
    }

@app.route('/')
def index():
    """Halaman antarmuka utama Benggala OS Cockpit."""
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_hex(32)
    base_path = request.script_root.rstrip('/') or os.getenv('BASE_PATH', '').rstrip('/')
    return render_template('index.html', csrf_token=session['csrf_token'], base_path=base_path)

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

@app.route('/uploads/snapshots/<path:filename>')
def uploaded_snapshots(filename):
    """Menyajikan berkas foto snapshot dari direktori uploads/snapshots."""
    return send_from_directory('uploads/snapshots', filename)

@app.route('/api/health', methods=['GET'])
def health_check():
    """Endpoint Health Check: status engine Flask dan konektivitas database."""
    try:
        res = db_fetch_one("SELECT 1 AS health")
        db_connected = bool(res and res.get('health') == 1)
    except Exception as e:
        app.logger.error(f"Health check DB error: {e}")
        db_connected = False

    status = "ok" if db_connected else "degraded"
    return jsonify({
        "status": status,
        "engine": "Python Flask",
        "db_connected": db_connected
    }), (200 if db_connected else 500)

if __name__ == '__main__':
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() in ('true', '1', 't')
    app.run(host=host, port=port, debug=debug)
