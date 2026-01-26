/**
 * OMS API Client
 *
 * Main entry point for all API operations.
 * Import from '@/lib/api' in components.
 *
 * Usage:
 * ```typescript
 * import { api, setAuthToken } from '@/lib/api';
 *
 * // Login
 * const response = await api.auth.login({ requestBody: { email, password } });
 * setAuthToken(response.token);
 *
 * // Get orders
 * const orders = await api.orders.list({ skip: 0, limit: 50 });
 * ```
 */

// Re-export client configuration utilities
export { OpenAPI, configureApiClient, configureServerClient } from './client';

// Re-export error handling
export { ApiError, CancelablePromise, CancelError } from './generated';

// Re-export helper utilities for decimal/currency handling
export {
  parseDecimal,
  formatCurrency,
  formatNumber,
  calculatePercentage,
  sumDecimals,
  calculateOrderTotals,
} from './helpers';

// Re-export all generated types for use in components
export type {
  // Auth types
  LoginApiV1AuthLoginPostData,
  LoginApiV1AuthLoginPostResponse,
  UpdateMeApiV1AuthMePatchData,
  LoginRequest,
  UserLoginResponse,

  // User types
  UserResponse,
  UserCreate,
  UserUpdate,
  UserBrief,
  UserRole,

  // Company types
  CompanyResponse,
  CompanyCreate,
  CompanyUpdate,
  CompanyBrief,

  // Location types
  LocationResponse,
  LocationCreate,
  LocationUpdate,
  LocationBrief,
  LocationType,
  ZoneResponse,
  ZoneCreate,
  BinResponse,
  BinCreate,

  // SKU types (note: uppercase SKU)
  SKUResponse,
  SKUCreate,
  SKUUpdate,
  SKUBrief,

  // Inventory types
  InventoryResponse,
  InventoryCreate,
  InventoryUpdate,
  InventorySummary,
  InventoryAdjustment,
  InventoryTransfer,

  // Order types
  OrderResponse,
  OrderCreate,
  OrderUpdate,
  OrderBrief,
  OrderStatus,
  OrderItemResponse,
  OrderItemCreate,
  DeliveryResponse,
  DeliveryCreate,
  DeliveryStatus,

  // Customer types
  CustomerResponse,
  CustomerCreate,
  CustomerUpdate,
  CustomerBrief,
  CustomerGroupResponse,
  CustomerGroupCreate,

  // NDR types (note: uppercase NDR)
  NDRResponse,
  NDRCreate,
  NDRUpdate,
  NDRStatus,
  NDRReason,
  NDROutreachResponse,
  NDROutreachCreate,

  // Wave types
  WaveResponse,
  WaveCreate,
  WaveUpdate,
  WaveBrief,
  WaveStatus,
  WaveType,
  PicklistResponse,
  PicklistCreate,
  PicklistStatus,

  // Inbound types
  InboundResponse,
  InboundCreate,
  InboundUpdate,
  InboundBrief,
  InboundStatus,
  InboundType,

  // Return types
  ReturnResponse,
  ReturnCreate,
  ReturnUpdate,
  ReturnBrief,
  ReturnStatus,
  ReturnType,

  // QC types (note: uppercase QC)
  QCTemplateResponse,
  QCTemplateCreate,
  QCExecutionResponse,
  QCExecutionCreate,
  QCStatus,

  // Transporter types
  TransporterResponse,
  TransporterCreate,
  TransporterUpdate,
  TransporterBrief,
  TransporterType,
  ManifestResponse,
  ManifestCreate,
  ManifestUpdate,
  ManifestBrief,
  ManifestStatus,

  // Other enums
  PaymentMode,
  Channel,
  ResolutionType,
} from './generated';

// Import all service functions
import {
  // Auth
  loginApiV1AuthLoginPost,
  getMeApiV1AuthMeGet,
  updateMeApiV1AuthMePatch,
  refreshTokenApiV1AuthRefreshPost,
  logoutApiV1AuthLogoutPost,

  // Users
  listUsersApiV1UsersGet,
  createUserApiV1UsersPost,
  countUsersApiV1UsersCountGet,
  getUserApiV1UsersUserIdGet,
  updateUserApiV1UsersUserIdPatch,
  deleteUserApiV1UsersUserIdDelete,

  // Companies
  listCompaniesApiV1CompaniesGet,
  createCompanyApiV1CompaniesPost,
  countCompaniesApiV1CompaniesCountGet,
  getCompanyApiV1CompaniesCompanyIdGet,
  updateCompanyApiV1CompaniesCompanyIdPatch,
  deleteCompanyApiV1CompaniesCompanyIdDelete,

  // Locations
  listLocationsApiV1LocationsGet,
  createLocationApiV1LocationsPost,
  getLocationApiV1LocationsLocationIdGet,
  updateLocationApiV1LocationsLocationIdPatch,
  deleteLocationApiV1LocationsLocationIdDelete,
  listZonesApiV1LocationsLocationIdZonesGet,
  createZoneApiV1LocationsLocationIdZonesPost,
  updateZoneApiV1LocationsLocationIdZonesZoneIdPatch,
  listBinsApiV1LocationsLocationIdZonesZoneIdBinsGet,
  createBinApiV1LocationsLocationIdZonesZoneIdBinsPost,
  updateBinApiV1LocationsLocationIdZonesZoneIdBinsBinIdPatch,

  // SKUs
  listSkusApiV1SkusGet,
  createSkuApiV1SkusPost,
  countSkusApiV1SkusCountGet,
  listCategoriesApiV1SkusCategoriesGet,
  listBrandsApiV1SkusBrandsGet,
  getSkuApiV1SkusSkuIdGet,
  updateSkuApiV1SkusSkuIdPatch,
  deleteSkuApiV1SkusSkuIdDelete,
  getSkuByCodeApiV1SkusCodeCodeGet,

  // Inventory
  listInventoryApiV1InventoryGet,
  createInventoryApiV1InventoryPost,
  countInventoryApiV1InventoryCountGet,
  getInventorySummaryApiV1InventorySummaryGet,
  getInventoryApiV1InventoryInventoryIdGet,
  updateInventoryApiV1InventoryInventoryIdPatch,
  deleteInventoryApiV1InventoryInventoryIdDelete,
  adjustInventoryApiV1InventoryAdjustPost,
  transferInventoryApiV1InventoryTransferPost,

  // Orders
  listOrdersApiV1OrdersGet,
  createOrderApiV1OrdersPost,
  countOrdersApiV1OrdersCountGet,
  getOrderStatsApiV1OrdersStatsGet,
  getOrderApiV1OrdersOrderIdGet,
  updateOrderApiV1OrdersOrderIdPatch,
  getOrderByNumberApiV1OrdersNumberOrderNoGet,
  cancelOrderApiV1OrdersOrderIdCancelPost,
  listOrderItemsApiV1OrdersOrderIdItemsGet,
  createOrderItemApiV1OrdersOrderIdItemsPost,
  updateOrderItemApiV1OrdersOrderIdItemsItemIdPatch,
  deleteOrderItemApiV1OrdersOrderIdItemsItemIdDelete,
  listDeliveriesApiV1OrdersOrderIdDeliveriesGet,
  createDeliveryApiV1OrdersOrderIdDeliveriesPost,
  updateDeliveryApiV1OrdersOrderIdDeliveriesDeliveryIdPatch,
  getDeliveryByAwbApiV1OrdersDeliveriesByAwbAwbNoGet,

  // Customers
  listCustomersApiV1CustomersGet,
  createCustomerApiV1CustomersPost,
  countCustomersApiV1CustomersCountGet,
  getCreditSummaryApiV1CustomersCreditSummaryGet,
  getCustomerApiV1CustomersCustomerIdGet,
  updateCustomerApiV1CustomersCustomerIdPatch,
  deleteCustomerApiV1CustomersCustomerIdDelete,
  getCustomerByCodeApiV1CustomersCodeCodeGet,
  adjustCustomerCreditApiV1CustomersCustomerIdCreditAdjustmentPost,
  listCustomerGroupsApiV1CustomersGroupsGet,
  createCustomerGroupApiV1CustomersGroupsPost,
  getCustomerGroupApiV1CustomersGroupsGroupIdGet,
  updateCustomerGroupApiV1CustomersGroupsGroupIdPatch,
  deleteCustomerGroupApiV1CustomersGroupsGroupIdDelete,

  // NDR
  listNdrsApiV1NdrGet,
  createNdrApiV1NdrPost,
  countNdrsApiV1NdrCountGet,
  getNdrSummaryApiV1NdrSummaryGet,
  getNdrApiV1NdrNdrIdGet,
  updateNdrApiV1NdrNdrIdPatch,
  resolveNdrApiV1NdrNdrIdResolvePost,
  listOutreachesApiV1NdrNdrIdOutreachGet,
  createOutreachApiV1NdrNdrIdOutreachPost,
  updateOutreachApiV1NdrOutreachOutreachIdPatch,
  listAiActionsApiV1NdrNdrIdAiActionsGet,
  createAiActionApiV1NdrAiActionsPost,
  updateAiActionApiV1NdrAiActionsActionIdPatch,

  // Waves
  listWavesApiV1WavesGet,
  createWaveApiV1WavesPost,
  countWavesApiV1WavesCountGet,
  getWaveApiV1WavesWaveIdGet,
  updateWaveApiV1WavesWaveIdPatch,
  releaseWaveApiV1WavesWaveIdReleasePost,
  startWaveApiV1WavesWaveIdStartPost,
  completeWaveApiV1WavesWaveIdCompletePost,
  listWaveItemsApiV1WavesWaveIdItemsGet,
  addWaveItemApiV1WavesWaveIdItemsPost,
  updateWaveItemApiV1WavesItemsItemIdPatch,
  listWaveOrdersApiV1WavesWaveIdOrdersGet,
  addOrderToWaveApiV1WavesWaveIdOrdersPost,
  listPicklistsApiV1WavesPicklistsGet,
  createPicklistApiV1WavesPicklistsPost,
  getPicklistApiV1WavesPicklistsPicklistIdGet,
  updatePicklistApiV1WavesPicklistsPicklistIdPatch,
  listPicklistItemsApiV1WavesPicklistsPicklistIdItemsGet,
  addPicklistItemApiV1WavesPicklistsPicklistIdItemsPost,
  updatePicklistItemApiV1WavesPicklistsItemsItemIdPatch,

  // Inbound
  listInboundsApiV1InboundGet,
  createInboundApiV1InboundPost,
  countInboundsApiV1InboundCountGet,
  getInboundApiV1InboundInboundIdGet,
  updateInboundApiV1InboundInboundIdPatch,
  deleteInboundApiV1InboundInboundIdDelete,
  completeInboundApiV1InboundInboundIdCompletePost,
  listInboundItemsApiV1InboundInboundIdItemsGet,
  addInboundItemApiV1InboundInboundIdItemsPost,
  updateInboundItemApiV1InboundItemsItemIdPatch,
  deleteInboundItemApiV1InboundItemsItemIdDelete,

  // Returns
  listReturnsApiV1ReturnsGet,
  createReturnApiV1ReturnsPost,
  countReturnsApiV1ReturnsCountGet,
  getReturnSummaryApiV1ReturnsSummaryGet,
  getReturnApiV1ReturnsReturnIdGet,
  updateReturnApiV1ReturnsReturnIdPatch,
  receiveReturnApiV1ReturnsReturnIdReceivePost,
  updateQcStatusApiV1ReturnsReturnIdQcPost,
  processReturnApiV1ReturnsReturnIdProcessPost,
  listReturnItemsApiV1ReturnsReturnIdItemsGet,
  addReturnItemApiV1ReturnsReturnIdItemsPost,
  updateReturnItemApiV1ReturnsItemsItemIdPatch,

  // QC
  listTemplatesApiV1QcTemplatesGet,
  createTemplateApiV1QcTemplatesPost,
  getTemplateApiV1QcTemplatesTemplateIdGet,
  updateTemplateApiV1QcTemplatesTemplateIdPatch,
  deleteTemplateApiV1QcTemplatesTemplateIdDelete,
  listParametersApiV1QcTemplatesTemplateIdParametersGet,
  createParameterApiV1QcTemplatesTemplateIdParametersPost,
  updateParameterApiV1QcParametersParameterIdPatch,
  deleteParameterApiV1QcParametersParameterIdDelete,
  listExecutionsApiV1QcExecutionsGet,
  createExecutionApiV1QcExecutionsPost,
  getExecutionApiV1QcExecutionsExecutionIdGet,
  updateExecutionApiV1QcExecutionsExecutionIdPatch,
  completeExecutionApiV1QcExecutionsExecutionIdCompletePost,
  listResultsApiV1QcExecutionsExecutionIdResultsGet,
  addResultApiV1QcExecutionsExecutionIdResultsPost,
  updateResultApiV1QcResultsResultIdPatch,
  listDefectsApiV1QcExecutionsExecutionIdDefectsGet,
  addDefectApiV1QcExecutionsExecutionIdDefectsPost,
  updateDefectApiV1QcDefectsDefectIdPatch,

  // Transporters
  listTransportersApiV1TransportersGet,
  createTransporterApiV1TransportersPost,
  countTransportersApiV1TransportersCountGet,
  getTransporterApiV1TransportersTransporterIdGet,
  updateTransporterApiV1TransportersTransporterIdPatch,
  deleteTransporterApiV1TransportersTransporterIdDelete,
  getTransporterByCodeApiV1TransportersCodeCodeGet,
  listConfigsApiV1TransportersConfigsGet,
  createConfigApiV1TransportersConfigsPost,
  getConfigApiV1TransportersConfigsConfigIdGet,
  updateConfigApiV1TransportersConfigsConfigIdPatch,
  deleteConfigApiV1TransportersConfigsConfigIdDelete,
  listManifestsApiV1TransportersManifestsGet,
  createManifestApiV1TransportersManifestsPost,
  countManifestsApiV1TransportersManifestsCountGet,
  getManifestApiV1TransportersManifestsManifestIdGet,
  updateManifestApiV1TransportersManifestsManifestIdPatch,
  closeManifestApiV1TransportersManifestsManifestIdClosePost,
  handoverManifestApiV1TransportersManifestsManifestIdHandoverPost,

  // Dashboard (legacy endpoints)
  getDashboardApiDashboardGet,
  getAnalyticsApiDashboardAnalyticsGet,
} from './generated';

/**
 * Organized API namespace for cleaner imports
 */
export const api = {
  auth: {
    login: loginApiV1AuthLoginPost,
    me: getMeApiV1AuthMeGet,
    updateMe: updateMeApiV1AuthMePatch,
    refresh: refreshTokenApiV1AuthRefreshPost,
    logout: logoutApiV1AuthLogoutPost,
  },
  users: {
    list: listUsersApiV1UsersGet,
    create: createUserApiV1UsersPost,
    count: countUsersApiV1UsersCountGet,
    get: getUserApiV1UsersUserIdGet,
    update: updateUserApiV1UsersUserIdPatch,
    delete: deleteUserApiV1UsersUserIdDelete,
  },
  companies: {
    list: listCompaniesApiV1CompaniesGet,
    create: createCompanyApiV1CompaniesPost,
    count: countCompaniesApiV1CompaniesCountGet,
    get: getCompanyApiV1CompaniesCompanyIdGet,
    update: updateCompanyApiV1CompaniesCompanyIdPatch,
    delete: deleteCompanyApiV1CompaniesCompanyIdDelete,
  },
  locations: {
    list: listLocationsApiV1LocationsGet,
    create: createLocationApiV1LocationsPost,
    get: getLocationApiV1LocationsLocationIdGet,
    update: updateLocationApiV1LocationsLocationIdPatch,
    delete: deleteLocationApiV1LocationsLocationIdDelete,
    zones: {
      list: listZonesApiV1LocationsLocationIdZonesGet,
      create: createZoneApiV1LocationsLocationIdZonesPost,
      update: updateZoneApiV1LocationsLocationIdZonesZoneIdPatch,
    },
    bins: {
      list: listBinsApiV1LocationsLocationIdZonesZoneIdBinsGet,
      create: createBinApiV1LocationsLocationIdZonesZoneIdBinsPost,
      update: updateBinApiV1LocationsLocationIdZonesZoneIdBinsBinIdPatch,
    },
  },
  skus: {
    list: listSkusApiV1SkusGet,
    create: createSkuApiV1SkusPost,
    count: countSkusApiV1SkusCountGet,
    categories: listCategoriesApiV1SkusCategoriesGet,
    brands: listBrandsApiV1SkusBrandsGet,
    get: getSkuApiV1SkusSkuIdGet,
    update: updateSkuApiV1SkusSkuIdPatch,
    delete: deleteSkuApiV1SkusSkuIdDelete,
    getByCode: getSkuByCodeApiV1SkusCodeCodeGet,
  },
  inventory: {
    list: listInventoryApiV1InventoryGet,
    create: createInventoryApiV1InventoryPost,
    count: countInventoryApiV1InventoryCountGet,
    summary: getInventorySummaryApiV1InventorySummaryGet,
    get: getInventoryApiV1InventoryInventoryIdGet,
    update: updateInventoryApiV1InventoryInventoryIdPatch,
    delete: deleteInventoryApiV1InventoryInventoryIdDelete,
    adjust: adjustInventoryApiV1InventoryAdjustPost,
    transfer: transferInventoryApiV1InventoryTransferPost,
  },
  orders: {
    list: listOrdersApiV1OrdersGet,
    create: createOrderApiV1OrdersPost,
    count: countOrdersApiV1OrdersCountGet,
    stats: getOrderStatsApiV1OrdersStatsGet,
    get: getOrderApiV1OrdersOrderIdGet,
    update: updateOrderApiV1OrdersOrderIdPatch,
    getByNumber: getOrderByNumberApiV1OrdersNumberOrderNoGet,
    cancel: cancelOrderApiV1OrdersOrderIdCancelPost,
    items: {
      list: listOrderItemsApiV1OrdersOrderIdItemsGet,
      create: createOrderItemApiV1OrdersOrderIdItemsPost,
      update: updateOrderItemApiV1OrdersOrderIdItemsItemIdPatch,
      delete: deleteOrderItemApiV1OrdersOrderIdItemsItemIdDelete,
    },
    deliveries: {
      list: listDeliveriesApiV1OrdersOrderIdDeliveriesGet,
      create: createDeliveryApiV1OrdersOrderIdDeliveriesPost,
      update: updateDeliveryApiV1OrdersOrderIdDeliveriesDeliveryIdPatch,
      getByAwb: getDeliveryByAwbApiV1OrdersDeliveriesByAwbAwbNoGet,
    },
  },
  customers: {
    list: listCustomersApiV1CustomersGet,
    create: createCustomerApiV1CustomersPost,
    count: countCustomersApiV1CustomersCountGet,
    creditSummary: getCreditSummaryApiV1CustomersCreditSummaryGet,
    get: getCustomerApiV1CustomersCustomerIdGet,
    update: updateCustomerApiV1CustomersCustomerIdPatch,
    delete: deleteCustomerApiV1CustomersCustomerIdDelete,
    getByCode: getCustomerByCodeApiV1CustomersCodeCodeGet,
    adjustCredit: adjustCustomerCreditApiV1CustomersCustomerIdCreditAdjustmentPost,
    groups: {
      list: listCustomerGroupsApiV1CustomersGroupsGet,
      create: createCustomerGroupApiV1CustomersGroupsPost,
      get: getCustomerGroupApiV1CustomersGroupsGroupIdGet,
      update: updateCustomerGroupApiV1CustomersGroupsGroupIdPatch,
      delete: deleteCustomerGroupApiV1CustomersGroupsGroupIdDelete,
    },
  },
  ndr: {
    list: listNdrsApiV1NdrGet,
    create: createNdrApiV1NdrPost,
    count: countNdrsApiV1NdrCountGet,
    summary: getNdrSummaryApiV1NdrSummaryGet,
    get: getNdrApiV1NdrNdrIdGet,
    update: updateNdrApiV1NdrNdrIdPatch,
    resolve: resolveNdrApiV1NdrNdrIdResolvePost,
    outreach: {
      list: listOutreachesApiV1NdrNdrIdOutreachGet,
      create: createOutreachApiV1NdrNdrIdOutreachPost,
      update: updateOutreachApiV1NdrOutreachOutreachIdPatch,
    },
    aiActions: {
      list: listAiActionsApiV1NdrNdrIdAiActionsGet,
      create: createAiActionApiV1NdrAiActionsPost,
      update: updateAiActionApiV1NdrAiActionsActionIdPatch,
    },
  },
  waves: {
    list: listWavesApiV1WavesGet,
    create: createWaveApiV1WavesPost,
    count: countWavesApiV1WavesCountGet,
    get: getWaveApiV1WavesWaveIdGet,
    update: updateWaveApiV1WavesWaveIdPatch,
    release: releaseWaveApiV1WavesWaveIdReleasePost,
    start: startWaveApiV1WavesWaveIdStartPost,
    complete: completeWaveApiV1WavesWaveIdCompletePost,
    items: {
      list: listWaveItemsApiV1WavesWaveIdItemsGet,
      add: addWaveItemApiV1WavesWaveIdItemsPost,
      update: updateWaveItemApiV1WavesItemsItemIdPatch,
    },
    orders: {
      list: listWaveOrdersApiV1WavesWaveIdOrdersGet,
      add: addOrderToWaveApiV1WavesWaveIdOrdersPost,
    },
    picklists: {
      list: listPicklistsApiV1WavesPicklistsGet,
      create: createPicklistApiV1WavesPicklistsPost,
      get: getPicklistApiV1WavesPicklistsPicklistIdGet,
      update: updatePicklistApiV1WavesPicklistsPicklistIdPatch,
      items: {
        list: listPicklistItemsApiV1WavesPicklistsPicklistIdItemsGet,
        add: addPicklistItemApiV1WavesPicklistsPicklistIdItemsPost,
        update: updatePicklistItemApiV1WavesPicklistsItemsItemIdPatch,
      },
    },
  },
  inbound: {
    list: listInboundsApiV1InboundGet,
    create: createInboundApiV1InboundPost,
    count: countInboundsApiV1InboundCountGet,
    get: getInboundApiV1InboundInboundIdGet,
    update: updateInboundApiV1InboundInboundIdPatch,
    delete: deleteInboundApiV1InboundInboundIdDelete,
    complete: completeInboundApiV1InboundInboundIdCompletePost,
    items: {
      list: listInboundItemsApiV1InboundInboundIdItemsGet,
      add: addInboundItemApiV1InboundInboundIdItemsPost,
      update: updateInboundItemApiV1InboundItemsItemIdPatch,
      delete: deleteInboundItemApiV1InboundItemsItemIdDelete,
    },
  },
  returns: {
    list: listReturnsApiV1ReturnsGet,
    create: createReturnApiV1ReturnsPost,
    count: countReturnsApiV1ReturnsCountGet,
    summary: getReturnSummaryApiV1ReturnsSummaryGet,
    get: getReturnApiV1ReturnsReturnIdGet,
    update: updateReturnApiV1ReturnsReturnIdPatch,
    receive: receiveReturnApiV1ReturnsReturnIdReceivePost,
    qc: updateQcStatusApiV1ReturnsReturnIdQcPost,
    process: processReturnApiV1ReturnsReturnIdProcessPost,
    items: {
      list: listReturnItemsApiV1ReturnsReturnIdItemsGet,
      add: addReturnItemApiV1ReturnsReturnIdItemsPost,
      update: updateReturnItemApiV1ReturnsItemsItemIdPatch,
    },
  },
  qc: {
    templates: {
      list: listTemplatesApiV1QcTemplatesGet,
      create: createTemplateApiV1QcTemplatesPost,
      get: getTemplateApiV1QcTemplatesTemplateIdGet,
      update: updateTemplateApiV1QcTemplatesTemplateIdPatch,
      delete: deleteTemplateApiV1QcTemplatesTemplateIdDelete,
    },
    parameters: {
      list: listParametersApiV1QcTemplatesTemplateIdParametersGet,
      create: createParameterApiV1QcTemplatesTemplateIdParametersPost,
      update: updateParameterApiV1QcParametersParameterIdPatch,
      delete: deleteParameterApiV1QcParametersParameterIdDelete,
    },
    executions: {
      list: listExecutionsApiV1QcExecutionsGet,
      create: createExecutionApiV1QcExecutionsPost,
      get: getExecutionApiV1QcExecutionsExecutionIdGet,
      update: updateExecutionApiV1QcExecutionsExecutionIdPatch,
      complete: completeExecutionApiV1QcExecutionsExecutionIdCompletePost,
    },
    results: {
      list: listResultsApiV1QcExecutionsExecutionIdResultsGet,
      add: addResultApiV1QcExecutionsExecutionIdResultsPost,
      update: updateResultApiV1QcResultsResultIdPatch,
    },
    defects: {
      list: listDefectsApiV1QcExecutionsExecutionIdDefectsGet,
      add: addDefectApiV1QcExecutionsExecutionIdDefectsPost,
      update: updateDefectApiV1QcDefectsDefectIdPatch,
    },
  },
  transporters: {
    list: listTransportersApiV1TransportersGet,
    create: createTransporterApiV1TransportersPost,
    count: countTransportersApiV1TransportersCountGet,
    get: getTransporterApiV1TransportersTransporterIdGet,
    update: updateTransporterApiV1TransportersTransporterIdPatch,
    delete: deleteTransporterApiV1TransportersTransporterIdDelete,
    getByCode: getTransporterByCodeApiV1TransportersCodeCodeGet,
    configs: {
      list: listConfigsApiV1TransportersConfigsGet,
      create: createConfigApiV1TransportersConfigsPost,
      get: getConfigApiV1TransportersConfigsConfigIdGet,
      update: updateConfigApiV1TransportersConfigsConfigIdPatch,
      delete: deleteConfigApiV1TransportersConfigsConfigIdDelete,
    },
    manifests: {
      list: listManifestsApiV1TransportersManifestsGet,
      create: createManifestApiV1TransportersManifestsPost,
      count: countManifestsApiV1TransportersManifestsCountGet,
      get: getManifestApiV1TransportersManifestsManifestIdGet,
      update: updateManifestApiV1TransportersManifestsManifestIdPatch,
      close: closeManifestApiV1TransportersManifestsManifestIdClosePost,
      handover: handoverManifestApiV1TransportersManifestsManifestIdHandoverPost,
    },
  },
  dashboard: {
    get: getDashboardApiDashboardGet,
    analytics: getAnalyticsApiDashboardAnalyticsGet,
  },
};

export default api;
