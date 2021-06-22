import logo from './logo.svg';
import ErrorBounday, { FallbackProps } from './ErrorBounday';
import './App.css';

function App() {
  const onError = () => console.error('出错啦')
  const onReset = () => {
    console.log('已重置')
    console.info('刚刚出错了，现在已经重置好了')
  }
  // fallback 组件的渲染函数
  const renderFallback = (props: FallbackProps) => {
    return (
      <div>
        出错啦，你可以<button onClick={props.resetErrorBoundary}>重置</button>
      </div>
    )
  }

  return (
    <div className="App">
      <ErrorBounday
        onReset={onReset}
        onError={onError}
        fallback={renderFallback}
      >
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <p>
            Edit <code>src/App.js</code> and save to reload.
          </p>
          <a
            className="App-link"
            href="https://reactjs.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn React
          </a>
        </header>
      </ErrorBounday>
    </div>
  );
}

export default App;
