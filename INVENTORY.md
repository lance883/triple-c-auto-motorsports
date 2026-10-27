# Inventory listings

The public pages are preowned-auto.html and motorsports.html. Both read inventory-data.json. The live file starts empty; never publish the mockup vehicles as actual inventory.

Add a JSON object per real vehicle, with a unique id, category (auto or motorsports), status (available or sold), year, make, model, type, price (number in USD or null for Call for price), mileage and/or hours (numbers), transmission, stockNumber, vin, description, addedAt (ISO date), and photos (array of relative asset paths or HTTPS URLs). Put images under assets/inventory/. Only available listings are shown; omitted status also means available. Make/type/year filters derive from available listings. Unknown prices are excluded by a maximum-price filter and sorted last.

Commit data and photos together. Run npm run build and npm test before publishing. Do not put customer information or credit applications in inventory data.
