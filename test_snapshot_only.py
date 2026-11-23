import os
import io
import base64
from PIL import Image
from app import app, BASE_DIR
from core.database import db_fetch_one, db_execute

def run_tests():
    print("=== STARTING TEST_SNAPSHOT_ONLY SUITE ===")
    client = app.test_client()

    # ---------------------------------------------------------
    # TEST 1: POST /api/snapshot/save tanpa X-CSRF-Token wajib ditolak 403
    # ---------------------------------------------------------
    res_no_csrf = client.post('/api/snapshot/save', json={'image': 'dummy'})
    assert res_no_csrf.status_code == 403, f"Expected 403, got {res_no_csrf.status_code}"
    err_json = res_no_csrf.get_json() or {}
    assert err_json.get('status') == 'error', f"Expected status error, got {err_json}"
    assert err_json.get('error_stage') == 'security', f"Expected error_stage security, got {err_json}"
    assert 'reason' in err_json, f"Expected reason key in response: {err_json}"
    print(f"PASS Test 1: POST /api/snapshot/save without CSRF rejected 403 (reason: {err_json.get('reason')})")

    # ---------------------------------------------------------
    # TEST 2: Ambil CSRF dari GET /, kirim gambar RGBA Base64 + CSRF header
    # ---------------------------------------------------------
    res_index = client.get('/')
    assert res_index.status_code == 200, "GET / failed"

    with client.session_transaction() as sess:
        csrf_token = sess.get('csrf_token')
    assert csrf_token, "csrf_token should be present in session after visiting /"

    # Buat gambar RGBA dummy (PNG dengan channel alpha)
    rgba_img = Image.new('RGBA', (320, 240), (255, 80, 40, 180))
    buf = io.BytesIO()
    rgba_img.save(buf, format='PNG')
    rgba_b64 = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode('utf-8')

    # Kirim snapshot dengan gambar RGBA
    headers = {
        'X-CSRF-Token': csrf_token
    }
    payload = {
        'image': rgba_b64,
        'objects': [{'name': 'tanaman_uji', 'score': 0.95}],
        'confidence': 0.95,
        'is_cctv': False
    }

    res_save = client.post('/api/snapshot/save', headers=headers, json=payload)
    assert res_save.status_code == 200, f"Expected 200, got {res_save.status_code}: {res_save.get_data(as_text=True)}"
    data = res_save.get_json() or {}
    assert data.get('status') in ('ok', 'success'), f"Unexpected status: {data.get('status')}"
    assert data.get('success') is True, "Expected success: True"
    assert 'filename' in data, "Missing filename in response"
    assert 'id' in data and data['id'], "Missing id in response"

    filename = data['filename']
    log_id = data['id']
    snapshot_dir = os.path.join(BASE_DIR, 'uploads', 'snapshots')
    file_on_disk = os.path.join(snapshot_dir, filename)

    # Verifikasi file fisik ada di disk dan valid format JPEG
    assert os.path.isfile(file_on_disk), f"File fisik tidak ditemukan: {file_on_disk}"
    with Image.open(file_on_disk) as saved_img:
        assert saved_img.format == 'JPEG', f"Format gambar bukan JPEG: {saved_img.format}"
        assert saved_img.mode == 'RGB', f"Mode gambar bukan RGB: {saved_img.mode}"
    print(f"PASS: File fisik terverifikasi ({filename}) berformat JPEG/RGB")

    # Verifikasi baris tercatat di database detection_logs
    row = db_fetch_one("SELECT * FROM detection_logs WHERE id = %s", (log_id,))
    assert row is not None, f"Baris id={log_id} tidak ditemukan di database detection_logs"
    assert row.get('filename') == filename, f"Filename di DB ({row.get('filename')}) != {filename}"
    print(f"PASS: Record DB terverifikasi (id={log_id}, filename={filename})")

    # Bersihkan file fisik dan baris uji dari database
    try:
        if os.path.exists(file_on_disk):
            os.remove(file_on_disk)
        db_execute("DELETE FROM detection_logs WHERE id = %s", (log_id,))
    except Exception as cleanup_err:
        print(f"Warning: Cleanup error: {cleanup_err}")

    assert not os.path.exists(file_on_disk), "File fisik gagal dibersihkan"
    assert db_fetch_one("SELECT id FROM detection_logs WHERE id = %s", (log_id,)) is None, "Baris DB gagal dibersihkan"
    print("PASS: Cleanup file fisik dan baris DB berhasil")

    print("\n>>> ALL TESTS IN test_snapshot_only.py PASSED SUCCESSFULLY! <<<")

if __name__ == '__main__':
    run_tests()
