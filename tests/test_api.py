from fastapi.testclient import TestClient

from kumishift.api import app

client = TestClient(app)


def config():
    return {
        "period": {"start": "2027-01-04", "end": "2027-01-10"},
        "hourly": {
            "min_hours": 4,
            "max_hours": 8,
            "business_hours": {"default": {"open": "10:00", "close": "20:00"}, "weekdays": {"水": "定休日"}},
            "demand": {"default": [{"from": "11:00", "to": "14:00", "count": 2}]},
        },
        "staff": [{"name": n} for n in ["A", "B", "C", "D"]],
        "rules": {"time_limit_seconds": 2},
    }


def test_health():
    assert client.get("/api/health").json()["status"] == "ok"


def test_solve():
    res = client.post("/api/solve", json=config())
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ("最適", "実行可能")
    assert data["hourly"] is True
    assert any(d["closed"] for d in data["days"])
    assert data["assign"]


def test_config_error_is_422_with_japanese_message():
    c = config()
    c["staff"] = [{"name": "A"}, {"name": "A"}]
    res = client.post("/api/solve", json=c)
    assert res.status_code == 422
    assert "重複" in res.json()["detail"]
