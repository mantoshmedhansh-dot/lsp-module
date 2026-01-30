"""
Order Transformer
Transforms marketplace orders to OMS internal format
"""
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from uuid import UUID, uuid4
from decimal import Decimal

from sqlmodel import Session, select

from app.models import (
    MarketplaceSkuMapping,
    SKU,
)

logger = logging.getLogger(__name__)


class OrderTransformer:
    """
    Transforms orders from various marketplace formats to OMS internal format.
    Handles SKU mapping, address normalization, and field conversion.
    """

    def __init__(self, session: Session, company_id: UUID):
        self.session = session
        self.company_id = company_id
        self._sku_mapping_cache: Dict[str, UUID] = {}

    def transform_marketplace_order(
        self,
        raw_order: dict,
        channel: str,
        connection_id: UUID
    ) -> dict:
        """
        Transform a raw marketplace order to OMS format.

        Args:
            raw_order: Raw order data from marketplace API
            channel: Marketplace channel (AMAZON, FLIPKART, SHOPIFY, etc.)
            connection_id: UUID of the marketplace connection

        Returns:
            Transformed order data ready for OMS
        """
        transformer_map = {
            "AMAZON": self._transform_amazon_order,
            "FLIPKART": self._transform_flipkart_order,
            "SHOPIFY": self._transform_shopify_order,
            "MYNTRA": self._transform_myntra_order,
            "MEESHO": self._transform_meesho_order,
        }

        transformer = transformer_map.get(channel, self._transform_generic_order)
        return transformer(raw_order, connection_id)

    def _transform_amazon_order(self, raw_order: dict, connection_id: UUID) -> dict:
        """Transform Amazon SP-API order to OMS format."""
        # Extract shipping address
        shipping_address = raw_order.get("ShippingAddress", {})

        # Transform line items
        items = []
        for item in raw_order.get("OrderItems", []):
            sku_id = self._resolve_sku(item.get("ASIN"), "AMAZON")
            items.append({
                "skuId": sku_id,
                "marketplaceSku": item.get("ASIN"),
                "sellerSku": item.get("SellerSKU"),
                "quantity": int(item.get("QuantityOrdered", 1)),
                "unitPrice": self._parse_money(item.get("ItemPrice", {})),
                "taxAmount": self._parse_money(item.get("ItemTax", {})),
                "discountAmount": self._parse_money(item.get("PromotionDiscount", {})),
                "title": item.get("Title", ""),
            })

        return {
            "companyId": str(self.company_id),
            "connectionId": str(connection_id),
            "channel": "AMAZON",
            "marketplaceOrderId": raw_order.get("AmazonOrderId"),
            "orderNo": f"AMZ-{raw_order.get('AmazonOrderId')}",
            "orderDate": self._parse_datetime(raw_order.get("PurchaseDate")),
            "status": self._map_amazon_status(raw_order.get("OrderStatus")),
            "fulfillmentChannel": raw_order.get("FulfillmentChannel"),  # AFN or MFN

            # Customer info
            "customerName": shipping_address.get("Name", ""),
            "customerEmail": raw_order.get("BuyerEmail", ""),
            "customerPhone": shipping_address.get("Phone", ""),

            # Shipping address
            "shippingAddress": {
                "name": shipping_address.get("Name", ""),
                "addressLine1": shipping_address.get("AddressLine1", ""),
                "addressLine2": shipping_address.get("AddressLine2", ""),
                "city": shipping_address.get("City", ""),
                "state": shipping_address.get("StateOrRegion", ""),
                "postalCode": shipping_address.get("PostalCode", ""),
                "country": shipping_address.get("CountryCode", "IN"),
                "phone": shipping_address.get("Phone", ""),
            },

            # Financial
            "subtotal": self._parse_money(raw_order.get("OrderTotal", {})),
            "shippingFee": self._calculate_shipping_fee(raw_order),
            "taxAmount": self._calculate_total_tax(items),
            "discountAmount": self._calculate_total_discount(items),
            "totalAmount": self._parse_money(raw_order.get("OrderTotal", {})),
            "currency": raw_order.get("OrderTotal", {}).get("CurrencyCode", "INR"),

            # Payment
            "paymentMethod": raw_order.get("PaymentMethod", ""),
            "paymentStatus": self._map_amazon_payment_status(raw_order.get("OrderStatus")),

            # Items
            "items": items,

            # Metadata
            "metadata": {
                "amazonOrderId": raw_order.get("AmazonOrderId"),
                "isPrime": raw_order.get("IsPrime", False),
                "isBusinessOrder": raw_order.get("IsBusinessOrder", False),
                "earliestShipDate": raw_order.get("EarliestShipDate"),
                "latestShipDate": raw_order.get("LatestShipDate"),
                "earliestDeliveryDate": raw_order.get("EarliestDeliveryDate"),
                "latestDeliveryDate": raw_order.get("LatestDeliveryDate"),
            },
        }

    def _transform_flipkart_order(self, raw_order: dict, connection_id: UUID) -> dict:
        """Transform Flipkart Seller API order to OMS format."""
        shipping_address = raw_order.get("shipping_address", {})

        items = []
        for item in raw_order.get("order_items", []):
            sku_id = self._resolve_sku(item.get("fsn"), "FLIPKART")
            items.append({
                "skuId": sku_id,
                "marketplaceSku": item.get("fsn"),
                "sellerSku": item.get("seller_sku_id"),
                "quantity": int(item.get("quantity", 1)),
                "unitPrice": Decimal(str(item.get("price_per_unit", 0))),
                "taxAmount": Decimal(str(item.get("tax_amount", 0))),
                "discountAmount": Decimal(str(item.get("discount", 0))),
                "title": item.get("product_title", ""),
            })

        return {
            "companyId": str(self.company_id),
            "connectionId": str(connection_id),
            "channel": "FLIPKART",
            "marketplaceOrderId": raw_order.get("order_id"),
            "orderNo": f"FK-{raw_order.get('order_id')}",
            "orderDate": self._parse_datetime(raw_order.get("order_date")),
            "status": self._map_flipkart_status(raw_order.get("order_state")),

            "customerName": shipping_address.get("name", ""),
            "customerPhone": shipping_address.get("phone", ""),

            "shippingAddress": {
                "name": shipping_address.get("name", ""),
                "addressLine1": shipping_address.get("address_line_1", ""),
                "addressLine2": shipping_address.get("address_line_2", ""),
                "city": shipping_address.get("city", ""),
                "state": shipping_address.get("state", ""),
                "postalCode": shipping_address.get("pincode", ""),
                "country": "IN",
                "phone": shipping_address.get("phone", ""),
            },

            "subtotal": Decimal(str(raw_order.get("total_price", 0))),
            "shippingFee": Decimal(str(raw_order.get("shipping_charge", 0))),
            "totalAmount": Decimal(str(raw_order.get("total_price", 0))),
            "currency": "INR",

            "paymentMethod": raw_order.get("payment_method", ""),
            "paymentStatus": "PAID" if raw_order.get("is_prepaid") else "COD",

            "items": items,

            "metadata": {
                "flipkartOrderId": raw_order.get("order_id"),
                "dispatchByDate": raw_order.get("dispatch_by_date"),
                "deliveryByDate": raw_order.get("delivery_by_date"),
                "isPrepaid": raw_order.get("is_prepaid", False),
            },
        }

    def _transform_shopify_order(self, raw_order: dict, connection_id: UUID) -> dict:
        """Transform Shopify Admin API order to OMS format."""
        shipping_address = raw_order.get("shipping_address", {})
        customer = raw_order.get("customer", {})

        items = []
        for item in raw_order.get("line_items", []):
            sku_id = self._resolve_sku(item.get("sku"), "SHOPIFY")
            items.append({
                "skuId": sku_id,
                "marketplaceSku": item.get("sku"),
                "sellerSku": item.get("sku"),
                "quantity": int(item.get("quantity", 1)),
                "unitPrice": Decimal(str(item.get("price", 0))),
                "taxAmount": sum(
                    Decimal(str(t.get("price", 0)))
                    for t in item.get("tax_lines", [])
                ),
                "discountAmount": sum(
                    Decimal(str(d.get("amount", 0)))
                    for d in item.get("discount_allocations", [])
                ),
                "title": item.get("title", ""),
            })

        return {
            "companyId": str(self.company_id),
            "connectionId": str(connection_id),
            "channel": "SHOPIFY",
            "marketplaceOrderId": str(raw_order.get("id")),
            "orderNo": f"SHOP-{raw_order.get('order_number', raw_order.get('id'))}",
            "orderDate": self._parse_datetime(raw_order.get("created_at")),
            "status": self._map_shopify_status(raw_order),

            "customerName": f"{customer.get('first_name', '')} {customer.get('last_name', '')}".strip(),
            "customerEmail": customer.get("email", raw_order.get("email", "")),
            "customerPhone": shipping_address.get("phone", ""),

            "shippingAddress": {
                "name": f"{shipping_address.get('first_name', '')} {shipping_address.get('last_name', '')}".strip(),
                "addressLine1": shipping_address.get("address1", ""),
                "addressLine2": shipping_address.get("address2", ""),
                "city": shipping_address.get("city", ""),
                "state": shipping_address.get("province", ""),
                "postalCode": shipping_address.get("zip", ""),
                "country": shipping_address.get("country_code", "IN"),
                "phone": shipping_address.get("phone", ""),
            },

            "subtotal": Decimal(str(raw_order.get("subtotal_price", 0))),
            "shippingFee": sum(
                Decimal(str(line.get("price", 0)))
                for line in raw_order.get("shipping_lines", [])
            ),
            "taxAmount": Decimal(str(raw_order.get("total_tax", 0))),
            "discountAmount": Decimal(str(raw_order.get("total_discounts", 0))),
            "totalAmount": Decimal(str(raw_order.get("total_price", 0))),
            "currency": raw_order.get("currency", "INR"),

            "paymentMethod": raw_order.get("gateway", ""),
            "paymentStatus": self._map_shopify_payment_status(raw_order.get("financial_status")),

            "items": items,

            "metadata": {
                "shopifyOrderId": raw_order.get("id"),
                "orderNumber": raw_order.get("order_number"),
                "note": raw_order.get("note"),
                "tags": raw_order.get("tags"),
                "source": raw_order.get("source_name"),
            },
        }

    def _transform_myntra_order(self, raw_order: dict, connection_id: UUID) -> dict:
        """Transform Myntra order to OMS format."""
        shipping_address = raw_order.get("deliveryAddress", {})

        items = []
        for item in raw_order.get("items", []):
            sku_id = self._resolve_sku(item.get("styleId"), "MYNTRA")
            items.append({
                "skuId": sku_id,
                "marketplaceSku": item.get("styleId"),
                "sellerSku": item.get("sellerSku"),
                "quantity": int(item.get("quantity", 1)),
                "unitPrice": Decimal(str(item.get("mrp", 0))),
                "taxAmount": Decimal(str(item.get("tax", 0))),
                "discountAmount": Decimal(str(item.get("discount", 0))),
                "title": item.get("productName", ""),
            })

        return {
            "companyId": str(self.company_id),
            "connectionId": str(connection_id),
            "channel": "MYNTRA",
            "marketplaceOrderId": raw_order.get("orderId"),
            "orderNo": f"MYN-{raw_order.get('orderId')}",
            "orderDate": self._parse_datetime(raw_order.get("orderDate")),
            "status": self._map_myntra_status(raw_order.get("status")),

            "customerName": shipping_address.get("name", ""),
            "customerPhone": shipping_address.get("phone", ""),

            "shippingAddress": {
                "name": shipping_address.get("name", ""),
                "addressLine1": shipping_address.get("addressLine1", ""),
                "addressLine2": shipping_address.get("addressLine2", ""),
                "city": shipping_address.get("city", ""),
                "state": shipping_address.get("state", ""),
                "postalCode": shipping_address.get("pincode", ""),
                "country": "IN",
                "phone": shipping_address.get("phone", ""),
            },

            "subtotal": Decimal(str(raw_order.get("totalAmount", 0))),
            "totalAmount": Decimal(str(raw_order.get("totalAmount", 0))),
            "currency": "INR",

            "paymentMethod": raw_order.get("paymentMode", ""),
            "paymentStatus": "PAID" if raw_order.get("isPrepaid") else "COD",

            "items": items,

            "metadata": {
                "myntraOrderId": raw_order.get("orderId"),
                "dispatchSla": raw_order.get("dispatchSla"),
            },
        }

    def _transform_meesho_order(self, raw_order: dict, connection_id: UUID) -> dict:
        """Transform Meesho order to OMS format."""
        shipping_address = raw_order.get("shipping_address", {})

        items = []
        for item in raw_order.get("products", []):
            sku_id = self._resolve_sku(item.get("sku"), "MEESHO")
            items.append({
                "skuId": sku_id,
                "marketplaceSku": item.get("sku"),
                "sellerSku": item.get("seller_sku"),
                "quantity": int(item.get("quantity", 1)),
                "unitPrice": Decimal(str(item.get("selling_price", 0))),
                "title": item.get("product_name", ""),
            })

        return {
            "companyId": str(self.company_id),
            "connectionId": str(connection_id),
            "channel": "MEESHO",
            "marketplaceOrderId": raw_order.get("order_id"),
            "orderNo": f"MSH-{raw_order.get('order_id')}",
            "orderDate": self._parse_datetime(raw_order.get("created_at")),
            "status": self._map_meesho_status(raw_order.get("status")),

            "customerName": shipping_address.get("customer_name", ""),
            "customerPhone": shipping_address.get("phone", ""),

            "shippingAddress": {
                "name": shipping_address.get("customer_name", ""),
                "addressLine1": shipping_address.get("address", ""),
                "city": shipping_address.get("city", ""),
                "state": shipping_address.get("state", ""),
                "postalCode": shipping_address.get("pincode", ""),
                "country": "IN",
                "phone": shipping_address.get("phone", ""),
            },

            "totalAmount": Decimal(str(raw_order.get("order_total", 0))),
            "currency": "INR",

            "paymentMethod": "COD" if raw_order.get("is_cod") else "PREPAID",
            "paymentStatus": "COD" if raw_order.get("is_cod") else "PAID",

            "items": items,

            "metadata": {
                "meeshoOrderId": raw_order.get("order_id"),
                "subOrderId": raw_order.get("sub_order_id"),
            },
        }

    def _transform_generic_order(self, raw_order: dict, connection_id: UUID) -> dict:
        """Transform a generic marketplace order."""
        return {
            "companyId": str(self.company_id),
            "connectionId": str(connection_id),
            "channel": "UNKNOWN",
            "marketplaceOrderId": raw_order.get("order_id", raw_order.get("id")),
            "orderNo": f"ORD-{raw_order.get('order_id', raw_order.get('id'))}",
            "orderDate": datetime.utcnow(),
            "status": "PENDING",
            "totalAmount": Decimal("0"),
            "currency": "INR",
            "items": [],
            "metadata": {"raw": raw_order},
        }

    def _resolve_sku(self, marketplace_sku: Optional[str], channel: str) -> Optional[str]:
        """
        Resolve marketplace SKU to internal SKU ID.
        Uses cache for performance.
        """
        if not marketplace_sku:
            return None

        cache_key = f"{channel}:{marketplace_sku}"
        if cache_key in self._sku_mapping_cache:
            return str(self._sku_mapping_cache[cache_key])

        # Look up in database
        mapping = self.session.exec(
            select(MarketplaceSkuMapping).where(
                MarketplaceSkuMapping.companyId == self.company_id,
                MarketplaceSkuMapping.channel == channel,
                MarketplaceSkuMapping.marketplaceSku == marketplace_sku
            )
        ).first()

        if mapping:
            self._sku_mapping_cache[cache_key] = mapping.skuId
            return str(mapping.skuId)

        logger.warning(f"SKU mapping not found: {channel}:{marketplace_sku}")
        return None

    def _parse_money(self, money_obj: dict) -> Decimal:
        """Parse Amazon money object to Decimal."""
        if not money_obj:
            return Decimal("0")
        return Decimal(str(money_obj.get("Amount", 0)))

    def _parse_datetime(self, dt_str: Optional[str]) -> Optional[datetime]:
        """Parse datetime string to datetime object."""
        if not dt_str:
            return None
        try:
            # Try ISO format
            return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            try:
                # Try common format
                return datetime.strptime(dt_str, "%Y-%m-%dT%H:%M:%S")
            except (ValueError, AttributeError):
                return None

    def _calculate_shipping_fee(self, raw_order: dict) -> Decimal:
        """Calculate total shipping fee from Amazon order."""
        total = Decimal("0")
        for item in raw_order.get("OrderItems", []):
            total += self._parse_money(item.get("ShippingPrice", {}))
        return total

    def _calculate_total_tax(self, items: List[dict]) -> Decimal:
        """Calculate total tax from items."""
        return sum(item.get("taxAmount", Decimal("0")) for item in items)

    def _calculate_total_discount(self, items: List[dict]) -> Decimal:
        """Calculate total discount from items."""
        return sum(item.get("discountAmount", Decimal("0")) for item in items)

    # Status mapping methods
    def _map_amazon_status(self, status: Optional[str]) -> str:
        """Map Amazon order status to OMS status."""
        mapping = {
            "Pending": "PENDING",
            "Unshipped": "CONFIRMED",
            "PartiallyShipped": "PROCESSING",
            "Shipped": "SHIPPED",
            "Canceled": "CANCELLED",
            "Unfulfillable": "FAILED",
        }
        return mapping.get(status or "", "PENDING")

    def _map_amazon_payment_status(self, status: Optional[str]) -> str:
        """Map Amazon order status to payment status."""
        if status in ["Shipped", "PartiallyShipped", "Unshipped"]:
            return "PAID"
        if status == "Canceled":
            return "REFUNDED"
        return "PENDING"

    def _map_flipkart_status(self, status: Optional[str]) -> str:
        """Map Flipkart order status to OMS status."""
        mapping = {
            "APPROVED": "CONFIRMED",
            "PACKING_IN_PROGRESS": "PROCESSING",
            "PACKED": "PACKED",
            "READY_TO_DISPATCH": "READY_TO_SHIP",
            "SHIPPED": "SHIPPED",
            "DELIVERED": "DELIVERED",
            "CANCELLED": "CANCELLED",
            "RETURN_REQUESTED": "RETURN_REQUESTED",
        }
        return mapping.get(status or "", "PENDING")

    def _map_shopify_status(self, raw_order: dict) -> str:
        """Map Shopify order status to OMS status."""
        fulfillment_status = raw_order.get("fulfillment_status")
        if raw_order.get("cancelled_at"):
            return "CANCELLED"
        if fulfillment_status == "fulfilled":
            return "DELIVERED"
        if fulfillment_status == "partial":
            return "SHIPPED"
        if raw_order.get("confirmed"):
            return "CONFIRMED"
        return "PENDING"

    def _map_shopify_payment_status(self, status: Optional[str]) -> str:
        """Map Shopify financial status to payment status."""
        mapping = {
            "pending": "PENDING",
            "authorized": "AUTHORIZED",
            "partially_paid": "PARTIAL",
            "paid": "PAID",
            "partially_refunded": "PARTIAL_REFUND",
            "refunded": "REFUNDED",
            "voided": "VOIDED",
        }
        return mapping.get(status or "", "PENDING")

    def _map_myntra_status(self, status: Optional[str]) -> str:
        """Map Myntra order status to OMS status."""
        mapping = {
            "CREATED": "PENDING",
            "CONFIRMED": "CONFIRMED",
            "PACKED": "PACKED",
            "SHIPPED": "SHIPPED",
            "DELIVERED": "DELIVERED",
            "CANCELLED": "CANCELLED",
            "RETURNED": "RETURNED",
        }
        return mapping.get(status or "", "PENDING")

    def _map_meesho_status(self, status: Optional[str]) -> str:
        """Map Meesho order status to OMS status."""
        mapping = {
            "pending": "PENDING",
            "approved": "CONFIRMED",
            "packed": "PACKED",
            "shipped": "SHIPPED",
            "delivered": "DELIVERED",
            "cancelled": "CANCELLED",
            "rto": "RTO",
        }
        return mapping.get(status or "", "PENDING")
