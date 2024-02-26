/** 默认配置 */
const defaultOption = {
    heartbeatInterval: 5000,
    heartbeatData: "ping",
    heartbeatResult: "pong",
    reconnectInterval: 2000,
    maxReconnectionNum: 10,
    isSpeedUp: true
};
/** WebSocket 操作类 */
class WebSocketOperator {
    /** 打印调试log */
    static isDebug = false;
    /** 临时存储重新连接的 WebSocket 实例(类静态属性) */
    #reconnectionInstance = null;
    /** 心跳定时器 */
    // @ts-ignore
    #heartbeatTimeout = null;
    /** 心跳次数 */
    #heartbeatNum = 0;
    /** 当前已重试次数 */
    #currentReconnectionNum = 0;
    /** 重试定时器 */
    // @ts-ignore
    #reconnectionTimeout = null;
    /** 是否已销毁 */
    #isDestroy = false;
    /** WebSocket 实例 */
    ws;
    /** WebSocket 配置 */
    option;
    constructor(opt) {
        this.option = Object.assign(defaultOption, opt);
        this.ws = new WebSocket(opt.url);
        this.init();
    }
    /**
     * WebSocket 兼容性判断
     */
    static isCompatibleWebSocket() {
        return new Promise((resolve, reject) => {
            if (!WebSocket) {
                const error = new Error("抱歉 你的设备不支持 WebSocket");
                reject(error);
            }
            else {
                resolve();
            }
        });
    }
    static log(...msg) {
        if (WebSocketOperator.isDebug)
            console.log(...msg);
    }
    /**
     * 初始化
     */
    init() {
        WebSocketOperator.isCompatibleWebSocket()
            .then(() => {
            // 绑定内部处理事件
            this.bindEvent("onopen", this.$onopenOperator)
                .bindEvent("onmessage", this.$onmessageOperator)
                .bindEvent("onclose", this.$oncloseOperator)
                .bindEvent("onerror", this.$onerrorOperator);
        })
            .catch(err => {
            throw err;
        });
    }
    //// 默认事件回调(会在 WebSocket 对应的时候被触发)
    onopen(ws) { }
    onmessage(ws) { }
    onclose(ws) { }
    onerror(ws) { }
    //// 内部提供事件回调
    /**
     * 心跳时触发
     */
    onheartbeat(ws) { }
    /**
     * 连接重试时触发
     */
    onreconnection(ws) { }
    /**
     * 销毁时触发
     */
    ondestroy(ws) { }
    /**
     * 达到最大重试时触发
     */
    onmaxReconnection(ws) { }
    /**
     * 通用绑定事件方法
     */
    bindEvent(event, listener) {
        // 需要绑定 this 不然在对应的回调里面的 this 就是 WebSocket
        this.ws[event] = listener.bind(this);
        return this;
    }
    /**
     * 触发对应的事件回调
     */
    $triggerFn(key, event) {
        const wsState = this.getWebSocketState();
        if (event) {
            this[key]({ ...wsState, event });
        }
        else {
            this[key]({ ...wsState, event: null });
        }
    }
    /**
     * WebSocket 实例打开事件
     */
    $onopenOperator(e) {
        const wsState = this.getWebSocketState();
        if (wsState.alive) {
            // 触发打开事件
            this.$triggerFn("onopen", e);
            // 当前已连接延迟到下一次发送心跳
            setTimeout(() => {
                this.startHeartbeat();
            }, this.heartbeatInterval);
        }
        else {
            // 触发失败事件
            this.$triggerFn("onerror", e);
            if (!this.#isDestroy && !this.#reconnectionTimeout) {
                // 连接失败立即重试
                this.reconnection(16);
            }
        }
    }
    /**
     * WebSocket 接受数据事件
     */
    $onmessageOperator(e) {
        const data = e.data;
        if (typeof data === "string") {
            if (data === this.heartbeatResult) {
                WebSocketOperator.log("收到服务端心跳回应: ", data);
                return;
            }
        }
        else if (data instanceof Blob) {
            WebSocketOperator.log("收到服务端二进制对象数据: ", data);
        }
        else if (data instanceof ArrayBuffer) {
            WebSocketOperator.log("收到服务端二进制数组数据: ", data);
        }
        WebSocketOperator.log("client的数据是: ", data, this);
        // 触发message事件
        this.$triggerFn("onmessage", e);
    }
    /**
     * WebSocket 取消连接事件
     */
    $oncloseOperator(e) {
        this.$triggerFn("onclose", e);
        this.endHeartbeat();
        this.endReconnection();
        WebSocketOperator.log("client close", e);
    }
    /**
     * WebSocket 错误事件
     */
    $onerrorOperator(e) {
        this.$triggerFn("onerror", e);
        this.endHeartbeat();
        WebSocketOperator.log("client error", e);
        if (!this.#isDestroy && !this.#reconnectionTimeout) {
            // 连接失败立即重试
            this.#currentReconnectionNum++;
            this.reconnection(16);
        }
    }
    /**
     * 发送数据
     */
    send(msg) {
        return new Promise((resolve, reject) => {
            const wsState = this.getWebSocketState();
            let err = null;
            if (!wsState.alive) {
                err = new Error(wsState.message);
            }
            if (err instanceof Error) {
                if (!this.#isDestroy && !this.#reconnectionTimeout) {
                    // 发送数据失败立即重试
                    this.reconnection(16);
                }
                reject(err);
                return;
            }
            this.ws.send(msg);
            resolve();
        });
    }
    /**
     * 关闭 WebSocket
     */
    close(code, reason) {
        this.destroy(code, reason);
    }
    /**
     * 获取 WebSocket 的状态
     */
    getWebSocketState() {
        let ret = {
            alive: false,
            message: "",
            ws: this.ws,
            readyState: this.ws.readyState,
            reconnectionNum: this.#currentReconnectionNum,
            heartbeatNum: this.#heartbeatNum
        };
        switch (this.ws.readyState) {
            case WebSocket.CONNECTING: // 0
                ret = { ...ret, message: "正在连接中" };
                break;
            case WebSocket.OPEN: // 1
                ret = { ...ret, alive: true, message: "已经连接并且可以通讯" };
                break;
            case WebSocket.CLOSING: // 2
                ret = { ...ret, message: "连接正在关闭" };
                break;
            case WebSocket.CLOSED: // 3
                ret = { ...ret, message: "连接已关闭或者连接没有成功" };
                break;
            default:
                ret = { ...ret, message: "意料之外的 readyState" };
                break;
        }
        return ret;
    }
    /**
     * 发送心跳
     */
    startHeartbeat() {
        this.#heartbeatTimeout && clearInterval(this.#heartbeatTimeout);
        this.#heartbeatTimeout = setInterval(() => {
            this.#heartbeatNum++;
            WebSocketOperator.log(`发送心跳, 当前心跳数: ${this.#heartbeatNum}`);
            this.$triggerFn("onheartbeat");
            this.send(this.heartbeatData)
                .then(() => {
                WebSocketOperator.log("心跳发送成功");
            })
                .catch(err => {
                WebSocketOperator.log("心跳发送失败: ", err);
            });
        }, this.heartbeatInterval);
    }
    /**
     * 停止心跳
     */
    endHeartbeat() {
        if (this.#heartbeatTimeout) {
            WebSocketOperator.log(`心跳停止, 一共发送心跳数: ${this.#heartbeatNum}`);
            this.#heartbeatNum = 0;
            clearInterval(this.#heartbeatTimeout);
            this.#heartbeatTimeout = null;
        }
    }
    /**
     * 重新创建实例
     */
    reconnection(interval, url) {
        if (url && url.trim())
            this.url = url;
        // 停止心跳定时器
        this.#heartbeatTimeout && clearInterval(this.#heartbeatTimeout);
        // 重新创建实例
        const ws = (this.#reconnectionInstance = new WebSocket(this.url));
        this.$triggerFn("onreconnection");
        if (ws) {
            ws.onopen = (e) => {
                if (ws.readyState === WebSocket.OPEN) {
                    this.ws = ws;
                    this.init();
                    WebSocketOperator.log("WebSocket 已重试连接上");
                    // 重置重新连接的状态
                    this.endReconnection();
                    // 触发 WebSocketOperator 实例的 onopen 事件(开启心跳)
                    this.$triggerFn("onopen", e);
                    // 延迟到下一次发送心跳时间
                    this.#heartbeatTimeout && clearTimeout(this.#heartbeatTimeout);
                    this.#heartbeatTimeout = setTimeout(() => {
                        this.startHeartbeat();
                    }, this.heartbeatInterval);
                }
            };
            ws.onerror = (e) => {
                if ((this.#currentReconnectionNum++ >= this.maxReconnectionNum || this.#isDestroy) &&
                    this.maxReconnectionNum !== -1) {
                    WebSocketOperator.log(`已到达最大重试次数 ${this.maxReconnectionNum} 或 已失活`);
                    this.$triggerFn("onmaxReconnection", e);
                    if (!this.#isDestroy)
                        this.destroy();
                }
                else {
                    let nextTime = interval;
                    // 是否加速重试频率
                    if (this.isSpeedUp) {
                        nextTime = this.calcReconnectionInterval();
                    }
                    else {
                        nextTime = this.reconnectInterval;
                    }
                    this.#reconnectionTimeout = setTimeout(() => {
                        const tip = [
                            "正在重新连接...",
                            `\t当前重试次数: ${this.#currentReconnectionNum}`,
                            `\t最大重试次数: ${this.maxReconnectionNum}`,
                            `\t当前重试频率: ${nextTime}`
                        ].join("\n");
                        WebSocketOperator.log(tip);
                        // 重新创建实例
                        this.reconnection();
                    }, nextTime);
                }
            };
        }
    }
    /**
     * 停止重试
     */
    endReconnection() {
        WebSocketOperator.log("停止重新连接");
        if (this.#reconnectionTimeout) {
            this.#reconnectionInstance = null;
            clearTimeout(this.#reconnectionTimeout);
            // 重置状态
            this.#currentReconnectionNum = 0;
            this.#reconnectionTimeout = null;
        }
    }
    /**
     * 根据重试次数计算重试间隔
     */
    calcReconnectionInterval() {
        // 剩余次数
        const restNum = this.maxReconnectionNum - this.#currentReconnectionNum;
        // 占总数的多少比例
        const probability = restNum / this.maxReconnectionNum;
        // 新的重试间隔
        const newReconnectInterval = this.reconnectInterval * probability;
        // this.reconnectInterval = newReconnectInterval;
        return newReconnectInterval;
    }
    /**
     * 销毁
     */
    destroy(code, reason) {
        WebSocketOperator.log("WebSocketOperator destroy");
        this.ws.close(code, reason);
        this.#isDestroy = true;
        this.endHeartbeat();
        this.endReconnection();
        this.$triggerFn("ondestroy");
    }
    //// getter / setter ////
    get url() {
        return this.option.url;
    }
    set url(url) {
        this.option.url = url;
    }
    get heartbeatResult() {
        return this.option.heartbeatResult;
    }
    get heartbeatInterval() {
        return this.option.heartbeatInterval;
    }
    set heartbeatInterval(heartbeatInterval) {
        WebSocketOperator.log(`更新心跳频率 ${this.heartbeatInterval} -> ${heartbeatInterval}`);
        this.option.heartbeatInterval = heartbeatInterval;
        // 重新发送心跳
        this.startHeartbeat();
    }
    get heartbeatData() {
        return this.option.heartbeatData;
    }
    set heartbeatData(heartbeatData) {
        this.option.heartbeatData = heartbeatData;
    }
    get reconnectInterval() {
        return this.option.reconnectInterval;
    }
    set reconnectInterval(reconnectInterval) {
        this.option.reconnectInterval = reconnectInterval;
    }
    get isSpeedUp() {
        return this.option.isSpeedUp;
    }
    set isSpeedUp(isSpeedUp) {
        this.option.isSpeedUp = isSpeedUp;
    }
    get maxReconnectionNum() {
        return this.option.maxReconnectionNum;
    }
    set maxReconnectionNum(maxReconnectionNum) {
        this.option.maxReconnectionNum = maxReconnectionNum;
    }
}
export default WebSocketOperator;
