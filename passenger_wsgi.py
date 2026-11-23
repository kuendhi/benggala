import sys
import os
import traceback

# Jembatan Phusion Passenger / LiteSpeed WSGI cPanel
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

try:
    # Import Flask instance sebagai 'application' yang diharapkan oleh Passenger/WSGI
    from app import app as application
except Exception as e:
    err_trace = traceback.format_exc()
    try:
        tmp_dir = os.path.join(CURRENT_DIR, 'tmp')
        os.makedirs(tmp_dir, exist_ok=True)
        with open(os.path.join(tmp_dir, 'passenger_error.log'), 'w', encoding='utf-8') as f:
            f.write(err_trace)
    except Exception:
        pass

    def application(environ, start_response):
        status = '500 Internal Server Error'
        response_headers = [('Content-Type', 'text/plain; charset=utf-8')]
        start_response(status, response_headers)
        return [f"=== WSGI STARTUP EXCEPTION ===\n\n{err_trace}".encode('utf-8')]

