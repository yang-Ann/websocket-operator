export type WebSocketEvent = "onopen" | "onclose" | "onerror" | "onmessage";
/**
 * 当前 WebSocket 的状态
 */
export type WebSocketState = {
    /** 是否存活 */
    alive: boolean;
    /** 信息 */
    message: string;
    /** WebSocket 实例 */
    ws: WebSocket;
    /** 同 WebSocket 的 readyState */
    readyState: number;
    /** 错误重试次数 */
    reconnectionNum: number;
    /** 心跳次数 */
    heartbeatNum: number;
};
/** 发送的数据格式 */
export type sendType = string | ArrayBufferLike | Blob | ArrayBufferView;
/** 事件的参数 */
export type EventParams = WebSocketState & {
    /** 这里没办法同时兼容 web 和 react-native, 所以只能让使用者自己断言类型了 */
    event: unknown;
};
export type WebSocketOperatorOption = {
    /** websocket 连接url */
    url: string;
    /** 心跳间隔 */
    heartbeatInterval: number;
    /** 客户端心跳值(发送给服务端) */
    heartbeatData: any;
    /** 服务端心跳回应数据(客户端接收到的) */
    heartbeatResult: any;
    /** 重试间隔时长 */
    reconnectInterval: number;
    /** 重试加快(重试次数越多, 则下次重试时间越快) */
    isSpeedUp: boolean;
    /** 最大失败重试次数, (-1就是无限重试, 其他值则是到达则停止) */
    maxReconnectionNum: number;
};
/** WebSocket 操作类 */
export default class WebSocketOperator {
    #private;
    /** 打印调试log */
    static isDebug: boolean;
    /** WebSocket 实例 */
    ws: WebSocket;
    /** WebSocket 配置 */
    option: WebSocketOperatorOption;
    constructor(opt: WebSocketOperatorOption);
    /**
     * WebSocket 兼容性判断
     */
    static isCompatibleWebSocket(): Promise<void | Error>;
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
    protected bindEvent(event: WebSocketEvent, listener: (e?: any) => void): this;
    /**
     * 触发对应的事件回调
     */
    protected $triggerFn(key: WebSocketEvent | "onreconnection" | "onheartbeat" | "ondestroy" | "onmaxReconnection", event?: Event): void;
    /**
     * WebSocket 实例打开事件
     */
    protected $onopenOperator(e: Event): void;
    /**
     * WebSocket 接受数据事件
     */
    protected $onmessageOperator(e: WebSocketMessageEvent): void;
    /**
     * WebSocket 取消连接事件
     */
    protected $oncloseOperator(e: WebSocketCloseEvent): void;
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
    get heartbeatResult(): any;
    get heartbeatInterval(): number;
    set heartbeatInterval(heartbeatInterval: number);
    get heartbeatData(): any;
    set heartbeatData(heartbeatData: any);
    get reconnectInterval(): number;
    set reconnectInterval(reconnectInterval: number);
    get isSpeedUp(): boolean;
    set isSpeedUp(isSpeedUp: boolean);
    get maxReconnectionNum(): number;
    set maxReconnectionNum(maxReconnectionNum: number);
}
