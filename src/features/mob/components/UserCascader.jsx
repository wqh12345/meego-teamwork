import React, { useState, useEffect, useRef } from 'react';
import { Cascader } from 'antd-mobile';

// 模拟用户层级数据
const mockUserOptions = [
  {
    value: 'department1',
    label: '研发部',
    hasNext: true,
    children: [
      {
        value: 'team1',
        label: '前端团队',
        hasNext: true,
        children: [
          {
            value: '7454012189653893148',
            label: '八九',
            hasNext: false,
            children: []
          },
          {
            value: '7454012189653893149',
            label: '张三',
            hasNext: false,
            children: []
          }
        ]
      },
      {
        value: 'team2',
        label: '后端团队',
        hasNext: true,
        children: [
          {
            value: '7454012189653893150',
            label: '李四',
            hasNext: false,
            children: []
          },
          {
            value: '7454012189653893151',
            label: '王五',
            hasNext: false,
            children: []
          }
        ]
      }
    ]
  },
  {
    value: 'department2',
    label: '产品部',
    hasNext: true,
    children: [
      {
        value: 'team3',
        label: '产品设计',
        hasNext: true,
        children: [
          {
            value: '7454012189653893152',
            label: '赵六',
            hasNext: false,
            children: []
          }
        ]
      }
    ]
  }
];

const UserCascader = ({ visible, onClose, value, onConfirm }) => {
  const cascaderRef = useRef(null);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [currentSelectedValues, setCurrentSelectedValues] = useState([]);
  
  // 选项数据
  const [userOptions, setUserOptions] = useState([]);
  
  // 加载状态
  const [loading, setLoading] = useState(false);

  // 初始化数据
  const initUserOptions = async () => {
    setLoading(true);
    try {
      // 模拟API请求延迟
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 使用模拟数据
      setUserOptions(mockUserOptions);
      
      // 如果有初始值，设置当前选中值
      if (value && value.length > 0) {
        setCurrentSelectedValues(value);
      }
    } catch (error) {
      console.error('获取用户选项失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 组件初始化时加载数据
  useEffect(() => {
    if (visible) {
      initUserOptions();
    }
  }, [visible]);

  // 处理Cascader选择变化
  const handleChange = (values) => {
    console.log('Cascader选择变化:', values);
    setCurrentSelectedValues(values);
  };

  // 处理确认选择
  const handleConfirm = () => {
    if (currentSelectedValues.length === 0) {
      onClose();
      return;
    }

    // 获取选中的层级数据
    const getSelectedData = (options, values) => {
      if (values.length === 0) return null;
      
      const currentValue = values[0];
      const currentOption = options.find(opt => opt.value === currentValue);
      
      if (!currentOption) return null;
      
      if (values.length === 1) {
        return {
          value: currentOption.value,
          label: currentOption.label,
          path: [currentOption.label]
        };
      }
      
      const childResult = getSelectedData(currentOption.children, values.slice(1));
      if (childResult) {
        return {
          value: childResult.value,
          label: childResult.label,
          path: [currentOption.label, ...childResult.path]
        };
      }
      
      return null;
    };

    const selectedData = getSelectedData(userOptions, currentSelectedValues);
    if (selectedData) {
      onConfirm({
        userId: selectedData.value,
        userName: selectedData.label,
        userPath: selectedData.path.join(' / ')
      });
    }
    onClose();
  };

  return (
    <Cascader
      ref={cascaderRef}
      visible={visible}
      onClose={onClose}
      options={userOptions}
      value={currentSelectedValues}
      onChange={handleChange}
      onConfirm={handleConfirm}
      placeholder="请选择用户"
      loading={loading}
      title="选择用户"
      activeColor="#4247f6"
    />
  );
};

export default UserCascader;