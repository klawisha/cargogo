# CargoGo 1.0 Payment + Payout Core

## Money invariant
A deal snapshots three immutable amounts when an offer is accepted:
- `agreed_amount_minor`: total charged/held from sender;
- `platform_fee_minor`: CargoGo fee;
- `carrier_amount_minor`: amount owed to carrier.

Example with `PLATFORM_FEE_BPS=800`:
- client total: 100000 minor = 1000 UAH;
- CargoGo fee: 8000 minor = 80 UAH;
- carrier payable: 92000 minor = 920 UAH.

## Payment lifecycle
1. Carrier must configure an active payout account before creating an offer.
2. Sender accepts an offer. Fee/payable amounts are snapshotted on `deal`.
3. Client payment is initiated through provider-hosted checkout. CargoGo never receives card PAN/CVV.
4. LiqPay mode uses `hold` and `hold_wait` as secured funds.
5. Cargo is transferred using pickup/delivery codes.
6. After delivery code, settlement captures the held total with `hold_completion`.
7. Ledger entries record capture, platform fee, carrier payable.
8. A payout is created for the carrier.
9. Sandbox payout is automatically marked paid. Production payout stays `manual_review` until a provider with approved marketplace payout capability is configured.
10. A deal reaches `completed/released` only after payout reaches `paid`.

## Payout credentials
CargoGo does not store CVV or payer card details. Carrier payout details use Ukrainian IBAN. Full IBAN and holder name are encrypted at rest with AES-256-GCM using `PAYOUT_DATA_SECRET`; APIs only return masked IBAN.

## Production guard
LiqPay's payout API requires separate provider approval and is not generally available to arbitrary merchants. Do not enable a guessed live payout request. `PAYOUTS_MODE=manual` is the safe production fallback until the merchant is approved or another marketplace payout provider is integrated.
