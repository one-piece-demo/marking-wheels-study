# my-react-error-bounday

> 学习轮子🎡，参考 [react-error-boundary github](https://github.com/bvaughn/react-error-boundary)

**背景**：React 提供的 `Error Boundary` 错误边界处理组件内异常

**组件内异常**，也就是异常边界组件能够捕获的异常，主要包括：

- 渲染过程中异常；
- 生命周期方法中的异常；
- 子组件树中各组件的`constructor`构造函数中异常。
- 不能捕获的异常，主要是异步及服务端触发异常：

**事件处理器中的异常**:

- 处理方法： 使用try/catch代码进行捕获
- 异步任务异常，如setTiemout，ajax请求异常等；

```js
- 处理方法：使用全局事件window.addEventListener捕获
// 事件处理器中的错误 onerror也可以捕获到， 但想要拦截住错误 需要使用try catch
window.addEventListener('error', event => {
  console.log(event)
}, true)

// promise 如果reject 但是没有写catch语句的话 会报错
// 但是onerror和try-catch和ErrorBoundary组件都无法捕获
// 需要写一个全局unhandledrejection 事件捕获
window.addEventListener('unhandledrejection', event => {
  console.log(event)
})
```

**服务端渲染异常**:
**异常边界组件自身内的异常**:

- 处理方法：将边界组件和业务组件分离，各司其职，不能在边界组件中处理逻辑代码，也不能在业务组件中使用`didcatch`

## 造轮子

- 造一个 `ErrorBoundary` 轮子
- `componentDidCatch` 捕获页面报错，`getDerivedStateFromError` 更新 `ErrorBoundary` 的 `state`，并获取具体 `error`
- 提供多种展示错误内容入口：`fallback`, `FallbackComponent`, `fallbackRender`
- 重置钩子：提供 `onReset`, `resetErrorBoundary` 的传值和调用，以实现重置
- 重置监听数组：监听 `resetKeys` 的变化来重置。对于拥有复杂元素的 `resetKeys` 数组提供 `onResetKeysChange` 让开发者自行判断。在 `componentDidUpdate` 里监听每次渲染时 `resetKeys` 变化，并设置`updatedWithError` 作为 `flag` 判断是否由于 `error` 引发的渲染，对于普通渲染，只要 `resetKeys` 变化，直接重置
- 提供 `ErrorBoundary` 的2种使用方法：嵌套业务组件，将业务组件传入`withErrorBoundary` 高阶函数。提供 `useErrorBoundary` 钩子给开发者自己抛出 `ErrorBoundary` 不能自动捕获的错误
