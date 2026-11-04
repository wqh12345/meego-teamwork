// MainLayout.jsx
import React from 'react';
import MbTabBar from './MbTabBar';
import './TabBar.css'; // 引入样式

const MainLayout = ({ children }) => {
  return (
    <div className="main-layout">
      {/* 主要内容区域 */}
      <main className="main-content">
        {children}
      </main>
      
      {/* 底部 TabBar */}
      <MbTabBar />
    </div>
  );
};

export default MainLayout;