import os
import io
import re
import json
import base64
import secrets
from datetime import datetime
import requests
from PIL import Image
from flask import Blueprint, request, jsonify, current_app
from core.database import db_execute, db_fetch_one, get_all_settings
from core.security import require_api_security, sanitize_filename

ai_snapshot_bp = Blueprint('ai_snapshot', __name__)

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
SNAPSHOTS_DIR = os.path.join(PROJECT_ROOT, 'uploads', 'snapshots')

# -----------------------------------------------------------------------------
# Helper: Pengiriman Notifikasi Telegram
# -----------------------------------------------------------------------------
def _send_telegram_photo(bot_token: str, chat_id: str, image_bytes: bytes, caption: str) -> bool:
    """Mengirim foto snapshot ke Telegram chat via Telegram Bot API (sendPhoto)."""
    if not bot_token or not chat_id or not image_bytes:
        return False
    url = f"https://api.telegram.org/bot{bot_token}/sendPhoto"
    try:
        files = {
            'photo': ('snapshot.jpg', image_bytes, 'image/jpeg')
        }
        data = {
            'chat_id': chat_id,
            'caption': (caption or '')[:1024]
        }
        resp = requests.post(url, data=data, files=files, timeout=15)
        return resp.status_code == 200
    except Exception as e:
        current_app.logger.warning(f"Telegram notification error: {e}")
        return False

# -----------------------------------------------------------------------------
# Helper: Integrasi Provider AI (Gemini & DeepSeek)
# -----------------------------------------------------------------------------
def _call_gemini_vision(api_key: str, prompt: str, image_b64: str = None, system_prompt: str = None) -> tuple[bool, str]:
    """Memanggil Google Gemini API 2.5 Flash dengan timeout 20 detik."""
    if not api_key or api_key == 'ISI_API_KEY_ANDA_DISINI':
        return False, "Gemini API Key belum dikonfigurasi."

    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
    headers = {
        'Content-Type': 'application/json',
        'x-goog-api-key': api_key
    }

    parts = []
    if image_b64:
        clean_b64 = image_b64
        if ',' in clean_b64:
            clean_b64 = clean_b64.split(',', 1)[1]
        parts.append({
            "text": prompt + "\nAnalisa juga secara visual dari foto terlampir: sebutkan kondisi, perkiraan ukuran, dan konteks dalam Bahasa Indonesia."
        })
        parts.append({
            "inline_data": {
                "mime_type": "image/jpeg",
                "data": clean_b64
            }
        })
    else:
        parts.append({"text": prompt})

    payload = {
        "contents": [{"parts": parts}]
    }

    if system_prompt:
        payload["system_instruction"] = {
            "parts": [{"text": system_prompt[:600]}]
        }

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=20)
        if resp.status_code == 200:
            data = resp.json()
            candidates = data.get('candidates', [])
            if candidates:
                parts_out = candidates[0].get('content', {}).get('parts', [])
                if parts_out:
                    text_out = parts_out[0].get('text', '').strip()
                    if text_out:
                        return True, text_out
            return False, "Respons Gemini tidak memuat konten teks yang valid."
        return False, f"Gemini API merespons status HTTP {resp.status_code}"
    except Exception as e:
        return False, f"Koneksi ke Gemini gagal: {str(e)}"

def _call_deepseek_text(api_key: str, system_prompt: str, user_prompt: str) -> tuple[bool, str]:
    """Memanggil DeepSeek Chat API dengan timeout 20 detik."""
    if not api_key or api_key == 'ISI_DEEPSEEK_API_KEY_DISINI':
        return False, "DeepSeek API Key belum dikonfigurasi."

    url = os.getenv('DEEPSEEK_API_URL', 'https://api.deepseek.com/chat/completions')
    model = os.getenv('DEEPSEEK_MODEL', 'deepseek-chat')
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}'
    }

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": (system_prompt or "Anda adalah asisten AI Benggala.")[:600]},
            {"role": "user", "content": user_prompt}
        ]
    }

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=20)
        if resp.status_code == 200:
            data = resp.json()
            choices = data.get('choices', [])
            if choices:
                content = choices[0].get('message', {}).get('content', '').strip()
                if content:
                    return True, content
            return False, "Respons DeepSeek tidak memuat konten teks yang valid."
        return False, f"DeepSeek API merespons status HTTP {resp.status_code}"
    except Exception as e:
        return False, f"Koneksi ke DeepSeek gagal: {str(e)}"

# -----------------------------------------------------------------------------
# 1. POST /api/snapshot/save (Simpan Snapshot Gambar Aman)
# -----------------------------------------------------------------------------
@ai_snapshot_bp.route('/api/snapshot/save', methods=['POST'])
@ai_snapshot_bp.route('/api/save_snapshot.php', methods=['POST'])
@require_api_security(max_requests=30, window_seconds=60)
def save_snapshot():
    """
    Menyimpan snapshot foto dari webcam (Base64), memverifikasi integritas gambar via Pillow,
    menyimpan ke uploads/snapshots/, dan mencatat record ke detection_logs.
    """
    payload = request.get_json(silent=True) or {}
    raw_img = str(payload.get('image') or '').strip()

    if not raw_img:
        return jsonify({
            "status": "error",
            "message": "Data gambar (Base64) wajib disertakan."
        }), 400

    # Ekstrak data base64 jika menggunakan data URI scheme
    if ',' in raw_img:
        prefix, b64_str = raw_img.split(',', 1)
        if not re.match(r'^data:image\/(jpeg|jpg|png|webp);base64', prefix, re.IGNORECASE):
            return jsonify({
                "status": "error",
                "message": "Prefix skema gambar tidak valid."
            }), 400
    else:
        b64_str = raw_img

    try:
        img_bytes = base64.b64decode(b64_str)
    except Exception:
        return jsonify({
            "status": "error",
            "message": "Format Base64 gambar tidak valid."
        }), 400

    # Batasi ukuran maksimal 2 MB
    if len(img_bytes) > 2 * 1024 * 1024:
        return jsonify({
            "status": "error",
            "message": "Ukuran gambar melebihi batas maksimal 2MB."
        }), 413

    # Verifikasi integritas gambar via Pillow (mencegah payload berbahaya)
    try:
        with Image.open(io.BytesIO(img_bytes)) as test_img:
            test_img.verify()
    except Exception:
        return jsonify({
            "status": "error",
            "message": "Data yang dikirim bukan format gambar yang valid."
        }), 400

    # Buka kembali untuk konversi ke JPEG teroptimasi
    try:
        with Image.open(io.BytesIO(img_bytes)) as pil_img:
            rgb_img = pil_img.convert('RGB')
            now_str = datetime.now().strftime('%Y%m%d_%H%M%S')
            hex_suffix = secrets.token_hex(2)
            filename = f"snap_{now_str}_{hex_suffix}.jpg"
            target_path = os.path.join(SNAPSHOTS_DIR, filename)
            rgb_img.save(target_path, 'JPEG', quality=85)
    except Exception as e:
        current_app.logger.error(f"Error saving image: {e}")
        return jsonify({
            "status": "error",
            "message": "Gagal menyimpan berkas gambar ke penyimpanan server."
        }), 500

    # Parsing data objek terdeteksi
    objects_data = payload.get('objects') or payload.get('object_name') or []
    if isinstance(objects_data, list):
        objects_str = json.dumps(objects_data, ensure_ascii=False)
        object_count = len(objects_data)
    elif isinstance(objects_data, str) and objects_data.strip():
        objects_str = objects_data.strip()
        object_count = 1
    else:
        objects_str = ""
        object_count = 0

    is_cctv = bool(payload.get('is_cctv'))
    ai_provider = payload.get('ai_provider')
    ai_analysis = payload.get('ai_analysis')

    # Integrasi Notifikasi Telegram jika mode CCTV
    telegram_sent = False
    try:
        settings = get_all_settings()
        tg_enabled = (settings.get('telegram_enabled') or '0') == '1'
        tg_token = str(settings.get('telegram_bot_token') or '').strip()
        tg_chat_id = str(settings.get('telegram_chat_id') or '').strip()

        if is_cctv and tg_enabled and tg_token and tg_chat_id:
            caption = f"🚨 *PERINGATAN CCTV BENGGALA!*\n📅 *Waktu:* {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n📁 *Berkas:* `{filename}`"
            with open(target_path, 'rb') as f_img:
                telegram_sent = _send_telegram_photo(tg_token, tg_chat_id, f_img.read(), caption)
    except Exception as tg_err:
        current_app.logger.warning(f"Telegram auto-send error: {tg_err}")

    # Catat ke detection_logs
    sql = """
        INSERT INTO detection_logs (filename, file_path, detected_objects, object_count, is_cctv, telegram_sent, ai_provider, analysis_result)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """
    rel_path = f"uploads/snapshots/{filename}"
    log_id = db_execute(sql, (
        filename,
        rel_path,
        objects_str,
        object_count,
        1 if is_cctv else 0,
        1 if telegram_sent else 0,
        ai_provider or None,
        ai_analysis or None
    ))

    is_php_path = request.path.endswith('.php')
    status_str = "success" if is_php_path else "ok"

    return jsonify({
        "status": status_str,
        "success": True,
        "id": log_id,
        "log_id": log_id,
        "filename": filename,
        "image_path": rel_path,
        "path": rel_path,
        "telegram_sent": telegram_sent
    }), 200

# -----------------------------------------------------------------------------
# 2. POST /api/ai/analyze (Smart LLM Router dengan Auto-Fallback)
# -----------------------------------------------------------------------------
@ai_snapshot_bp.route('/api/ai/analyze', methods=['POST'])
@ai_snapshot_bp.route('/api/analyze_llm.php', methods=['POST'])
@require_api_security(max_requests=15, window_seconds=60)
def analyze_ai():
    """
    Router AI multi-provider (Gemini & DeepSeek) dengan mekanisme auto-fallback otomatis.
    Jika provider utama gagal/timeout/key kosong, otomatis mencoba provider cadangan.
    """
    payload = request.get_json(silent=True) or {}
    settings = get_all_settings()

    # Kredensial AI dari settings (fallback ke environment)
    gemini_key = settings.get('gemini_api_key') or os.getenv('GEMINI_API_KEY', '')
    deepseek_key = settings.get('deepseek_api_key') or os.getenv('DEEPSEEK_API_KEY', '')

    default_provider = (settings.get('llm_provider') or settings.get('llm_default_provider') or os.getenv('LLM_DEFAULT_PROVIDER') or 'gemini').lower()
    requested_provider = (payload.get('provider') or default_provider).lower()
    primary = 'gemini' if requested_provider == 'gemini' else 'deepseek'
    secondary = 'gemini' if primary == 'deepseek' else 'deepseek'

    system_prompt = payload.get('system_prompt') or payload.get('mission_prompt') or settings.get('system_prompt') or os.getenv('SYSTEM_PROMPT') or "Anda adalah asisten AI Benggala yang menganalisis objek visual dalam Bahasa Indonesia."

    # Susun prompt analisis berdasarkan objek yang dikirim
    user_prompt = payload.get('prompt') or ''
    if not user_prompt:
        objects_data = payload.get('objects')
        if isinstance(objects_data, list):
            items_str = []
            for obj in objects_data:
                if isinstance(obj, dict):
                    name = obj.get('name') or obj.get('name_id') or obj.get('class') or 'objek'
                    size = f" [{obj['ukuran']}]" if obj.get('ukuran') else ''
                    items_str.append(f"{name}{size}")
                else:
                    items_str.append(str(obj))
            objects_summary = ', '.join(items_str)
            user_prompt = f"Berikut adalah objek yang baru saja terdeteksi oleh kamera real-time: {objects_summary}.\nBerikan analisis visual yang jelas dan menarik dalam 2-3 paragraf informatif berbahasa Indonesia."
        elif isinstance(objects_data, str) and objects_data.strip():
            user_prompt = f"Berikut adalah objek yang terdeteksi: {objects_data}.\nBerikan analisis visual singkat dalam Bahasa Indonesia."
        else:
            user_prompt = "Berikan analisis deteksi visual kamera saat ini dalam Bahasa Indonesia."

    image_b64 = payload.get('image')
    log_id = payload.get('log_id')
    try:
        log_id = int(log_id) if log_id else None
    except (ValueError, TypeError):
        log_id = None

    # 1. Jalankan Provider Utama
    fallback_triggered = False
    used_provider = primary

    if primary == 'gemini':
        success, result_text = _call_gemini_vision(gemini_key, user_prompt, image_b64, system_prompt)
    else:
        success, result_text = _call_deepseek_text(deepseek_key, system_prompt, user_prompt)

    # 2. Jika Provider Utama Gagal, Jalankan Provider Cadangan (Auto-Fallback)
    if not success:
        fallback_triggered = True
        used_provider = secondary
        if secondary == 'gemini':
            success, result_text = _call_gemini_vision(gemini_key, user_prompt, image_b64, system_prompt)
        else:
            success, result_text = _call_deepseek_text(deepseek_key, system_prompt, user_prompt)

    # 3. Jika Kedua Provider Gagal, Kembalikan HTTP 502
    if not success:
        return jsonify({
            "status": "error",
            "message": "Layanan AI sementara tidak tersedia. Silakan periksa koneksi atau API Key Anda.",
            "fallback_triggered": True
        }), 502

    # 4. Jika ada log_id, update record detection_logs
    if log_id and log_id > 0:
        try:
            db_execute("""
                UPDATE detection_logs 
                SET ai_provider = %s, analysis_result = %s, llm_provider = %s, llm_analysis = %s 
                WHERE id = %s
            """, (used_provider, result_text, used_provider, result_text, log_id))
        except Exception as e:
            current_app.logger.warning(f"Gagal memperbarui analysis pada log_id {log_id}: {e}")

    is_php_path = request.path.endswith('.php')
    status_str = "success" if is_php_path else "ok"

    return jsonify({
        "status": status_str,
        "success": True,
        "provider": used_provider,
        "provider_used": used_provider,
        "analysis": result_text,
        "fallback_triggered": fallback_triggered,
        "log_id": log_id
    }), 200

# -----------------------------------------------------------------------------
# 3. POST /api/telegram/send (Kirim Notifikasi Telegram Bot)
# -----------------------------------------------------------------------------
@ai_snapshot_bp.route('/api/telegram/send', methods=['POST'])
@require_api_security(max_requests=10, window_seconds=60)
def telegram_send():
    """
    Mengirimkan snapshot foto dan keterangan teks ke Telegram Bot chat_id terdaftar.
    """
    payload = request.get_json(silent=True) or {}
    caption = str(payload.get('caption') or 'Notifikasi Benggala OS').strip()

    settings = get_all_settings()
    tg_enabled = (settings.get('telegram_enabled') or '0') == '1'
    tg_token = str(settings.get('telegram_bot_token') or '').strip()
    tg_chat_id = str(settings.get('telegram_chat_id') or '').strip()

    if not tg_enabled or not tg_token or not tg_chat_id:
        return jsonify({
            "status": "error",
            "message": "Notifikasi Telegram belum diaktifkan atau konfigurasi (token/chat_id) belum lengkap."
        }), 400

    photo_bytes = None

    # Opsi A: Dikirim via image_path
    if payload.get('image_path'):
        raw_fname = os.path.basename(str(payload['image_path']))
        clean_fname = sanitize_filename(raw_fname)
        full_path = os.path.join(SNAPSHOTS_DIR, clean_fname)
        if os.path.isfile(full_path):
            with open(full_path, 'rb') as f:
                photo_bytes = f.read()

    # Opsi B: Dikirim via Base64 image
    elif payload.get('image'):
        raw_img = str(payload['image']).strip()
        if ',' in raw_img:
            raw_img = raw_img.split(',', 1)[1]
        try:
            photo_bytes = base64.b64decode(raw_img)
        except Exception:
            pass

    if not photo_bytes:
        return jsonify({
            "status": "error",
            "message": "Berkas foto tidak ditemukan atau data gambar tidak valid."
        }), 400

    sent = _send_telegram_photo(tg_token, tg_chat_id, photo_bytes, caption)
    if not sent:
        return jsonify({
            "status": "error",
            "message": "Gagal mengirim notifikasi foto ke Telegram API."
        }), 502

    return jsonify({
        "status": "ok",
        "success": True,
        "message": "Notifikasi Telegram terkirim"
    }), 200
