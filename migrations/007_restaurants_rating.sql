-- Add missing average_rating column to restaurants table
-- This column is referenced in chat.service.js but missing from schema
ALTER TABLE restaurants ADD COLUMN average_rating DECIMAL(3,2) DEFAULT NULL;