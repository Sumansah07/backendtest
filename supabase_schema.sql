-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    user_cart JSONB DEFAULT '{}',
    avatar TEXT,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Addresses Table (Assuming one user has many addresses)
CREATE TABLE IF NOT EXISTS addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    street TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip_code TEXT NOT NULL,
    country TEXT NOT NULL,
    phone TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    image TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Brands Table
CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    image TEXT NOT NULL,
    description TEXT,
    website TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    _type TEXT,
    name TEXT NOT NULL,
    images TEXT[] NOT NULL,
    price NUMERIC NOT NULL,
    discounted_percentage NUMERIC DEFAULT 0,
    stock INTEGER DEFAULT 0,
    sold_quantity INTEGER DEFAULT 0,
    category TEXT NOT NULL,
    brand TEXT,
    badge BOOLEAN,
    is_available BOOLEAN DEFAULT true,
    offer BOOLEAN DEFAULT false,
    description TEXT NOT NULL,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    items JSONB NOT NULL,
    amount NUMERIC NOT NULL,
    address JSONB NOT NULL,
    status TEXT DEFAULT 'pending',
    payment_method TEXT DEFAULT 'cod',
    payment_status TEXT DEFAULT 'pending',
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contacts Table
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    user_id UUID REFERENCES users(id),
    status TEXT DEFAULT 'unread',
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Settings Table
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default logo settings if they don't exist
INSERT INTO settings (key, value)
VALUES 
    ('logo_settings', '{"type": "text", "text": "ELARIC AI", "imageUrl": ""}')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value)
VALUES 
    ('site_settings', '{"name": "ELARIC AI", "description": "Modern e-commerce platform", "faviconUrl": ""}')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value)
VALUES 
    ('product_of_the_year', '{
        "title": "Product of The Year",
        "description": "Discover our most innovative and popular product that has captured hearts worldwide. Experience excellence in every detail.",
        "buttonText": "Shop Now",
        "link": "/shop",
        "image": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop"
    }')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value)
VALUES 
    ('footer_settings', '{
        "description": "Discover premium quality products with exceptional service. Your trusted shopping destination for modern lifestyle essentials.",
        "showStayUpdated": false,
        "quickLinks": [
            { "label": "About Us", "url": "/about", "visible": true },
            { "label": "Shop", "url": "/shop", "visible": true },
            { "label": "Contact", "url": "/contact", "visible": true },
            { "label": "Blog", "url": "/blog", "visible": true },
            { "label": "FAQ", "url": "/faq", "visible": true }
        ],
        "categories": [
            { "label": "Electronics", "url": "/shop?category=Electronics", "visible": true },
            { "label": "Fashion", "url": "/shop?category=Fashion", "visible": true },
            { "label": "Home & Garden", "url": "/shop?category=Home+%26+Garden", "visible": true },
            { "label": "Sports", "url": "/shop?category=Sports", "visible": true },
            { "label": "Beauty", "url": "/shop?category=Beauty", "visible": true }
        ],
        "socialLinks": [
            { "platform": "facebook", "url": "https://facebook.com", "visible": true },
            { "platform": "instagram", "url": "https://instagram.com", "visible": true },
            { "platform": "twitter", "url": "https://twitter.com", "visible": true },
            { "platform": "youtube", "url": "https://youtube.com", "visible": false },
            { "platform": "linkedin", "url": "https://linkedin.com", "visible": false },
            { "platform": "github", "url": "https://github.com", "visible": false }
        ]
    }')
ON CONFLICT (key) DO NOTHING;
