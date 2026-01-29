-- ============================================================================
-- Fix Phase 1-4 Column Names: snake_case to camelCase
-- Date: 2026-01-29
-- Description: Rename columns to match OMS model conventions
-- ============================================================================

-- WSConnection
ALTER TABLE "WSConnection" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "WSConnection" RENAME COLUMN user_id TO "userId";
ALTER TABLE "WSConnection" RENAME COLUMN connection_id TO "connectionId";
ALTER TABLE "WSConnection" RENAME COLUMN client_type TO "clientType";
ALTER TABLE "WSConnection" RENAME COLUMN client_version TO "clientVersion";
ALTER TABLE "WSConnection" RENAME COLUMN user_agent TO "userAgent";
ALTER TABLE "WSConnection" RENAME COLUMN ip_address TO "ipAddress";
ALTER TABLE "WSConnection" RENAME COLUMN connected_at TO "connectedAt";
ALTER TABLE "WSConnection" RENAME COLUMN disconnected_at TO "disconnectedAt";
ALTER TABLE "WSConnection" RENAME COLUMN last_ping_at TO "lastPingAt";
ALTER TABLE "WSConnection" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "WSConnection" RENAME COLUMN updated_at TO "updatedAt";

-- WSSubscription
ALTER TABLE "WSSubscription" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "WSSubscription" RENAME COLUMN connection_id TO "connectionId";
ALTER TABLE "WSSubscription" RENAME COLUMN entity_type TO "entityType";
ALTER TABLE "WSSubscription" RENAME COLUMN entity_id TO "entityId";
ALTER TABLE "WSSubscription" RENAME COLUMN is_active TO "isActive";
ALTER TABLE "WSSubscription" RENAME COLUMN subscribed_at TO "subscribedAt";
ALTER TABLE "WSSubscription" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "WSSubscription" RENAME COLUMN updated_at TO "updatedAt";

-- WSEvent
ALTER TABLE "WSEvent" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "WSEvent" RENAME COLUMN event_type TO "eventType";
ALTER TABLE "WSEvent" RENAME COLUMN entity_type TO "entityType";
ALTER TABLE "WSEvent" RENAME COLUMN entity_id TO "entityId";
ALTER TABLE "WSEvent" RENAME COLUMN broadcasted_at TO "broadcastedAt";
ALTER TABLE "WSEvent" RENAME COLUMN recipient_count TO "recipientCount";
ALTER TABLE "WSEvent" RENAME COLUMN delivered_count TO "deliveredCount";
ALTER TABLE "WSEvent" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "WSEvent" RENAME COLUMN updated_at TO "updatedAt";

-- MobileDevice
ALTER TABLE "MobileDevice" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "MobileDevice" RENAME COLUMN device_id TO "deviceId";
ALTER TABLE "MobileDevice" RENAME COLUMN device_name TO "deviceName";
ALTER TABLE "MobileDevice" RENAME COLUMN device_type TO "deviceType";
ALTER TABLE "MobileDevice" RENAME COLUMN os_version TO "osVersion";
ALTER TABLE "MobileDevice" RENAME COLUMN app_version TO "appVersion";
ALTER TABLE "MobileDevice" RENAME COLUMN location_id TO "assignedLocationId";
ALTER TABLE "MobileDevice" RENAME COLUMN assigned_user_id TO "assignedUserId";
ALTER TABLE "MobileDevice" RENAME COLUMN last_seen_at TO "lastActiveAt";
ALTER TABLE "MobileDevice" RENAME COLUMN registered_at TO "registeredAt";
ALTER TABLE "MobileDevice" RENAME COLUMN registered_by_id TO "registeredById";
ALTER TABLE "MobileDevice" RENAME COLUMN auth_token TO "authToken";
ALTER TABLE "MobileDevice" RENAME COLUMN token_expires_at TO "tokenExpiresAt";
ALTER TABLE "MobileDevice" RENAME COLUMN push_token TO "pushToken";
ALTER TABLE "MobileDevice" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "MobileDevice" RENAME COLUMN updated_at TO "updatedAt";

-- MobileConfig
ALTER TABLE "MobileConfig" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "MobileConfig" RENAME COLUMN device_id TO "deviceId";
ALTER TABLE "MobileConfig" RENAME COLUMN config_key TO "configKey";
ALTER TABLE "MobileConfig" RENAME COLUMN config_value TO "configValue";
ALTER TABLE "MobileConfig" RENAME COLUMN is_synced TO "isSynced";
ALTER TABLE "MobileConfig" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "MobileConfig" RENAME COLUMN updated_at TO "updatedAt";

-- DeviceLocationLog
ALTER TABLE "DeviceLocationLog" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "DeviceLocationLog" RENAME COLUMN device_id TO "deviceId";
ALTER TABLE "DeviceLocationLog" RENAME COLUMN user_id TO "userId";
ALTER TABLE "DeviceLocationLog" RENAME COLUMN location_type TO "locationType";
ALTER TABLE "DeviceLocationLog" RENAME COLUMN zone_id TO "zoneId";
ALTER TABLE "DeviceLocationLog" RENAME COLUMN bin_id TO "binId";
ALTER TABLE "DeviceLocationLog" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "DeviceLocationLog" RENAME COLUMN updated_at TO "updatedAt";

-- BarcodeScanLog
ALTER TABLE "BarcodeScanLog" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "BarcodeScanLog" RENAME COLUMN device_id TO "deviceId";
ALTER TABLE "BarcodeScanLog" RENAME COLUMN user_id TO "userId";
ALTER TABLE "BarcodeScanLog" RENAME COLUMN scan_type TO "scanType";
ALTER TABLE "BarcodeScanLog" RENAME COLUMN resolved_entity_type TO "resolvedEntityType";
ALTER TABLE "BarcodeScanLog" RENAME COLUMN resolved_entity_id TO "resolvedEntityId";
ALTER TABLE "BarcodeScanLog" RENAME COLUMN is_successful TO "isSuccessful";
ALTER TABLE "BarcodeScanLog" RENAME COLUMN scanned_at TO "scannedAt";
ALTER TABLE "BarcodeScanLog" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "BarcodeScanLog" RENAME COLUMN updated_at TO "updatedAt";

-- MobileSession
ALTER TABLE "MobileSession" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "MobileSession" RENAME COLUMN device_id TO "deviceId";
ALTER TABLE "MobileSession" RENAME COLUMN user_id TO "userId";
ALTER TABLE "MobileSession" RENAME COLUMN session_token TO "sessionToken";
ALTER TABLE "MobileSession" RENAME COLUMN started_at TO "startedAt";
ALTER TABLE "MobileSession" RENAME COLUMN ended_at TO "endedAt";
ALTER TABLE "MobileSession" RENAME COLUMN last_activity_at TO "lastActivityAt";
ALTER TABLE "MobileSession" RENAME COLUMN ip_address TO "ipAddress";
ALTER TABLE "MobileSession" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "MobileSession" RENAME COLUMN updated_at TO "updatedAt";

-- MobileTask
ALTER TABLE "MobileTask" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "MobileTask" RENAME COLUMN session_id TO "sessionId";
ALTER TABLE "MobileTask" RENAME COLUMN task_type TO "taskType";
ALTER TABLE "MobileTask" RENAME COLUMN reference_type TO "referenceType";
ALTER TABLE "MobileTask" RENAME COLUMN reference_id TO "referenceId";
ALTER TABLE "MobileTask" RENAME COLUMN location_id TO "locationId";
ALTER TABLE "MobileTask" RENAME COLUMN zone_id TO "zoneId";
ALTER TABLE "MobileTask" RENAME COLUMN assigned_to_id TO "assignedToId";
ALTER TABLE "MobileTask" RENAME COLUMN started_at TO "startedAt";
ALTER TABLE "MobileTask" RENAME COLUMN completed_at TO "completedAt";
ALTER TABLE "MobileTask" RENAME COLUMN created_by_id TO "createdById";
ALTER TABLE "MobileTask" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "MobileTask" RENAME COLUMN updated_at TO "updatedAt";

-- MobileTaskLine
ALTER TABLE "MobileTaskLine" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "MobileTaskLine" RENAME COLUMN task_id TO "taskId";
ALTER TABLE "MobileTaskLine" RENAME COLUMN sku_id TO "skuId";
ALTER TABLE "MobileTaskLine" RENAME COLUMN bin_id TO "binId";
ALTER TABLE "MobileTaskLine" RENAME COLUMN expected_qty TO "expectedQty";
ALTER TABLE "MobileTaskLine" RENAME COLUMN actual_qty TO "actualQty";
ALTER TABLE "MobileTaskLine" RENAME COLUMN batch_no TO "batchNo";
ALTER TABLE "MobileTaskLine" RENAME COLUMN lot_no TO "lotNo";
ALTER TABLE "MobileTaskLine" RENAME COLUMN expiry_date TO "expiryDate";
ALTER TABLE "MobileTaskLine" RENAME COLUMN scanned_at TO "scannedAt";
ALTER TABLE "MobileTaskLine" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "MobileTaskLine" RENAME COLUMN updated_at TO "updatedAt";

-- OfflineSyncQueue
ALTER TABLE "OfflineSyncQueue" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "OfflineSyncQueue" RENAME COLUMN device_id TO "deviceId";
ALTER TABLE "OfflineSyncQueue" RENAME COLUMN batch_id TO "batchId";
ALTER TABLE "OfflineSyncQueue" RENAME COLUMN operation_type TO "operationType";
ALTER TABLE "OfflineSyncQueue" RENAME COLUMN entity_type TO "entityType";
ALTER TABLE "OfflineSyncQueue" RENAME COLUMN entity_id TO "entityId";
ALTER TABLE "OfflineSyncQueue" RENAME COLUMN created_offline_at TO "createdOfflineAt";
ALTER TABLE "OfflineSyncQueue" RENAME COLUMN processed_at TO "processedAt";
ALTER TABLE "OfflineSyncQueue" RENAME COLUMN retry_count TO "retryCount";
ALTER TABLE "OfflineSyncQueue" RENAME COLUMN error_message TO "errorMessage";
ALTER TABLE "OfflineSyncQueue" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "OfflineSyncQueue" RENAME COLUMN updated_at TO "updatedAt";

-- SyncCheckpoint
ALTER TABLE "SyncCheckpoint" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "SyncCheckpoint" RENAME COLUMN device_id TO "deviceId";
ALTER TABLE "SyncCheckpoint" RENAME COLUMN user_id TO "userId";
ALTER TABLE "SyncCheckpoint" RENAME COLUMN entity_type TO "entityType";
ALTER TABLE "SyncCheckpoint" RENAME COLUMN last_sync_at TO "lastSyncAt";
ALTER TABLE "SyncCheckpoint" RENAME COLUMN sync_direction TO "syncDirection";
ALTER TABLE "SyncCheckpoint" RENAME COLUMN records_count TO "recordsCount";
ALTER TABLE "SyncCheckpoint" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "SyncCheckpoint" RENAME COLUMN updated_at TO "updatedAt";

-- SyncConflict
ALTER TABLE "SyncConflict" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "SyncConflict" RENAME COLUMN device_id TO "deviceId";
ALTER TABLE "SyncConflict" RENAME COLUMN entity_type TO "entityType";
ALTER TABLE "SyncConflict" RENAME COLUMN entity_id TO "entityId";
ALTER TABLE "SyncConflict" RENAME COLUMN server_value TO "serverValue";
ALTER TABLE "SyncConflict" RENAME COLUMN client_value TO "clientValue";
ALTER TABLE "SyncConflict" RENAME COLUMN is_resolved TO "isResolved";
ALTER TABLE "SyncConflict" RENAME COLUMN resolved_by_id TO "resolvedById";
ALTER TABLE "SyncConflict" RENAME COLUMN resolved_at TO "resolvedAt";
ALTER TABLE "SyncConflict" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "SyncConflict" RENAME COLUMN updated_at TO "updatedAt";

-- SyncBatch
ALTER TABLE "SyncBatch" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "SyncBatch" RENAME COLUMN device_id TO "deviceId";
ALTER TABLE "SyncBatch" RENAME COLUMN user_id TO "userId";
ALTER TABLE "SyncBatch" RENAME COLUMN total_operations TO "totalOperations";
ALTER TABLE "SyncBatch" RENAME COLUMN successful_operations TO "successfulOperations";
ALTER TABLE "SyncBatch" RENAME COLUMN failed_operations TO "failedOperations";
ALTER TABLE "SyncBatch" RENAME COLUMN started_at TO "startedAt";
ALTER TABLE "SyncBatch" RENAME COLUMN completed_at TO "completedAt";
ALTER TABLE "SyncBatch" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "SyncBatch" RENAME COLUMN updated_at TO "updatedAt";

-- LaborShift
ALTER TABLE "LaborShift" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "LaborShift" RENAME COLUMN location_id TO "locationId";
ALTER TABLE "LaborShift" RENAME COLUMN shift_name TO "shiftName";
ALTER TABLE "LaborShift" RENAME COLUMN shift_type TO "shiftType";
ALTER TABLE "LaborShift" RENAME COLUMN start_time TO "startTime";
ALTER TABLE "LaborShift" RENAME COLUMN end_time TO "endTime";
ALTER TABLE "LaborShift" RENAME COLUMN break_duration TO "breakDuration";
ALTER TABLE "LaborShift" RENAME COLUMN is_active TO "isActive";
ALTER TABLE "LaborShift" RENAME COLUMN max_workers TO "maxWorkers";
ALTER TABLE "LaborShift" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "LaborShift" RENAME COLUMN updated_at TO "updatedAt";

-- LaborShiftSchedule
ALTER TABLE "LaborShiftSchedule" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "LaborShiftSchedule" RENAME COLUMN shift_id TO "shiftId";
ALTER TABLE "LaborShiftSchedule" RENAME COLUMN user_id TO "userId";
ALTER TABLE "LaborShiftSchedule" RENAME COLUMN schedule_date TO "scheduleDate";
ALTER TABLE "LaborShiftSchedule" RENAME COLUMN actual_start_time TO "actualStartTime";
ALTER TABLE "LaborShiftSchedule" RENAME COLUMN actual_end_time TO "actualEndTime";
ALTER TABLE "LaborShiftSchedule" RENAME COLUMN total_work_minutes TO "totalWorkMinutes";
ALTER TABLE "LaborShiftSchedule" RENAME COLUMN total_break_minutes TO "totalBreakMinutes";
ALTER TABLE "LaborShiftSchedule" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "LaborShiftSchedule" RENAME COLUMN updated_at TO "updatedAt";

-- LaborAssignment
ALTER TABLE "LaborAssignment" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "LaborAssignment" RENAME COLUMN location_id TO "locationId";
ALTER TABLE "LaborAssignment" RENAME COLUMN user_id TO "userId";
ALTER TABLE "LaborAssignment" RENAME COLUMN shift_schedule_id TO "shiftScheduleId";
ALTER TABLE "LaborAssignment" RENAME COLUMN task_type TO "taskType";
ALTER TABLE "LaborAssignment" RENAME COLUMN assigned_at TO "assignedAt";
ALTER TABLE "LaborAssignment" RENAME COLUMN started_at TO "startedAt";
ALTER TABLE "LaborAssignment" RENAME COLUMN completed_at TO "completedAt";
ALTER TABLE "LaborAssignment" RENAME COLUMN target_quantity TO "targetQuantity";
ALTER TABLE "LaborAssignment" RENAME COLUMN actual_quantity TO "actualQuantity";
ALTER TABLE "LaborAssignment" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "LaborAssignment" RENAME COLUMN updated_at TO "updatedAt";

-- LaborTimeEntry
ALTER TABLE "LaborTimeEntry" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "LaborTimeEntry" RENAME COLUMN user_id TO "userId";
ALTER TABLE "LaborTimeEntry" RENAME COLUMN shift_schedule_id TO "shiftScheduleId";
ALTER TABLE "LaborTimeEntry" RENAME COLUMN entry_type TO "entryType";
ALTER TABLE "LaborTimeEntry" RENAME COLUMN device_id TO "deviceId";
ALTER TABLE "LaborTimeEntry" RENAME COLUMN is_manual TO "isManual";
ALTER TABLE "LaborTimeEntry" RENAME COLUMN approved_by_id TO "approvedById";
ALTER TABLE "LaborTimeEntry" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "LaborTimeEntry" RENAME COLUMN updated_at TO "updatedAt";

-- LaborProductivity
ALTER TABLE "LaborProductivity" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "LaborProductivity" RENAME COLUMN user_id TO "userId";
ALTER TABLE "LaborProductivity" RENAME COLUMN location_id TO "locationId";
ALTER TABLE "LaborProductivity" RENAME COLUMN record_date TO "recordDate";
ALTER TABLE "LaborProductivity" RENAME COLUMN task_type TO "taskType";
ALTER TABLE "LaborProductivity" RENAME COLUMN total_tasks TO "totalTasks";
ALTER TABLE "LaborProductivity" RENAME COLUMN completed_tasks TO "completedTasks";
ALTER TABLE "LaborProductivity" RENAME COLUMN total_units TO "totalUnits";
ALTER TABLE "LaborProductivity" RENAME COLUMN processed_units TO "processedUnits";
ALTER TABLE "LaborProductivity" RENAME COLUMN total_minutes TO "totalMinutes";
ALTER TABLE "LaborProductivity" RENAME COLUMN units_per_hour TO "unitsPerHour";
ALTER TABLE "LaborProductivity" RENAME COLUMN accuracy_rate TO "accuracyRate";
ALTER TABLE "LaborProductivity" RENAME COLUMN error_count TO "errorCount";
ALTER TABLE "LaborProductivity" RENAME COLUMN performance_score TO "performanceScore";
ALTER TABLE "LaborProductivity" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "LaborProductivity" RENAME COLUMN updated_at TO "updatedAt";

-- LaborStandard
ALTER TABLE "LaborStandard" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "LaborStandard" RENAME COLUMN location_id TO "locationId";
ALTER TABLE "LaborStandard" RENAME COLUMN task_type TO "taskType";
ALTER TABLE "LaborStandard" RENAME COLUMN standard_name TO "standardName";
ALTER TABLE "LaborStandard" RENAME COLUMN expected_units_per_hour TO "expectedUnitsPerHour";
ALTER TABLE "LaborStandard" RENAME COLUMN minimum_units_per_hour TO "minimumUnitsPerHour";
ALTER TABLE "LaborStandard" RENAME COLUMN target_units_per_hour TO "targetUnitsPerHour";
ALTER TABLE "LaborStandard" RENAME COLUMN unit_of_measure TO "unitOfMeasure";
ALTER TABLE "LaborStandard" RENAME COLUMN is_active TO "isActive";
ALTER TABLE "LaborStandard" RENAME COLUMN effective_from TO "effectiveFrom";
ALTER TABLE "LaborStandard" RENAME COLUMN effective_to TO "effectiveTo";
ALTER TABLE "LaborStandard" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "LaborStandard" RENAME COLUMN updated_at TO "updatedAt";

-- LaborIncentive
ALTER TABLE "LaborIncentive" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "LaborIncentive" RENAME COLUMN user_id TO "userId";
ALTER TABLE "LaborIncentive" RENAME COLUMN incentive_type TO "incentiveType";
ALTER TABLE "LaborIncentive" RENAME COLUMN period_start TO "periodStart";
ALTER TABLE "LaborIncentive" RENAME COLUMN period_end TO "periodEnd";
ALTER TABLE "LaborIncentive" RENAME COLUMN base_amount TO "baseAmount";
ALTER TABLE "LaborIncentive" RENAME COLUMN earned_amount TO "earnedAmount";
ALTER TABLE "LaborIncentive" RENAME COLUMN target_value TO "targetValue";
ALTER TABLE "LaborIncentive" RENAME COLUMN actual_value TO "actualValue";
ALTER TABLE "LaborIncentive" RENAME COLUMN achievement_percent TO "achievementPercent";
ALTER TABLE "LaborIncentive" RENAME COLUMN is_approved TO "isApproved";
ALTER TABLE "LaborIncentive" RENAME COLUMN approved_by_id TO "approvedById";
ALTER TABLE "LaborIncentive" RENAME COLUMN approved_at TO "approvedAt";
ALTER TABLE "LaborIncentive" RENAME COLUMN paid_at TO "paidAt";
ALTER TABLE "LaborIncentive" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "LaborIncentive" RENAME COLUMN updated_at TO "updatedAt";

-- LaborSkill
ALTER TABLE "LaborSkill" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "LaborSkill" RENAME COLUMN user_id TO "userId";
ALTER TABLE "LaborSkill" RENAME COLUMN skill_name TO "skillName";
ALTER TABLE "LaborSkill" RENAME COLUMN skill_category TO "skillCategory";
ALTER TABLE "LaborSkill" RENAME COLUMN certified_at TO "certifiedAt";
ALTER TABLE "LaborSkill" RENAME COLUMN certified_by_id TO "certifiedById";
ALTER TABLE "LaborSkill" RENAME COLUMN expires_at TO "expiresAt";
ALTER TABLE "LaborSkill" RENAME COLUMN is_active TO "isActive";
ALTER TABLE "LaborSkill" RENAME COLUMN training_hours TO "trainingHours";
ALTER TABLE "LaborSkill" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "LaborSkill" RENAME COLUMN updated_at TO "updatedAt";

-- SkuVelocity
ALTER TABLE "SkuVelocity" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "SkuVelocity" RENAME COLUMN sku_id TO "skuId";
ALTER TABLE "SkuVelocity" RENAME COLUMN location_id TO "locationId";
ALTER TABLE "SkuVelocity" RENAME COLUMN pick_frequency TO "pickFrequency";
ALTER TABLE "SkuVelocity" RENAME COLUMN avg_daily_picks TO "avgDailyPicks";
ALTER TABLE "SkuVelocity" RENAME COLUMN avg_weekly_picks TO "avgWeeklyPicks";
ALTER TABLE "SkuVelocity" RENAME COLUMN velocity_class TO "velocityClass";
ALTER TABLE "SkuVelocity" RENAME COLUMN calculated_at TO "calculatedAt";
ALTER TABLE "SkuVelocity" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "SkuVelocity" RENAME COLUMN updated_at TO "updatedAt";

-- BinCharacteristics
ALTER TABLE "BinCharacteristics" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "BinCharacteristics" RENAME COLUMN bin_id TO "binId";
ALTER TABLE "BinCharacteristics" RENAME COLUMN location_id TO "locationId";
ALTER TABLE "BinCharacteristics" RENAME COLUMN weight_capacity TO "weightCapacity";
ALTER TABLE "BinCharacteristics" RENAME COLUMN volume_capacity TO "volumeCapacity";
ALTER TABLE "BinCharacteristics" RENAME COLUMN pick_sequence TO "pickSequence";
ALTER TABLE "BinCharacteristics" RENAME COLUMN is_pick_face TO "isPickFace";
ALTER TABLE "BinCharacteristics" RENAME COLUMN is_reserve TO "isReserve";
ALTER TABLE "BinCharacteristics" RENAME COLUMN ergonomic_score TO "ergonomicScore";
ALTER TABLE "BinCharacteristics" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "BinCharacteristics" RENAME COLUMN updated_at TO "updatedAt";

-- SlottingRule
ALTER TABLE "SlottingRule" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "SlottingRule" RENAME COLUMN location_id TO "locationId";
ALTER TABLE "SlottingRule" RENAME COLUMN rule_name TO "ruleName";
ALTER TABLE "SlottingRule" RENAME COLUMN rule_type TO "ruleType";
ALTER TABLE "SlottingRule" RENAME COLUMN target_velocity TO "targetVelocity";
ALTER TABLE "SlottingRule" RENAME COLUMN target_zone TO "targetZone";
ALTER TABLE "SlottingRule" RENAME COLUMN is_active TO "isActive";
ALTER TABLE "SlottingRule" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "SlottingRule" RENAME COLUMN updated_at TO "updatedAt";

-- SlottingRecommendation
ALTER TABLE "SlottingRecommendation" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "SlottingRecommendation" RENAME COLUMN location_id TO "locationId";
ALTER TABLE "SlottingRecommendation" RENAME COLUMN sku_id TO "skuId";
ALTER TABLE "SlottingRecommendation" RENAME COLUMN current_bin_id TO "currentBinId";
ALTER TABLE "SlottingRecommendation" RENAME COLUMN recommended_bin_id TO "recommendedBinId";
ALTER TABLE "SlottingRecommendation" RENAME COLUMN recommendation_type TO "recommendationType";
ALTER TABLE "SlottingRecommendation" RENAME COLUMN expected_benefit TO "expectedBenefit";
ALTER TABLE "SlottingRecommendation" RENAME COLUMN applied_by_id TO "appliedById";
ALTER TABLE "SlottingRecommendation" RENAME COLUMN applied_at TO "appliedAt";
ALTER TABLE "SlottingRecommendation" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "SlottingRecommendation" RENAME COLUMN updated_at TO "updatedAt";

-- VoiceProfile
ALTER TABLE "VoiceProfile" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "VoiceProfile" RENAME COLUMN user_id TO "userId";
ALTER TABLE "VoiceProfile" RENAME COLUMN speech_rate TO "speechRate";
ALTER TABLE "VoiceProfile" RENAME COLUMN is_active TO "isActive";
ALTER TABLE "VoiceProfile" RENAME COLUMN last_used_at TO "lastUsedAt";
ALTER TABLE "VoiceProfile" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "VoiceProfile" RENAME COLUMN updated_at TO "updatedAt";

-- VoiceCommand
ALTER TABLE "VoiceCommand" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "VoiceCommand" RENAME COLUMN command_phrase TO "commandPhrase";
ALTER TABLE "VoiceCommand" RENAME COLUMN command_action TO "commandAction";
ALTER TABLE "VoiceCommand" RENAME COLUMN is_active TO "isActive";
ALTER TABLE "VoiceCommand" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "VoiceCommand" RENAME COLUMN updated_at TO "updatedAt";

-- VoiceSession
ALTER TABLE "VoiceSession" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "VoiceSession" RENAME COLUMN user_id TO "userId";
ALTER TABLE "VoiceSession" RENAME COLUMN device_id TO "deviceId";
ALTER TABLE "VoiceSession" RENAME COLUMN task_type TO "taskType";
ALTER TABLE "VoiceSession" RENAME COLUMN started_at TO "startedAt";
ALTER TABLE "VoiceSession" RENAME COLUMN ended_at TO "endedAt";
ALTER TABLE "VoiceSession" RENAME COLUMN total_interactions TO "totalInteractions";
ALTER TABLE "VoiceSession" RENAME COLUMN successful_picks TO "successfulPicks";
ALTER TABLE "VoiceSession" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "VoiceSession" RENAME COLUMN updated_at TO "updatedAt";

-- VoiceInteraction
ALTER TABLE "VoiceInteraction" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "VoiceInteraction" RENAME COLUMN session_id TO "sessionId";
ALTER TABLE "VoiceInteraction" RENAME COLUMN sequence_no TO "sequenceNo";
ALTER TABLE "VoiceInteraction" RENAME COLUMN command_type TO "commandType";
ALTER TABLE "VoiceInteraction" RENAME COLUMN input_text TO "inputText";
ALTER TABLE "VoiceInteraction" RENAME COLUMN response_text TO "responseText";
ALTER TABLE "VoiceInteraction" RENAME COLUMN is_successful TO "isSuccessful";
ALTER TABLE "VoiceInteraction" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "VoiceInteraction" RENAME COLUMN updated_at TO "updatedAt";

-- CrossDockRule
ALTER TABLE "CrossDockRule" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "CrossDockRule" RENAME COLUMN location_id TO "locationId";
ALTER TABLE "CrossDockRule" RENAME COLUMN rule_name TO "ruleName";
ALTER TABLE "CrossDockRule" RENAME COLUMN customer_id TO "customerId";
ALTER TABLE "CrossDockRule" RENAME COLUMN carrier_id TO "carrierId";
ALTER TABLE "CrossDockRule" RENAME COLUMN is_active TO "isActive";
ALTER TABLE "CrossDockRule" RENAME COLUMN created_by_id TO "createdById";
ALTER TABLE "CrossDockRule" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "CrossDockRule" RENAME COLUMN updated_at TO "updatedAt";

-- CrossDockOrder
ALTER TABLE "CrossDockOrder" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "CrossDockOrder" RENAME COLUMN order_id TO "orderId";
ALTER TABLE "CrossDockOrder" RENAME COLUMN location_id TO "locationId";
ALTER TABLE "CrossDockOrder" RENAME COLUMN inbound_shipment_id TO "inboundShipmentId";
ALTER TABLE "CrossDockOrder" RENAME COLUMN outbound_shipment_id TO "outboundShipmentId";
ALTER TABLE "CrossDockOrder" RENAME COLUMN rule_id TO "ruleId";
ALTER TABLE "CrossDockOrder" RENAME COLUMN expected_arrival TO "expectedArrival";
ALTER TABLE "CrossDockOrder" RENAME COLUMN expected_departure TO "expectedDeparture";
ALTER TABLE "CrossDockOrder" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "CrossDockOrder" RENAME COLUMN updated_at TO "updatedAt";

-- CrossDockAllocation
ALTER TABLE "CrossDockAllocation" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "CrossDockAllocation" RENAME COLUMN location_id TO "locationId";
ALTER TABLE "CrossDockAllocation" RENAME COLUMN cross_dock_order_id TO "crossDockOrderId";
ALTER TABLE "CrossDockAllocation" RENAME COLUMN sku_id TO "skuId";
ALTER TABLE "CrossDockAllocation" RENAME COLUMN inbound_line_id TO "inboundLineId";
ALTER TABLE "CrossDockAllocation" RENAME COLUMN outbound_line_id TO "outboundLineId";
ALTER TABLE "CrossDockAllocation" RENAME COLUMN allocated_qty TO "allocatedQty";
ALTER TABLE "CrossDockAllocation" RENAME COLUMN received_qty TO "receivedQty";
ALTER TABLE "CrossDockAllocation" RENAME COLUMN actual_quantity TO "actualQuantity";
ALTER TABLE "CrossDockAllocation" RENAME COLUMN staging_area_id TO "stagingAreaId";
ALTER TABLE "CrossDockAllocation" RENAME COLUMN allocated_by_id TO "allocatedById";
ALTER TABLE "CrossDockAllocation" RENAME COLUMN allocated_at TO "allocatedAt";
ALTER TABLE "CrossDockAllocation" RENAME COLUMN confirmed_by_id TO "confirmedById";
ALTER TABLE "CrossDockAllocation" RENAME COLUMN confirmed_at TO "confirmedAt";
ALTER TABLE "CrossDockAllocation" RENAME COLUMN completed_at TO "completedAt";
ALTER TABLE "CrossDockAllocation" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "CrossDockAllocation" RENAME COLUMN updated_at TO "updatedAt";

-- StagingArea
ALTER TABLE "StagingArea" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "StagingArea" RENAME COLUMN location_id TO "locationId";
ALTER TABLE "StagingArea" RENAME COLUMN area_code TO "areaCode";
ALTER TABLE "StagingArea" RENAME COLUMN area_type TO "areaType";
ALTER TABLE "StagingArea" RENAME COLUMN current_allocation_id TO "currentAllocationId";
ALTER TABLE "StagingArea" RENAME COLUMN is_active TO "isActive";
ALTER TABLE "StagingArea" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "StagingArea" RENAME COLUMN updated_at TO "updatedAt";

-- Preorder
ALTER TABLE "Preorder" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "Preorder" RENAME COLUMN preorder_no TO "preorderNo";
ALTER TABLE "Preorder" RENAME COLUMN customer_id TO "customerId";
ALTER TABLE "Preorder" RENAME COLUMN expected_date TO "expectedDate";
ALTER TABLE "Preorder" RENAME COLUMN confirmed_at TO "confirmedAt";
ALTER TABLE "Preorder" RENAME COLUMN converted_to_order_id TO "convertedToOrderId";
ALTER TABLE "Preorder" RENAME COLUMN converted_at TO "convertedAt";
ALTER TABLE "Preorder" RENAME COLUMN converted_by_id TO "convertedById";
ALTER TABLE "Preorder" RENAME COLUMN created_by_id TO "createdById";
ALTER TABLE "Preorder" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "Preorder" RENAME COLUMN updated_at TO "updatedAt";

-- PreorderLine
ALTER TABLE "PreorderLine" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "PreorderLine" RENAME COLUMN preorder_id TO "preorderId";
ALTER TABLE "PreorderLine" RENAME COLUMN sku_id TO "skuId";
ALTER TABLE "PreorderLine" RENAME COLUMN unit_price TO "unitPrice";
ALTER TABLE "PreorderLine" RENAME COLUMN total_price TO "totalPrice";
ALTER TABLE "PreorderLine" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "PreorderLine" RENAME COLUMN updated_at TO "updatedAt";

-- PreorderInventory
ALTER TABLE "PreorderInventory" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "PreorderInventory" RENAME COLUMN preorder_id TO "preorderId";
ALTER TABLE "PreorderInventory" RENAME COLUMN preorder_line_id TO "preorderLineId";
ALTER TABLE "PreorderInventory" RENAME COLUMN sku_id TO "skuId";
ALTER TABLE "PreorderInventory" RENAME COLUMN location_id TO "locationId";
ALTER TABLE "PreorderInventory" RENAME COLUMN reserved_quantity TO "reservedQuantity";
ALTER TABLE "PreorderInventory" RENAME COLUMN is_released TO "isReleased";
ALTER TABLE "PreorderInventory" RENAME COLUMN released_at TO "releasedAt";
ALTER TABLE "PreorderInventory" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "PreorderInventory" RENAME COLUMN updated_at TO "updatedAt";

-- Subscription
ALTER TABLE "Subscription" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "Subscription" RENAME COLUMN subscription_no TO "subscriptionNo";
ALTER TABLE "Subscription" RENAME COLUMN customer_id TO "customerId";
ALTER TABLE "Subscription" RENAME COLUMN start_date TO "startDate";
ALTER TABLE "Subscription" RENAME COLUMN end_date TO "endDate";
ALTER TABLE "Subscription" RENAME COLUMN next_delivery TO "nextDelivery";
ALTER TABLE "Subscription" RENAME COLUMN paused_at TO "pausedAt";
ALTER TABLE "Subscription" RENAME COLUMN resume_date TO "resumeDate";
ALTER TABLE "Subscription" RENAME COLUMN cancelled_at TO "cancelledAt";
ALTER TABLE "Subscription" RENAME COLUMN activated_at TO "activatedAt";
ALTER TABLE "Subscription" RENAME COLUMN created_by_id TO "createdById";
ALTER TABLE "Subscription" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "Subscription" RENAME COLUMN updated_at TO "updatedAt";

-- SubscriptionLine
ALTER TABLE "SubscriptionLine" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "SubscriptionLine" RENAME COLUMN subscription_id TO "subscriptionId";
ALTER TABLE "SubscriptionLine" RENAME COLUMN sku_id TO "skuId";
ALTER TABLE "SubscriptionLine" RENAME COLUMN unit_price TO "unitPrice";
ALTER TABLE "SubscriptionLine" RENAME COLUMN total_price TO "totalPrice";
ALTER TABLE "SubscriptionLine" RENAME COLUMN is_active TO "isActive";
ALTER TABLE "SubscriptionLine" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "SubscriptionLine" RENAME COLUMN updated_at TO "updatedAt";

-- SubscriptionSchedule
ALTER TABLE "SubscriptionSchedule" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "SubscriptionSchedule" RENAME COLUMN subscription_id TO "subscriptionId";
ALTER TABLE "SubscriptionSchedule" RENAME COLUMN scheduled_date TO "scheduledDate";
ALTER TABLE "SubscriptionSchedule" RENAME COLUMN generated_order_id TO "generatedOrderId";
ALTER TABLE "SubscriptionSchedule" RENAME COLUMN generated_at TO "generatedAt";
ALTER TABLE "SubscriptionSchedule" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "SubscriptionSchedule" RENAME COLUMN updated_at TO "updatedAt";

-- SubscriptionHistory
ALTER TABLE "SubscriptionHistory" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "SubscriptionHistory" RENAME COLUMN subscription_id TO "subscriptionId";
ALTER TABLE "SubscriptionHistory" RENAME COLUMN order_id TO "orderId";
ALTER TABLE "SubscriptionHistory" RENAME COLUMN performed_by_id TO "performedById";
ALTER TABLE "SubscriptionHistory" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "SubscriptionHistory" RENAME COLUMN updated_at TO "updatedAt";

-- PaymentSettlement
ALTER TABLE "PaymentSettlement" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "PaymentSettlement" RENAME COLUMN settlement_ref TO "settlementRef";
ALTER TABLE "PaymentSettlement" RENAME COLUMN settlement_date TO "settlementDate";
ALTER TABLE "PaymentSettlement" RENAME COLUMN total_amount TO "totalAmount";
ALTER TABLE "PaymentSettlement" RENAME COLUMN settled_amount TO "settledAmount";
ALTER TABLE "PaymentSettlement" RENAME COLUMN fee_amount TO "feeAmount";
ALTER TABLE "PaymentSettlement" RENAME COLUMN order_count TO "orderCount";
ALTER TABLE "PaymentSettlement" RENAME COLUMN matched_at TO "matchedAt";
ALTER TABLE "PaymentSettlement" RENAME COLUMN matched_by_id TO "matchedById";
ALTER TABLE "PaymentSettlement" RENAME COLUMN file_url TO "fileUrl";
ALTER TABLE "PaymentSettlement" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "PaymentSettlement" RENAME COLUMN updated_at TO "updatedAt";

-- Chargeback
ALTER TABLE "Chargeback" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "Chargeback" RENAME COLUMN chargeback_ref TO "chargebackRef";
ALTER TABLE "Chargeback" RENAME COLUMN order_id TO "orderId";
ALTER TABLE "Chargeback" RENAME COLUMN transaction_id TO "transactionId";
ALTER TABLE "Chargeback" RENAME COLUMN disputed_at TO "disputedAt";
ALTER TABLE "Chargeback" RENAME COLUMN disputed_by_id TO "disputedById";
ALTER TABLE "Chargeback" RENAME COLUMN resolved_at TO "resolvedAt";
ALTER TABLE "Chargeback" RENAME COLUMN resolution_amount TO "resolutionAmount";
ALTER TABLE "Chargeback" RENAME COLUMN due_date TO "dueDate";
ALTER TABLE "Chargeback" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "Chargeback" RENAME COLUMN updated_at TO "updatedAt";

-- EscrowHold
ALTER TABLE "EscrowHold" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "EscrowHold" RENAME COLUMN hold_ref TO "holdRef";
ALTER TABLE "EscrowHold" RENAME COLUMN order_id TO "orderId";
ALTER TABLE "EscrowHold" RENAME COLUMN held_at TO "heldAt";
ALTER TABLE "EscrowHold" RENAME COLUMN release_date TO "releaseDate";
ALTER TABLE "EscrowHold" RENAME COLUMN released_at TO "releasedAt";
ALTER TABLE "EscrowHold" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "EscrowHold" RENAME COLUMN updated_at TO "updatedAt";

-- ReconciliationDiscrepancy
ALTER TABLE "ReconciliationDiscrepancy" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "ReconciliationDiscrepancy" RENAME COLUMN settlement_id TO "settlementId";
ALTER TABLE "ReconciliationDiscrepancy" RENAME COLUMN order_id TO "orderId";
ALTER TABLE "ReconciliationDiscrepancy" RENAME COLUMN discrepancy_type TO "discrepancyType";
ALTER TABLE "ReconciliationDiscrepancy" RENAME COLUMN expected_amount TO "expectedAmount";
ALTER TABLE "ReconciliationDiscrepancy" RENAME COLUMN actual_amount TO "actualAmount";
ALTER TABLE "ReconciliationDiscrepancy" RENAME COLUMN difference_amount TO "differenceAmount";
ALTER TABLE "ReconciliationDiscrepancy" RENAME COLUMN is_resolved TO "isResolved";
ALTER TABLE "ReconciliationDiscrepancy" RENAME COLUMN resolved_by_id TO "resolvedById";
ALTER TABLE "ReconciliationDiscrepancy" RENAME COLUMN resolved_at TO "resolvedAt";
ALTER TABLE "ReconciliationDiscrepancy" RENAME COLUMN created_by_id TO "createdById";
ALTER TABLE "ReconciliationDiscrepancy" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "ReconciliationDiscrepancy" RENAME COLUMN updated_at TO "updatedAt";

-- MarketplaceConnection
ALTER TABLE "MarketplaceConnection" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "MarketplaceConnection" RENAME COLUMN connection_name TO "connectionName";
ALTER TABLE "MarketplaceConnection" RENAME COLUMN seller_id TO "sellerId";
ALTER TABLE "MarketplaceConnection" RENAME COLUMN seller_name TO "sellerName";
ALTER TABLE "MarketplaceConnection" RENAME COLUMN api_endpoint TO "apiEndpoint";
ALTER TABLE "MarketplaceConnection" RENAME COLUMN access_token TO "accessToken";
ALTER TABLE "MarketplaceConnection" RENAME COLUMN refresh_token TO "refreshToken";
ALTER TABLE "MarketplaceConnection" RENAME COLUMN token_expires_at TO "tokenExpiresAt";
ALTER TABLE "MarketplaceConnection" RENAME COLUMN last_sync_at TO "lastSyncAt";
ALTER TABLE "MarketplaceConnection" RENAME COLUMN sync_settings TO "syncSettings";
ALTER TABLE "MarketplaceConnection" RENAME COLUMN webhook_url TO "webhookUrl";
ALTER TABLE "MarketplaceConnection" RENAME COLUMN webhook_secret TO "webhookSecret";
ALTER TABLE "MarketplaceConnection" RENAME COLUMN is_active TO "isActive";
ALTER TABLE "MarketplaceConnection" RENAME COLUMN error_message TO "errorMessage";
ALTER TABLE "MarketplaceConnection" RENAME COLUMN error_at TO "errorAt";
ALTER TABLE "MarketplaceConnection" RENAME COLUMN disconnected_at TO "disconnectedAt";
ALTER TABLE "MarketplaceConnection" RENAME COLUMN created_by_id TO "createdById";
ALTER TABLE "MarketplaceConnection" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "MarketplaceConnection" RENAME COLUMN updated_at TO "updatedAt";

-- MarketplaceListing
ALTER TABLE "MarketplaceListing" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "MarketplaceListing" RENAME COLUMN connection_id TO "connectionId";
ALTER TABLE "MarketplaceListing" RENAME COLUMN sku_id TO "skuId";
ALTER TABLE "MarketplaceListing" RENAME COLUMN marketplace_sku TO "marketplaceSku";
ALTER TABLE "MarketplaceListing" RENAME COLUMN listing_url TO "listingUrl";
ALTER TABLE "MarketplaceListing" RENAME COLUMN published_at TO "publishedAt";
ALTER TABLE "MarketplaceListing" RENAME COLUMN last_synced_at TO "lastSyncedAt";
ALTER TABLE "MarketplaceListing" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "MarketplaceListing" RENAME COLUMN updated_at TO "updatedAt";

-- MarketplaceOrderSync
ALTER TABLE "MarketplaceOrderSync" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "MarketplaceOrderSync" RENAME COLUMN connection_id TO "connectionId";
ALTER TABLE "MarketplaceOrderSync" RENAME COLUMN sync_started_at TO "syncStartedAt";
ALTER TABLE "MarketplaceOrderSync" RENAME COLUMN sync_completed_at TO "syncCompletedAt";
ALTER TABLE "MarketplaceOrderSync" RENAME COLUMN sync_type TO "syncType";
ALTER TABLE "MarketplaceOrderSync" RENAME COLUMN orders_found TO "ordersFound";
ALTER TABLE "MarketplaceOrderSync" RENAME COLUMN orders_created TO "ordersCreated";
ALTER TABLE "MarketplaceOrderSync" RENAME COLUMN orders_updated TO "ordersUpdated";
ALTER TABLE "MarketplaceOrderSync" RENAME COLUMN orders_failed TO "ordersFailed";
ALTER TABLE "MarketplaceOrderSync" RENAME COLUMN error_message TO "errorMessage";
ALTER TABLE "MarketplaceOrderSync" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "MarketplaceOrderSync" RENAME COLUMN updated_at TO "updatedAt";

-- MarketplaceInventorySync
ALTER TABLE "MarketplaceInventorySync" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "MarketplaceInventorySync" RENAME COLUMN connection_id TO "connectionId";
ALTER TABLE "MarketplaceInventorySync" RENAME COLUMN sync_started_at TO "syncStartedAt";
ALTER TABLE "MarketplaceInventorySync" RENAME COLUMN sync_completed_at TO "syncCompletedAt";
ALTER TABLE "MarketplaceInventorySync" RENAME COLUMN skus_pushed TO "skusPushed";
ALTER TABLE "MarketplaceInventorySync" RENAME COLUMN success_count TO "successCount";
ALTER TABLE "MarketplaceInventorySync" RENAME COLUMN failure_count TO "failureCount";
ALTER TABLE "MarketplaceInventorySync" RENAME COLUMN error_message TO "errorMessage";
ALTER TABLE "MarketplaceInventorySync" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "MarketplaceInventorySync" RENAME COLUMN updated_at TO "updatedAt";

-- MarketplaceReturn
ALTER TABLE "MarketplaceReturn" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "MarketplaceReturn" RENAME COLUMN connection_id TO "connectionId";
ALTER TABLE "MarketplaceReturn" RENAME COLUMN marketplace_return_id TO "marketplaceReturnId";
ALTER TABLE "MarketplaceReturn" RENAME COLUMN order_id TO "orderId";
ALTER TABLE "MarketplaceReturn" RENAME COLUMN local_return_id TO "localReturnId";
ALTER TABLE "MarketplaceReturn" RENAME COLUMN return_reason TO "returnReason";
ALTER TABLE "MarketplaceReturn" RENAME COLUMN customer_comments TO "customerComments";
ALTER TABLE "MarketplaceReturn" RENAME COLUMN requested_at TO "requestedAt";
ALTER TABLE "MarketplaceReturn" RENAME COLUMN received_at TO "receivedAt";
ALTER TABLE "MarketplaceReturn" RENAME COLUMN processed_at TO "processedAt";
ALTER TABLE "MarketplaceReturn" RENAME COLUMN refund_amount TO "refundAmount";
ALTER TABLE "MarketplaceReturn" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "MarketplaceReturn" RENAME COLUMN updated_at TO "updatedAt";

-- MarketplaceSettlement
ALTER TABLE "MarketplaceSettlement" RENAME COLUMN company_id TO "companyId";
ALTER TABLE "MarketplaceSettlement" RENAME COLUMN connection_id TO "connectionId";
ALTER TABLE "MarketplaceSettlement" RENAME COLUMN settlement_id TO "settlementId";
ALTER TABLE "MarketplaceSettlement" RENAME COLUMN settlement_date TO "settlementDate";
ALTER TABLE "MarketplaceSettlement" RENAME COLUMN gross_amount TO "grossAmount";
ALTER TABLE "MarketplaceSettlement" RENAME COLUMN fee_amount TO "feeAmount";
ALTER TABLE "MarketplaceSettlement" RENAME COLUMN net_amount TO "netAmount";
ALTER TABLE "MarketplaceSettlement" RENAME COLUMN order_count TO "orderCount";
ALTER TABLE "MarketplaceSettlement" RENAME COLUMN return_count TO "returnCount";
ALTER TABLE "MarketplaceSettlement" RENAME COLUMN is_reconciled TO "isReconciled";
ALTER TABLE "MarketplaceSettlement" RENAME COLUMN reconciled_at TO "reconciledAt";
ALTER TABLE "MarketplaceSettlement" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "MarketplaceSettlement" RENAME COLUMN updated_at TO "updatedAt";

SELECT 'Column names fixed for all 51 Phase 1-4 tables' as status;
