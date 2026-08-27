# Finance / accounting model

CargoGo keeps three numbers separate: transaction GMV, carrier principal and platform revenue. Management net profit is platform net revenue after recorded UAH operating expenses; it must not be confused with a statutory tax base. The dashboard exposes an indicative tax-base field only as a reconciliation aid. Before tax filing, bank and PSP statements and the final FOP/agency structure remain the accounting source of truth.

Operating expenses can be recorded through `/v1/staff/finance/expenses` and are audit logged. Foreign-currency costs remain in their native currency unless separately posted in UAH; CargoGo does not invent FX rates for statutory accounting.
