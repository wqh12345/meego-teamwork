import React, { useLayoutEffect, useRef, useState } from "react";
import { Tooltip } from "antd";
import "./CustomFieldCascaderOption.less";

const hasValue = (value) => {
  if (value === null || value === undefined) return false;
  return typeof value !== "string" || value.trim() !== "";
};

export const getCascaderOptionLabel = (option) => (
  option?.__cascader_fix_label__ !== undefined
    ? option.__cascader_fix_label__
    : option?.label
);

const CustomFieldCascaderOption = ({
  label,
  customFieldValue,
  isCustomFieldEnabled,
}) => {
  const valueRef = useRef(null);
  const [isOverflowed, setIsOverflowed] = useState(false);
  const showCustomField = isCustomFieldEnabled === true && hasValue(customFieldValue);
  const displayValue = showCustomField ? String(customFieldValue) : "";

  const updateOverflow = () => {
    const element = valueRef.current;
    setIsOverflowed(Boolean(element && element.scrollWidth > element.clientWidth));
  };

  useLayoutEffect(() => {
    if (!showCustomField) {
      setIsOverflowed(false);
      return undefined;
    }

    updateOverflow();
    const element = valueRef.current;
    if (!element || typeof ResizeObserver === "undefined") return undefined;

    const observer = new ResizeObserver(updateOverflow);
    observer.observe(element);
    return () => observer.disconnect();
  }, [displayValue, showCustomField]);

  if (!showCustomField) return label;

  return (
    <div className="custom-field-cascader-option">
      <div className="custom-field-cascader-option-name">{label}</div>
      <Tooltip title={isOverflowed ? displayValue : null}>
        <div
          ref={valueRef}
          className="custom-field-cascader-option-value"
          onMouseEnter={updateOverflow}
        >
          {displayValue}
        </div>
      </Tooltip>
    </div>
  );
};

export default CustomFieldCascaderOption;
