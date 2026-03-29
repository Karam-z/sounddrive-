import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

function App() {
  const [isRecording, setIsRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')

  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const canvasRef = useRef(null)

  const statusColor = useMemo(() => {
    if (!result?.status) return '#3b82f6'
    if (result.status === 'Normal') return '#22c55e'
    if (result.status === 'Warning') return '#f97316'
    return '#ef4444'
  }, [result])

  useEffect(() => {
    let intervalId
    if (isRecording) {
      intervalId = window.setInterval(() => {
        setSeconds((prev) => prev + 1)
      }, 1000)
    }
    return () => {
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [isRecording])

  useEffect(() => {
    fetchHistory()
  }, [])

  useEffect(() => {
    if (!result?.spectrogram_data || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rows = result.spectrogram_data.length
    const cols = result.spectrogram_data[0]?.length ?? 0
    if (!rows || !cols) return

    const width = canvas.width
    const height = canvas.height
    const cellW = width / cols
    const cellH = height / rows

    ctx.clearRect(0, 0, width, height)

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const value = Math.max(0, Math.min(1, Number(result.spectrogram_data[r][c] ?? 0)))
        ctx.fillStyle = spectrogramColor(value)
        ctx.fillRect(c * cellW, r * cellH, cellW, cellH)
      }
    }
  }, [result])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const formatTimestamp = (isoTime) => {
    const date = new Date(isoTime)
    if (Number.isNaN(date.getTime())) return isoTime
    return date.toLocaleString()
  }

  async function fetchHistory() {
    try {
      const response = await fetch('http://localhost:8000/history')
      if (!response.ok) {
        throw new Error('Failed to load history.')
      }
      const data = await response.json()
      setHistory(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load history.')
    }
  }

  async function startRecording() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      streamRef.current = stream
      setSeconds(0)
      setIsRecording(true)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Microphone access failed. Please check permissions.',
      )
    }
  }

  async function stopAndAnalyze() {
    if (!mediaRecorderRef.current) return
    setError('')
    setIsAnalyzing(true)
    setIsRecording(false)

    const recorder = mediaRecorderRef.current
    const stream = streamRef.current

    const blobPromise = new Promise((resolve) => {
      recorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        resolve(audioBlob)
      }
    })

    recorder.stop()
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null

    try {
      const audioBlob = await blobPromise
      const formData = new FormData()
      formData.append('file', audioBlob, `recording-${Date.now()}.webm`)

      const response = await fetch('http://localhost:8000/analyze', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Analyze request failed.')
      }

      const data = await response.json()
      setResult(data)
      await fetchHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to analyze recording.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <main className="app">
      <header className="header">
        <h1>SoundDrive</h1>
        <p>Engine Health Monitor</p>
      </header>

      <section className="card record-card">
        <button
          type="button"
          className={`record-btn ${isRecording ? 'recording' : ''}`}
          onClick={startRecording}
          disabled={isRecording || isAnalyzing}
        >
          <span className="record-dot" />
          {isRecording ? 'Recording...' : 'Start Recording'}
        </button>

        {isRecording && <div className="timer">{formatTimer(seconds)}</div>}

        {isRecording && (
          <button type="button" className="stop-btn" onClick={stopAndAnalyze}>
            Stop &amp; Analyze
          </button>
        )}

        {isAnalyzing && (
          <div className="analyzing">
            <div className="spinner" />
            <span>Analyzing audio...</span>
          </div>
        )}

        {error && <p className="error">{error}</p>}
      </section>

      {result && (
        <section className="card result-card">
          <div className="result-top">
            <h2>Latest Result</h2>
            <span className="status" style={{ color: statusColor }}>
              {result.status}
            </span>
          </div>

          <div className="progress-wrap">
            <div className="progress-label">
              <span>Confidence</span>
              <span>{result.confidence}%</span>
            </div>
            <div className="progress-track">
              <div
                className="progress-bar"
                style={{
                  width: `${result.confidence}%`,
                  backgroundColor: statusColor,
                }}
              />
            </div>
          </div>

          <div className="spectrogram">
            <h3>Spectrogram</h3>
            <canvas ref={canvasRef} width={400} height={240} />
          </div>
        </section>
      )}

      <section className="card history-card">
        <h2>History</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>File</th>
                <th>Status</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan="4" className="empty">
                    No scans yet.
                  </td>
                </tr>
              ) : (
                history.map((item, idx) => (
                  <tr key={`${item.timestamp}-${idx}`}>
                    <td>{formatTimestamp(item.timestamp)}</td>
                    <td>{item.filename}</td>
                    <td>{item.status}</td>
                    <td>{item.confidence}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

function spectrogramColor(value) {
  const low = { r: 8, g: 47, b: 73 }
  const high = { r: 253, g: 224, b: 71 }
  const r = Math.round(low.r + (high.r - low.r) * value)
  const g = Math.round(low.g + (high.g - low.g) * value)
  const b = Math.round(low.b + (high.b - low.b) * value)
  return `rgb(${r}, ${g}, ${b})`
}

export default App
