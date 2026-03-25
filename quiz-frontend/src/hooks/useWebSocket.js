// GameEngine WebSocket bağlantısını yönetir
import { useEffect, useRef, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

import { WS_URL } from '../config';

export function useWebSocket({ gameId, onMessage, subscriptions = [] }) {
  const clientRef = useRef(null);
  const handlersRef = useRef(onMessage);

  useEffect(() => {
    handlersRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!gameId) return;

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 3000,
      onConnect: () => {
        console.log('WebSocket bağlandı');
        subscriptions.forEach(({ topic }) => {
          client.subscribe(topic, (msg) => {
            try {
              const data = JSON.parse(msg.body);
              handlersRef.current?.(data);
            } catch (e) {
              console.error('Mesaj parse hatası:', e);
            }
          });
        });
      },
      onDisconnect: () => console.log('WebSocket bağlantısı kesildi'),
      onStompError: (err) => console.error('STOMP hatası:', err),
    });

    client.activate();
    clientRef.current = client;

    return () => client.deactivate();
    // eslint-disable-next-line
  }, [gameId]);

  const send = useCallback((destination, body) => {
    if (clientRef.current?.connected) {
      clientRef.current.publish({
        destination,
        body: JSON.stringify(body),
      });
    }
  }, []);

  return { send, client: clientRef };
}
