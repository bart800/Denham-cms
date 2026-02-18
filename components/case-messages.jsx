'use client';
import React, { useState, useEffect, useRef } from 'react';
import { supabaseAdmin, supabase } from '../lib/supabase';

const B = {
  navy: "#000066", gold: "#ebb003", green: "#386f4a",
  bg: "#08080f", card: "#111119", bdr: "#1e1e2e",
  txt: "#e8e8f0", txtM: "#8888a0", txtD: "#55556a",
};

/**
 * CaseMessages — Firm-side messaging panel for a case.
 * Usage: <CaseMessages caseId={selectedCase.id} />
 * Place in case detail view alongside other tabs.
 */
export default function CaseMessages({ caseId }) {
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const db = supabaseAdmin || supabase;

  const load = async () => {
    if (!caseId || !db) return;
    setLoading(true);
    const { data } = await db
      .from('portal_messages')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: true });
    setMessages(data || []);

    // Mark client messages as read
    await db.from('portal_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('case_id', caseId)
      .eq('sender_type', 'client')
      .is('read_at', null);

    setLoading(false);
  };

  useEffect(() => { load(); }, [caseId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    if (!newMsg.trim() || !db) return;
    setSending(true);
    const { data, error } = await db.from('portal_messages').insert({
      case_id: caseId,
      sender_type: 'firm',
      message: newMsg.trim(),
    }).select('*').single();
    if (data) { setMessages(prev => [...prev, data]); setNewMsg(''); }
    if (error) console.error('Send error:', error);
    setSending(false);
  };

  const fmtTime = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return (
    <div style={{ background: B.card, border: `1px solid ${B.bdr}`, borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: B.txt, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>💬</span> Client Messages
        </div>
        <button onClick={load} style={{ background: 'transparent', border: `1px solid ${B.bdr}`, borderRadius: 6, padding: '4px 10px', fontSize: 11, color: B.txtM, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
          Refresh
        </button>
      </div>

      <div style={{ maxHeight: 350, overflowY: 'auto', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && <div style={{ textAlign: 'center', color: B.txtD, fontSize: 12, padding: 20 }}>Loading...</div>}
        {!loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', color: B.txtD, fontSize: 12, padding: 20 }}>No messages with this client yet.</div>
        )}
        {messages.map(m => (
          <div key={m.id} style={{ display: 'flex', justifyContent: m.sender_type === 'firm' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '75%', padding: '10px 14px', borderRadius: 12,
              background: m.sender_type === 'firm' ? B.navy : '#1a1a2a',
              borderBottomRightRadius: m.sender_type === 'firm' ? 2 : 12,
              borderBottomLeftRadius: m.sender_type === 'client' ? 2 : 12,
            }}>
              <div style={{ fontSize: 10, color: B.txtD, marginBottom: 4, fontWeight: 600 }}>
                {m.sender_type === 'firm' ? 'Firm' : 'Client'} · {fmtTime(m.created_at)}
              </div>
              <div style={{ fontSize: 13, color: B.txt, lineHeight: 1.4 }}>{m.message}</div>
              {m.read_at && (
                <div style={{ fontSize: 9, color: B.txtD, marginTop: 2, textAlign: 'right' }}>✓ Read {fmtTime(m.read_at)}</div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Reply to client..."
          style={{ flex: 1, background: '#0a0a14', border: `1px solid ${B.bdr}`, borderRadius: 6, padding: '10px 14px', color: B.txt, fontSize: 13, outline: 'none', fontFamily: "'DM Sans',sans-serif" }}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()} />
        <button onClick={send} disabled={sending || !newMsg.trim()}
          style={{ background: B.gold, color: '#000', border: 'none', borderRadius: 6, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: sending || !newMsg.trim() ? 0.5 : 1, fontFamily: "'DM Sans',sans-serif" }}>
          {sending ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
