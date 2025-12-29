const Product = require('../models/product');


exports.syncCartProducts = async (req, res) => {
  try {
    const { products } = req.body;

    if (!products || !Array.isArray(products)) {
      return res.status(400).json({
        status: false,
        message: 'Products array is required'
      });
    }

    const syncedProducts = [];

    for (const item of products) {
      try {
        const product = await Product.findById(item.productId)
          .select('name slug productType variants simpleProduct price_slot SellerId BarCode')
          .lean();

        if (!product) {
       
          syncedProducts.push({
            productId: item.productId,
            status: 'DELETED',
            message: 'Product no longer available'
          });
          continue;
        }

     
        const isVariableProduct = product.productType === 'variable' && product.variants?.length > 0;

        if (isVariableProduct && item.variantAttributes) {
          // Find matching variant - flexible matching
          const matchingVariant = product.variants.find(v => {
            if (!v.attributes || !Array.isArray(v.attributes)) return false;
            
            // Match all attributes from cart item
            return item.variantAttributes.every(cartAttr => 
              v.attributes.some(prodAttr => 
                prodAttr.name === cartAttr.name && prodAttr.value === cartAttr.value
              )
            );
          });

          if (!matchingVariant) {
            console.log('Variant not found for:', item.productId, item.variantAttributes);
            syncedProducts.push({
              productId: item.productId,
              status: 'VARIANT_DELETED',
              message: 'Variant no longer available'
            });
            continue;
          }

          console.log('Variant found:', matchingVariant.attributes);

          // Return latest variant data
          syncedProducts.push({
            productId: item.productId,
            status: 'SUCCESS',
            data: {
              name: product.name,
              slug: product.slug,
              productType: product.productType,
              price: matchingVariant.price,
              offerPrice: matchingVariant.offerPrice,
              stock: matchingVariant.stock,
              images: matchingVariant.images,
              attributes: matchingVariant.attributes,
              isActive: matchingVariant.isActive,
              SellerId: product.SellerId,
              BarCode: product.BarCode,
              price_slot: product.price_slot
            }
          });

        } else {
          // Simple product
          if (!product.simpleProduct) {
            syncedProducts.push({
              productId: item.productId,
              status: 'DELETED',
              message: 'Product structure changed'
            });
            continue;
          }

          syncedProducts.push({
            productId: item.productId,
            status: 'SUCCESS',
            data: {
              name: product.name,
              slug: product.slug,
              productType: product.productType,
              price: product.simpleProduct.price,
              offerPrice: product.simpleProduct.offerPrice,
              stock: product.simpleProduct.stock,
              images: product.simpleProduct.images,
              SellerId: product.SellerId,
              BarCode: product.BarCode,
              price_slot: product.price_slot
            }
          });
        }

      } catch (error) {
        console.error(`Error syncing product ${item.productId}:`, error);
        syncedProducts.push({
          productId: item.productId,
          status: 'ERROR',
          message: 'Error fetching product data'
        });
      }
    }

    res.json({
      status: true,
      data: syncedProducts,
      message: 'Cart synced successfully'
    });

  } catch (error) {
    console.error('Cart sync error:', error);
    res.status(500).json({
      status: false,
      message: 'Server error during cart sync'
    });
  }
};


exports.syncWishlistProducts = async (req, res) => {
  try {
    const { products } = req.body;

    if (!products || !Array.isArray(products)) {
      return res.status(400).json({
        status: false,
        message: 'Products array is required'
      });
    }

    const syncedProducts = [];

    for (const item of products) {
      try {
        const product = await Product.findById(item.productId)
          .select('name slug productType variants simpleProduct')
          .lean();

        if (!product) {
          syncedProducts.push({
            productId: item.productId,
            status: 'DELETED'
          });
          continue;
        }

        const isVariableProduct = product.productType === 'variable' && product.variants?.length > 0;

        if (isVariableProduct && item.variantAttributes) {
          const matchingVariant = product.variants.find(v => 
            JSON.stringify(v.attributes) === JSON.stringify(item.variantAttributes)
          );

          if (!matchingVariant) {
            syncedProducts.push({
              productId: item.productId,
              status: 'VARIANT_DELETED'
            });
            continue;
          }

          syncedProducts.push({
            productId: item.productId,
            status: 'SUCCESS',
            data: {
              name: product.name,
              slug: product.slug,
              price: matchingVariant.price,
              offerPrice: matchingVariant.offerPrice,
              stock: matchingVariant.stock,
              images: matchingVariant.images,
              attributes: matchingVariant.attributes
            }
          });

        } else {
          if (!product.simpleProduct) {
            syncedProducts.push({
              productId: item.productId,
              status: 'DELETED'
            });
            continue;
          }

          syncedProducts.push({
            productId: item.productId,
            status: 'SUCCESS',
            data: {
              name: product.name,
              slug: product.slug,
              price: product.simpleProduct.price,
              offerPrice: product.simpleProduct.offerPrice,
              stock: product.simpleProduct.stock,
              images: product.simpleProduct.images
            }
          });
        }

      } catch (error) {
        syncedProducts.push({
          productId: item.productId,
          status: 'ERROR'
        });
      }
    }

    res.json({
      status: true,
      data: syncedProducts
    });

  } catch (error) {
    console.error('Wishlist sync error:', error);
    res.status(500).json({
      status: false,
      message: 'Server error'
    });
  }
};
