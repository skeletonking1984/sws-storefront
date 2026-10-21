// NOTE: https://shopify.dev/docs/api/storefront/latest/queries/cart
export const CART_QUERY_FRAGMENT = `#graphql
  fragment Money on MoneyV2 {
    currencyCode
    amount
  }
  fragment CartLine on CartLine {
    id
    quantity
    attributes {
      key
      value
    }
    cost {
      totalAmount {
        ...Money
      }
      amountPerQuantity {
        ...Money
      }
      compareAtAmountPerQuantity {
        ...Money
      }
    }
    merchandise {
      ... on ProductVariant {
        id
        availableForSale
        compareAtPrice {
          ...Money
        }
        price {
          ...Money
        }
        requiresShipping
        title
        image {
          id
          url
          altText
          width
          height

        }
        product {
          handle
          title
          id
          vendor
          productType
        }
        selectedOptions {
          name
          value
        }
      }
    }
    parentRelationship {
      parent {
        id
      }
    }
  }
  fragment CartLineComponent on ComponentizableCartLine {
    id
    quantity
    attributes {
      key
      value
    }
    cost {
      totalAmount {
        ...Money
      }
      amountPerQuantity {
        ...Money
      }
      compareAtAmountPerQuantity {
        ...Money
      }
    }
    merchandise {
      ... on ProductVariant {
        id
        availableForSale
        compareAtPrice {
          ...Money
        }
        price {
          ...Money
        }
        requiresShipping
        title
        image {
          id
          url
          altText
          width
          height
        }
        product {
          handle
          title
          id
          vendor
          productType
        }
        selectedOptions {
          name
          value
        }
      }
    }
    lineComponents {
      ...CartLine
    }
  }
  fragment CartApiQuery on Cart {
    updatedAt
    id
    appliedGiftCards {
      id
      lastCharacters
      amountUsed {
        ...Money
      }
    }
    checkoutUrl
    totalQuantity
    buyerIdentity {
      countryCode
      customer {
        id
        email
        firstName
        lastName
        displayName
      }
      email
      phone
    }
    lines(first: $numCartLines) {
      nodes {
        ...CartLine
      }
      nodes {
        ...CartLineComponent
      }
    }
    cost {
      subtotalAmount {
        ...Money
      }
      totalAmount {
        ...Money
      }
      totalDutyAmount {
        ...Money
      }
      totalTaxAmount {
        ...Money
      }
    }
    note
    attributes {
      key
      value
    }
    discountCodes {
      code
      applicable
    }
  }
`;

const MENU_FRAGMENT = `#graphql
  fragment MenuItem on MenuItem {
    id
    resourceId
    tags
    title
    type
    url
  }
  fragment ChildMenuItem on MenuItem {
    ...MenuItem
  }
  fragment ParentMenuItem on MenuItem {
    ...MenuItem
    items {
      ...ChildMenuItem
    }
  }
  fragment Menu on Menu {
    id
    items {
      ...ParentMenuItem
    }
  }
`;

export const HEADER_QUERY = `#graphql
  fragment Shop on Shop {
    id
    name
    description
    primaryDomain {
      url
    }
    brand {
      logo {
        image {
          url
        }
      }
    }
  }
  query Header(
    $country: CountryCode
    $headerMenuHandle: String!
    $language: LanguageCode
  ) @inContext(language: $language, country: $country) {
    shop {
      ...Shop
    }
    menu(handle: $headerMenuHandle) {
      ...Menu
    }
  }
  ${MENU_FRAGMENT}
`;

export const FOOTER_QUERY = `#graphql
  query Footer(
    $country: CountryCode
    $footerMenuHandle: String!
    $language: LanguageCode
  ) @inContext(language: $language, country: $country) {
    menu(handle: $footerMenuHandle) {
      ...Menu
    }
  }
  ${MENU_FRAGMENT}
`;

/**
 * Powers the desktop/mobile mega menu image tiles and product cards, plus
 * the search palette's "Top widgets" empty-state thumbnails. Fetched once
 * in the root loader as deferred, non-blocking data (see app/root.jsx),
 * so it never delays time to first byte on any route.
 *
 * Chat Widget and Goal Widget are each queried under BOTH their current and
 * legacy handle (see app/lib/collectionHandles.js) because the 2026-09-28
 * rename (frontpage -> twitch-chat-widgets, stream-widgets-templates ->
 * twitch-goal-widgets) happens in Shopify Admin after this code deploys;
 * only one of the two resolves at any given time. app/root.jsx merges the
 * two aliases back down to the plain `chatWidgets`/`goalWidgets` keys
 * before this data reaches a component, so nothing downstream has to know
 * about the legacy alias at all.
 */
export const NAV_QUERY = `#graphql
  fragment NavCollection on Collection {
    id
    handle
    title
    image {
      url
      altText
    }
    products(first: 250) {
      nodes {
        id
      }
    }
  }
  fragment NavProduct on Product {
    id
    handle
    title
    featuredImage {
      url
      altText
    }
    selectedOrFirstAvailableVariant {
      price {
        amount
        currencyCode
      }
    }
  }
  query Nav(
    $country: CountryCode
    $language: LanguageCode
    $featuredWidgetHandle: String!
    $overlayHandle0: String!
    $overlayHandle1: String!
    $overlayHandle2: String!
    $overlayHandle3: String!
  ) @inContext(language: $language, country: $country) {
    allWidgets: collection(handle: "widgets") {
      ...NavCollection
    }
    # Handles are literal here, not interpolated from
    # app/lib/collectionHandles.js: @shopify/graphql-codegen statically
    # parses this tagged template and cannot resolve a JS expression inside
    # it (confirmed 2026-09-28, codegen throws "Variable ... not found" on
    # an interpolated handle). collectionHandles.js stays the source of
    # truth for every non-query use (links, matching); if either handle
    # changes there, mirror it here too.
    chatWidgetsCurrent: collection(handle: "twitch-chat-widgets") {
      ...NavCollection
    }
    chatWidgetsLegacy: collection(handle: "frontpage") {
      ...NavCollection
    }
    goalWidgetsCurrent: collection(handle: "twitch-goal-widgets") {
      ...NavCollection
    }
    goalWidgetsLegacy: collection(handle: "stream-widgets-templates") {
      ...NavCollection
    }
    topWidgets: collection(handle: "top-widgets") {
      ...NavCollection
      thumbs: products(first: 8) {
        nodes {
          ...NavProduct
        }
      }
    }
    overlays: collection(handle: "overlays") {
      ...NavCollection
    }
    bundles: collection(handle: "bundles") {
      ...NavCollection
    }
    featuredWidget: product(handle: $featuredWidgetHandle) {
      ...NavProduct
    }
    overlayFeatured0: product(handle: $overlayHandle0) {
      ...NavProduct
    }
    overlayFeatured1: product(handle: $overlayHandle1) {
      ...NavProduct
    }
    overlayFeatured2: product(handle: $overlayHandle2) {
      ...NavProduct
    }
    overlayFeatured3: product(handle: $overlayHandle3) {
      ...NavProduct
    }
  }
`;

/**
 * What a cart MUTATION returns. Hydrogen defaults this to its own
 * `CartApiMutation` = {id, totalQuantity, checkoutUrl}, which has no
 * `attributes` field, so `app/routes/cart.jsx` read `existingAttributes` as
 * `[]` on every mutation and `cartAttributesUpdate` silently became a full
 * REPLACE instead of a merge. Anything the app could not rebuild from a
 * cookie was destroyed on the next add to cart. That bug was reproduced
 * on production 2026-09-15 by `scripts/verify-cart-attributes.mjs`.
 *
 * Deliberately minimal plus `attributes`, not the full `CART_QUERY_FRAGMENT`:
 * a mutation runs on every quantity change and does not need the whole cart
 * back. This adds one small field to a payload that already existed rather
 * than returning every line, image and price on each click.
 */
export const CART_MUTATE_FRAGMENT = `#graphql
  fragment CartApiMutation on Cart {
    id
    totalQuantity
    checkoutUrl
    attributes {
      key
      value
    }
  }
`;
