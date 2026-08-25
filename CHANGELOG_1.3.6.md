# CargoGo v1.3.6

- Fixed empty-response JSON parsing in dispute screens.
- Removed participant/dev dispute resolution; sender and driver can only submit evidence.
- Added dedicated `dispute_reviewer` staff role; only it or `admin` can claim/resolve disputes.
- No-show remains `manual_review`: no automatic payout/refund. Reviewer decides after evidence; the dispute may remain under review while redelivery/return is arranged.
- Registration is phone-first. Ukrainian `0XXXXXXXXX`, `380XXXXXXXXX`, and E.164 `+...` are normalized server-side.
- Login accepts phone or legacy email so existing accounts are not locked out.
- `phone_verified_at` added for future OTP ownership verification. Phone ownership is not yet asserted without OTP.
