import os
import io
import csv
import json
from flask import Blueprint, request, jsonify, Response, current_app
from core.database import db_fetch_one, db_fetch_all, db_execute, get_all_settings
from core.security import require_api_security, mask_secret, sanitize_filename, sanitize_csv_cell

settings_history_bp = Blueprint('settings_history', __name__)

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
SNAPSHOTS_DIR = os.path.join(PROJECT_ROOT, 'uploads', 'snapshots')

# -----------------------------------------------------------------------------
# 1. GET /api/settings (Ambil Pengaturan dengan Masking)
# -----------------------------------------------------------------------------
@settings_history_bp.route('/api/settings', methods=['GET'])
@settings_history_bp.route('/api/settings.php', methods=['GET', 'POST'])
def get_settings():
    """
    Mengambil semua pengaturan aplikasi dari database.
    Kunci rahasia (API Key & Token) WAJIB dimasking.
    """
    # Jika dipanggil via POST ke api/settings.php dengan action=save, alihkan ke save_settings
    if request.method == 'POST':
        json_data = request.get_json(silent=True) or {}
        if json_data.get('action') == 'save' or request.form.get('action') == 'save':
            return save_settings()

    raw_settings = get_all_settings()
    masked = dict(raw_settings)

    sensitive_keys = ['gemini_api_key', 'deepseek_api_key', 'telegram_bot_token']
    for key in sensitive_keys:
        val = raw_settings.get(key, '')
        masked[key] = mask_secret(val)

    # Status 'success' digunakan untuk kompatibilitas frontend JS, 'ok' untuk standar REST Python
    is_php_path = request.path.endswith('.php')
    status_code_str = "success" if is_php_path else "ok"

    return jsonify({
        "status": status_code_str,
        "success": True,
        "settings": masked,
        "data": masked,
        "has_gemini_key": bool(raw_settings.get('gemini_api_key')),
        "has_deepseek_key": bool(raw_settings.get('deepseek_api_key')),
        "has_telegram_token": bool(raw_settings.get('telegram_bot_token'))
    }), 200

# -----------------------------------------------------------------------------
# 2. POST /api/settings (Simpan Pengaturan Aman)
# -----------------------------------------------------------------------------
@settings_history_bp.route('/api/settings', methods=['POST'])
@require_api_security()
def save_settings():
    """
    Menyimpan pengaturan aplikasi ke database dengan proteksi overwrite masking.
    Hanya field yang ada di whitelist yang diproses.
    """
    payload = request.get_json(silent=True) or {}
    if 'settings' in payload and isinstance(payload['settings'], dict):
        data_to_save = payload['settings']
    else:
        data_to_save = payload

    whitelist = [
        'llm_provider',
        'llm_default_provider',
        'gemini_api_key',
        'deepseek_api_key',
        'confidence_threshold',
        'detection_threshold',
        'system_prompt',
        'telegram_bot_token',
        'telegram_chat_id',
        'telegram_enabled',
        'sound_enabled',
        'deepseek_model',
        'gemini_model'
    ]

    current_settings = get_all_settings()
    sensitive_keys = {'gemini_api_key', 'deepseek_api_key', 'telegram_bot_token'}

    sql_app = """
        INSERT INTO app_settings (setting_key, setting_value) 
        VALUES (%s, %s) 
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
    """
    sql_settings = """
        INSERT INTO settings (setting_key, setting_value) 
        VALUES (%s, %s) 
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
    """

    for key, value in data_to_save.items():
        if key not in whitelist:
            continue

        val_str = str(value).strip() if value is not None else ''

        # Proteksi Overwrite Masking: jangan timpa nilai asli jika input kosong atau diawali/mengandung '****'
        if key in sensitive_keys:
            if val_str == '' or '****' in val_str:
                continue

        # Simpan ke tabel app_settings
        try:
            db_execute(sql_app, (key, val_str))
        except Exception:
            pass

        # Sync ke tabel settings
        try:
            db_execute(sql_settings, (key, val_str))
        except Exception:
            pass

        # Sinkronisasi sinonim: llm_provider <-> llm_default_provider
        if key == 'llm_provider':
            try:
                db_execute(sql_app, ('llm_default_provider', val_str))
                db_execute(sql_settings, ('llm_default_provider', val_str))
            except Exception:
                pass
        elif key == 'llm_default_provider':
            try:
                db_execute(sql_app, ('llm_provider', val_str))
                db_execute(sql_settings, ('llm_provider', val_str))
            except Exception:
                pass

        # Sinkronisasi sinonim: confidence_threshold <-> detection_threshold
        if key == 'confidence_threshold':
            try:
                db_execute(sql_app, ('detection_threshold', val_str))
                db_execute(sql_settings, ('detection_threshold', val_str))
            except Exception:
                pass
        elif key == 'detection_threshold':
            try:
                db_execute(sql_app, ('confidence_threshold', val_str))
                db_execute(sql_settings, ('confidence_threshold', val_str))
            except Exception:
                pass

    is_php_path = request.path.endswith('.php')
    status_code_str = "success" if is_php_path else "ok"

    return jsonify({
        "status": status_code_str,
        "success": True,
        "message": "Pengaturan berhasil disimpan"
    }), 200

# -----------------------------------------------------------------------------
# 3. GET /api/history (Daftar Galeri Riwayat Maks 50)
# -----------------------------------------------------------------------------
@settings_history_bp.route('/api/history', methods=['GET'])
@settings_history_bp.route('/api/history.php', methods=['GET', 'POST'])
def list_history():
    """
    Mengambil maksimal 50 riwayat deteksi terbaru dari detection_logs.
    Mendukung panggilan POST dari frontend lama (action='list' atau action='delete').
    """
    # Jika dipanggil via POST ke api/history.php dengan action=delete
    if request.method == 'POST':
        json_data = request.get_json(silent=True) or {}
        if json_data.get('action') == 'delete' or request.form.get('action') == 'delete':
            return delete_history()

    sql = """
        SELECT id, filename, file_path, detected_objects, object_count, 
               is_cctv, telegram_sent, ai_provider, analysis_result, created_at 
        FROM detection_logs 
        ORDER BY created_at DESC 
        LIMIT 50
    """
    try:
        rows = db_fetch_all(sql)
    except Exception as e:
        current_app.logger.error(f"Error fetching history: {e}")
        rows = []

    formatted_rows = []
    for r in rows:
        created_at_val = r.get('created_at')
        if hasattr(created_at_val, 'strftime'):
            created_at_str = created_at_val.strftime('%Y-%m-%d %H:%M:%S')
        else:
            created_at_str = str(created_at_val or '')

        # Parsing detected_objects jika tersimpan sebagai JSON string
        det_obj = r.get('detected_objects')
        if isinstance(det_obj, str) and det_obj.strip():
            try:
                det_obj = json.loads(det_obj)
            except Exception:
                pass

        formatted_rows.append({
            'id': int(r.get('id', 0)),
            'filename': sanitize_filename(r.get('filename') or ''),
            'file_path': str(r.get('file_path') or ''),
            'detected_objects': det_obj,
            'object_count': int(r.get('object_count') or 0),
            'is_cctv': bool(r.get('is_cctv', False)),
            'telegram_sent': bool(r.get('telegram_sent', False)),
            'ai_provider': str(r.get('ai_provider') or ''),
            'analysis_result': str(r.get('analysis_result') or ''),
            'created_at': created_at_str
        })

    is_php_path = request.path.endswith('.php')
    status_code_str = "success" if is_php_path else "ok"

    return jsonify({
        "status": status_code_str,
        "success": True,
        "data": formatted_rows
    }), 200

# -----------------------------------------------------------------------------
# 4. POST /api/history/delete (Hapus Foto & Log Aman)
# -----------------------------------------------------------------------------
@settings_history_bp.route('/api/history/delete', methods=['POST'])
@require_api_security()
def delete_history():
    """
    Menghapus riwayat deteksi berdasarkan ID dan menghapus berkas foto secara aman.
    """
    payload = request.get_json(silent=True) or {}
    item_id = payload.get('id') or request.form.get('id')

    try:
        item_id = int(item_id)
        if item_id <= 0:
            raise ValueError()
    except (TypeError, ValueError):
        return jsonify({
            "status": "error",
            "message": "Parameter ID tidak valid."
        }), 400

    row = db_fetch_one("SELECT id, filename, file_path FROM detection_logs WHERE id = %s LIMIT 1", (item_id,))
    if not row:
        return jsonify({
            "status": "error",
            "message": "Data riwayat tidak ditemukan"
        }), 404

    # Hapus file fisik dengan pencegahan Path Traversal
    raw_fname = row.get('filename') or os.path.basename(str(row.get('file_path') or ''))
    if raw_fname:
        clean_name = sanitize_filename(raw_fname)
        photo_path = os.path.join(SNAPSHOTS_DIR, clean_name)
        if os.path.isfile(photo_path):
            try:
                os.remove(photo_path)
            except Exception as e:
                current_app.logger.warning(f"Gagal menghapus berkas foto fisik: {e}")

    # Hapus data dari tabel detection_logs
    db_execute("DELETE FROM detection_logs WHERE id = %s", (item_id,))

    is_php_path = request.path.endswith('.php')
    status_code_str = "success" if is_php_path else "ok"

    return jsonify({
        "status": status_code_str,
        "success": True,
        "message": "Riwayat berhasil dihapus"
    }), 200

# -----------------------------------------------------------------------------
# 5. GET /api/history/export-csv (Export CSV Excel Aman)
# -----------------------------------------------------------------------------
@settings_history_bp.route('/api/history/export-csv', methods=['GET'])
@settings_history_bp.route('/api/export_csv.php', methods=['GET'])
def export_csv():
    """
    Mengekspor riwayat deteksi ke format CSV dengan UTF-8 BOM dan anti CSV-Formula Injection.
    """
    sql = """
        SELECT id, created_at, filename, detected_objects, object_count, ai_provider, analysis_result 
        FROM detection_logs 
        ORDER BY created_at DESC
    """
    try:
        rows = db_fetch_all(sql)
    except Exception as e:
        current_app.logger.error(f"Error querying logs for CSV export: {e}")
        rows = []

    output = io.StringIO()
    # Tulis UTF-8 BOM agar Microsoft Excel membuka encoding bahasa/karakter dengan benar
    output.write('\ufeff')

    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    # Header kolom sesuai instruksi:
    # ["ID", "Waktu", "Objek", "Akurasi", "Provider AI", "Hasil Analisis", "File Foto"]
    writer.writerow([
        "ID",
        "Waktu",
        "Objek",
        "Akurasi",
        "Provider AI",
        "Hasil Analisis",
        "File Foto"
    ])

    for r in rows:
        c_at = r.get('created_at')
        if hasattr(c_at, 'strftime'):
            waktu_str = c_at.strftime('%Y-%m-%d %H:%M:%S')
        else:
            waktu_str = str(c_at or '')

        # Parsing ringkasan objek
        det_obj = r.get('detected_objects')
        obj_summary = '-'
        if isinstance(det_obj, str) and det_obj.strip():
            try:
                decoded = json.loads(det_obj)
                if isinstance(decoded, list):
                    labels = []
                    for item in decoded:
                        if isinstance(item, dict):
                            name = item.get('name_id') or item.get('name') or item.get('class') or ''
                            size = f" ({item['ukuran']})" if item.get('ukuran') else ''
                            if name:
                                labels.append(f"{name}{size}")
                        elif isinstance(item, str) and item.strip():
                            labels.append(item.strip())
                    if labels:
                        obj_summary = ', '.join(labels)
                else:
                    obj_summary = det_obj
            except Exception:
                obj_summary = det_obj

        # Akurasi / jumlah objek
        obj_count = r.get('object_count', 0)
        akurasi_str = f"{obj_count} objek" if obj_count else '-'

        ai_prov = r.get('ai_provider') or '-'
        analisis = r.get('analysis_result') or '-'
        filename = sanitize_filename(r.get('filename') or '')

        writer.writerow([
            sanitize_csv_cell(r.get('id', '')),
            sanitize_csv_cell(waktu_str),
            sanitize_csv_cell(obj_summary),
            sanitize_csv_cell(akurasi_str),
            sanitize_csv_cell(ai_prov),
            sanitize_csv_cell(analisis),
            sanitize_csv_cell(filename)
        ])

    csv_data = output.getvalue()
    output.close()

    response = Response(csv_data, mimetype='text/csv; charset=utf-8')
    response.headers['Content-Disposition'] = 'attachment; filename=benggala_history.csv'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response
