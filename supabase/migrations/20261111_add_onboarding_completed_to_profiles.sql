-- Migration: Add onboarding_completed column to profiles table
-- Ensures profiles track whether a user has finished or dismissed the onboarding flow

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
