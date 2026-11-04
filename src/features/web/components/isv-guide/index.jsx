import React, { useEffect, useMemo, useState } from 'react'
import { Button, Radio, Segmented, Spin, Tooltip } from 'antd'
import {
  AppstoreOutlined,
  BarsOutlined,
  ExclamationCircleFilled,
  LinkOutlined,
  ReloadOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import {getFsChatUrl, changeTenantMode, getInstalledProjects, saveGuideDisplayed} from '../../../../api/api'
import kongjianImg from '../../../../image/kongjian.png'
import zhuhuImg from '../../../../image/zhuhu.png'
import './index.less'

const fallbackSpaces = []

const modeOptions = [
  {
    key: 'space',
    title: '空间模式',
    icon: <img src={kongjianImg} width="32" height="32" alt="空间模式" />,
    lines: ['各飞书项目空间独立管理，数据隔离', '适合团队成员在同一空间内登记工时'],
  },
  {
    key: 'tenant',
    title: '租户模式',
    badge: '推荐',
    icon: <img src={zhuhuImg} width="32" height="32" alt="租户模式" />,
    lines: ['跨飞书项目空间统一管理', '适合成员需要在多个空间登记工时的场景'],
  },
]

const roleOptions = [
  { label: '推荐安装ISV', value: 'all_members' },
  { label: '升级体验', value: 'app_admin' },
  { label: '应用管理员引导', value: 'app_admin_installed' },
  { label: '管理员配置页', value: 'space_admin' },
  { label: '普通用户页', value: 'member' },
]

const INSTALL_MANUAL_URL = 'https://ldkj.feishu.cn/wiki/TJmMwxorTigjqxkVh8XcmOOqngc'

/** 打开工时资源管理安装手册 */
const openInstallManual = () => {
  try {
    window.JSSDK.navigation.open(INSTALL_MANUAL_URL)
  } catch (e) {
    window.open(INSTALL_MANUAL_URL, '_blank')
  }
}

/** 联系我们 - 通过接口获取跳转地址 */
const openContactUs = async () => {
  try {
    const res = await getFsChatUrl()
    if (res?.code === 200 && res?.data) {
      window.JSSDK.navigation.open(res.data)
    }
  } catch (e) {
    console.error('获取联系客服地址失败:', e)
  }
}

const upgradeFeatures = [
  { icon: <BarsOutlined />, title: '跨空间工时登记', desc: '在一个页面登记多个空间的工时，无需切换空间' },
  { icon: <TeamOutlined />, title: '跨空间工时审批', desc: '所有空间的工时审批统一管理，无需切换空间' },
  { icon: <AppstoreOutlined />, title: '跨空间数据查看', desc: '所有空间的工时数据统一查看，全局数据一目了然' },
  { icon: <TeamOutlined />, title: '租户管理模式', desc: '基于租户维度管理成员，多空间场景下更严谨的工时管理' },
]

const HeroCard = () => (
  <div className="isv-card isv-hero-card">
    <div className="isv-hero-title">
      <h1>欢迎使用工时资源管理</h1>
      {/* <span>当前飞书应用为限时体验版</span> */}
    </div>
    <p className="isv-hero-desc">初次使用前，需要您完成一些基础配置，以供您更好的体验产品</p>
    <div className="isv-feature-box">
      <div className="isv-feature-icon" aria-hidden="true"><BarsOutlined /></div>
      <div className="isv-feature-content">
        <div className="isv-feature-title">精准统计工时，高效管理项目成本</div>
        <div className="isv-feature-desc">一款高效的人效管理工具，帮助您轻松记录工时、优化资源配置、提升团队协作效率。</div>
      </div>
    </div>
  </div>
)

const UserGuideContent = () => (
  <div className="isv-card isv-user-wait-card">
    <div className="isv-wait-title">
      <ExclamationCircleFilled />
      <h2>等待管理员完成配置</h2>
    </div>
    <p className="isv-wait-desc">在使用工时功能前，需要管理员完成相关配置。您也可以联系管理员打开应用，完成配置。完成配置后您即可开始使用。</p>

    <div className="isv-user-tip-box">
      <div className="isv-tip-lines">
        <p>· 您可以先查看产品介绍，了解产品功能和使用场景</p>
        <p>· 您可以让管理员查阅安装手册，快速完成工时配置</p>
        <p>· 若需进一步帮助，可联系我们获取支持</p>
      </div>
      <div className="isv-tip-links">
        <a onClick={() => {window.JSSDK.navigation.open('https://ldkj.feishu.cn/wiki/B4krwZh59i1fRJk6vNNc94cPnPc')}}><LinkOutlined /> 工时资源管理产品介绍</a>
        <a onClick={openInstallManual}><LinkOutlined /> 工时资源管理安装手册</a>
        <a onClick={openContactUs}>联系我们</a>
      </div>
    </div>

    <div className="isv-user-illustration" aria-hidden="true">
      <div className="isv-illus-dot dot-1" />
      <div className="isv-illus-dot dot-2" />
      <div className="isv-illus-dot dot-3" />
      <div className="isv-illus-paper paper-left" />
      <div className="isv-illus-paper paper-right" />
      <div className="isv-illus-person">
        <div className="isv-illus-hair" />
        <div className="isv-illus-face" />
        <div className="isv-illus-body" />
        <div className="isv-illus-folder" />
      </div>
      <div className="isv-illus-card card-left" />
      <div className="isv-illus-card card-right" />
    </div>
  </div>
)

const UpgradePage = ({ type, spaces = [], loading = false, submitLoading, onStart }) => {
  const isRecommend = type === 'recommend'
  const showSpaceList = type === 'installed-with-spaces'

  return (
    <div className="isv-upgrade-page-content">
      <div className={`isv-upgrade-card is-recommend}`}>
        <div className="isv-upgrade-title">
          <span className="isv-upgrade-star">✦</span>
          <h2>安装工时资源管理ISV，开启跨空间管理能力</h2>
        </div>
        <div className="isv-upgrade-tag">安装后可获得：</div>

        <div className="isv-upgrade-feature-grid">
          {upgradeFeatures.map((item) => (
            <div className="isv-upgrade-feature" key={item.title}>
              <div className="isv-upgrade-feature-icon">{item.icon}</div>
              <div>
                <div className="isv-upgrade-feature-title">{item.title}</div>
                <div className="isv-upgrade-feature-desc">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {showSpaceList ? (
          <div className="isv-upgrade-space-panel">
            <div className="isv-upgrade-space-title">已安装工时插件的空间（{spaces.length}个）</div>
            {loading ? (
              <div className="isv-space-loading"><Spin size="small" tip="加载中" /></div>
            ) : spaces.length === 0 ? (
              <div className="isv-space-empty" style={{ padding: '24px 0', textAlign: 'center',}}>
                <ExclamationCircleFilled style={{ fontSize: 28, marginBottom: 8, display: 'block'}} />
                <p>暂无已安装工时插件的空间,请先在飞书项目中安装工时插件</p>
              </div>
            ) : (
              <div className="isv-upgrade-space-grid">
                {spaces.map((space, index) => (
                  <div className="isv-upgrade-space-item" key={`${space}-${index}`} title={space}>
                    <span>{String(index + 1).padStart(2, '0')}</span>{space}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
          <div className="isv-install-desc">
            <div className="isv-install-desc-title"><ExclamationCircleFilled /> 安装说明</div>
            <p>安装需要飞书租户管理员、应用管理员或具备对应权限的用户</p>
            <p>如果您具备相关权限，请 <a>点击此处前往安装ISV</a></p>
            <p>如果您没有对应权限，可以让管理员查阅 <a onClick={openInstallManual}><LinkOutlined /> 工时资源管理安装手册</a>，快速完成工时配置</p>
            <p>如需帮助，请 <a onClick={openContactUs}>联系我们</a></p>
          </div>
        <div className="isv-upgrade-actions">
          <Button>我已知晓</Button>
          <Button type="primary" loading={submitLoading} onClick={onStart}>前往安装ISV</Button>
        </div>
      </div>
    </div>
  )
}

/** ISV升级弹窗 - 在页面中央以模态形式显示UpgradePage */
const IsvUpgradeModal = ({ spaces, loading, submitLoading, onStart, onClose }) => {
  return (
    <div className="isv-upgrade-modal-overlay" onClick={onClose}>
      <div className="isv-upgrade-modal-content" onClick={(e) => e.stopPropagation()}>
        <UpgradePage
          type="recommend"
          spaces={spaces}
          loading={loading}
          submitLoading={submitLoading}
          onStart={onStart}
        />
      </div>
    </div>
  )
}

const AdminGuideContent = ({
  spaces,
  loading,
  submitLoading,
  selectedMode,
  onRefresh,
  onModeChange,
  onStart,
}) => {
  const installedCountText = useMemo(() => `已安装工时插件的空间（${spaces.length}个）`, [spaces.length])

  return (
    <>
      <div className="isv-card isv-project-card">
        <div className="isv-step-title"><span>1</span><h2>项目设置</h2></div>
        <p className="isv-step-desc">工时数据需从飞书项目（Meegle）中获取。在使用ISV工时应用前，您需要先在飞书项目中安装工时插件，完成数据同步配置。</p>

        <div className="isv-space-panel">
          <div className="isv-space-panel-header">
            <div>{installedCountText}</div>
            <button type="button" onClick={onRefresh} disabled={loading} aria-label="刷新已安装空间列表">
              <ReloadOutlined spin={loading} /> 刷新
            </button>
          </div>
          {loading ? (
            <div className="isv-space-loading"><Spin size="small" tip="刷新中" /></div>
          ) : spaces.length === 0 ? (
            <div className="isv-space-empty" style={{ padding: '24px 0', textAlign: 'center', color: '#999' }}>
              <ExclamationCircleFilled style={{ fontSize: 28, marginBottom: 8, display: 'block', color: '#FADB14' }} />
              <p>暂无已安装工时插件的空间，请先在飞书项目中安装工时插件</p>
            </div>
          ) : (
            <div className="isv-space-grid" aria-label="已安装空间列表">
              {spaces.map((space, index) => (
                <div className="isv-space-item" key={`${space}-${index}`} title={space}>
                  <span>{String(index + 1).padStart(2, '0')}</span>{space}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="isv-help-box">
          <div>如何安装工时插件？</div>
          <p>请在飞书项目中安装工时插件，具体操作请参考 <a onClick={openInstallManual}>工时资源管理安装手册</a>，如需帮助，请 <a onClick={openContactUs}>联系我们</a></p>
        </div>
      </div>

      <div className="isv-card isv-mode-card">
        <div className="isv-step-title"><span>2</span><h2>管理模式设置</h2></div>
        <div className="isv-mode-row" role="radiogroup" aria-label="选择管理模式">
          {modeOptions.map((option) => {
            const active = selectedMode === option.key
            return (
              <button
                type="button"
                key={option.key}
                className={`isv-mode-item${active ? ' is-active' : ''}`}
                onClick={() => onModeChange(option.key)}
                aria-checked={active}
                role="radio"
              >
                <div className="isv-mode-icon" aria-hidden="true">{option.icon}</div>
                <div className="isv-mode-body">
                  <div className="isv-mode-title">
                    {option.title}{option.badge ? <em>{option.badge}</em> : null}
                  </div>
                  {option.lines.map((line) => <p key={line}>· {line}</p>)}
                </div>
                <Radio checked={active} aria-hidden="true" tabIndex={-1} />
              </button>
            )
          })}
        </div>
      </div>

      <div className="isv-guide-actions">
        <Tooltip
          title={spaces.length === 0 ? '至少安装1个工时插件才可使用，请前往飞书项目安装' : undefined}
        >
          <span style={{ display: 'inline-block' }}>
            <Button
              type={spaces.length === 0 ? 'dashed' : 'primary'}
              loading={submitLoading}
              onClick={onStart}
              disabled={spaces.length === 0 || loading}
              aria-label="开始使用"
            >
              开始使用
            </Button>
          </span>
        </Tooltip>
      </div>
    </>
  )
}

/** 将 API 返回的 userRole 映射为引导页内部角色 */
const mapApiRoleToGuideRole = (apiRole) => {
  if (!apiRole) return 'member'
  // app_admin / space_admin 等管理员角色 → 显示管理员配置引导
  if (apiRole === 'app_admin') return apiRole
  // member 或其他普通用户角色 → 显示普通用户引导
  return 'member'
}

const IsvGuidePage = ({ initialRole, onComplete }) => {
  const [role, setRole] = useState(() => mapApiRoleToGuideRole(initialRole))
  const [spaces, setSpaces] = useState(fallbackSpaces)
  const [loading, setLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [selectedMode, setSelectedMode] = useState('tenant')
  const isRecommendPage = role === 'all_members'
  const isUpgradePage = role === 'app_admin'
  const isAppAdminInstalledPage = role === 'app_admin_installed'
  const isAdminPage = role === 'app_admin'
  const isMemberPage = role === 'member'
  const isPopupPage = false
  const shouldLoadSpaces = isAdminPage || isAppAdminInstalledPage

  const loadSpaces = async () => {
    try {
      setLoading(true)
      const res = await getInstalledProjects()
      if (res?.code === 200 && Array.isArray(res.data) && res.data.length > 0) {
        const list = res.data.map((item) => item.projectName || item.name || item.label).filter(Boolean)
        if (list.length > 0) setSpaces(list)
      }
    } catch (e) {
      console.error('获取已安装空间失败:', e)
    } finally {
      setLoading(false)
    }
  }

  // useEffect(() => {
  //   setRole(getUserRole())
  // }, [])

  useEffect(() => {
    if (shouldLoadSpaces) loadSpaces()
  }, [shouldLoadSpaces])

  const handleRoleChange = (nextRole) => {
    setRole(nextRole)
  }

  const handleStart = async () => {
    try {
      setSubmitLoading(true)
      await changeTenantMode({ mode: selectedMode })
      await saveGuideDisplayed()
      try {
        //window.JSSDK.toast.success('配置已完成')
      } catch (e) {}
      onComplete?.()
    } catch (e) {
      try {
        //window.JSSDK.toast.warning('开启失败，请重试')
      } catch (e) {}
    } finally {
      setSubmitLoading(false)
    }
  }

  return (
    <main className={`isv-guide-page ${isPopupPage ? 'isv-guide-upgrade-page' : isAdminPage ? 'isv-guide-admin-page' : 'isv-guide-user-page'}`} aria-label="ISV 初始化引导页">
      <div className="isv-guide-content-box"> <div className="isv-guide-bg" style={{ backgroundImage: '#eee' }} aria-hidden="true" /></div>
      <section className="isv-guide-content">
        {isPopupPage ? (
          <UpgradePage
            type={isRecommendPage ? 'recommend' : isAppAdminInstalledPage ? 'installed-with-spaces' : 'installed'}
            spaces={spaces}
            loading={loading}
            submitLoading={submitLoading}
            onStart={handleStart}
          />
        ) : (
          <>
            <HeroCard />
            {isAdminPage ? (
              <AdminGuideContent
                spaces={spaces}
                loading={loading}
                submitLoading={submitLoading}
                selectedMode={selectedMode}
                onRefresh={loadSpaces}
                onModeChange={setSelectedMode}
                onStart={handleStart}
              />
            ) : (
              <UserGuideContent />
            )}
          </>
        )}
      </section>
    </main>
  )
}
export default IsvGuidePage
