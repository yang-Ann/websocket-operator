// websoket 事件名
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

/** 默认配置 */
const defaultOption: Omit<WebSocketOperatorOption, "url"> = {
  heartbeatInterval: 5000,
  heartbeatData: "ping",
  heartbeatResult: "pong",
  reconnectInterval: 2000,
  maxReconnectionNum: 10,
  isSpeedUp: true
};

/** WebSocket 操作类 */
export default class WebSocketOperator {
  /** 打印调试log */
  public static isDebug: boolean = false;

  /** 临时存储重新连接的 WebSocket 实例(类静态属性) */
  #reconnectionInstance: WebSocket | null = null;

  /** 心跳定时器 */
  // @ts-ignore
  #heartbeatTimeout: NodeJS.Timeout | number | null = null;
  /** 心跳次数 */
  #heartbeatNum: number = 0;
  /** 当前已重试次数 */
  #currentReconnectionNum: number = 0;
  /** 重试定时器 */
  // @ts-ignore
  #reconnectionTimeout: NodeJS.Timeout | number | null = null;
  /** 是否已销毁 */
  #isDestroy: boolean = false;

  /** WebSocket 实例 */
  public ws: WebSocket;

  /** WebSocket 配置 */
  public option: WebSocketOperatorOption;

  constructor(opt: WebSocketOperatorOption) {
    this.option = Object.assign(defaultOption, opt);
    this.ws = new WebSocket(opt.url);
    this.init();
  }

  /**
   * WebSocket 兼容性判断
   */
  public static isCompatibleWebSocket(): Promise<void | Error> {
    return new Promise((resolve, reject) => {
      if (!WebSocket) {
        const error = new Error("抱歉 你的设备不支持 WebSocket");
        reject(error);
      } else {
        resolve();
      }
    });
  }

  private static log(...msg: unknown[]): void {
    if (WebSocketOperator.isDebug) console.log(...msg);
  }

  /**
   * 初始化
   */
  protected init() {
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
  public onopen(ws: EventParams) {}
  public onmessage(ws: EventParams) {}
  public onclose(ws: EventParams) {}
  public onerror(ws: EventParams) {}

  //// 内部提供事件回调

  /**
   * 心跳时触发
   */
  public onheartbeat(ws: EventParams) {}

  /**
   * 连接重试时触发
   */
  public onreconnection(ws: EventParams) {}

  /**
   * 销毁时触发
   */
  public ondestroy(ws: EventParams) {}

  /**
   * 达到最大重试时触发
   */
  public onmaxReconnection(ws: EventParams) {}

  /**
   * 通用绑定事件方法
   */
  protected bindEvent(event: WebSocketEvent, listener: (e?: any) => void): this {
    // 需要绑定 this 不然在对应的回调里面的 this 就是 WebSocket
    this.ws[event] = listener.bind(this);
    return this;
  }

  /**
   * 触发对应的事件回调
   */
  protected $triggerFn(
    key: WebSocketEvent | "onreconnection" | "onheartbeat" | "ondestroy" | "onmaxReconnection",
    event?: Event
  ) {
    const wsState = this.getWebSocketState();
    if (event) {
      this[key]({ ...wsState, event });
    } else {
      this[key]({ ...wsState, event: null });
    }
  }

  /**
   * WebSocket 实例打开事件
   */
  protected $onopenOperator(e: Event): void {
    const wsState = this.getWebSocketState();
    if (wsState.alive) {
      // 触发打开事件
      this.$triggerFn("onopen", e);

      this.#heartbeatTimeout && clearInterval(this.#heartbeatTimeout);
      // 当前已连接延迟到下一次发送心跳
      this.#heartbeatTimeout = setTimeout(() => {
        this.startHeartbeat();
      }, this.heartbeatInterval);
    } else {
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
  protected $onmessageOperator(e: WebSocketMessageEvent): void {
    const data: sendType = e.data;
    if (typeof data === "string") {
      if (data === this.heartbeatResult) {
        WebSocketOperator.log("收到服务端心跳回应: ", data);
        return;
      }
    } else if (data instanceof Blob) {
      WebSocketOperator.log("收到服务端二进制对象数据: ", data);
    } else if (data instanceof ArrayBuffer) {
      WebSocketOperator.log("收到服务端二进制数组数据: ", data);
    }
    WebSocketOperator.log("client的数据是: ", data, this);

    // 触发message事件
    this.$triggerFn("onmessage", e);
  }

  /**
   * WebSocket 取消连接事件
   */
  protected $oncloseOperator(e: WebSocketCloseEvent): void {
    this.$triggerFn("onclose", e);
    this.endHeartbeat();
    this.endReconnection();
    WebSocketOperator.log("client close", e);
  }

  /**
   * WebSocket 错误事件
   */
  protected $onerrorOperator(e: Event): void {
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
  public send(msg: sendType): Promise<Error | void> {
    return new Promise((resolve, reject) => {
      const wsState = this.getWebSocketState();
      let err: Error | null = null;
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
  public close(code?: number, reason?: string) {
    this.destroy(code, reason);
  }

  /**
   * 获取 WebSocket 的状态
   */
  public getWebSocketState() {
    let ret: WebSocketState = {
      alive: false, // 当前是否存活
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

  /** 上次发送心跳的时间戳 */
  #preSendHeartbeatTime = 0;
  /**
   * 发送心跳
   */
  public startHeartbeat() {
    this.#heartbeatTimeout && clearInterval(this.#heartbeatTimeout);
    this.#heartbeatTimeout = setInterval(() => {
      if (Date.now() - this.#preSendHeartbeatTime < this.heartbeatInterval) {
        console.warn("心跳发送间隔太快");
        return;
      }
      this.#preSendHeartbeatTime = Date.now();

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
  public endHeartbeat() {
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
  public reconnection(interval?: number, url?: string): void {
    if (url && url.trim()) this.url = url;

    // 停止心跳定时器
    this.#heartbeatTimeout && clearInterval(this.#heartbeatTimeout);

    // 重新创建实例
    const ws = (this.#reconnectionInstance = new WebSocket(this.url));
    this.$triggerFn("onreconnection");
    if (ws) {
      ws.onopen = (e?: any) => {
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
      ws.onerror = (e: Event) => {
        if (
          (this.#currentReconnectionNum++ >= this.maxReconnectionNum || this.#isDestroy) &&
          this.maxReconnectionNum !== -1
        ) {
          WebSocketOperator.log(`已到达最大重试次数 ${this.maxReconnectionNum} 或 已失活`);
          this.$triggerFn("onmaxReconnection", e);
          if (!this.#isDestroy) this.destroy();
        } else {
          let nextTime = interval;
          // 是否加速重试频率
          if (this.isSpeedUp) {
            nextTime = this.calcReconnectionInterval();
          } else {
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
  public endReconnection(): void {
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
  public calcReconnectionInterval(): number {
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
  public destroy(code?: number, reason?: string) {
    WebSocketOperator.log("WebSocketOperator destroy");
    this.ws.close(code, reason);
    this.#isDestroy = true;
    this.endHeartbeat();
    this.endReconnection();
    this.$triggerFn("ondestroy");
  }

  //// getter / setter ////
  public get url() {
    return this.option.url;
  }
  public set url(url) {
    this.option.url = url;
  }
  public get heartbeatResult() {
    return this.option.heartbeatResult;
  }
  public get heartbeatInterval() {
    return this.option.heartbeatInterval;
  }
  public set heartbeatInterval(heartbeatInterval) {
    WebSocketOperator.log(`更新心跳频率 ${this.heartbeatInterval} -> ${heartbeatInterval}`);
    this.option.heartbeatInterval = heartbeatInterval;
    // 重新发送心跳
    this.startHeartbeat();
  }
  public get heartbeatData() {
    return this.option.heartbeatData;
  }
  public set heartbeatData(heartbeatData) {
    this.option.heartbeatData = heartbeatData;
  }
  public get reconnectInterval() {
    return this.option.reconnectInterval;
  }
  public set reconnectInterval(reconnectInterval) {
    this.option.reconnectInterval = reconnectInterval;
  }
  public get isSpeedUp() {
    return this.option.isSpeedUp;
  }
  public set isSpeedUp(isSpeedUp) {
    this.option.isSpeedUp = isSpeedUp;
  }
  public get maxReconnectionNum() {
    return this.option.maxReconnectionNum;
  }
  public set maxReconnectionNum(maxReconnectionNum) {
    this.option.maxReconnectionNum = maxReconnectionNum;
  }
}
