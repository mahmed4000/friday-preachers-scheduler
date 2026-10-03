export type ImportExportOperationType = 'IMPORT' | 'EXPORT';
export type ImportExportEntityType = 'MOSQUES' | 'IMAMS' | 'ALL';
export type ImportExportFormat = 'XLSX' | 'CSV';
export type ImportMode = 'UPSERT' | 'INSERT_ONLY' | 'UPDATE_ONLY';
export type ImportRowStatus = 'NEW' | 'UPDATE' | 'NEEDS_REVIEW' | 'ERROR' | 'SKIPPED';

export interface ColumnMappingItem {
  fileHeader: string;
  targetField: string;
  targetLabel: string;
  confidence: number; // 0..1
  isAutoMatched: boolean;
  isRequired: boolean;
}

export interface AdministrativeMatchResult {
  countryId: number;
  countryName: string;
  governorateId: number;
  governorateName: string;
  districtId?: number;
  districtName?: string;
  areaId?: number;
  areaName?: string;
  formattedAddress: string;
  isExactMatch: boolean;
  needsReview: boolean;
  reviewReason?: string;
  suggestedHierarchy?: {
    governorateName?: string;
    districtName?: string;
    areaName?: string;
  };
}

export interface ParsedImportRow {
  rowNumber: number;
  raw: Record<string, any>;
  status: ImportRowStatus;
  targetId?: number;
  matchedBy?: 'CODE' | 'ID' | 'NAME_ADDRESS' | 'NAME_PHONE' | 'PHONE';
  entityCode: string;
  displayName: string;
  data: Record<string, any>;
  diffSummary?: Array<{
    field: string;
    label: string;
    oldValue: any;
    newValue: any;
  }>;
  adminMatch?: AdministrativeMatchResult;
  errors: string[];
  warnings: string[];
  userReviewConfirmed?: boolean;
}

export interface ImportPreviewResult {
  batchId: string;
  entityType: ImportExportEntityType;
  fileName: string;
  fileFormat: ImportExportFormat;
  totalRows: number;
  newCount: number;
  updateCount: number;
  reviewCount: number;
  errorCount: number;
  columnMappings: ColumnMappingItem[];
  unmappedHeaders: string[];
  rows: ParsedImportRow[];
}

export interface ImportExecutePayload {
  batchId: string;
  entityType: ImportExportEntityType;
  fileName: string;
  fileFormat: ImportExportFormat;
  mode: ImportMode;
  rows: ParsedImportRow[];
}

export interface ImportExecuteResult {
  batchId: string;
  success: boolean;
  message: string;
  totalRows: number;
  createdRows: number;
  updatedRows: number;
  skippedRows: number;
  errorRows: number;
  errorReport?: Array<{
    rowNumber: number;
    code: string;
    name: string;
    field: string;
    rawValue: any;
    errorMessage: string;
  }>;
}

export interface ExportFilterOptions {
  entityType: ImportExportEntityType;
  format: ImportExportFormat;
  scope: 'ALL' | 'ACTIVE' | 'INACTIVE' | 'GOVERNORATE' | 'DISTRICT' | 'AREA' | 'SELECTED';
  governorateId?: number;
  districtId?: number;
  areaId?: number;
  selectedIds?: number[];
  includeStructuredIds?: boolean;
  includeRulesAndPreferences?: boolean;
  singleEntityId?: number;
}

export interface ImportExportLogItem {
  id: number;
  batchId: string;
  operationType: ImportExportOperationType;
  entityType: ImportExportEntityType;
  fileName: string;
  fileFormat: ImportExportFormat;
  userEmail?: string | null;
  mode: ImportMode;
  status: 'COMPLETED' | 'COMPLETED_WITH_WARNINGS' | 'FAILED' | 'IN_PROGRESS';
  totalRows: number;
  createdRows: number;
  updatedRows: number;
  skippedRows: number;
  errorRows: number;
  summaryJson?: string | null;
  errorReportJson?: string | null;
  startedAt: string;
  completedAt?: string | null;
}
