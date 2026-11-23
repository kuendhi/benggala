import os
import pymysql
import pymysql.cursors
from dotenv import load_dotenv

# Muat variabel environment
load_dotenv()

def get_db_connection():
    """
    Membuka dan mengembalikan koneksi MySQL dengan PyMySQL DictCursor.
    Koneksi menggunakan charset utf8mb4 dan autocommit aktif.
    """
    host = os.getenv('DB_HOST', 'localhost')
    port = int(os.getenv('DB_PORT', 3306))
    user = os.getenv('DB_USER', 'root')
    password = os.getenv('DB_PASS', '')
    database = os.getenv('DB_NAME', 'sikemban1_benggala')

    try:
        return pymysql.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database=database,
            charset='utf8mb4',
            autocommit=True,
            cursorclass=pymysql.cursors.DictCursor
        )
    except Exception as primary_err:
        # Fallback koneksi: coba root lokal tanpa password jika kredensial khusus bermasalah di lokal
        if user != 'root' or password != '':
            try:
                return pymysql.connect(
                    host='localhost',
                    port=3306,
                    user='root',
                    password='',
                    database=database,
                    charset='utf8mb4',
                    autocommit=True,
                    cursorclass=pymysql.cursors.DictCursor
                )
            except Exception:
                pass
        raise primary_err

def db_fetch_one(sql: str, params=None):
    """
    Mengeksekusi prepared statement dan mengembalikan 1 baris record (dict) atau None.
    WAJIB menggunakan Prepared Statements (%s).
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(sql, params or ())
            return cursor.fetchone()
    finally:
        conn.close()

def db_fetch_all(sql: str, params=None):
    """
    Mengeksekusi prepared statement dan mengembalikan seluruh baris record (list of dict).
    WAJIB menggunakan Prepared Statements (%s).
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(sql, params or ())
            return cursor.fetchall()
    finally:
        conn.close()

def db_execute(sql: str, params=None) -> int:
    """
    Mengeksekusi prepared statement (INSERT, UPDATE, DELETE) dan mengembalikan lastrowid.
    WAJIB menggunakan Prepared Statements (%s).
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(sql, params or ())
            return cursor.lastrowid
    finally:
        conn.close()

def get_all_settings() -> dict:
    """
    Membaca seluruh setting dari tabel app_settings (atau fallback ke tabel settings)
    menjadi dictionary Python {setting_key: setting_value}.
    """
    rows = None
    try:
        rows = db_fetch_all("SELECT setting_key, setting_value FROM app_settings")
    except Exception:
        try:
            rows = db_fetch_all("SELECT setting_key, setting_value FROM settings")
        except Exception:
            return {}

    settings = {}
    if rows:
        for row in rows:
            key = row.get('setting_key')
            if key is not None:
                val = row.get('setting_value')
                settings[key] = val if val is not None else ''
    return settings

def init_knowledge_table() -> bool:
    """
    Auto-migrasi tabel custom_objects untuk fitur koreksi objek & few-shot AI.
    Aman dipanggil berulang kali (CREATE TABLE IF NOT EXISTS).
    """
    sql = """
    CREATE TABLE IF NOT EXISTS custom_objects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        label_name VARCHAR(100) NOT NULL,
        category VARCHAR(60) DEFAULT 'umum',
        notes VARCHAR(255) DEFAULT '',
        image_path VARCHAR(255) NOT NULL,
        embedding_json LONGTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_label_name (label_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    try:
        db_execute(sql)
        return True
    except Exception:
        return False

