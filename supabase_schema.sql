-- ==============================================================================
-- KNCC EXCEL Platform - Supabase Database Schema
-- Run this in your Supabase SQL Editor to initialize the database tables.
-- ==============================================================================

-- 1. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    location TEXT,
    client TEXT,
    budget NUMERIC DEFAULT 0,
    tax_rate NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Purchase Orders (POs) Table
CREATE TABLE IF NOT EXISTS public.pos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number TEXT NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    supplier TEXT,
    vendor TEXT,
    amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Pending',
    date DATE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    po_id UUID REFERENCES public.pos(id) ON DELETE SET NULL,
    supplier TEXT,
    amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Pending',
    date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Change Orders (COs) Table
CREATE TABLE IF NOT EXISTS public.cos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    co_number TEXT NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT,
    description TEXT,
    amount NUMERIC DEFAULT 0,
    cost NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Pending',
    date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Materials Table
CREATE TABLE IF NOT EXISTS public.materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    item_code TEXT,
    description TEXT,
    category TEXT DEFAULT 'Uncategorized',
    quantity NUMERIC DEFAULT 0,
    uom TEXT DEFAULT 'ea',
    unit_price NUMERIC DEFAULT 0,
    amount NUMERIC DEFAULT 0,
    footage TEXT,
    dimensions TEXT,
    source_document TEXT, -- Can be a PO number or Invoice number
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- Row Level Security (RLS) Policies (Enable if using Auth)
-- ==============================================================================
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- Allow read/write access to authenticated users (adjust as needed for production)
CREATE POLICY "Enable all access for authenticated users" ON public.projects FOR ALL USING (true);
CREATE POLICY "Enable all access for authenticated users" ON public.pos FOR ALL USING (true);
CREATE POLICY "Enable all access for authenticated users" ON public.invoices FOR ALL USING (true);
CREATE POLICY "Enable all access for authenticated users" ON public.cos FOR ALL USING (true);
CREATE POLICY "Enable all access for authenticated users" ON public.materials FOR ALL USING (true);
