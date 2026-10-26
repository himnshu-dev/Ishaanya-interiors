// @ts-nocheck

export interface ReportDateRange {
  preset: 'all' | 'today' | '7d' | '30d' | 'quarter' | 'ytd' | 'custom';
  startDate?: string;
  endDate?: string;
}

export interface ExecutiveReportData {
  rangeLabel: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  // Lead metrics
  leads: {
    total: number;
    new: number;
    contacted: number;
    followUp: number;
    siteVisit: number;
    quotation: number;
    won: number;
    lost: number;
    conversionRate: number;
    hotProspects: number;
    avgScore: number;
    estimatedPipelineValue: number;
  };
  // Project metrics
  projects: {
    total: number;
    active: number;
    completed: number;
    planning: number;
    totalContractValue: number;
    avgTicketSize: number;
  };
  // Financial metrics
  financials: {
    totalRevenue: number;
    pendingReceivables: number;
    totalExpenses: number;
    netMargin: number;
    netMarginPercent: number;
  };
  // Distributions
  serviceBreakdown: Record<string, number>;
  sourceBreakdown: Record<string, number>;
  localityBreakdown: Record<string, number>;
  // Filtered raw items
  filteredLeads: any[];
  filteredProjects: any[];
  filteredFinance: any[];
}

export const DATE_PRESETS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: 'quarter', label: 'This Quarter' },
  { id: 'ytd', label: 'Year 2026' },
  { id: 'custom', label: 'Custom Range' },
];

/**
 * Calculates start and end timestamps based on date range selection
 */
export function getDateBounds(range: ReportDateRange): { start: Date; end: Date; label: string } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (range.preset === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    return { start, end, label: 'Today' };
  }

  if (range.preset === '7d') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { start, end, label: 'Last 7 Days' };
  }

  if (range.preset === '30d') {
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { start, end, label: 'Last 30 Days' };
  }

  if (range.preset === 'quarter') {
    const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    return { start, end, label: 'This Quarter (90 Days)' };
  }

  if (range.preset === 'ytd') {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    return { start, end, label: `Year ${now.getFullYear()} to Date` };
  }

  if (range.preset === 'custom' && range.startDate) {
    const start = new Date(range.startDate + 'T00:00:00');
    const customEnd = range.endDate ? new Date(range.endDate + 'T23:59:59') : end;
    return {
      start,
      end: customEnd,
      label: `${range.startDate} to ${range.endDate || 'Now'}`,
    };
  }

  // All time default (from year 2020)
  return {
    start: new Date(2020, 0, 1),
    end,
    label: 'All Time Records',
  };
}

/**
 * Parses numeric currency amount from string or number
 */
function parseCurrency(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).replace(/[^0-9.]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Computes comprehensive real metrics from raw collections
 */
export function computeExecutiveReport(
  leadsList: any[] = [],
  projectsList: any[] = [],
  financeList: any[] = [],
  range: ReportDateRange
): ExecutiveReportData {
  const { start, end, label } = getDateBounds(range);

  // Filter leads by date
  const filteredLeads = leadsList.filter(l => {
    const dStr = l.created_at || l.submittedAt || l.createdAt;
    if (!dStr) return true; // Include if date not set in 'all'
    const d = new Date(dStr);
    return d >= start && d <= end;
  });

  // Filter projects by date
  const filteredProjects = projectsList.filter(p => {
    const dStr = p.startDate || p.created_at || p.createdAt;
    if (!dStr) return true;
    const d = new Date(dStr);
    return d >= start && d <= end;
  });

  // Filter finance records by date
  const filteredFinance = financeList.filter(f => {
    const dStr = f.date || f.created_at || f.createdAt;
    if (!dStr) return true;
    const d = new Date(dStr);
    return d >= start && d <= end;
  });

  // Lead metrics
  let wonCount = 0;
  let lostCount = 0;
  let newCount = 0;
  let contactedCount = 0;
  let followUpCount = 0;
  let siteVisitCount = 0;
  let quotationCount = 0;
  let hotCount = 0;
  let scoreSum = 0;
  let scoredCount = 0;
  let pipelineBudgetSum = 0;

  const serviceBreakdown: Record<string, number> = {};
  const sourceBreakdown: Record<string, number> = {};
  const localityBreakdown: Record<string, number> = {};

  filteredLeads.forEach(l => {
    const st = (l.status || 'new').toLowerCase();
    if (st === 'won' || st === 'closed') wonCount++;
    else if (st === 'lost' || st === 'archived') lostCount++;
    else if (st === 'contacted') contactedCount++;
    else if (st === 'follow_up' || st === 'followup' || st === 'qualified') followUpCount++;
    else if (st === 'site_visit' || st === 'visit_scheduled') siteVisitCount++;
    else if (st === 'quotation' || st === 'proposal') quotationCount++;
    else newCount++;

    if (l.priority === 'hot' || l.priority === 'Hot') hotCount++;

    if (typeof l.aiScore === 'number' && l.aiScore > 0) {
      scoreSum += l.aiScore;
      scoredCount++;
    }

    const bVal = parseCurrency(l.estimatedBudget || l.budget);
    if (bVal > 0) pipelineBudgetSum += bVal;

    // Service category
    const svc = l.service || l.interestService || 'Modular Kitchen';
    serviceBreakdown[svc] = (serviceBreakdown[svc] || 0) + 1;

    // Source
    const src = l.source || l.leadSource || 'Website Inbound';
    sourceBreakdown[src] = (sourceBreakdown[src] || 0) + 1;

    // Locality
    const loc = l.locality || 'Dehradun';
    localityBreakdown[loc] = (localityBreakdown[loc] || 0) + 1;
  });

  const totalLeads = filteredLeads.length;
  const conversionRate = totalLeads > 0 ? (wonCount / totalLeads) * 100 : 0;
  const avgScore = scoredCount > 0 ? Math.round(scoreSum / scoredCount) : 75;

  // Project metrics
  let activeProj = 0;
  let completedProj = 0;
  let planningProj = 0;
  let totalContractValue = 0;

  filteredProjects.forEach(p => {
    const ph = (p.currentPhase || p.status || '').toLowerCase();
    if (ph.includes('complete') || ph.includes('handover') || ph.includes('done')) completedProj++;
    else if (ph.includes('plan') || ph.includes('measurement') || ph.includes('design')) planningProj++;
    else activeProj++;

    const cVal = parseCurrency(p.contractAmount || p.budget);
    totalContractValue += cVal;
  });

  const totalProjects = filteredProjects.length;
  const avgTicketSize = totalProjects > 0 ? totalContractValue / totalProjects : 0;

  // Financial calculations
  let totalRevenue = 0;
  let totalExpenses = 0;

  filteredFinance.forEach(f => {
    const amt = parseCurrency(f.amount);
    const type = (f.type || '').toLowerCase();
    if (type === 'income' || type === 'credit' || type === 'revenue') {
      totalRevenue += amt;
    } else {
      totalExpenses += amt;
    }
  });

  // If finance records are empty, use contract amounts from projects as baseline
  if (totalRevenue === 0 && totalContractValue > 0) {
    totalRevenue = totalContractValue;
  }

  const pendingReceivables = Math.max(0, totalContractValue - totalRevenue);
  const netMargin = totalRevenue - totalExpenses;
  const netMarginPercent = totalRevenue > 0 ? (netMargin / totalRevenue) * 100 : 0;

  return {
    rangeLabel: label,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    generatedAt: new Date().toLocaleString('en-IN'),
    leads: {
      total: totalLeads,
      new: newCount,
      contacted: contactedCount,
      followUp: followUpCount,
      siteVisit: siteVisitCount,
      quotation: quotationCount,
      won: wonCount,
      lost: lostCount,
      conversionRate: Math.round(conversionRate * 10) / 10,
      hotProspects: hotCount,
      avgScore,
      estimatedPipelineValue: pipelineBudgetSum,
    },
    projects: {
      total: totalProjects,
      active: activeProj,
      completed: completedProj,
      planning: planningProj,
      totalContractValue,
      avgTicketSize: Math.round(avgTicketSize),
    },
    financials: {
      totalRevenue,
      pendingReceivables,
      totalExpenses,
      netMargin,
      netMarginPercent: Math.round(netMarginPercent * 10) / 10,
    },
    serviceBreakdown,
    sourceBreakdown,
    localityBreakdown,
    filteredLeads,
    filteredProjects,
    filteredFinance,
  };
}

/**
 * Generates and downloads a complete CSV report
 */
export function downloadReportCSV(report: ExecutiveReportData) {
  const lines: string[] = [];

  lines.push('ISHAANYA INTERIORS - EXECUTIVE PERFORMANCE & REVENUE REPORT');
  lines.push(`Report Range: ${report.rangeLabel} (${report.startDate} to ${report.endDate})`);
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');

  lines.push('--- EXECUTIVE SUMMARY METRICS ---');
  lines.push('Metric,Value');
  lines.push(`Total Inquiries / Leads,${report.leads.total}`);
  lines.push(`Won Projects / Closed Deals,${report.leads.won}`);
  lines.push(`Lead Conversion Rate,${report.leads.conversionRate}%`);
  lines.push(`Hot Prospects,${report.leads.hotProspects}`);
  lines.push(`Estimated Pipeline Budget,₹${report.leads.estimatedPipelineValue.toLocaleString('en-IN')}`);
  lines.push(`Total Live Projects,${report.projects.total}`);
  lines.push(`Active On-Site Projects,${report.projects.active}`);
  lines.push(`Completed Projects,${report.projects.completed}`);
  lines.push(`Total Contracted Value,₹${report.projects.totalContractValue.toLocaleString('en-IN')}`);
  lines.push(`Recorded Revenue / Collections,₹${report.financials.totalRevenue.toLocaleString('en-IN')}`);
  lines.push(`Recorded Expenses,₹${report.financials.totalExpenses.toLocaleString('en-IN')}`);
  lines.push(`Net Operating Margin,₹${report.financials.netMargin.toLocaleString('en-IN')} (${report.financials.netMarginPercent}%)`);
  lines.push('');

  lines.push('--- LEADS & INQUIRIES REGISTER ---');
  lines.push('ID,Name,Phone,Locality,Service,Stage,Priority,Score,Budget,Date');
  report.filteredLeads.forEach(l => {
    lines.push([
      `"${l.id || ''}"`,
      `"${(l.name || '').replace(/"/g, '""')}"`,
      `"${(l.phone || '').replace(/"/g, '""')}"`,
      `"${(l.locality || 'Dehradun').replace(/"/g, '""')}"`,
      `"${(l.service || l.interestService || 'Modular Kitchen').replace(/"/g, '""')}"`,
      `"${l.status || 'new'}"`,
      `"${l.priority || 'warm'}"`,
      l.aiScore || 70,
      `"₹${parseCurrency(l.estimatedBudget || l.budget).toLocaleString('en-IN')}"`,
      `"${(l.created_at || l.submittedAt || '').slice(0, 10)}"`,
    ].join(','));
  });
  lines.push('');

  lines.push('--- LIVE PROJECTS REGISTER ---');
  lines.push('Code,Client Name,Phone,Locality,Type,Phase,Contract Amount,Start Date,Handover');
  report.filteredProjects.forEach(p => {
    lines.push([
      `"${p.projectCode || p.id || ''}"`,
      `"${(p.clientName || '').replace(/"/g, '""')}"`,
      `"${(p.clientPhone || '').replace(/"/g, '""')}"`,
      `"${(p.clientLocality || 'Dehradun').replace(/"/g, '""')}"`,
      `"${(p.projectType || 'Modular Kitchen').replace(/"/g, '""')}"`,
      `"${(p.currentPhase || 'Planning').replace(/"/g, '""')}"`,
      `"₹${parseCurrency(p.contractAmount).toLocaleString('en-IN')}"`,
      `"${p.startDate || ''}"`,
      `"${p.estimatedHandover || ''}"`,
    ].join(','));
  });

  const csvContent = lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ishaanya_executive_report_${report.startDate}_to_${report.endDate}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Opens a print-optimized executive report for browser print / Save as PDF
 */
export function triggerExecutiveReportPrint(report: ExecutiveReportData) {
  const printWindow = window.open('', '_blank', 'width=900,height=800');
  if (!printWindow) {
    alert('Please allow popups to generate the PDF print report.');
    return;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ishaanya Interiors - Executive Performance Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; margin: 40px; }
    .header { border-bottom: 2px solid #C8A96A; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
    .brand h1 { margin: 0; font-size: 26px; color: #0f0f0f; font-family: Georgia, serif; }
    .brand p { margin: 4px 0 0 0; color: #C8A96A; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
    .meta { text-align: right; font-size: 12px; color: #666; line-height: 1.6; }
    .meta strong { color: #1a1a1a; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 30px; }
    .card { background: #f9f9f9; border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px; }
    .card .title { font-size: 11px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .card .val { font-size: 24px; font-weight: bold; color: #0f0f0f; font-family: Georgia, serif; }
    .card .sub { font-size: 12px; color: #888; margin-top: 4px; }
    h2 { font-size: 18px; color: #0f0f0f; font-family: Georgia, serif; margin: 30px 0 15px 0; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 25px; }
    th { background: #f4f4f4; text-align: left; padding: 8px 10px; font-weight: 600; border-bottom: 2px solid #ddd; }
    td { padding: 8px 10px; border-bottom: 1px solid #eee; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
    .badge-won { background: #dcfce7; color: #166534; }
    .badge-hot { background: #fee2e2; color: #991b1b; }
    .footer { text-align: center; margin-top: 50px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 15px; }
    @media print {
      body { margin: 20mm; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; text-align: right;">
    <button onclick="window.print()" style="background: #C8A96A; color: #000; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer;">
      🖨️ Print / Save as PDF
    </button>
  </div>
  <div class="header">
    <div class="brand">
      <h1>Ishaanya Interiors</h1>
      <p>Modular Kitchens & Luxury Home Interiors • Dehradun</p>
    </div>
    <div class="meta">
      <div><strong>Reporting Window:</strong> ${report.rangeLabel}</div>
      <div><strong>Dates:</strong> ${report.startDate} to ${report.endDate}</div>
      <div><strong>Generated On:</strong> ${report.generatedAt}</div>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="title">Lead Inquiries & Conversion</div>
      <div class="val">${report.leads.total} Leads</div>
      <div class="sub">${report.leads.won} Won (${report.leads.conversionRate}% Conversion Rate)</div>
    </div>
    <div class="card">
      <div class="title">Total Contract Value</div>
      <div class="val">₹${report.projects.totalContractValue.toLocaleString('en-IN')}</div>
      <div class="sub">${report.projects.total} Projects (Avg ₹${report.projects.avgTicketSize.toLocaleString('en-IN')})</div>
    </div>
    <div class="card">
      <div class="title">Net Operating Revenue</div>
      <div class="val">₹${report.financials.totalRevenue.toLocaleString('en-IN')}</div>
      <div class="sub">Margin: ₹${report.financials.netMargin.toLocaleString('en-IN')} (${report.financials.netMarginPercent}%)</div>
    </div>
  </div>

  <h2>Active Pipeline Breakdown</h2>
  <table>
    <thead>
      <tr>
        <th>Stage</th>
        <th>Count</th>
        <th>Share</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>New / Untouched</td><td>${report.leads.new}</td><td>${report.leads.total > 0 ? Math.round((report.leads.new / report.leads.total) * 100) : 0}%</td><td>Fresh inquiries awaiting initial contact</td></tr>
      <tr><td>Contacted</td><td>${report.leads.contacted}</td><td>${report.leads.total > 0 ? Math.round((report.leads.contacted / report.leads.total) * 100) : 0}%</td><td>Initial phone / WhatsApp discussion initiated</td></tr>
      <tr><td>Site Visit Scheduled</td><td>${report.leads.siteVisit}</td><td>${report.leads.total > 0 ? Math.round((report.leads.siteVisit / report.leads.total) * 100) : 0}%</td><td>Laser measurement & on-site design consultation</td></tr>
      <tr><td>Quotation Sent</td><td>${report.leads.quotation}</td><td>${report.leads.total > 0 ? Math.round((report.leads.quotation / report.leads.total) * 100) : 0}%</td><td>3D layout & itemized BOQ proposal shared</td></tr>
      <tr><td>Won & Signed</td><td><strong>${report.leads.won}</strong></td><td><strong>${report.leads.conversionRate}%</strong></td><td>Contract signed and project booked</td></tr>
      <tr><td>Lost / Closed</td><td>${report.leads.lost}</td><td>${report.leads.total > 0 ? Math.round((report.leads.lost / report.leads.total) * 100) : 0}%</td><td>Not proceeding or archived</td></tr>
    </tbody>
  </table>

  <h2>Live Projects Registry</h2>
  <table>
    <thead>
      <tr>
        <th>Code</th>
        <th>Client Name</th>
        <th>Locality</th>
        <th>Project Type</th>
        <th>Phase</th>
        <th>Contract Amount</th>
      </tr>
    </thead>
    <tbody>
      ${report.filteredProjects.length === 0 ? '<tr><td colspan="6" style="text-align:center; color:#999;">No project records logged in this timeframe.</td></tr>' : ''}
      ${report.filteredProjects.map(p => `
        <tr>
          <td><strong>${p.projectCode || p.id}</strong></td>
          <td>${p.clientName || 'Client'}</td>
          <td>${p.clientLocality || 'Dehradun'}</td>
          <td>${p.projectType || 'Modular Kitchen'}</td>
          <td>${p.currentPhase || 'Planning'}</td>
          <td>₹${parseCurrency(p.contractAmount).toLocaleString('en-IN')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    Ishaanya Interiors Confidential Executive Report • Founder: Himanshu Kanswal • Dehradun, Uttarakhand
  </div>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
