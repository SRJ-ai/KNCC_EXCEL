-- 6. Materials Table
CREATE TABLE materials (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    quantity NUMERIC DEFAULT 0,
    uom TEXT,
    item_code TEXT,
    description TEXT NOT NULL,
    footage NUMERIC DEFAULT 0,
    unit_price NUMERIC DEFAULT 0,
    amount NUMERIC DEFAULT 0,
    dimensions TEXT,
    source_document TEXT, -- e.g., 'PO-1001'
    organization_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org Access Materials" ON materials
    FOR ALL USING (organization_name = user_org());
