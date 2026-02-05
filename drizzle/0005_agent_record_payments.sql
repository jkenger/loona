-- Migration: Agent Record Payments Permission
-- Adds ability to toggle whether agents can record payments/collections

-- Add canRecordPayments permission to agents table (default true - enabled by default)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS can_record_payments BOOLEAN NOT NULL DEFAULT true;
