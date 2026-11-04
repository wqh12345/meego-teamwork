import React from 'react'
import { Button, Radio, Spin } from 'antd'
import {
  AppstoreOutlined,
  BarsOutlined,
  CheckCircleFilled,
  ReloadOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import guideBg from '../../assets/isv-guide/isv-init-admin/组 73124@2x.png'
import './index.less'

const fallbackSpaces = [
  '研发效能空间',
  '产品设计空间',
  '前端开发空间',
  '后端服务空间',
  '某某空间',
]

const modeOptions = [
  {
    key: 'space',
    title: '空间模式',
    icon: <AppstoreOutlined />,
    lines: ['各飞书项目空间独立管理，数据隔离', '适合团队成员在同一空间内登记工时'],
  },
  {
    key: 'tenant',
    title: '租户模式',
    badge: '推荐',
    icon: <TeamOutlined />,
    lines: ['跨飞书项目空间统一管理', '适合成员需要在多个空间登记工时的场景'],
  },
]

const HeroCard = () => (
  <div className="isv-card isv-hero-card">
    <div className="isv-hero-title">
      <h1>欢迎使用工时资源管理</h1>
      <span>当前飞书应用为限时体验版</span>
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

const AdminGuideContent = ({
  spaces,
  loading,
  submitLoading,
  selectedMode,
  onRefresh,
  onModeChange,
  onStart,
}) => {
  return (
    <>
      <div className="isv-card isv-project-card">
        <div className="isv-step-title"><span>1</span><h2>项目设置</h2></div>
        <p className="isv-step-desc">工时数据需从飞书项目（Meegle）中获取。在使用ISV工时应用前，您需要先在飞书项目中安装工时插件，完成数据同步配置。</p>

        <div className="isv-space-panel">
          <div className="isv-space-panel-header">
            <div>已安装工时插件的空间（{spaces.length}个）</div>
            <button type="button" onClick={onRefresh} disabled={loading} aria-label="刷新已安装空间列表">
              <ReloadOutlined spin={loading} /> 刷新
            </button>
          </div>
          {loading ? (
            <div className="isv-space-loading"><Spin size="small" tip="刷新中" /></div>
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
          <p>请在飞书项目中安装工时插件，具体操作请参考工时资源管理安装手册，如需帮助，请联系我们</p>
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
        <Button type="primary" loading={submitLoading} onClick={onStart} disabled={!selectedMode}>
          <CheckCircleFilled /> 开始使用
        </Button>
      </div>
    </>
  )
}

const SimpleTestPage = () => {
  const [spaces, setSpaces] = React.useState(fallbackSpaces)
  const [loading, setLoading] = React.useState(false)
  const [submitLoading, setSubmitLoading] = React.useState(false)
  const [selectedMode, setSelectedMode] = React.useState('tenant')

  const handleRefresh = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
    }, 1000)
  }

  const handleStart = () => {
    setSubmitLoading(true)
    setTimeout(() => {
      setSubmitLoading(false)
      alert('配置已完成！')
    }, 1000)
  }

  return (
    <main className="isv-guide-page isv-guide-admin-page" aria-label="ISV 初始化引导页 - 简化版测试">
      <div className="isv-guide-bg" style={{ backgroundImage: `url(${guideBg})` }} aria-hidden="true" />
      
      <section className="isv-guide-content">
        <HeroCard />
        <AdminGuideContent
          spaces={spaces}
          loading={loading}
          submitLoading={submitLoading}
          selectedMode={selectedMode}
          onRefresh={handleRefresh}
          onModeChange={setSelectedMode}
          onStart={handleStart}
        />
      </section>
    </main>
  )
}

export default SimpleTestPage
