import type { Response } from 'express';

const clients = new Set<Response>();

export function addSseClient(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write(`event: connected\ndata: ${JSON.stringify({ ts: new Date().toISOString(), onlineDrivers: 184 + clients.size })}\n\n`);
  clients.add(res);

  res.on('close', () => {
    clients.delete(res);
  });
}

export function broadcastEvent(event: string, payload: unknown): void {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    try {
      client.write(message);
    } catch {
      clients.delete(client);
    }
  }
}

export function getActiveClientCount(): number {
  return clients.size;
}

// Keepalive heartbeat every 25s so proxies don't close idle connections
setInterval(() => {
  if (clients.size === 0) return;
  const ping = `event: heartbeat\ndata: ${JSON.stringify({ ts: new Date().toISOString(), onlineDrivers: 184 + clients.size })}\n\n`;
  for (const client of clients) {
    try {
      client.write(ping);
    } catch {
      clients.delete(client);
    }
  }
}, 25000).unref();
