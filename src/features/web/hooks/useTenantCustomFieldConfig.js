import { useEffect, useState } from "react";
import { getFieldStatus } from "../../../api/api";

const EMPTY_CUSTOM_FIELD_CONFIG = {
  isEnabled: false,
  fieldName: "",
};

let customFieldConfigRequest = null;
let customFieldConfigCache = null;

const normalizeCustomFieldConfig = (res) => {
  const configData = res?.result && res?.data ? res.data : null;
  // return {
  //   isEnabled: true,
  //   fieldName: "所属项目",
  // };
  return {
    isEnabled: configData?.enabled === true,
    fieldName: typeof configData?.fieldName === "string" ? configData.fieldName : "",
  };
};

export const fetchTenantCustomFieldConfig = () => {
  if (customFieldConfigRequest) {
    return customFieldConfigRequest;
  }

  if (customFieldConfigCache) {
    return Promise.resolve(customFieldConfigCache);
  }

  if (!customFieldConfigRequest) {
    customFieldConfigRequest = Promise.resolve()
      .then(() => getFieldStatus())
      .then(normalizeCustomFieldConfig)
      .catch(() => ({ ...EMPTY_CUSTOM_FIELD_CONFIG }))
      .then((config) => {
        customFieldConfigCache = config;
        return config;
      })
      .finally(() => {
        customFieldConfigRequest = null;
      });
  }
  return customFieldConfigRequest;
};

export const refreshTenantCustomFieldConfig = () => {
  customFieldConfigCache = null;
  return fetchTenantCustomFieldConfig();
};

export const formatCustomFieldValue = (value) => {
  if (value === null || value === undefined) return "--";
  if (typeof value === "string" && value.trim() === "") return "--";
  return value;
};

export const useTenantCustomFieldConfig = () => {
  const [customFieldConfig, setCustomFieldConfig] = useState(EMPTY_CUSTOM_FIELD_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetchTenantCustomFieldConfig()
      .then((config) => {
        if (isMounted) setCustomFieldConfig(config);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return {
    ...customFieldConfig,
    loading,
    showCustomField:
      customFieldConfig.isEnabled && Boolean(customFieldConfig.fieldName),
  };
};
