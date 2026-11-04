import React, { useEffect, useState } from "react";
import { Space, Divider, Checkbox } from "antd";
import { DragOutlined } from "@ant-design/icons";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const TableColumnsSet = (props) => {
  const [expandOptions, setExpandOptions] = useState(props.expandOptions);
  const [expandLevel, setExpandLevel] = useState(props.expandLevel);
  // useEffect(() => {
  //   props.setExpandOptions(expandOptions);
  //   console.log('expandOptions',expandOptions);
  // }, [expandOptions]);
  // useEffect(() => {
  //   props.setExpandOptions(expandOptions);
  // }, [expandOptions]);
  useEffect(() => {
    props.setExpandLevel(expandLevel);
  }, [expandLevel]);
  // // 设置传感器以支持鼠标和键盘拖拽
  // const sensors = useSensors(
  //   useSensor(PointerSensor),
  //   useSensor(KeyboardSensor, {
  //     coordinateGetter: sortableKeyboardCoordinates,
  //   })
  // );

  // // 处理拖拽结束事件
  // const handleDragEnd = ({ active, over }) => {
  //   if (active?.id && over?.id && active.id !== over.id) {
  //     setColumnsSet((prev) => {
  //       const oldIndex = prev.findIndex((item) => item.value === active.id);
  //       const newIndex = prev.findIndex((item) => item.value === over.id);
  //       // 创建新数组进行排序
  //       const newColumns = [...prev];
  //       newColumns.splice(newIndex, 0, newColumns.splice(oldIndex, 1)[0]);
  //       return newColumns;
  //     });
  //   } else {
  //     columnsSet.forEach((item) => {
  //       if (item.value === active.id) {
  //         if (!item.disable) handleCheckboxChange(active.id);
  //       }
  //     });
  //   }
  // };

  // const handleCheckboxChange = (value) => {
  //   const newColumns = columnsSet.map((item) =>
  //     item.value === value
  //       ? { ...item, checked: item?.disable ? item.checked : !item?.checked }
  //       : item
  //   );
  //   setColumnsSet(newColumns);
  // };

  // const SortableItem = ({ item, onCheckboxChange }) => {
  //   if (item.value === "workItemEntityName") {
  //     return (
  //       <div style={{ cursor: "no-drop" }}>
  //         <Checkbox disabled={item?.disable} checked={item?.checked} />
  //         <span style={{ marginLeft: 5 }}>{item.label}</span>
  //       </div>
  //     );
  //   }

  //   const { attributes, listeners, setNodeRef, transform, transition } =
  //     useSortable({
  //       id: item.value,
  //       disabled: item.value === "workItemEntityName",
  //       checked: item.checked,
  //     });

  //   const style = {
  //     transform: CSS.Transform.toString(transform),
  //     transition,
  //     display: "flex",
  //     alignItems: "center",
  //     justifyContent: "space-between",
  //     padding: "6px 0",
  //     cursor: "move",
  //   };

  //   return (
  //     <div
  //       ref={setNodeRef}
  //       style={{
  //         ...style,
  //         cursor: item.value === "workItemEntityName" ? "no-drop" : "move",
  //       }}
  //       {...attributes}
  //       {...listeners}
  //     >
  //       <div
  //         style={{
  //           display: "flex",
  //           alignItems: "center",
  //           position: "relative",
  //           zIndex: 10,
  //         }}
  //         onClick={(e) => {
  //           if (e.target.type !== "checkbox") {
  //             e.stopPropagation();
  //             if (!item.disable) onCheckboxChange(item.value, !item.checked);
  //           }
  //         }}
  //       >
  //         <Checkbox
  //           disabled={item?.disable}
  //           checked={item?.checked}
  //           onChange={(e) => {
  //             e.stopPropagation(); // 添加此行
  //             if (!item.disable) onCheckboxChange(item.value, e.target.checked);
  //           }}
  //         />
  //         <span style={{ marginLeft: 5 }}>{item.label}</span>
  //       </div>
  //       {item.value === "workItemEntityName" ? null : (
  //         <DragOutlined style={{ color: "#999" }} />
  //       )}
  //     </div>
  //   );
  // };
const handleExpandLevelSelect=(level)=>{
  setExpandLevel(level)
}
  return (
        <div style={{ width: 150 }}>
                    {/* 展开选项内容（同上） */}
                    <div
                      style={{ padding: "6px 12px", cursor: "pointer",backgroundColor: expandLevel==-1 ? "#e6f7ff" : "transparent"}}
                      onClick={() => handleExpandLevelSelect(-1)}
                    >
                      展开所有
                    </div>
                    <div style={{ color: "#999", fontSize: 12, padding: "4px 12px" }}>
                      展开至
                    </div>
                    {expandOptions.map(item => (
                      <div
                        key={item.level}
                        style={{
                          padding: "6px 12px",
                          cursor: "pointer",
                          backgroundColor: item.level ===expandLevel ? "#e6f7ff" : "transparent",
                        }}
                        onClick={() => handleExpandLevelSelect(item.level)}
                      >
                        {item.levelName}
                      </div>
                    ))}
        </div>
  );
};
export default TableColumnsSet;
