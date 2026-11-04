import React, { useEffect } from 'react';
import { Table,Tooltip} from 'antd';
import taskIcon from "../../../../image/task.png";
import nodeIcon from "../../../../image/node.png";
import workItemEntityIcon from "../../../../image/workItemEntity.png";
import zhankai from "../../../../image/zhankai.png";
import Decimal from "decimal.js";
import { InfoCircleFilled } from '@ant-design/icons';
const columns = [
  {
    title: '登记对象',
    dataIndex: "workItemEntityName",
    key: "workItemEntityName",
    width: 180,
    ellipsis: true,
     render: (_, record) => {
          let name = "--";
          let icon = null;
          if (record?.workItemEntityName) {
            name = record?.workItemEntityName;
            icon = <img src={workItemEntityIcon} className="custom-levelIcon" />;
          } else if (record?.nodeName) {
            name = record?.nodeName;
            icon = <img src={nodeIcon} className="custom-levelIcon" />;
          } else if (record?.taskName) {
            name = record?.taskName;
            icon = <img src={taskIcon} className="custom-levelIcon" />;
          }
          // 将图标和名称组合
          name = icon ? <>{icon}{name}</> : name;
          return (
            <Tooltip placement="topLeft" title={<><div >{name}</div></>}>
              <div
                style={{
                  width: "170px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  wordBreak: "break-all",
                  verticalAlign: "middle",
                  cursor: "pointer",
                }}
              >
              {name}
              </div>
            </Tooltip>
          );
        },
  },
  {
    title: '登记工时',
    dataIndex: 'realActWorkHour',
    key: 'realActWorkHour',
    width: '80px',
  }
];

const RegisterWorkItemTable = ({ dataSource,registerDate}) => {
  const newDataSource = {...dataSource}
  // 如果dataSource是对象而不是数组，将其转换为数组格式
  const tableData = Array.isArray(newDataSource) ? newDataSource : newDataSource ? [newDataSource] : [];
    if(tableData?.length > 0){
      tableData?.forEach((item) => {
        item.realActWorkHour=item[registerDate]?.realActWorkHour || 0;
        item?.children?.forEach((node) => {
          node.realActWorkHour=node[registerDate]?.realActWorkHour || 0;
          if(node?.children?.length > 0){
            node?.children?.forEach((task) => {
              task.realActWorkHour=task[registerDate]?.realActWorkHour || 0;
            })
          }
        })
      })
    }
  let totalHours=0
  // 递归计算所有层级的realActWorkHour总和
  const calculateTotalHours = (data) => {
    if (!data || !Array.isArray(data)) return 0;
    return data.reduce((sum, item) => {
      // 使用Decimal.js进行精确的小数计算
      const currentHours = new Decimal(item.realActWorkHour || 0);
      
      // 递归计算子项的工时
      const childrenHours = item.children ? new Decimal(calculateTotalHours(item.children)) : new Decimal(0);
      
      // 累加并保留两位小数
      return sum.plus(currentHours).plus(childrenHours);
    }, new Decimal(0)).toNumber();
  };
  
  // 分别计算当前层级和下级层级的工时（使用Decimal.js确保精确计算）
  const calculateLevelHours = (data) => {
    if (!data || !Array.isArray(data)) {
      return { currentLevel: 0, subLevel: 0 };
    }
    
    // 使用Decimal.js初始化累加器
    let currentLevel = new Decimal(0);
    let subLevel = new Decimal(0);
    
    data.forEach(item => {
      // 当前层级工时 - 使用Decimal.js进行精确计算
      currentLevel = currentLevel.plus(new Decimal(item.realActWorkHour || 0));
      
      // 递归计算子层级工时
      if (item.children && Array.isArray(item.children)) {
        item.children.forEach(child => {
          // 使用Decimal.js累加子节点工时
          if (child.realActWorkHour) {
            subLevel = subLevel.plus(new Decimal(child.realActWorkHour));
          }
          
          // 计算孙子节点工时
          if (child.children && Array.isArray(child.children)) {
            child.children.forEach(grandchild => {
              // 使用Decimal.js累加孙子节点工时
              if (grandchild.realActWorkHour) {
                subLevel = subLevel.plus(new Decimal(grandchild.realActWorkHour));
              }
            });
          }
        });
      }
    });
    
    // 转换为数字并保留两位小数
    return { 
      currentLevel: Number(currentLevel.toFixed(2)), 
      subLevel: Number(subLevel.toFixed(2)) 
    };
  };
  
  // 获取工时分布信息
  const hoursInfo = calculateLevelHours(tableData);
  
  totalHours = calculateTotalHours(tableData);

  return (
    <div>
       <div style={{textAlign: 'left', fontSize: '14px',display:'flex',alignItems:'center'}}>
        <span style={{marginLeft:8}}>汇总工时：</span>{totalHours}小时 <Tooltip
                    className="user-tooltip"
                    placement="top"
                    title={
                      <>
                      包含下级层级 {hoursInfo.subLevel} 小时 + 当前层级 {hoursInfo.currentLevel} 小时
                      </>
                    }
                  >
                    <InfoCircleFilled className="icon" style={{color:'#bbbbbb',marginLeft:'3px'}}/>
                  </Tooltip>
      </div>
      {/* <Table
        key={tableData?.length > 0 ? tableData[0]?.id || 'table-content' : 'empty'}
        columns={columns}
        pagination={false}
        dataSource={tableData}
        rowKey={(record) => record.id || record.key || Math.random()}
        locale={{
          emptyText: '暂无数据'
        }}
      />
      <div style={{ marginTop: '10px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>
        汇总工时：{totalHours}小时
      </div> */}
    </div>
  );
};

export default React.memo(RegisterWorkItemTable);