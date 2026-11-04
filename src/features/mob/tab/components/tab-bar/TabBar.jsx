import React from "react";
import { Avatar, TabBar } from "antd-mobile";
import {
  UnorderedListOutline,
  UserSetOutline,
  SetOutline,
} from "antd-mobile-icons";
import { useNavigate, useLocation } from "react-router-dom";
import "./TabBar.css";

const MbTabBar = () => {
  const tabs = [
    {
      key: "/mb/log",
      title: "日志",
      icon: <UnorderedListOutline />,
      // icon: (active) =>
      //   active ? (
      //     <Avatar style={{ "--size": "24px" }} src={homeActiveIcon} />
      //   ) : (
      //     <Avatar style={{ "--size": "24px" }} src={homeIcon} />
      //   ),
    },
    {
      key: "/mb/management",
      title: "管理",
      icon: <UserSetOutline />,
      // icon: (active) =>
      //   active ? (
      //     <Avatar style={{ "--size": "24px" }} src={chartsActiveIcon} />
      //   ) : (
      //     <Avatar style={{ "--size": "24px" }} src={chartsIcon} />
      //   ),
    },
    {
      key: "/mb/setting",
      title: "设置",
      icon: <SetOutline />,
      // icon: (active) =>
      //   active ? (
      //     <Avatar style={{ "--size": "24px" }} src={exchangeActiveIcon} />
      //   ) : (
      //     <Avatar style={{ "--size": "24px" }} src={exchangeIcon} />
      //   ),
    },
  ];

  const navigate = useNavigate();
  const location = useLocation();
  const { pathname } = location;

  const setRouteActive = (value) => {
    navigate(value);
  };

  return (
    <div padding="0" className="tab-bar-warp">
      <TabBar activeKey={pathname} onChange={(value) => setRouteActive(value)}>
        {tabs.map((item) => (
          <TabBar.Item key={item.key} icon={item.icon} title={item.title} />
        ))}
      </TabBar>
    </div>
  );
};
export default MbTabBar;
