import os
import base64
from jose import jwt

token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqcG1ydXhwd2hjYm16YXVyY2JxIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJleHAiOjE3MTY4ODk5OTksImlhdCI6MTcxNjA4OTk5OX0.dummy"

print("Trying decode with bypass and random key...")
try:
    payload = jwt.decode(token, key="dummy_secret", algorithms=["HS256"], options={"verify_signature": False, "verify_aud": False})
    print("Decoded payload:", payload)
except Exception as e:
    print(f"Bypass fail: {e}")
