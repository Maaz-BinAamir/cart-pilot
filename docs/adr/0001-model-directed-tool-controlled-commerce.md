# Keep commerce authority outside the language model

Cart Pilot uses Groq-hosted Qwen 3.8 through the Vercel AI SDK to choose and sequence local Commerce tools. Prices, Inventory, delivery estimates, Checkout confirmation, and Order mutations remain in trusted application code. This preserves a real conversational agent while preventing a fluent model response from becoming a purchase or an authoritative store fact.

## Consequences

The model may explain and recommend, but it must call a Commerce tool for current facts. The `placeOrder` tool always requires the Shopper's approval, and the default model remains configurable because Qwen 3.8 is a preview model.

