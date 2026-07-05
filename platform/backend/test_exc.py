from fastapi import FastAPI, HTTPException, Depends
from fastapi.testclient import TestClient

app = FastAPI()

def get_user():
    exc = HTTPException(status_code=401, detail="Original detail")
    
    # Mutate it
    exc.detail = "Mutated detail"
    raise exc

@app.get("/")
def read_root(user=Depends(get_user)):
    return {"hello": "world"}

client = TestClient(app)
response = client.get("/")
print("Response JSON:", response.json())
