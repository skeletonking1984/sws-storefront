/**
 * Just enough customer to ask the sws-downloads Worker "what does this
 * person own": the id, and the email.
 *
 * The email is not decoration. A guest checkout has no Shopify customer id
 * on the order at all, so matching on id alone silently loses every order
 * placed before the buyer made an account -- which is most of this shop's
 * history. The Worker joins on customer_id OR a keyed hash of the email
 * (see src/lib/customer.js there), and the email is what reaches the guest
 * orders. It is sent server-to-server over TLS and the Worker stores only
 * the hash.
 *
 * NOTE: https://shopify.dev/docs/api/customer/latest/objects/Customer
 */
export const CUSTOMER_DOWNLOADS_QUERY = `#graphql
  query CustomerDownloads($language: LanguageCode) @inContext(language: $language) {
    customer {
      id
      emailAddress {
        emailAddress
      }
    }
  }
`;
