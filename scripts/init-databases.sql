-- Create databases for each microservice
-- This script runs automatically when PostgreSQL container starts

-- Auth Service Database
CREATE DATABASE logistics_auth;

-- User Service Database  
CREATE DATABASE logistics_users;

-- Shipment Service Database
CREATE DATABASE logistics_shipments;

-- Support Service Database
CREATE DATABASE logistics_support;

-- Platform Service Database
CREATE DATABASE logistics_platforms;

-- Grant privileges to logistics user
GRANT ALL PRIVILEGES ON DATABASE logistics_auth TO logistics;
GRANT ALL PRIVILEGES ON DATABASE logistics_users TO logistics;
GRANT ALL PRIVILEGES ON DATABASE logistics_shipments TO logistics;
GRANT ALL PRIVILEGES ON DATABASE logistics_support TO logistics;
GRANT ALL PRIVILEGES ON DATABASE logistics_platforms TO logistics;

-- Output confirmation
\echo 'All microservice databases created successfully!'