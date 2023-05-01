type WebSocketEvent = "onopen" | "onclose" | "onerror" | "onmessage";
/**
 * 当前 WebSocket 的状态
 */
type WebSocketState = {
    /**
     * 是否存活
     */
    alive: boolean;
    /**
     * 信息
     */
    message: string;
    /**
     * WebSocket 实例
     */
    ws: WebSocket;
    /**
     * 同 WebSocket 的 readyState
     */
    readyState: number;
    /**
     * 错误重试次数
     */
    ReconnectionNum?: number;
};
/**
 * 发送的数据格式
 */
type sendType = string | ArrayBufferLike | Blob | ArrayBufferView;
export type EventParams = WebSocketState & {
    event: Event;
};
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
     * 重试加快(重试次数越多, 则下次重试时间越快)
     */
    isSpeedUp: boolean;
    /**
     * 最大失败重试次数, (-1就是无限重试, 其他值则是到达则停止)
     */
    maxReconnectionNum: number;
};
export default class WebSocketOperator {
    #private;
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
    /**
     * 心跳时触发
     */
    onheartbeat(ws: EventParams): void;
    /**
     * 连接重试时触发
     */
    onreconnection(ws: EventParams): void;
    /**
     * 销毁时触发
     */
    ondestroy(ws: EventParams): void;
    /**
     * 达到最大重试时触发
     */
    onmaxReconnection(ws: EventParams): void;
    /**
     * 通用绑定事件方法
     */
    protected bindEvent(event: WebSocketEvent, listener: (e: CloseEvent | Event | any) => void): this;
    /**
     * 触发对应的事件回调
     */
    protected $triggerFn(key: WebSocketEvent | "onreconnection" | "onheartbeat" | "ondestroy" | "onmaxReconnection", event: Event): void;
    /**
     * WebSocket 实例打开事件
     */
    protected $onopenOperator(e: Event): void;
    /**
     * WebSocket 接受数据事件
     */
    protected $onmessageOperator(e: Event | MessageEvent<any>): void;
    /**
     * WebSocket 取消连接事件
     */
    protected $oncloseOperator(e: CloseEvent): void;
    /**
     * WebSocket 错误事件
     */
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
    get isSpeedUp(): boolean;
    set isSpeedUp(isSpeedUp: boolean);
    get maxReconnectionNum(): number;
    set maxReconnectionNum(maxReconnectionNum: number);
}
export {};
