import os
import sys
import json
import urllib.request
import urllib.error
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Ensure backend directory is in the path so we can import app.config if needed
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY
except ImportError:
    # Fallback to direct environment variables if import fails
    SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

def inject_accounts(supabase_url: str = None, service_key: str = None) -> bool:
    """
    Safely injects test accounts into Supabase using GoTrue Admin API.
    Checks if users exist first and auto-confirms their email.
    """
    url = supabase_url or SUPABASE_URL
    key = service_key or SUPABASE_SERVICE_KEY

    if not url or not key:
        logger.warning("SUPABASE_URL or SUPABASE_SERVICE_KEY is missing. Skipping test account injection.")
        return False

    # Standardize the API URL base
    base_url = url.strip().rstrip('/')
    
    # If the URL is a Postgres connection string, log a warning and skip
    if base_url.startswith("postgres://") or base_url.startswith("postgresql://"):
        logger.warning("SUPABASE_URL appears to be a database connection string rather than an API URL. Skipping test account injection.")
        return False

    if not (base_url.startswith("http://") or base_url.startswith("https://")):
        logger.warning(f"SUPABASE_URL is not a valid HTTP/HTTPS URL: {url}. Skipping test account injection.")
        return False

    if not base_url.endswith('/auth/v1') and not '/auth/v1/' in base_url and not '/auth/v1' in base_url:
        auth_url = f"{base_url}/auth/v1"
    else:
        auth_url = base_url

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }

    # 1. Check if users already exist by listing users
    existing_emails = set()
    try:
        req = urllib.request.Request(
            f"{auth_url}/admin/users",
            headers=headers,
            method="GET"
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
            users = data.get("users", [])
            for u in users:
                email = u.get("email")
                if email:
                    existing_emails.add(email.lower())
    except Exception as e:
        logger.warning(f"Could not list existing users from Supabase: {e}. Will attempt direct user creation with duplicate handling.")

    users_to_inject = [
        {
            "email": "admin@kncc.com",
            "password": "Password123!",
            "email_confirm": True,
            "user_metadata": {
                "role": "admin",
                "name": "Admin",
                "organization_name": "KNCC"
            }
        },
        {
            "email": "engineer@kncc.com",
            "password": "Password123!",
            "email_confirm": True,
            "user_metadata": {
                "role": "engineer",
                "name": "Engineer",
                "organization_name": "KNCC"
            }
        }
    ]

    success = True
    for user_data in users_to_inject:
        email = user_data["email"]
        if email.lower() in existing_emails:
            logger.info(f"User {email} already exists. Skipping injection.")
            continue

        try:
            req = urllib.request.Request(
                f"{auth_url}/admin/users",
                data=json.dumps(user_data).encode('utf-8'),
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                resp_data = json.loads(response.read().decode('utf-8'))
                logger.info(f"Successfully injected test account: {email}")
        except urllib.error.HTTPError as e:
            try:
                err_body = e.read().decode('utf-8')
                err_data = json.loads(err_body)
                msg = err_data.get("msg", "") or err_data.get("error_description", "") or err_body
            except Exception:
                msg = str(e)
            
            # 400 Bad Request is returned by GoTrue if the user already exists
            if e.code in (400, 409) and ("exists" in msg.lower() or "already" in msg.lower()):
                logger.info(f"User {email} already exists (detected during creation: {msg}). Skipping.")
            else:
                logger.error(f"Failed to inject test account {email}: HTTP {e.code} - {msg}")
                success = False
        except Exception as e:
            logger.error(f"Error injecting test account {email}: {e}")
            success = False

    return success

if __name__ == "__main__":
    logger.info("Starting standalone Supabase test account injection...")
    res = inject_accounts()
    if res:
        logger.info("Injection completed successfully or skipped existing users.")
    else:
        logger.warning("Injection failed or completed with errors.")
