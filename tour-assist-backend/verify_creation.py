import urllib.request
import json
import time
import sys

def verify():
    url = "http://localhost:8001/api/places/create-by-address"
    data = {
        "name": "Taj Mahal Palace",
        "description": "Luxury hotel",
        "address": "Taj Mahal Palace, Mumbai",
        "category": "Hotel"
    }

    print(f"Testing URL: {url}")
    print(f"Data: {data}")

    req = urllib.request.Request(
        url, 
        data=json.dumps(data).encode('utf-8'), 
        headers={'Content-Type': 'application/json'}
    )

    try:
        with urllib.request.urlopen(req) as response:
            print(f"Status: {response.status}")
            print(f"Response: {response.read().decode('utf-8')}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Wait a bit for server to start
    time.sleep(5)
    verify()
