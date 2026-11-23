import os
import re
import time
import hmac
from functools import wraps
from urllib.parse import urlparse
from flask import request, session, jsonify

# Penyimpanan in-memory sederhana untuk Rate Limiting per IP
RATE_LIMIT_STORE = {}

def get_client_ip() -> str:
    """
    Mendapatkan alamat IP klien yang sebenarnya, mendukung reverse proxy dan header forwarded.
    """
    if request.headers.get('X-Forwarded-For'):
        forwarded = request.headers.get('X-Forwarded-For').split(',')
        client_ip = forwarded[0].strip()
        if client_ip:
            return client_ip
    if request.headers.get('X-Real-IP'):
        return request.headers.get('X-Real-IP').strip()
    return request.remote_addr or '127.0.0.1'

def _extract_hostname(url_or_host: str) -> str:
    """Helper internal untuk mengekstrak nama host (huruf kecil) tanpa port atau protokol."""
    if not url_or_host:
        return ''
    cleaned = url_or_host.strip()
    if not cleaned:
        return ''
    if '://' in cleaned:
        parsed = urlparse(cleaned)
    else:
        parsed = urlparse('//' + cleaned)
    return (parsed.hostname or cleaned.split(':')[0]).lower()

def is_same_origin() -> bool:
    """
    Validasi Same-Origin dengan membandingkan hostname saja dari Origin atau Referer
    terhadap request.host dan header X-Forwarded-Host via urllib.parse.urlparse.
    Mencegah kegagalan akibat perbedaan http/https, port reverse proxy cPanel,
    atau subfolder /benggala.
    """
    allowed_hosts = set()
    if request.host:
        h = _extract_hostname(request.host)
        if h:
            allowed_hosts.add(h)

    xfh = request.headers.get('X-Forwarded-Host', '')
    if xfh:
        for part in xfh.split(','):
            h = _extract_hostname(part)
            if h:
                allowed_hosts.add(h)

    origin = request.headers.get('Origin', '').strip()
    if origin:
        origin_host = _extract_hostname(origin)
        return bool(origin_host and origin_host in allowed_hosts)

    referer = request.headers.get('Referer', '').strip()
    if referer:
        referer_host = _extract_hostname(referer)
        return bool(referer_host and referer_host in allowed_hosts)

    # Jika Origin dan Referer kosong, hanya izinkan jika akses dari lokal / loopback
    client_ip = get_client_ip()
    local_hosts = {'127.0.0.1', '::1', 'localhost'}
    is_local = (
        client_ip in local_hosts or
        any(h in local_hosts for h in allowed_hosts) or
        bool(request.remote_addr and request.remote_addr in local_hosts)
    )
    return is_local

def check_csrf_status():
    """
    Memeriksa status CSRF token dan mengembalikan tuple (is_valid, reason).
    Reason dapat bernilai: 'csrf_session_missing', 'csrf_header_missing', 'csrf_mismatch', atau ''.
    """
    token_session = (session.get('csrf_token') or '').strip()
    if not token_session:
        return False, 'csrf_session_missing'

    token_header = (
        request.headers.get('X-CSRF-Token') or
        request.headers.get('X-Csrf-Token') or
        request.headers.get('x-csrf-token') or
        ''
    ).strip()

    if not token_header:
        return False, 'csrf_header_missing'

    if not hmac.compare_digest(token_header, token_session):
        return False, 'csrf_mismatch'

    return True, ''

def verify_csrf() -> bool:
    """
    Validasi header X-CSRF-Token terhadap session['csrf_token']
    menggunakan hmac.compare_digest untuk mencegah timing-attack.
    """
    ok, _ = check_csrf_status()
    return ok

def check_rate_limit(client_ip: str, max_requests: int, window_seconds: int) -> bool:
    """
    Rate limiting in-memory berbasis sliding window timestamp per IP.
    """
    now = time.time()
    timestamps = RATE_LIMIT_STORE.get(client_ip, [])
    # Filter timestamp dalam window aktif
    valid_timestamps = [ts for ts in timestamps if now - ts < window_seconds]

    if len(valid_timestamps) >= max_requests:
        RATE_LIMIT_STORE[client_ip] = valid_timestamps
        return False

    valid_timestamps.append(now)
    RATE_LIMIT_STORE[client_ip] = valid_timestamps
    return True

def require_api_security(max_requests=30, window_seconds=60):
    """
    Decorator Flask untuk proteksi endpoint API:
    1. Validasi Same-Origin (Origin / Referer)
    2. Validasi X-CSRF-Token via hmac.compare_digest
    3. Rate Limiting per IP
    Dapat digunakan sebagai @require_api_security atau @require_api_security(max_requests=X, window_seconds=Y).
    """
    if callable(max_requests):
        func = max_requests
        default_max = 30
        default_window = 60

        @wraps(func)
        def wrapper(*args, **kwargs):
            return _execute_security_check(func, default_max, default_window, *args, **kwargs)
        return wrapper

    max_req = max_requests

    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            return _execute_security_check(f, max_req, window_seconds, *args, **kwargs)
        return wrapper
    return decorator

def _execute_security_check(f, max_requests, window_seconds, *args, **kwargs):
    # 1. Validasi Same-Origin
    if not is_same_origin():
        return jsonify({
            "status": "error",
            "error_stage": "security",
            "reason": "origin_mismatch",
            "message": "Origin not allowed"
        }), 403

    # 2. Validasi CSRF Token
    csrf_ok, csrf_reason = check_csrf_status()
    if not csrf_ok:
        csrf_messages = {
            'csrf_session_missing': 'Sesi CSRF tidak ditemukan atau telah kedaluwarsa.',
            'csrf_header_missing': 'Header X-CSRF-Token tidak ditemukan.',
            'csrf_mismatch': 'Token CSRF tidak valid.'
        }
        return jsonify({
            "status": "error",
            "error_stage": "security",
            "reason": csrf_reason,
            "message": csrf_messages.get(csrf_reason, "Invalid CSRF Token")
        }), 403

    # 3. Rate Limiting per IP
    ip = get_client_ip()
    if not check_rate_limit(ip, max_requests, window_seconds):
        return jsonify({
            "status": "error",
            "error_stage": "security",
            "reason": "rate_limited",
            "message": "Terlalu banyak permintaan, coba sebentar lagi."
        }), 429

    return f(*args, **kwargs)

def mask_secret(value: str) -> str:
    """
    Menyamarkan API Key / Token rahasia:
    - Jika panjang > 8: 4 karakter awal + '****' + 4 karakter akhir
    - Jika pendek (<= 8): '****'
    - Jika kosong / None: ''
    """
    if not value:
        return ""
    val_str = str(value).strip()
    if not val_str:
        return ""
    if len(val_str) <= 8:
        return "****"
    return f"{val_str[:4]}****{val_str[-4:]}"

def sanitize_filename(filename: str) -> str:
    """
    Membersihkan nama file dari path traversal dan karakter ilegal.
    Hanya mengizinkan karakter [a-zA-Z0-9._-].
    """
    if not filename:
        return f"snapshot_{int(time.time())}.jpg"
    base = os.path.basename(str(filename))
    clean = re.sub(r'[^a-zA-Z0-9._-]', '_', base)
    clean = re.sub(r'\.{2,}', '.', clean).strip('._-')
    if not clean or not re.match(r'^[a-zA-Z0-9._-]+$', clean):
        return f"snapshot_{int(time.time())}.jpg"
    return clean

def sanitize_csv_cell(value) -> str:
    """
    Mencegah CSV Formula Injection. Jika cell diawali =, +, -, @, \t, atau \r,
    tambahkan tanda kutip tunggal (') di depannya.
    """
    if value is None:
        return ""
    val_str = str(value)
    if val_str and val_str[0] in ('=', '+', '-', '@', '\t', '\r'):
        return "'" + val_str
    return val_str
