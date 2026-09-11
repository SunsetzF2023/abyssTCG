-- ============================================================
-- Supabase schema for abyssTCG real-time 8-player PVP rooms
--
-- Run this in the Supabase SQL Editor before using the client.
-- Tables: profiles, rooms, invitations
-- RLS is enabled for public client-side access.
-- ============================================================

-- Track online status and current room for every user
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  is_online boolean DEFAULT true,
  current_room_id uuid,
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can update only their own profile
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert only their own profile
CREATE POLICY "profiles_self_insert" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Online list is visible to everyone
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT USING (true);

-- Core room table with 8 fixed slots
CREATE TABLE IF NOT EXISTS public.rooms (
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

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Room owners can update anything in their room
CREATE POLICY "rooms_host_update" ON public.rooms
  FOR UPDATE USING (auth.uid() = host_id);

-- Anyone can create a room
CREATE POLICY "rooms_insert" ON public.rooms
  FOR INSERT WITH CHECK (auth.uid() = host_id);

-- Room data is visible to everyone in the room code flow
CREATE POLICY "rooms_select_all" ON public.rooms
  FOR SELECT USING (true);

-- Invitations between players
CREATE TABLE IF NOT EXISTS public.invitations (
  id bigserial PRIMARY KEY,
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  room_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Senders can create invites
CREATE POLICY "invitations_insert" ON public.invitations
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Receivers can update (accept/reject) their own invites
CREATE POLICY "invitations_receiver_update" ON public.invitations
  FOR UPDATE USING (auth.uid() = receiver_id);

-- Both sender and receiver can see the invite
CREATE POLICY "invitations_select" ON public.invitations
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Indexes for realtime filters
CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON public.rooms(status);
CREATE INDEX IF NOT EXISTS idx_profiles_online ON public.profiles(is_online);
CREATE INDEX IF NOT EXISTS idx_invitations_receiver ON public.invitations(receiver_id);
