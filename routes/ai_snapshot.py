import os
import io
import re
import json
import base64
import secrets
from datetime import datetime
from typing import Optional, List, Dict, Tuple, Any
import requests
from PIL import Image
from flask import Blueprint, request, jsonify, current_app
from core.database import db_execute, db_fetch_one, db_fetch_all, get_all_settings
from core.security import require_api_security, sanitize_filename

ai_snapshot_bp = Blueprint('ai_snapshot', __name__)

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
SNAPSHOTS_DIR = os.path.join(PROJECT_ROOT, 'uploads', 'snapshots')
KNOWLEDGE_DIR = os.path.join(PROJECT_ROOT, 'uploads', 'knowledge')

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
# Helper: Sanitasi Teks & Kredensial AI
# -----------------------------------------------------------------------------
def _mask_in_text(text: str, secret: Optional[str] = None) -> str:
    """Menyamarkan API key dari teks error atau URL untuk mencegah kebocoran kredensial."""
    if not text:
        return ''
    out = str(text)
    if secret and len(secret) >= 6:
        out = out.replace(secret, '****')
    out = re.sub(r'([?&]key=)[^&\s]+', r'\1****', out)
    out = re.sub(r'([?&]x-goog-api-key=)[^&\s]+', r'\1****', out)
    out = re.sub(r'(Bearer\s+)[A-Za-z0-9_\-\.]{8,}', r'\1****', out)
    return out

def _clean_api_key(key_val: Optional[str], env_var: str) -> str:
    """Membersihkan API key dan fallback otomatis ke env var jika dummy/placeholder/masked."""
    def _is_valid(val: Optional[str]) -> bool:
        if not val:
            return False
        v = str(val).strip()
        if not v or '****' in v or v.startswith('ISI_') or 'DemoKey' in v or 'FakeKey' in v or len(v) < 8:
            return False
        return True

    if _is_valid(key_val):
        return str(key_val).strip()

    env_val = os.getenv(env_var, '').strip()
    if _is_valid(env_val):
        return env_val

    return ""

# -----------------------------------------------------------------------------
# Helper: Pencarian Referensi Visual Few-Shot dari custom_objects (Task 16C)
# -----------------------------------------------------------------------------
def _get_reference_samples(custom_label: str = '', objects_text: str = '', category: str = '', limit: int = 3) -> List[Dict[str, Any]]:
    """
    Mengambil maksimal `limit` (default 3) sampel foto dan metadata dari tabel custom_objects
    untuk mendukung Visual Few-Shot learning pada Gemini Vision dan kamus teks pada DeepSeek.
    """
    clean_custom_label = str(custom_label or '').replace('★', '').strip()
    clean_category = str(category or '').strip().lower()

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    knowledge_dir = os.path.join(base_dir, 'uploads', 'knowledge')

    references = []
    seen_ids = set()

    try:
        # 1. Prioritas 1: Jika custom_label terisi (hasil kecocokan KNN browser)
        if clean_custom_label:
            rows = db_fetch_all("""
                SELECT id, label_name, category, notes, image_path, created_at
                FROM custom_objects
                WHERE label_name = %s
                ORDER BY created_at DESC
                LIMIT 2
            """, (clean_custom_label,)) or []

            for r in rows:
                if r['id'] not in seen_ids:
                    seen_ids.add(r['id'])
                    references.append(r)

            # Jika belum mencapai limit, lengkapi dari kelas berbeda terbaru
            if len(references) < limit:
                other_rows = db_fetch_all("""
                    SELECT id, label_name, category, notes, image_path, created_at
                    FROM custom_objects
                    WHERE label_name != %s
                    ORDER BY created_at DESC
                    LIMIT 20
                """, (clean_custom_label,)) or []

                seen_labels = {r['label_name'] for r in references}
                for r in other_rows:
                    if r['id'] not in seen_ids and r['label_name'] not in seen_labels:
                        seen_ids.add(r['id'])
                        seen_labels.add(r['label_name'])
                        references.append(r)
                        if len(references) >= limit:
                            break

        # 2. Prioritas 2: Jika custom_label kosong tapi category terisi (misal mode misi aktif)
        elif clean_category and clean_category != 'umum':
            rows = db_fetch_all("""
                SELECT id, label_name, category, notes, image_path, created_at
                FROM custom_objects
                WHERE category = %s
                ORDER BY created_at DESC
                LIMIT 20
            """, (clean_category,)) or []

            seen_labels = set()
            for r in rows:
                if r['label_name'] not in seen_labels and r['id'] not in seen_ids:
                    seen_ids.add(r['id'])
                    seen_labels.add(r['label_name'])
                    references.append(r)
                    if len(references) >= limit:
                        break

        # 3. Prioritas 3: Jika keduanya kosong, ambil sampel terbaru dengan label_name berbeda
        if len(references) < limit:
            rows = db_fetch_all("""
                SELECT id, label_name, category, notes, image_path, created_at
                FROM custom_objects
                ORDER BY created_at DESC
                LIMIT 30
            """) or []

            seen_labels = {r['label_name'] for r in references}
            for r in rows:
                if r['id'] not in seen_ids and r['label_name'] not in seen_labels:
                    seen_ids.add(r['id'])
                    seen_labels.add(r['label_name'])
                    references.append(r)
                    if len(references) >= limit:
                        break

    except Exception as e:
        current_app.logger.warning(f"Error fetching reference samples from custom_objects: {e}")
        return []

    # Validasi fisik berkas gambar & konversi ke Base64 (dibatasi maks 300 KB per referensi)
    valid_samples = []
    try:
        for row in references[:limit]:
            try:
                raw_path = row.get('image_path') or ''
                clean_name = sanitize_filename(os.path.basename(raw_path))
                file_path = os.path.join(knowledge_dir, clean_name)

                if not os.path.isfile(file_path):
                    continue

                file_size = os.path.getsize(file_path)
                if file_size > 300 * 1024:
                    # Kompresi on-the-fly jika berkas referensi melebihi 300 KB
                    with Image.open(file_path) as im:
                        buf = io.BytesIO()
                        im.convert('RGB').save(buf, format='JPEG', quality=75)
                        b64_data = base64.b64encode(buf.getvalue()).decode('utf-8')
                else:
                    with open(file_path, 'rb') as f:
                        b64_data = base64.b64encode(f.read()).decode('utf-8')

                valid_samples.append({
                    "label_name": row.get('label_name', ''),
                    "category": row.get('category', 'umum'),
                    "notes": row.get('notes', ''),
                    "image_b64": b64_data
                })
            except Exception as read_err:
                current_app.logger.warning(f"Gagal membaca foto referensi {row.get('image_path')}: {read_err}")
                continue
    except Exception as ref_err:
        current_app.logger.warning(f"Gagal memproses sampel referensi: {ref_err}")
        return []

    return valid_samples

# -----------------------------------------------------------------------------
# Helper: Integrasi Provider AI (Gemini & DeepSeek)
# -----------------------------------------------------------------------------
def _call_gemini_vision(
    api_key: str,
    prompt: str,
    image_b64: Optional[str] = None,
    system_prompt: Optional[str] = None,
    references: Optional[List[Dict[str, Any]]] = None,
    model: Optional[str] = None
) -> Tuple[bool, str]:
    """
    Memanggil Google Gemini API (default gemini-2.5-flash) dengan dukungan Multi-Image Visual Few-Shot
    menggunakan foto referensi dari custom_objects dan timeout 25 detik.
    """
    if not api_key:
        return False, "Gemini API Key belum dikonfigurasi."

    clean_model = (model or '').strip() or os.getenv('GEMINI_MODEL', 'gemini-2.5-flash').strip() or 'gemini-2.5-flash'
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{clean_model}:generateContent"
    headers = {
        'Content-Type': 'application/json',
        'x-goog-api-key': api_key
    }

    parts = []

    # 1. Foto & Teks Referensi Database Terverifikasi (Visual Few-Shot)
    if references:
        intro_text = (
            "Berikut adalah foto referensi objek terverifikasi dari database lokal pengguna. "
            "Bandingkan foto target kamera dengan referensi berikut terlebih dahulu. "
            "Jika cocok, wajib gunakan nama & ciri referensi tersebut. "
            "Jika tidak cocok dengan referensi mana pun, analisis objek secara normal sesuai kenyataan."
        )
        parts.append({"text": intro_text})

        for idx, ref in enumerate(references[:3], start=1):
            ref_label = ref.get('label_name', '')
            ref_cat = ref.get('category', 'umum')
            ref_notes = ref.get('notes') or '-'
            ref_text = f"[REFERENSI #{idx}] Nama: {ref_label} | Kategori: {ref_cat} | Ciri Khusus: {ref_notes}"
            parts.append({"text": ref_text})

            ref_img_b64 = ref.get('image_b64')
            if ref_img_b64:
                clean_ref_b64 = re.sub(r'^data:image/[^;]+;base64,', '', str(ref_img_b64).strip(), flags=re.IGNORECASE).strip()
                missing_pad = len(clean_ref_b64) % 4
                if missing_pad:
                    clean_ref_b64 += '=' * (4 - missing_pad)
                parts.append({
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": clean_ref_b64
                    }
                })

    # 2. Foto Target Kamera & Prompt Utama Analisis (Pembersihan Base64 Defensif)
    camera_target_intro = "[FOTO TARGET KAMERA SAAT INI]\n" + prompt
    if image_b64:
        clean_b64 = re.sub(r'^data:image/[^;]+;base64,', '', str(image_b64).strip(), flags=re.IGNORECASE).strip()
        missing_padding = len(clean_b64) % 4
        if missing_padding:
            clean_b64 += '=' * (4 - missing_padding)
        parts.append({
            "text": camera_target_intro + "\nAnalisa juga secara visual dari foto terlampir: sebutkan kondisi, perkiraan ukuran, dan konteks dalam Bahasa Indonesia."
        })
        parts.append({
            "inline_data": {
                "mime_type": "image/jpeg",
                "data": clean_b64
            }
        })
    else:
        parts.append({"text": camera_target_intro})

    payload = {
        "contents": [{"parts": parts}]
    }

    if system_prompt:
        payload["system_instruction"] = {
            "parts": [{"text": system_prompt[:600]}]
        }

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=25)
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

        try:
            err_data = resp.json()
            err_msg = err_data.get('error', {}).get('message') or str(err_data)
        except Exception:
            err_msg = resp.text[:200]
        clean_msg = _mask_in_text(err_msg, api_key)
        return False, f"HTTP {resp.status_code}: {clean_msg}"
    except Exception as e:
        clean_err = _mask_in_text(str(e), api_key)
        return False, f"Koneksi gagal: {clean_err}"

def _call_deepseek_text(
    api_key: str,
    system_prompt: Optional[str],
    user_prompt: str,
    references: Optional[List[Dict[str, Any]]] = None,
    model: Optional[str] = None
) -> Tuple[bool, str]:
    """
    Memanggil DeepSeek Chat API dengan penyertaan konteks ringkasan kamus objek
    lokal jika referensi tersedia, dengan timeout 20 detik.
    """
    if not api_key:
        return False, "DeepSeek API Key belum dikonfigurasi."

    url = os.getenv('DEEPSEEK_API_URL', 'https://api.deepseek.com/chat/completions')
    clean_model = (model or '').strip() or os.getenv('DEEPSEEK_MODEL', 'deepseek-chat').strip() or 'deepseek-chat'
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}'
    }

    # Sisipkan ringkasan kamus teks referensi jika tersedia
    enhanced_user_prompt = user_prompt
    if references:
        ref_lines = []
        for idx, ref in enumerate(references[:3], start=1):
            ref_label = ref.get('label_name', '')
            ref_cat = ref.get('category', 'umum')
            ref_notes = ref.get('notes') or '-'
            ref_lines.append(f"• Referensi #{idx}: Nama='{ref_label}', Kategori='{ref_cat}', Ciri='{ref_notes}'")
        ref_context = (
            "\n\n[Kamus Objek Terverifikasi Database Pengguna]\n" +
            "\n".join(ref_lines) +
            "\nJika objek yang terdeteksi mirip atau cocok dengan referensi di atas, prioritaskan menyebutkan nama dan karakteristik tersebut."
        )
        enhanced_user_prompt += ref_context

    payload = {
        "model": clean_model,
        "messages": [
            {"role": "system", "content": (system_prompt or "Anda adalah asisten AI Benggala.")[:600]},
            {"role": "user", "content": enhanced_user_prompt}
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

        try:
            err_data = resp.json()
            err_obj = err_data.get('error', {})
            err_msg = err_obj.get('message') if isinstance(err_obj, dict) else str(err_obj)
            if not err_msg:
                err_msg = str(err_data)
        except Exception:
            err_msg = resp.text[:200]
        clean_msg = _mask_in_text(err_msg, api_key)
        return False, f"HTTP {resp.status_code}: {clean_msg}"
    except Exception as e:
        clean_err = _mask_in_text(str(e), api_key)
        return False, f"Koneksi gagal: {clean_err}"

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
    # 1. Path Absolut Direktori Penyimpanan
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    snapshot_dir = os.path.join(base_dir, 'uploads', 'snapshots')
    os.makedirs(snapshot_dir, exist_ok=True)

    # 2. Payload & Ekstraksi Base64 Defensif
    data = request.get_json(silent=True) or {}
    raw_image = str(data.get('image') or data.get('image_data') or data.get('snapshot') or '').strip()

    if not raw_image:
        current_app.logger.warning("Snapshot save failed: payload missing image data")
        return jsonify({
            "status": "error",
            "error_stage": "payload",
            "message": "Data gambar (Base64) wajib disertakan."
        }), 400

    clean_b64 = re.sub(r'^data:image/[^;]+;base64,', '', raw_image, flags=re.IGNORECASE).strip()
    missing_padding = len(clean_b64) % 4
    if missing_padding:
        clean_b64 += '=' * (4 - missing_padding)

    try:
        img_bytes = base64.b64decode(clean_b64)
    except Exception:
        current_app.logger.exception("Snapshot save failed: base64 decode error")
        return jsonify({
            "status": "error",
            "error_stage": "payload",
            "message": "Format Base64 gambar tidak valid."
        }), 400

    if len(img_bytes) > 10 * 1024 * 1024:
        current_app.logger.warning("Snapshot save failed: image exceeds 10MB limit")
        return jsonify({
            "status": "error",
            "error_stage": "payload",
            "message": "Ukuran gambar melebihi batas maksimal 10MB."
        }), 413

    # 3. Anti-Crash Pillow (Verifikasi + Buka Ulang + Konversi RGB + Resize Maks 1280x1280)
    try:
        with Image.open(io.BytesIO(img_bytes)) as test_img:
            test_img.verify()
    except Exception:
        current_app.logger.exception("Snapshot save failed: pillow verify error")
        return jsonify({
            "status": "error",
            "error_stage": "pillow",
            "message": "Data yang dikirim bukan format gambar yang valid."
        }), 400

    try:
        img = Image.open(io.BytesIO(img_bytes))
        img = img.convert('RGB')
        resample_filter = getattr(Image, 'Resampling', Image).LANCZOS
        img.thumbnail((1280, 1280), resample_filter)
    except Exception:
        current_app.logger.exception("Snapshot save failed: pillow process/convert error")
        return jsonify({
            "status": "error",
            "error_stage": "pillow",
            "message": "Gagal memproses gambar melalui engine Pillow."
        }), 400

    # 4. Penyimpanan Berkas Gambar ke Disk
    try:
        now_str = datetime.now().strftime('%Y%m%d_%H%M%S')
        hex_suffix = secrets.token_hex(2)
        filename = f"snap_{now_str}_{hex_suffix}.jpg"
        target_path = os.path.join(snapshot_dir, filename)
        img.save(target_path, 'JPEG', quality=84)
    except Exception:
        current_app.logger.exception("Snapshot save failed: disk write error")
        return jsonify({
            "status": "error",
            "error_stage": "disk",
            "message": "Gagal menyimpan berkas gambar ke disk."
        }), 500

    # 5. Parsing Data Objek & Integrasi Notifikasi Telegram (jika mode CCTV)
    objects_data = data.get('objects') or data.get('object_name') or data.get('detected_objects') or []
    if isinstance(objects_data, list):
        objects_str = json.dumps(objects_data, ensure_ascii=False)
        object_count = len(objects_data)
    elif isinstance(objects_data, str) and objects_data.strip():
        objects_str = objects_data.strip()
        object_count = 1
    else:
        objects_str = "[]"
        object_count = 0

    confidence_val = data.get('confidence')
    try:
        confidence_val = float(confidence_val) if confidence_val is not None else 0.0
    except (ValueError, TypeError):
        confidence_val = 0.0

    is_cctv = bool(data.get('is_cctv'))
    ai_provider = data.get('ai_provider') or data.get('provider')
    ai_analysis = data.get('ai_analysis') or data.get('analysis')

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

    # 6. Kecocokan Kolom MySQL Dinamis & Pencatatan ke Database
    rel_path = f"uploads/snapshots/{filename}"
    try:
        actual_cols = set()
        try:
            cols_raw = db_fetch_all("SHOW COLUMNS FROM detection_logs")
            if cols_raw:
                actual_cols = {col['Field'] for col in cols_raw if 'Field' in col}
        except Exception as col_err:
            current_app.logger.warning(f"Failed to inspect detection_logs columns: {col_err}")

        candidate_map = {
            'filename': filename,
            'file_path': rel_path,
            'detected_objects': objects_str,
            'objects_json': objects_str,
            'object_count': object_count,
            'confidence': confidence_val,
            'is_cctv': 1 if is_cctv else 0,
            'telegram_sent': 1 if telegram_sent else 0,
            'ai_provider': ai_provider or None,
            'analysis_result': ai_analysis or None,
            'llm_provider': ai_provider or None,
            'llm_analysis': ai_analysis or None
        }

        if actual_cols:
            insert_cols = [col for col in candidate_map if col in actual_cols]
        else:
            insert_cols = ['filename', 'file_path', 'detected_objects', 'object_count']

        if not insert_cols:
            insert_cols = ['filename']

        col_names = ", ".join(insert_cols)
        placeholders = ", ".join(["%s"] * len(insert_cols))
        sql = f"INSERT INTO detection_logs ({col_names}) VALUES ({placeholders})"
        values = tuple(candidate_map[col] for col in insert_cols)
        log_id = db_execute(sql, values)
    except Exception:
        current_app.logger.exception("Snapshot save failed: database insert error")
        return jsonify({
            "status": "error",
            "error_stage": "database",
            "message": "Gagal mencatat data snapshot ke database."
        }), 500

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

    # Kredensial AI dari settings mentah (fallback ke environment jika kosong/dummy/masked)
    gemini_key = _clean_api_key(settings.get('gemini_api_key'), 'GEMINI_API_KEY')
    deepseek_key = _clean_api_key(settings.get('deepseek_api_key'), 'DEEPSEEK_API_KEY')

    # Validasi jika kedua API Key tidak tersedia
    if not gemini_key and not deepseek_key:
        return jsonify({
            "status": "error",
            "error_stage": "config",
            "message": "API Key Gemini/DeepSeek belum diisi di Pengaturan"
        }), 400

    gemini_model = (settings.get('gemini_model') or os.getenv('GEMINI_MODEL') or 'gemini-2.5-flash').strip()
    deepseek_model = (settings.get('deepseek_model') or os.getenv('DEEPSEEK_MODEL') or 'deepseek-chat').strip()

    default_provider = (settings.get('llm_provider') or settings.get('llm_default_provider') or os.getenv('LLM_DEFAULT_PROVIDER') or 'gemini').lower()
    requested_provider = (payload.get('provider') or default_provider).lower()

    # Prioritaskan provider yang memiliki key jika salah satu belum diisi
    if requested_provider == 'gemini' and not gemini_key and deepseek_key:
        primary = 'deepseek'
        secondary = 'gemini'
    elif requested_provider == 'deepseek' and not deepseek_key and gemini_key:
        primary = 'gemini'
        secondary = 'deepseek'
    else:
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
    custom_label = (payload.get('custom_label') or '').strip()
    mission_category = (payload.get('mission_category') or '').strip()

    # Ambil sampel referensi visual (maksimal 3) dari custom_objects secara terisolasi aman
    references = _get_reference_samples(
        custom_label=custom_label,
        objects_text=user_prompt,
        category=mission_category,
        limit=3
    )

    log_id = payload.get('log_id')
    try:
        log_id = int(log_id) if log_id else None
    except (ValueError, TypeError):
        log_id = None

    # 1. Jalankan Provider Utama
    fallback_triggered = False
    used_provider = primary
    error_gemini = None
    error_deepseek = None

    if primary == 'gemini':
        success, result_text = _call_gemini_vision(gemini_key, user_prompt, image_b64, system_prompt, references=references, model=gemini_model)
        if not success:
            error_gemini = result_text
    else:
        success, result_text = _call_deepseek_text(deepseek_key, system_prompt, user_prompt, references=references, model=deepseek_model)
        if not success:
            error_deepseek = result_text

    if not success:
        current_app.logger.warning(f"AI Provider primer ({primary}) gagal: {result_text}")

    # 2. Jika Provider Utama Gagal, Jalankan Provider Cadangan (Auto-Fallback)
    if not success:
        fallback_triggered = True
        used_provider = secondary
        if secondary == 'gemini':
            success, result_text = _call_gemini_vision(gemini_key, user_prompt, image_b64, system_prompt, references=references, model=gemini_model)
            if not success:
                error_gemini = result_text
        else:
            success, result_text = _call_deepseek_text(deepseek_key, system_prompt, user_prompt, references=references, model=deepseek_model)
            if not success:
                error_deepseek = result_text

        if not success:
            current_app.logger.warning(f"AI Provider cadangan ({secondary}) gagal: {result_text}")

    # 3. Jika Kedua Provider Gagal, Kembalikan HTTP 502 dengan Pesan Terstruktur
    if not success:
        err_gemini_str = error_gemini or "Tidak dijalankan / Key tidak tersedia"
        err_deepseek_str = error_deepseek or "Tidak dijalankan / Key tidak tersedia"
        combined_msg = f"Gemini: {err_gemini_str} | DeepSeek: {err_deepseek_str}"
        current_app.logger.error(f"Semua provider AI gagal: {combined_msg}")
        return jsonify({
            "status": "error",
            "error_stage": "ai_all_failed",
            "message": combined_msg,
            "error_details": {
                "gemini": err_gemini_str,
                "deepseek": err_deepseek_str
            },
            "fallback_triggered": True
        }), 502

    # 4. Jika ada log_id, update record detection_logs secara aman (adaptif terhadap kolom DB)
    if log_id and log_id > 0:
        try:
            cols_raw = db_fetch_all("SHOW COLUMNS FROM detection_logs") or []
            avail_cols = {c['Field'] for c in cols_raw if 'Field' in c}

            set_parts = []
            set_vals = []
            if 'llm_provider' in avail_cols:
                set_parts.append("llm_provider = %s")
                set_vals.append(used_provider)
            if 'llm_analysis' in avail_cols:
                set_parts.append("llm_analysis = %s")
                set_vals.append(result_text)
            if 'ai_provider' in avail_cols:
                set_parts.append("ai_provider = %s")
                set_vals.append(used_provider)
            if 'analysis_result' in avail_cols:
                set_parts.append("analysis_result = %s")
                set_vals.append(result_text)

            if set_parts:
                sql_update = f"UPDATE detection_logs SET {', '.join(set_parts)} WHERE id = %s"
                set_vals.append(log_id)
                db_execute(sql_update, tuple(set_vals))
        except Exception as e:
            current_app.logger.warning(f"Gagal memperbarui analysis pada log_id {log_id}: {e}")

    is_php_path = request.path.endswith('.php')
    status_str = "success" if is_php_path else "ok"

    ref_labels = [r.get('label_name', '') for r in references]

    return jsonify({
        "status": status_str,
        "success": True,
        "provider": used_provider,
        "provider_used": used_provider,
        "analysis": result_text,
        "fallback_triggered": fallback_triggered,
        "log_id": log_id,
        "references_used": len(references),
        "reference_labels": ref_labels
    }), 200

# -----------------------------------------------------------------------------
# 2B. POST /api/ai/quick-detail (Profil Terstruktur Kartu AR Cepat < 2 Detik)
# -----------------------------------------------------------------------------
@ai_snapshot_bp.route('/api/ai/quick-detail', methods=['POST'])
@require_api_security(max_requests=25, window_seconds=60)
def quick_detail_ai():
    """
    Endpoint AI ultra-cepat untuk menghasilkan profil terstruktur kartu AR (JSON murni).
    Didukung Gemini Vision (jika foto frame ada) dengan fallback otomatis ke DeepSeek.
    """
    payload = request.get_json(silent=True) or {}
    raw_label = str(payload.get('label') or '').strip()
    if not raw_label:
        return jsonify({
            "status": "error",
            "message": "Parameter 'label' wajib diisi."
        }), 400

    clean_label = raw_label[:80].strip()
    image_b64 = payload.get('image')
    if image_b64:
        image_b64 = re.sub(r'^data:image/[^;]+;base64,', '', str(image_b64).strip(), flags=re.IGNORECASE).strip()
        missing_pad = len(image_b64) % 4
        if missing_pad:
            image_b64 += '=' * (4 - missing_pad)

    settings = get_all_settings()
    gemini_key = _clean_api_key(settings.get('gemini_api_key'), 'GEMINI_API_KEY')
    deepseek_key = _clean_api_key(settings.get('deepseek_api_key'), 'DEEPSEEK_API_KEY')

    if not gemini_key and not deepseek_key:
        return jsonify({
            "status": "error",
            "message": "API Key Gemini/DeepSeek belum dikonfigurasi di Pengaturan."
        }), 400

    gemini_model = (settings.get('gemini_model') or os.getenv('GEMINI_MODEL') or 'gemini-2.5-flash').strip()
    deepseek_model = (settings.get('deepseek_model') or os.getenv('DEEPSEEK_MODEL') or 'deepseek-chat').strip()

    prompt_text = (
        f"Analisis objek '{clean_label}' secara presisi dan ringkas.\n"
        "Wajib kembalikan HANYA JSON murni (dilarang ada teks atau markdown lain di luar objek JSON) "
        "dengan struktur persis seperti ini:\n"
        "{\n"
        '  "title": "Nama spesifik objek dalam Bahasa Indonesia (maks 4 kata)",\n'
        '  "category": "BARANG | HEWAN | TUMBUHAN | MAKANAN | ELEKTRONIK | KENDARAAN | UMUM",\n'
        '  "utility": "Kegunaan atau peran utamanya (maks 14 kata)",\n'
        '  "detail": "Asal, material, proses pembuatan, atau habitat khasnya (maks 16 kata)",\n'
        '  "extra_tip": "Fakta unik, cara pakai, atau perkiraan kondisi visual (maks 14 kata)",\n'
        '  "safety": "aman | waspada | bahaya",\n'
        '  "safetyNote": "Catatan keamanan singkat (maks 8 kata)"\n'
        "}"
    )

    system_prompt = "Anda adalah AI analitik Benggala OS yang selalu merespons HANYA dengan JSON valid bahasa Indonesia."

    raw_response = ""
    provider_used = "gemini"

    # 1. Coba Gemini Vision terlebih dahulu jika API Key tersedia
    if gemini_key:
        success, res = _call_gemini_vision(
            api_key=gemini_key,
            prompt=prompt_text,
            image_b64=image_b64,
            system_prompt=system_prompt,
            references=None,
            model=gemini_model
        )
        if success:
            raw_response = res
            provider_used = "gemini"
        elif deepseek_key:
            # Fallback ke DeepSeek jika Gemini limit/gagal
            success_ds, res_ds = _call_deepseek_text(
                api_key=deepseek_key,
                system_prompt=system_prompt,
                user_prompt=prompt_text,
                references=None,
                model=deepseek_model
            )
            if success_ds:
                raw_response = res_ds
                provider_used = "deepseek"
            else:
                raw_response = res
    elif deepseek_key:
        success_ds, res_ds = _call_deepseek_text(
            api_key=deepseek_key,
            system_prompt=system_prompt,
            user_prompt=prompt_text,
            references=None,
            model=deepseek_model
        )
        if success_ds:
            raw_response = res_ds
            provider_used = "deepseek"
        else:
            return jsonify({
                "status": "error",
                "message": f"DeepSeek gagal: {res_ds}"
            }), 502

    # 2. Parsing JSON Defensif
    parsed_data = None
    try:
        cleaned_json = raw_response.strip()
        cleaned_json = re.sub(r'^```(?:json)?\s*', '', cleaned_json, flags=re.IGNORECASE)
        cleaned_json = re.sub(r'\s*```$', '', cleaned_json)
        m = re.search(r'\{[\s\S]*\}', cleaned_json)
        if m:
            parsed_data = json.loads(m.group(0))
    except Exception:
        parsed_data = None

    if not isinstance(parsed_data, dict):
        # Fallback aman jika model tidak mengembalikan struktur JSON sempurna
        parsed_data = {
            "title": clean_label.title(),
            "category": "UMUM",
            "utility": f"Objek visual teridentifikasi sebagai {clean_label}.",
            "detail": raw_response[:90].strip() if raw_response else "Hasil identifikasi visual real-time.",
            "extra_tip": "Analisis live real-time Benggala OS.",
            "safety": "aman",
            "safetyNote": "Amati objek dengan saksama."
        }

    # Normalisasi field
    category_raw = str(parsed_data.get("category") or "UMUM").upper()
    valid_categories = ('BARANG', 'HEWAN', 'TUMBUHAN', 'MAKANAN', 'ELEKTRONIK', 'KENDARAAN', 'DEKORASI', 'MANUSIA', 'UMUM')
    category_clean = category_raw if category_raw in valid_categories else 'UMUM'

    safety_raw = str(parsed_data.get("safety") or "aman").lower().strip()
    safety_clean = safety_raw if safety_raw in ('aman', 'waspada', 'bahaya') else 'aman'

    data_out = {
        "title": str(parsed_data.get("title") or clean_label.title())[:40],
        "category": category_clean,
        "utility": str(parsed_data.get("utility") or f"Objek teridentifikasi {clean_label}.")[:150],
        "detail": str(parsed_data.get("detail") or "Data visual diproses AI.")[:180],
        "extra_tip": str(parsed_data.get("extra_tip") or "")[:150],
        "safety": safety_clean,
        "safetyNote": str(parsed_data.get("safetyNote") or "Amati secara saksama.")[:60],
        "source": "AI LIVE"
    }

    return jsonify({
        "status": "ok",
        "provider": provider_used,
        "data": data_out
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
