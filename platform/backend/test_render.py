import urllib.request
import json
import ssl

url = "https://wjpmruxpwhcbmzaurcbq.supabase.co"
anon = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqcG1ydXhwd2hjYm16YXVyY2JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NDYzMjcsImV4cCI6MjA5ODAyMjMyN30.N6gYkDaLBG3ZMWl2DSvuyrFipnuu4DOeu8YJRXhj9pk"

# 1. Login to Supabase to get an access token
login_url = f"{url}/auth/v1/token?grant_type=password"
login_data = json.dumps({
    "email": "engineer@kncc.com",
    "password": "Password123!"
}).encode("utf-8")

req = urllib.request.Request(login_url, data=login_data, headers={
    "Content-Type": "application/json",
    "apikey": anon,
    "Authorization": f"Bearer {anon}"
}, method="POST")

try:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    res = urllib.request.urlopen(req, context=ctx)
    token = json.loads(res.read().decode())["access_token"]
    print("Got Supabase Token!")
except Exception as e:
    print("Login failed:", e)
    token = None

if token:
    # 2. Test Render Backend
    backend_url = "https://kncc-backend.onrender.com/api/projects/"
    req2 = urllib.request.Request(backend_url, data=b"{}", headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }, method="POST")
    try:
        res2 = urllib.request.urlopen(req2, context=ctx)
        print("Backend Success:", res2.read().decode())
    except urllib.error.HTTPError as e:
        print("Backend Failed with", e.code, e.read().decode())
