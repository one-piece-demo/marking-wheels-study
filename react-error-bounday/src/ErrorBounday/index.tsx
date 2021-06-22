import React from 'react';

// 出错显示组件的 props
export interface FallbackProps {
  error: Error;
  resetErrorBoundary: () => void; // fallback 组件里将该函数绑定到“重置”按钮
}

type FallbackRender = (props: FallbackProps) => FallbackElement;

type FallbackComponent = React.ComponentType<FallbackProps>;

// 本组件 ErrorBoundary 的 props
interface ErrorBoundaryProps {
  fallback?: FallbackElement; // 组件 || 方法 || 元素
  onError?: (error: Error, info: string) => void;
  onReset?: () => void; // 开发者自定义重置逻辑，如日志上报、 toast 提示
  resetKeys?: Array<unknown>;
  onResetKeysChange?: (
    prevResetKey: Array<unknown> | undefined,
    resetKeys: Array<unknown> | undefined,
  ) => void;
}

// 出错后显示的元素类型
type FallbackElement = 
  React.ReactElement<unknown, string | React.FC | typeof React.Component> | 
  FallbackComponent |
  FallbackRender |
  null;


// 本组件 ErrorBoundary 的 props
interface ErrorBoundaryState {
  error: Error | null; // 将 hasError 的 boolean 改为 Error 类型，提供更丰富的报错信息
}

// 初始状态
const initialState: ErrorBoundaryState = {
  error: null,
}

// 检查 resetKeys 是否有变化
const changedArray = (a: Array<unknown> = [], b: Array<unknown> = []) => {
  return a.length !== b.length || a.some((item, index) => !Object.is(item, b[index]));
}

class ErrorBoundary extends React.Component<React.PropsWithChildren<ErrorBoundaryProps>, ErrorBoundaryState> {
  state = initialState;
  // 是否已经由于 error 而引发的 render/update
  updatedWithError = false;

  static getDerivedStateFromError(error: Error) {
    return {error};
  }

  componentDidUpdate(prevProps: Readonly<React.PropsWithChildren<ErrorBoundaryProps>>) {
    const {resetKeys, onResetKeysChange} = this.props;
    const {error} = this.state;

    // 已经存在错误，并且是第一次由于 error 而引发的 render/update，那么设置 flag=true，不会重置 
    if (error !== null && !this.updatedWithError) {
      this.updatedWithError = true;
      return;
    }
    
    // 已经存在错误，并且是普通的组件 render，则检查 resetKeys 是否有改动，改了就重置
    if (error !== null && changedArray(prevProps.resetKeys, resetKeys)) {
      if (onResetKeysChange) {
        onResetKeysChange(prevProps.resetKeys, resetKeys);
      }
      // 重置 ErrorBoundary 状态，并调用 onReset 回调
      this.reset();
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (this.props.onError) {
      this.props.onError(error, errorInfo.componentStack);
    }
  }

  // 重置该组件状态，将 error 设置 null
  reset = () => {
    this.updatedWithError = false;
    this.setState(initialState);
  }

  // 执行自定义重置逻辑，并重置组件状态  
  resetErrorBoundary = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.reset();
  }

  render() {
    const {fallback} = this.props;
    const {error} = this.state;

    if (error !== null) {
      const fallbackProps: FallbackProps = {
        error,
        resetErrorBoundary: this.resetErrorBoundary,  // 将 resetErrorBoundary 传入 fallback
      };

      if (React.isValidElement(fallback)) {
        return fallback;
      }

      // 判断 render 是否为函数
      if (typeof fallback === 'function') {
        
        return (fallback as FallbackRender)(fallbackProps);
      }

      // 判断是否存在 FallbackComponent
      if (fallback) {
        const Fallback = (fallback as unknown as FallbackComponent);
        return <Fallback {...fallbackProps} />
      }

      throw new Error('ErrorBoundary 组件需要传入 fallback');
    }

    return this.props.children;
  }
}

/**
 * with 写法 HOC
 * @param Component 业务组件
 * @param errorBoundaryProps error boundary 的 props
 */
export function withErrorBoundary<P> (
  Component: React.ComponentType<P>,
  errorBoundaryProps: ErrorBoundaryProps
): React.ComponentType<P> {
  const Wrapped: React.ComponentType<P> = props => {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props}/>
      </ErrorBoundary>
    )
  }

  // DevTools 显示的组件名
  const name = Component.displayName ||Component.name || 'Unknown';
  Wrapped.displayName = `withErrorBoundary(${name})`;

  return Wrapped;
}

/**
 * 自定义错误的 handler
 * @param givenError
 */
export function useErrorHandler<P=Error>(
  givenError?: P | null | undefined,
): React.Dispatch<React.SetStateAction<P | null>> {
  const [error, setError] = React.useState<P | null>(null);
  if (givenError) throw givenError;
  if (error) throw error;
  return setError;
}

export default ErrorBoundary
