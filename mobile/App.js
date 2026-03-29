import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const API_BASE = 'http://10.60.17.227:8000';

export default function App() {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef(null);
  const pulseLoopRef = useRef(null);

  const statusColor = useMemo(() => {
    if (!result?.status) return '#3b82f6';
    if (result.status === 'Normal') return '#22c55e';
    if (result.status === 'Warning') return '#f97316';
    return '#ef4444';
  }, [result]);

  useEffect(() => {
    initializeAudio();
    fetchHistory();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (pulseLoopRef.current) {
        pulseLoopRef.current.stop();
      }
    };
  }, []);

  const initializeAudio = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      const granted = permission.status === 'granted';
      setPermissionGranted(granted);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      if (!granted) {
        setError('Microphone permission is required to record audio.');
      }
    } catch (err) {
      setError('Failed to initialize audio settings.');
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${API_BASE}/history`);
      if (!response.ok) {
        throw new Error('History request failed');
      }
      const data = await response.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to fetch history.');
    }
  };

  const startPulse = () => {
    pulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoopRef.current.start();
  };

  const stopPulse = () => {
    if (pulseLoopRef.current) {
      pulseLoopRef.current.stop();
    }
    pulseAnim.setValue(1);
  };

  const startTimer = () => {
    setSeconds(0);
    timerRef.current = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    setError('');

    if (!permissionGranted) {
      setError('Microphone permission is required to record audio.');
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(newRecording);
      setIsRecording(true);
      startPulse();
      startTimer();
    } catch (err) {
      setError('Failed to start recording.');
    }
  };

  const stopAndAnalyze = async () => {
    if (!recording) return;

    setError('');
    setIsAnalyzing(true);

    try {
      stopTimer();
      stopPulse();
      setIsRecording(false);

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        throw new Error('No recording file URI found.');
      }

      const formData = new FormData();
      formData.append('file', {
        uri,
        name: `recording-${Date.now()}.m4a`,
        type: 'audio/m4a',
      });

      const response = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Analyze request failed.');
      }

      const data = await response.json();
      setResult(data);
      await fetchHistory();
    } catch (err) {
      setError('Failed to analyze audio.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatTimer = (value) => {
    const mins = Math.floor(value / 60);
    const secs = value % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const valueToColor = (value) => {
    const safe = Math.max(0, Math.min(1, Number(value) || 0));
    const rg = Math.round(255 * safe);
    const b = Math.round(255 * (1 - safe));
    return `rgb(${rg}, ${rg}, ${b})`;
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return String(timestamp || '');
    return date.toLocaleString();
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>SoundDrive</Text>
          <Text style={styles.subtitle}>Engine Health Monitor</Text>
        </View>

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.recordButtonWrap}
            onPress={startRecording}
            disabled={isRecording || isAnalyzing}
            activeOpacity={0.85}
          >
            <Animated.View
              style={[
                styles.recordButton,
                isRecording && styles.recordingButton,
                isRecording && { opacity: pulseAnim },
                (isRecording || isAnalyzing) && styles.disabledButton,
              ]}
            >
              <Text style={styles.recordButtonText}>
                {isRecording ? 'Recording...' : 'Start Recording'}
              </Text>
            </Animated.View>
          </TouchableOpacity>

          {isRecording && <Text style={styles.timer}>{formatTimer(seconds)}</Text>}

          {isRecording && (
            <TouchableOpacity style={styles.stopButton} onPress={stopAndAnalyze}>
              <Text style={styles.stopButtonText}>Stop &amp; Analyze</Text>
            </TouchableOpacity>
          )}

          {isAnalyzing && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color="#ffffff" />
              <Text style={styles.loadingText}>Analyzing audio...</Text>
            </View>
          )}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {result ? (
          <View style={styles.card}>
            <View style={styles.resultHeader}>
              <Text style={styles.sectionTitle}>Latest Result</Text>
              <Text style={[styles.statusText, { color: statusColor }]}>{result.status}</Text>
            </View>

            <Text style={styles.confidenceLabel}>Confidence: {result.confidence}%</Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.max(0, Math.min(100, Number(result.confidence) || 0))}%`,
                    backgroundColor: statusColor,
                  },
                ]}
              />
            </View>

            <Text style={styles.sectionTitle}>Spectrogram</Text>
            <View style={styles.spectrogramGrid}>
              {Array.isArray(result.spectrogram_data) &&
                result.spectrogram_data.flatMap((row, rowIndex) =>
                  Array.isArray(row)
                    ? row.map((cell, colIndex) => (
                        <View
                          key={`${rowIndex}-${colIndex}`}
                          style={[
                            styles.cell,
                            {
                              backgroundColor: valueToColor(cell),
                            },
                          ]}
                        />
                      ))
                    : [],
                )}
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>History</Text>
          {history.map((item, index) => {
            const rowColor =
              item.status === 'Normal'
                ? '#22c55e'
                : item.status === 'Warning'
                  ? '#f97316'
                  : '#ef4444';

            return (
              <View key={`${item.timestamp}-${index}`} style={styles.historyCard}>
                <Text style={styles.historyTime}>{formatTimestamp(item.timestamp)}</Text>
                <Text style={[styles.historyStatus, { color: rowColor }]}>{item.status}</Text>
                <Text style={styles.historyConfidence}>Confidence: {item.confidence}%</Text>
              </View>
            );
          })}
          {history.length === 0 ? <Text style={styles.emptyText}>No scans yet.</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  container: {
    padding: 16,
    paddingBottom: 28,
    gap: 14,
  },
  header: {
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 6,
    color: '#9ca3af',
    fontSize: 15,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  recordButtonWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#3a3a3a',
  },
  recordingButton: {
    backgroundColor: '#7f1d1d',
    borderColor: '#b91c1c',
  },
  disabledButton: {
    opacity: 0.8,
  },
  recordButtonText: {
    color: '#f9fafb',
    fontWeight: '700',
    fontSize: 18,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  timer: {
    marginTop: 10,
    textAlign: 'center',
    color: '#e5e7eb',
    fontSize: 20,
    fontWeight: '700',
  },
  stopButton: {
    marginTop: 12,
    alignSelf: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  stopButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  loadingWrap: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#e5e7eb',
    marginLeft: 8,
    fontSize: 14,
  },
  errorText: {
    color: '#fda4af',
    textAlign: 'center',
    fontSize: 14,
    marginTop: -4,
    marginBottom: 4,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#f3f4f6',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '800',
  },
  confidenceLabel: {
    color: '#d1d5db',
    marginBottom: 8,
    fontSize: 14,
  },
  progressTrack: {
    width: '100%',
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3f3f46',
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
  },
  spectrogramGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: '#323232',
    borderRadius: 8,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  cell: {
    width: '5%',
    aspectRatio: 1,
  },
  historyCard: {
    backgroundColor: '#232323',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2f2f2f',
  },
  historyTime: {
    color: '#d1d5db',
    fontSize: 12,
    marginBottom: 4,
  },
  historyStatus: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  historyConfidence: {
    color: '#e5e7eb',
    fontSize: 13,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
  },
});
