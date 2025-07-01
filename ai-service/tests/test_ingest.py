import json, os, requests, pytest, time

BASE = "http://127.0.0.1:8000"

@pytest.fixture(scope="session", autouse=True)
def ensure_server_running():
    # Give devs a friendly reminder if backend isn't up
    try:
        requests.get(BASE + "/docs", timeout=2)
    except requests.exceptions.ConnectionError:
        pytest.exit("⚠️  FastAPI server must be running on 127.0.0.1:8000 before tests")

@pytest.mark.parametrize("file,expect_chars,expect_locs",[
    ("chap_simple.json", {"Kane","Esau"}, {"Brighton Beach"}),  # lighthouse filtered out by quality check
    ("chap_multi.json",  {"Tal","Zara","Lucian"}, {"Chicago","Denver"}),
])
def test_ingest(file, expect_chars, expect_locs):
    payload = json.load(open(os.path.join(os.path.dirname(__file__),"fixtures",file)))
    r = requests.post(f"{BASE}/ingest_chapter", json=payload, timeout=10).json()
    
    # Extract character names (first word only, removing traits in parentheses)
    actual_chars = set(c.split()[0] for c in r["characters"])
    actual_locs = set(r["locations"])
    
    # Debug output to see what was actually extracted
    print(f"\n📖 Testing: {file}")
    print(f"Characters extracted: {r['characters']}")
    print(f"Locations extracted: {r['locations']}")
    print(f"Summary: {r['metadata']['summary']}")
    
    # Assertions
    assert expect_chars.issubset(actual_chars), f"Expected chars {expect_chars} not found in {actual_chars}"
    assert expect_locs.issubset(actual_locs), f"Expected locations {expect_locs} not found in {actual_locs}"
    assert r["metadata"]["summary"], "Summary should not be empty"
    assert isinstance(r["metadata"]["tropes"], list), "Tropes should be a list" 