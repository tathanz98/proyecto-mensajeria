import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Trash2, X } from 'lucide-react';
import { apiUrl } from '../api';

export default function OrderChat({ orderId, onClose }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const listRef = useRef(null);

  const loadMessages = useCallback(async () => {
    try {
      const response = await fetch(apiUrl(`/api/orders/${orderId}/messages`));
      const data = await response.json();
      if (response.ok) setMessages(data);
    } catch {
      setError('No se pudo actualizar el chat.');
    }
  }, [orderId]);

  useEffect(() => {
    const initialLoad = setTimeout(() => { loadMessages(); }, 0);
    const interval = setInterval(loadMessages, 4000);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, [loadMessages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!draft.trim()) return;
    setError('');
    try {
      const response = await fetch(apiUrl(`/api/orders/${orderId}/messages`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft, senderRole: 'COURIER' })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessages(current => [...current, data]);
      setDraft('');
    } catch (messageError) {
      setError(messageError.message || 'No se pudo enviar el mensaje.');
    }
  };

  const clearChat = async () => {
    if (!window.confirm('¿Eliminar todos los mensajes de esta conversación?')) return;
    try {
      const response = await fetch(apiUrl(`/api/orders/${orderId}/messages`), { method: 'DELETE' });
      if (!response.ok) throw new Error();
      setMessages([]);
    } catch {
      setError('No se pudo eliminar el chat.');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,0.96)', display: 'flex', flexDirection: 'column' }}>
      <header className="top-nav">
        <div><strong>Chat con el cliente</strong><p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Pedido activo</p></div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={clearChat} title="Borrar conversación" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={21} /></button>
          <button onClick={onClose} title="Cerrar chat" style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}><X size={24} /></button>
        </div>
      </header>
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {!messages.length && <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '36px' }}>Aún no hay mensajes. Saluda al cliente para coordinar la entrega.</p>}
        {messages.map(message => (
          <div key={message.id} style={{ alignSelf: message.senderRole === 'COURIER' ? 'flex-end' : 'flex-start', maxWidth: '82%', padding: '10px 14px', borderRadius: '14px', background: message.senderRole === 'COURIER' ? 'var(--primary)' : 'var(--bg-surface)', color: 'white' }}>
            <p>{message.content}</p>
            <small style={{ display: 'block', marginTop: '4px', opacity: 0.75, fontSize: '0.65rem' }}>{message.senderRole === 'COURIER' ? 'Tú' : 'Cliente'}</small>
          </div>
        ))}
      </div>
      <form onSubmit={sendMessage} style={{ padding: '14px', display: 'flex', gap: '10px', borderTop: '1px solid var(--border-color)' }}>
        <input className="input-field" value={draft} onChange={event => setDraft(event.target.value)} placeholder="Escribe un mensaje" maxLength={1000} />
        <button className="btn-primary" type="submit" style={{ width: '52px', padding: 0 }} title="Enviar"><Send size={20} /></button>
      </form>
      {error && <p style={{ color: 'var(--danger)', padding: '0 14px 12px', fontSize: '0.8rem' }}>{error}</p>}
    </div>
  );
}
