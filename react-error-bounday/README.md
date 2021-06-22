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
