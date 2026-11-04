import React from 'react';
import './PCOperationPrompt.less';
import goPcImg from '../../../image/assets/go-pc.png';
const PCOperationPrompt = () => {
  return (
    <div className="pc-operation-prompt">
      <div className="prompt-container">
        <div className="prompt-icon">
          <img src={goPcImg} alt="该操作需要去pc端操作" className="go-pc-image" />
        </div>
        <div className="prompt-text">该操作需要去pc端操作</div>
      </div>
    </div>
  );
};

export default PCOperationPrompt;