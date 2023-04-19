import { IncomingMessage } from "http";
import WebSocket, { WebSocketServer } from "ws";

const PORT = 8888;

const socketServer = new WebSocketServer({
	port: PORT,
	path: "/ws-test",
});

socketServer.on("connection", (ws: WebSocket, req: IncomingMessage) => {
	// nginx 代理后
	// const ip = req.headers["x-forwarded-for"].split(",")[0].trim();
	const {
		remoteAddress: ip,
		readyState,
		remoteFamily,
		remotePort,
	} = req.socket;
	console.log(
		`server connection: 与客户端连接成功: ${readyState} ${ip} ${remoteFamily}`
	);

	ws.on("message", (message: WebSocket.RawData, req: IncomingMessage) => {
		const clientData = message.toString();
		console.log("server message: ", clientData);

		// 客户端发送心跳数据, 如果是ping则回应 pong
		const sendData = (clientData === "ping") 
      ? `pong ${Date.now()}` 
      : `server date ${message}`;

		ws.send(sendData, (err: Error | void) => {
			if (err) {
				console.log("send message error: ", err);
			}
		});
	});

	ws.on("close", (code: number) => {
		console.log("server close", code);
	});
});
