declare type WebSocketState = {
  alive: boolean;
  message: string;
  ws: WebSocket;
  readyState: number;
}

declare type WebSocketEvent = "onopen" | "onclose" | "onerror" | "onmessage";

declare type sendType = string | ArrayBufferLike | Blob | ArrayBufferView