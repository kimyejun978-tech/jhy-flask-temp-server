from flask import Flask, request, jsonify
import sqlite3
from datetime import datetime
import os

app = Flask(__name__)
DB_PATH = "jhy.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS devices (
        device_id TEXT PRIMARY KEY,
        current REAL DEFAULT 0,
        vibration REAL DEFAULT 0,
        metal_detected INTEGER DEFAULT 0,
        state TEXT DEFAULT 'idle',
        updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sensor_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        current REAL NOT NULL,
        vibration REAL NOT NULL,
        created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS metal_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        detected INTEGER NOT NULL,
        created_at TEXT NOT NULL
    );
    """)
    conn.commit()
    conn.close()

def now():
    return datetime.now().isoformat(timespec="seconds")

init_db()

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "J.H.Y Flask API server",
        "api": [
            "POST /api/sensor/<device_id>",
            "POST /api/metal/<device_id>",
            "GET /api/situation",
            "GET /api/situation?state=used",
            "GET /api/situation?state=idle"
        ]
    })

@app.route("/api/sensor/<device_id>", methods=["POST"])
def save_sensor(device_id):
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "JSON body required"}), 400
    if "current" not in data or "vibration" not in data:
        return jsonify({"error": "current and vibration are required"}), 400

    try:
        current = float(data["current"])
        vibration = float(data["vibration"])
    except (TypeError, ValueError):
        return jsonify({"error": "current and vibration must be numbers"}), 400

    CURRENT_THRESHOLD = 0.5
    VIBRATION_THRESHOLD = 0.2
    state = "used" if current >= CURRENT_THRESHOLD and vibration >= VIBRATION_THRESHOLD else "idle"
    timestamp = now()

    conn = get_db()
    conn.execute(
        "INSERT INTO sensor_logs (device_id, current, vibration, created_at) VALUES (?, ?, ?, ?)",
        (device_id, current, vibration, timestamp)
    )
    conn.execute(
        """
        INSERT INTO devices (device_id, current, vibration, state, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(device_id)
        DO UPDATE SET
            current = excluded.current,
            vibration = excluded.vibration,
            state = excluded.state,
            updated_at = excluded.updated_at
        """,
        (device_id, current, vibration, state, timestamp)
    )
    conn.commit()
    conn.close()

    return jsonify({
        "message": "sensor value saved",
        "device_id": device_id,
        "current": current,
        "vibration": vibration,
        "state": state
    }), 201

@app.route("/api/metal/<device_id>", methods=["POST"])
def save_metal(device_id):
    data = request.get_json(silent=True)
    if not data or "detected" not in data:
        return jsonify({"error": "detected is required"}), 400

    detected = data["detected"]
    if not isinstance(detected, bool):
        return jsonify({"error": "detected must be true or false"}), 400

    timestamp = now()
    conn = get_db()
    conn.execute(
        "INSERT INTO metal_logs (device_id, detected, created_at) VALUES (?, ?, ?)",
        (device_id, int(detected), timestamp)
    )
    conn.execute(
        """
        INSERT INTO devices (device_id, metal_detected, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(device_id)
        DO UPDATE SET
            metal_detected = excluded.metal_detected,
            updated_at = excluded.updated_at
        """,
        (device_id, int(detected), timestamp)
    )
    conn.commit()
    conn.close()

    return jsonify({
        "message": "metal value saved",
        "device_id": device_id,
        "detected": detected
    }), 201

@app.route("/api/situation", methods=["GET"])
def get_situation():
    state = request.args.get("state")
    conn = get_db()

    if state:
        rows = conn.execute(
            "SELECT device_id, current, vibration, metal_detected, state, updated_at FROM devices WHERE state = ? ORDER BY device_id",
            (state,)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT device_id, current, vibration, metal_detected, state, updated_at FROM devices ORDER BY device_id"
        ).fetchall()

    conn.close()
    devices = [dict(row) for row in rows]

    return jsonify({
        "count": len(devices),
        "state": state,
        "devices": devices
    })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
