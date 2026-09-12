# Cart Pilot

Cart Pilot is a demo retail context where a conversational shopping agent helps one remembered shopper discover electronics and manage simulated orders. Catalog and order facts come from commerce tools, never from model invention.

## Shopping

**Shopper**:
The person using the shopping conversation. The demo remembers one Shopper without requiring sign-in.
_Avoid_: User, buyer, customer

**Shopping agent**:
The conversational assistant that interprets a Shopper's needs, calls Commerce tools, and explains recommendations.
_Avoid_: Bot, support agent

**Preference**:
A quality the Shopper cares about when choosing a Product, such as portability, battery life, or gaming performance.
_Avoid_: Filter, requirement

**Delivery deadline**:
The latest date by which the Shopper needs an Order to arrive.
_Avoid_: Shipping date, delivery speed

**Recommendation**:
A Product proposed by the Shopping agent with reasons tied to the Shopper's budget, Preferences, and Delivery deadline.
_Avoid_: Search result, suggestion

## Catalog

**Catalog**:
The complete set of Products available to the Shopping agent.
_Avoid_: Inventory, store

**Product**:
A fictional electronics item that can be discovered, compared, and ordered.
_Avoid_: SKU, listing, item

**Review**:
A synthetic assessment of a Product written by a fictional shopper. Reviews are demo content, not real customer testimony.
_Avoid_: Testimonial, feedback

**Price**:
The current simulated amount required to order one Product. A Commerce tool is its authority.
_Avoid_: Cost, value

**Inventory**:
The current simulated quantity of a Product available to order. A Commerce tool is its authority.
_Avoid_: Availability, stock level

## Ordering

**Commerce tool**:
A trusted operation that reads or changes Catalog and Order facts on behalf of the Shopping agent.
_Avoid_: Function, action, plugin

**Checkout confirmation**:
The Shopper's explicit approval of a final Product, current Price, Delivery estimate, and saved address. It is required before an Order can be created.
_Avoid_: Checkout, purchase intent

**Order**:
A simulated purchase created after Checkout confirmation. It never creates a real payment obligation.
_Avoid_: Purchase, transaction

**Delivery**:
The fulfillment state and expected arrival of an Order.
_Avoid_: Shipment, tracking

**Shipping delay**:
An Admin scenario that moves an Order's expected arrival later.
_Avoid_: Late delivery, incident

**Cancellation**:
Ending an Order before shipment. Processing and packed Orders are eligible; shipped and delivered Orders are not.
_Avoid_: Refund, return

## Demo operations

**Admin scenario**:
A deliberate change to Price, Inventory, or Delivery used to test how the Shopping agent handles unexpected facts.
_Avoid_: Admin action, override

