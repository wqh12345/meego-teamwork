import React from "react";
import { createRoot } from "react-dom/client";
import { ConfigProvider } from "antd";
import { webLocale, webTheme, webTableEmptyRender } from "../commConfig";
import { lazy} from 'react';
import ReactDOM from 'react-dom';
// 设置中文
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
dayjs.locale("zh");
import "../../../style/comm.less";
// import ControlIndex from "./index/index";
// import RegControlModal from "./components/RegControlModal";
// import RegDetailControlModal from "./components/RegDetailControlModal";
const ControlIndex = lazy(() => import('./index/index'));
const RegControlModal = lazy(() => import('./components/RegControlModal'));
const RegDetailControlModal = lazy(() => import('./components/RegDetailControlModal'));
const container = document.createElement("div");
container.id = "app";
document.body.appendChild(container);
const root = createRoot(container);
export async function initShared() {
  return window.JSSDK.shared.setSharedModules({
    React,
    ReactDOM,
  });
}
// 渲染的主入口
export default async() => {
  await initShared();
  root.render(
    <div style={{ minHeight: '150px' }}>
      <React.StrictMode>
        <ConfigProvider
          locale={webLocale()}
          theme={webTheme()}
          renderEmpty={webTableEmptyRender}
        >
          <ControlIndex />
        </ConfigProvider>
      </React.StrictMode>
    </div>
  );
};

// 功能弹窗内的渲染入口
export const RegModal = async() => {
  await initShared();
  root.render(
    <ConfigProvider
      locale={webLocale()}
      theme={webTheme()}
      renderEmpty={webTableEmptyRender}
    >
      <RegControlModal />
    </ConfigProvider>
  );
};

export const TaskDetailModal = async() => {
  await initShared();
  root.render(
    <ConfigProvider
      locale={webLocale()}
      theme={webTheme()}
      renderEmpty={webTableEmptyRender}
    >
      <RegDetailControlModal />
    </ConfigProvider>
  );
};
