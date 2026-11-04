import React from "react";
import { lazy} from 'react';
import ReactDOM from 'react-dom';
import { createRoot } from "react-dom/client";
import { ConfigProvider } from "antd";
import { webLocale, webTheme, webTableEmptyRender } from "../commConfig";
// 设置中文
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
dayjs.locale("zh");
import "../../../style/comm.less";
// import Index from "./index/index";
const Index = lazy(() => import('./index/index'));
const RegControlModal = lazy(() => import('../control/components/RegControlModal'));
const RegDetailControlModal = lazy(() => import('../control/components/RegDetailControlModal'));
// import RegControlModal from "../control/components/RegControlModal";
//import RegDetailControlModal from "../control/components/RegDetailControlModal";

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
export default async() => {
  await initShared();  
  root.render(
    <div>
      <React.StrictMode>
        <ConfigProvider
          locale={webLocale()}
          theme={webTheme()}
          renderEmpty={webTableEmptyRender}
        >
          <Index />
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
