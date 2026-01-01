import urllib.request
import json
import time

def verify_search():
    base_url = "http://localhost:8001/api/places"
    
    # Test cases
    tests = [
        ("Exact Match", "Taj Mahal Palace"),
        ("Fuzzy Match", "Taaj Mahal"),
        ("Suggestions", "Taj")
    ]
    
    for test_type, query in tests:
        print(f"\n--- Testing {test_type}: '{query}' ---")
        
        if test_type == "Suggestions":
            url = f"{base_url}/suggestions?query={query.replace(' ', '%20')}"
        else:
            url = f"{base_url}/search?query={query.replace(' ', '%20')}"
            
        try:
            with urllib.request.urlopen(url) as response:
                data = json.loads(response.read().decode('utf-8'))
                print(f"Status: {response.status}")
                if test_type == "Suggestions":
                    print(f"Suggestions: {data['suggestions']}")
                else:
                    print(f"Found {len(data['places'])} places.")
                    for p in data['places']:
                        print(f"- {p['name']}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    verify_search()
