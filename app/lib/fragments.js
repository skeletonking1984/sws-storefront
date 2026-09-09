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
 * Collection handles are real and counterintuitive, don't "fix" them:
 * Chat Widget lives at `frontpage`, Goal Widget at
 * `stream-widgets-templates`.
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
    chatWidgets: collection(handle: "frontpage") {
      ...NavCollection
    }
    goalWidgets: collection(handle: "stream-widgets-templates") {
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
