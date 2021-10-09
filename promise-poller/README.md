# promise-poller

> 轮询实现

- 基础的轮询操作
- 返回 promise
- 提供主动和被动中止轮询的方法
- 提供轮询任务重试的功能，并提供重试进度回调
- 提供多种轮询策略：fixed-interval, linear-backoff, exponential-backoff

`setInterval`不如`setTimeout`稳定：

- `setTimeout`每次都是新函数
- `setInterval`如果执行栈中还存在定时回调，就不会将最新的到时回调放入执行栈，导致结构不稳定
