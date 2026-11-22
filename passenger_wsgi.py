import sys
import os

# Jembatan Phusion Passenger cPanel: Pastikan root project berada di sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

# Import Flask instance sebagai 'application' yang diharapkan oleh Passenger
from app import app as application
