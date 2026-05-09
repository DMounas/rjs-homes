-- ==========================================
-- RJS HOMES - COMPLETE SUPABASE SETUP SCRIPT
-- ==========================================
-- Instructions: Copy this entire file and paste it into the "SQL Editor" in your Supabase dashboard, then click "Run".
-- This script is safe to run multiple times; it uses "IF NOT EXISTS".

-- 1. PROFILES (Users and Roles)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT,
    full_name TEXT,
    role TEXT DEFAULT 'client', -- 'admin' or 'client'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

-- 2. HOMEPAGE PROJECTS
CREATE TABLE IF NOT EXISTS homepage_projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    type TEXT NOT NULL,
    units TEXT NOT NULL,
    price_range TEXT NOT NULL,
    status TEXT NOT NULL,
    image_url TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE homepage_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view homepage projects" ON homepage_projects FOR SELECT USING (true);
CREATE POLICY "Admins manage homepage projects" ON homepage_projects FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- 3. CONSTRUCTION CLIENT PROJECTS
CREATE TABLE IF NOT EXISTS projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    client_name TEXT NOT NULL,
    title TEXT NOT NULL,
    overall_progress INTEGER DEFAULT 0,
    client_id UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage projects" ON projects FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Clients view own projects" ON projects FOR SELECT USING (auth.uid() = client_id);

-- 4. CONSTRUCTION PHASES
CREATE TABLE IF NOT EXISTS phases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    progress INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage phases" ON phases FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Clients view own project phases" ON phases FOR SELECT USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = phases.project_id AND projects.client_id = auth.uid()));

-- 5. PRODUCTS (Shop)
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    stock INTEGER DEFAULT 0,
    category TEXT,
    material TEXT,
    delivery_days INTEGER DEFAULT 7,
    delivery_partner TEXT,
    description TEXT,
    dimensions TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active products" ON products FOR SELECT USING (active = true);
CREATE POLICY "Admins can view all products" ON products FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins manage products" ON products FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- 6. ORDERS (Shop)
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id),
    total_amount INTEGER NOT NULL,
    status TEXT DEFAULT 'Confirmed',
    payment_id TEXT,
    delivery_details JSONB,
    items JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage orders" ON orders FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Users manage own orders" ON orders FOR ALL USING (auth.uid() = user_id);

-- 7. DEFAULT HOMEPAGE PROJECTS
INSERT INTO homepage_projects (name, location, type, units, price_range, status, sort_order)
VALUES 
('Villa Areca', 'Jubilee Hills, Hyderabad', 'Villa', '24 Units', '₹85L - ₹1.2 Cr', 'ACTIVE', 1),
('Skyline Block A', 'Gachibowli, Hyderabad', 'Apartment', '120 Units', '₹45L - ₹75L', 'ACTIVE', 2),
('Duplex Row Ph.1', 'Kompally, Hyderabad', 'Duplex', '36 Units', '₹65L - ₹90L', 'ONGOING', 3),
('Green Meadows', 'Shamirpet, Hyderabad', 'Villa', '48 Units', '₹1.1 Cr - ₹1.8 Cr', 'NEW LAUNCH', 4),
('Commercial Hub', 'HITEC City, Hyderabad', 'Commercial', '18 Units', '₹1.5 Cr - ₹3 Cr', 'COMPLETED', 5)
ON CONFLICT DO NOTHING;
