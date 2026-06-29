-- Supabase SQL Schema for KNCC Excel Platform

-- 1. Projects Table
CREATE TABLE projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    client TEXT,
    budget NUMERIC,
    organization_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Purchase Orders Table
CREATE TABLE purchase_orders (
    id TEXT PRIMARY KEY, -- e.g., 'PO-1001'
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    vendor TEXT NOT NULL,
    description TEXT,
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending',
    organization_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Invoices Table
CREATE TABLE invoices (
    id TEXT PRIMARY KEY, -- e.g., 'INV-901'
    po_id TEXT REFERENCES purchase_orders(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending',
    date TEXT,
    organization_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Change Orders Table
CREATE TABLE change_orders (
    id TEXT PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    cost NUMERIC NOT NULL,
    status TEXT DEFAULT 'submitted',
    description TEXT,
    date TEXT,
    organization_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Documents Table (Metadata for Storage Bucket)
CREATE TABLE documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    size TEXT,
    type TEXT,
    uploader TEXT,
    organization_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS)

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Helper function to extract organization from JWT
CREATE OR REPLACE FUNCTION user_org() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'organization_name', '');
$$ LANGUAGE SQL STABLE;

-- Policies: Users can only select, insert, update, delete rows where organization_name matches their JWT metadata.

CREATE POLICY "Org Access Projects" ON projects
    FOR ALL USING (organization_name = user_org());

CREATE POLICY "Org Access POs" ON purchase_orders
    FOR ALL USING (organization_name = user_org());

CREATE POLICY "Org Access Invoices" ON invoices
    FOR ALL USING (organization_name = user_org());

CREATE POLICY "Org Access COs" ON change_orders
    FOR ALL USING (organization_name = user_org());

CREATE POLICY "Org Access Documents" ON documents
    FOR ALL USING (organization_name = user_org());
