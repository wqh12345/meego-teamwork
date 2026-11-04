import React from "react";
import { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom';
import { createRoot } from "react-dom/client";
import { ConfigProvider } from "antd";
import { webLocale, webTheme, webTableEmptyRender } from "../commConfig";
// 设置中文
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
dayjs.locale("zh");
import "../../../style/comm.less";
// import MeegleRegModal from "../components/meegle-reg-modal/MeegleRegModal";
// import Index from "./index/index";

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
const Index = lazy(() => import('./index/index'));
const MeegleRegModal = lazy(() => import('../components/meegle-reg-modal/MeegleRegModal'));
export default async () => {
  await initShared();  
  root.render(
    <Suspense fallback={<></>}>
      <ConfigProvider
        locale={webLocale()}
        theme={webTheme()}
        renderEmpty={webTableEmptyRender}
      >
        <Index />
      </ConfigProvider>
    </Suspense>
  );
};

export const RegModal = async() => {
  await initShared();
  root.render(
    <ConfigProvider
      locale={webLocale()}
      theme={webTheme()}
      renderEmpty={webTableEmptyRender}
    >
      <MeegleRegModal />
    </ConfigProvider>
  );
};