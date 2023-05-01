## 安装

```sh
npm install @anlib/websocket-operator --save
```

## 使用

```js
import WebSocketOperator from "@anlib/websocket-operator";

WebSocketOperator.isCompatibleWebSocket().then(res => {
  const wsOperator = new WebSocketOperator({
    url: "ws:localhost:8888/ws-test",
    heartbeatInterval: 1000,
    heartbeatData: "自定义心跳回应数据",
    reconnectInterval: 1500,
    maxReconnectionNum: -1,
    // maxReconnectionNum: 10,
    isSpeedUp: false,
  });

  setTimeout(() => {
    wsOperator.heartbeatData = "我变了";

    // 错误写法, 不会更新
    // wsOperator.option.heartbeatInterval = 3000;

    // 正确写法, 会更新心跳频率
    wsOperator.heartbeatInterval = 3000;
  }, 4000);

  // 发送心跳时触发
  wsOperator.onheartbeat = (event) => {
    console.log("onheartbeat: ", event);
  }

  // 重新连接时触发
  wsOperator.onreconnection = (event) => {
    console.log("onreconnection: ", event);
  }

  // 错误重试达到最大时触发
  wsOperator.onmaxReconnection = (event) => {
    console.log("onmaxReconnection: ", event);
  }

  // 销毁时触发
  wsOperator.ondestroy = (event) => {
    console.log("ondestroy: ", event);
  }

  // 原本 WebSocket 的事件
  wsOperator.onmessage = (msg) => {
    console.log("onmessage: ", msg);
  }
  wsOperator.onopen = (msg) => {
    console.log("onopen: ", msg);
  }
  wsOperator.onclose = (msg) => {
    console.log("onclose: ", msg);
  }
  wsOperator.onerror = (msg) => {
    console.log("onerror: ", msg);
  }


  // 给服务器发送消息
  // await wsOperator.send("data");

  // 关闭
  // wsOperator.close();

}).catch(err => {
  if (err) {
    alert(err.message);
  }
}).finally(err => {
  sendBtn.disabled = false;
});
```