from flask import Flask, request, jsonify
import sqlite3
from datetime import datetime
import os

app = Flask(__name__)

DB_PATH = "jhy.db"


# ==========================================
# DB 연결
# ==========================================
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ==========================================
# DB 초기 생성
# ==========================================
def init_db():
    conn = get_db()

    conn.executescript(
        """
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
        """
    )

    conn.commit()
    conn.close()


# ==========================================
# 현재 시간
# ==========================================
def now():
    return datetime.now().isoformat(timespec="seconds")


# ==========================================
# Render에서 gunicorn으로 실행해도
# DB가 생성되도록 서버 시작 시 실행
# ==========================================
init_db()


# ==========================================
# 서버 기본 주소
#
# GET /
# ==========================================
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


# ==========================================
# 센서값 저장
#
# POST /api/sensor/dryer01
#
# JSON 예시
# {
#     "current": 2.4,
#     "vibration": 0.82
# }
# ==========================================
@app.route("/api/sensor/<device_id>", methods=["POST"])
def save_sensor(device_id):

    data = request.get_json(silent=True) or {}

    print("===== ESP32 데이터 수신 =====", flush=True)
    print("device_id:", device_id, flush=True)
    print("current:", data.get("current"), flush=True)
    print("vibration:", data.get("vibration"), flush=True)
    print("============================", flush=True)
    

    # JSON이 없을 경우
    if not data:
        return jsonify({
            "error": "JSON body required"
        }), 400


    # current / vibration 값이 없을 경우
    if "current" not in data or "vibration" not in data:
        return jsonify({
            "error": "current and vibration are required"
        }), 400


    # 숫자로 변환
    try:
        current = float(data["current"])
        vibration = float(data["vibration"])

    except (TypeError, ValueError):

        return jsonify({
            "error": "current and vibration must be numbers"
        }), 400


    # ======================================
    # 임시 사용 여부 판단 기준
    #
    # 나중에 실제 센서 측정 후 수정
    # ======================================
    CURRENT_THRESHOLD = 0.5
    VIBRATION_THRESHOLD = 0.2


    # 전류와 진동이 둘 다 기준 이상이면 사용 중
    if (
        current >= CURRENT_THRESHOLD
        and vibration >= VIBRATION_THRESHOLD
    ):
        state = "used"

    else:
        state = "idle"


    timestamp = now()

    conn = get_db()


    # ======================================
    # 센서값 로그 저장
    # ======================================
    conn.execute(
        """
        INSERT INTO sensor_logs (
            device_id,
            current,
            vibration,
            created_at
        )
        VALUES (?, ?, ?, ?)
        """,
        (
            device_id,
            current,
            vibration,
            timestamp
        )
    )


    # ======================================
    # 현재 건조기 상태 저장
    #
    # 해당 device_id가 없으면 INSERT
    # 있으면 UPDATE
    # ======================================
    conn.execute(
        """
        INSERT INTO devices (
            device_id,
            current,
            vibration,
            state,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?)

        ON CONFLICT(device_id)

        DO UPDATE SET
            current = excluded.current,
            vibration = excluded.vibration,
            state = excluded.state,
            updated_at = excluded.updated_at
        """,
        (
            device_id,
            current,
            vibration,
            state,
            timestamp
        )
    )


    conn.commit()
    conn.close()


    # ESP32에게 응답
    return jsonify({
        "message": "sensor value saved",
        "device_id": device_id,
        "current": current,
        "vibration": vibration,
        "state": state
    }), 201


# ==========================================
# 금속 탐지 센서값 저장
#
# POST /api/metal/dryer01
#
# JSON 예시
# {
#     "detected": true
# }
# ==========================================
@app.route("/api/metal/<device_id>", methods=["POST"])
def save_metal(device_id):

    data = request.get_json(silent=True)


    if not data or "detected" not in data:

        return jsonify({
            "error": "detected is required"
        }), 400


    detected = data["detected"]


    # true / false 값인지 확인
    if not isinstance(detected, bool):

        return jsonify({
            "error": "detected must be true or false"
        }), 400


    timestamp = now()

    conn = get_db()


    # ======================================
    # 금속 센서 로그 저장
    # ======================================
    conn.execute(
        """
        INSERT INTO metal_logs (
            device_id,
            detected,
            created_at
        )
        VALUES (?, ?, ?)
        """,
        (
            device_id,
            int(detected),
            timestamp
        )
    )


    # ======================================
    # 현재 건조기 금속 탐지 상태 업데이트
    # ======================================
    conn.execute(
        """
        INSERT INTO devices (
            device_id,
            metal_detected,
            updated_at
        )
        VALUES (?, ?, ?)

        ON CONFLICT(device_id)

        DO UPDATE SET
            metal_detected = excluded.metal_detected,
            updated_at = excluded.updated_at
        """,
        (
            device_id,
            int(detected),
            timestamp
        )
    )


    conn.commit()
    conn.close()


    return jsonify({
        "message": "metal value saved",
        "device_id": device_id,
        "detected": detected
    }), 201


# ==========================================
# 건조기 상태 조회
#
# 전체 조회
# GET /api/situation
#
# 사용 중 조회
# GET /api/situation?state=used
#
# 사용 가능 조회
# GET /api/situation?state=idle
# ==========================================
@app.route("/api/situation", methods=["GET"])
def get_situation():

    state = request.args.get("state")

    conn = get_db()


    # state 값이 있을 경우
    if state:

        rows = conn.execute(
            """
            SELECT
                device_id,
                current,
                vibration,
                metal_detected,
                state,
                updated_at

            FROM devices

            WHERE state = ?

            ORDER BY device_id
            """,
            (state,)
        ).fetchall()


    # state 값이 없으면 전체 조회
    else:

        rows = conn.execute(
            """
            SELECT
                device_id,
                current,
                vibration,
                metal_detected,
                state,
                updated_at

            FROM devices

            ORDER BY device_id
            """
        ).fetchall()


    conn.close()


    devices = [
        dict(row)
        for row in rows
    ]


    return jsonify({
        "count": len(devices),
        "state": state,
        "devices": devices
    })


# ==========================================
# 로컬에서 python app.py로 실행할 때
# ==========================================
if __name__ == "__main__":

    port = int(
        os.environ.get(
            "PORT",
            5000
        )
    )

    app.run(
        host="0.0.0.0",
        port=port,
        debug=True
    )