import { ClientMessage, ServerMessage } from './protocol';

type MessageHandler = (msg: ServerMessage) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 1000;
  private reconnectTimer: number | null = null;
  private shouldReconnect = false;
  private activeConnectionId = 0;

  connect(url: string): Promise<void> {
    this.shouldReconnect = true;
    this.clearReconnectTimer();

    if (this.ws) {
      this.closeSocket(false);
    }

    const connectionId = ++this.activeConnectionId;

    return new Promise((resolve, reject) => {
      let settled = false;

      try {
        const socket = new WebSocket(url);
        this.ws = socket;

        socket.onopen = () => {
          if (connectionId !== this.activeConnectionId) {
            socket.close();
            return;
          }
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          settled = true;
          resolve();
        };

        socket.onmessage = (event) => {
          if (connectionId !== this.activeConnectionId) {
            return;
          }
          try {
            const msg: ServerMessage = JSON.parse(event.data);
            this.emit(msg.type, msg);
            this.emit('*', msg);
          } catch (e) {
            console.error('Failed to parse message:', e);
          }
        };

        socket.onclose = () => {
          if (connectionId !== this.activeConnectionId) {
            return;
          }

          if (this.ws === socket) {
            this.ws = null;
          }

          console.log('WebSocket disconnected');
          this.emit('disconnected', { type: 'ERROR' } as ServerMessage);

          if (this.shouldReconnect) {
            this.attemptReconnect(url);
          }
        };

        socket.onerror = (error) => {
          if (connectionId !== this.activeConnectionId) {
            return;
          }
          console.error('WebSocket error:', error);
          if (!settled) {
            settled = true;
            reject(error);
          }
        };
      } catch (error) {
        if (!settled) {
          settled = true;
          reject(error);
        }
      }
    });
  }

  private attemptReconnect(url: string) {
    if (!this.shouldReconnect) {
      return;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting... attempt ${this.reconnectAttempts}`);
      const delay = this.reconnectDelay * this.reconnectAttempts;
      this.reconnectTimer = window.setTimeout(() => {
        if (!this.shouldReconnect) {
          return;
        }
        this.connect(url).catch((err) => console.error('Reconnect failed:', err));
      }, delay);
    }
  }

  private closeSocket(allowReconnect: boolean) {
    if (!this.ws) {
      return;
    }

    const socket = this.ws;
    this.ws = null;

    if (!allowReconnect) {
      socket.onclose = null;
    }

    socket.close();
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  send(msg: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  off(type: string, handler: MessageHandler) {
    const handlers = this.handlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(type: string, msg: ServerMessage) {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.forEach(handler => handler(msg));
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();
    this.closeSocket(false);
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export const wsClient = new WebSocketClient();
