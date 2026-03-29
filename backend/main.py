import random
import sqlite3
from datetime import datetime, timezone

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="SoundDrive Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "sounddrive.db"
MOCK_RESULTS = [
    {"status": "Normal", "confidence": 94},
    {"status": "Warning", "confidence": 71},
    {"status": "Fault Detected", "confidence": 88},
]


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                filename TEXT NOT NULL,
                status TEXT NOT NULL,
                confidence INTEGER NOT NULL
            )
            """
        )
        conn.commit()


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)) -> dict:
    selected = random.choice(MOCK_RESULTS)
    timestamp = datetime.now(timezone.utc).isoformat()

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO analyses (timestamp, filename, status, confidence)
            VALUES (?, ?, ?, ?)
            """,
            (timestamp, file.filename, selected["status"], selected["confidence"]),
        )
        conn.commit()

    spectrogram_data = [
        [round(random.random(), 4) for _ in range(20)] for _ in range(20)
    ]

    return {
        "timestamp": timestamp,
        "filename": file.filename,
        "status": selected["status"],
        "confidence": selected["confidence"],
        "spectrogram_data": spectrogram_data,
    }


@app.get("/history")
def history() -> list[dict]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT timestamp, filename, status, confidence
            FROM analyses
            ORDER BY id DESC
            LIMIT 10
            """
        ).fetchall()

    return [dict(row) for row in rows]


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
