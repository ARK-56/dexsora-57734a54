
-- Add new roles to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'shipment';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'billing';
