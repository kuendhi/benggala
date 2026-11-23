"""
Test Suite untuk Jembatan Hybrid Android & Dual-Auth Backend (Task AND_01)
Memverifikasi:
1. POST API dengan X-App-Token valid lolos tanpa CSRF cookie browser (Bypass Same-Origin).
2. POST API dengan X-App-Token invalid ditolak HTTP 401 dengan reason: invalid_app_token.
3. GET /?embed=1&panel=gallery merender body.android-embed-mode dan window.INITIAL_PANEL = "gallery".
"""

import os
import unittest
from app import app

class TestAndroidBridge(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.valid_token = os.getenv('APP_API_TOKEN', '').strip()
        self.assertGreater(len(self.valid_token), 0, "APP_API_TOKEN must be configured in environment")

    def test_post_with_valid_app_token_bypasses_csrf(self):
        """
        Skenario 1: Request POST tanpa CSRF cookie tetapi membawa header X-App-Token valid
        -> tidak boleh ditolak 403 (CSRF/Origin) atau 401 (Auth).
        """
        response = self.client.post(
            '/api/snapshot/save',
            headers={'X-App-Token': self.valid_token},
            json={},  # Payload kosong akan ditolak 400 Bad Request oleh controller, bukan 401/403 oleh security
            content_type='application/json'
        )
        self.assertNotIn(
            response.status_code,
            (401, 403),
            f"Request dengan token valid tidak boleh ditolak 401/403, mendapat {response.status_code}: {response.get_data(as_text=True)}"
        )

    def test_post_with_invalid_app_token_rejected_401(self):
        """
        Skenario 2: Request membawa header X-App-Token salah -> ditolak 401 dengan reason: 'invalid_app_token'.
        """
        response = self.client.post(
            '/api/snapshot/save',
            headers={'X-App-Token': 'bgl_invalid_token_sample_12345'},
            json={},
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 401)
        data = response.get_json() or {}
        self.assertEqual(data.get('status'), 'error')
        self.assertEqual(data.get('reason'), 'invalid_app_token')

    def test_get_embed_panel_gallery(self):
        """
        Skenario 3: Request GET /?embed=1&panel=gallery -> merender halaman dengan 'android-embed-mode' dan INITIAL_PANEL = 'gallery'.
        """
        response = self.client.get('/?embed=1&panel=gallery')
        self.assertEqual(response.status_code, 200)
        html = response.get_data(as_text=True)
        self.assertIn('android-embed-mode', html)
        self.assertIn('window.ANDROID_EMBED = true', html)
        self.assertIn('window.INITIAL_PANEL = "gallery"', html)

if __name__ == '__main__':
    unittest.main()
