import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { reportSchedulerService } from "@/lib/services/report-scheduler";
import { getEmailService } from "@/lib/services/communication/email-service";

// This endpoint is called by a cron job to execute scheduled reports
// Should be protected by a secret token in production

// Helper function to send report emails to all recipients
async function sendReportEmailToRecipients(
  recipients: string[],
  reportName: string,
  reportType: string,
  downloadUrl: string,
  dateRange: { fromDate: string; toDate: string }
): Promise<void> {
  const emailService = getEmailService();

  const subject = `[CJDQuick OMS] ${reportName} - Report Ready`;

  const htmlContent = `
    <h2>Your Scheduled Report is Ready</h2>
    <p>The scheduled report <strong>${reportName}</strong> has been generated and is ready for download.</p>
    <table style="border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Report Type:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${reportType}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Period:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${dateRange.fromDate} to ${dateRange.toDate}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Generated At:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${new Date().toLocaleString()}</td></tr>
    </table>
    <p>
      <a href="${downloadUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">
        Download Report
      </a>
    </p>
    <p style="color: #666; font-size: 12px; margin-top: 24px;">
      This is an automated email from CJDQuick OMS. Please do not reply to this email.
    </p>
  `;

  const textContent = `
Your Scheduled Report is Ready

The scheduled report "${reportName}" has been generated and is ready for download.

Report Type: ${reportType}
Period: ${dateRange.fromDate} to ${dateRange.toDate}
Generated At: ${new Date().toLocaleString()}

Download your report: ${downloadUrl}

This is an automated email from CJDQuick OMS. Please do not reply to this email.
  `.trim();

  // Send email to each recipient
  for (const recipient of recipients) {
    try {
      await emailService.sendMessage({
        to: recipient,
        subject,
        content: textContent,
        htmlContent,
      } as Parameters<typeof emailService.sendMessage>[0] & { htmlContent: string });

      console.log(`Report email sent to: ${recipient}`);
    } catch (error) {
      console.error(`Failed to send report email to ${recipient}:`, error);
    }
  }
}

// GET /api/cron/reports - Execute due scheduled reports
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (for Vercel cron or external scheduler)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get reports due for execution
    const dueReports = await reportSchedulerService.getReportsDueForExecution();

    if (dueReports.length === 0) {
      return NextResponse.json({
        message: "No reports due for execution",
        executedCount: 0,
      });
    }

    const results: Array<{
      reportId: string;
      reportName: string;
      success: boolean;
      error?: string;
    }> = [];

    // Execute each report
    for (const report of dueReports) {
      try {
        // Get date range based on frequency
        const dateRange = reportSchedulerService.getDateRangeForFrequency(
          report.frequency
        );

        // Build export URL params
        const reportFilters = (report.reportConfig as Record<string, string>) || {};
        const params = new URLSearchParams({
          format: report.format,
          type: report.reportType,
          fromDate: dateRange.fromDate,
          toDate: dateRange.toDate,
          ...reportFilters,
        });

        // Generate the report (in production, this would upload to S3/storage)
        const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3001";
        const exportUrl = `${baseUrl}/api/reports/export?${params.toString()}`;

        // For now, just record successful execution
        // In production, you would:
        // 1. Fetch the export
        // 2. Upload to cloud storage
        // 3. Send email with link to recipients

        await reportSchedulerService.recordExecution(report.id, {
          success: true,
          reportId: report.id,
          fileUrl: exportUrl, // In production, this would be a cloud storage URL
        });

        // Update last run time
        await prisma.scheduledReport.update({
          where: { id: report.id },
          data: { lastRunAt: new Date() },
        });

        results.push({
          reportId: report.id,
          reportName: report.name,
          success: true,
        });

        // Send email to recipients
        if (report.recipients && report.recipients.length > 0) {
          await sendReportEmailToRecipients(
            report.recipients,
            report.name,
            report.reportType,
            exportUrl,
            dateRange
          );
        }

        console.log(`Successfully executed report: ${report.name}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        await reportSchedulerService.recordExecution(report.id, {
          success: false,
          reportId: report.id,
          error: errorMessage,
        });

        results.push({
          reportId: report.id,
          reportName: report.name,
          success: false,
          error: errorMessage,
        });

        console.error(`Failed to execute report ${report.name}:`, error);
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      message: `Executed ${dueReports.length} reports`,
      executedCount: dueReports.length,
      successCount,
      failCount,
      results,
    });
  } catch (error) {
    console.error("Error running scheduled reports:", error);
    return NextResponse.json(
      { error: "Failed to run scheduled reports" },
      { status: 500 }
    );
  }
}

// POST /api/cron/reports - Manually trigger a specific report
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { reportId } = await request.json();

    if (!reportId) {
      return NextResponse.json(
        { error: "reportId is required" },
        { status: 400 }
      );
    }

    // Get the report
    const report = await prisma.scheduledReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    // Get date range based on frequency
    const dateRange = reportSchedulerService.getDateRangeForFrequency(
      report.frequency
    );

    // Build export URL params
    const filters = (report.reportConfig as Record<string, string>) || {};
    const params = new URLSearchParams({
      format: report.format || "EXCEL",
      type: report.reportType,
      fromDate: dateRange.fromDate,
      toDate: dateRange.toDate,
      ...filters,
    });

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3001";
    const exportUrl = `${baseUrl}/api/reports/export?${params.toString()}`;

    // Record execution
    await reportSchedulerService.recordExecution(report.id, {
      success: true,
      reportId: report.id,
      fileUrl: exportUrl,
    });

    // Update last run time
    await prisma.scheduledReport.update({
      where: { id: report.id },
      data: { lastRunAt: new Date() },
    });

    return NextResponse.json({
      message: "Report executed successfully",
      reportId: report.id,
      reportName: report.name,
      exportUrl,
    });
  } catch (error) {
    console.error("Error triggering report:", error);
    return NextResponse.json(
      { error: "Failed to trigger report" },
      { status: 500 }
    );
  }
}
