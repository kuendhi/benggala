import os
import io
import json
import base64
from datetime import datetime
from PIL import Image
from fpdf import FPDF
from flask import Blueprint, request, jsonify, Response, current_app
from core.database import db_fetch_one
from core.security import require_api_security, sanitize_filename

python_power_bp = Blueprint('python_power', __name__)

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
SNAPSHOTS_DIR = os.path.join(PROJECT_ROOT, 'uploads', 'snapshots')

# -----------------------------------------------------------------------------
# Helper: Sanitasi Teks untuk FPDF2 (Anti UnicodeEncodeError pada Font Latin-1)
# -----------------------------------------------------------------------------
def _safe_pdf_text(text: str) -> str:
    """
    Membersihkan teks dari karakter emoji / non-Latin-1 agar font Helvetica bawaan
    fpdf2 tidak pernah mengalami UnicodeEncodeError.
    """
    if not text:
        return ""
    replacements = {
        '•': '-',
        '—': '-',
        '–': '-',
        '“': '"',
        '”': '"',
        '‘': "'",
        '’': "'",
        '…': '...',
        '🚨': '[ALERT]',
        '🕒': '[WAKTU]',
        '🔍': '[LIHAT]',
        '🤖': '[AI]',
        '✈️': '[TELEGRAM]',
        '📸': '[FOTO]',
        '📋': '[LAPORAN]',
        '✨': '[VISION]',
        '🎨': '[HSV]'
    }
    for k, v in replacements.items():
        text = text.replace(k, v)
    return text.encode('latin-1', 'ignore').decode('latin-1')

# -----------------------------------------------------------------------------
# 1. POST /api/python/hsv-color (Analisis Warna HSV & Kematangan Tanpa OpenCV)
# -----------------------------------------------------------------------------
@python_power_bp.route('/api/python/hsv-color', methods=['POST'])
@require_api_security(max_requests=20, window_seconds=60)
def analyze_hsv_color():
    """
    Menganalisis warna dominan, kematangan visual, dan skor kualitas menggunakan
    ruang warna HSV matematis berbasis Pillow murni tanpa dependensi OpenCV/NumPy berat.
    """
    payload = request.get_json(silent=True) or {}
    img = None

    if payload.get('image'):
        raw = str(payload['image']).strip()
        if ',' in raw:
            raw = raw.split(',', 1)[1]
        try:
            img_bytes = base64.b64decode(raw)
            img = Image.open(io.BytesIO(img_bytes))
        except Exception:
            return jsonify({
                "status": "error",
                "message": "Format data gambar Base64 tidak valid."
            }), 400

    elif payload.get('image_path'):
        raw_fname = os.path.basename(str(payload['image_path']))
        clean_fname = sanitize_filename(raw_fname)
        full_path = os.path.join(SNAPSHOTS_DIR, clean_fname)
        if not os.path.isfile(full_path):
            return jsonify({
                "status": "error",
                "message": "Berkas foto snapshot tidak ditemukan di server."
            }), 404
        try:
            img = Image.open(full_path)
        except Exception:
            return jsonify({
                "status": "error",
                "message": "Gagal membuka berkas gambar."
            }), 400
    else:
        return jsonify({
            "status": "error",
            "message": "Parameter image (Base64) atau image_path wajib disertakan."
        }), 400

    try:
        # Konversi ke mode RGB
        if img.mode != 'RGB':
            img = img.convert('RGB')

        # 50% Center Crop agar fokus pada objek utama
        w, h = img.size
        left = int(w * 0.25)
        top = int(h * 0.25)
        right = int(w * 0.75)
        bottom = int(h * 0.75)
        cropped = img.crop((left, top, right, bottom))

        # Perkecil ke 100x100 piksel untuk kalkulasi instan (< 10ms)
        small = cropped.resize((100, 100), Image.Resampling.BILINEAR)

        # Konversi ke ruang warna HSV
        hsv_img = small.convert('HSV')
        pixels = list(hsv_img.getdata())
        n = len(pixels)

        avg_h_raw = sum(p[0] for p in pixels) / n
        avg_s_raw = sum(p[1] for p in pixels) / n
        avg_v_raw = sum(p[2] for p in pixels) / n

        # Konversi ke skala standar: H (0-360 deg), S (0-100%), V (0-100%)
        h_deg = int(round(avg_h_raw * 360.0 / 255.0)) % 360
        s_pct = int(round(avg_s_raw * 100.0 / 255.0))
        v_pct = int(round(avg_v_raw * 100.0 / 255.0))

        # Klasifikasi warna dominan dan estimasi kematangan / kesegaran
        if v_pct < 25:
            dominant_color = "Cokelat-Gelap / Terlalu Gelap (Perlu Cek QC)"
            quality_score = max(10, v_pct)
        elif s_pct < 15:
            dominant_color = "Pucat / Abu-abu (Perlu Cek QC)"
            quality_score = max(15, v_pct)
        elif h_deg >= 345 or h_deg <= 15:
            dominant_color = "Merah (Sangat Matang / Matang Penuh)"
            quality_score = min(100, int(round(s_pct * 0.5 + v_pct * 0.5)))
        elif 16 <= h_deg <= 50:
            dominant_color = "Kuning-Oranye (Matang Optimal)"
            quality_score = min(100, int(round(s_pct * 0.5 + v_pct * 0.5)))
        elif 51 <= h_deg <= 80:
            dominant_color = "Kuning-Kehijauan (Setengah Matang / Mengkal)"
            quality_score = min(100, int(round(s_pct * 0.5 + v_pct * 0.5)))
        elif 81 <= h_deg <= 165:
            dominant_color = "Hijau (Segar / Mentah)"
            quality_score = min(100, int(round(s_pct * 0.5 + v_pct * 0.5)))
        elif 166 <= h_deg <= 260:
            dominant_color = "Biru-Sian (Warna Non-Alami / Perlu Cek)"
            quality_score = min(100, int(round(s_pct * 0.5 + v_pct * 0.5)))
        else:
            dominant_color = "Ungu-Magenta (Matang Khusus / Eksotis)"
            quality_score = min(100, int(round(s_pct * 0.5 + v_pct * 0.5)))

        summary = f"Skor Warna HSV: {quality_score}% • Dominan {dominant_color}"

        return jsonify({
            "status": "ok",
            "dominant_color": dominant_color,
            "hsv": {
                "h": h_deg,
                "s": s_pct,
                "v": v_pct
            },
            "quality_score": quality_score,
            "summary": summary
        }), 200

    except Exception as e:
        current_app.logger.error(f"HSV color analysis error: {e}")
        return jsonify({
            "status": "error",
            "message": "Terjadi kesalahan saat memproses analisis warna HSV."
        }), 500

# -----------------------------------------------------------------------------
# 2. GET /api/python/report-pdf/<int:log_id> (Generator Laporan Forensik PDF)
# -----------------------------------------------------------------------------
@python_power_bp.route('/api/python/report-pdf/<int:log_id>', methods=['GET'])
def generate_forensic_pdf(log_id: int):
    """
    Menghasilkan dokumen PDF A4 resmi siap cetak berisi metadata rekaman, foto bukti,
    dan hasil analisis visual AI menggunakan modul fpdf2 murni.
    """
    row = db_fetch_one("SELECT * FROM detection_logs WHERE id = %s LIMIT 1", (log_id,))
    if not row:
        return jsonify({
            "status": "error",
            "message": "Data log riwayat tidak ditemukan."
        }), 404

    try:
        pdf = FPDF(orientation='P', unit='mm', format='A4')
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.add_page()

        # 1. KOP LAPORAN RESMI
        pdf.set_font('Helvetica', 'B', 18)
        pdf.set_text_color(2, 6, 23) # Dark Navy
        pdf.cell(0, 8, "BENGGALA OS // LAPORAN FORENSIK AI", align='C', new_x='LMARGIN', new_y='NEXT')

        pdf.set_font('Helvetica', 'B', 9)
        pdf.set_text_color(100, 116, 139) # Slate Gray
        pdf.cell(0, 5, "SISTEM DETEKSI VISUAL & ANALISIS SITUASI CERDAS (SPACE COCKPIT OS)", align='C', new_x='LMARGIN', new_y='NEXT')

        pdf.ln(3)
        pdf.set_draw_color(56, 189, 248) # Cyan Accent Line
        pdf.set_line_width(0.8)
        pdf.line(15, pdf.get_y(), 195, pdf.get_y())
        pdf.ln(5)

        # Baris Info Identifikasi Laporan
        pdf.set_font('Helvetica', '', 9)
        pdf.set_text_color(51, 65, 85)
        pdf.cell(90, 6, _safe_pdf_text(f"Nomor Berkas : #BENGGALA-RPT-{log_id:05d}"), align='L')
        pdf.cell(90, 6, _safe_pdf_text(f"Waktu Cetak : {datetime.now().strftime('%d/%m/%Y %H:%M:%S')} WIB"), align='R', new_x='LMARGIN', new_y='NEXT')
        pdf.ln(2)

        # 2. FOTO BUKTI VISUAL
        raw_fname = row.get('filename') or os.path.basename(str(row.get('file_path') or ''))
        clean_fname = sanitize_filename(raw_fname)
        photo_path = os.path.join(SNAPSHOTS_DIR, clean_fname)

        if os.path.isfile(photo_path):
            try:
                with Image.open(photo_path) as im:
                    im_w, im_h = im.size
                
                target_w = 110 # mm
                calc_h = (target_w / im_w) * im_h
                # Batasi tinggi foto maksimal 70mm agar halaman tetap rapi
                if calc_h > 70:
                    calc_h = 70
                    target_w = (calc_h / im_h) * im_w

                x_pos = (210 - target_w) / 2
                cur_y = pdf.get_y()

                # Border foto
                pdf.set_draw_color(203, 213, 225)
                pdf.set_line_width(0.3)
                pdf.rect(x_pos - 1, cur_y - 1, target_w + 2, calc_h + 2)

                pdf.image(photo_path, x=x_pos, y=cur_y, w=target_w, h=calc_h)
                pdf.set_y(cur_y + calc_h + 6)
            except Exception as img_err:
                current_app.logger.warning(f"Gagal menyisipkan foto ke PDF: {img_err}")
                pdf.ln(4)
        else:
            pdf.set_font('Helvetica', 'I', 9)
            pdf.set_text_color(148, 163, 184)
            pdf.cell(0, 8, "[Foto bukti fisik tidak ditemukan pada penyimpanan server]", align='C', new_x='LMARGIN', new_y='NEXT')
            pdf.ln(2)

        # 3. TABEL METADATA REKAMAN
        pdf.set_font('Helvetica', 'B', 11)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(0, 7, "I. METADATA DETEKSI", new_x='LMARGIN', new_y='NEXT')

        # Parsing objek terdeteksi
        raw_objs = row.get('detected_objects')
        obj_summary = "-"
        if raw_objs:
            try:
                parsed = json.loads(raw_objs) if isinstance(raw_objs, str) else raw_objs
                if isinstance(parsed, list):
                    labels = []
                    for it in parsed:
                        if isinstance(it, dict):
                            name = it.get('name_id') or it.get('name') or it.get('class') or 'Objek'
                            size = f" ({it['ukuran']})" if it.get('ukuran') else ""
                            labels.append(f"{name}{size}")
                        else:
                            labels.append(str(it))
                    if labels:
                        obj_summary = ", ".join(labels)
                else:
                    obj_summary = str(parsed)
            except Exception:
                obj_summary = str(raw_objs)

        table_data = [
            ("Objek Terdeteksi", obj_summary),
            ("Jumlah Objek", f"{row.get('object_count', 0)} Objek"),
            ("Mode Rekaman", "CCTV Surveillance" if row.get('is_cctv') else "Manual / Auto-Lock"),
            ("Provider AI", str(row.get('ai_provider') or row.get('llm_provider') or 'Default').upper()),
            ("Waktu Kejadian", str(row.get('created_at', '-'))),
            ("Nama Berkas Foto", clean_fname or "-")
        ]

        pdf.set_font('Helvetica', '', 9)
        pdf.set_draw_color(226, 232, 240)
        pdf.set_fill_color(248, 250, 252)

        for label, val in table_data:
            pdf.set_font('Helvetica', 'B', 9)
            pdf.set_text_color(71, 85, 105)
            pdf.cell(50, 6.5, _safe_pdf_text(label), border=1, fill=True)

            pdf.set_font('Helvetica', '', 9)
            pdf.set_text_color(15, 23, 42)
            pdf.cell(130, 6.5, _safe_pdf_text(val), border=1, new_x='LMARGIN', new_y='NEXT')

        pdf.ln(5)

        # 4. KOTAK HASIL ANALISIS VISUAL AI
        pdf.set_font('Helvetica', 'B', 11)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(0, 7, "II. RINGKASAN ANALISIS VISUAL AI", new_x='LMARGIN', new_y='NEXT')

        ai_analysis_text = row.get('analysis_result') or row.get('llm_analysis') or "Belum ada analisis Vision AI yang tersimpan untuk rekaman ini."
        safe_analysis = _safe_pdf_text(ai_analysis_text)

        pdf.set_font('Helvetica', '', 9.5)
        pdf.set_text_color(30, 41, 59)
        pdf.set_fill_color(241, 245, 249)
        pdf.set_draw_color(203, 213, 225)
        pdf.multi_cell(0, 5.5, safe_analysis, border=1, fill=True)

        pdf.ln(8)

        # 5. FOOTER
        pdf.set_font('Helvetica', 'I', 8)
        pdf.set_text_color(148, 163, 184)
        pdf.cell(0, 5, "Generated automatically by Benggala Python Engine (Flask + FPDF2) - Sistem Deteksi Visual", align='C')

        pdf_bytes = bytes(pdf.output())

        response = Response(pdf_bytes, mimetype='application/pdf')
        response.headers['Content-Disposition'] = f'attachment; filename=benggala_report_{log_id}.pdf'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response

    except Exception as e:
        current_app.logger.error(f"Error generating PDF report for log_id {log_id}: {e}")
        return jsonify({
            "status": "error",
            "message": f"Gagal membuat dokumen PDF: {str(e)}"
        }), 500
