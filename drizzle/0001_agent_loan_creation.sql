-- Migration: Agent Loan Creation System
-- Adds ability for agents to create loans pending lender approval

-- Add new loan statuses to the enum
ALTER TYPE loan_status ADD VALUE IF NOT EXISTS 'pending_approval';
ALTER TYPE loan_status ADD VALUE IF NOT EXISTS 'rejected';

-- Add canCreateLoans permission to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS can_create_loans BOOLEAN NOT NULL DEFAULT false;

-- Add rejection reason to loans table
ALTER TABLE loans ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
