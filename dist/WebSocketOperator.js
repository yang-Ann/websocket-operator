var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var _WebSocketOperator_heartbeatTimeout, _WebSocketOperator_heartbeatNum, _WebSocketOperator_currentReconnectionNum, _WebSocketOperator_reconnectionTimeout, _WebSocketOperator_isDestroy;
// 默认配置
const defaultOption = {
    heartbeatInterval: 5000,
    heartbeatData: "ping",
    heartbeatResult: "pong",
    reconnectInterval: 2000,
    maxReconnectionNum: 10,
    isSpeedUp: true,
};
// WebSocket 操作类
export default class WebSocketOperator {
    constructor(opt) {
        // 内部私有属性
        _WebSocketOperator_heartbeatTimeout.set(this, null); // 心跳定时器
        _WebSocketOperator_heartbeatNum.set(this, 0); // 心跳次数
        _WebSocketOperator_currentReconnectionNum.set(this, 0); // 当前已重试次数
        _WebSocketOperator_reconnectionTimeout.set(this, null); // 重试定时器
        _WebSocketOperator_isDestroy.set(this, false); // 是否已销毁
        this.option = Object.assign(defaultOption, opt);
        this.ws = new WebSocket(opt.url);
        this.init();
    }
    /**
     * WebSocket 兼容性判断
     */
    static isCompatibleWebSocket() {
        return new Promise((resolve, reject) => {
            if (!window.WebSocket) {
                const error = new Error("抱歉 你的设备不支持 WebSocket 请下载 Chrome 浏览器");
                WebSocketOperator.log("userAgent: ", navigator.userAgent);
                reject({ error, userAgent: navigator.userAgent });
            }
            else {
                resolve();
            }
        });
    }
    static log(...msg) {
        if (WebSocketOperator.isDebug) {
            console.log(...msg);
        }
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
            .catch((err) => {
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
        this[key](Object.assign(Object.assign({}, wsState), { event }));
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
            if (!__classPrivateFieldGet(this, _WebSocketOperator_isDestroy, "f") && !__classPrivateFieldGet(this, _WebSocketOperator_reconnectionTimeout, "f")) {
                // 连接失败立即重试
                this.reconnection(16);
            }
        }
    }
    /**
     * WebSocket 接受数据事件
     */
    $onmessageOperator(e) {
        // 触发message事件
        this.$triggerFn("onmessage", e);
        if (e instanceof MessageEvent) {
            const data = e.data;
            if (typeof data === "string") {
                if (data === this.heartbeatResult) {
                    WebSocketOperator.log("收到服务端心跳回应: ", data);
                }
            }
            else if (data instanceof Blob) {
                // data.text().then(text => { });
                WebSocketOperator.log("收到服务端二进制对象数据: ", data);
            }
            else if (data instanceof ArrayBuffer) {
                WebSocketOperator.log("收到服务端二进制数组数据: ", data);
            }
            WebSocketOperator.log("client的数据是: ", data, this);
        }
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
        var _a;
        this.$triggerFn("onerror", e);
        this.endHeartbeat();
        WebSocketOperator.log("client error", e);
        if (!__classPrivateFieldGet(this, _WebSocketOperator_isDestroy, "f") && !__classPrivateFieldGet(this, _WebSocketOperator_reconnectionTimeout, "f")) {
            // 连接失败立即重试
            __classPrivateFieldSet(this, _WebSocketOperator_currentReconnectionNum, (_a = __classPrivateFieldGet(this, _WebSocketOperator_currentReconnectionNum, "f"), _a++, _a), "f");
            this.reconnection(16);
        }
    }
    /**
     * 发送数据
     */
    send(msg) {
        return new Promise((resolve, reject) => {
            const wsState = this.getWebSocketState();
            let err;
            if (!wsState.alive) {
                err = new Error(wsState.message);
            }
            if (err instanceof Error) {
                if (!__classPrivateFieldGet(this, _WebSocketOperator_isDestroy, "f") && !__classPrivateFieldGet(this, _WebSocketOperator_reconnectionTimeout, "f")) {
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
            ReconnectionNum: __classPrivateFieldGet(this, _WebSocketOperator_currentReconnectionNum, "f"),
        };
        switch (this.ws.readyState) {
            case WebSocket.CONNECTING: // 0
                ret = Object.assign(Object.assign({}, ret), { message: "正在连接中" });
                break;
            case WebSocket.OPEN: // 1
                ret = Object.assign(Object.assign({}, ret), { alive: true, message: "已经连接并且可以通讯" });
                break;
            case WebSocket.CLOSING: // 2
                ret = Object.assign(Object.assign({}, ret), { message: "连接正在关闭" });
                break;
            case WebSocket.CLOSED: // 3
                ret = Object.assign(Object.assign({}, ret), { message: "连接已关闭或者连接没有成功" });
                break;
            default:
                ret = Object.assign(Object.assign({}, ret), { message: "意料之外的 readyState" });
                break;
        }
        return ret;
    }
    /**
     * 发送心跳
     */
    startHeartbeat() {
        __classPrivateFieldSet(this, _WebSocketOperator_heartbeatTimeout, setInterval(() => {
            var _a;
            __classPrivateFieldSet(this, _WebSocketOperator_heartbeatNum, (_a = __classPrivateFieldGet(this, _WebSocketOperator_heartbeatNum, "f"), _a++, _a), "f");
            WebSocketOperator.log(`发送心跳, 当前心跳数: ${__classPrivateFieldGet(this, _WebSocketOperator_heartbeatNum, "f")}`);
            this.$triggerFn("onheartbeat", new Event("heartbeat"));
            this.send(this.heartbeatData);
        }, this.heartbeatInterval), "f");
    }
    /**
     * 停止心跳
     */
    endHeartbeat() {
        if (__classPrivateFieldGet(this, _WebSocketOperator_heartbeatTimeout, "f")) {
            WebSocketOperator.log(`心跳停止, 一共发送心跳数: ${__classPrivateFieldGet(this, _WebSocketOperator_heartbeatNum, "f")}`);
            __classPrivateFieldSet(this, _WebSocketOperator_heartbeatNum, 0, "f");
            clearInterval(__classPrivateFieldGet(this, _WebSocketOperator_heartbeatTimeout, "f"));
            __classPrivateFieldSet(this, _WebSocketOperator_heartbeatTimeout, null, "f");
        }
    }
    /**
     * 重新创建实例
     */
    reconnection(interval, url) {
        if (url && url.trim())
            this.url = url;
        // 重新创建实例
        const ws = (WebSocketOperator.reconnectionInstance = new WebSocket(this.url));
        this.$triggerFn("onreconnection", new Event("reconnection"));
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
                    __classPrivateFieldSet(this, _WebSocketOperator_heartbeatTimeout, setTimeout(() => {
                        this.startHeartbeat();
                    }, this.heartbeatInterval), "f");
                }
            };
            ws.onerror = (e) => {
                var _a, _b;
                if (((__classPrivateFieldSet(this, _WebSocketOperator_currentReconnectionNum, (_b = __classPrivateFieldGet(this, _WebSocketOperator_currentReconnectionNum, "f"), _a = _b++, _b), "f"), _a) >= this.maxReconnectionNum || __classPrivateFieldGet(this, _WebSocketOperator_isDestroy, "f")) &&
                    this.maxReconnectionNum !== -1) {
                    WebSocketOperator.log(`已到达最大重试次数 ${this.maxReconnectionNum} 或 已失活`);
                    this.$triggerFn("onmaxReconnection", new Event("maxReconnection"));
                    if (!__classPrivateFieldGet(this, _WebSocketOperator_isDestroy, "f"))
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
                    __classPrivateFieldSet(this, _WebSocketOperator_reconnectionTimeout, setTimeout(() => {
                        const tip = [
                            "正在重新连接...",
                            `\t当前重试次数: ${__classPrivateFieldGet(this, _WebSocketOperator_currentReconnectionNum, "f")}`,
                            `\t最大重试次数: ${this.maxReconnectionNum}`,
                            `\t当前重试频率: ${nextTime}`
                        ].join("\n");
                        WebSocketOperator.log(tip);
                        // 重新创建实例
                        this.reconnection();
                    }, nextTime), "f");
                }
            };
        }
    }
    /**
     * 停止重试
     */
    endReconnection() {
        WebSocketOperator.log("停止重新连接");
        if (__classPrivateFieldGet(this, _WebSocketOperator_reconnectionTimeout, "f")) {
            WebSocketOperator.reconnectionInstance = null;
            clearTimeout(__classPrivateFieldGet(this, _WebSocketOperator_reconnectionTimeout, "f"));
            // 重置状态
            __classPrivateFieldSet(this, _WebSocketOperator_currentReconnectionNum, 0, "f");
            __classPrivateFieldSet(this, _WebSocketOperator_reconnectionTimeout, null, "f");
        }
    }
    /**
     * 根据重试次数计算重试间隔
     */
    calcReconnectionInterval() {
        // 剩余次数
        const restNum = this.maxReconnectionNum - __classPrivateFieldGet(this, _WebSocketOperator_currentReconnectionNum, "f");
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
        __classPrivateFieldSet(this, _WebSocketOperator_isDestroy, true, "f");
        this.endHeartbeat();
        this.endReconnection();
        this.$triggerFn("ondestroy", new Event("destroy"));
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
        // 停止心跳定时器
        if (__classPrivateFieldGet(this, _WebSocketOperator_heartbeatTimeout, "f")) {
            clearInterval(__classPrivateFieldGet(this, _WebSocketOperator_heartbeatTimeout, "f"));
        }
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
_WebSocketOperator_heartbeatTimeout = new WeakMap(), _WebSocketOperator_heartbeatNum = new WeakMap(), _WebSocketOperator_currentReconnectionNum = new WeakMap(), _WebSocketOperator_reconnectionTimeout = new WeakMap(), _WebSocketOperator_isDestroy = new WeakMap();
// 临时存储重新连接的 WebSocket 实例(类静态属性)
WebSocketOperator.reconnectionInstance = null;
WebSocketOperator.isDebug = false; // 是否打印log(类静态属性)
