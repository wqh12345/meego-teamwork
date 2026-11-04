import React, { useMemo } from "react";
import { TabBar } from "antd-mobile";
import { useNavigate, useLocation } from "react-router-dom";
import "./TabBar.css";

// 导入图标
import mbLogo from "../../../../../image/assets/mblog.png";
import mblogs from "../../../../../image/assets/mblogs.png";
import mbmanagement from "../../../../../image/assets/mbmanagement.png";
import mbmanagements from "../../../../../image/assets/mbmanagements.png";
import mbsetting from "../../../../../image/assets/mbsetting.png";
import mbsettings from "../../../../../image/assets/mbsettins.png";
import mbapproval from "../../../../../image/assets/mbapproval.png";
import mbapprovals from "../../../../../image/assets/mbapprovals.png";

const MbTabBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname } = location;

  // 创建自定义的 TabBar.Item 组件
  const TabBarItemWithCustomIcon = ({ tab, isActive }) => {
    const iconSrc = isActive ? tab.icon : tab.inactiveIcon;
    
    return (
      <div 
        className={`tab-bar-item ${isActive ? 'active' : ''}`}
        onClick={() => handleTabChange(tab.key)}
      >
        <img 
          src={iconSrc} 
          alt={tab.title} 
          className="tab-bar-icon"
        />
        <span className="tab-bar-title">{tab.title}</span>
      </div>
    );
  };

  // 使用 useMemo 优化图标配置
  const tabs = useMemo(() => {
    const baseTabs = [
      {
        key: "/mb/log",
        title: "工时",
        icon: mbLogo,
        inactiveIcon: mblogs,
      },
      // {
      //   key: "/mb/management",
      //   title: "管理",
      //   icon: mbmanagements,
      //   inactiveIcon: mbmanagement,
      // },
      {
        key: "/mb/approval",
        title: "审批",
        icon: mbapprovals,
        inactiveIcon: mbapproval,
      },
    ];
    
    // 只有管理员才显示设置菜单
    const isAdmin = sessionStorage.getItem("jwtMeegoTeamworkUserRole") === "Admin";
    if (isAdmin) {
      baseTabs.push({
        key: "/mb/setting",
        title: "设置",
        icon: mbsettings,
        inactiveIcon: mbsetting,
      });
    }
    
    return baseTabs;
  }, []);

  // 清理缓存
  const clearPageCache = (path) => {
    const cacheKeys = {
      '/mb/approval': [
        'mbApproval_mainTab',
        'mbApproval_subTab',
        'mbApproval_filterStatus',
        'mbApproval_pageNum',
        'mbApproval_scrollTop'
      ],
    };
    
    const keysToClear = cacheKeys[path] || [];
    keysToClear.forEach(key => {
      sessionStorage.removeItem(key);
    });
  };

  const handleTabChange = (value) => {
    console.log('TabBar: 切换到', value, '当前路径:', pathname);
    clearPageCache(value);
    navigate(value);
  };

  // 计算当前激活的 key
  const activeKey = useMemo(() => {
    // 精确匹配
    const exactMatch = tabs.find(tab => pathname === tab.key);
    if (exactMatch) return exactMatch.key;
    
    // 子路由匹配
    if (pathname.startsWith('/mb/')) {
      for (let tab of tabs) {
        if (pathname.startsWith(tab.key + '/') || pathname === tab.key) {
          return tab.key;
        }
      }
    }
    
    return tabs[0].key;
  }, [pathname, tabs]);

  return (
    <>
      {/* 安全区域占位符（仅在移动端需要） */}
      <div className="safe-area-bottom" />
      
      {/* TabBar 容器 - 自定义实现 */}
      <div className="tab-bar-container">
        <div className="custom-tab-bar">
          {tabs.map((tab) => {
            const isActive = activeKey === tab.key;
            return (
              <TabBarItemWithCustomIcon 
                key={tab.key}
                tab={tab}
                isActive={isActive}
              />
            );
          })}
        </div>
      </div>
    </>
  );
};

export default MbTabBar;