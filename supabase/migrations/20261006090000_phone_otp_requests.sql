-- Log of phone OTP requests (edge function phone-otp, Message Central).
-- Only the edge function (service role) reads and writes it; the app has no
-- direct access. Used for rate limiting (5 sends per number per hour) and to
-- see what was sent. Safe to run more than once.
create table if not exists public.phone_otp_requests (
    id uuid primary key default gen_random_uuid(),
    phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
    channel text not null default 'SMS' check (channel in ('SMS', 'WhatsApp')),
    verification_id text not null,
    requested_by uuid references auth.users(id),
    attempts integer not null default 0,
    verified_at timestamptz,
    created_at timestamptz not null default now()
);
create index if not exists phone_otp_requests_phone_time_idx on public.phone_otp_requests (phone, created_at desc);
alter table public.phone_otp_requests enable row level security;
revoke all on public.phone_otp_requests from public, anon, authenticated;
-- Admin can look at the log in the CRM later if needed.
drop policy if exists phone_otp_requests_admin_read on public.phone_otp_requests;
create policy phone_otp_requests_admin_read on public.phone_otp_requests
for select to authenticated using (public.get_my_user_type() = 'admin');
grant select on public.phone_otp_requests to authenticated;

-- Check: one row.
select to_regclass('public.phone_otp_requests');
