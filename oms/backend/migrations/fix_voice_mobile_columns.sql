-- Fix remaining snake_case columns in Voice and Mobile tables

-- VoiceProfile
ALTER TABLE "VoiceProfile" RENAME COLUMN confirmation_mode TO "confirmationMode";
ALTER TABLE "VoiceProfile" RENAME COLUMN repeat_count TO "repeatCount";
ALTER TABLE "VoiceProfile" RENAME COLUMN timeout_seconds TO "timeoutSeconds";
ALTER TABLE "VoiceProfile" RENAME COLUMN is_training_complete TO "isTrainingComplete";
ALTER TABLE "VoiceProfile" RENAME COLUMN training_completed_at TO "trainingCompletedAt";
ALTER TABLE "VoiceProfile" RENAME COLUMN voice_model_data TO "voiceModelData";
ALTER TABLE "VoiceProfile" RENAME COLUMN custom_vocabulary TO "customVocabulary";

-- VoiceCommand
ALTER TABLE "VoiceCommand" RENAME COLUMN command_phrase TO "commandPhrase";
ALTER TABLE "VoiceCommand" RENAME COLUMN command_action TO "commandAction";
ALTER TABLE "VoiceCommand" RENAME COLUMN alternate_phrases TO "alternatePhrases";
ALTER TABLE "VoiceCommand" RENAME COLUMN parameter_type TO "parameterType";
ALTER TABLE "VoiceCommand" RENAME COLUMN requires_confirmation TO "requiresConfirmation";
ALTER TABLE "VoiceCommand" RENAME COLUMN is_active TO "isActive";
ALTER TABLE "VoiceCommand" RENAME COLUMN display_order TO "displayOrder";

-- VoiceSession
ALTER TABLE "VoiceSession" RENAME COLUMN device_id TO "deviceId";
ALTER TABLE "VoiceSession" RENAME COLUMN task_type TO "taskType";
ALTER TABLE "VoiceSession" RENAME COLUMN task_reference_id TO "taskReferenceId";
ALTER TABLE "VoiceSession" RENAME COLUMN location_id TO "locationId";
ALTER TABLE "VoiceSession" RENAME COLUMN started_at TO "startedAt";
ALTER TABLE "VoiceSession" RENAME COLUMN ended_at TO "endedAt";
ALTER TABLE "VoiceSession" RENAME COLUMN total_interactions TO "totalInteractions";
ALTER TABLE "VoiceSession" RENAME COLUMN successful_interactions TO "successfulInteractions";
ALTER TABLE "VoiceSession" RENAME COLUMN error_count TO "errorCount";
ALTER TABLE "VoiceSession" RENAME COLUMN items_processed TO "itemsProcessed";
ALTER TABLE "VoiceSession" RENAME COLUMN session_data TO "sessionData";

-- VoiceInteraction
ALTER TABLE "VoiceInteraction" RENAME COLUMN session_id TO "sessionId";
ALTER TABLE "VoiceInteraction" RENAME COLUMN sequence_no TO "sequenceNo";
ALTER TABLE "VoiceInteraction" RENAME COLUMN command_type TO "commandType";
ALTER TABLE "VoiceInteraction" RENAME COLUMN raw_input TO "rawInput";
ALTER TABLE "VoiceInteraction" RENAME COLUMN recognized_text TO "recognizedText";
ALTER TABLE "VoiceInteraction" RENAME COLUMN confidence_score TO "confidenceScore";
ALTER TABLE "VoiceInteraction" RENAME COLUMN parsed_command TO "parsedCommand";
ALTER TABLE "VoiceInteraction" RENAME COLUMN parsed_value TO "parsedValue";
ALTER TABLE "VoiceInteraction" RENAME COLUMN response_text TO "responseText";
ALTER TABLE "VoiceInteraction" RENAME COLUMN response_played TO "responsePlayed";
ALTER TABLE "VoiceInteraction" RENAME COLUMN is_successful TO "isSuccessful";
ALTER TABLE "VoiceInteraction" RENAME COLUMN processing_time_ms TO "processingTimeMs";
ALTER TABLE "VoiceInteraction" RENAME COLUMN audio_duration_ms TO "audioDurationMs";
ALTER TABLE "VoiceInteraction" RENAME COLUMN error_code TO "errorCode";
ALTER TABLE "VoiceInteraction" RENAME COLUMN error_message TO "errorMessage";

-- MobileDevice
ALTER TABLE "MobileDevice" RENAME COLUMN device_name TO "deviceName";
ALTER TABLE "MobileDevice" RENAME COLUMN device_model TO "deviceModel";
ALTER TABLE "MobileDevice" RENAME COLUMN os_name TO "osName";
ALTER TABLE "MobileDevice" RENAME COLUMN os_version TO "osVersion";
ALTER TABLE "MobileDevice" RENAME COLUMN app_version TO "appVersion";
ALTER TABLE "MobileDevice" RENAME COLUMN screen_resolution TO "screenResolution";
ALTER TABLE "MobileDevice" RENAME COLUMN assigned_location_id TO "assignedLocationId";
ALTER TABLE "MobileDevice" RENAME COLUMN assigned_user_id TO "assignedUserId";
ALTER TABLE "MobileDevice" RENAME COLUMN is_active TO "isActive";
ALTER TABLE "MobileDevice" RENAME COLUMN last_seen_at TO "lastSeenAt";
ALTER TABLE "MobileDevice" RENAME COLUMN registered_at TO "registeredAt";
ALTER TABLE "MobileDevice" RENAME COLUMN push_token TO "pushToken";
ALTER TABLE "MobileDevice" RENAME COLUMN device_settings TO "deviceSettings";

-- MobileSession
ALTER TABLE "MobileSession" RENAME COLUMN session_token TO "sessionToken";
ALTER TABLE "MobileSession" RENAME COLUMN started_at TO "startedAt";
ALTER TABLE "MobileSession" RENAME COLUMN ended_at TO "endedAt";
ALTER TABLE "MobileSession" RENAME COLUMN last_activity_at TO "lastActivityAt";
ALTER TABLE "MobileSession" RENAME COLUMN current_zone TO "currentZone";
ALTER TABLE "MobileSession" RENAME COLUMN current_aisle TO "currentAisle";
ALTER TABLE "MobileSession" RENAME COLUMN tasks_completed TO "tasksCompleted";
ALTER TABLE "MobileSession" RENAME COLUMN items_processed TO "itemsProcessed";
ALTER TABLE "MobileSession" RENAME COLUMN session_data TO "sessionData";

-- MobileTask
ALTER TABLE "MobileTask" RENAME COLUMN task_no TO "taskNo";
ALTER TABLE "MobileTask" RENAME COLUMN task_type TO "taskType";
ALTER TABLE "MobileTask" RENAME COLUMN assigned_user_id TO "assignedUserId";
ALTER TABLE "MobileTask" RENAME COLUMN source_entity_type TO "sourceEntityType";
ALTER TABLE "MobileTask" RENAME COLUMN source_entity_id TO "sourceEntityId";
ALTER TABLE "MobileTask" RENAME COLUMN source_zone TO "sourceZone";
ALTER TABLE "MobileTask" RENAME COLUMN source_bin TO "sourceBin";
ALTER TABLE "MobileTask" RENAME COLUMN target_zone TO "targetZone";
ALTER TABLE "MobileTask" RENAME COLUMN target_bin TO "targetBin";
ALTER TABLE "MobileTask" RENAME COLUMN total_lines TO "totalLines";
ALTER TABLE "MobileTask" RENAME COLUMN completed_lines TO "completedLines";
ALTER TABLE "MobileTask" RENAME COLUMN total_quantity TO "totalQuantity";
ALTER TABLE "MobileTask" RENAME COLUMN completed_quantity TO "completedQuantity";
ALTER TABLE "MobileTask" RENAME COLUMN started_at TO "startedAt";
ALTER TABLE "MobileTask" RENAME COLUMN completed_at TO "completedAt";
ALTER TABLE "MobileTask" RENAME COLUMN estimated_duration TO "estimatedDuration";
ALTER TABLE "MobileTask" RENAME COLUMN actual_duration TO "actualDuration";
ALTER TABLE "MobileTask" RENAME COLUMN task_data TO "taskData";

-- MobileTaskLine
ALTER TABLE "MobileTaskLine" RENAME COLUMN task_id TO "taskId";
ALTER TABLE "MobileTaskLine" RENAME COLUMN line_no TO "lineNo";
ALTER TABLE "MobileTaskLine" RENAME COLUMN sku_code TO "skuCode";
ALTER TABLE "MobileTaskLine" RENAME COLUMN sku_name TO "skuName";
ALTER TABLE "MobileTaskLine" RENAME COLUMN target_quantity TO "targetQuantity";
ALTER TABLE "MobileTaskLine" RENAME COLUMN completed_quantity TO "completedQuantity";
ALTER TABLE "MobileTaskLine" RENAME COLUMN from_bin TO "fromBin";
ALTER TABLE "MobileTaskLine" RENAME COLUMN to_bin TO "toBin";
ALTER TABLE "MobileTaskLine" RENAME COLUMN lot_number TO "lotNumber";
ALTER TABLE "MobileTaskLine" RENAME COLUMN serial_number TO "serialNumber";
ALTER TABLE "MobileTaskLine" RENAME COLUMN expiry_date TO "expiryDate";
ALTER TABLE "MobileTaskLine" RENAME COLUMN is_completed TO "isCompleted";
ALTER TABLE "MobileTaskLine" RENAME COLUMN completed_at TO "completedAt";
ALTER TABLE "MobileTaskLine" RENAME COLUMN scanned_barcode TO "scannedBarcode";
ALTER TABLE "MobileTaskLine" RENAME COLUMN scan_count TO "scanCount";

SELECT 'Voice and Mobile column names fixed' as status;
