import React, {useEffect, useState, useRef, useMemo} from 'react';

const InfiniterScroll = (props) => {
  const {threshold} = props;
  const [loadingMore, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const pageLoaded = useRef(1);
  const beforeRef = useRef({
    beforeScrollHeight: 0,
    beforeScrollTop : 0
  });

  const isPassiveSupported = () => {
    let passive = false;

    const testOptions = {
      get passive() {
        passive = true;
      }
    };

    try {
      document.addEventListener('test', null, testOptions);
      document.removeEventListener('test', null, testOptions);
    } catch (e) {
      // ignore
    }
    return passive;
  }

  const eventListenerOptions = () => {
    let options = props.useCapture;

    if (isPassiveSupported()) {
      options = {
        useCapture: props.useCapture,
        passive: true
      };
    } else {
      options = {
        passive: false
      };
    }
    return options;
  }

  const eventOptions = useMemo(() => {
    return eventListenerOptions();
  }, [])

  // 元素顶部到页面顶部的距离
  const calculateTopPosition = (el) => {
    if (!el) {
      return 0;
    }
    return el.offsetTop + calculateTopPosition(el.offsetParent);
  }

  // 计算 offset
  const calculateOffset = (el, scrollTop) => {
    if (!el) {
      return 0;
    }
    return (
      calculateTopPosition(el) +
      (el.offsetHeight - scrollTop - window.innerHeight)
    );
  }

  const scrollListener = () => {
    const node = scrollRef.current;
    const before = {};

    if (!node || !node.parentElement) return;

    let offset;

    if (props.useWindow) {
      const doc = document.documentElement || document.body.parentElement || document.body // 全局滚动容器
      const scrollTop = window.pageYOffset || doc.scrollTop // 全局的 "scrollTop"

      offset = props.isReverse ? scrollTop : calculateOffset(node, scrollTop)
    } else {
      offset = props.isReverse
      ? parentElement.scrollTop
      : node.scrollHeight - parentNode.scrollTop - parentNode.clientHeight
    }

    // 是否到达阈值，是否可见
    if (offset < threshold && node.offsetParent !== null) {
      detachScrollListener(); // 加载的时候去掉监听器

      before.beforeScrollHeight = parentElement.scrollHeight;
      before.beforeScrollTop = parentElement.scrollTop;

      beforeRef.current = before;
      pageLoaded.current = pageLoaded.current + 1
      props.loadMore() // 加载更多
      setLoading(true) // 正在加载更多
    }
  }

  const mousewheelListener = (e) => {
    // 详见: https://stackoverflow.com/questions/47524205/random-high-content-download-time-in-chrome/47684257#47684257
    // @ts-ignore mousewheel 事件里存在 deltaY
    if (e.deltaY === 1) {
      e.preventDefault()
    }
  }

  const getParentElement = (el) => {
    const scrollParent = props.getScrollParent && props.getScrollParent()

    if (scrollParent) {
      return scrollParent
    }

    return el && el.parentElement
  }

  const attachScrollListener = () => {
    const parentElement = getParentElement(scrollRef.current)

    if (!parentElement) return

    const scrollEl = props.useWindow ? window : parentElement

    scrollEl.addEventListener('scroll', scrollListener, eventOptions)
    scrollEl.addEventListener('resize', scrollListener, eventOptions)
    scrollEl.addEventListener('mousewheel', mousewheelListener, eventOptions)

    // 初始加载
    if (props.initialLoad) {
      scrollListener()
    }
  }

  const detachScrollListener = () => {
    const scrollEl = getParentElement(scrollRef.current)

    if (!scrollEl) return

    scrollEl.removeEventListener('scroll', scrollListener, eventOptions)
    scrollEl.removeEventListener('resize', scrollListener, eventOptions)
    scrollEl.removeEventListener('mousewheel', mousewheelListener, eventOptions)
  }

  useEffect(() => {
    pageLoaded.current = props.pageStart;
  }, [props.pageStart]);

  useEffect(() => {
    if (props.isReverse && props.loadMore) {
      const parentElement = getParentElement(scrollRef)
      const before = beforeRef.current;

      if (parentElement) {
        // 更新滚动条的位置
        parentElement.scrollTop = parentElement.scrollHeight - before.beforeScrollHeight + before.beforeScrollTop
        setLoading(false);
      }
    }
    attachScrollListener();
  })

  useEffect(() => {
    attachScrollListener();

    return () => {
      detachScrollListener();
    }
  }, [])

  const childrenArray = [children]
  if (loader) {
    // 根据 isReverse 改变 loader 的插入方式
    isReverse ? childrenArray.unshift(loader) : childrenArray.push(loader)
  }

  

  return (
    <div className="infiniter-scroll" ref={scrollRef}>
      {childrenArray}
    </div>
  );
};

InfiniterScroll.defaultProps = {
  threshold: 50, // 到达底部的阈值
  pageStart: 1, // 加载开始页码
  initialLoad: false, // 是否第一次加载
  useWindow: false, // 是否以 window 作为 scrollEl
  isReverse: false, // 是否为相反的无限滚动
}

export default InfiniterScroll;
