type EventObjType = {
    event: Event;
};
export type EventParams = WebSocketState & EventObjType;
export type WebSocketOperatorOption = {
    /**
     * websocket 连接url
     */
    url: string;
    /**
     * 心跳间隔
     */
    heartbeatInterval: number;
    /**
     * 客户端心跳值(发送给服务端)
     */
    heartbeatData: string;
    /**
     * 服务端心跳回应数据(客户端接收到的)
     */
    heartbeatResult: string;
    /**
     * 重试间隔时长
     */
    reconnectInterval: number;
    /**
     * 最大失败重试次数
     */
    maxReconnectionNum: number;
};
export default class WebSocketOperator {
    #private;
    opt: Partial<WebSocketOperatorOption> & {
        url: string;
    };
    private static reconnectionInstance;
    private static isDebug;
    /**
     * WebSocket 实例
     */
    ws: WebSocket;
    option: WebSocketOperatorOption;
    constructor(opt: Partial<WebSocketOperatorOption> & {
        url: string;
    });
    /**
   * WebSocket 兼容性判断
   */
    static isCompatibleWebSocket(): Promise<void>;
    private static log;
    /**
     * 初始化
     */
    protected init(): void;
    onopen(ws: EventParams): void;
    onmessage(ws: EventParams): void;
    onclose(ws: EventParams): void;
    onerror(ws: EventParams): void;
    onheartbeat(ws: EventParams): void;
    onreconnection(ws: EventParams): void;
    ondestroy(ws: EventParams): void;
    onmaxReconnection(ws: EventParams): void;
    protected bindEvent(event: WebSocketEvent, listener: (e: CloseEvent | Event | any) => void): this;
    protected $triggerFn(key: WebSocketEvent | "onreconnection" | "onheartbeat" | "ondestroy" | "onmaxReconnection", event: Event): void;
    protected $onopenOperator(e: Event): void;
    protected $onmessageOperator(e: Event | MessageEvent<any>): void;
    protected $oncloseOperator(e: CloseEvent): void;
    protected $onerrorOperator(e: Event): void;
    /**
   * 发送数据
   */
    send(msg: sendType): Promise<Error | void>;
    /**
     * 关闭 WebSocket
     */
    close(code?: number, reason?: string): void;
    /**
   * 获取 WebSocket 的状态
   */
    getWebSocketState(): WebSocketState;
    /**
   * 发送心跳
   */
    startHeartbeat(): void;
    /**
   * 停止心跳
   */
    endHeartbeat(): void;
    /**
   * 重新创建实例
   */
    reconnection(interval?: number, url?: string): void;
    /**
   * 停止重试
   */
    endReconnection(): void;
    /**
   * 根据重试次数计算重试间隔
   */
    calcReconnectionInterval(): number;
    /**
   * 销毁
   */
    destroy(code?: number, reason?: string): void;
    get url(): string;
    set url(url: string);
    get heartbeatResult(): string;
    get heartbeatInterval(): number;
    set heartbeatInterval(heartbeatInterval: number);
    get heartbeatData(): string;
    set heartbeatData(heartbeatData: string);
    get reconnectInterval(): number;
    set reconnectInterval(reconnectInterval: number);
    get maxReconnectionNum(): number;
    set maxReconnectionNum(maxReconnectionNum: number);
}
export {};
