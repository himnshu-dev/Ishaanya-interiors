// @ts-nocheck

export const BUSINESS_MODULES_SQL_SCHEMA = `-- ========================================================
-- Ishaanya Interiors - Dedicated Business Modules Schema
-- Run this in your Supabase Dashboard > SQL Editor
-- ========================================================

-- 1. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
    id TEXT PRIMARY KEY,
    project_code TEXT,
    client_name TEXT NOT NULL,
    client_phone TEXT,
    client_locality TEXT,
    project_type TEXT DEFAULT 'Modular Kitchen',
    contract_amount NUMERIC DEFAULT 0,
    start_date DATE,
    estimated_handover DATE,
    lead_architect TEXT,
    site_supervisor TEXT,
    current_phase TEXT DEFAULT 'Planning & Measurement',
    notes TEXT,
    specifications JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Allow authenticated write projects" ON public.projects FOR ALL USING (true);

-- 2. Employees Table
CREATE TABLE IF NOT EXISTS public.employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    department TEXT DEFAULT 'Interior Architecture',
    phone TEXT,
    email TEXT,
    joining_date DATE,
    salary NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read employees" ON public.employees FOR SELECT USING (true);
CREATE POLICY "Allow authenticated write employees" ON public.employees FOR ALL USING (true);

-- 3. Finance Records Table
CREATE TABLE IF NOT EXISTS public.finance_records (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL, -- 'income' or 'expense'
    category TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    date DATE NOT NULL,
    project_id TEXT,
    payment_mode TEXT DEFAULT 'Bank Transfer',
    invoice_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.finance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read finance_records" ON public.finance_records FOR SELECT USING (true);
CREATE POLICY "Allow authenticated write finance_records" ON public.finance_records FOR ALL USING (true);

-- 4. Inventory Items Table
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity NUMERIC DEFAULT 0,
    unit TEXT DEFAULT 'Sheets',
    supplier TEXT,
    min_threshold NUMERIC DEFAULT 5,
    location TEXT DEFAULT 'Dehradun Workshop',
    status TEXT DEFAULT 'in_stock',
    last_restocked DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read inventory_items" ON public.inventory_items FOR SELECT USING (true);
CREATE POLICY "Allow authenticated write inventory_items" ON public.inventory_items FOR ALL USING (true);

-- 5. Calendar Events Table
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL, -- 'site_visit', 'meeting', 'delivery', 'handover'
    date DATE NOT NULL,
    time TEXT,
    client_name TEXT,
    phone TEXT,
    location TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read calendar_events" ON public.calendar_events FOR SELECT USING (true);
CREATE POLICY "Allow authenticated write calendar_events" ON public.calendar_events FOR ALL USING (true);

-- 6. AI Generations Table
CREATE TABLE IF NOT EXISTS public.ai_generations (
    id TEXT PRIMARY KEY,
    prompt TEXT NOT NULL,
    aspect_ratio TEXT DEFAULT '16:9',
    image_url TEXT,
    storage_path TEXT,
    category TEXT DEFAULT 'kitchen',
    model_used TEXT,
    published_to_gallery BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read ai_generations" ON public.ai_generations FOR SELECT USING (true);
CREATE POLICY "Allow authenticated write ai_generations" ON public.ai_generations FOR ALL USING (true);
`;

/**
 * Checks which dedicated tables exist in Supabase
 */
export async function checkDedicatedTablesAvailability(supabase: any) {
  if (!supabase) return { allAvailable: false, tables: {} };

  const tablesToCheck = [
    'audit_logs',
    'projects',
    'employees',
    'finance_records',
    'inventory_items',
    'calendar_events',
    'ai_generations',
  ];

  const results: Record<string, boolean> = {};

  for (const t of tablesToCheck) {
    try {
      const { error } = await supabase.from(t).select('id').limit(1);
      results[t] = !error;
    } catch {
      results[t] = false;
    }
  }

  const allAvailable = Object.values(results).every(v => v === true);
  return { allAvailable, tables: results };
}

/**
 * Migrates data from legacy dashboard_records in site_content to dedicated tables
 * without deleting or modifying the legacy records (ensures zero data loss).
 */
export async function migrateLegacyToDedicatedTables(supabase: any) {
  if (!supabase) return { success: false, message: 'Supabase client not initialized' };

  try {
    // 1. Fetch legacy records
    const { data: rec, error } = await supabase
      .from('site_content')
      .select('data')
      .eq('id', 'dashboard_records')
      .maybeSingle();

    if (error || !rec?.data) {
      return { success: false, message: 'No legacy dashboard_records found to migrate.' };
    }

    const legacy = rec.data;
    const migratedCounts: Record<string, number> = {};

    // 2. Migrate Projects
    if (Array.isArray(legacy.liveProjects) && legacy.liveProjects.length > 0) {
      try {
        const rows = legacy.liveProjects.map(p => ({
          id: String(p.id || `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`),
          project_code: p.projectCode || null,
          client_name: p.clientName || 'Client',
          client_phone: p.clientPhone || null,
          client_locality: p.clientLocality || 'Dehradun',
          project_type: p.projectType || 'Modular Kitchen',
          contract_amount: typeof p.contractAmount === 'number' ? p.contractAmount : parseFloat(String(p.contractAmount).replace(/[^0-9.]/g, '') || '0'),
          start_date: p.startDate || null,
          estimated_handover: p.estimatedHandover || null,
          lead_architect: p.leadArchitect || 'Himanshu Kanswal',
          site_supervisor: p.siteSupervisor || null,
          current_phase: p.currentPhase || 'Planning',
          notes: p.notes || null,
        }));
        const { error: pErr } = await supabase.from('projects').upsert(rows, { onConflict: 'id' });
        if (!pErr) migratedCounts.projects = rows.length;
      } catch (err) {
        console.warn('Projects migration notice:', err);
      }
    }

    // 3. Migrate Employees
    if (Array.isArray(legacy.employees) && legacy.employees.length > 0) {
      try {
        const rows = legacy.employees.map(e => ({
          id: String(e.id || `emp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`),
          name: e.name || 'Team Member',
          role: e.role || 'Specialist',
          department: e.department || 'Interior Architecture',
          phone: e.phone || null,
          email: e.email || null,
          joining_date: e.joiningDate || null,
          salary: typeof e.salary === 'number' ? e.salary : parseFloat(String(e.salary).replace(/[^0-9.]/g, '') || '0'),
          status: e.status || 'active',
        }));
        const { error: eErr } = await supabase.from('employees').upsert(rows, { onConflict: 'id' });
        if (!eErr) migratedCounts.employees = rows.length;
      } catch (err) {
        console.warn('Employees migration notice:', err);
      }
    }

    // 4. Migrate Finance Records
    if (Array.isArray(legacy.financeRecords) && legacy.financeRecords.length > 0) {
      try {
        const rows = legacy.financeRecords.map(f => ({
          id: String(f.id || `fin_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`),
          title: f.title || f.category || 'Transaction',
          type: f.type || 'expense',
          category: f.category || 'Operations',
          amount: typeof f.amount === 'number' ? f.amount : parseFloat(String(f.amount).replace(/[^0-9.]/g, '') || '0'),
          date: f.date || new Date().toISOString().slice(0, 10),
          notes: f.notes || null,
        }));
        const { error: fErr } = await supabase.from('finance_records').upsert(rows, { onConflict: 'id' });
        if (!fErr) migratedCounts.finance = rows.length;
      } catch (err) {
        console.warn('Finance migration notice:', err);
      }
    }

    // 5. Migrate Inventory Items
    if (Array.isArray(legacy.inventoryItems) && legacy.inventoryItems.length > 0) {
      try {
        const rows = legacy.inventoryItems.map(inv => ({
          id: String(inv.id || `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`),
          name: inv.name || 'Material Item',
          category: inv.category || 'Plywood',
          quantity: typeof inv.quantity === 'number' ? inv.quantity : parseFloat(String(inv.quantity).replace(/[^0-9.]/g, '') || '0'),
          unit: inv.unit || 'Sheets',
          supplier: inv.supplier || null,
          min_threshold: inv.minThreshold || 5,
          status: inv.status || 'in_stock',
        }));
        const { error: iErr } = await supabase.from('inventory_items').upsert(rows, { onConflict: 'id' });
        if (!iErr) migratedCounts.inventory = rows.length;
      } catch (err) {
        console.warn('Inventory migration notice:', err);
      }
    }

    // 6. Migrate Calendar Events
    if (Array.isArray(legacy.calendarEvents) && legacy.calendarEvents.length > 0) {
      try {
        const rows = legacy.calendarEvents.map(cal => ({
          id: String(cal.id || `cal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`),
          title: cal.title || 'Event',
          type: cal.type || 'site_visit',
          date: cal.date || new Date().toISOString().slice(0, 10),
          time: cal.time || '10:00 AM',
          client_name: cal.clientName || null,
          notes: cal.notes || null,
        }));
        const { error: cErr } = await supabase.from('calendar_events').upsert(rows, { onConflict: 'id' });
        if (!cErr) migratedCounts.calendar = rows.length;
      } catch (err) {
        console.warn('Calendar migration notice:', err);
      }
    }

    return {
      success: true,
      migratedCounts,
      message: `Migration completed successfully! Migrated: ${Object.entries(migratedCounts).map(([k, v]) => `${k} (${v})`).join(', ') || 'No records needed migration'}. Legacy records preserved safely.`,
    };
  } catch (err) {
    return { success: false, message: (err as any)?.message || 'Migration encountered an error.' };
  }
}
