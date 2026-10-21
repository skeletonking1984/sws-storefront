/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as StorefrontAPI from '@shopify/hydrogen/storefront-api-types';

export type MoneyFragment = Pick<
  StorefrontAPI.MoneyV2,
  'currencyCode' | 'amount'
>;

export type CartLineFragment = Pick<
  StorefrontAPI.CartLine,
  'id' | 'quantity'
> & {
  attributes: Array<Pick<StorefrontAPI.Attribute, 'key' | 'value'>>;
  cost: {
    totalAmount: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
    amountPerQuantity: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
    compareAtAmountPerQuantity?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
    >;
  };
  merchandise: Pick<
    StorefrontAPI.ProductVariant,
    'id' | 'availableForSale' | 'requiresShipping' | 'title'
  > & {
    compareAtPrice?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
    >;
    price: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
    image?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText' | 'width' | 'height'>
    >;
    product: Pick<
      StorefrontAPI.Product,
      'handle' | 'title' | 'id' | 'vendor' | 'productType'
    >;
    selectedOptions: Array<
      Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
    >;
  };
  parentRelationship?: StorefrontAPI.Maybe<{
    parent: Pick<StorefrontAPI.CartLine, 'id'>;
  }>;
};

export type CartLineComponentFragment = Pick<
  StorefrontAPI.ComponentizableCartLine,
  'id' | 'quantity'
> & {
  attributes: Array<Pick<StorefrontAPI.Attribute, 'key' | 'value'>>;
  cost: {
    totalAmount: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
    amountPerQuantity: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
    compareAtAmountPerQuantity?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
    >;
  };
  merchandise: Pick<
    StorefrontAPI.ProductVariant,
    'id' | 'availableForSale' | 'requiresShipping' | 'title'
  > & {
    compareAtPrice?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
    >;
    price: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
    image?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText' | 'width' | 'height'>
    >;
    product: Pick<
      StorefrontAPI.Product,
      'handle' | 'title' | 'id' | 'vendor' | 'productType'
    >;
    selectedOptions: Array<
      Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
    >;
  };
  lineComponents: Array<
    Pick<StorefrontAPI.CartLine, 'id' | 'quantity'> & {
      attributes: Array<Pick<StorefrontAPI.Attribute, 'key' | 'value'>>;
      cost: {
        totalAmount: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
        amountPerQuantity: Pick<
          StorefrontAPI.MoneyV2,
          'currencyCode' | 'amount'
        >;
        compareAtAmountPerQuantity?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
        >;
      };
      merchandise: Pick<
        StorefrontAPI.ProductVariant,
        'id' | 'availableForSale' | 'requiresShipping' | 'title'
      > & {
        compareAtPrice?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
        >;
        price: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
        image?: StorefrontAPI.Maybe<
          Pick<
            StorefrontAPI.Image,
            'id' | 'url' | 'altText' | 'width' | 'height'
          >
        >;
        product: Pick<
          StorefrontAPI.Product,
          'handle' | 'title' | 'id' | 'vendor' | 'productType'
        >;
        selectedOptions: Array<
          Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
        >;
      };
      parentRelationship?: StorefrontAPI.Maybe<{
        parent: Pick<StorefrontAPI.CartLine, 'id'>;
      }>;
    }
  >;
};

export type CartApiQueryFragment = Pick<
  StorefrontAPI.Cart,
  'updatedAt' | 'id' | 'checkoutUrl' | 'totalQuantity' | 'note'
> & {
  appliedGiftCards: Array<
    Pick<StorefrontAPI.AppliedGiftCard, 'id' | 'lastCharacters'> & {
      amountUsed: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
    }
  >;
  buyerIdentity: Pick<
    StorefrontAPI.CartBuyerIdentity,
    'countryCode' | 'email' | 'phone'
  > & {
    customer?: StorefrontAPI.Maybe<
      Pick<
        StorefrontAPI.Customer,
        'id' | 'email' | 'firstName' | 'lastName' | 'displayName'
      >
    >;
  };
  lines: {
    nodes: Array<
      | (Pick<StorefrontAPI.CartLine, 'id' | 'quantity'> & {
          attributes: Array<Pick<StorefrontAPI.Attribute, 'key' | 'value'>>;
          cost: {
            totalAmount: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
            amountPerQuantity: Pick<
              StorefrontAPI.MoneyV2,
              'currencyCode' | 'amount'
            >;
            compareAtAmountPerQuantity?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
            >;
          };
          merchandise: Pick<
            StorefrontAPI.ProductVariant,
            'id' | 'availableForSale' | 'requiresShipping' | 'title'
          > & {
            compareAtPrice?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
            >;
            price: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
            image?: StorefrontAPI.Maybe<
              Pick<
                StorefrontAPI.Image,
                'id' | 'url' | 'altText' | 'width' | 'height'
              >
            >;
            product: Pick<
              StorefrontAPI.Product,
              'handle' | 'title' | 'id' | 'vendor' | 'productType'
            >;
            selectedOptions: Array<
              Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
            >;
          };
          parentRelationship?: StorefrontAPI.Maybe<{
            parent: Pick<StorefrontAPI.CartLine, 'id'>;
          }>;
        })
      | (Pick<StorefrontAPI.ComponentizableCartLine, 'id' | 'quantity'> & {
          attributes: Array<Pick<StorefrontAPI.Attribute, 'key' | 'value'>>;
          cost: {
            totalAmount: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
            amountPerQuantity: Pick<
              StorefrontAPI.MoneyV2,
              'currencyCode' | 'amount'
            >;
            compareAtAmountPerQuantity?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
            >;
          };
          merchandise: Pick<
            StorefrontAPI.ProductVariant,
            'id' | 'availableForSale' | 'requiresShipping' | 'title'
          > & {
            compareAtPrice?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
            >;
            price: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
            image?: StorefrontAPI.Maybe<
              Pick<
                StorefrontAPI.Image,
                'id' | 'url' | 'altText' | 'width' | 'height'
              >
            >;
            product: Pick<
              StorefrontAPI.Product,
              'handle' | 'title' | 'id' | 'vendor' | 'productType'
            >;
            selectedOptions: Array<
              Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
            >;
          };
          lineComponents: Array<
            Pick<StorefrontAPI.CartLine, 'id' | 'quantity'> & {
              attributes: Array<Pick<StorefrontAPI.Attribute, 'key' | 'value'>>;
              cost: {
                totalAmount: Pick<
                  StorefrontAPI.MoneyV2,
                  'currencyCode' | 'amount'
                >;
                amountPerQuantity: Pick<
                  StorefrontAPI.MoneyV2,
                  'currencyCode' | 'amount'
                >;
                compareAtAmountPerQuantity?: StorefrontAPI.Maybe<
                  Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
                >;
              };
              merchandise: Pick<
                StorefrontAPI.ProductVariant,
                'id' | 'availableForSale' | 'requiresShipping' | 'title'
              > & {
                compareAtPrice?: StorefrontAPI.Maybe<
                  Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
                >;
                price: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
                image?: StorefrontAPI.Maybe<
                  Pick<
                    StorefrontAPI.Image,
                    'id' | 'url' | 'altText' | 'width' | 'height'
                  >
                >;
                product: Pick<
                  StorefrontAPI.Product,
                  'handle' | 'title' | 'id' | 'vendor' | 'productType'
                >;
                selectedOptions: Array<
                  Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
                >;
              };
              parentRelationship?: StorefrontAPI.Maybe<{
                parent: Pick<StorefrontAPI.CartLine, 'id'>;
              }>;
            }
          >;
        })
    >;
  };
  cost: {
    subtotalAmount: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
    totalAmount: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
    totalDutyAmount?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
    >;
    totalTaxAmount?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
    >;
  };
  attributes: Array<Pick<StorefrontAPI.Attribute, 'key' | 'value'>>;
  discountCodes: Array<
    Pick<StorefrontAPI.CartDiscountCode, 'code' | 'applicable'>
  >;
};

export type MenuItemFragment = Pick<
  StorefrontAPI.MenuItem,
  'id' | 'resourceId' | 'tags' | 'title' | 'type' | 'url'
>;

export type ChildMenuItemFragment = Pick<
  StorefrontAPI.MenuItem,
  'id' | 'resourceId' | 'tags' | 'title' | 'type' | 'url'
>;

export type ParentMenuItemFragment = Pick<
  StorefrontAPI.MenuItem,
  'id' | 'resourceId' | 'tags' | 'title' | 'type' | 'url'
> & {
  items: Array<
    Pick<
      StorefrontAPI.MenuItem,
      'id' | 'resourceId' | 'tags' | 'title' | 'type' | 'url'
    >
  >;
};

export type MenuFragment = Pick<StorefrontAPI.Menu, 'id'> & {
  items: Array<
    Pick<
      StorefrontAPI.MenuItem,
      'id' | 'resourceId' | 'tags' | 'title' | 'type' | 'url'
    > & {
      items: Array<
        Pick<
          StorefrontAPI.MenuItem,
          'id' | 'resourceId' | 'tags' | 'title' | 'type' | 'url'
        >
      >;
    }
  >;
};

export type ShopFragment = Pick<
  StorefrontAPI.Shop,
  'id' | 'name' | 'description'
> & {
  primaryDomain: Pick<StorefrontAPI.Domain, 'url'>;
  brand?: StorefrontAPI.Maybe<{
    logo?: StorefrontAPI.Maybe<{
      image?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Image, 'url'>>;
    }>;
  }>;
};

export type HeaderQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  headerMenuHandle: StorefrontAPI.Scalars['String']['input'];
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type HeaderQuery = {
  shop: Pick<StorefrontAPI.Shop, 'id' | 'name' | 'description'> & {
    primaryDomain: Pick<StorefrontAPI.Domain, 'url'>;
    brand?: StorefrontAPI.Maybe<{
      logo?: StorefrontAPI.Maybe<{
        image?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Image, 'url'>>;
      }>;
    }>;
  };
  menu?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Menu, 'id'> & {
      items: Array<
        Pick<
          StorefrontAPI.MenuItem,
          'id' | 'resourceId' | 'tags' | 'title' | 'type' | 'url'
        > & {
          items: Array<
            Pick<
              StorefrontAPI.MenuItem,
              'id' | 'resourceId' | 'tags' | 'title' | 'type' | 'url'
            >
          >;
        }
      >;
    }
  >;
};

export type FooterQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  footerMenuHandle: StorefrontAPI.Scalars['String']['input'];
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type FooterQuery = {
  menu?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Menu, 'id'> & {
      items: Array<
        Pick<
          StorefrontAPI.MenuItem,
          'id' | 'resourceId' | 'tags' | 'title' | 'type' | 'url'
        > & {
          items: Array<
            Pick<
              StorefrontAPI.MenuItem,
              'id' | 'resourceId' | 'tags' | 'title' | 'type' | 'url'
            >
          >;
        }
      >;
    }
  >;
};

export type NavCollectionFragment = Pick<
  StorefrontAPI.Collection,
  'id' | 'handle' | 'title'
> & {
  image?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Image, 'url' | 'altText'>>;
  products: {nodes: Array<Pick<StorefrontAPI.Product, 'id'>>};
};

export type NavProductFragment = Pick<
  StorefrontAPI.Product,
  'id' | 'handle' | 'title'
> & {
  featuredImage?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Image, 'url' | 'altText'>
  >;
  selectedOrFirstAvailableVariant?: StorefrontAPI.Maybe<{
    price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
  }>;
};

export type NavQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  featuredWidgetHandle: StorefrontAPI.Scalars['String']['input'];
  overlayHandle0: StorefrontAPI.Scalars['String']['input'];
  overlayHandle1: StorefrontAPI.Scalars['String']['input'];
  overlayHandle2: StorefrontAPI.Scalars['String']['input'];
  overlayHandle3: StorefrontAPI.Scalars['String']['input'];
}>;

export type NavQuery = {
  allWidgets?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Collection, 'id' | 'handle' | 'title'> & {
      image?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Image, 'url' | 'altText'>>;
      products: {nodes: Array<Pick<StorefrontAPI.Product, 'id'>>};
    }
  >;
  chatWidgetsCurrent?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Collection, 'id' | 'handle' | 'title'> & {
      image?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Image, 'url' | 'altText'>>;
      products: {nodes: Array<Pick<StorefrontAPI.Product, 'id'>>};
    }
  >;
  chatWidgetsLegacy?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Collection, 'id' | 'handle' | 'title'> & {
      image?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Image, 'url' | 'altText'>>;
      products: {nodes: Array<Pick<StorefrontAPI.Product, 'id'>>};
    }
  >;
  goalWidgetsCurrent?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Collection, 'id' | 'handle' | 'title'> & {
      image?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Image, 'url' | 'altText'>>;
      products: {nodes: Array<Pick<StorefrontAPI.Product, 'id'>>};
    }
  >;
  goalWidgetsLegacy?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Collection, 'id' | 'handle' | 'title'> & {
      image?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Image, 'url' | 'altText'>>;
      products: {nodes: Array<Pick<StorefrontAPI.Product, 'id'>>};
    }
  >;
  topWidgets?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Collection, 'id' | 'handle' | 'title'> & {
      thumbs: {
        nodes: Array<
          Pick<StorefrontAPI.Product, 'id' | 'handle' | 'title'> & {
            featuredImage?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.Image, 'url' | 'altText'>
            >;
            selectedOrFirstAvailableVariant?: StorefrontAPI.Maybe<{
              price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
            }>;
          }
        >;
      };
      image?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Image, 'url' | 'altText'>>;
      products: {nodes: Array<Pick<StorefrontAPI.Product, 'id'>>};
    }
  >;
  overlays?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Collection, 'id' | 'handle' | 'title'> & {
      image?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Image, 'url' | 'altText'>>;
      products: {nodes: Array<Pick<StorefrontAPI.Product, 'id'>>};
    }
  >;
  bundles?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Collection, 'id' | 'handle' | 'title'> & {
      image?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Image, 'url' | 'altText'>>;
      products: {nodes: Array<Pick<StorefrontAPI.Product, 'id'>>};
    }
  >;
  featuredWidget?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Product, 'id' | 'handle' | 'title'> & {
      featuredImage?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'url' | 'altText'>
      >;
      selectedOrFirstAvailableVariant?: StorefrontAPI.Maybe<{
        price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      }>;
    }
  >;
  overlayFeatured0?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Product, 'id' | 'handle' | 'title'> & {
      featuredImage?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'url' | 'altText'>
      >;
      selectedOrFirstAvailableVariant?: StorefrontAPI.Maybe<{
        price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      }>;
    }
  >;
  overlayFeatured1?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Product, 'id' | 'handle' | 'title'> & {
      featuredImage?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'url' | 'altText'>
      >;
      selectedOrFirstAvailableVariant?: StorefrontAPI.Maybe<{
        price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      }>;
    }
  >;
  overlayFeatured2?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Product, 'id' | 'handle' | 'title'> & {
      featuredImage?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'url' | 'altText'>
      >;
      selectedOrFirstAvailableVariant?: StorefrontAPI.Maybe<{
        price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      }>;
    }
  >;
  overlayFeatured3?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Product, 'id' | 'handle' | 'title'> & {
      featuredImage?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'url' | 'altText'>
      >;
      selectedOrFirstAvailableVariant?: StorefrontAPI.Maybe<{
        price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      }>;
    }
  >;
};

export type CartApiMutationFragment = Pick<
  StorefrontAPI.Cart,
  'id' | 'totalQuantity' | 'checkoutUrl'
> & {attributes: Array<Pick<StorefrontAPI.Attribute, 'key' | 'value'>>};

export type LiveBannerQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type LiveBannerQuery = {
  shop: {
    metafield?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
  };
};

export type ProductFeedQueryVariables = StorefrontAPI.Exact<{
  first: StorefrontAPI.Scalars['Int']['input'];
  after?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['String']['input']>;
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type ProductFeedQuery = {
  products: {
    pageInfo: Pick<StorefrontAPI.PageInfo, 'hasNextPage' | 'endCursor'>;
    nodes: Array<
      Pick<
        StorefrontAPI.Product,
        | 'id'
        | 'handle'
        | 'title'
        | 'description'
        | 'productType'
        | 'vendor'
        | 'tags'
      > & {
        featuredImage?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.Image, 'url' | 'altText'>
        >;
        images: {nodes: Array<Pick<StorefrontAPI.Image, 'url'>>};
        variants: {
          nodes: Array<
            Pick<StorefrontAPI.ProductVariant, 'id' | 'availableForSale'> & {
              price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
              compareAtPrice?: StorefrontAPI.Maybe<
                Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
              >;
            }
          >;
        };
      }
    >;
  };
};

export type SitemapCountsQueryVariables = StorefrontAPI.Exact<{
  [key: string]: never;
}>;

export type SitemapCountsQuery = {
  products: {
    pagesCount?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Count, 'count'>>;
  };
  collections: {
    pagesCount?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Count, 'count'>>;
  };
  pages: {pagesCount?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Count, 'count'>>};
  blogs: {pagesCount?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Count, 'count'>>};
};

export type SitemapProductsPageQueryVariables = StorefrontAPI.Exact<{
  page: StorefrontAPI.Scalars['Int']['input'];
}>;

export type SitemapProductsPageQuery = {
  sitemap: {
    resources?: StorefrontAPI.Maybe<{
      items: Array<
        | Pick<StorefrontAPI.SitemapResource, 'handle' | 'updatedAt'>
        | Pick<StorefrontAPI.SitemapResourceMetaobject, 'handle' | 'updatedAt'>
      >;
    }>;
  };
};

export type SitemapProductUpdatedAtQueryVariables = StorefrontAPI.Exact<{
  cursor?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['String']['input']>;
}>;

export type SitemapProductUpdatedAtQuery = {
  products: {
    nodes: Array<Pick<StorefrontAPI.Product, 'handle' | 'updatedAt'>>;
    pageInfo: Pick<StorefrontAPI.PageInfo, 'hasNextPage' | 'endCursor'>;
  };
};

export type SitemapCollectionsPageQueryVariables = StorefrontAPI.Exact<{
  page: StorefrontAPI.Scalars['Int']['input'];
}>;

export type SitemapCollectionsPageQuery = {
  sitemap: {
    resources?: StorefrontAPI.Maybe<{
      items: Array<
        | Pick<StorefrontAPI.SitemapResource, 'handle' | 'updatedAt'>
        | Pick<StorefrontAPI.SitemapResourceMetaobject, 'handle' | 'updatedAt'>
      >;
    }>;
  };
};

export type SitemapPagesPageQueryVariables = StorefrontAPI.Exact<{
  page: StorefrontAPI.Scalars['Int']['input'];
}>;

export type SitemapPagesPageQuery = {
  sitemap: {
    resources?: StorefrontAPI.Maybe<{
      items: Array<
        | Pick<StorefrontAPI.SitemapResource, 'handle' | 'updatedAt'>
        | Pick<StorefrontAPI.SitemapResourceMetaobject, 'handle' | 'updatedAt'>
      >;
    }>;
  };
};

export type SitemapBlogsPageQueryVariables = StorefrontAPI.Exact<{
  page: StorefrontAPI.Scalars['Int']['input'];
}>;

export type SitemapBlogsPageQuery = {
  sitemap: {
    resources?: StorefrontAPI.Maybe<{
      items: Array<
        | Pick<StorefrontAPI.SitemapResource, 'handle' | 'updatedAt'>
        | Pick<StorefrontAPI.SitemapResourceMetaobject, 'handle' | 'updatedAt'>
      >;
    }>;
  };
};

export type SitemapBlogHandlesQueryVariables = StorefrontAPI.Exact<{
  cursor?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['String']['input']>;
}>;

export type SitemapBlogHandlesQuery = {
  blogs: {
    nodes: Array<Pick<StorefrontAPI.Blog, 'handle'>>;
    pageInfo: Pick<StorefrontAPI.PageInfo, 'hasNextPage' | 'endCursor'>;
  };
};

export type SitemapBlogArticlesQueryVariables = StorefrontAPI.Exact<{
  blogHandle: StorefrontAPI.Scalars['String']['input'];
  cursor?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['String']['input']>;
}>;

export type SitemapBlogArticlesQuery = {
  blog?: StorefrontAPI.Maybe<{
    articles: {
      nodes: Array<Pick<StorefrontAPI.Article, 'handle' | 'publishedAt'>>;
      pageInfo: Pick<StorefrontAPI.PageInfo, 'hasNextPage' | 'endCursor'>;
    };
  }>;
};

export type SitemapVideoProductsQueryVariables = StorefrontAPI.Exact<{
  [key: string]: never;
}>;

export type SitemapVideoProductsQuery = {
  products: {
    nodes: Array<
      Pick<StorefrontAPI.Product, 'handle' | 'title'> & {
        media: {
          nodes: Array<
            | {__typename: 'ExternalVideo' | 'MediaImage' | 'Model3d'}
            | ({__typename: 'Video'} & Pick<
                StorefrontAPI.Video,
                'id' | 'alt'
              > & {
                  previewImage?: StorefrontAPI.Maybe<
                    Pick<StorefrontAPI.Image, 'url'>
                  >;
                  sources: Array<
                    Pick<
                      StorefrontAPI.VideoSource,
                      'url' | 'mimeType' | 'format' | 'width' | 'height'
                    >
                  >;
                })
          >;
        };
      }
    >;
  };
};

export type NewsletterSignupMutationVariables = StorefrontAPI.Exact<{
  input: StorefrontAPI.CustomerCreateInput;
}>;

export type NewsletterSignupMutation = {
  customerCreate?: StorefrontAPI.Maybe<{
    customer?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Customer, 'id'>>;
    customerUserErrors: Array<
      Pick<StorefrontAPI.CustomerUserError, 'code' | 'field' | 'message'>
    >;
  }>;
};

export type LlmsTxtTopWidgetsQueryVariables = StorefrontAPI.Exact<{
  handle: StorefrontAPI.Scalars['String']['input'];
}>;

export type LlmsTxtTopWidgetsQuery = {
  collection?: StorefrontAPI.Maybe<{
    products: {
      nodes: Array<
        Pick<StorefrontAPI.Product, 'title' | 'handle' | 'productType'> & {
          seo: Pick<StorefrontAPI.Seo, 'title'>;
          worksWith?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.Metafield, 'value'>
          >;
        }
      >;
    };
  }>;
};

export type LlmsTxtFallbackProductsQueryVariables = StorefrontAPI.Exact<{
  handle0: StorefrontAPI.Scalars['String']['input'];
  handle1: StorefrontAPI.Scalars['String']['input'];
  handle2: StorefrontAPI.Scalars['String']['input'];
  handle3: StorefrontAPI.Scalars['String']['input'];
  handle4: StorefrontAPI.Scalars['String']['input'];
  handle5: StorefrontAPI.Scalars['String']['input'];
  handle6: StorefrontAPI.Scalars['String']['input'];
  handle7: StorefrontAPI.Scalars['String']['input'];
}>;

export type LlmsTxtFallbackProductsQuery = {
  product0?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Product, 'title' | 'handle' | 'productType'> & {
      seo: Pick<StorefrontAPI.Seo, 'title'>;
      worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
    }
  >;
  product1?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Product, 'title' | 'handle' | 'productType'> & {
      seo: Pick<StorefrontAPI.Seo, 'title'>;
      worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
    }
  >;
  product2?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Product, 'title' | 'handle' | 'productType'> & {
      seo: Pick<StorefrontAPI.Seo, 'title'>;
      worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
    }
  >;
  product3?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Product, 'title' | 'handle' | 'productType'> & {
      seo: Pick<StorefrontAPI.Seo, 'title'>;
      worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
    }
  >;
  product4?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Product, 'title' | 'handle' | 'productType'> & {
      seo: Pick<StorefrontAPI.Seo, 'title'>;
      worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
    }
  >;
  product5?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Product, 'title' | 'handle' | 'productType'> & {
      seo: Pick<StorefrontAPI.Seo, 'title'>;
      worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
    }
  >;
  product6?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Product, 'title' | 'handle' | 'productType'> & {
      seo: Pick<StorefrontAPI.Seo, 'title'>;
      worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
    }
  >;
  product7?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Product, 'title' | 'handle' | 'productType'> & {
      seo: Pick<StorefrontAPI.Seo, 'title'>;
      worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
    }
  >;
};

export type LlmsTxtAllProductsQueryVariables = StorefrontAPI.Exact<{
  cursor?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['String']['input']>;
}>;

export type LlmsTxtAllProductsQuery = {
  products: {
    pageInfo: Pick<StorefrontAPI.PageInfo, 'hasNextPage' | 'endCursor'>;
    nodes: Array<
      Pick<StorefrontAPI.Product, 'title' | 'handle' | 'productType'> & {
        seo: Pick<StorefrontAPI.Seo, 'title'>;
        worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
      }
    >;
  };
};

export type LlmsTxtCollectionsQueryVariables = StorefrontAPI.Exact<{
  [key: string]: never;
}>;

export type LlmsTxtCollectionsQuery = {
  collections: {
    nodes: Array<Pick<StorefrontAPI.Collection, 'title' | 'handle'>>;
  };
};

export type RecommendedProductFragment = Pick<
  StorefrontAPI.Product,
  'id' | 'title' | 'productType' | 'handle' | 'tags'
> & {
  worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
  gifSupport?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
  priceRange: {
    minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
  };
  compareAtPriceRange: {
    minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
  };
  featuredImage?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText'>
  >;
  media: {
    nodes: Array<
      | {__typename: 'ExternalVideo' | 'MediaImage' | 'Model3d'}
      | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
            previewImage?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.Image, 'url'>
            >;
            sources: Array<
              Pick<
                StorefrontAPI.VideoSource,
                'url' | 'mimeType' | 'format' | 'width' | 'height'
              >
            >;
          })
    >;
  };
};

export type BundlePromoTilesQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  handle0: StorefrontAPI.Scalars['String']['input'];
  handle1: StorefrontAPI.Scalars['String']['input'];
  handle2: StorefrontAPI.Scalars['String']['input'];
  handle3: StorefrontAPI.Scalars['String']['input'];
  handle4: StorefrontAPI.Scalars['String']['input'];
  handle5: StorefrontAPI.Scalars['String']['input'];
}>;

export type BundlePromoTilesQuery = {
  product0?: StorefrontAPI.Maybe<
    Pick<
      StorefrontAPI.Product,
      'id' | 'title' | 'handle' | 'productType' | 'tags'
    > & {
      featuredImage?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText' | 'width' | 'height'>
      >;
    }
  >;
  product1?: StorefrontAPI.Maybe<
    Pick<
      StorefrontAPI.Product,
      'id' | 'title' | 'handle' | 'productType' | 'tags'
    > & {
      featuredImage?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText' | 'width' | 'height'>
      >;
    }
  >;
  product2?: StorefrontAPI.Maybe<
    Pick<
      StorefrontAPI.Product,
      'id' | 'title' | 'handle' | 'productType' | 'tags'
    > & {
      featuredImage?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText' | 'width' | 'height'>
      >;
    }
  >;
  product3?: StorefrontAPI.Maybe<
    Pick<
      StorefrontAPI.Product,
      'id' | 'title' | 'handle' | 'productType' | 'tags'
    > & {
      featuredImage?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText' | 'width' | 'height'>
      >;
    }
  >;
  product4?: StorefrontAPI.Maybe<
    Pick<
      StorefrontAPI.Product,
      'id' | 'title' | 'handle' | 'productType' | 'tags'
    > & {
      featuredImage?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText' | 'width' | 'height'>
      >;
    }
  >;
  product5?: StorefrontAPI.Maybe<
    Pick<
      StorefrontAPI.Product,
      'id' | 'title' | 'handle' | 'productType' | 'tags'
    > & {
      featuredImage?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText' | 'width' | 'height'>
      >;
    }
  >;
};

export type BundlePromoTileFragment = Pick<
  StorefrontAPI.Product,
  'id' | 'title' | 'handle' | 'productType' | 'tags'
> & {
  featuredImage?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText' | 'width' | 'height'>
  >;
};

export type RecommendedProductsQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  handle0: StorefrontAPI.Scalars['String']['input'];
  handle1: StorefrontAPI.Scalars['String']['input'];
  handle2: StorefrontAPI.Scalars['String']['input'];
  handle3: StorefrontAPI.Scalars['String']['input'];
  handle4: StorefrontAPI.Scalars['String']['input'];
  handle5: StorefrontAPI.Scalars['String']['input'];
  handle6: StorefrontAPI.Scalars['String']['input'];
  handle7: StorefrontAPI.Scalars['String']['input'];
}>;

export type RecommendedProductsQuery = {
  product0?: StorefrontAPI.Maybe<
    Pick<
      StorefrontAPI.Product,
      'id' | 'title' | 'productType' | 'handle' | 'tags'
    > & {
      worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
      gifSupport?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
      priceRange: {
        minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      };
      compareAtPriceRange: {
        minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      };
      featuredImage?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText'>
      >;
      media: {
        nodes: Array<
          | {__typename: 'ExternalVideo' | 'MediaImage' | 'Model3d'}
          | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
                previewImage?: StorefrontAPI.Maybe<
                  Pick<StorefrontAPI.Image, 'url'>
                >;
                sources: Array<
                  Pick<
                    StorefrontAPI.VideoSource,
                    'url' | 'mimeType' | 'format' | 'width' | 'height'
                  >
                >;
              })
        >;
      };
    }
  >;
  product1?: StorefrontAPI.Maybe<
    Pick<
      StorefrontAPI.Product,
      'id' | 'title' | 'productType' | 'handle' | 'tags'
    > & {
      worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
      gifSupport?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
      priceRange: {
        minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      };
      compareAtPriceRange: {
        minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      };
      featuredImage?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText'>
      >;
      media: {
        nodes: Array<
          | {__typename: 'ExternalVideo' | 'MediaImage' | 'Model3d'}
          | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
                previewImage?: StorefrontAPI.Maybe<
                  Pick<StorefrontAPI.Image, 'url'>
                >;
                sources: Array<
                  Pick<
                    StorefrontAPI.VideoSource,
                    'url' | 'mimeType' | 'format' | 'width' | 'height'
                  >
                >;
              })
        >;
      };
    }
  >;
  product2?: StorefrontAPI.Maybe<
    Pick<
      StorefrontAPI.Product,
      'id' | 'title' | 'productType' | 'handle' | 'tags'
    > & {
      worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
      gifSupport?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
      priceRange: {
        minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      };
      compareAtPriceRange: {
        minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      };
      featuredImage?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText'>
      >;
      media: {
        nodes: Array<
          | {__typename: 'ExternalVideo' | 'MediaImage' | 'Model3d'}
          | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
                previewImage?: StorefrontAPI.Maybe<
                  Pick<StorefrontAPI.Image, 'url'>
                >;
                sources: Array<
                  Pick<
                    StorefrontAPI.VideoSource,
                    'url' | 'mimeType' | 'format' | 'width' | 'height'
                  >
                >;
              })
        >;
      };
    }
  >;
  product3?: StorefrontAPI.Maybe<
    Pick<
      StorefrontAPI.Product,
      'id' | 'title' | 'productType' | 'handle' | 'tags'
    > & {
      worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
      gifSupport?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
      priceRange: {
        minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      };
      compareAtPriceRange: {
        minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      };
      featuredImage?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText'>
      >;
      media: {
        nodes: Array<
          | {__typename: 'ExternalVideo' | 'MediaImage' | 'Model3d'}
          | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
                previewImage?: StorefrontAPI.Maybe<
                  Pick<StorefrontAPI.Image, 'url'>
                >;
                sources: Array<
                  Pick<
                    StorefrontAPI.VideoSource,
                    'url' | 'mimeType' | 'format' | 'width' | 'height'
                  >
                >;
              })
        >;
      };
    }
  >;
  product4?: StorefrontAPI.Maybe<
    Pick<
      StorefrontAPI.Product,
      'id' | 'title' | 'productType' | 'handle' | 'tags'
    > & {
      worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
      gifSupport?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
      priceRange: {
        minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      };
      compareAtPriceRange: {
        minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      };
      featuredImage?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText'>
      >;
      media: {
        nodes: Array<
          | {__typename: 'ExternalVideo' | 'MediaImage' | 'Model3d'}
          | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
                previewImage?: StorefrontAPI.Maybe<
                  Pick<StorefrontAPI.Image, 'url'>
                >;
                sources: Array<
                  Pick<
                    StorefrontAPI.VideoSource,
                    'url' | 'mimeType' | 'format' | 'width' | 'height'
                  >
                >;
              })
        >;
      };
    }
  >;
  product5?: StorefrontAPI.Maybe<
    Pick<
      StorefrontAPI.Product,
      'id' | 'title' | 'productType' | 'handle' | 'tags'
    > & {
      worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
      gifSupport?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
      priceRange: {
        minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      };
      compareAtPriceRange: {
        minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      };
      featuredImage?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText'>
      >;
      media: {
        nodes: Array<
          | {__typename: 'ExternalVideo' | 'MediaImage' | 'Model3d'}
          | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
                previewImage?: StorefrontAPI.Maybe<
                  Pick<StorefrontAPI.Image, 'url'>
                >;
                sources: Array<
                  Pick<
                    StorefrontAPI.VideoSource,
                    'url' | 'mimeType' | 'format' | 'width' | 'height'
                  >
                >;
              })
        >;
      };
    }
  >;
  product6?: StorefrontAPI.Maybe<
    Pick<
      StorefrontAPI.Product,
      'id' | 'title' | 'productType' | 'handle' | 'tags'
    > & {
      worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
      gifSupport?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
      priceRange: {
        minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      };
      compareAtPriceRange: {
        minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      };
      featuredImage?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText'>
      >;
      media: {
        nodes: Array<
          | {__typename: 'ExternalVideo' | 'MediaImage' | 'Model3d'}
          | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
                previewImage?: StorefrontAPI.Maybe<
                  Pick<StorefrontAPI.Image, 'url'>
                >;
                sources: Array<
                  Pick<
                    StorefrontAPI.VideoSource,
                    'url' | 'mimeType' | 'format' | 'width' | 'height'
                  >
                >;
              })
        >;
      };
    }
  >;
  product7?: StorefrontAPI.Maybe<
    Pick<
      StorefrontAPI.Product,
      'id' | 'title' | 'productType' | 'handle' | 'tags'
    > & {
      worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
      gifSupport?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
      priceRange: {
        minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      };
      compareAtPriceRange: {
        minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      };
      featuredImage?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText'>
      >;
      media: {
        nodes: Array<
          | {__typename: 'ExternalVideo' | 'MediaImage' | 'Model3d'}
          | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
                previewImage?: StorefrontAPI.Maybe<
                  Pick<StorefrontAPI.Image, 'url'>
                >;
                sources: Array<
                  Pick<
                    StorefrontAPI.VideoSource,
                    'url' | 'mimeType' | 'format' | 'width' | 'height'
                  >
                >;
              })
        >;
      };
    }
  >;
};

export type NewArrivalsQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  first: StorefrontAPI.Scalars['Int']['input'];
  query?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['String']['input']>;
  freshHandle: StorefrontAPI.Scalars['String']['input'];
  freshFirst: StorefrontAPI.Scalars['Int']['input'];
}>;

export type NewArrivalsQuery = {
  fresh?: StorefrontAPI.Maybe<{
    products: {
      nodes: Array<
        Pick<
          StorefrontAPI.Product,
          'id' | 'title' | 'productType' | 'handle' | 'tags'
        > & {
          worksWith?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.Metafield, 'value'>
          >;
          gifSupport?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.Metafield, 'value'>
          >;
          priceRange: {
            minVariantPrice: Pick<
              StorefrontAPI.MoneyV2,
              'amount' | 'currencyCode'
            >;
          };
          compareAtPriceRange: {
            minVariantPrice: Pick<
              StorefrontAPI.MoneyV2,
              'amount' | 'currencyCode'
            >;
          };
          featuredImage?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText'>
          >;
          media: {
            nodes: Array<
              | {__typename: 'ExternalVideo' | 'MediaImage' | 'Model3d'}
              | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
                    previewImage?: StorefrontAPI.Maybe<
                      Pick<StorefrontAPI.Image, 'url'>
                    >;
                    sources: Array<
                      Pick<
                        StorefrontAPI.VideoSource,
                        'url' | 'mimeType' | 'format' | 'width' | 'height'
                      >
                    >;
                  })
            >;
          };
        }
      >;
    };
  }>;
  products: {
    nodes: Array<
      Pick<
        StorefrontAPI.Product,
        'id' | 'title' | 'productType' | 'handle' | 'tags'
      > & {
        worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
        gifSupport?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.Metafield, 'value'>
        >;
        priceRange: {
          minVariantPrice: Pick<
            StorefrontAPI.MoneyV2,
            'amount' | 'currencyCode'
          >;
        };
        compareAtPriceRange: {
          minVariantPrice: Pick<
            StorefrontAPI.MoneyV2,
            'amount' | 'currencyCode'
          >;
        };
        featuredImage?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText'>
        >;
        media: {
          nodes: Array<
            | {__typename: 'ExternalVideo' | 'MediaImage' | 'Model3d'}
            | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
                  previewImage?: StorefrontAPI.Maybe<
                    Pick<StorefrontAPI.Image, 'url'>
                  >;
                  sources: Array<
                    Pick<
                      StorefrontAPI.VideoSource,
                      'url' | 'mimeType' | 'format' | 'width' | 'height'
                    >
                  >;
                })
          >;
        };
      }
    >;
  };
};

export type KitOrOverlayPackProductFragment = Pick<
  StorefrontAPI.Product,
  'id' | 'title' | 'handle' | 'productType' | 'description' | 'createdAt'
> & {
  featuredImage?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText'>
  >;
  selectedOrFirstAvailableVariant?: StorefrontAPI.Maybe<{
    price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
    compareAtPrice?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
    >;
  }>;
};

export type KitsAndOverlayPacksQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type KitsAndOverlayPacksQuery = {
  bundlesNewest?: StorefrontAPI.Maybe<{
    products: {
      nodes: Array<
        Pick<
          StorefrontAPI.Product,
          | 'id'
          | 'title'
          | 'handle'
          | 'productType'
          | 'description'
          | 'createdAt'
        > & {
          featuredImage?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText'>
          >;
          selectedOrFirstAvailableVariant?: StorefrontAPI.Maybe<{
            price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
            compareAtPrice?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
            >;
          }>;
        }
      >;
    };
  }>;
  bundlesBest?: StorefrontAPI.Maybe<{
    products: {
      nodes: Array<
        Pick<
          StorefrontAPI.Product,
          | 'id'
          | 'title'
          | 'handle'
          | 'productType'
          | 'description'
          | 'createdAt'
        > & {
          featuredImage?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText'>
          >;
          selectedOrFirstAvailableVariant?: StorefrontAPI.Maybe<{
            price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
            compareAtPrice?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
            >;
          }>;
        }
      >;
    };
  }>;
  overlaysNewest?: StorefrontAPI.Maybe<{
    products: {
      nodes: Array<
        Pick<
          StorefrontAPI.Product,
          | 'id'
          | 'title'
          | 'handle'
          | 'productType'
          | 'description'
          | 'createdAt'
        > & {
          featuredImage?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText'>
          >;
          selectedOrFirstAvailableVariant?: StorefrontAPI.Maybe<{
            price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
            compareAtPrice?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
            >;
          }>;
        }
      >;
    };
  }>;
  overlaysBest?: StorefrontAPI.Maybe<{
    products: {
      nodes: Array<
        Pick<
          StorefrontAPI.Product,
          | 'id'
          | 'title'
          | 'handle'
          | 'productType'
          | 'description'
          | 'createdAt'
        > & {
          featuredImage?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText'>
          >;
          selectedOrFirstAvailableVariant?: StorefrontAPI.Maybe<{
            price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
            compareAtPrice?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
            >;
          }>;
        }
      >;
    };
  }>;
};

export type HomeLatestArticlesQueryVariables = StorefrontAPI.Exact<{
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type HomeLatestArticlesQuery = {
  blog?: StorefrontAPI.Maybe<{
    articles: {
      nodes: Array<
        Pick<
          StorefrontAPI.Article,
          'handle' | 'title' | 'publishedAt' | 'excerpt' | 'content'
        > & {
          image?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.Image, 'url' | 'altText' | 'width' | 'height'>
          >;
        }
      >;
    };
  }>;
};

export type HalloweenCollectionQueryVariables = StorefrontAPI.Exact<{
  handle: StorefrontAPI.Scalars['String']['input'];
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type HalloweenCollectionQuery = {
  collection?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Collection, 'id'> & {
      products: {
        nodes: Array<
          Pick<
            StorefrontAPI.Product,
            'id' | 'title' | 'handle' | 'productType' | 'tags'
          > & {
            worksWith?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.Metafield, 'value'>
            >;
            gifSupport?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.Metafield, 'value'>
            >;
            priceRange: {
              minVariantPrice: Pick<
                StorefrontAPI.MoneyV2,
                'amount' | 'currencyCode'
              >;
            };
            compareAtPriceRange: {
              minVariantPrice: Pick<
                StorefrontAPI.MoneyV2,
                'amount' | 'currencyCode'
              >;
            };
            featuredImage?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText'>
            >;
            media: {
              nodes: Array<
                | {__typename: 'ExternalVideo' | 'MediaImage' | 'Model3d'}
                | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
                      previewImage?: StorefrontAPI.Maybe<
                        Pick<StorefrontAPI.Image, 'url'>
                      >;
                      sources: Array<
                        Pick<
                          StorefrontAPI.VideoSource,
                          'url' | 'mimeType' | 'format' | 'width' | 'height'
                        >
                      >;
                    })
              >;
            };
          }
        >;
      };
    }
  >;
};

export type AgentProductFragment = Pick<
  StorefrontAPI.Product,
  'id' | 'title' | 'handle' | 'productType'
> & {
  worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
  priceRange: {
    minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
  };
  selectedOrFirstAvailableVariant?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.ProductVariant, 'id' | 'availableForSale'>
  >;
};

export type AgentSearchQueryVariables = StorefrontAPI.Exact<{
  query: StorefrontAPI.Scalars['String']['input'];
  first: StorefrontAPI.Scalars['Int']['input'];
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type AgentSearchQuery = {
  products: {
    nodes: Array<
      Pick<StorefrontAPI.Product, 'id' | 'title' | 'handle' | 'productType'> & {
        worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
        priceRange: {
          minVariantPrice: Pick<
            StorefrontAPI.MoneyV2,
            'amount' | 'currencyCode'
          >;
        };
        selectedOrFirstAvailableVariant?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.ProductVariant, 'id' | 'availableForSale'>
        >;
      }
    >;
  };
};

export type AgentProductByHandleQueryVariables = StorefrontAPI.Exact<{
  handle: StorefrontAPI.Scalars['String']['input'];
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type AgentProductByHandleQuery = {
  product?: StorefrontAPI.Maybe<
    Pick<
      StorefrontAPI.Product,
      'description' | 'id' | 'title' | 'handle' | 'productType'
    > & {
      worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
      priceRange: {
        minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      };
      selectedOrFirstAvailableVariant?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.ProductVariant, 'id' | 'availableForSale'>
      >;
    }
  >;
};

export type BundleQuickViewQueryVariables = StorefrontAPI.Exact<{
  handle: StorefrontAPI.Scalars['String']['input'];
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type BundleQuickViewQuery = {
  product?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Product, 'handle' | 'title' | 'description'> & {
      featuredImage?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'url' | 'altText'>
      >;
      media: {
        nodes: Array<
          | {__typename: 'ExternalVideo' | 'Model3d'}
          | ({__typename: 'MediaImage'} & {
              image?: StorefrontAPI.Maybe<
                Pick<StorefrontAPI.Image, 'url' | 'altText'>
              >;
            })
          | ({__typename: 'Video'} & {
              previewImage?: StorefrontAPI.Maybe<
                Pick<StorefrontAPI.Image, 'url'>
              >;
              sources: Array<
                Pick<
                  StorefrontAPI.VideoSource,
                  'url' | 'mimeType' | 'format' | 'width' | 'height'
                >
              >;
            })
        >;
      };
    }
  >;
};

export type MoneyCrossSellFragment = Pick<
  StorefrontAPI.MoneyV2,
  'amount' | 'currencyCode'
>;

export type CrossSellItemFragment = Pick<
  StorefrontAPI.Product,
  'id' | 'handle' | 'title' | 'productType' | 'tags'
> & {
  worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
  gifSupport?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
  featuredImage?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Image, 'id' | 'altText' | 'url'>
  >;
  priceRange: {
    minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
    maxVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
  };
  compareAtPriceRange: {
    minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
  };
};

export type BlogShelfFallbackQueryVariables = StorefrontAPI.Exact<{
  first: StorefrontAPI.Scalars['Int']['input'];
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type BlogShelfFallbackQuery = {
  products: {
    nodes: Array<
      Pick<
        StorefrontAPI.Product,
        'id' | 'handle' | 'title' | 'productType' | 'tags'
      > & {
        worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
        gifSupport?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.Metafield, 'value'>
        >;
        featuredImage?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.Image, 'id' | 'altText' | 'url'>
        >;
        priceRange: {
          minVariantPrice: Pick<
            StorefrontAPI.MoneyV2,
            'amount' | 'currencyCode'
          >;
          maxVariantPrice: Pick<
            StorefrontAPI.MoneyV2,
            'amount' | 'currencyCode'
          >;
        };
        compareAtPriceRange: {
          minVariantPrice: Pick<
            StorefrontAPI.MoneyV2,
            'amount' | 'currencyCode'
          >;
        };
      }
    >;
  };
};

export type BlogCrossSellQueryVariables = StorefrontAPI.Exact<{
  query: StorefrontAPI.Scalars['String']['input'];
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type BlogCrossSellQuery = {
  products: {
    nodes: Array<
      Pick<
        StorefrontAPI.Product,
        'id' | 'handle' | 'title' | 'productType' | 'tags'
      > & {
        worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
        gifSupport?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.Metafield, 'value'>
        >;
        featuredImage?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.Image, 'id' | 'altText' | 'url'>
        >;
        priceRange: {
          minVariantPrice: Pick<
            StorefrontAPI.MoneyV2,
            'amount' | 'currencyCode'
          >;
          maxVariantPrice: Pick<
            StorefrontAPI.MoneyV2,
            'amount' | 'currencyCode'
          >;
        };
        compareAtPriceRange: {
          minVariantPrice: Pick<
            StorefrontAPI.MoneyV2,
            'amount' | 'currencyCode'
          >;
        };
      }
    >;
  };
};

export type ArticleQueryVariables = StorefrontAPI.Exact<{
  articleHandle: StorefrontAPI.Scalars['String']['input'];
  blogHandle: StorefrontAPI.Scalars['String']['input'];
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type ArticleQuery = {
  blog?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Blog, 'handle'> & {
      articleByHandle?: StorefrontAPI.Maybe<
        Pick<
          StorefrontAPI.Article,
          'handle' | 'title' | 'tags' | 'contentHtml' | 'publishedAt'
        > & {
          author?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.ArticleAuthor, 'name'>
          >;
          image?: StorefrontAPI.Maybe<
            Pick<
              StorefrontAPI.Image,
              'id' | 'altText' | 'url' | 'width' | 'height'
            >
          >;
          seo?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.Seo, 'description' | 'title'>
          >;
        }
      >;
    }
  >;
};

export type BlogQueryVariables = StorefrontAPI.Exact<{
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  blogHandle: StorefrontAPI.Scalars['String']['input'];
  first?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Int']['input']>;
  last?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Int']['input']>;
  startCursor?: StorefrontAPI.InputMaybe<
    StorefrontAPI.Scalars['String']['input']
  >;
  endCursor?: StorefrontAPI.InputMaybe<
    StorefrontAPI.Scalars['String']['input']
  >;
}>;

export type BlogQuery = {
  blog?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Blog, 'title' | 'handle'> & {
      seo?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Seo, 'title' | 'description'>
      >;
      articles: {
        nodes: Array<
          Pick<
            StorefrontAPI.Article,
            | 'contentHtml'
            | 'excerpt'
            | 'tags'
            | 'handle'
            | 'id'
            | 'publishedAt'
            | 'title'
          > & {
            author?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.ArticleAuthor, 'name'>
            >;
            image?: StorefrontAPI.Maybe<
              Pick<
                StorefrontAPI.Image,
                'id' | 'altText' | 'url' | 'width' | 'height'
              >
            >;
            blog: Pick<StorefrontAPI.Blog, 'handle'>;
          }
        >;
        pageInfo: Pick<
          StorefrontAPI.PageInfo,
          'hasPreviousPage' | 'hasNextPage' | 'endCursor' | 'startCursor'
        >;
      };
    }
  >;
};

export type ArticleItemFragment = Pick<
  StorefrontAPI.Article,
  'contentHtml' | 'excerpt' | 'tags' | 'handle' | 'id' | 'publishedAt' | 'title'
> & {
  author?: StorefrontAPI.Maybe<Pick<StorefrontAPI.ArticleAuthor, 'name'>>;
  image?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Image, 'id' | 'altText' | 'url' | 'width' | 'height'>
  >;
  blog: Pick<StorefrontAPI.Blog, 'handle'>;
};

export type BlogsQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  endCursor?: StorefrontAPI.InputMaybe<
    StorefrontAPI.Scalars['String']['input']
  >;
  first?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Int']['input']>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  last?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Int']['input']>;
  startCursor?: StorefrontAPI.InputMaybe<
    StorefrontAPI.Scalars['String']['input']
  >;
}>;

export type BlogsQuery = {
  blogs: {
    pageInfo: Pick<
      StorefrontAPI.PageInfo,
      'hasNextPage' | 'hasPreviousPage' | 'startCursor' | 'endCursor'
    >;
    nodes: Array<
      Pick<StorefrontAPI.Blog, 'title' | 'handle'> & {
        seo?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.Seo, 'title' | 'description'>
        >;
      }
    >;
  };
};

export type BundleWidgetFragment = Pick<
  StorefrontAPI.Product,
  'id' | 'handle' | 'title' | 'productType' | 'createdAt'
> & {
  featuredImage?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Image, 'url' | 'altText' | 'width' | 'height'>
  >;
  variants: {
    nodes: Array<
      Pick<StorefrontAPI.ProductVariant, 'id' | 'availableForSale'> & {
        price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      }
    >;
  };
};

export type BundleWidgetsQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type BundleWidgetsQuery = {
  widgets?: StorefrontAPI.Maybe<{
    products: {
      nodes: Array<
        Pick<
          StorefrontAPI.Product,
          'id' | 'handle' | 'title' | 'productType' | 'createdAt'
        > & {
          featuredImage?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.Image, 'url' | 'altText' | 'width' | 'height'>
          >;
          variants: {
            nodes: Array<
              Pick<StorefrontAPI.ProductVariant, 'id' | 'availableForSale'> & {
                price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
              }
            >;
          };
        }
      >;
    };
  }>;
};

export type BundleEligibleQueryVariables = StorefrontAPI.Exact<{
  query: StorefrontAPI.Scalars['String']['input'];
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type BundleEligibleQuery = {
  eligible: {
    nodes: Array<
      Pick<
        StorefrontAPI.Product,
        'id' | 'handle' | 'title' | 'productType' | 'createdAt'
      > & {
        featuredImage?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.Image, 'url' | 'altText' | 'width' | 'height'>
        >;
        variants: {
          nodes: Array<
            Pick<StorefrontAPI.ProductVariant, 'id' | 'availableForSale'> & {
              price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
            }
          >;
        };
      }
    >;
  };
};

export type BundleKitsQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type BundleKitsQuery = {
  kits?: StorefrontAPI.Maybe<{
    products: {
      nodes: Array<
        Pick<StorefrontAPI.Product, 'handle' | 'title'> & {
          featuredImage?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.Image, 'url' | 'altText'>
          >;
          priceRange: {
            minVariantPrice: Pick<
              StorefrontAPI.MoneyV2,
              'amount' | 'currencyCode'
            >;
          };
        }
      >;
    };
  }>;
};

export type MoneyProductItemFragment = Pick<
  StorefrontAPI.MoneyV2,
  'amount' | 'currencyCode'
>;

export type ProductItemFragment = Pick<
  StorefrontAPI.Product,
  'id' | 'handle' | 'title' | 'productType' | 'tags'
> & {
  worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
  gifSupport?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
  featuredImage?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Image, 'id' | 'altText' | 'url'>
  >;
  media: {
    nodes: Array<
      | {__typename: 'ExternalVideo' | 'MediaImage' | 'Model3d'}
      | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
            previewImage?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.Image, 'url'>
            >;
            sources: Array<
              Pick<
                StorefrontAPI.VideoSource,
                'url' | 'mimeType' | 'format' | 'width' | 'height'
              >
            >;
          })
    >;
  };
  priceRange: {
    minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
    maxVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
  };
  compareAtPriceRange: {
    minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
  };
};

export type CollectionQueryVariables = StorefrontAPI.Exact<{
  handle: StorefrontAPI.Scalars['String']['input'];
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  first?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Int']['input']>;
  last?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Int']['input']>;
  startCursor?: StorefrontAPI.InputMaybe<
    StorefrontAPI.Scalars['String']['input']
  >;
  endCursor?: StorefrontAPI.InputMaybe<
    StorefrontAPI.Scalars['String']['input']
  >;
}>;

export type CollectionQuery = {
  collection?: StorefrontAPI.Maybe<
    Pick<
      StorefrontAPI.Collection,
      'id' | 'handle' | 'title' | 'description' | 'descriptionHtml'
    > & {
      image?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'url' | 'width' | 'height'>
      >;
      seo: Pick<StorefrontAPI.Seo, 'title' | 'description'>;
      h1?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
      intro?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
      faq?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
      products: {
        nodes: Array<
          Pick<
            StorefrontAPI.Product,
            'id' | 'handle' | 'title' | 'productType' | 'tags'
          > & {
            worksWith?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.Metafield, 'value'>
            >;
            gifSupport?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.Metafield, 'value'>
            >;
            featuredImage?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.Image, 'id' | 'altText' | 'url'>
            >;
            media: {
              nodes: Array<
                | {__typename: 'ExternalVideo' | 'MediaImage' | 'Model3d'}
                | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
                      previewImage?: StorefrontAPI.Maybe<
                        Pick<StorefrontAPI.Image, 'url'>
                      >;
                      sources: Array<
                        Pick<
                          StorefrontAPI.VideoSource,
                          'url' | 'mimeType' | 'format' | 'width' | 'height'
                        >
                      >;
                    })
              >;
            };
            priceRange: {
              minVariantPrice: Pick<
                StorefrontAPI.MoneyV2,
                'amount' | 'currencyCode'
              >;
              maxVariantPrice: Pick<
                StorefrontAPI.MoneyV2,
                'amount' | 'currencyCode'
              >;
            };
            compareAtPriceRange: {
              minVariantPrice: Pick<
                StorefrontAPI.MoneyV2,
                'amount' | 'currencyCode'
              >;
            };
          }
        >;
        pageInfo: Pick<
          StorefrontAPI.PageInfo,
          'hasPreviousPage' | 'hasNextPage' | 'endCursor' | 'startCursor'
        >;
      };
    }
  >;
};

export type CollectionFragment = Pick<
  StorefrontAPI.Collection,
  'id' | 'title' | 'handle'
> & {
  image?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText' | 'width' | 'height'>
  >;
};

export type StoreCollectionsQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  endCursor?: StorefrontAPI.InputMaybe<
    StorefrontAPI.Scalars['String']['input']
  >;
  first?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Int']['input']>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  last?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Int']['input']>;
  startCursor?: StorefrontAPI.InputMaybe<
    StorefrontAPI.Scalars['String']['input']
  >;
}>;

export type StoreCollectionsQuery = {
  collections: {
    nodes: Array<
      Pick<StorefrontAPI.Collection, 'id' | 'title' | 'handle'> & {
        image?: StorefrontAPI.Maybe<
          Pick<
            StorefrontAPI.Image,
            'id' | 'url' | 'altText' | 'width' | 'height'
          >
        >;
      }
    >;
    pageInfo: Pick<
      StorefrontAPI.PageInfo,
      'hasNextPage' | 'hasPreviousPage' | 'startCursor' | 'endCursor'
    >;
  };
};

export type MoneyCollectionItemFragment = Pick<
  StorefrontAPI.MoneyV2,
  'amount' | 'currencyCode'
>;

export type CollectionItemFragment = Pick<
  StorefrontAPI.Product,
  'id' | 'handle' | 'title' | 'productType' | 'tags'
> & {
  worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
  gifSupport?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
  featuredImage?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Image, 'id' | 'altText' | 'url'>
  >;
  media: {
    nodes: Array<
      | {__typename: 'ExternalVideo' | 'MediaImage' | 'Model3d'}
      | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
            previewImage?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.Image, 'url'>
            >;
            sources: Array<
              Pick<
                StorefrontAPI.VideoSource,
                'url' | 'mimeType' | 'format' | 'width' | 'height'
              >
            >;
          })
    >;
  };
  priceRange: {
    minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
    maxVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
  };
  compareAtPriceRange: {
    minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
  };
};

export type CatalogQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  first?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Int']['input']>;
  last?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Int']['input']>;
  startCursor?: StorefrontAPI.InputMaybe<
    StorefrontAPI.Scalars['String']['input']
  >;
  endCursor?: StorefrontAPI.InputMaybe<
    StorefrontAPI.Scalars['String']['input']
  >;
  query?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['String']['input']>;
  sortKey?: StorefrontAPI.InputMaybe<StorefrontAPI.ProductSortKeys>;
  reverse?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Boolean']['input']>;
}>;

export type CatalogQuery = {
  products: {
    nodes: Array<
      Pick<
        StorefrontAPI.Product,
        'id' | 'handle' | 'title' | 'productType' | 'tags'
      > & {
        worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
        gifSupport?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.Metafield, 'value'>
        >;
        featuredImage?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.Image, 'id' | 'altText' | 'url'>
        >;
        media: {
          nodes: Array<
            | {__typename: 'ExternalVideo' | 'MediaImage' | 'Model3d'}
            | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
                  previewImage?: StorefrontAPI.Maybe<
                    Pick<StorefrontAPI.Image, 'url'>
                  >;
                  sources: Array<
                    Pick<
                      StorefrontAPI.VideoSource,
                      'url' | 'mimeType' | 'format' | 'width' | 'height'
                    >
                  >;
                })
          >;
        };
        priceRange: {
          minVariantPrice: Pick<
            StorefrontAPI.MoneyV2,
            'amount' | 'currencyCode'
          >;
          maxVariantPrice: Pick<
            StorefrontAPI.MoneyV2,
            'amount' | 'currencyCode'
          >;
        };
        compareAtPriceRange: {
          minVariantPrice: Pick<
            StorefrontAPI.MoneyV2,
            'amount' | 'currencyCode'
          >;
        };
      }
    >;
    pageInfo: Pick<
      StorefrontAPI.PageInfo,
      'hasPreviousPage' | 'hasNextPage' | 'startCursor' | 'endCursor'
    >;
  };
};

export type PageQueryVariables = StorefrontAPI.Exact<{
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  handle: StorefrontAPI.Scalars['String']['input'];
}>;

export type PageQuery = {
  page?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Page, 'handle' | 'id' | 'title' | 'body'> & {
      seo?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Seo, 'description' | 'title'>
      >;
    }
  >;
};

export type CommissionProofFragment = Pick<
  StorefrontAPI.Product,
  'handle' | 'title'
> & {
  featuredImage?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Image, 'url' | 'altText'>
  >;
  priceRange: {
    minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
  };
};

export type CommissionProofQueryVariables = StorefrontAPI.Exact<{
  h0: StorefrontAPI.Scalars['String']['input'];
  h1: StorefrontAPI.Scalars['String']['input'];
  h2: StorefrontAPI.Scalars['String']['input'];
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type CommissionProofQuery = {
  p0?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Product, 'handle' | 'title'> & {
      featuredImage?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'url' | 'altText'>
      >;
      priceRange: {
        minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      };
    }
  >;
  p1?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Product, 'handle' | 'title'> & {
      featuredImage?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'url' | 'altText'>
      >;
      priceRange: {
        minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      };
    }
  >;
  p2?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Product, 'handle' | 'title'> & {
      featuredImage?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'url' | 'altText'>
      >;
      priceRange: {
        minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      };
    }
  >;
};

export type PolicyFragment = Pick<
  StorefrontAPI.ShopPolicy,
  'body' | 'handle' | 'id' | 'title' | 'url'
>;

export type PolicyQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  privacyPolicy: StorefrontAPI.Scalars['Boolean']['input'];
  refundPolicy: StorefrontAPI.Scalars['Boolean']['input'];
  shippingPolicy: StorefrontAPI.Scalars['Boolean']['input'];
  termsOfService: StorefrontAPI.Scalars['Boolean']['input'];
}>;

export type PolicyQuery = {
  shop: {
    privacyPolicy?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.ShopPolicy, 'body' | 'handle' | 'id' | 'title' | 'url'>
    >;
    shippingPolicy?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.ShopPolicy, 'body' | 'handle' | 'id' | 'title' | 'url'>
    >;
    termsOfService?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.ShopPolicy, 'body' | 'handle' | 'id' | 'title' | 'url'>
    >;
    refundPolicy?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.ShopPolicy, 'body' | 'handle' | 'id' | 'title' | 'url'>
    >;
  };
};

export type PolicyItemFragment = Pick<
  StorefrontAPI.ShopPolicy,
  'id' | 'title' | 'handle'
>;

export type PoliciesQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type PoliciesQuery = {
  shop: {
    privacyPolicy?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.ShopPolicy, 'id' | 'title' | 'handle'>
    >;
    shippingPolicy?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.ShopPolicy, 'id' | 'title' | 'handle'>
    >;
    termsOfService?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.ShopPolicy, 'id' | 'title' | 'handle'>
    >;
    refundPolicy?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.ShopPolicy, 'id' | 'title' | 'handle'>
    >;
    subscriptionPolicy?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.ShopPolicyWithDefault, 'id' | 'title' | 'handle'>
    >;
  };
};

export type ProductVariantFragment = Pick<
  StorefrontAPI.ProductVariant,
  'availableForSale' | 'id' | 'sku' | 'title'
> & {
  compareAtPrice?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
  >;
  image?: StorefrontAPI.Maybe<
    {__typename: 'Image'} & Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText'>
  >;
  price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
  product: Pick<StorefrontAPI.Product, 'title' | 'handle'>;
  selectedOptions: Array<Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>>;
  unitPrice?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
  >;
};

export type ProductFragment = Pick<
  StorefrontAPI.Product,
  | 'id'
  | 'title'
  | 'vendor'
  | 'handle'
  | 'productType'
  | 'tags'
  | 'descriptionHtml'
  | 'description'
  | 'encodedVariantExistence'
  | 'encodedVariantAvailability'
> & {
  worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
  gifSupport?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
  featuredImage?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText' | 'width' | 'height'>
  >;
  media: {
    nodes: Array<
      | {__typename: 'ExternalVideo' | 'Model3d'}
      | ({__typename: 'MediaImage'} & Pick<StorefrontAPI.MediaImage, 'id'> & {
            image?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText'>
            >;
          })
      | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id' | 'alt'> & {
            previewImage?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.Image, 'url'>
            >;
            sources: Array<
              Pick<
                StorefrontAPI.VideoSource,
                'url' | 'mimeType' | 'format' | 'width' | 'height'
              >
            >;
          })
    >;
  };
  options: Array<
    Pick<StorefrontAPI.ProductOption, 'name'> & {
      optionValues: Array<
        Pick<StorefrontAPI.ProductOptionValue, 'name'> & {
          firstSelectableVariant?: StorefrontAPI.Maybe<
            Pick<
              StorefrontAPI.ProductVariant,
              'availableForSale' | 'id' | 'sku' | 'title'
            > & {
              compareAtPrice?: StorefrontAPI.Maybe<
                Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
              >;
              image?: StorefrontAPI.Maybe<
                {__typename: 'Image'} & Pick<
                  StorefrontAPI.Image,
                  'id' | 'url' | 'altText'
                >
              >;
              price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
              product: Pick<StorefrontAPI.Product, 'title' | 'handle'>;
              selectedOptions: Array<
                Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
              >;
              unitPrice?: StorefrontAPI.Maybe<
                Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
              >;
            }
          >;
          swatch?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.ProductOptionValueSwatch, 'color'> & {
              image?: StorefrontAPI.Maybe<{
                previewImage?: StorefrontAPI.Maybe<
                  Pick<StorefrontAPI.Image, 'url'>
                >;
              }>;
            }
          >;
        }
      >;
    }
  >;
  selectedOrFirstAvailableVariant?: StorefrontAPI.Maybe<
    Pick<
      StorefrontAPI.ProductVariant,
      'availableForSale' | 'id' | 'sku' | 'title'
    > & {
      compareAtPrice?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
      >;
      image?: StorefrontAPI.Maybe<
        {__typename: 'Image'} & Pick<
          StorefrontAPI.Image,
          'id' | 'url' | 'altText'
        >
      >;
      price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      product: Pick<StorefrontAPI.Product, 'title' | 'handle'>;
      selectedOptions: Array<
        Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
      >;
      unitPrice?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
      >;
    }
  >;
  adjacentVariants: Array<
    Pick<
      StorefrontAPI.ProductVariant,
      'availableForSale' | 'id' | 'sku' | 'title'
    > & {
      compareAtPrice?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
      >;
      image?: StorefrontAPI.Maybe<
        {__typename: 'Image'} & Pick<
          StorefrontAPI.Image,
          'id' | 'url' | 'altText'
        >
      >;
      price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      product: Pick<StorefrontAPI.Product, 'title' | 'handle'>;
      selectedOptions: Array<
        Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
      >;
      unitPrice?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
      >;
    }
  >;
  seo: Pick<StorefrontAPI.Seo, 'description' | 'title'>;
};

export type ProductQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  handle: StorefrontAPI.Scalars['String']['input'];
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  selectedOptions:
    | Array<StorefrontAPI.SelectedOptionInput>
    | StorefrontAPI.SelectedOptionInput;
}>;

export type ProductQuery = {
  product?: StorefrontAPI.Maybe<
    Pick<
      StorefrontAPI.Product,
      | 'id'
      | 'title'
      | 'vendor'
      | 'handle'
      | 'productType'
      | 'tags'
      | 'descriptionHtml'
      | 'description'
      | 'encodedVariantExistence'
      | 'encodedVariantAvailability'
    > & {
      worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
      gifSupport?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
      featuredImage?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText' | 'width' | 'height'>
      >;
      media: {
        nodes: Array<
          | {__typename: 'ExternalVideo' | 'Model3d'}
          | ({__typename: 'MediaImage'} & Pick<
              StorefrontAPI.MediaImage,
              'id'
            > & {
                image?: StorefrontAPI.Maybe<
                  Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText'>
                >;
              })
          | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id' | 'alt'> & {
                previewImage?: StorefrontAPI.Maybe<
                  Pick<StorefrontAPI.Image, 'url'>
                >;
                sources: Array<
                  Pick<
                    StorefrontAPI.VideoSource,
                    'url' | 'mimeType' | 'format' | 'width' | 'height'
                  >
                >;
              })
        >;
      };
      options: Array<
        Pick<StorefrontAPI.ProductOption, 'name'> & {
          optionValues: Array<
            Pick<StorefrontAPI.ProductOptionValue, 'name'> & {
              firstSelectableVariant?: StorefrontAPI.Maybe<
                Pick<
                  StorefrontAPI.ProductVariant,
                  'availableForSale' | 'id' | 'sku' | 'title'
                > & {
                  compareAtPrice?: StorefrontAPI.Maybe<
                    Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
                  >;
                  image?: StorefrontAPI.Maybe<
                    {__typename: 'Image'} & Pick<
                      StorefrontAPI.Image,
                      'id' | 'url' | 'altText'
                    >
                  >;
                  price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
                  product: Pick<StorefrontAPI.Product, 'title' | 'handle'>;
                  selectedOptions: Array<
                    Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
                  >;
                  unitPrice?: StorefrontAPI.Maybe<
                    Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
                  >;
                }
              >;
              swatch?: StorefrontAPI.Maybe<
                Pick<StorefrontAPI.ProductOptionValueSwatch, 'color'> & {
                  image?: StorefrontAPI.Maybe<{
                    previewImage?: StorefrontAPI.Maybe<
                      Pick<StorefrontAPI.Image, 'url'>
                    >;
                  }>;
                }
              >;
            }
          >;
        }
      >;
      selectedOrFirstAvailableVariant?: StorefrontAPI.Maybe<
        Pick<
          StorefrontAPI.ProductVariant,
          'availableForSale' | 'id' | 'sku' | 'title'
        > & {
          compareAtPrice?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
          >;
          image?: StorefrontAPI.Maybe<
            {__typename: 'Image'} & Pick<
              StorefrontAPI.Image,
              'id' | 'url' | 'altText'
            >
          >;
          price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
          product: Pick<StorefrontAPI.Product, 'title' | 'handle'>;
          selectedOptions: Array<
            Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
          >;
          unitPrice?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
          >;
        }
      >;
      adjacentVariants: Array<
        Pick<
          StorefrontAPI.ProductVariant,
          'availableForSale' | 'id' | 'sku' | 'title'
        > & {
          compareAtPrice?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
          >;
          image?: StorefrontAPI.Maybe<
            {__typename: 'Image'} & Pick<
              StorefrontAPI.Image,
              'id' | 'url' | 'altText'
            >
          >;
          price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
          product: Pick<StorefrontAPI.Product, 'title' | 'handle'>;
          selectedOptions: Array<
            Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
          >;
          unitPrice?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
          >;
        }
      >;
      seo: Pick<StorefrontAPI.Seo, 'description' | 'title'>;
    }
  >;
  chatWidgetsCurrent?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Collection, 'handle'>
  >;
  chatWidgetsLegacy?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Collection, 'handle'>
  >;
  goalWidgetsCurrent?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Collection, 'handle'>
  >;
  goalWidgetsLegacy?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Collection, 'handle'>
  >;
};

export type ProductRecommendationsQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  productId: StorefrontAPI.Scalars['ID']['input'];
}>;

export type ProductRecommendationsQuery = {
  productRecommendations?: StorefrontAPI.Maybe<
    Array<
      Pick<
        StorefrontAPI.Product,
        'id' | 'title' | 'handle' | 'availableForSale' | 'tags'
      > & {
        worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
        gifSupport?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.Metafield, 'value'>
        >;
        priceRange: {
          minVariantPrice: Pick<
            StorefrontAPI.MoneyV2,
            'amount' | 'currencyCode'
          >;
        };
        compareAtPriceRange: {
          minVariantPrice: Pick<
            StorefrontAPI.MoneyV2,
            'amount' | 'currencyCode'
          >;
        };
        featuredImage?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.Image, 'id' | 'altText' | 'url'>
        >;
        media: {
          nodes: Array<
            | {__typename: 'ExternalVideo' | 'MediaImage' | 'Model3d'}
            | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
                  previewImage?: StorefrontAPI.Maybe<
                    Pick<StorefrontAPI.Image, 'url'>
                  >;
                  sources: Array<
                    Pick<
                      StorefrontAPI.VideoSource,
                      'url' | 'mimeType' | 'format' | 'width' | 'height'
                    >
                  >;
                })
          >;
        };
      }
    >
  >;
};

export type RelatedProductsQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  query?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['String']['input']>;
}>;

export type RelatedProductsQuery = {
  products: {
    nodes: Array<
      Pick<StorefrontAPI.Product, 'id' | 'title' | 'handle' | 'tags'> & {
        worksWith?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
        gifSupport?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.Metafield, 'value'>
        >;
        priceRange: {
          minVariantPrice: Pick<
            StorefrontAPI.MoneyV2,
            'amount' | 'currencyCode'
          >;
        };
        compareAtPriceRange: {
          minVariantPrice: Pick<
            StorefrontAPI.MoneyV2,
            'amount' | 'currencyCode'
          >;
        };
        featuredImage?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.Image, 'id' | 'altText' | 'url'>
        >;
        media: {
          nodes: Array<
            | {__typename: 'ExternalVideo' | 'MediaImage' | 'Model3d'}
            | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
                  previewImage?: StorefrontAPI.Maybe<
                    Pick<StorefrontAPI.Image, 'url'>
                  >;
                  sources: Array<
                    Pick<
                      StorefrontAPI.VideoSource,
                      'url' | 'mimeType' | 'format' | 'width' | 'height'
                    >
                  >;
                })
          >;
        };
      }
    >;
  };
};

export type ProductFaqPageQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type ProductFaqPageQuery = {
  page?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Page, 'body'>>;
};

export type SearchProductFragment = {__typename: 'Product'} & Pick<
  StorefrontAPI.Product,
  'handle' | 'id' | 'publishedAt' | 'title' | 'trackingParameters' | 'vendor'
> & {
    selectedOrFirstAvailableVariant?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.ProductVariant, 'id'> & {
        image?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.Image, 'url' | 'altText' | 'width' | 'height'>
        >;
        price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
        compareAtPrice?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
        >;
        selectedOptions: Array<
          Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
        >;
        product: Pick<StorefrontAPI.Product, 'handle' | 'title'>;
      }
    >;
  };

export type SearchPageFragment = {__typename: 'Page'} & Pick<
  StorefrontAPI.Page,
  'handle' | 'id' | 'title' | 'trackingParameters'
>;

export type SearchArticleFragment = {__typename: 'Article'} & Pick<
  StorefrontAPI.Article,
  'handle' | 'id' | 'title' | 'trackingParameters'
> & {blog: Pick<StorefrontAPI.Blog, 'handle'>};

export type PageInfoFragmentFragment = Pick<
  StorefrontAPI.PageInfo,
  'hasNextPage' | 'hasPreviousPage' | 'startCursor' | 'endCursor'
>;

export type RegularSearchQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  endCursor?: StorefrontAPI.InputMaybe<
    StorefrontAPI.Scalars['String']['input']
  >;
  first?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Int']['input']>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  last?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Int']['input']>;
  term: StorefrontAPI.Scalars['String']['input'];
  startCursor?: StorefrontAPI.InputMaybe<
    StorefrontAPI.Scalars['String']['input']
  >;
}>;

export type RegularSearchQuery = {
  articles: {
    nodes: Array<
      {__typename: 'Article'} & Pick<
        StorefrontAPI.Article,
        'handle' | 'id' | 'title' | 'trackingParameters'
      > & {blog: Pick<StorefrontAPI.Blog, 'handle'>}
    >;
  };
  pages: {
    nodes: Array<
      {__typename: 'Page'} & Pick<
        StorefrontAPI.Page,
        'handle' | 'id' | 'title' | 'trackingParameters'
      >
    >;
  };
  products: {
    nodes: Array<
      {__typename: 'Product'} & Pick<
        StorefrontAPI.Product,
        | 'handle'
        | 'id'
        | 'publishedAt'
        | 'title'
        | 'trackingParameters'
        | 'vendor'
      > & {
          selectedOrFirstAvailableVariant?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.ProductVariant, 'id'> & {
              image?: StorefrontAPI.Maybe<
                Pick<
                  StorefrontAPI.Image,
                  'url' | 'altText' | 'width' | 'height'
                >
              >;
              price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
              compareAtPrice?: StorefrontAPI.Maybe<
                Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
              >;
              selectedOptions: Array<
                Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
              >;
              product: Pick<StorefrontAPI.Product, 'handle' | 'title'>;
            }
          >;
        }
    >;
    pageInfo: Pick<
      StorefrontAPI.PageInfo,
      'hasNextPage' | 'hasPreviousPage' | 'startCursor' | 'endCursor'
    >;
  };
};

export type PredictiveArticleFragment = {__typename: 'Article'} & Pick<
  StorefrontAPI.Article,
  'id' | 'title' | 'handle' | 'trackingParameters'
> & {
    blog: Pick<StorefrontAPI.Blog, 'handle'>;
    image?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.Image, 'url' | 'altText' | 'width' | 'height'>
    >;
  };

export type PredictiveCollectionFragment = {__typename: 'Collection'} & Pick<
  StorefrontAPI.Collection,
  'id' | 'title' | 'handle' | 'trackingParameters'
> & {
    image?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.Image, 'url' | 'altText' | 'width' | 'height'>
    >;
  };

export type PredictivePageFragment = {__typename: 'Page'} & Pick<
  StorefrontAPI.Page,
  'id' | 'title' | 'handle' | 'trackingParameters'
>;

export type PredictiveProductFragment = {__typename: 'Product'} & Pick<
  StorefrontAPI.Product,
  'id' | 'title' | 'handle' | 'trackingParameters'
> & {
    selectedOrFirstAvailableVariant?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.ProductVariant, 'id'> & {
        image?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.Image, 'url' | 'altText' | 'width' | 'height'>
        >;
        price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
        compareAtPrice?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
        >;
      }
    >;
  };

export type PredictiveQueryFragment = {
  __typename: 'SearchQuerySuggestion';
} & Pick<
  StorefrontAPI.SearchQuerySuggestion,
  'text' | 'styledText' | 'trackingParameters'
>;

export type PredictiveSearchQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  limit: StorefrontAPI.Scalars['Int']['input'];
  limitScope: StorefrontAPI.PredictiveSearchLimitScope;
  term: StorefrontAPI.Scalars['String']['input'];
  types?: StorefrontAPI.InputMaybe<
    | Array<StorefrontAPI.PredictiveSearchType>
    | StorefrontAPI.PredictiveSearchType
  >;
}>;

export type PredictiveSearchQuery = {
  predictiveSearch?: StorefrontAPI.Maybe<{
    articles: Array<
      {__typename: 'Article'} & Pick<
        StorefrontAPI.Article,
        'id' | 'title' | 'handle' | 'trackingParameters'
      > & {
          blog: Pick<StorefrontAPI.Blog, 'handle'>;
          image?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.Image, 'url' | 'altText' | 'width' | 'height'>
          >;
        }
    >;
    collections: Array<
      {__typename: 'Collection'} & Pick<
        StorefrontAPI.Collection,
        'id' | 'title' | 'handle' | 'trackingParameters'
      > & {
          image?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.Image, 'url' | 'altText' | 'width' | 'height'>
          >;
        }
    >;
    pages: Array<
      {__typename: 'Page'} & Pick<
        StorefrontAPI.Page,
        'id' | 'title' | 'handle' | 'trackingParameters'
      >
    >;
    products: Array<
      {__typename: 'Product'} & Pick<
        StorefrontAPI.Product,
        'id' | 'title' | 'handle' | 'trackingParameters'
      > & {
          selectedOrFirstAvailableVariant?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.ProductVariant, 'id'> & {
              image?: StorefrontAPI.Maybe<
                Pick<
                  StorefrontAPI.Image,
                  'url' | 'altText' | 'width' | 'height'
                >
              >;
              price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
              compareAtPrice?: StorefrontAPI.Maybe<
                Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
              >;
            }
          >;
        }
    >;
    queries: Array<
      {__typename: 'SearchQuerySuggestion'} & Pick<
        StorefrontAPI.SearchQuerySuggestion,
        'text' | 'styledText' | 'trackingParameters'
      >
    >;
  }>;
};

export type VideoWatchProductQueryVariables = StorefrontAPI.Exact<{
  handle: StorefrontAPI.Scalars['String']['input'];
}>;

export type VideoWatchProductQuery = {
  product?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Product, 'id' | 'handle' | 'title'> & {
      media: {
        nodes: Array<
          | {__typename: 'ExternalVideo' | 'MediaImage' | 'Model3d'}
          | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id' | 'alt'> & {
                previewImage?: StorefrontAPI.Maybe<
                  Pick<StorefrontAPI.Image, 'url'>
                >;
                sources: Array<
                  Pick<
                    StorefrontAPI.VideoSource,
                    'url' | 'mimeType' | 'format' | 'width' | 'height'
                  >
                >;
              })
        >;
      };
    }
  >;
};

interface GeneratedQueryTypes {
  '#graphql\n  fragment Shop on Shop {\n    id\n    name\n    description\n    primaryDomain {\n      url\n    }\n    brand {\n      logo {\n        image {\n          url\n        }\n      }\n    }\n  }\n  query Header(\n    $country: CountryCode\n    $headerMenuHandle: String!\n    $language: LanguageCode\n  ) @inContext(language: $language, country: $country) {\n    shop {\n      ...Shop\n    }\n    menu(handle: $headerMenuHandle) {\n      ...Menu\n    }\n  }\n  #graphql\n  fragment MenuItem on MenuItem {\n    id\n    resourceId\n    tags\n    title\n    type\n    url\n  }\n  fragment ChildMenuItem on MenuItem {\n    ...MenuItem\n  }\n  fragment ParentMenuItem on MenuItem {\n    ...MenuItem\n    items {\n      ...ChildMenuItem\n    }\n  }\n  fragment Menu on Menu {\n    id\n    items {\n      ...ParentMenuItem\n    }\n  }\n\n': {
    return: HeaderQuery;
    variables: HeaderQueryVariables;
  };
  '#graphql\n  query Footer(\n    $country: CountryCode\n    $footerMenuHandle: String!\n    $language: LanguageCode\n  ) @inContext(language: $language, country: $country) {\n    menu(handle: $footerMenuHandle) {\n      ...Menu\n    }\n  }\n  #graphql\n  fragment MenuItem on MenuItem {\n    id\n    resourceId\n    tags\n    title\n    type\n    url\n  }\n  fragment ChildMenuItem on MenuItem {\n    ...MenuItem\n  }\n  fragment ParentMenuItem on MenuItem {\n    ...MenuItem\n    items {\n      ...ChildMenuItem\n    }\n  }\n  fragment Menu on Menu {\n    id\n    items {\n      ...ParentMenuItem\n    }\n  }\n\n': {
    return: FooterQuery;
    variables: FooterQueryVariables;
  };
  '#graphql\n  fragment NavCollection on Collection {\n    id\n    handle\n    title\n    image {\n      url\n      altText\n    }\n    products(first: 250) {\n      nodes {\n        id\n      }\n    }\n  }\n  fragment NavProduct on Product {\n    id\n    handle\n    title\n    featuredImage {\n      url\n      altText\n    }\n    selectedOrFirstAvailableVariant {\n      price {\n        amount\n        currencyCode\n      }\n    }\n  }\n  query Nav(\n    $country: CountryCode\n    $language: LanguageCode\n    $featuredWidgetHandle: String!\n    $overlayHandle0: String!\n    $overlayHandle1: String!\n    $overlayHandle2: String!\n    $overlayHandle3: String!\n  ) @inContext(language: $language, country: $country) {\n    allWidgets: collection(handle: "widgets") {\n      ...NavCollection\n    }\n    # Handles are literal here, not interpolated from\n    # app/lib/collectionHandles.js: @shopify/graphql-codegen statically\n    # parses this tagged template and cannot resolve a JS expression inside\n    # it (confirmed 2026-09-28, codegen throws "Variable ... not found" on\n    # an interpolated handle). collectionHandles.js stays the source of\n    # truth for every non-query use (links, matching); if either handle\n    # changes there, mirror it here too.\n    chatWidgetsCurrent: collection(handle: "twitch-chat-widgets") {\n      ...NavCollection\n    }\n    chatWidgetsLegacy: collection(handle: "frontpage") {\n      ...NavCollection\n    }\n    goalWidgetsCurrent: collection(handle: "twitch-goal-widgets") {\n      ...NavCollection\n    }\n    goalWidgetsLegacy: collection(handle: "stream-widgets-templates") {\n      ...NavCollection\n    }\n    topWidgets: collection(handle: "top-widgets") {\n      ...NavCollection\n      thumbs: products(first: 8) {\n        nodes {\n          ...NavProduct\n        }\n      }\n    }\n    overlays: collection(handle: "overlays") {\n      ...NavCollection\n    }\n    bundles: collection(handle: "bundles") {\n      ...NavCollection\n    }\n    featuredWidget: product(handle: $featuredWidgetHandle) {\n      ...NavProduct\n    }\n    overlayFeatured0: product(handle: $overlayHandle0) {\n      ...NavProduct\n    }\n    overlayFeatured1: product(handle: $overlayHandle1) {\n      ...NavProduct\n    }\n    overlayFeatured2: product(handle: $overlayHandle2) {\n      ...NavProduct\n    }\n    overlayFeatured3: product(handle: $overlayHandle3) {\n      ...NavProduct\n    }\n  }\n': {
    return: NavQuery;
    variables: NavQueryVariables;
  };
  '#graphql\n  query LiveBanner($country: CountryCode, $language: LanguageCode)\n  @inContext(country: $country, language: $language) {\n    shop {\n      metafield(namespace: "sws", key: "live_banner") {\n        value\n      }\n    }\n  }\n': {
    return: LiveBannerQuery;
    variables: LiveBannerQueryVariables;
  };
  '#graphql\n  query ProductFeed($first: Int!, $after: String, $country: CountryCode, $language: LanguageCode)\n    @inContext(country: $country, language: $language) {\n    products(first: $first, after: $after) {\n      pageInfo { hasNextPage endCursor }\n      nodes {\n        id\n        handle\n        title\n        description\n        productType\n        vendor\n        tags\n        featuredImage { url altText }\n        images(first: 10) { nodes { url } }\n        variants(first: 1) {\n          nodes {\n            id\n            availableForSale\n            price { amount currencyCode }\n            compareAtPrice { amount currencyCode }\n          }\n        }\n      }\n    }\n  }\n': {
    return: ProductFeedQuery;
    variables: ProductFeedQueryVariables;
  };
  '#graphql\n  query SitemapCounts {\n    products: sitemap(type: PRODUCT) {\n      pagesCount {\n        count\n      }\n    }\n    collections: sitemap(type: COLLECTION) {\n      pagesCount {\n        count\n      }\n    }\n    pages: sitemap(type: PAGE) {\n      pagesCount {\n        count\n      }\n    }\n    blogs: sitemap(type: BLOG) {\n      pagesCount {\n        count\n      }\n    }\n  }\n': {
    return: SitemapCountsQuery;
    variables: SitemapCountsQueryVariables;
  };
  '#graphql\n  query SitemapProductsPage($page: Int!) {\n    sitemap(type: PRODUCT) {\n      resources(page: $page) {\n        items {\n          handle\n          updatedAt\n        }\n      }\n    }\n  }\n': {
    return: SitemapProductsPageQuery;
    variables: SitemapProductsPageQueryVariables;
  };
  '#graphql\n  query SitemapProductUpdatedAt($cursor: String) {\n    products(first: 250, after: $cursor) {\n      nodes {\n        handle\n        updatedAt\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n': {
    return: SitemapProductUpdatedAtQuery;
    variables: SitemapProductUpdatedAtQueryVariables;
  };
  '#graphql\n  query SitemapCollectionsPage($page: Int!) {\n    sitemap(type: COLLECTION) {\n      resources(page: $page) {\n        items {\n          handle\n          updatedAt\n        }\n      }\n    }\n  }\n': {
    return: SitemapCollectionsPageQuery;
    variables: SitemapCollectionsPageQueryVariables;
  };
  '#graphql\n  query SitemapPagesPage($page: Int!) {\n    sitemap(type: PAGE) {\n      resources(page: $page) {\n        items {\n          handle\n          updatedAt\n        }\n      }\n    }\n  }\n': {
    return: SitemapPagesPageQuery;
    variables: SitemapPagesPageQueryVariables;
  };
  '#graphql\n  query SitemapBlogsPage($page: Int!) {\n    sitemap(type: BLOG) {\n      resources(page: $page) {\n        items {\n          handle\n          updatedAt\n        }\n      }\n    }\n  }\n': {
    return: SitemapBlogsPageQuery;
    variables: SitemapBlogsPageQueryVariables;
  };
  '#graphql\n  query SitemapBlogHandles($cursor: String) {\n    blogs(first: 250, after: $cursor) {\n      nodes {\n        handle\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n': {
    return: SitemapBlogHandlesQuery;
    variables: SitemapBlogHandlesQueryVariables;
  };
  '#graphql\n  query SitemapBlogArticles($blogHandle: String!, $cursor: String) {\n    blog(handle: $blogHandle) {\n      articles(first: 250, after: $cursor) {\n        nodes {\n          handle\n          publishedAt\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n      }\n    }\n  }\n': {
    return: SitemapBlogArticlesQuery;
    variables: SitemapBlogArticlesQueryVariables;
  };
  '#graphql\n  query SitemapVideoProducts {\n    products(first: 250) {\n      nodes {\n        handle\n        title\n        media(first: 25) {\n          nodes {\n            __typename\n            ... on Video {\n              id\n              alt\n              previewImage {\n                url\n              }\n              sources {\n                url\n                mimeType\n                format\n                width\n                height\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n': {
    return: SitemapVideoProductsQuery;
    variables: SitemapVideoProductsQueryVariables;
  };
  '#graphql\n  query LlmsTxtTopWidgets($handle: String!) {\n    collection(handle: $handle) {\n      products(first: 30) {\n        nodes {\n          title\n          handle\n          productType\n          seo { title }\n          worksWith: metafield(namespace: "custom", key: "works_with") { value }\n        }\n      }\n    }\n  }\n': {
    return: LlmsTxtTopWidgetsQuery;
    variables: LlmsTxtTopWidgetsQueryVariables;
  };
  '#graphql\n  query LlmsTxtFallbackProducts(\n    $handle0: String!\n    $handle1: String!\n    $handle2: String!\n    $handle3: String!\n    $handle4: String!\n    $handle5: String!\n    $handle6: String!\n    $handle7: String!\n  ) {\n    product0: product(handle: $handle0) { title handle productType seo { title } worksWith: metafield(namespace: "custom", key: "works_with") { value } }\n    product1: product(handle: $handle1) { title handle productType seo { title } worksWith: metafield(namespace: "custom", key: "works_with") { value } }\n    product2: product(handle: $handle2) { title handle productType seo { title } worksWith: metafield(namespace: "custom", key: "works_with") { value } }\n    product3: product(handle: $handle3) { title handle productType seo { title } worksWith: metafield(namespace: "custom", key: "works_with") { value } }\n    product4: product(handle: $handle4) { title handle productType seo { title } worksWith: metafield(namespace: "custom", key: "works_with") { value } }\n    product5: product(handle: $handle5) { title handle productType seo { title } worksWith: metafield(namespace: "custom", key: "works_with") { value } }\n    product6: product(handle: $handle6) { title handle productType seo { title } worksWith: metafield(namespace: "custom", key: "works_with") { value } }\n    product7: product(handle: $handle7) { title handle productType seo { title } worksWith: metafield(namespace: "custom", key: "works_with") { value } }\n  }\n': {
    return: LlmsTxtFallbackProductsQuery;
    variables: LlmsTxtFallbackProductsQueryVariables;
  };
  '#graphql\n  query LlmsTxtAllProducts($cursor: String) {\n    products(first: 250, after: $cursor, sortKey: ID) {\n      pageInfo { hasNextPage endCursor }\n      nodes {\n        title\n        handle\n        productType\n        seo { title }\n        worksWith: metafield(namespace: "custom", key: "works_with") { value }\n      }\n    }\n  }\n': {
    return: LlmsTxtAllProductsQuery;
    variables: LlmsTxtAllProductsQueryVariables;
  };
  '#graphql\n  query LlmsTxtCollections {\n    collections(first: 20) {\n      nodes {\n        title\n        handle\n      }\n    }\n  }\n': {
    return: LlmsTxtCollectionsQuery;
    variables: LlmsTxtCollectionsQueryVariables;
  };
  '#graphql\n  query BundlePromoTiles(\n    $country: CountryCode\n    $language: LanguageCode\n    $handle0: String!\n    $handle1: String!\n    $handle2: String!\n    $handle3: String!\n    $handle4: String!\n    $handle5: String!\n  ) @inContext(country: $country, language: $language) {\n    product0: product(handle: $handle0) { ...BundlePromoTile }\n    product1: product(handle: $handle1) { ...BundlePromoTile }\n    product2: product(handle: $handle2) { ...BundlePromoTile }\n    product3: product(handle: $handle3) { ...BundlePromoTile }\n    product4: product(handle: $handle4) { ...BundlePromoTile }\n    product5: product(handle: $handle5) { ...BundlePromoTile }\n  }\n  fragment BundlePromoTile on Product {\n    id\n    title\n    handle\n    productType\n    tags\n    featuredImage {\n      id\n      url\n      altText\n      width\n      height\n    }\n  }\n': {
    return: BundlePromoTilesQuery;
    variables: BundlePromoTilesQueryVariables;
  };
  '#graphql\n  query RecommendedProducts (\n    $country: CountryCode\n    $language: LanguageCode\n    $handle0: String!\n    $handle1: String!\n    $handle2: String!\n    $handle3: String!\n    $handle4: String!\n    $handle5: String!\n    $handle6: String!\n    $handle7: String!\n  ) @inContext(country: $country, language: $language) {\n    product0: product(handle: $handle0) { ...RecommendedProduct }\n    product1: product(handle: $handle1) { ...RecommendedProduct }\n    product2: product(handle: $handle2) { ...RecommendedProduct }\n    product3: product(handle: $handle3) { ...RecommendedProduct }\n    product4: product(handle: $handle4) { ...RecommendedProduct }\n    product5: product(handle: $handle5) { ...RecommendedProduct }\n    product6: product(handle: $handle6) { ...RecommendedProduct }\n    product7: product(handle: $handle7) { ...RecommendedProduct }\n  }\n  #graphql\n  fragment RecommendedProduct on Product {\n    id\n    title\n    productType\n    handle\n    tags\n    worksWith: metafield(namespace: "custom", key: "works_with") { value }\n    gifSupport: metafield(namespace: "custom", key: "gif_support") { value }\n    priceRange {\n      minVariantPrice {\n        amount\n        currencyCode\n      }\n    }\n    compareAtPriceRange {\n      minVariantPrice {\n        amount\n        currencyCode\n      }\n    }\n    featuredImage {\n      id\n      url\n      altText\n    }\n    media(first: 25) {\n      nodes {\n        __typename\n        ... on Video {\n          id\n          previewImage {\n            url\n          }\n          sources {\n            url\n            mimeType\n            format\n            width\n            height\n          }\n        }\n      }\n    }\n  }\n\n': {
    return: RecommendedProductsQuery;
    variables: RecommendedProductsQueryVariables;
  };
  '#graphql\n  query NewArrivals(\n    $country: CountryCode\n    $language: LanguageCode\n    $first: Int!\n    $query: String\n    $freshHandle: String!\n    $freshFirst: Int!\n  ) @inContext(country: $country, language: $language) {\n    fresh: collection(handle: $freshHandle) {\n      products(first: $freshFirst) {\n        nodes { ...RecommendedProduct }\n      }\n    }\n    products(first: $first, sortKey: CREATED_AT, reverse: true, query: $query) {\n      nodes { ...RecommendedProduct }\n    }\n  }\n  #graphql\n  fragment RecommendedProduct on Product {\n    id\n    title\n    productType\n    handle\n    tags\n    worksWith: metafield(namespace: "custom", key: "works_with") { value }\n    gifSupport: metafield(namespace: "custom", key: "gif_support") { value }\n    priceRange {\n      minVariantPrice {\n        amount\n        currencyCode\n      }\n    }\n    compareAtPriceRange {\n      minVariantPrice {\n        amount\n        currencyCode\n      }\n    }\n    featuredImage {\n      id\n      url\n      altText\n    }\n    media(first: 25) {\n      nodes {\n        __typename\n        ... on Video {\n          id\n          previewImage {\n            url\n          }\n          sources {\n            url\n            mimeType\n            format\n            width\n            height\n          }\n        }\n      }\n    }\n  }\n\n': {
    return: NewArrivalsQuery;
    variables: NewArrivalsQueryVariables;
  };
  '#graphql\n  fragment KitOrOverlayPackProduct on Product {\n    id\n    title\n    handle\n    productType\n    description\n    createdAt\n    featuredImage {\n      id\n      url\n      altText\n    }\n    selectedOrFirstAvailableVariant {\n      price {\n        amount\n        currencyCode\n      }\n      compareAtPrice {\n        amount\n        currencyCode\n      }\n    }\n  }\n  query KitsAndOverlayPacks (\n    $country: CountryCode\n    $language: LanguageCode\n  ) @inContext(country: $country, language: $language) {\n    bundlesNewest: collection(handle: "bundles") {\n      products(first: 4, sortKey: CREATED, reverse: true) {\n        nodes { ...KitOrOverlayPackProduct }\n      }\n    }\n    bundlesBest: collection(handle: "bundles") {\n      products(first: 30, sortKey: BEST_SELLING) {\n        nodes { ...KitOrOverlayPackProduct }\n      }\n    }\n    overlaysNewest: collection(handle: "overlays") {\n      products(first: 4, sortKey: CREATED, reverse: true) {\n        nodes { ...KitOrOverlayPackProduct }\n      }\n    }\n    overlaysBest: collection(handle: "overlays") {\n      products(first: 6, sortKey: BEST_SELLING) {\n        nodes { ...KitOrOverlayPackProduct }\n      }\n    }\n  }\n': {
    return: KitsAndOverlayPacksQuery;
    variables: KitsAndOverlayPacksQueryVariables;
  };
  '#graphql\n  query HomeLatestArticles($language: LanguageCode) @inContext(language: $language) {\n    blog(handle: "news") {\n      articles(first: 3, sortKey: PUBLISHED_AT, reverse: true) {\n        nodes {\n          handle\n          title\n          publishedAt\n          excerpt\n          content(truncateAt: 200)\n          image {\n            url\n            altText\n            width\n            height\n          }\n        }\n      }\n    }\n  }\n': {
    return: HomeLatestArticlesQuery;
    variables: HomeLatestArticlesQueryVariables;
  };
  '#graphql\n  query HalloweenCollection(\n    $handle: String!\n    $country: CountryCode\n    $language: LanguageCode\n  ) @inContext(country: $country, language: $language) {\n    collection(handle: $handle) {\n      id\n      products(first: 8, sortKey: CREATED, reverse: true) {\n        nodes {\n          id\n          title\n          handle\n          productType\n          worksWith: metafield(namespace: "custom", key: "works_with") { value }\n          tags\n          gifSupport: metafield(namespace: "custom", key: "gif_support") { value }\n          priceRange {\n            minVariantPrice {\n              amount\n              currencyCode\n            }\n          }\n          compareAtPriceRange {\n            minVariantPrice {\n              amount\n              currencyCode\n            }\n          }\n          featuredImage {\n            id\n            url\n            altText\n          }\n          media(first: 25) {\n            nodes {\n              __typename\n              ... on Video {\n                id\n                previewImage {\n                  url\n                }\n                sources {\n                  url\n                  mimeType\n                  format\n                  width\n                  height\n                }\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n': {
    return: HalloweenCollectionQuery;
    variables: HalloweenCollectionQueryVariables;
  };
  '#graphql\n  #graphql\n  fragment AgentProduct on Product {\n    id\n    title\n    handle\n    productType\n    worksWith: metafield(namespace: "custom", key: "works_with") { value }\n    priceRange { minVariantPrice { amount currencyCode } }\n    selectedOrFirstAvailableVariant(ignoreUnknownOptions: true, caseInsensitiveMatch: true) {\n      id\n      availableForSale\n    }\n  }\n\n  query AgentSearch($query: String!, $first: Int!, $country: CountryCode, $language: LanguageCode)\n    @inContext(country: $country, language: $language) {\n    products(first: $first, query: $query) {\n      nodes { ...AgentProduct }\n    }\n  }\n': {
    return: AgentSearchQuery;
    variables: AgentSearchQueryVariables;
  };
  '#graphql\n  #graphql\n  fragment AgentProduct on Product {\n    id\n    title\n    handle\n    productType\n    worksWith: metafield(namespace: "custom", key: "works_with") { value }\n    priceRange { minVariantPrice { amount currencyCode } }\n    selectedOrFirstAvailableVariant(ignoreUnknownOptions: true, caseInsensitiveMatch: true) {\n      id\n      availableForSale\n    }\n  }\n\n  query AgentProductByHandle($handle: String!, $country: CountryCode, $language: LanguageCode)\n    @inContext(country: $country, language: $language) {\n    product(handle: $handle) {\n      ...AgentProduct\n      description\n    }\n  }\n': {
    return: AgentProductByHandleQuery;
    variables: AgentProductByHandleQueryVariables;
  };
  '#graphql\n  query BundleQuickView(\n    $handle: String!\n    $country: CountryCode\n    $language: LanguageCode\n  ) @inContext(country: $country, language: $language) {\n    product(handle: $handle) {\n      handle\n      title\n      description\n      featuredImage { url altText }\n      media(first: 12) {\n        nodes {\n          __typename\n          ... on MediaImage { image { url altText } }\n          ... on Video {\n            previewImage { url }\n            sources { url mimeType format width height }\n          }\n        }\n      }\n    }\n  }\n': {
    return: BundleQuickViewQuery;
    variables: BundleQuickViewQueryVariables;
  };
  '#graphql\n  #graphql\n  fragment MoneyCrossSell on MoneyV2 {\n    amount\n    currencyCode\n  }\n  fragment CrossSellItem on Product {\n    id\n    handle\n    title\n    productType\n    worksWith: metafield(namespace: "custom", key: "works_with") { value }\n    tags\n    gifSupport: metafield(namespace: "custom", key: "gif_support") { value }\n    featuredImage {\n      id\n      altText\n      url\n    }\n    priceRange {\n      minVariantPrice {\n        ...MoneyCrossSell\n      }\n      maxVariantPrice {\n        ...MoneyCrossSell\n      }\n    }\n    compareAtPriceRange {\n      minVariantPrice {\n        ...MoneyCrossSell\n      }\n    }\n  }\n\n  query BlogShelfFallback($first: Int!, $country: CountryCode, $language: LanguageCode)\n    @inContext(country: $country, language: $language) {\n    products(first: $first, sortKey: BEST_SELLING) {\n      nodes {\n        ...CrossSellItem\n      }\n    }\n  }\n': {
    return: BlogShelfFallbackQuery;
    variables: BlogShelfFallbackQueryVariables;
  };
  '#graphql\n  #graphql\n  fragment MoneyCrossSell on MoneyV2 {\n    amount\n    currencyCode\n  }\n  fragment CrossSellItem on Product {\n    id\n    handle\n    title\n    productType\n    worksWith: metafield(namespace: "custom", key: "works_with") { value }\n    tags\n    gifSupport: metafield(namespace: "custom", key: "gif_support") { value }\n    featuredImage {\n      id\n      altText\n      url\n    }\n    priceRange {\n      minVariantPrice {\n        ...MoneyCrossSell\n      }\n      maxVariantPrice {\n        ...MoneyCrossSell\n      }\n    }\n    compareAtPriceRange {\n      minVariantPrice {\n        ...MoneyCrossSell\n      }\n    }\n  }\n\n  query BlogCrossSell($query: String!, $country: CountryCode, $language: LanguageCode)\n    @inContext(country: $country, language: $language) {\n    products(first: 24, query: $query, sortKey: RELEVANCE) {\n      nodes {\n        ...CrossSellItem\n      }\n    }\n  }\n': {
    return: BlogCrossSellQuery;
    variables: BlogCrossSellQueryVariables;
  };
  '#graphql\n  query Article(\n    $articleHandle: String!\n    $blogHandle: String!\n    $country: CountryCode\n    $language: LanguageCode\n  ) @inContext(language: $language, country: $country) {\n    blog(handle: $blogHandle) {\n      handle\n      articleByHandle(handle: $articleHandle) {\n        handle\n        title\n        tags\n        contentHtml\n        publishedAt\n        author: authorV2 {\n          name\n        }\n        image {\n          id\n          altText\n          url\n          width\n          height\n        }\n        seo {\n          description\n          title\n        }\n      }\n    }\n  }\n': {
    return: ArticleQuery;
    variables: ArticleQueryVariables;
  };
  "#graphql\n  query Blog(\n    $language: LanguageCode\n    $blogHandle: String!\n    $first: Int\n    $last: Int\n    $startCursor: String\n    $endCursor: String\n  ) @inContext(language: $language) {\n    blog(handle: $blogHandle) {\n      title\n      handle\n      seo {\n        title\n        description\n      }\n      # sortKey and reverse are NOT optional here. The Storefront API's default\n      # for blog articles is ID ascending, which is oldest first, so the index\n      # opened on a March article and buried anything new on the last page.\n      # Measured live 2026-09-23: page 2 ran June 4, June 8, June 8, July 16,\n      # July 22 top to bottom.\n      articles(\n        first: $first,\n        last: $last,\n        before: $startCursor,\n        after: $endCursor,\n        sortKey: PUBLISHED_AT,\n        reverse: true\n      ) {\n        nodes {\n          ...ArticleItem\n        }\n        pageInfo {\n          hasPreviousPage\n          hasNextPage\n          endCursor\n          startCursor\n        }\n\n      }\n    }\n  }\n  fragment ArticleItem on Article {\n    author: authorV2 {\n      name\n    }\n    contentHtml\n    excerpt(truncateAt: 120)\n    tags\n    handle\n    id\n    image {\n      id\n      altText\n      url\n      width\n      height\n    }\n    publishedAt\n    title\n    blog {\n      handle\n    }\n  }\n": {
    return: BlogQuery;
    variables: BlogQueryVariables;
  };
  '#graphql\n  query Blogs(\n    $country: CountryCode\n    $endCursor: String\n    $first: Int\n    $language: LanguageCode\n    $last: Int\n    $startCursor: String\n  ) @inContext(country: $country, language: $language) {\n    blogs(\n      first: $first,\n      last: $last,\n      before: $startCursor,\n      after: $endCursor\n    ) {\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n      nodes {\n        title\n        handle\n        seo {\n          title\n          description\n        }\n      }\n    }\n  }\n': {
    return: BlogsQuery;
    variables: BlogsQueryVariables;
  };
  '#graphql\n  query BundleWidgets($country: CountryCode, $language: LanguageCode)\n  @inContext(country: $country, language: $language) {\n    widgets: collection(handle: "widgets") {\n      products(first: 250) {\n        nodes { ...BundleWidget }\n      }\n    }\n  }\n  #graphql\n  fragment BundleWidget on Product {\n    id\n    handle\n    title\n    productType\n    createdAt\n    featuredImage { url altText width height }\n    variants(first: 1) {\n      nodes { id availableForSale price { amount currencyCode } }\n    }\n  }\n\n': {
    return: BundleWidgetsQuery;
    variables: BundleWidgetsQueryVariables;
  };
  '#graphql\n  query BundleEligible(\n    $query: String!\n    $country: CountryCode\n    $language: LanguageCode\n  ) @inContext(country: $country, language: $language) {\n    eligible: products(first: 250, query: $query) {\n      nodes { ...BundleWidget }\n    }\n  }\n  #graphql\n  fragment BundleWidget on Product {\n    id\n    handle\n    title\n    productType\n    createdAt\n    featuredImage { url altText width height }\n    variants(first: 1) {\n      nodes { id availableForSale price { amount currencyCode } }\n    }\n  }\n\n': {
    return: BundleEligibleQuery;
    variables: BundleEligibleQueryVariables;
  };
  '#graphql\n  query BundleKits($country: CountryCode, $language: LanguageCode)\n  @inContext(country: $country, language: $language) {\n    kits: collection(handle: "bundles") {\n      products(first: 20) {\n        nodes {\n          handle\n          title\n          featuredImage { url altText }\n          priceRange { minVariantPrice { amount currencyCode } }\n        }\n      }\n    }\n  }\n': {
    return: BundleKitsQuery;
    variables: BundleKitsQueryVariables;
  };
  '#graphql\n  #graphql\n  fragment MoneyProductItem on MoneyV2 {\n    amount\n    currencyCode\n  }\n  fragment ProductItem on Product {\n    id\n    handle\n    title\n    productType\n    worksWith: metafield(namespace: "custom", key: "works_with") { value }\n    tags\n    gifSupport: metafield(namespace: "custom", key: "gif_support") { value }\n    featuredImage {\n      id\n      altText\n      url\n    }\n    media(first: 25) {\n      nodes {\n        __typename\n        ... on Video {\n          id\n          previewImage {\n            url\n          }\n          sources {\n            url\n            mimeType\n            format\n            width\n            height\n          }\n        }\n      }\n    }\n    priceRange {\n      minVariantPrice {\n        ...MoneyProductItem\n      }\n      maxVariantPrice {\n        ...MoneyProductItem\n      }\n    }\n    compareAtPriceRange {\n      minVariantPrice {\n        ...MoneyProductItem\n      }\n    }\n  }\n\n  query Collection(\n    $handle: String!\n    $country: CountryCode\n    $language: LanguageCode\n    $first: Int\n    $last: Int\n    $startCursor: String\n    $endCursor: String\n  ) @inContext(country: $country, language: $language) {\n    collection(handle: $handle) {\n      id\n      handle\n      title\n      description\n      descriptionHtml\n      image {\n        url\n        width\n        height\n      }\n      seo {\n        title\n        description\n      }\n      h1: metafield(namespace: "custom", key: "h1") { value }\n      intro: metafield(namespace: "custom", key: "intro") { value }\n      faq: metafield(namespace: "custom", key: "faq") { value }\n      products(\n        first: $first,\n        last: $last,\n        before: $startCursor,\n        after: $endCursor\n      ) {\n        nodes {\n          ...ProductItem\n        }\n        pageInfo {\n          hasPreviousPage\n          hasNextPage\n          endCursor\n          startCursor\n        }\n      }\n    }\n  }\n': {
    return: CollectionQuery;
    variables: CollectionQueryVariables;
  };
  '#graphql\n  fragment Collection on Collection {\n    id\n    title\n    handle\n    image {\n      id\n      url\n      altText\n      width\n      height\n    }\n  }\n  query StoreCollections(\n    $country: CountryCode\n    $endCursor: String\n    $first: Int\n    $language: LanguageCode\n    $last: Int\n    $startCursor: String\n  ) @inContext(country: $country, language: $language) {\n    collections(\n      first: $first,\n      last: $last,\n      before: $startCursor,\n      after: $endCursor\n    ) {\n      nodes {\n        ...Collection\n      }\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n    }\n  }\n': {
    return: StoreCollectionsQuery;
    variables: StoreCollectionsQueryVariables;
  };
  '#graphql\n  query Catalog(\n    $country: CountryCode\n    $language: LanguageCode\n    $first: Int\n    $last: Int\n    $startCursor: String\n    $endCursor: String\n    $query: String\n    $sortKey: ProductSortKeys\n    $reverse: Boolean\n  ) @inContext(country: $country, language: $language) {\n    products(\n      first: $first\n      last: $last\n      before: $startCursor\n      after: $endCursor\n      query: $query\n      sortKey: $sortKey\n      reverse: $reverse\n    ) {\n      nodes {\n        ...CollectionItem\n      }\n      pageInfo {\n        hasPreviousPage\n        hasNextPage\n        startCursor\n        endCursor\n      }\n    }\n  }\n  #graphql\n  fragment MoneyCollectionItem on MoneyV2 {\n    amount\n    currencyCode\n  }\n  fragment CollectionItem on Product {\n    id\n    handle\n    title\n    productType\n    worksWith: metafield(namespace: "custom", key: "works_with") { value }\n    tags\n    gifSupport: metafield(namespace: "custom", key: "gif_support") { value }\n    featuredImage {\n      id\n      altText\n      url\n    }\n    media(first: 25) {\n      nodes {\n        __typename\n        ... on Video {\n          id\n          previewImage {\n            url\n          }\n          sources {\n            url\n            mimeType\n            format\n            width\n            height\n          }\n        }\n      }\n    }\n    priceRange {\n      minVariantPrice {\n        ...MoneyCollectionItem\n      }\n      maxVariantPrice {\n        ...MoneyCollectionItem\n      }\n    }\n    compareAtPriceRange {\n      minVariantPrice {\n        ...MoneyCollectionItem\n      }\n    }\n  }\n\n': {
    return: CatalogQuery;
    variables: CatalogQueryVariables;
  };
  '#graphql\n  query Page(\n    $language: LanguageCode,\n    $country: CountryCode,\n    $handle: String!\n  )\n  @inContext(language: $language, country: $country) {\n    page(handle: $handle) {\n      handle\n      id\n      title\n      body\n      seo {\n        description\n        title\n      }\n    }\n  }\n': {
    return: PageQuery;
    variables: PageQueryVariables;
  };
  '#graphql\n  fragment CommissionProof on Product {\n    handle\n    title\n    featuredImage { url altText }\n    priceRange { minVariantPrice { amount currencyCode } }\n  }\n  query CommissionProof(\n    $h0: String!\n    $h1: String!\n    $h2: String!\n    $country: CountryCode\n    $language: LanguageCode\n  ) @inContext(country: $country, language: $language) {\n    p0: product(handle: $h0) { ...CommissionProof }\n    p1: product(handle: $h1) { ...CommissionProof }\n    p2: product(handle: $h2) { ...CommissionProof }\n  }\n': {
    return: CommissionProofQuery;
    variables: CommissionProofQueryVariables;
  };
  '#graphql\n  fragment Policy on ShopPolicy {\n    body\n    handle\n    id\n    title\n    url\n  }\n  query Policy(\n    $country: CountryCode\n    $language: LanguageCode\n    $privacyPolicy: Boolean!\n    $refundPolicy: Boolean!\n    $shippingPolicy: Boolean!\n    $termsOfService: Boolean!\n  ) @inContext(language: $language, country: $country) {\n    shop {\n      privacyPolicy @include(if: $privacyPolicy) {\n        ...Policy\n      }\n      shippingPolicy @include(if: $shippingPolicy) {\n        ...Policy\n      }\n      termsOfService @include(if: $termsOfService) {\n        ...Policy\n      }\n      refundPolicy @include(if: $refundPolicy) {\n        ...Policy\n      }\n    }\n  }\n': {
    return: PolicyQuery;
    variables: PolicyQueryVariables;
  };
  '#graphql\n  fragment PolicyItem on ShopPolicy {\n    id\n    title\n    handle\n  }\n  query Policies ($country: CountryCode, $language: LanguageCode)\n    @inContext(country: $country, language: $language) {\n    shop {\n      privacyPolicy {\n        ...PolicyItem\n      }\n      shippingPolicy {\n        ...PolicyItem\n      }\n      termsOfService {\n        ...PolicyItem\n      }\n      refundPolicy {\n        ...PolicyItem\n      }\n      subscriptionPolicy {\n        id\n        title\n        handle\n      }\n    }\n  }\n': {
    return: PoliciesQuery;
    variables: PoliciesQueryVariables;
  };
  '#graphql\n  query Product(\n    $country: CountryCode\n    $handle: String!\n    $language: LanguageCode\n    $selectedOptions: [SelectedOptionInput!]!\n  ) @inContext(country: $country, language: $language) {\n    product(handle: $handle) {\n      ...Product\n    }\n    # Breadcrumb target collections, queried under both their current and\n    # legacy handle (see app/lib/collectionHandles.js and the 2026-09-28\n    # rename note on PDP_PRIMARY_CATEGORY in app/lib/nav.js). Handle-only:\n    # this is purely to find out which of the two currently resolves, not to\n    # render the collection itself, so the extra cost is four small root\n    # fields, not four full collection fetches. Only one pair is ever used\n    # (see classifyWidgetKind below), fetching both is what lets a single\n    # query serve every product without knowing its kind in advance.\n    #\n    # Handles are literal here, not interpolated from\n    # app/lib/collectionHandles.js: @shopify/graphql-codegen statically\n    # parses this tagged template and cannot resolve a JS expression inside\n    # it (confirmed 2026-09-28, codegen throws "Variable ... not found" on\n    # an interpolated handle). collectionHandles.js stays the source of\n    # truth for every non-query use; if either handle changes there, mirror\n    # it here too.\n    chatWidgetsCurrent: collection(handle: "twitch-chat-widgets") { handle }\n    chatWidgetsLegacy: collection(handle: "frontpage") { handle }\n    goalWidgetsCurrent: collection(handle: "twitch-goal-widgets") { handle }\n    goalWidgetsLegacy: collection(handle: "stream-widgets-templates") { handle }\n  }\n  #graphql\n  fragment Product on Product {\n    id\n    title\n    vendor\n    handle\n    productType\n    tags\n    descriptionHtml\n    worksWith: metafield(namespace: "custom", key: "works_with") { value }\n    # Ground-truth GIF-support flag for chat widgets. Not yet\n    # exposed to the Storefront API (checked 2026-09-26, resolves null) --\n    # left in the query so it starts working the moment storefront access is\n    # granted on the definition, with no code change needed. Until then\n    # hasGifSupport falls back to the public gif-support tag above.\n    gifSupport: metafield(namespace: "custom", key: "gif_support") { value }\n    description\n    encodedVariantExistence\n    encodedVariantAvailability\n    featuredImage {\n      id\n      url\n      altText\n      # width/height feed og:image:width/height. Without them the share card\n      # either lies about the shape of the image or says nothing, and this\n      # catalogue has no 1.91:1 art at all. See the meta function above.\n      width\n      height\n    }\n    # 25, not 10. This catalog runs to 15 images plus a demo video, and the\n    # video was imported last on nearly every product, so a cap of 10 silently\n    # dropped the video on 13 products: it was never fetched, so the gallery\n    # could not render it however correct the component was. It also truncated\n    # the image gallery on anything with more than 10 photos.\n    media(first: 25) {\n      nodes {\n        __typename\n        ... on MediaImage {\n          id\n          image {\n            id\n            url\n            altText\n          }\n        }\n        ... on Video {\n          id\n          alt\n          previewImage {\n            url\n          }\n          sources {\n            url\n            mimeType\n            format\n            width\n            height\n          }\n        }\n      }\n    }\n    options {\n      name\n      optionValues {\n        name\n        firstSelectableVariant {\n          ...ProductVariant\n        }\n        swatch {\n          color\n          image {\n            previewImage {\n              url\n            }\n          }\n        }\n      }\n    }\n    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {\n      ...ProductVariant\n    }\n    adjacentVariants (selectedOptions: $selectedOptions) {\n      ...ProductVariant\n    }\n    seo {\n      description\n      title\n    }\n  }\n  #graphql\n  fragment ProductVariant on ProductVariant {\n    availableForSale\n    compareAtPrice {\n      amount\n      currencyCode\n    }\n    id\n    image {\n      __typename\n      id\n      url\n      altText\n    }\n    price {\n      amount\n      currencyCode\n    }\n    product {\n      title\n      handle\n    }\n    selectedOptions {\n      name\n      value\n    }\n    sku\n    title\n    unitPrice {\n      amount\n      currencyCode\n    }\n  }\n\n\n': {
    return: ProductQuery;
    variables: ProductQueryVariables;
  };
  '#graphql\n  query ProductRecommendations(\n    $country: CountryCode\n    $language: LanguageCode\n    $productId: ID!\n  ) @inContext(country: $country, language: $language) {\n    productRecommendations(productId: $productId, intent: RELATED) {\n      id\n      title\n      handle\n      availableForSale\n      worksWith: metafield(namespace: "custom", key: "works_with") { value }\n      tags\n      gifSupport: metafield(namespace: "custom", key: "gif_support") { value }\n      priceRange {\n        minVariantPrice {\n          amount\n          currencyCode\n        }\n      }\n      compareAtPriceRange {\n        minVariantPrice {\n          amount\n          currencyCode\n        }\n      }\n      featuredImage {\n        id\n        altText\n        url\n      }\n      media(first: 25) {\n        nodes {\n          __typename\n          ... on Video {\n            id\n            previewImage {\n              url\n            }\n            sources {\n              url\n              mimeType\n              format\n              width\n              height\n            }\n          }\n        }\n      }\n    }\n  }\n': {
    return: ProductRecommendationsQuery;
    variables: ProductRecommendationsQueryVariables;
  };
  '#graphql\n  query RelatedProducts(\n    $country: CountryCode\n    $language: LanguageCode\n    $query: String\n  ) @inContext(country: $country, language: $language) {\n    products(first: 16, query: $query) {\n      nodes {\n        id\n        title\n        handle\n        worksWith: metafield(namespace: "custom", key: "works_with") { value }\n        tags\n        gifSupport: metafield(namespace: "custom", key: "gif_support") { value }\n        priceRange {\n          minVariantPrice {\n            amount\n            currencyCode\n          }\n        }\n        compareAtPriceRange {\n          minVariantPrice {\n            amount\n            currencyCode\n          }\n        }\n        featuredImage {\n          id\n          altText\n          url\n        }\n        media(first: 25) {\n          nodes {\n            __typename\n            ... on Video {\n              id\n              previewImage {\n                url\n              }\n              sources {\n                url\n                mimeType\n                format\n                width\n                height\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n': {
    return: RelatedProductsQuery;
    variables: RelatedProductsQueryVariables;
  };
  '#graphql\n  query ProductFaqPage($country: CountryCode, $language: LanguageCode)\n  @inContext(country: $country, language: $language) {\n    page(handle: "faq-frequently-asked-questions") {\n      body\n    }\n  }\n': {
    return: ProductFaqPageQuery;
    variables: ProductFaqPageQueryVariables;
  };
  '#graphql\n  query RegularSearch(\n    $country: CountryCode\n    $endCursor: String\n    $first: Int\n    $language: LanguageCode\n    $last: Int\n    $term: String!\n    $startCursor: String\n  ) @inContext(country: $country, language: $language) {\n    articles: search(\n      query: $term,\n      types: [ARTICLE],\n      first: $first,\n    ) {\n      nodes {\n        ...on Article {\n          ...SearchArticle\n        }\n      }\n    }\n    pages: search(\n      query: $term,\n      types: [PAGE],\n      first: $first,\n    ) {\n      nodes {\n        ...on Page {\n          ...SearchPage\n        }\n      }\n    }\n    products: search(\n      after: $endCursor,\n      before: $startCursor,\n      first: $first,\n      last: $last,\n      query: $term,\n      sortKey: RELEVANCE,\n      types: [PRODUCT],\n      unavailableProducts: HIDE,\n    ) {\n      nodes {\n        ...on Product {\n          ...SearchProduct\n        }\n      }\n      pageInfo {\n        ...PageInfoFragment\n      }\n    }\n  }\n  #graphql\n  fragment SearchProduct on Product {\n    __typename\n    handle\n    id\n    publishedAt\n    title\n    trackingParameters\n    vendor\n    selectedOrFirstAvailableVariant(\n      selectedOptions: []\n      ignoreUnknownOptions: true\n      caseInsensitiveMatch: true\n    ) {\n      id\n      image {\n        url\n        altText\n        width\n        height\n      }\n      price {\n        amount\n        currencyCode\n      }\n      compareAtPrice {\n        amount\n        currencyCode\n      }\n      selectedOptions {\n        name\n        value\n      }\n      product {\n        handle\n        title\n      }\n    }\n  }\n\n  #graphql\n  fragment SearchPage on Page {\n     __typename\n     handle\n    id\n    title\n    trackingParameters\n  }\n\n  #graphql\n  fragment SearchArticle on Article {\n    __typename\n    blog {\n      handle\n    }\n    handle\n    id\n    title\n    trackingParameters\n  }\n\n  #graphql\n  fragment PageInfoFragment on PageInfo {\n    hasNextPage\n    hasPreviousPage\n    startCursor\n    endCursor\n  }\n\n': {
    return: RegularSearchQuery;
    variables: RegularSearchQueryVariables;
  };
  '#graphql\n  query PredictiveSearch(\n    $country: CountryCode\n    $language: LanguageCode\n    $limit: Int!\n    $limitScope: PredictiveSearchLimitScope!\n    $term: String!\n    $types: [PredictiveSearchType!]\n  ) @inContext(country: $country, language: $language) {\n    predictiveSearch(\n      limit: $limit,\n      limitScope: $limitScope,\n      query: $term,\n      types: $types,\n    ) {\n      articles {\n        ...PredictiveArticle\n      }\n      collections {\n        ...PredictiveCollection\n      }\n      pages {\n        ...PredictivePage\n      }\n      products {\n        ...PredictiveProduct\n      }\n      queries {\n        ...PredictiveQuery\n      }\n    }\n  }\n  #graphql\n  fragment PredictiveArticle on Article {\n    __typename\n    id\n    title\n    handle\n    blog {\n      handle\n    }\n    image {\n      url\n      altText\n      width\n      height\n    }\n    trackingParameters\n  }\n\n  #graphql\n  fragment PredictiveCollection on Collection {\n    __typename\n    id\n    title\n    handle\n    image {\n      url\n      altText\n      width\n      height\n    }\n    trackingParameters\n  }\n\n  #graphql\n  fragment PredictivePage on Page {\n    __typename\n    id\n    title\n    handle\n    trackingParameters\n  }\n\n  #graphql\n  fragment PredictiveProduct on Product {\n    __typename\n    id\n    title\n    handle\n    trackingParameters\n    selectedOrFirstAvailableVariant(\n      selectedOptions: []\n      ignoreUnknownOptions: true\n      caseInsensitiveMatch: true\n    ) {\n      id\n      image {\n        url\n        altText\n        width\n        height\n      }\n      price {\n        amount\n        currencyCode\n      }\n      compareAtPrice {\n        amount\n        currencyCode\n      }\n    }\n  }\n\n  #graphql\n  fragment PredictiveQuery on SearchQuerySuggestion {\n    __typename\n    text\n    styledText\n    trackingParameters\n  }\n\n': {
    return: PredictiveSearchQuery;
    variables: PredictiveSearchQueryVariables;
  };
  '#graphql\n  query VideoWatchProduct($handle: String!) {\n    product(handle: $handle) {\n      id\n      handle\n      title\n      media(first: 25) {\n        nodes {\n          __typename\n          ... on Video {\n            id\n            alt\n            previewImage {\n              url\n            }\n            sources {\n              url\n              mimeType\n              format\n              width\n              height\n            }\n          }\n        }\n      }\n    }\n  }\n': {
    return: VideoWatchProductQuery;
    variables: VideoWatchProductQueryVariables;
  };
}

interface GeneratedMutationTypes {
  '#graphql\n  mutation NewsletterSignup($input: CustomerCreateInput!) {\n    customerCreate(input: $input) {\n      customer {\n        id\n      }\n      customerUserErrors {\n        code\n        field\n        message\n      }\n    }\n  }\n': {
    return: NewsletterSignupMutation;
    variables: NewsletterSignupMutationVariables;
  };
}

declare module '@shopify/hydrogen' {
  interface StorefrontQueries extends GeneratedQueryTypes {}
  interface StorefrontMutations extends GeneratedMutationTypes {}
}
