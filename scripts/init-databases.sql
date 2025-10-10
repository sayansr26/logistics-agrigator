-- Create databases for each microservice
-- This script runs automatically when PostgreSQL container starts

-- API Gateway Database
CREATE DATABASE logistics_gateway;

-- Auth Service Database
CREATE DATABASE logistics_auth;

-- User Service Database  
CREATE DATABASE logistics_users;

-- Shipment Service Database
CREATE DATABASE logistics_shipments;

-- Partner Service Database
CREATE DATABASE logistics_partners;

-- Wallet Service Database
CREATE DATABASE logistics_wallet;

-- Support Service Database
CREATE DATABASE logistics_support;

-- Platform Service Database
CREATE DATABASE logistics_platforms;

-- License Service Database
CREATE DATABASE logistics_license;

-- Grant privileges to logistics user
GRANT ALL PRIVILEGES ON DATABASE logistics_gateway TO logistics;
GRANT ALL PRIVILEGES ON DATABASE logistics_auth TO logistics;
GRANT ALL PRIVILEGES ON DATABASE logistics_users TO logistics;
GRANT ALL PRIVILEGES ON DATABASE logistics_shipments TO logistics;
GRANT ALL PRIVILEGES ON DATABASE logistics_partners TO logistics;
GRANT ALL PRIVILEGES ON DATABASE logistics_wallet TO logistics;
GRANT ALL PRIVILEGES ON DATABASE logistics_support TO logistics;
GRANT ALL PRIVILEGES ON DATABASE logistics_platforms TO logistics;
GRANT ALL PRIVILEGES ON DATABASE logistics_license TO logistics;

-- Output confirmation
\echo 'All microservice databases created successfully!'