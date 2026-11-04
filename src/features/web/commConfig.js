import { Empty } from "antd";
import zhCN from "antd/locale/zh_CN";
export function webLocale() {
    return zhCN
}
export function webTableEmptyRender() {
    return (
        <Empty
            image={require("../../image/no-data-table.png")}
            styles={{
                image: {
                    height: 90,
                    width: 90,
                    margin: "auto",
                    marginBottom: 10,
                }
            }}
            description={
                <span style={{ color: "#727272", fontSize: "12px" }}>暂无数据</span>
            }
        ></Empty>
    );
}
export function webTheme() {
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
            Table: {
                bodySortBg: "#ecefff",
                headerBorderRadius: 6,
                rowExpandedBg: '#FFFFFF'
            },
            Menu: {
                subMenuItemBg: "#FFFFFF",
                itemHeight: 34,
                itemMarginInline: 14,
                itemBg: "transparent",
                itemPaddingInline: 14,
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
                paddingBlockSM: 6,
                paddingInlineSM: 15,
            },
            Cascader: {
                controlWidth: 250,
            },
        },
    };
    return theme;
}
export default {
    webLocale,
    webTableEmptyRender,
    webTheme
}