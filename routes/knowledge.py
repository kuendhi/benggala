import os
import io
import json
import base64
import secrets
from datetime import datetime
from typing import Optional, List, Dict, Any
from PIL import Image
from flask import Blueprint, request, jsonify, current_app
from core.database import db_execute, db_fetch_all, db_fetch_one, init_knowledge_table
from core.security import require_api_security, sanitize_filename

knowledge_bp = Blueprint('knowledge', __name__)

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
KNOWLEDGE_DIR = os.path.join(PROJECT_ROOT, 'uploads', 'knowledge')

# Inisialisasi tabel custom_objects jika belum ada saat modul dimuat
try:
    init_knowledge_table()
except Exception:
    pass


# -----------------------------------------------------------------------------
# 1. GET /api/knowledge/list (Ambil Sampel Pengetahuan Objek)
# -----------------------------------------------------------------------------
@knowledge_bp.route('/api/knowledge/list', methods=['GET'])
def list_knowledge():
    """
    Mengambil daftar sampel dari tabel custom_objects (ORDER BY created_at DESC LIMIT 200).
    Mendukung query parameter ?include_vectors=1 untuk menyertakan embedding JSON terurai.
    """
    try:
        init_knowledge_table()
    except Exception:
        pass

    include_vectors = request.args.get('include_vectors', '0').strip().lower() in ('1', 'true', 'yes')

    try:
        if include_vectors:
            sql = """
            SELECT id, label_name, category, notes, image_path, embedding_json, created_at
            FROM custom_objects
            ORDER BY created_at DESC
            LIMIT 200
            """
        else:
            sql = """
            SELECT id, label_name, category, notes, image_path, created_at
            FROM custom_objects
            ORDER BY created_at DESC
            LIMIT 200
            """
        rows = db_fetch_all(sql) or []
    except Exception as e:
        current_app.logger.error(f"Error fetching custom_objects: {e}")
        return jsonify({"status": "ok", "count": 0, "data": []})

    formatted_rows = []
    for row in rows:
        created_at = row.get('created_at')
        if isinstance(created_at, datetime):
            created_str = created_at.strftime('%Y-%m-%d %H:%M:%S')
        elif created_at:
            created_str = str(created_at)
        else:
            created_str = ''

        item = {
            "id": row.get('id'),
            "label_name": row.get('label_name', ''),
            "category": row.get('category', 'umum'),
            "notes": row.get('notes', ''),
            "image_path": row.get('image_path', ''),
            "created_at": created_str
        }

        if include_vectors:
            emb_raw = row.get('embedding_json')
            embedding_list = []
            if emb_raw:
                try:
                    embedding_list = json.loads(emb_raw)
                except Exception:
                    embedding_list = []
            item['embedding'] = embedding_list

        formatted_rows.append(item)

    return jsonify({
        "status": "ok",
        "count": len(formatted_rows),
        "data": formatted_rows
    })


# -----------------------------------------------------------------------------
# 2. POST /api/knowledge/save (Simpan Objek Latih & Vektor Embedding)
# -----------------------------------------------------------------------------
@knowledge_bp.route('/api/knowledge/save', methods=['POST'])
@require_api_security(max_requests=30, window_seconds=60)
def save_knowledge():
    """
    Menyimpan sampel koreksi / pelatihan objek baru:
    - label_name: nama kelas objek (2-80 karakter)
    - category: kategori / domain (default 'umum', maks 50 karakter)
    - notes: catatan ciri khusus (maks 250 karakter)
    - image: Base64 data URL JPEG/PNG thumbnail objek (maks 1 MB)
    - embedding: list numerik (float) berukuran 128 - 2048
    """
    payload = request.get_json(silent=True) or {}

    # 1. Validasi label_name
    label_name = (payload.get('label_name') or '').strip()
    if not label_name or len(label_name) < 2 or len(label_name) > 80:
        return jsonify({
            "status": "error",
            "message": "label_name wajib diisi dengan panjang antara 2 hingga 80 karakter"
        }), 400

    # 2. Validasi category & notes
    category = (payload.get('category') or 'umum').strip()[:50] or 'umum'
    notes = (payload.get('notes') or '').strip()[:250]

    # 3. Validasi embedding vector (MobileNet output)
    embedding = payload.get('embedding')
    if not isinstance(embedding, list) or len(embedding) < 128 or len(embedding) > 2048:
        return jsonify({
            "status": "error",
            "message": "embedding harus berupa list numerik dengan panjang antara 128 hingga 2048 elemen"
        }), 400

    if not all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in embedding):
        return jsonify({
            "status": "error",
            "message": "Semua elemen embedding harus berupa angka (int/float)"
        }), 400

    # 4. Validasi dan Pemrosesan Gambar Aman
    image_data = payload.get('image')
    if not image_data or not isinstance(image_data, str):
        return jsonify({
            "status": "error",
            "message": "image wajib disertakan dalam format Base64 Data URL"
        }), 400

    raw = image_data.strip()
    if ',' in raw:
        raw = raw.split(',', 1)[1]

    try:
        img_bytes = base64.b64decode(raw)
    except Exception:
        return jsonify({
            "status": "error",
            "message": "Format Base64 gambar tidak valid"
        }), 400

    if len(img_bytes) > 1 * 1024 * 1024:
        return jsonify({
            "status": "error",
            "message": "Ukuran gambar melebihi batas maksimal 1 MB"
        }), 400

    save_path = None
    try:
        # Verifikasi struktur berkas gambar
        verify_img = Image.open(io.BytesIO(img_bytes))
        verify_img.verify()

        # Buka ulang untuk manipulasi & resize
        img = Image.open(io.BytesIO(img_bytes))
        if img.mode != 'RGB':
            img = img.convert('RGB')

        resampling_filter = getattr(Image, 'Resampling', Image).LANCZOS if hasattr(getattr(Image, 'Resampling', None), 'LANCZOS') else getattr(Image, 'ANTIALIAS', Image.BICUBIC)
        img.thumbnail((320, 320), resampling_filter)

        os.makedirs(KNOWLEDGE_DIR, exist_ok=True)
        now_str = datetime.now().strftime('%Y%m%d_%H%M%S')
        rand_hex = secrets.token_hex(2)
        filename = f"know_{now_str}_{rand_hex}.jpg"
        save_path = os.path.join(KNOWLEDGE_DIR, filename)

        img.save(save_path, format='JPEG', quality=82, optimize=True)
        rel_path = f"uploads/knowledge/{filename}"
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Gagal memproses gambar thumbnail: {str(e)}"
        }), 400

    # 5. Simpan ke database MySQL
    try:
        init_knowledge_table()
        embedding_json = json.dumps(embedding)
        sql = """
        INSERT INTO custom_objects (label_name, category, notes, image_path, embedding_json)
        VALUES (%s, %s, %s, %s, %s)
        """
        new_id = db_execute(sql, (label_name, category, notes, rel_path, embedding_json))
        return jsonify({
            "status": "ok",
            "id": new_id,
            "label_name": label_name,
            "image_path": rel_path
        })
    except Exception as e:
        if save_path and os.path.exists(save_path):
            try:
                os.remove(save_path)
            except Exception:
                pass
        current_app.logger.error(f"Gagal menyimpan custom_objects: {e}")
        return jsonify({
            "status": "error",
            "message": f"Gagal menyimpan ke database: {str(e)}"
        }), 500


# -----------------------------------------------------------------------------
# 3. POST /api/knowledge/delete (Hapus Sampel Pengetahuan Objek)
# -----------------------------------------------------------------------------
@knowledge_bp.route('/api/knowledge/delete', methods=['POST'])
@require_api_security(max_requests=20, window_seconds=60)
def delete_knowledge():
    """
    Menghapus sampel pengetahuan objek berdasarkan ID atau label_name.
    File gambar fisik di uploads/knowledge/ akan dihapus secara aman.
    """
    payload = request.get_json(silent=True) or {}
    item_id = payload.get('id')
    label_name = payload.get('label_name')

    if not item_id and not label_name:
        return jsonify({
            "status": "error",
            "message": "id atau label_name wajib disertakan"
        }), 400

    try:
        init_knowledge_table()
    except Exception:
        pass

    records = []
    if item_id:
        try:
            item_id = int(item_id)
        except (ValueError, TypeError):
            return jsonify({
                "status": "error",
                "message": "id harus berupa angka integer valid"
            }), 400
        records = db_fetch_all("SELECT id, image_path FROM custom_objects WHERE id = %s", (item_id,))
    elif label_name:
        clean_label = str(label_name).strip()
        records = db_fetch_all("SELECT id, image_path FROM custom_objects WHERE label_name = %s", (clean_label,))

    if not records:
        return jsonify({
            "status": "error",
            "message": "Data objek latih tidak ditemukan"
        }), 404

    # Hapus file gambar fisik terkait dengan sanitasi anti path traversal
    for rec in records:
        img_p = rec.get('image_path')
        if img_p:
            safe_name = sanitize_filename(os.path.basename(img_p))
            full_path = os.path.join(KNOWLEDGE_DIR, safe_name)
            if os.path.exists(full_path):
                try:
                    os.remove(full_path)
                except Exception as e:
                    current_app.logger.warning(f"Gagal menghapus file gambar {full_path}: {e}")

    # Hapus rekaman dari database
    try:
        if item_id:
            db_execute("DELETE FROM custom_objects WHERE id = %s", (item_id,))
        elif label_name:
            db_execute("DELETE FROM custom_objects WHERE label_name = %s", (str(label_name).strip(),))
    except Exception as e:
        current_app.logger.error(f"Gagal menghapus dari custom_objects: {e}")
        return jsonify({
            "status": "error",
            "message": f"Gagal menghapus data dari database: {str(e)}"
        }), 500

    return jsonify({
        "status": "ok",
        "message": "Data objek latih berhasil dihapus"
    })
