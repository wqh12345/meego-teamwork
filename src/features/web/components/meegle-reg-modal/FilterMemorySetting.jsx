import React, { useState } from "react";
import { Button, Modal, Switch, Tooltip } from "antd";
import { SettingOutlined } from "@ant-design/icons";
import {
  getBatchMemorySetting,
  postBatchMemorySetting,
} from "../../../../api/api";

const DEFAULT_CONFIG_TYPE = "BATCH_REGISTER_FILTER_MEMORY";

const FilterMemorySetting = ({
  configType = DEFAULT_CONFIG_TYPE,
  memoryConfig,
  memoryEnabled,
  onConfigLoaded,
  onSaved,
  registrantUserKey,
}) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftMemoryEnabled, setDraftMemoryEnabled] = useState(memoryEnabled);

  const handleOpen = () => {
    setDraftMemoryEnabled(memoryEnabled);
    setOpen(true);
  };

  const refreshMemoryConfig = async () => {
    try {
      const res = await getBatchMemorySetting({
        type: configType,
      });
      const config = res?.result && res?.data ? res.data : null;
      onConfigLoaded?.(config);
      return config;
    } catch (_) {
      return null;
    }
  };

  const handleClose = () => {
    if (!saving) setOpen(false);
  };

  const handleSave = async () => {
    if (saving) return;

    setSaving(true);
    try {
      const data = {
        type: configType,
        value: draftMemoryEnabled ? 1 : 0,
      };
      if (memoryConfig?.id != null) {
        data.id = memoryConfig.id;
      }

      const res = await postBatchMemorySetting(data);
      if (res?.result) {
        const latestConfig = await refreshMemoryConfig();
        onSaved(draftMemoryEnabled);
        onConfigLoaded?.(
          latestConfig || {
            ...memoryConfig,
            type: configType,
            value: data.value,
          }
        );
        setOpen(false);
      } else {
        window.JSSDK.toast.error("保存筛选记忆设置失败，请稍后重试");
      }
    } catch (_) {
      window.JSSDK.toast.error("保存筛选记忆设置失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Tooltip title="筛选记忆设置">
        <Button
          aria-label="筛选记忆设置"
          className="filter-memory-setting-trigger"
          icon={<SettingOutlined />}
          onClick={handleOpen}
          size="small"
          type="text"
        />
      </Tooltip>
      <Modal
        closable={!saving}
        footer={[
          <Button disabled={saving} key="cancel" onClick={handleClose}>
            取消
          </Button>,
          <Button key="save" loading={saving} onClick={handleSave} type="primary">
            保存
          </Button>,
        ]}
        maskClosable={!saving}
        onCancel={handleClose}
        open={open}
        title="筛选记忆设置"
        width={600}
      >
        <div className="filter-memory-setting-content">
          <div className="filter-memory-setting-row">
            <span>记忆上次筛选</span>
            <Switch
              aria-label="记忆上次筛选"
              checked={draftMemoryEnabled}
              disabled={saving}
              onChange={setDraftMemoryEnabled}
            />
          </div>
          <p className="filter-memory-setting-description">
            开启后，每次提交工时时将记录当前的筛选条件，下次打开批量登记时自动按上一次提交时的筛选项反显并查询
          </p>
        </div>
      </Modal>
    </>
  );
};

export default FilterMemorySetting;
