interface WebSocketMessageEvent extends Event {
  data?: any;
}
interface WebSocketErrorEvent extends Event {
  message: string;
}
interface WebSocketCloseEvent extends Event {
  code?: number | undefined;
  reason?: string | undefined;
  message?: string | undefined;
}