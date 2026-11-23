import os
import secrets
import platform
from flask import Flask, render_template, session, send_from_directory, make_response, jsonify, request
from dotenv import load_dotenv
from core.database import db_fetch_one, db_fetch_all, get_all_settings
from routes.settings_history import settings_history_bp
from routes.ai_snapshot import ai_snapshot_bp
from routes.python_power import python_power_bp
from routes.knowledge import knowledge_bp

# Direktori dasar absolut aplikasi
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Muat variabel environment dari file .env dengan path absolut (kompatibel Phusion Passenger cPanel)
load_dotenv(os.path.join(BASE_DIR, '.env'))

app = Flask(
    __name__,
    template_folder='templates',
    static_folder='static'
)

# Konfigurasi secret key untuk session & proteksi CSRF
app.secret_key = os.getenv('SECRET_KEY', os.getenv('APP_KEY', secrets.token_hex(32)))

# Batas ukuran payload file upload (10 MB)
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024

# Pengerasan keamanan session cookie
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# Daftarkan Blueprint API
app.register_blueprint(settings_history_bp)
app.register_blueprint(ai_snapshot_bp)
app.register_blueprint(python_power_bp)
app.register_blueprint(knowledge_bp)

@app.context_processor
def inject_helpers():
    """Menyediakan variabel base_path dan helper asset_url ke seluruh template Jinja2."""
    base_path = request.script_root.rstrip('/') or os.getenv('BASE_PATH', '').rstrip('/')

    def asset_url(filename):
        clean_file = filename.lstrip('/')
        if clean_file.startswith('static/'):
            clean_file = clean_file[len('static/'):]
        full_disk_path = os.path.join(BASE_DIR, 'static', clean_file)
        v_param = ''
        if os.path.exists(full_disk_path):
            v_param = f"?v={int(os.path.getmtime(full_disk_path))}"
        return f"{base_path}/static/{clean_file}{v_param}"

    return {
        'base_path': base_path,
        'asset_url': asset_url
    }

@app.route('/')
def index():
    """Halaman antarmuka utama Benggala OS Cockpit (Mendukung mode web standar & hybrid Android embed)."""
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_hex(32)
    base_path = request.script_root.rstrip('/') or os.getenv('BASE_PATH', '').rstrip('/')
    is_embed = request.args.get('embed', '') == '1'
    initial_panel = (request.args.get('panel') or '').strip()
    return render_template(
        'index.html',
        csrf_token=session['csrf_token'],
        base_path=base_path,
        is_embed=is_embed,
        initial_panel=initial_panel
    )

@app.route('/item-detail')
def item_detail():
    """Halaman detail objek terkunci & interaksi AI interaktif mendalam."""
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_hex(32)
    base_path = request.script_root.rstrip('/') or os.getenv('BASE_PATH', '').rstrip('/')
    target_label = (request.args.get('label') or '').strip()

    settings = get_all_settings()
    gemini_key = (settings.get('gemini_api_key') or os.getenv('GEMINI_API_KEY') or '').strip()
    deepseek_key = (settings.get('deepseek_api_key') or os.getenv('DEEPSEEK_API_KEY') or '').strip()

    if gemini_key.startswith('sk-ant-') or gemini_key.lower() in ('dummy', 'none', 'null', 'masked') or '***' in gemini_key:
        gemini_key = (os.getenv('GEMINI_API_KEY') or '').strip()
    if deepseek_key.startswith('sk-ant-') or deepseek_key.lower() in ('dummy', 'none', 'null', 'masked') or '***' in deepseek_key:
        deepseek_key = (os.getenv('DEEPSEEK_API_KEY') or '').strip()

    if gemini_key and not gemini_key.startswith('dummy'):
        active_provider = "Nirmala AI"
        active_model = (settings.get('gemini_model') or os.getenv('GEMINI_MODEL') or 'gemini-2.5-flash').strip()
    elif deepseek_key and not deepseek_key.startswith('dummy'):
        active_provider = "Nirmala AI"
        active_model = (settings.get('deepseek_model') or os.getenv('DEEPSEEK_MODEL') or 'deepseek-chat').strip()
    else:
        active_provider = "Nirmala AI"
        active_model = "Rule-based Engine"

    return render_template(
        'item_detail.html',
        csrf_token=session['csrf_token'],
        base_path=base_path,
        target_label=target_label,
        active_provider=active_provider,
        active_model=active_model
    )

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

@app.route('/uploads/knowledge/<path:filename>')
def uploaded_knowledge(filename):
    """Menyajikan berkas foto thumbnail objek dari direktori uploads/knowledge."""
    return send_from_directory('uploads/knowledge', filename)

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

@app.route('/api/debug/pipeline-check', methods=['GET'])
def debug_pipeline_check():
    """
    Endpoint Diagnosa Aman:
    Memeriksa konfigurasi server, izin folder, library Pillow, dan koneksi DB
    tanpa membocorkan kredensial atau API key.
    """
    env_path = os.path.join(BASE_DIR, '.env')
    env_file_exists = os.path.isfile(env_path)
    secret_key_configured = bool(app.secret_key and len(str(app.secret_key)) > 0)
    cwd_matches_base_dir = (os.path.abspath(os.getcwd()) == os.path.abspath(BASE_DIR))

    snapshots_dir = os.path.join(BASE_DIR, 'uploads', 'snapshots')
    snapshots_dir_writable = False
    try:
        os.makedirs(snapshots_dir, exist_ok=True)
        test_file = os.path.join(snapshots_dir, '.write_test')
        with open(test_file, 'w', encoding='utf-8') as f:
            f.write('ok')
        if os.path.exists(test_file):
            os.remove(test_file)
        snapshots_dir_writable = True
    except Exception as e:
        app.logger.warning(f"Snapshots directory test write failed: {e}")
        snapshots_dir_writable = False

    pillow_ok = False
    pillow_version = None
    try:
        import PIL
        pillow_ok = True
        pillow_version = getattr(PIL, '__version__', 'unknown')
    except ImportError:
        pillow_ok = False
        pillow_version = None

    db_connected = False
    detection_logs_columns = []
    try:
        test_res = db_fetch_one("SELECT 1 AS ok")
        if test_res and test_res.get('ok') == 1:
            db_connected = True
            cols = db_fetch_all("SHOW COLUMNS FROM detection_logs")
            if cols:
                detection_logs_columns = [col.get('Field') for col in cols if 'Field' in col]
    except Exception as e:
        app.logger.error(f"Pipeline check DB error: {e}")
        db_connected = False

    return jsonify({
        "status": "ok",
        "python_version": platform.python_version(),
        "env_file_exists": env_file_exists,
        "secret_key_configured": secret_key_configured,
        "cwd_matches_base_dir": cwd_matches_base_dir,
        "script_root": request.script_root,
        "request_host": request.host,
        "snapshots_dir_writable": snapshots_dir_writable,
        "pillow_ok": pillow_ok,
        "pillow_version": pillow_version,
        "db_connected": db_connected,
        "detection_logs_columns": detection_logs_columns
    }), 200

if __name__ == '__main__':
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() in ('true', '1', 't')
    app.run(host=host, port=port, debug=debug)
