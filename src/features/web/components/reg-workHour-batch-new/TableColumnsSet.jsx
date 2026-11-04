import React, { useEffect, useRef, useState } from "react";
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

const FIXED_COLUMN_VALUES = new Set(["workItemEntityName", "regDate"]);

const TableColumnsSet = (props) => {
  const [columnsSet, setColumnsSet] = useState(props.columnsSet);
  const shouldNotifyChangeRef = useRef(false);

  useEffect(() => {
    if (!shouldNotifyChangeRef.current) return;

    shouldNotifyChangeRef.current = false;
    props.setColumnsSet(columnsSet);
  }, [columnsSet]);

  // 设置传感器以支持鼠标和键盘拖拽
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 处理拖拽结束事件
  const handleDragEnd = ({ active, over }) => {
    if (
      FIXED_COLUMN_VALUES.has(active?.id) ||
      FIXED_COLUMN_VALUES.has(over?.id)
    ) {
      return;
    }

    if (active?.id && over?.id && active.id !== over.id) {
      shouldNotifyChangeRef.current = true;
      setColumnsSet((prev) => {
        const oldIndex = prev.findIndex((item) => item.value === active.id);
        const newIndex = prev.findIndex((item) => item.value === over.id);
        // 创建新数组进行排序
        const newColumns = [...prev];
        newColumns.splice(newIndex, 0, newColumns.splice(oldIndex, 1)[0]);
        return newColumns;
      });
    } else {
      columnsSet.forEach((item) => {
        if (item.value === active?.id) {
          if (!item.disable) handleCheckboxChange(active.id);
        }
      });
    }
  };

  const handleCheckboxChange = (value) => {
    const newColumns = columnsSet.map((item) =>
      item.value === value
        ? { ...item, checked: item?.disable ? item.checked : !item?.checked }
        : item
    );
    shouldNotifyChangeRef.current = true;
    setColumnsSet(newColumns);
  };

  const SortableItem = ({ item, onCheckboxChange }) => {
    if (FIXED_COLUMN_VALUES.has(item.value)) {
      return (
        <div style={{ cursor: "no-drop" }}>
          <Checkbox disabled={item?.disable} checked={item?.checked} />
          <span style={{ marginLeft: 5 }}>{item.label}</span>
        </div>
      );
    }

    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({
        id: item.value,
        disabled: FIXED_COLUMN_VALUES.has(item.value),
        checked: item.checked,
      });

    const style = {
      transform: CSS.Translate.toString(transform),
      transition,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "6px 0",
      cursor: "move",
    };

    return (
      <div
        ref={setNodeRef}
        style={{
          ...style,
          cursor: FIXED_COLUMN_VALUES.has(item.value) ? "no-drop" : "move",
        }}
        {...attributes}
        {...listeners}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            position: "relative",
            zIndex: 10,
          }}
          onClick={(e) => {
            if (e.target.type !== "checkbox") {
              e.stopPropagation();
              if (!item.disable) onCheckboxChange(item.value, !item.checked);
            }
          }}
        >
          <Checkbox
            disabled={item?.disable}
            checked={item?.checked}
            onChange={(e) => {
              e.stopPropagation(); // 添加此行
              if (!item.disable) onCheckboxChange(item.value, e.target.checked);
            }}
          />
          <span style={{ marginLeft: 5 }}>{item.label}</span>
        </div>
        {FIXED_COLUMN_VALUES.has(item.value) ? null : (
          <DragOutlined style={{ color: "#999" }} />
        )}
      </div>
    );
  };

  return (
    <Space direction="vertical" style={{ width: 150 }}>
      <div style={{ fontWeight: "bold" }}>字段配置</div>
      <Divider style={{ margin: "0" }} />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={columnsSet
            .filter((item) => !FIXED_COLUMN_VALUES.has(item.value))
            .map((item) => item.value)}
        >
          {columnsSet.map((item, index) => (
            <SortableItem
              key={item.value}
              item={item}
              index={index}
              onCheckboxChange={handleCheckboxChange}
            />
          ))}
        </SortableContext>
      </DndContext>
    </Space>
  );
};
export default TableColumnsSet;
