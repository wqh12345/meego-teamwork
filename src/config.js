import axios from 'axios'
import pluginConfig from '../plugin.config.json'
import { message, Modal, Badge, Button, Space } from 'antd'
import { getAuthToken, getUserRole,setJumpPayUuid,getDisplayLogic} from './api/api'
import { generateUuid} from "./util/util";
import modalService from './modalService';
/** 生产环境 */
// "siteDomain": "https://project.feishu.cn",
//   "pluginId": "MII_669762557ECB4003",
//   "pluginSecret": "f7dab37176833f83a26de99113451402b6fc6cf74490c16938d1bc67886a5892593e89fc5577dd393222cdac48f0675d",
//   "baseUrl": "https://timeplugin.lundong.com.cn",
//   "boardKey": "board_fikkli",
//   "timeisvAppId":"cli_aa924ccc3bb81bc4",
//   "timeisvServerUrl":"timeisv-web-prod.lundong.com.cn",

/** 测试环境 */
//  "siteDomain": "https://project.feishu.cn",
//   "pluginId": "MII_6695DDDC36A18001",
//   "pluginSecret": "d737304d76d988ec34ff9968318a8012a37d76f8d6e356c03b454840d7f0a67033937454bc034f93852a2a63ea6861ab",
//   "baseUrl": "https://timeplugintest.lundong.com.cn",
//   "boardKey": "board_2_bh9a",
//   "timeisvAppId":"cli_aac4a3dcbab85bd7",
//   "timeisvServerUrl":"timeisv-web-test.lundong.com.cn",


/** 开发环境 */
// "siteDomain": "https://project.feishu.cn",
//   "pluginId": "MII_664AE0D1DE040001",
//   "pluginSecret": "649afa803b369acbc2c8785037e02294a9a8e80ca0e86492c1af483d5e09e2e3133d75aa794761fa3fa0a0530ec71b26",
//   "baseUrl": "https://workhour.lundong.com.cn",
//   "boardKey": "board_0xhr28",
//   "timeisvAppId":"cli_a9572ba449785cc5",
//   "timeisvServerUrl":"timeisv-web-dev.lundong.com.cn",

/** Meegle（日本版 BG）生产环境 */
// "siteDomain": "https://project.larksuite.com"
// "pluginId": "MII_AFF595C63EA6EF18"
// "pluginSecret": "72c160549d69ab2c6e9736ef35967d008ffd4bc38a157cb7c1c4e04b80cb9939d91dcdae474e5738905bfb30ebdd69c8"
// "baseUrl": "https://timeplugin-bg.lundong.com.cn"
// "boardKey": "board_ya17x0"

/** Meegle（日本版 BG）测试环境 */
// "siteDomain": "https://project.larksuite.com"
// "pluginId": "MII_AFA4CCA8F653B347"
// "pluginSecret": "ed4363d0352cd0be114b2fec452b9b5ba3465edb27c6fb32f409c45bb2967eda0dba02a4170d09dec4ea4974d5aa2734"
// "baseUrl": "https://bg-test-timeplugin.lundong.com.cn"
// "boardKey": "board_f3aibp"

/** Meegle（新加坡版）生产环境 */
// "siteDomain": "https://project.larksuite.com"
// "pluginId": "MII_AB32BBEF927CA98B"
// "pluginSecret": "3d114dc6a5565ef048aeb1d8056f8e00fdc9dd9b995dffb0746006df86075659f5b86da58d70e38825a215d855e537d2"
// "baseUrl": "https://timeplugin-bg.lundong.com.cn"

/** Meegle（新加坡版）测试环境 */
// "siteDomain": "https://project.larksuite.com"
// "pluginId": "MII_AB80E3122650DA1E"
// "pluginSecret": "e1593be84f10a63dd16a44209018b6c73dc8dfb076fcfcf62eeb6445ac4d1ce85643bfdeec3200753cee080fc0aac8f1"
// "baseUrl": "https://timeplugin-bg.lundong.com.cn"
async function handlePaymentRedirect() {
    const hostname = await window.JSSDK.navigation.getHostname();
    window.JSSDK.Context.load().then(async (ctx) => {
      const mainSpace = ctx.mainSpace;
      const space = await window.JSSDK.Space.load(mainSpace?.id);
      const data={
        uuid:generateUuid(),
        value:1
      }
      try {
        const res = await setJumpPayUuid(data);
        if (res?.result) {  // 确保API调用成功后再跳转
          window.JSSDK.navigation.open(
            `https://${hostname}/${space?.simpleName}/meegoPlg/${pluginConfig.pluginId}_${pluginConfig.boardKey}?uuid=${data.uuid}`
          );
        }
      } catch (error) {
        window.JSSDK.navigation.open(
          `https://${hostname}/${space?.simpleName}/meegoPlg/${pluginConfig.pluginId}_${pluginConfig.boardKey}?uuid=${data.uuid}`
        );
      }
    });
}
axios.defaults.timeout = 100000

// 常量提取
const TOKEN_INVALID_CODES = [10210, 1002, 1001, 1003, 10022, 10021]
const TOKEN_INVALID_KEYWORDS = ['Token is missing', 'Token was']
const SPECIAL_URLS = {
  NO_AUTH: 'noAuth/getAuthToken',
  USER_ACTIVE: 'operation/management/user/active',
  SMS_CHECK: 'sms/checkCode',
  BIND_PROJECT: 'measurement/bindMeasurementProject'
}

// 是否正在刷新的标记
let isRefreshing = false
// 重试队列，每一项将是一个待执行的函数形式
let requests = []

// 辅助函数：检查 token 是否失效
function isTokenInvalid(code, msg) {
  return TOKEN_INVALID_CODES?.includes(code) ||
    (msg && TOKEN_INVALID_KEYWORDS.some(keyword => msg?.includes(keyword)))
}

// 辅助函数：显示错误信息
function showErrorMessage(code, msg,url) {
  if (code === 2001) {
    window.JSSDK.toast.error('该成员为此空间最后一名管理员')
  } else if (code !== 200) {
    if(url?.includes('work/hour/v2/register/cache?point') && (code===10062 || code===110015)){
      window.JSSDK.toast.error('权限已更新：您现在只能登记自己的工时。他人工时数据已清除。')
    }else{
      window.JSSDK.toast.error(msg)
    }
  }
}
// 1. 定义一个对象来跟踪特定错误的Modal是否已显示
const modalStatus = {
  isShowed: false,
  currentCode: null
};
/**
 * http request 拦截器
 */
axios.interceptors.request.use(
  (config) => {
    config.baseURL = pluginConfig.baseUrl
    config.headers.set('Project-Key', sessionStorage.getItem('jwtMeegoTeamworkProjectKey'))
    config.headers.set('Plugin-Version', pluginConfig.pluginVersion)

    if (!config.url?.includes(SPECIAL_URLS.NO_AUTH)) {
      config.headers.set('Authorization', sessionStorage.getItem(`${pluginConfig.pluginId}-jwtMeegoTeamworkToken`))
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

/**
 * http response 拦截器
 */
axios.interceptors.response.use(
  async (response) => {
    const url = response?.config?.url

    if (url?.includes(SPECIAL_URLS.USER_ACTIVE)) return

    if (!response || !response.data || typeof response.data === 'string') {
      window.JSSDK.toast.warning('请刷新页面，重试')
      return { data: { result: false } }
    }

    const code = response.data.code
    const msg = response.data.msg || response.data.message
    response.data.result = code === 200

    if (url?.includes(SPECIAL_URLS.SMS_CHECK)) return response.data
    if (url?.includes(SPECIAL_URLS.BIND_PROJECT) && [10025, 10024, 10026,40100, 40003]?.includes(code)) return response.data

    // token 失效处理
    if (isTokenInvalid(code, msg)) {
      const config = response.config
      if (!isRefreshing) {
        isRefreshing = true
        try {
          const codeRes = await window.JSSDK.utils.getAuthCode()
          const res = await getAuthToken({ authorizationCode: codeRes.code, flag: 'new' })
          const newToken = res?.data?.authToken
          if (newToken) {
            sessionStorage.setItem(`${pluginConfig.pluginId}-jwtMeegoTeamworkToken`, newToken)
            config.headers['Authorization'] = newToken
            requests.forEach((cb) => cb(newToken))
            requests = []
            return axios(config)
          }
        } catch (err) {
          console.error('refreshToken error =>', err)
        } finally {
          isRefreshing = false
        }
      } else {
        return new Promise((resolve) => {
          requests.push((token) => {
            config.headers['Authorization'] = token
            resolve(axios(config))
          })
        })
      }
    }

    // 租户套餐已到期
    if (code === 10024) {
      modalService.info({
        title: "版本权限已过期",
        closable: true,
        content: (
          <>
            <Badge
              color="#4247f6"
              text={<div style={{ display: "inline-block" }}>
                您的
                <span style={{ fontWeight: 600, color: "#4247f6" }}>
                  {response?.data?.msg}
                </span>
                套餐已到期，请重新购买后使用
              </div>}
            />
          </>
        ),
        footer: (
          <Space
            style={{
              marginTop: "20px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Button
              onClick={() => window.JSSDK.navigation.open(response?.data?.url)}
            >
              咨询客服
            </Button>
            <Button
              type="primary"
              onClick={async () => {
                try {
                  const resInfo = await getDisplayLogic();
                  if (resInfo?.result) {
                    if ("standardProduct" in resInfo.data && !resInfo.data?.standardProduct) {
                      handlePaymentRedirect()
                    }else{
                      window.JSSDK.navigation.open(`https://project.feishu.cn/openapp/plugin_share?appKey=${pluginConfig.pluginId}`)
                    }
                  }
                }catch (error) {
                  window.JSSDK.navigation.open(`https://project.feishu.cn/openapp/plugin_share?appKey=${pluginConfig.pluginId}`)
                }
              }}
            >
              立即续费
            </Button>
          </Space>
        ),
      });
      return { data: { ...response.data, result: false } }
    }

    // 租户没有过套餐
    if (code === 10025) {
      modalService.info({
        title: null,
        closable: true,
        width: 480,
        wrapClassName: 'modal-wrap-receive',
        icon: null,
        content: (
          <>
            <div className='modal-title'><span className='modal-title-icon'></span>限时福利：15天免费试用！</div>
            <div className='modal-content'><span className='modal-content-icon'></span>为感恩回馈，已为您准备好<span style={{ fontWeight: 600 }}>15天免费试用福利</span></div>
            <div className='modal-content'><span className='modal-content-icon'></span>试用期间，您可以畅享所有功能，全面感受高效、透明的工时管理体验。</div>
            <div className='modal-content'><span className='modal-content-icon'></span>
              试用到期后，系统将自动进入“只读模式”，您仍可查看历史数据和页面，但无法进行新增或编辑操作。
            </div>
          </>
        ),
        footer: (
          <div style={{ textAlign: "center", marginTop: "20px" }}>
            <div
              className='modal-btn'
              onClick={async () => {
                try {
                  const resInfo = await getDisplayLogic();
                  if (resInfo?.result) {
                    if ("standardProduct" in resInfo.data && !resInfo.data?.standardProduct) {
                      handlePaymentRedirect()
                    }else{
                      window.JSSDK.navigation.open(`https://project.feishu.cn/openapp/plugin_share?appKey=${pluginConfig.pluginId}`)
                    }
                  }
                }catch (error) {
                  window.JSSDK.navigation.open(`https://project.feishu.cn/openapp/plugin_share?appKey=${pluginConfig.pluginId}`)
                }
              }}
            >
              <span className='modal-btn-icon'></span>立即领取15天权益
            </div>
          </div>
        ),
      });
      return { data: { ...response.data, result: false } }
    }
    // 提示没有席位
   if (code === 10026) {
     const isAdmin = sessionStorage.getItem("jwtMeegoTeamworkUserRole") === "Admin";
     let isInstalled = false;
     let isv_userRole = '';
     try {
       const raw = sessionStorage.getItem("tenantModeInfo");
       if (raw) {
         const tenantModeInfo = JSON.parse(raw);
         isInstalled = !!tenantModeInfo.install;
         isv_userRole = tenantModeInfo.userRole || '';
       }
     } catch (_) {}

     const isTenantAdmin = isv_userRole === 'app_admin' || isv_userRole === 'space_admin';
     const canConfigSeat = isInstalled ? isTenantAdmin : isAdmin;

     let contentText;
     if (!isInstalled) {
       contentText = isAdmin
         ? "您的账号还未被配置可用席位。作为插件管理员，您可以点击下方按钮进行配置。"
         : "很抱歉，您的账号还未被企业配置可用席位。请联系您企业的【插件管理员】为您开通。";
     } else {
       contentText = isTenantAdmin
         ? "您的账号还未被配置可用席位。作为应用管理员或插件管理员，您可以点击下方按钮进行配置。"
         : "很抱歉，您的账号还未被企业配置可用席位。请联系您企业的【应用管理员】或【插件管理员】为您开通。";
     }

     modalService.info({
        title: "无席位权限",
        closable: true,
        content: (
          <>
           <div>{contentText}</div>
           <div>若仍有问题，可随时联系我们的客服团队。</div>
          </>
        ),
        footer: (
          canConfigSeat
      ?(<Space
            style={{
              marginTop: "20px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Button
              onClick={() => window.JSSDK.navigation.open(response?.data?.url)}
            >
              联系客服
            </Button>
            <Button
              type="primary"
              onClick={async () => {
                const hostname = await window.JSSDK.navigation.getHostname();
                window.JSSDK.Context.load().then(async (ctx) => {
                  const mainSpace = ctx.mainSpace;
                  const space = await window.JSSDK.Space.load(mainSpace?.id);
                  const data={
                    uuid:generateUuid(),
                    value:1
                  }
                  try {
                    const res = await setJumpPayUuid(data);
                    if (res?.result) {  // 确保API调用成功后再跳转
                      window.JSSDK.navigation.open(
                        `https://${hostname}/${space?.simpleName}/meegoPlg/${pluginConfig.pluginId}_${pluginConfig.boardKey}?uuid=${data.uuid}&&isSeat=1`
                      );
                    }
                  } catch (error) {
                    window.JSSDK.navigation.open(
                      `https://${hostname}/${space?.simpleName}/meegoPlg/${pluginConfig.pluginId}_${pluginConfig.boardKey}?uuid=${data.uuid}&&isSeat=1`
                    );
                  }
                });
              }}
            >
              配置席位
            </Button></Space>):(<Space
            style={{
              marginTop: "20px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Button
              onClick={() => window.JSSDK.navigation.open(response?.data?.url)}
            >
              联系客服
            </Button></Space>)
        ),
      });
      return { data: { ...response.data, result: false } }
    }
    showErrorMessage(code, msg,url)
    if (code !== 200) {
      response.ok = false
      return false
    }

    return response.data
  },
  (error) => {
    console.error('请求出错：', error)
    const url = error?.request?.responseURL || ''
    if (url?.includes(SPECIAL_URLS.USER_ACTIVE)) return

    if (error?.request?.status === 403) {
      window.JSSDK.toast.warning('当前没有权限，请联系管理员')
    } else if (error?.request?.status === 404) {
      return { data: { result: false } }
    } else {
      window.JSSDK.toast.warning('网络错误，请稍后再试')
    }
    return { data: { result: false } }
  }
)

export async function getToken() {
  try {
    const { code } = await window.JSSDK.utils.getAuthCode()
    const res = await getAuthToken({ authorizationCode: code, flag: 'new' })
    if (res && res.data) {
      sessionStorage.setItem(`${pluginConfig.pluginId}-jwtMeegoTeamworkToken`, res.data.authToken)
      const { data: userRoleData } = await getUserRole()
      if (userRoleData) {
        sessionStorage.setItem('jwtMeegoTeamworkUserRole', userRoleData)
      }
      return true
    }
    return false
  } catch (e) {
    console.error('getToken error:', e)
    return false
  }
}

const createRequest = (method) => (url, data) =>
  axios[method](url, method === 'get' ? { params: data } : data)

export const get = createRequest('get')
export const del = createRequest('delete')
export const post = createRequest('post')
export const patch = createRequest('patch')
export const put = createRequest('put')
