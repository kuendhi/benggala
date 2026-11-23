# Auto-Deploy & Pre-Commit Rules (Benggala OS Python)

Panduan operasional dan aturan verifikasi sebelum melakukan commit dan push ke repositori GitHub untuk deployment otomatis ke **cPanel Python Web Applications (Phusion Passenger)**.

---

## 1. Arsitektur CI/CD & Auto-Restart Passenger

Pipeline GitHub Actions (`.github/workflows/deploy.yml`) dikonfigurasi untuk menangani alur deployment otomatis:
1. **Sintaks Python Check**: Menguji integritas kompilasi seluruh file Python menggunakan `py_compile`. Jika ada kesalahan sintaks atau indentasi, deployment otomatis dibatalkan (*fail-fast*).
2. **Passenger Auto-Restart**: Membuat timestamp terbaru pada `tmp/restart.txt`. File ini akan men-trigger Phusion Passenger di cPanel untuk merestart worker proses Python tanpa perlu akses terminal SSH cPanel.
3. **FTP Sync Aman**: Sinkronisasi file ke server hosting via `SamKirkland/FTP-Deploy-Action` dengan mengecualikan file sensitif, file virtualenv, cache, dan data snapshot pengguna.

---

## 2. Aturan Verifikasi Wajib Sebelum Commit (Pre-Commit Checklist)

Sebelum melakukan `git commit` dan `git push`, developer/agent **WAJIB** menjalankan langkah verifikasi berikut secara berurutan:

### Langkah 1: Pengecekan Sintaks Python
Pastikan seluruh file Python terkompilasi tanpa error:
```bash
python -m py_compile app.py passenger_wsgi.py core/*.py routes/*.py
```
*(Di lingkungan Windows PowerShell, pastikan perintah berjalan dengan return code 0)*.

### Langkah 2: Audit File Sensitif (`git status`)
Pastikan file rahasia dan cache tidak masuk ke staging area Git:
- **DILARANG KERAS** mengikutsertakan file `.env` (berisi kredensial DB & API keys).
- **DILARANG KERAS** mengikutsertakan folder `venv/` atau `.venv/`.
- **DILARANG KERAS** mengikutsertakan folder `__pycache__/` atau file `*.pyc`.
- **DILARANG KERAS** mengikutsertakan file foto di `uploads/snapshots/*.jpg` (hanya `uploads/snapshots/.gitkeep` yang boleh di-track).

Periksa dengan:
```bash
git status
```
Pastikan `.env`, `venv/`, dan `uploads/snapshots/*.jpg` tidak muncul di daftar *Untracked files* atau *Changes to be committed*.

### Langkah 3: Eksekusi Git Commit & Push
Gunakan format commit konvensional dan selalu sinkronkan rebase terlebih dahulu:
```bash
git add .
git commit -m "jenis(lingkup): deskripsi perubahan yang jelas"
git pull --rebase origin main  # atau branch aktif seperti python-migration
git push origin main           # atau branch aktif seperti python-migration
```

---

## 3. Struktur Direktori Wajib Terjaga di Hosting

Untuk memastikan Phusion Passenger dan fitur penyimpanan foto berjalan normal, pastikan struktur berikut selalu ada di repositori:
- `tmp/.gitkeep`: Folder target penulisan `tmp/restart.txt`.
- `uploads/snapshots/.gitkeep`: Folder penyimpanan file foto bukti deteksi.
- `passenger_wsgi.py`: Entry point standar Phusion Passenger cPanel.
- `app.py`: Entry point aplikasi Flask.

---

## 4. Konfigurasi GitHub Secrets

Pastikan repositori GitHub telah memiliki Secrets berikut di **Settings > Secrets and variables > Actions**:
- `FTP_SERVER`: Alamat host FTP server cPanel (misal: `ftp.domainanda.com`).
- `FTP_USERNAME`: Username akun FTP cPanel.
- `FTP_PASSWORD`: Password akun FTP cPanel.
- `FTP_SERVER_DIR`: Path folder root aplikasi di cPanel (misal: `/public_html/` atau subfolder Python App).
