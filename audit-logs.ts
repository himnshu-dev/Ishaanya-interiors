// @ts-nocheck
import { createClient } from '@supabase/supabase-js';

export interface AuditLog {
  id: string;
  timestamp: string;
  actor_email: string;
  action: string;
  category: 'AUTH' | 'CMS' | 'LEADS' | 'PROJECTS' | 'FINANCE' | 'INVENTORY' | 'GALLERY' | 'AI' | 'SYSTEM';
  severity: 'info' | 'warning' | 'critical';
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

export const AUDIT_CATEGORIES = [
  { id: 'ALL', label: 'All Events' },
  { id: 'AUTH', label: 'Authentication' },
  { id: 'CMS', label: 'CMS & Content' },
  { id: 'LEADS', label: 'Leads & Inquiries' },
  { id: 'PROJECTS', label: 'Projects & BOQs' },
  { id: 'FINANCE', label: 'Finance & Accounts' },
  { id: 'INVENTORY', label: 'Inventory & Stock' },
  { id: 'GALLERY', label: 'Gallery & Portfolio' },
  { id: 'AI', label: 'AI Studio & Renders' },
  { id: 'SYSTEM', label: 'System & Database' },
];

export const AUDIT_SQL_SCHEMA = `-- ========================================================
-- Ishaanya Interiors - Dedicated Audit Logs Table Schema
-- Run this in your Supabase Dashboard > SQL Editor
-- ========================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    actor_email TEXT,
    action TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT DEFAULT 'info',
    ip_address TEXT,
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow public read & insert for owner audit tracking
CREATE POLICY "Allow authenticated owner read audit_logs" 
ON public.audit_logs FOR SELECT USING (true);

CREATE POLICY "Allow authenticated owner insert audit_logs" 
ON public.audit_logs FOR INSERT WITH CHECK (true);

-- Index for high-performance timestamp querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON public.audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
`;

/**
 * Dispatches an audit log event to both the dedicated audit_logs table
 * and the backward-compatible site_content.dashboard_records.auditLogs store.
 */
export async function recordAuditLog(
  supabase: any,
  actorEmail: string,
  action: string,
  category: string,
  details: Record<string, any> = {},
  severity: 'info' | 'warning' | 'critical' = 'info'
): Promise<boolean> {
  const logEntry: AuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    actor_email: actorEmail || 'himanshukanswal323@gmail.com',
    action,
    category: (category as any) || 'SYSTEM',
    severity,
    details,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server',
  };

  try {
    // 1. Try writing to backend /api/audit-logs
    if (typeof fetch !== 'undefined') {
      try {
        fetch('/api/audit-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logEntry),
        }).catch(() => {});
      } catch {}
    }

    // 2. Try direct insert into dedicated Supabase table `audit_logs`
    if (supabase) {
      try {
        const { error: tableError } = await supabase.from('audit_logs').insert([logEntry]);
        if (!tableError) {
          // Successfully logged to dedicated table
        }
      } catch {}

      // 3. Fallback / dual-persist into site_content.dashboard_records.auditLogs
      try {
        const { data: rec } = await supabase
          .from('site_content')
          .select('data')
          .eq('id', 'dashboard_records')
          .maybeSingle();

        const currentData = rec?.data || {};
        const logs: AuditLog[] = Array.isArray(currentData.auditLogs) ? currentData.auditLogs : [];
        logs.unshift(logEntry);
        // Retain last 300 logs
        const trimmedLogs = logs.slice(0, 300);

        await supabase
          .from('site_content')
          .update({
            data: { ...currentData, auditLogs: trimmedLogs },
            updated_at: new Date().toISOString(),
          })
          .eq('id', 'dashboard_records');
      } catch {}
    }

    return true;
  } catch (err) {
    console.warn('[Audit Logger Notice]:', err);
    return false;
  }
}

/**
 * Fetches audit logs from Supabase dedicated table or fallback store.
 */
export async function fetchAuditLogs(supabase: any): Promise<AuditLog[]> {
  if (!supabase) return [];

  try {
    // 1. Try dedicated table first
    const { data: tableData, error: tableError } = await supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(200);

    if (!tableError && Array.isArray(tableData) && tableData.length > 0) {
      return tableData;
    }
  } catch {}

  // 2. Fallback to site_content.dashboard_records.auditLogs
  try {
    const { data: rec } = await supabase
      .from('site_content')
      .select('data')
      .eq('id', 'dashboard_records')
      .maybeSingle();

    if (rec?.data?.auditLogs && Array.isArray(rec.data.auditLogs)) {
      return rec.data.auditLogs;
    }
  } catch {}

  // 3. Fallback to server endpoint /api/audit-logs
  if (typeof fetch !== 'undefined') {
    try {
      const res = await fetch('/api/audit-logs');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.logs)) {
          return json.logs;
        }
      }
    } catch {}
  }

  return [];
}

/**
 * Exports logs as downloadable CSV
 */
export function exportAuditLogsCSV(logs: AuditLog[]) {
  const headers = ['ID', 'Timestamp', 'Actor', 'Action', 'Category', 'Severity', 'Details'];
  const rows = logs.map(l => [
    l.id,
    new Date(l.timestamp).toLocaleString('en-IN'),
    `"${(l.actor_email || '').replace(/"/g, '""')}"`,
    `"${(l.action || '').replace(/"/g, '""')}"`,
    l.category,
    l.severity,
    `"${JSON.stringify(l.details || {}).replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ishaanya_security_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Exports logs as downloadable JSON
 */
export function exportAuditLogsJSON(logs: AuditLog[]) {
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ishaanya_security_audit_logs_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
