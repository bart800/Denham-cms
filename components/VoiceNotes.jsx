'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

const B = {
  navy: "#000066", gold: "#ebb003", green: "#386f4a",
  card: "#0d0d30", bdr: "#1a1a4e", txt: "#e0e0e0",
  txtM: "#8888a0", txtD: "#555570", white: "#fff",
  danger: "#cc3333", bg: "#050520",
};

const S = {
  card: { background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 12, padding: 20, marginBottom: 16 },
  btn: { padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 13 },
  mono: { fontFamily: "'JetBrains Mono','Fira Code',monospace" },
};

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTimestamp(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export default function VoiceNotes({ caseId, user }) {
  const [recording, setRecording] = useState(false);
  const [timer, setTimer] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [transcribing, setTranscribing] = useState(false);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mediaRecorder = useRef(null);
  const timerRef = useRef(null);
  const chunks = useRef([]);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/voice-notes`);
      const data = await res.json();
      if (data.notes) setNotes(data.notes);
    } catch {
      console.error('Failed to fetch voice notes');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4' });
      chunks.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: recorder.mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      mediaRecorder.current = recorder;
      setRecording(true);
      setTimer(0);
      setAudioBlob(null);
      setAudioUrl(null);
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } catch (err) {
      setError('Microphone access denied. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }
    setRecording(false);
    clearInterval(timerRef.current);
  };

  const discardRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setTimer(0);
  };

  const transcribeAndSave = async () => {
    if (!audioBlob) return;
    setTranscribing(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('audio', audioBlob, 'recording.webm');
      if (user?.id) form.append('author_id', user.id);

      const res = await fetch(`/api/cases/${caseId}/voice-notes`, { method: 'POST', body: form });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Transcription failed');
        return;
      }

      discardRecording();
      fetchNotes();
    } catch {
      setError('Failed to transcribe. Please try again.');
    } finally {
      setTranscribing(false);
    }
  };

  return (
    <div>
      {/* Recorder */}
      <div style={S.card}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: B.gold, margin: '0 0 16px 0' }}>🎙️ Voice Notes</h3>

        {error && (
          <div style={{ background: `${B.danger}20`, border: `1px solid ${B.danger}40`, borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: B.danger, fontSize: 13 }}>
            {error}
          </div>
        )}

        {!recording && !audioBlob && (
          <button onClick={startRecording} style={{ ...S.btn, background: B.danger, color: B.white, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: B.white, display: 'inline-block' }} />
            Start Recording
          </button>
        )}

        {recording && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: B.danger, animation: 'pulse 1s infinite', display: 'inline-block' }} />
            <span style={{ ...S.mono, fontSize: 20, color: B.white, fontWeight: 700 }}>{formatTime(timer)}</span>
            <button onClick={stopRecording} style={{ ...S.btn, background: B.txtD, color: B.white }}>
              ⏹ Stop
            </button>
          </div>
        )}

        {audioBlob && !recording && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ ...S.mono, fontSize: 13, color: B.txtM }}>{formatTime(timer)} recorded</span>
            </div>
            <audio controls src={audioUrl} style={{ width: '100%', maxWidth: 400 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={transcribeAndSave} disabled={transcribing}
                style={{ ...S.btn, background: B.gold, color: '#000', opacity: transcribing ? 0.6 : 1 }}>
                {transcribing ? '⏳ Transcribing...' : '✨ Transcribe & Save'}
              </button>
              <button onClick={discardRecording} disabled={transcribing}
                style={{ ...S.btn, background: 'transparent', border: `1px solid ${B.bdr}`, color: B.txtM }}>
                Discard
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Past Voice Notes */}
      <div style={S.card}>
        <h4 style={{ fontSize: 14, fontWeight: 600, color: B.txtM, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Past Voice Notes {notes.length > 0 && <span style={{ ...S.mono, fontSize: 11, color: B.gold }}>({notes.length})</span>}
        </h4>

        {loading && <div style={{ color: B.txtM, fontSize: 13, padding: 20, textAlign: 'center' }}>Loading voice notes...</div>}

        {!loading && notes.length === 0 && (
          <div style={{ color: B.txtD, fontSize: 13, padding: 20, textAlign: 'center' }}>No voice notes yet. Record one above!</div>
        )}

        {notes.map(note => (
          <div key={note.id} style={{ padding: '12px 0', borderBottom: `1px solid ${B.bdr}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {note.author && (
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%', display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
                    background: note.author.color || B.gold, color: '#000',
                  }}>
                    {note.author.initials || '?'}
                  </span>
                )}
                <span style={{ fontSize: 12, fontWeight: 600, color: B.txt }}>{note.author?.name || 'Unknown'}</span>
              </div>
              <span style={{ ...S.mono, fontSize: 11, color: B.txtD }}>{formatTimestamp(note.created_at)}</span>
            </div>
            <p style={{ fontSize: 13, color: B.txt, lineHeight: 1.5, margin: 0 }}>{note.content}</p>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
