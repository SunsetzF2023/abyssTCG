-- ============================================================
-- Supabase schema for abyssTCG real-time 8-player PVP rooms
--
-- Uses the `ab_` prefix so these tables do not collide with other
-- projects sharing the same Supabase database (e.g. spire-climber).
-- Run this in the Supabase SQL Editor before using the client.
-- Tables: ab_profiles, ab_rooms, ab_invitations
-- RLS is enabled for public client-side access.
-- ============================================================

-- Track online status and current room for every user
CREATE TABLE IF NOT EXISTS public.ab_profiles (
  id uuid PRIMARY KEY,
  username text,
  is_online boolean DEFAULT true,
  current_room_id uuid,
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ab_profiles ENABLE ROW LEVEL SECURITY;

-- Users can update only their own profile
CREATE POLICY "ab_profiles_self_update" ON public.ab_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert only their own profile
CREATE POLICY "ab_profiles_self_insert" ON public.ab_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Online list is visible to everyone
CREATE POLICY "ab_profiles_select_all" ON public.ab_profiles
  FOR SELECT USING (true);

-- Core room table with 8 fixed slots
CREATE TABLE IF NOT EXISTS public.ab_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text UNIQUE NOT NULL,
  host_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'loading', 'playing')),
  slot_0 text DEFAULT 'EMPTY',
  slot_1 text DEFAULT 'EMPTY',
  slot_2 text DEFAULT 'EMPTY',
  slot_3 text DEFAULT 'EMPTY',
  slot_4 text DEFAULT 'EMPTY',
  slot_5 text DEFAULT 'EMPTY',
  slot_6 text DEFAULT 'EMPTY',
  slot_7 text DEFAULT 'EMPTY',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ab_rooms ENABLE ROW LEVEL SECURITY;

-- Room owners can update anything in their room
CREATE POLICY "ab_rooms_host_update" ON public.ab_rooms
  FOR UPDATE USING (auth.uid() = host_id);

-- Anyone can create a room
CREATE POLICY "ab_rooms_insert" ON public.ab_rooms
  FOR INSERT WITH CHECK (auth.uid() = host_id);

-- Room data is visible to everyone in the room code flow
CREATE POLICY "ab_rooms_select_all" ON public.ab_rooms
  FOR SELECT USING (true);

-- Invitations between players
CREATE TABLE IF NOT EXISTS public.ab_invitations (
  id bigserial PRIMARY KEY,
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  room_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ab_invitations ENABLE ROW LEVEL SECURITY;

-- Senders can create invites
CREATE POLICY "ab_invitations_insert" ON public.ab_invitations
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Receivers can update (accept/reject) their own invites
CREATE POLICY "ab_invitations_receiver_update" ON public.ab_invitations
  FOR UPDATE USING (auth.uid() = receiver_id);

-- Both sender and receiver can see the invite
CREATE POLICY "ab_invitations_select" ON public.ab_invitations
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Indexes for realtime filters
CREATE INDEX IF NOT EXISTS idx_ab_rooms_code ON public.ab_rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_ab_rooms_status ON public.ab_rooms(status);
CREATE INDEX IF NOT EXISTS idx_ab_profiles_online ON public.ab_profiles(is_online);
CREATE INDEX IF NOT EXISTS idx_ab_invitations_receiver ON public.ab_invitations(receiver_id);
