# Security policy

## Reporting a vulnerability

Email **support@streamwidgetshop.com** with "Security" in the subject line.
Please include:

- what you found and where (URL, route or file),
- steps to reproduce,
- the impact you expect.

Please do not open a public issue for a security problem, and do not test
against real customer accounts, orders or payment flows. We aim to reply
within a few business days.

## Scope

- The storefront at https://streamwidgetshop.com and the code in this
  repository.
- Checkout and payments are hosted by Shopify. Report issues in Shopify's
  own systems through Shopify's bug bounty program.

## Secrets

No credentials are stored in this repository. Every key is read from
environment variables at runtime; see `.env.example` for the names.
