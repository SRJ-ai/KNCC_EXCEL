import os
import base64
from jose import jwt

secret_str = "Ry+8Mo94A8bDOjeOrep6mW74/QAKrucXvQjRCw9dXvbcNmiP0ZER6D1PB7c+itlio40//aW7GOVP62Q8BsuP8Q=="
token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqcG1ydXhwd2hjYm16YXVyY2JxIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJleHAiOjE3MTY4ODk5OTksImlhdCI6MTcxNjA4OTk5OX0.dummy"

print("Trying string secret directly:")
try:
    jwt.decode(token, secret_str, algorithms=["HS256"], options={"verify_signature": False, "verify_aud": False})
    print("Direct string decoded successfully (with bypass)")
except Exception as e:
    print(f"Direct string fail: {e}")

secret_bytes = base64.b64decode(secret_str)
print("\nTrying base64 decoded bytes:")
try:
    jwt.decode(token, secret_bytes, algorithms=["HS256"], options={"verify_signature": False, "verify_aud": False})
    print("Bytes decoded successfully (with bypass)")
except Exception as e:
    print(f"Bytes fail: {e}")
