import React, { useState, useRef, useEffect } from 'react';
import { Input } from 'antd';
import './FeishuStyleInput.less';

const FeishuStyleInput = ({
  value,
  onChange,
  width = 200,
  maxRows = 10,
  placeholder,
  ...rest
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const textRef = useRef(null);
  const [height, setHeight] = useState('auto');
  const inputRef = useRef(null)
  const lineHeight = 22; // 单行高度
  
  // 同步外部value变化
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);
  
  // 计算文本高度
  useEffect(() => {
    if (isEditing && textRef.current) {
      const maxHeight = lineHeight * maxRows;
      const scrollHeight = textRef.current.scrollHeight;
      // 限制最大高度，超过显示滚动条
      setHeight(Math.min(scrollHeight, maxHeight));
    }
  }, [inputValue, isEditing, maxRows]);
  useEffect(() => {
    if (isEditing &&inputRef.current) {
        const textarea = inputRef.current.resizableTextArea.textArea;
        textarea.focus();
        const len = textarea.value.length;
        // 现代浏览器
        if (typeof textarea.selectionStart === 'number' && typeof textarea.selectionEnd === 'number') {
          textarea.selectionStart = textarea.selectionEnd = len;
        } 
        // IE 兼容
        else if (document.selection) {
          const sel = textarea.createTextRange();
          sel.moveStart('character', len);
          sel.collapse();
          sel.select();
        }
    }
  }, [isEditing]);
  const handleFocus = () => {
    setIsEditing(true)
  };
  
  const handleBlur = () => {
    setIsEditing(false);
    onChange && onChange(inputValue);
  };
  
  const handleChange = (e) => {
    setInputValue(e.target.value);
  };
  
  // 处理键盘事件
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
    } else if (e.key === 'Escape') {
      setInputValue(value || '');
      handleBlur();
    }
  };
  return (
    <div 
      className="feishu-input-container"
      style={{ width: `${width}px` }}
    >
      {isEditing ? (
        <Input.TextArea
          ref={inputRef}
          value={inputValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          //autoFocus
          autoSize={{ minRows: 3,maxRows: 10}}
          showCount
          maxLength={200}
          style={{
            width: '238px',
            height: height,
            overflow: height >= lineHeight * maxRows ? 'auto' : 'hidden',
            resize: 'none'
          }}
          className="feishu-textarea"
          placeholder={placeholder}
          {...rest}
        />
      ) : (
        <div 
          className="feishu-display-text"
          onClick={handleFocus}
          onDoubleClick={handleFocus}
          title={inputValue || placeholder}
        >
          <div 
            ref={textRef}
            className="text-content"
            style={{ display: 'inline-block', width: '100%'}}
          >
            {inputValue || <span className="placeholder">{placeholder}</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export default FeishuStyleInput;
