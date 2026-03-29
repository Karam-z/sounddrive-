# SoundDrive

AI-powered vehicle engine fault detection via audio analysis.

## What it does

SoundDrive lets users record vehicle engine audio and submit it for analysis.  
The system extracts MFCC features from the audio, runs a machine learning classifier, and returns an engine health result:
- `Normal`
- `Warning`
- `Fault Detected`

Each result includes a confidence score to indicate prediction certainty.

## Project structure

```text
sounddrive-/
├── backend/   # FastAPI backend + ML model services
├── web/       # React + Vite web application
└── mobile/    # React Native + Expo mobile application
```

## How to run

### 1) Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Backend runs on `http://localhost:8000`.

### 2) Web app (React + Vite)

```bash
cd web
npm install
npm run dev
```

Web app runs on the local Vite dev URL (usually `http://localhost:5173`).

### 3) Mobile app (React Native + Expo)

```bash
cd mobile
npm install
npx expo start
```

Then open the app in Expo Go, an emulator, or web preview.

## Tech stack

- Python
- FastAPI
- librosa
- scikit-learn
- SQLite
- React
- Vite
- React Native
- Expo

## Research

See the research paper in `/docs` for the full academic write-up.