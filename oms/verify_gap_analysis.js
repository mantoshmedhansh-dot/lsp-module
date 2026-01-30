const { Client } = require('pg');

async function verifyGapAnalysis() {
  const client = new Client({
    host: 'db.rilakxywitslblkgikzf.supabase.co',
    port: 6543,
    database: 'postgres',
    user: 'postgres',
    password: 'Aquapurite2026',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('==========================================================');
    console.log('GAP ANALYSIS PHASE 2 & 3 - DATABASE VERIFICATION');
    console.log('==========================================================\n');

    const results = {
      pass: [],
      fail: [],
      partial: []
    };

    // ============================================================
    // PHASE 3: Data Population Requirements
    // ============================================================
    console.log('PHASE 3: DATA POPULATION REQUIREMENTS\n');
    console.log('------------------------------------------------------');

    // 1. Company (Fashion Forward exists)
    console.log('\n1. COMPANY');
    const companyResult = await client.query(`SELECT id, name, code FROM "Company"`);
    console.log(`   Records: ${companyResult.rows.length}`);
    companyResult.rows.forEach(r => console.log(`   - ${r.name} (${r.code})`));
    if (companyResult.rows.length >= 1) results.pass.push('Company (1+)');
    else results.fail.push('Company');

    // 2. Warehouses (Tokyo WH, Noida WH)
    console.log('\n2. WAREHOUSES/LOCATIONS');
    const locationResult = await client.query(`SELECT id, name, type FROM "Location"`);
    console.log(`   Records: ${locationResult.rows.length}`);
    locationResult.rows.forEach(r => console.log(`   - ${r.name} (${r.type})`));
    if (locationResult.rows.length >= 2) results.pass.push('Warehouses (2+)');
    else results.partial.push('Warehouses (need 2, have ' + locationResult.rows.length + ')');

    // 3. SKUs (5-10 with different categories)
    console.log('\n3. SKUs (5-10 with categories)');
    const skuResult = await client.query(`SELECT id, code, name, category FROM "SKU" LIMIT 15`);
    const skuCount = await client.query(`SELECT COUNT(*) as count FROM "SKU"`);
    console.log(`   Records: ${skuCount.rows[0].count}`);
    skuResult.rows.slice(0, 5).forEach(r => console.log(`   - ${r.code}: ${r.name} [${r.category || 'No Category'}]`));
    if (skuResult.rows.length > 5) console.log(`   ... and ${skuCount.rows[0].count - 5} more`);
    if (parseInt(skuCount.rows[0].count) >= 5) results.pass.push('SKUs (5-10)');
    else results.fail.push('SKUs (need 5-10)');

    // 4. Vendors (2)
    console.log('\n4. VENDORS (2 required)');
    try {
      const vendorResult = await client.query(`SELECT id, name, code FROM "Vendor" LIMIT 5`);
      console.log(`   Records: ${vendorResult.rows.length}`);
      vendorResult.rows.forEach(r => console.log(`   - ${r.name} (${r.code})`));
      if (vendorResult.rows.length >= 2) results.pass.push('Vendors (2)');
      else results.partial.push('Vendors (need 2, have ' + vendorResult.rows.length + ')');
    } catch (e) {
      console.log(`   Table not found or error: ${e.message}`);
      results.fail.push('Vendor table missing');
    }

    // 5. External POs (5, various statuses)
    console.log('\n5. EXTERNAL POs (5 required, various statuses)');
    try {
      const poResult = await client.query(`SELECT "poNumber", status, "vendorName" FROM "ExternalPO" LIMIT 10`);
      const poCount = await client.query(`SELECT COUNT(*) as count FROM "ExternalPO"`);
      console.log(`   Records: ${poCount.rows[0].count}`);
      poResult.rows.forEach(r => console.log(`   - ${r.poNumber}: ${r.status} (${r.vendorName})`));

      const poStatuses = await client.query(`SELECT status, COUNT(*) as count FROM "ExternalPO" GROUP BY status`);
      console.log('   By Status:');
      poStatuses.rows.forEach(r => console.log(`     - ${r.status}: ${r.count}`));

      if (parseInt(poCount.rows[0].count) >= 5) results.pass.push('External POs (5)');
      else results.partial.push('External POs (need 5, have ' + poCount.rows[0].count + ')');
    } catch (e) {
      console.log(`   Table not found: ${e.message}`);
      results.fail.push('ExternalPO table missing');
    }

    // 6. ASNs (3 linked to POs)
    console.log('\n6. ASNs (3 required, linked to POs)');
    try {
      const asnResult = await client.query(`SELECT "asnNumber", status, "poId" FROM "ASN" LIMIT 10`);
      const asnCount = await client.query(`SELECT COUNT(*) as count FROM "ASN"`);
      console.log(`   Records: ${asnCount.rows[0].count}`);
      asnResult.rows.forEach(r => console.log(`   - ${r.asnNumber}: ${r.status} (PO: ${r.poId ? 'Linked' : 'Not linked'})`));

      if (parseInt(asnCount.rows[0].count) >= 3) results.pass.push('ASNs (3)');
      else results.partial.push('ASNs (need 3, have ' + asnCount.rows[0].count + ')');
    } catch (e) {
      console.log(`   Table not found: ${e.message}`);
      results.fail.push('ASN table missing');
    }

    // 7. GRNs (10, some POSTED)
    console.log('\n7. GRNs (10 required, some POSTED)');
    try {
      const grnResult = await client.query(`SELECT "grNo", status FROM "GoodsReceipt" LIMIT 15`);
      const grnCount = await client.query(`SELECT COUNT(*) as count FROM "GoodsReceipt"`);
      console.log(`   Records: ${grnCount.rows[0].count}`);

      const grnStatuses = await client.query(`SELECT status, COUNT(*) as count FROM "GoodsReceipt" GROUP BY status`);
      console.log('   By Status:');
      grnStatuses.rows.forEach(r => console.log(`     - ${r.status}: ${r.count}`));

      if (parseInt(grnCount.rows[0].count) >= 10) results.pass.push('GRNs (10)');
      else results.partial.push('GRNs (need 10, have ' + grnCount.rows[0].count + ')');
    } catch (e) {
      console.log(`   Error: ${e.message}`);
      results.fail.push('GoodsReceipt issue');
    }

    // 8. Orders (20, various statuses)
    console.log('\n8. ORDERS (20 required, various statuses)');
    const orderResult = await client.query(`SELECT "orderNo", status, channel FROM "Order" LIMIT 25`);
    const orderCount = await client.query(`SELECT COUNT(*) as count FROM "Order"`);
    console.log(`   Records: ${orderCount.rows[0].count}`);

    const orderStatuses = await client.query(`SELECT status, COUNT(*) as count FROM "Order" GROUP BY status ORDER BY count DESC`);
    console.log('   By Status:');
    orderStatuses.rows.forEach(r => console.log(`     - ${r.status}: ${r.count}`));

    if (parseInt(orderCount.rows[0].count) >= 20) results.pass.push('Orders (20)');
    else results.partial.push('Orders (need 20, have ' + orderCount.rows[0].count + ')');

    // 9. NDR Cases (5)
    console.log('\n9. NDR CASES (5 required)');
    const ndrResult = await client.query(`SELECT "ndrCode", status, reason FROM "NDR"`);
    console.log(`   Records: ${ndrResult.rows.length}`);
    ndrResult.rows.forEach(r => console.log(`   - ${r.ndrCode}: ${r.status} (${r.reason})`));
    if (ndrResult.rows.length >= 5) results.pass.push('NDR Cases (5)');
    else results.partial.push('NDR Cases (need 5, have ' + ndrResult.rows.length + ')');

    // ============================================================
    // PHASE 2: Core Workflow Tables
    // ============================================================
    console.log('\n\n==========================================================');
    console.log('PHASE 2: CORE WORKFLOW TABLES');
    console.log('==========================================================\n');

    // Inbound Flow: External PO → ASN → GRN → Inventory
    console.log('INBOUND FLOW: External PO → ASN → GRN → Inventory\n');

    const inboundTables = [
      { name: 'ExternalPO', desc: 'Purchase Orders' },
      { name: 'ExternalPOItem', desc: 'PO Line Items' },
      { name: 'ASN', desc: 'Advance Shipping Notice' },
      { name: 'ASNItem', desc: 'ASN Line Items' },
      { name: 'GoodsReceipt', desc: 'Goods Receipt' },
      { name: 'GoodsReceiptItem', desc: 'GRN Line Items' },
      { name: 'Inventory', desc: 'Inventory Levels' }
    ];

    for (const table of inboundTables) {
      try {
        const count = await client.query(`SELECT COUNT(*) as count FROM "${table.name}"`);
        const status = parseInt(count.rows[0].count) > 0 ? '✓' : '○';
        console.log(`   ${status} ${table.name}: ${count.rows[0].count} records`);
        if (parseInt(count.rows[0].count) > 0) results.pass.push(table.name);
        else results.partial.push(table.name + ' (empty)');
      } catch (e) {
        console.log(`   ✗ ${table.name}: MISSING`);
        results.fail.push(table.name + ' missing');
      }
    }

    // Outbound Flow: Order → Allocate → Pick → Pack → Invoice → Dispatch
    console.log('\n\nOUTBOUND FLOW: Order → Allocate → Pick → Pack → Invoice → Dispatch\n');

    const outboundTables = [
      { name: 'Order', desc: 'Sales Orders' },
      { name: 'OrderItem', desc: 'Order Line Items' },
      { name: 'Wave', desc: 'Picking Waves' },
      { name: 'Picklist', desc: 'Pick Lists' },
      { name: 'PicklistItem', desc: 'Picklist Items' },
      { name: 'PackingSlip', desc: 'Packing Slips' },
      { name: 'Invoice', desc: 'Invoices' },
      { name: 'Delivery', desc: 'Deliveries' },
      { name: 'Shipment', desc: 'Shipments' }
    ];

    for (const table of outboundTables) {
      try {
        const count = await client.query(`SELECT COUNT(*) as count FROM "${table.name}"`);
        const status = parseInt(count.rows[0].count) > 0 ? '✓' : '○';
        console.log(`   ${status} ${table.name}: ${count.rows[0].count} records`);
      } catch (e) {
        console.log(`   ✗ ${table.name}: MISSING`);
        results.fail.push(table.name + ' missing');
      }
    }

    // Control Tower
    console.log('\n\nCONTROL TOWER\n');

    const controlTowerTables = [
      { name: 'Exception', desc: 'Exceptions' },
      { name: 'DetectionRule', desc: 'Detection Rules' },
      { name: 'AIActionLog', desc: 'AI Actions' }
    ];

    for (const table of controlTowerTables) {
      try {
        const count = await client.query(`SELECT COUNT(*) as count FROM "${table.name}"`);
        const status = parseInt(count.rows[0].count) > 0 ? '✓' : '○';
        console.log(`   ${status} ${table.name}: ${count.rows[0].count} records`);
      } catch (e) {
        console.log(`   ✗ ${table.name}: MISSING`);
        results.fail.push(table.name + ' missing');
      }
    }

    // Marketplace Tables
    console.log('\n\nMARKETPLACE INTEGRATION\n');

    const marketplaceTables = [
      { name: 'MarketplaceConnection', desc: 'Marketplace Connections' },
      { name: 'MarketplaceSkuMapping', desc: 'SKU Mappings' },
      { name: 'MarketplaceOAuthToken', desc: 'OAuth Tokens' },
      { name: 'MarketplaceSyncJob', desc: 'Sync Jobs' },
      { name: 'MarketplaceOrderSync', desc: 'Order Sync' },
      { name: 'MarketplaceSettlement', desc: 'Settlements' },
      { name: 'MarketplaceReturn', desc: 'Returns' },
      { name: 'MarketplaceWebhookEvent', desc: 'Webhook Events' },
      { name: 'MarketplaceInventoryBuffer', desc: 'Inventory Buffers' }
    ];

    for (const table of marketplaceTables) {
      try {
        const count = await client.query(`SELECT COUNT(*) as count FROM "${table.name}"`);
        const status = parseInt(count.rows[0].count) > 0 ? '✓' : '○';
        console.log(`   ${status} ${table.name}: ${count.rows[0].count} records`);
      } catch (e) {
        console.log(`   ✗ ${table.name}: MISSING`);
        results.fail.push(table.name + ' missing');
      }
    }

    // ============================================================
    // SUMMARY
    // ============================================================
    console.log('\n\n==========================================================');
    console.log('SUMMARY');
    console.log('==========================================================\n');

    console.log(`✓ PASS: ${results.pass.length} items`);
    results.pass.forEach(p => console.log(`   - ${p}`));

    console.log(`\n○ PARTIAL: ${results.partial.length} items`);
    results.partial.forEach(p => console.log(`   - ${p}`));

    console.log(`\n✗ FAIL/MISSING: ${results.fail.length} items`);
    results.fail.forEach(f => console.log(`   - ${f}`));

    const totalScore = results.pass.length;
    const totalItems = results.pass.length + results.partial.length + results.fail.length;
    console.log(`\n\nOVERALL: ${totalScore}/${totalItems} complete (${Math.round(totalScore/totalItems*100)}%)`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

verifyGapAnalysis();
