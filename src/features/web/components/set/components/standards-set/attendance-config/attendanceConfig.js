export const ATTENDANCE_DATA_SOURCE = {
  ACTUAL: 'actual',
  SCHEDULED: 'scheduled',
};

export const MISSING_CARD_POLICY = {
  CUSTOM_LIMIT: 'custom_limit',
  BLOCK: 'block',
};

const DEFAULT_DAY_UP = 24;

const toBoolean = (value) => (
  value === true ||
  value === 1 ||
  (typeof value === 'string' && ['1', 'true'].includes(value.trim().toLowerCase()))
);

export const isIsvInstalled = (tenantModeInfo) => (
  Boolean(tenantModeInfo && toBoolean(tenantModeInfo.install))
);

const toNumber = (value, fallback) => {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : fallback;
};

const toMissingCardLimit = (value) => {
  const parsed = toNumber(value, null);
  return typeof parsed === 'number' && parsed > 0 ? parsed : null;
};

const isDataSource = (value) => (
  value === ATTENDANCE_DATA_SOURCE.ACTUAL || value === ATTENDANCE_DATA_SOURCE.SCHEDULED
);

const isMissingCardPolicy = (value) => (
  value === MISSING_CARD_POLICY.CUSTOM_LIMIT || value === MISSING_CARD_POLICY.BLOCK
);

const hasOwnProperty = (source, key) => Object.prototype.hasOwnProperty.call(source, key);

const getCompatibleValue = (source, apiField, legacyField) => (
  hasOwnProperty(source, apiField) ? source[apiField] : source[legacyField]
);

const normalizeDataSource = (value) => {
  const apiValue = toNumber(value, null);
  if (apiValue === 1) return ATTENDANCE_DATA_SOURCE.SCHEDULED;
  if (apiValue === 2) return ATTENDANCE_DATA_SOURCE.ACTUAL;
  return isDataSource(value) ? value : ATTENDANCE_DATA_SOURCE.SCHEDULED;
};

const normalizeMissingCardPolicy = (value) => {
  const apiValue = toNumber(value, null);
  if (apiValue === 1) return MISSING_CARD_POLICY.BLOCK;
  if (apiValue === 2) return MISSING_CARD_POLICY.CUSTOM_LIMIT;
  return isMissingCardPolicy(value) ? value : MISSING_CARD_POLICY.BLOCK;
};

export const normalizeAttendanceConfig = (raw) => {
  const source = raw && typeof raw === 'object' ? raw : {};
  const attendanceEnabled = toBoolean(getCompatibleValue(source, 'enable', 'attendanceEnabled'));
  const attendanceDataSource = normalizeDataSource(
    getCompatibleValue(source, 'upperLimitSource', 'attendanceDataSource'),
  );

  return {
    attendanceEnabled,
    attendanceDataSource: attendanceEnabled
      ? attendanceDataSource
      : (isDataSource(source.attendanceDataSource) ? source.attendanceDataSource : null),
    dayUp: toNumber(source.dayUp, DEFAULT_DAY_UP),
    missingCardPolicy: normalizeMissingCardPolicy(
      getCompatibleValue(source, 'missPunchPolicy', 'missingCardPolicy'),
    ),
    missingCardLimit: toMissingCardLimit(
      getCompatibleValue(source, 'missPunchCustomLimit', 'missingCardLimit'),
    ),
  };
};

export const buildAttendanceConfigPayload = (raw) => {
  const config = normalizeAttendanceConfig(raw);
  const enabled = config.attendanceEnabled;
  const hasCustomLimit = enabled && config.missingCardPolicy === MISSING_CARD_POLICY.CUSTOM_LIMIT;

  return {
    enable: enabled ? 1 : 0,
    upperLimitSource: enabled && config.attendanceDataSource === ATTENDANCE_DATA_SOURCE.ACTUAL ? 2 : 1,
    missPunchPolicy: hasCustomLimit ? 2 : 1,
    missPunchCustomLimit: hasCustomLimit ? config.missingCardLimit : null,
  };
};
