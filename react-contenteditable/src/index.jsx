import React, {useState, useEffect, useRef, useCallback} from 'react';
import { replaceCaret } from './utils';

const ContentEditable = (props) => {
  const [value, setV] = useState('');
  const editRef = useRef(null);
  const lastHtml = useRef(null);

  useEffect(() => {
    setV(props.value);
    if (this.editRef.current) {
      replaceCaret(this.editRef.current) // 把光标放到最后
    }
    lastHtml.current = props.value;
  }, [props.value])

  const emitEvent = useCallback((originalEvent) => {
    if (!this.editRef.current) return

    const html = this.editRef.current.innerHTML
    if (this.props.onChange && html !== lastHtml.current) { // 与上次的值不一样才回调
      const event = { // 合并事件，这里主要改变 target.value 的值
        ...originalEvent,
        target: {
          ...originalEvent.target,
          value: html || ''
        }
      }

      this.props.onChange(event) // 执行回调
      lastHtml.current = html;
    }
  }, [value])

  return (
    <div
      contentEditable={!props.disabled}
      ref={editRef}
      onInput={emitEvent}
      onBlur={props.onBlur}
      dangerouslySetInnerHTML={{__html: value || ''}}
    >
      {props.children}
    </div>
  );
};

export default ContentEditable;