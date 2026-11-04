import React from "react";
import { lazy} from 'react';
import ReactDOM from 'react-dom';
import { createRoot } from "react-dom/client";
import { webLocale, webTheme, webTableEmptyRender } from "../commConfig";
import { ConfigProvider } from "antd";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
dayjs.locale("zh");
import "../../../style/comm.less";
// import Index from "./index/index";
const Index = lazy(() => import('./index/index'));
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
export default async () => {
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

