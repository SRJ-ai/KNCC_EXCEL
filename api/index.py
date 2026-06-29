import os
import sys

# Add the backend directory to sys.path
backend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "platform", "backend")
sys.path.insert(0, backend_dir)

# Import the FastAPI app
from app.main import app
