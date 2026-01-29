-- Fix remaining snake_case columns in Phase 1-4 tables
-- Some columns were created with correct camelCase, others need renaming

-- SlottingRecommendation
ALTER TABLE "SlottingRecommendation" RENAME COLUMN suggested_bin_id TO "suggestedBinId";
ALTER TABLE "SlottingRecommendation" RENAME COLUMN current_zone TO "currentZone";
ALTER TABLE "SlottingRecommendation" RENAME COLUMN suggested_zone TO "suggestedZone";
ALTER TABLE "SlottingRecommendation" RENAME COLUMN priority_score TO "priorityScore";
ALTER TABLE "SlottingRecommendation" RENAME COLUMN estimated_pick_reduction TO "estimatedPickReduction";
ALTER TABLE "SlottingRecommendation" RENAME COLUMN estimated_travel_reduction TO "estimatedTravelReduction";
ALTER TABLE "SlottingRecommendation" RENAME COLUMN rule_id TO "ruleId";
ALTER TABLE "SlottingRecommendation" RENAME COLUMN generated_at TO "generatedAt";
ALTER TABLE "SlottingRecommendation" RENAME COLUMN expires_at TO "expiresAt";
ALTER TABLE "SlottingRecommendation" RENAME COLUMN approved_by_id TO "approvedById";
ALTER TABLE "SlottingRecommendation" RENAME COLUMN approved_at TO "approvedAt";
ALTER TABLE "SlottingRecommendation" RENAME COLUMN completed_at TO "completedAt";

-- Subscription
ALTER TABLE "Subscription" RENAME COLUMN customer_name TO "customerName";
ALTER TABLE "Subscription" RENAME COLUMN customer_email TO "customerEmail";
ALTER TABLE "Subscription" RENAME COLUMN customer_phone TO "customerPhone";
ALTER TABLE "Subscription" RENAME COLUMN custom_interval_days TO "customIntervalDays";
ALTER TABLE "Subscription" RENAME COLUMN location_id TO "locationId";
ALTER TABLE "Subscription" RENAME COLUMN shipping_address_id TO "shippingAddressId";
ALTER TABLE "Subscription" RENAME COLUMN billing_address_id TO "billingAddressId";
ALTER TABLE "Subscription" RENAME COLUMN next_delivery_date TO "nextDeliveryDate";
ALTER TABLE "Subscription" RENAME COLUMN last_delivery_date TO "lastDeliveryDate";
ALTER TABLE "Subscription" RENAME COLUMN total_deliveries TO "totalDeliveries";
ALTER TABLE "Subscription" RENAME COLUMN completed_deliveries TO "completedDeliveries";
ALTER TABLE "Subscription" RENAME COLUMN max_deliveries TO "maxDeliveries";
ALTER TABLE "Subscription" RENAME COLUMN tax_amount TO "taxAmount";
ALTER TABLE "Subscription" RENAME COLUMN discount_amount TO "discountAmount";
ALTER TABLE "Subscription" RENAME COLUMN shipping_amount TO "shippingAmount";
ALTER TABLE "Subscription" RENAME COLUMN total_amount TO "totalAmount";
ALTER TABLE "Subscription" RENAME COLUMN payment_method TO "paymentMethod";
ALTER TABLE "Subscription" RENAME COLUMN payment_token_id TO "paymentTokenId";
ALTER TABLE "Subscription" RENAME COLUMN auto_renew TO "autoRenew";
ALTER TABLE "Subscription" RENAME COLUMN reminder_days TO "reminderDays";
ALTER TABLE "Subscription" RENAME COLUMN paused_until TO "pausedUntil";
ALTER TABLE "Subscription" RENAME COLUMN cancellation_reason TO "cancellationReason";
ALTER TABLE "Subscription" RENAME COLUMN metadata TO "extraData";

-- SubscriptionLine
ALTER TABLE "SubscriptionLine" RENAME COLUMN line_no TO "lineNo";
ALTER TABLE "SubscriptionLine" RENAME COLUMN sku_code TO "skuCode";
ALTER TABLE "SubscriptionLine" RENAME COLUMN sku_name TO "skuName";
ALTER TABLE "SubscriptionLine" RENAME COLUMN tax_rate TO "taxRate";
ALTER TABLE "SubscriptionLine" RENAME COLUMN tax_amount TO "taxAmount";
ALTER TABLE "SubscriptionLine" RENAME COLUMN discount_amount TO "discountAmount";
ALTER TABLE "SubscriptionLine" RENAME COLUMN line_total TO "lineTotal";
ALTER TABLE "SubscriptionLine" RENAME COLUMN is_active TO "isActive";
ALTER TABLE "SubscriptionLine" RENAME COLUMN start_date TO "startDate";
ALTER TABLE "SubscriptionLine" RENAME COLUMN end_date TO "endDate";

-- SubscriptionSchedule
ALTER TABLE "SubscriptionSchedule" RENAME COLUMN sequence_no TO "sequenceNo";
ALTER TABLE "SubscriptionSchedule" RENAME COLUMN scheduled_date TO "scheduledDate";
ALTER TABLE "SubscriptionSchedule" RENAME COLUMN order_id TO "orderId";
ALTER TABLE "SubscriptionSchedule" RENAME COLUMN order_no TO "orderNo";
ALTER TABLE "SubscriptionSchedule" RENAME COLUMN generated_at TO "generatedAt";
ALTER TABLE "SubscriptionSchedule" RENAME COLUMN processed_at TO "processedAt";
ALTER TABLE "SubscriptionSchedule" RENAME COLUMN error_message TO "errorMessage";
ALTER TABLE "SubscriptionSchedule" RENAME COLUMN skip_reason TO "skipReason";

-- SubscriptionHistory
ALTER TABLE "SubscriptionHistory" RENAME COLUMN action_type TO "actionType";
ALTER TABLE "SubscriptionHistory" RENAME COLUMN action_date TO "actionDate";
ALTER TABLE "SubscriptionHistory" RENAME COLUMN user_id TO "userId";
ALTER TABLE "SubscriptionHistory" RENAME COLUMN previous_status TO "previousStatus";
ALTER TABLE "SubscriptionHistory" RENAME COLUMN new_status TO "newStatus";

-- Preorder
ALTER TABLE "Preorder" RENAME COLUMN customer_name TO "customerName";
ALTER TABLE "Preorder" RENAME COLUMN customer_email TO "customerEmail";
ALTER TABLE "Preorder" RENAME COLUMN customer_phone TO "customerPhone";
ALTER TABLE "Preorder" RENAME COLUMN external_order_id TO "externalOrderId";
ALTER TABLE "Preorder" RENAME COLUMN location_id TO "locationId";
ALTER TABLE "Preorder" RENAME COLUMN expected_available_date TO "expectedAvailableDate";
ALTER TABLE "Preorder" RENAME COLUMN expiry_date TO "expiryDate";
ALTER TABLE "Preorder" RENAME COLUMN total_items TO "totalItems";
ALTER TABLE "Preorder" RENAME COLUMN tax_amount TO "taxAmount";
ALTER TABLE "Preorder" RENAME COLUMN discount_amount TO "discountAmount";
ALTER TABLE "Preorder" RENAME COLUMN total_amount TO "totalAmount";
ALTER TABLE "Preorder" RENAME COLUMN deposit_amount TO "depositAmount";
ALTER TABLE "Preorder" RENAME COLUMN deposit_paid_at TO "depositPaidAt";
ALTER TABLE "Preorder" RENAME COLUMN converted_order_id TO "convertedOrderId";
ALTER TABLE "Preorder" RENAME COLUMN converted_at TO "convertedAt";
ALTER TABLE "Preorder" RENAME COLUMN metadata TO "extraData";

-- PreorderLine
ALTER TABLE "PreorderLine" RENAME COLUMN line_no TO "lineNo";
ALTER TABLE "PreorderLine" RENAME COLUMN sku_code TO "skuCode";
ALTER TABLE "PreorderLine" RENAME COLUMN sku_name TO "skuName";
ALTER TABLE "PreorderLine" RENAME COLUMN allocated_quantity TO "allocatedQuantity";
ALTER TABLE "PreorderLine" RENAME COLUMN unit_price TO "unitPrice";
ALTER TABLE "PreorderLine" RENAME COLUMN tax_rate TO "taxRate";
ALTER TABLE "PreorderLine" RENAME COLUMN tax_amount TO "taxAmount";
ALTER TABLE "PreorderLine" RENAME COLUMN discount_amount TO "discountAmount";
ALTER TABLE "PreorderLine" RENAME COLUMN line_total TO "lineTotal";
ALTER TABLE "PreorderLine" RENAME COLUMN expected_available_date TO "expectedAvailableDate";
ALTER TABLE "PreorderLine" RENAME COLUMN is_allocated TO "isAllocated";

-- PreorderInventory
ALTER TABLE "PreorderInventory" RENAME COLUMN preorder_line_id TO "preorderLineId";
ALTER TABLE "PreorderInventory" RENAME COLUMN reserved_quantity TO "reservedQuantity";
ALTER TABLE "PreorderInventory" RENAME COLUMN fulfilled_quantity TO "fulfilledQuantity";
ALTER TABLE "PreorderInventory" RENAME COLUMN reserved_at TO "reservedAt";
ALTER TABLE "PreorderInventory" RENAME COLUMN expected_arrival_date TO "expectedArrivalDate";
ALTER TABLE "PreorderInventory" RENAME COLUMN source_type TO "sourceType";
ALTER TABLE "PreorderInventory" RENAME COLUMN source_id TO "sourceId";
ALTER TABLE "PreorderInventory" RENAME COLUMN expires_at TO "expiresAt";
ALTER TABLE "PreorderInventory" RENAME COLUMN is_active TO "isActive";

-- SkuVelocity
ALTER TABLE "SkuVelocity" RENAME COLUMN analysis_date TO "analysisDate";
ALTER TABLE "SkuVelocity" RENAME COLUMN period_days TO "periodDays";
ALTER TABLE "SkuVelocity" RENAME COLUMN total_picks TO "totalPicks";
ALTER TABLE "SkuVelocity" RENAME COLUMN total_units TO "totalUnits";
ALTER TABLE "SkuVelocity" RENAME COLUMN avg_daily_picks TO "avgDailyPicks";
ALTER TABLE "SkuVelocity" RENAME COLUMN avg_daily_units TO "avgDailyUnits";
ALTER TABLE "SkuVelocity" RENAME COLUMN pick_frequency TO "pickFrequency";
ALTER TABLE "SkuVelocity" RENAME COLUMN velocity_class TO "velocityClass";
ALTER TABLE "SkuVelocity" RENAME COLUMN demand_variability TO "demandVariability";
ALTER TABLE "SkuVelocity" RENAME COLUMN avg_order_quantity TO "avgOrderQuantity";
ALTER TABLE "SkuVelocity" RENAME COLUMN peak_day_picks TO "peakDayPicks";
ALTER TABLE "SkuVelocity" RENAME COLUMN last_pick_date TO "lastPickDate";
ALTER TABLE "SkuVelocity" RENAME COLUMN days_since_last_pick TO "daysSinceLastPick";

-- BinCharacteristics
ALTER TABLE "BinCharacteristics" RENAME COLUMN zone_id TO "zoneId";
ALTER TABLE "BinCharacteristics" RENAME COLUMN pick_zone TO "pickZone";
ALTER TABLE "BinCharacteristics" RENAME COLUMN height_cm TO "heightCm";
ALTER TABLE "BinCharacteristics" RENAME COLUMN width_cm TO "widthCm";
ALTER TABLE "BinCharacteristics" RENAME COLUMN depth_cm TO "depthCm";
ALTER TABLE "BinCharacteristics" RENAME COLUMN volume_cubic_cm TO "volumeCubicCm";
ALTER TABLE "BinCharacteristics" RENAME COLUMN max_weight_kg TO "maxWeightKg";
ALTER TABLE "BinCharacteristics" RENAME COLUMN current_weight_kg TO "currentWeightKg";
ALTER TABLE "BinCharacteristics" RENAME COLUMN utilization_percent TO "utilizationPercent";
ALTER TABLE "BinCharacteristics" RENAME COLUMN accessibility_score TO "accessibilityScore";
ALTER TABLE "BinCharacteristics" RENAME COLUMN ergonomic_score TO "ergonomicScore";
ALTER TABLE "BinCharacteristics" RENAME COLUMN distance_from_dock TO "distanceFromDock";
ALTER TABLE "BinCharacteristics" RENAME COLUMN pick_path_sequence TO "pickPathSequence";
ALTER TABLE "BinCharacteristics" RENAME COLUMN is_active TO "isActive";
ALTER TABLE "BinCharacteristics" RENAME COLUMN last_updated_at TO "lastUpdatedAt";

-- SlottingRule
ALTER TABLE "SlottingRule" RENAME COLUMN rule_name TO "ruleName";
ALTER TABLE "SlottingRule" RENAME COLUMN rule_description TO "ruleDescription";
ALTER TABLE "SlottingRule" RENAME COLUMN is_active TO "isActive";
ALTER TABLE "SlottingRule" RENAME COLUMN velocity_classes TO "velocityClasses";
ALTER TABLE "SlottingRule" RENAME COLUMN target_zones TO "targetZones";
ALTER TABLE "SlottingRule" RENAME COLUMN bin_level_min TO "binLevelMin";
ALTER TABLE "SlottingRule" RENAME COLUMN bin_level_max TO "binLevelMax";
ALTER TABLE "SlottingRule" RENAME COLUMN min_accessibility_score TO "minAccessibilityScore";
ALTER TABLE "SlottingRule" RENAME COLUMN max_distance_from_dock TO "maxDistanceFromDock";
ALTER TABLE "SlottingRule" RENAME COLUMN category_filters TO "categoryFilters";
ALTER TABLE "SlottingRule" RENAME COLUMN attribute_filters TO "attributeFilters";
ALTER TABLE "SlottingRule" RENAME COLUMN effective_from TO "effectiveFrom";
ALTER TABLE "SlottingRule" RENAME COLUMN effective_to TO "effectiveTo";

SELECT 'Remaining column names fixed' as status;
