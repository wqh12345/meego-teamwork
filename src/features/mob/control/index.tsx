import React from "react";
import { createRoot } from "react-dom/client";
import { ConfigProvider, Empty } from "antd";
// 设置中文
import dayjs from "dayjs";
import zhCN from "antd/locale/zh_CN";
import "dayjs/locale/zh-cn";
dayjs.locale("zh");
import ControlIndex from "./index/index";
import "../../../style/comm.less";
import noDataTab from "../../../image/no-data-table.png";

const container = document.createElement("div");
container.id = "app";
document.body.appendChild(container);
const root = createRoot(container);

const tableEmptyRender = () => {
  return (
    <Empty
      image={noDataTab}
      imageStyle={{
        height: 90,
        width: 90,
        margin: 'auto',
        marginBottom: 10
      }}
      description={
        <span style={{ color: "#727272", fontSize: "12px" }}>暂无数据</span>
      }
    ></Empty>
  );
};

const theme = {
  token: {
    borderRadius: 8,
    colorError: "#DF000E",
    colorErrorBg: "#FBE5E6",
    colorInfo: "#4247F6",
    colorInfoBg: "#ECECFE",
    colorPrimary: "#4247F6",
    colorPrimaryHover: "#3D42D1",
    colorPrimaryActive: "#4247F6",
    colorPrimaryBg: "#ECECFE",
    colorSuccess: "#00AB7C",
    colorSuccessBg: "#E5F6F1",
    colorWarning: "#EB981A",
    colorWarningBg: "#FDF4E8",
    controlHeight: 36,
    colorText: "#262626",
    colorTextQuaternary: "#BBBBBB",
    colorTextSecondary: "#727272",
    colorTextTertiary: "#BBBBBB",
    colorBorder: "#EDEDED",
    shortMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  },
  components: {
    Menu: {
      subMenuItemBg: "#FFFFFF",
      itemHeight: 48,
      itemMarginInline: 24,
      iconMarginInlineEnd: 13,
      itemBg: "transparent",
      itemPaddingInline: 30,
      itemColor: "#727272",
      horizontalItemSelectedColor: "#4247F6",
      horizontalItemHoverColor: "#3D42D1",
    },
    Tabs: {
      cardHeight: 24,
      horizontalItemPadding: "0",
      titleFontSize: 16,
      colorBorderSecondary: "#FFFFFF",
      inkBarColor: "#FFFFFF",
      colorText: "#262626",
    },
    message: {
      fontSize: 16,
      colorText: "#222222",
      contentBg: "",
    },
    Modal: {
      titleColor: "#222222",
    },
    Breadcrumb: {
      itemColor: "#262626",
      lastItemColor: "#262626",
      linkColor: "#262626",
      linkHoverColor: "#262626",
      colorBgTextHover: "transparent",
    },
    Button: {
      defaultShadow: "none",
      primaryShadow: "none",
      dangerShadow: "none",
    },
    Cascader: {
      controlWidth: 250,
    },
    Table: {
      bodySortBg: "#ecefff",
      headerBorderRadius: 6,
    },
    Form: {
      itemMarginBottom: 10
    }
  },
};

root.render(
  <div>
    <React.StrictMode>
      <ConfigProvider
        locale={zhCN}
        theme={theme}
        renderEmpty={tableEmptyRender}
      >
        <ControlIndex />
      </ConfigProvider>
    </React.StrictMode>
  </div>
);
