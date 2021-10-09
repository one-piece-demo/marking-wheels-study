export const delay = (interval) => new Promise(resolve => {
  setTimeout(resolve, interval)
})

type StrategyName = 'fixed-interval' | 'linear-backoff' | 'exponential-backoff'
interface Options {
  taskFn: Function;
  shouldContinue: (err: string | null, result?: any) => boolean; // 当次轮询后是否需要继续
  progressCallback?: (retriesRemain: number, error: Error) => unknown; // 剩余次数回调
  masterTimeout?: number; // 整个轮询过程的 timeout 时长
  taskTimeout?: number; // 轮询任务的 timeout
  retries?: number; // 轮询任务失败后重试次数
  strategy?: StrategyName; // 轮询策略
  // fixed-interval 策略
  interval?: number;
  // linear-backoff 策略
  start?: number;
  increment?: number;
  // exponential-backoff 策略
  min?: number;
  max?: number;
}

// 判断该 promise 是否超时了
const timeout = (promise: Promise<any>, interval: number) => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject('Task timeout'), interval)

    promise.then(result => {
      clearTimeout(timeoutId)
      resolve(result)
    })
  })
}

const CANCEL_TOKEN = 'CANCEL_TOKEN'
export const strategies = {
  'fixed-interval': {
    defaults: {
      interval: 1000
    },
    getNextInterval: function(count: number, options: Options) {
      return options.interval;
    }
  },

  'linear-backoff': {
    defaults: {
      start: 1000,
      increment: 1000
    },
    getNextInterval: function(count: number, options: Options) {
      return options.start + options.increment * count;
    }
  },

  'exponential-backoff': {
    defaults: {
      min: 1000,
      max: 30000
    },
    getNextInterval: function(count: number, options: Options) {
      return Math.min(options.max, Math.round(Math.random() * (Math.pow(2, count) * 1000 - options.min) + options.min));
    }
  }
};


export const promisePoller = (options: Options) => {
  const strategy = strategies[options.strategy] || strategies['fixed-interval'] // 获取当前的轮询策略，默认使用 fixed-interval
  const mergedOptions = {...strategy.defaults, ...options} // 合并轮询策略的初始参数
  const {taskFn, masterTimeout, shouldContinue, progressCallback, taskTimeout, retries = 5} = mergedOptions

  let polling = true
  let timeoutId: null | number
  let rejections: Array<Error | string> = []
  let retriesRemain = retries

  return new Promise((resolve, reject) => {
    if (masterTimeout) {
      timeoutId = setTimeout(() => {
        reject('Master timeout') // 整个轮询超时了
        polling = false
      }, masterTimeout)
    }

    const poll = () => {
      let taskResult = taskFn()

      if (taskResult === false) { // 结束同步任务
        taskResult = Promise.reject(taskResult)
        reject(rejections)
        polling = false
      }
      let taskPromise = Promise.resolve(taskResult) // 将结果 promisify

      if (taskTimeout) {
        taskPromise = timeout(taskPromise, taskTimeout) // 检查该轮询任务是否超时了
      }

      taskPromise
        .then(result => {
          if (shouldContinue(null, result)) {
            const nextInterval = strategy.getNextInterval(retriesRemain, mergedOptions) // 获取下次轮询的时间间隔
            delay(nextInterval).then(poll)
          } else {
            if (timeoutId !== null) {
              clearTimeout(timeoutId)
            }
            resolve(result)
          }
        })
        .catch(error => {
          if (error === CANCEL_TOKEN) { // 结束异步任务
            reject(rejections)
            polling = false
          }

          rejections.push(error) // 加入 rejections 错误列表
          if (progressCallback) {
            progressCallback(retriesRemain, error) // 回调获取 retriesRemain
          }

          if (--retriesRemain === 0 || !shouldContinue(error)) { // 判断是否需要重试
            reject(rejections) // 不重试，直接失败
          } else if (polling) { // 再次重试时，需要检查 polling 是否为 true
            const nextInterval = strategy.getNextInterval(retriesRemain, options) // 获取下次轮询的时间间隔
            delay(nextInterval).then(poll); // 重试
          }
        })
    }

    poll()
  })
}
