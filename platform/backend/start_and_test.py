import subprocess
import time
import sys
import os

def main():
    print("Starting uvicorn server...")
    server_log = open("server_run.log", "w", encoding="utf-8")
    server_process = subprocess.Popen(
        [r"venv\Scripts\python", "-m", "uvicorn", "app.main:app", "--port", "8000", "--host", "127.0.0.1"],
        stdout=server_log,
        stderr=subprocess.STDOUT,
        text=True
    )
    
    time.sleep(3)
    
    try:
        import requests
        res = requests.get("http://127.0.0.1:8000/health")
        print(f"Server health check: {res.status_code} {res.json()}")
    except Exception as e:
        print(f"Server failed to start: {e}")
        server_process.terminate()
        server_log.close()
        sys.exit(1)
        
    print("Running E2E tests...")
    test_process = subprocess.Popen(
        [r"venv\Scripts\python", "-u", "test_e2e.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8"
    )
    
    while True:
        line = test_process.stdout.readline()
        if not line:
            break
        print(line, end="")
        
    test_process.wait()
    print(f"Test process exited with code: {test_process.returncode}")
    
    server_process.terminate()
    server_process.wait()
    server_log.close()
    
    sys.exit(test_process.returncode)

if __name__ == "__main__":
    main()
