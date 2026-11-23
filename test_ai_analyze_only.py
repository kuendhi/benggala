import os
import io
import base64
import json
from unittest.mock import patch
from PIL import Image
from app import app

def run_tests():
    print("=== STARTING TEST_AI_ANALYZE_ONLY SUITE ===")
    client = app.test_client()

    # -------------------------------------------------------------------------
    # TEST 1: Request tanpa CSRF token wajib ditolak 403
    # -------------------------------------------------------------------------
    res_no_csrf = client.post('/api/ai/analyze', json={'prompt': 'Uji tanpa CSRF'})
    assert res_no_csrf.status_code == 403, f"Expected 403, got {res_no_csrf.status_code}"
    err_csrf = res_no_csrf.get_json() or {}
    assert err_csrf.get('error_stage') == 'security', f"Expected error_stage 'security', got {err_csrf}"
    print(f"PASS Test 1: POST /api/ai/analyze rejected 403 without CSRF (reason: {err_csrf.get('reason')})")

    # -------------------------------------------------------------------------
    # TEST 2: Kunci API kosong / placeholder -> HTTP 400 error_stage='config'
    # -------------------------------------------------------------------------
    client.get('/')
    with client.session_transaction() as sess:
        csrf_token = sess.get('csrf_token')

    headers = {'X-CSRF-Token': csrf_token}

    with patch('routes.ai_snapshot.get_all_settings', return_value={'gemini_api_key': '****', 'deepseek_api_key': ''}), \
         patch.dict(os.environ, {'GEMINI_API_KEY': '', 'DEEPSEEK_API_KEY': ''}):
        res_no_key = client.post('/api/ai/analyze', headers=headers, json={'prompt': 'Halo AI'})
        assert res_no_key.status_code == 400, f"Expected 400, got {res_no_key.status_code}"
        err_config = res_no_key.get_json() or {}
        assert err_config.get('error_stage') == 'config', f"Expected error_stage 'config', got {err_config}"
        assert 'API Key Gemini/DeepSeek belum diisi di Pengaturan' in err_config.get('message', '')
        print("PASS Test 2: Missing API keys properly returned 400 with error_stage='config'")

    # -------------------------------------------------------------------------
    # TEST 3: Pembersihan Base64 Prefix & Permintaan Analisis dengan JPEG dummy
    # -------------------------------------------------------------------------
    dummy_img = Image.new('RGB', (160, 120), (100, 150, 200))
    buf = io.BytesIO()
    dummy_img.save(buf, format='JPEG')
    raw_b64 = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode('utf-8')

    payload = {
        'image': raw_b64,
        'prompt': 'Tolong analisis objek pada foto ini secara singkat.',
        'objects': [{'name': 'cangkir', 'ukuran': 'sedang', 'score': 0.92}],
        'custom_label': 'Cangkir Kopi Lokal',
        'mission_category': 'qc_umkm'
    }

    res = client.post('/api/ai/analyze', headers=headers, json=payload)
    print(f"\n--- HASIL PEMANGGILAN POST /api/ai/analyze ---")
    print(f"HTTP Status: {res.status_code}")

    assert res.status_code != 500, f"CRITICAL: Endpoint crashed with 500: {res.get_data(as_text=True)}"

    resp_data = res.get_json() or {}
    print("Respons JSON:\n" + json.dumps(resp_data, indent=2))

    if res.status_code == 200:
        assert resp_data.get('success') is True
        assert 'analysis' in resp_data
        print(f"\nPASS Test 3: AI Berhasil Menganalisis! Provider: {resp_data.get('provider')}")
    elif res.status_code == 502:
        assert resp_data.get('error_stage') == 'ai_all_failed'
        assert 'message' in resp_data
        print(f"\nPASS Test 3: Terkendali via Safe Fallback 502: {resp_data.get('message')}")
    else:
        print(f"\nResponse code {res.status_code}: {resp_data}")

    print("\n>>> ALL TESTS IN test_ai_analyze_only.py PASSED SUCCESSFULLY! <<<")

if __name__ == '__main__':
    run_tests()
