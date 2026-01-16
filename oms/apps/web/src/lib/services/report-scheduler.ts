import { prisma, ReportFrequency, ReportFormat, Prisma } from "@oms/database";

export interface ScheduledReportConfig {
  name: string;
  reportType: string;
  frequency: ReportFrequency;
  recipients: string[];
  reportConfig?: Record<string, unknown>;
  format?: ReportFormat;
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  time?: string; // HH:mm format, e.g. "08:00"
}

export interface ReportExecutionResult {
  success: boolean;
  reportId: string;
  executionId?: string;
  fileUrl?: string;
  error?: string;
}

export class ReportSchedulerService {
  /**
   * Create a new scheduled report
   */
  async createScheduledReport(
    companyId: string,
    createdById: string,
    config: ScheduledReportConfig
  ) {
    return prisma.scheduledReport.create({
      data: {
        companyId,
        name: config.name,
        reportType: config.reportType,
        frequency: config.frequency,
        recipients: config.recipients,
        reportConfig: (config.reportConfig || {}) as Prisma.InputJsonValue,
        format: config.format || "EXCEL",
        dayOfWeek: config.dayOfWeek,
        dayOfMonth: config.dayOfMonth,
        time: config.time || "08:00",
        isActive: true,
        createdById,
      },
    });
  }

  /**
   * Update scheduled report configuration
   */
  async updateScheduledReport(
    reportId: string,
    updates: Partial<ScheduledReportConfig> & { isActive?: boolean }
  ) {
    const data: Record<string, unknown> = {};

    if (updates.name !== undefined) data.name = updates.name;
    if (updates.reportType !== undefined) data.reportType = updates.reportType;
    if (updates.frequency !== undefined) data.frequency = updates.frequency;
    if (updates.recipients !== undefined) data.recipients = updates.recipients;
    if (updates.reportConfig !== undefined) data.reportConfig = updates.reportConfig as Prisma.InputJsonValue;
    if (updates.format !== undefined) data.format = updates.format;
    if (updates.dayOfWeek !== undefined) data.dayOfWeek = updates.dayOfWeek;
    if (updates.dayOfMonth !== undefined) data.dayOfMonth = updates.dayOfMonth;
    if (updates.time !== undefined) data.time = updates.time;
    if (updates.isActive !== undefined) data.isActive = updates.isActive;

    return prisma.scheduledReport.update({
      where: { id: reportId },
      data,
    });
  }

  /**
   * Get reports due for execution
   */
  async getReportsDueForExecution(): Promise<
    Array<{
      id: string;
      companyId: string;
      name: string;
      reportType: string;
      frequency: ReportFrequency;
      recipients: string[];
      reportConfig: Record<string, unknown>;
      format: ReportFormat;
      dayOfWeek: number | null;
      dayOfMonth: number | null;
      time: string;
      lastRunAt: Date | null;
    }>
  > {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDayOfWeek = now.getDay();
    const currentDayOfMonth = now.getDate();

    // Get all active scheduled reports
    const reports = await prisma.scheduledReport.findMany({
      where: { isActive: true },
    });

    // Filter reports that are due
    return reports.filter((report) => {
      // Check if already run today at this hour
      if (report.lastRunAt) {
        const lastRun = new Date(report.lastRunAt);
        if (
          lastRun.toDateString() === now.toDateString() &&
          lastRun.getHours() >= currentHour
        ) {
          return false;
        }
      }

      // Parse time string (HH:mm) to get hour
      const reportHour = parseInt(report.time.split(":")[0], 10);
      if (reportHour !== currentHour) {
        return false;
      }

      // Check frequency-specific conditions
      switch (report.frequency) {
        case "DAILY":
          return true;

        case "WEEKLY":
          return report.dayOfWeek === currentDayOfWeek;

        case "MONTHLY":
          return report.dayOfMonth === currentDayOfMonth;

        case "QUARTERLY":
          // Run on 1st of Jan, Apr, Jul, Oct
          const month = now.getMonth();
          const isQuarterStart = [0, 3, 6, 9].includes(month);
          return isQuarterStart && currentDayOfMonth === 1;

        default:
          return false;
      }
    }).map((report) => ({
      id: report.id,
      companyId: report.companyId,
      name: report.name,
      reportType: report.reportType,
      frequency: report.frequency,
      recipients: report.recipients as string[],
      reportConfig: (report.reportConfig as Record<string, unknown>) || {},
      format: report.format,
      dayOfWeek: report.dayOfWeek,
      dayOfMonth: report.dayOfMonth,
      time: report.time,
      lastRunAt: report.lastRunAt,
    }));
  }

  /**
   * Record report execution
   */
  async recordExecution(
    reportId: string,
    result: ReportExecutionResult
  ) {
    // Create execution record
    const execution = await prisma.reportExecution.create({
      data: {
        scheduledReportId: reportId,
        status: result.success ? "COMPLETED" : "FAILED",
        startedAt: new Date(),
        fileUrl: result.fileUrl,
        error: result.error,
        completedAt: result.success ? new Date() : undefined,
      },
    });

    // Calculate next run time
    const nextRunAt = await this.calculateNextRun(reportId);

    // Update last run time on scheduled report
    await prisma.scheduledReport.update({
      where: { id: reportId },
      data: {
        lastRunAt: new Date(),
        nextRunAt,
      },
    });

    return execution;
  }

  /**
   * Calculate next run time for a report
   */
  private async calculateNextRun(reportId: string): Promise<Date> {
    const report = await prisma.scheduledReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return new Date();
    }

    const now = new Date();
    const next = new Date(now);
    // Parse time string (HH:mm) to set hours and minutes
    const [hours, minutes] = report.time.split(":").map(Number);
    next.setHours(hours, minutes || 0, 0, 0);

    switch (report.frequency) {
      case "DAILY":
        next.setDate(next.getDate() + 1);
        break;

      case "WEEKLY":
        const daysUntilNext =
          ((report.dayOfWeek ?? 0) - now.getDay() + 7) % 7 || 7;
        next.setDate(next.getDate() + daysUntilNext);
        break;

      case "MONTHLY":
        next.setMonth(next.getMonth() + 1);
        next.setDate(report.dayOfMonth ?? 1);
        break;

      case "QUARTERLY":
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const nextQuarterStart = (currentQuarter + 1) * 3;
        next.setMonth(nextQuarterStart);
        next.setDate(1);
        break;
    }

    return next;
  }

  /**
   * Get execution history for a report
   */
  async getExecutionHistory(
    reportId: string,
    limit: number = 10
  ) {
    return prisma.reportExecution.findMany({
      where: { scheduledReportId: reportId },
      orderBy: { startedAt: "desc" },
      take: limit,
    });
  }

  /**
   * Get all scheduled reports for a company
   */
  async getScheduledReports(companyId: string) {
    return prisma.scheduledReport.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { ReportExecution: true },
        },
      },
    });
  }

  /**
   * Delete a scheduled report
   */
  async deleteScheduledReport(reportId: string) {
    // Delete all executions first
    await prisma.reportExecution.deleteMany({
      where: { scheduledReportId: reportId },
    });

    // Delete the report
    return prisma.scheduledReport.delete({
      where: { id: reportId },
    });
  }

  /**
   * Get date range for report based on frequency
   */
  getDateRangeForFrequency(frequency: ReportFrequency): {
    fromDate: string;
    toDate: string;
  } {
    const now = new Date();
    const toDate = now.toISOString().split("T")[0];
    let fromDate: string;

    switch (frequency) {
      case "DAILY":
        // Previous day
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        fromDate = yesterday.toISOString().split("T")[0];
        break;

      case "WEEKLY":
        // Previous 7 days
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        fromDate = weekAgo.toISOString().split("T")[0];
        break;

      case "MONTHLY":
        // Previous 30 days
        const monthAgo = new Date(now);
        monthAgo.setDate(monthAgo.getDate() - 30);
        fromDate = monthAgo.toISOString().split("T")[0];
        break;

      case "QUARTERLY":
        // Previous 90 days
        const quarterAgo = new Date(now);
        quarterAgo.setDate(quarterAgo.getDate() - 90);
        fromDate = quarterAgo.toISOString().split("T")[0];
        break;

      default:
        fromDate = toDate;
    }

    return { fromDate, toDate };
  }
}

export const reportSchedulerService = new ReportSchedulerService();
