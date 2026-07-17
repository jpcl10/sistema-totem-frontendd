# Settings Phase 2A Contracts

Fonte: contratos reais existentes no backend em 2026-07-13.

## GET /settings/online-orders

Metodo: `GET`

Rota: `/settings/online-orders`

Query params:

```json
{
  "storeId": "string cuid required"
}
```

Request body: nenhum.

Response body:

```json
{
  "storeId": "cmra0xven000xvwashub9xwug",
  "settings": null,
  "effective": {
    "onlineOrderingEnabled": true,
    "digitalMenuEnabled": true,
    "deliveryEnabled": false,
    "pickupEnabled": true,
    "counterEnabled": false,
    "dineInEnabled": false,
    "allowOrdersOutsideHours": false,
    "autoAcceptOrders": false,
    "minimumOrderInCents": 0,
    "estimatedPreparationMinutes": 30,
    "estimatedDeliveryMinutes": 45,
    "freeDeliveryAboveInCents": null,
    "defaultDeliveryFeeInCents": 0,
    "closedMessage": null,
    "checkoutNotice": null,
    "orderConfirmationMessage": null,
    "requireCustomerName": true,
    "requireCustomerPhone": true,
    "requireDeliveryAddress": true,
    "allowCustomerNotes": true
  },
  "source": "DEFAULT"
}
```

Enums:

```json
{
  "source": ["ONLINE_STORE_SETTINGS", "DEFAULT"]
}
```

Campos opcionais: nenhum no response; `settings` pode vir como objeto persistido ou `null`.

Campos nullable:

```json
[
  "settings",
  "effective.freeDeliveryAboveInCents",
  "effective.closedMessage",
  "effective.checkoutNotice",
  "effective.orderConfirmationMessage"
]
```

Validacoes:

```json
{
  "storeId": "z.string().cuid()"
}
```

Status HTTP:

```json
{
  "200": "OK",
  "400": "Query invalida",
  "404": "Store not found",
  "401": "JWT invalido/ausente",
  "403": "Tenant/role sem acesso"
}
```

Schema Zod de origem: `storeSettingsQuerySchema` em `src/modules/settings/schemas/settings-schemas.ts`

Controller: `getOnlineOrderSettingsController` em `src/modules/settings/controllers/settings-controllers.ts`

Service: `OnlineStoreSettingsService.getOrDefaults` em `src/modules/settings/services/online-store-settings-service.ts`

Presenter: nenhum.

## PATCH /settings/online-orders

Metodo: `PATCH`

Rota: `/settings/online-orders`

Query params:

```json
{
  "storeId": "string cuid required"
}
```

Request body:

```json
{
  "onlineOrderingEnabled": true,
  "digitalMenuEnabled": true,
  "autoAcceptOrders": false,
  "minimumOrderInCents": 2000,
  "estimatedPreparationMinutes": 30,
  "allowOrdersOutsideHours": false,
  "closedMessage": "Estamos fechados no momento.",
  "checkoutNotice": "Confira os dados antes de enviar o pedido.",
  "orderConfirmationMessage": "Pedido recebido.",
  "requireCustomerName": true,
  "requireCustomerPhone": true,
  "allowCustomerNotes": true
}
```

Request body minimo:

```json
{
  "minimumOrderInCents": 2000
}
```

Response body:

```json
{
  "settings": {
    "id": "cmxxxxxxxxxxxxxxxxxxxxxxx",
    "organizationId": "cmra0xvea000rvwasonliufxu",
    "storeId": "cmra0xven000xvwashub9xwug",
    "onlineOrderingEnabled": true,
    "digitalMenuEnabled": true,
    "deliveryEnabled": false,
    "pickupEnabled": true,
    "counterEnabled": false,
    "dineInEnabled": false,
    "allowOrdersOutsideHours": false,
    "autoAcceptOrders": false,
    "minimumOrderInCents": 2000,
    "estimatedPreparationMinutes": 30,
    "estimatedDeliveryMinutes": 45,
    "freeDeliveryAboveInCents": null,
    "defaultDeliveryFeeInCents": 0,
    "closedMessage": "Estamos fechados no momento.",
    "checkoutNotice": "Confira os dados antes de enviar o pedido.",
    "orderConfirmationMessage": "Pedido recebido.",
    "requireCustomerName": true,
    "requireCustomerPhone": true,
    "requireDeliveryAddress": true,
    "allowCustomerNotes": true,
    "createdAt": "2026-07-13T00:00:00.000Z",
    "updatedAt": "2026-07-13T00:00:00.000Z"
  }
}
```

Enums: nenhum.

Campos opcionais:

```json
[
  "onlineOrderingEnabled",
  "digitalMenuEnabled",
  "autoAcceptOrders",
  "minimumOrderInCents",
  "estimatedPreparationMinutes",
  "allowOrdersOutsideHours",
  "closedMessage",
  "checkoutNotice",
  "orderConfirmationMessage",
  "requireCustomerName",
  "requireCustomerPhone",
  "allowCustomerNotes"
]
```

Campos nullable:

```json
[
  "closedMessage",
  "checkoutNotice",
  "orderConfirmationMessage"
]
```

Validacoes:

```json
{
  "storeId": "z.string().cuid()",
  "onlineOrderingEnabled": "z.boolean().optional()",
  "digitalMenuEnabled": "z.boolean().optional()",
  "autoAcceptOrders": "z.boolean().optional()",
  "minimumOrderInCents": "z.number().int().min(0).optional()",
  "estimatedPreparationMinutes": "z.number().int().min(0).optional()",
  "allowOrdersOutsideHours": "z.boolean().optional()",
  "closedMessage": "z.string().trim().min(1).nullable().optional()",
  "checkoutNotice": "z.string().trim().min(1).nullable().optional()",
  "orderConfirmationMessage": "z.string().trim().min(1).nullable().optional()",
  "requireCustomerName": "z.boolean().optional()",
  "requireCustomerPhone": "z.boolean().optional()",
  "allowCustomerNotes": "z.boolean().optional()"
}
```

Status HTTP:

```json
{
  "200": "OK",
  "400": "Body/query invalido",
  "404": "Store not found",
  "401": "JWT invalido/ausente",
  "403": "Tenant/role sem acesso"
}
```

Schema Zod de origem: `storeSettingsQuerySchema`, `updateOnlineOrderSettingsSchema`

Controller: `updateOnlineOrderSettingsController`

Service: `OnlineStoreSettingsService.updateOnlineOrders`

Presenter: nenhum.

## GET /settings/delivery

Metodo: `GET`

Rota: `/settings/delivery`

Query params:

```json
{
  "storeId": "string cuid required"
}
```

Request body: nenhum.

Response body:

```json
{
  "storeId": "cmra0xven000xvwashub9xwug",
  "settings": null,
  "delivery": {
    "deliveryEnabled": false,
    "pickupEnabled": true,
    "counterEnabled": false,
    "dineInEnabled": false,
    "estimatedDeliveryMinutes": 45,
    "freeDeliveryAboveInCents": null,
    "defaultDeliveryFeeInCents": 0,
    "requireDeliveryAddress": true
  },
  "source": "DEFAULT"
}
```

Enums:

```json
{
  "source": ["ONLINE_STORE_SETTINGS", "DEFAULT"]
}
```

Campos opcionais: nenhum no response.

Campos nullable:

```json
[
  "settings",
  "delivery.freeDeliveryAboveInCents"
]
```

Validacoes:

```json
{
  "storeId": "z.string().cuid()"
}
```

Status HTTP:

```json
{
  "200": "OK",
  "400": "Query invalida",
  "404": "Store not found",
  "401": "JWT invalido/ausente",
  "403": "Tenant/role sem acesso"
}
```

Schema Zod de origem: `storeSettingsQuerySchema`

Controller: `getDeliverySettingsController`

Service: `OnlineStoreSettingsService.getOrDefaults`

Presenter: nenhum.

## PATCH /settings/delivery

Metodo: `PATCH`

Rota: `/settings/delivery`

Query params:

```json
{
  "storeId": "string cuid required"
}
```

Request body:

```json
{
  "deliveryEnabled": true,
  "pickupEnabled": true,
  "counterEnabled": false,
  "dineInEnabled": false,
  "allowOrdersOutsideHours": false,
  "estimatedDeliveryMinutes": 45,
  "freeDeliveryAboveInCents": 10000,
  "defaultDeliveryFeeInCents": 500,
  "requireDeliveryAddress": true
}
```

Request body minimo:

```json
{
  "deliveryEnabled": true
}
```

Response body:

```json
{
  "settings": {
    "id": "cmxxxxxxxxxxxxxxxxxxxxxxx",
    "organizationId": "cmra0xvea000rvwasonliufxu",
    "storeId": "cmra0xven000xvwashub9xwug",
    "onlineOrderingEnabled": true,
    "digitalMenuEnabled": true,
    "deliveryEnabled": true,
    "pickupEnabled": true,
    "counterEnabled": false,
    "dineInEnabled": false,
    "allowOrdersOutsideHours": false,
    "autoAcceptOrders": false,
    "minimumOrderInCents": 0,
    "estimatedPreparationMinutes": 30,
    "estimatedDeliveryMinutes": 45,
    "freeDeliveryAboveInCents": 10000,
    "defaultDeliveryFeeInCents": 500,
    "closedMessage": null,
    "checkoutNotice": null,
    "orderConfirmationMessage": null,
    "requireCustomerName": true,
    "requireCustomerPhone": true,
    "requireDeliveryAddress": true,
    "allowCustomerNotes": true,
    "createdAt": "2026-07-13T00:00:00.000Z",
    "updatedAt": "2026-07-13T00:00:00.000Z"
  }
}
```

Enums: nenhum.

Campos opcionais:

```json
[
  "deliveryEnabled",
  "pickupEnabled",
  "counterEnabled",
  "dineInEnabled",
  "allowOrdersOutsideHours",
  "estimatedDeliveryMinutes",
  "freeDeliveryAboveInCents",
  "defaultDeliveryFeeInCents",
  "requireDeliveryAddress"
]
```

Campos nullable:

```json
[
  "freeDeliveryAboveInCents"
]
```

Validacoes:

```json
{
  "storeId": "z.string().cuid()",
  "deliveryEnabled": "z.boolean().optional()",
  "pickupEnabled": "z.boolean().optional()",
  "counterEnabled": "z.boolean().optional()",
  "dineInEnabled": "z.boolean().optional()",
  "allowOrdersOutsideHours": "z.boolean().optional()",
  "estimatedDeliveryMinutes": "z.number().int().min(0).optional()",
  "freeDeliveryAboveInCents": "z.number().int().min(0).nullable().optional()",
  "defaultDeliveryFeeInCents": "z.number().int().min(0).optional()",
  "requireDeliveryAddress": "z.boolean().optional()"
}
```

Status HTTP:

```json
{
  "200": "OK",
  "400": "Body/query invalido",
  "404": "Store not found",
  "401": "JWT invalido/ausente",
  "403": "Tenant/role sem acesso"
}
```

Schema Zod de origem: `storeSettingsQuerySchema`, `updateDeliverySettingsSchema`

Controller: `updateDeliverySettingsController`

Service: `OnlineStoreSettingsService.updateDelivery`

Presenter: nenhum.

## GET /settings/delivery/rules

Metodo: `GET`

Rota: `/settings/delivery/rules`

Query params:

```json
{
  "storeId": "string cuid required"
}
```

Request body: nenhum.

Response body:

```json
{
  "rules": [
    {
      "id": "cmxxxxxxxxxxxxxxxxxxxxxxx",
      "organizationId": "cmra0xvea000rvwasonliufxu",
      "storeId": "cmra0xven000xvwashub9xwug",
      "name": "Centro",
      "type": "NEIGHBORHOOD",
      "neighborhood": "Centro",
      "feeInCents": 700,
      "estimatedMinutes": 50,
      "minimumOrderInCents": 2000,
      "freeDeliveryAboveInCents": 12000,
      "active": true,
      "sortOrder": 1,
      "createdAt": "2026-07-13T00:00:00.000Z",
      "updatedAt": "2026-07-13T00:00:00.000Z"
    }
  ]
}
```

Enums:

```json
{
  "type": ["FLAT", "NEIGHBORHOOD"]
}
```

Campos opcionais: nenhum no item retornado.

Campos nullable:

```json
[
  "rules[].neighborhood",
  "rules[].estimatedMinutes",
  "rules[].minimumOrderInCents",
  "rules[].freeDeliveryAboveInCents"
]
```

Validacoes:

```json
{
  "storeId": "z.string().cuid()"
}
```

Status HTTP:

```json
{
  "200": "OK",
  "400": "Query invalida",
  "404": "Store not found",
  "401": "JWT invalido/ausente",
  "403": "Tenant/role sem acesso"
}
```

Schema Zod de origem: `storeSettingsQuerySchema`

Controller: `listDeliveryFeeRulesController`

Service: `OnlineStoreSettingsService.listDeliveryRules`

Presenter: nenhum.

## POST /settings/delivery/rules

Metodo: `POST`

Rota: `/settings/delivery/rules`

Query params: nenhum.

Request body:

```json
{
  "storeId": "cmra0xven000xvwashub9xwug",
  "name": "Centro",
  "type": "NEIGHBORHOOD",
  "neighborhood": "Centro",
  "feeInCents": 700,
  "estimatedMinutes": 50,
  "minimumOrderInCents": 2000,
  "freeDeliveryAboveInCents": 12000,
  "active": true,
  "sortOrder": 1
}
```

Response body:

```json
{
  "rule": {
    "id": "cmxxxxxxxxxxxxxxxxxxxxxxx",
    "organizationId": "cmra0xvea000rvwasonliufxu",
    "storeId": "cmra0xven000xvwashub9xwug",
    "name": "Centro",
    "type": "NEIGHBORHOOD",
    "neighborhood": "Centro",
    "feeInCents": 700,
    "estimatedMinutes": 50,
    "minimumOrderInCents": 2000,
    "freeDeliveryAboveInCents": 12000,
    "active": true,
    "sortOrder": 1,
    "createdAt": "2026-07-13T00:00:00.000Z",
    "updatedAt": "2026-07-13T00:00:00.000Z"
  }
}
```

Enums:

```json
{
  "type": ["FLAT", "NEIGHBORHOOD"]
}
```

Campos opcionais:

```json
[
  "neighborhood",
  "estimatedMinutes",
  "minimumOrderInCents",
  "freeDeliveryAboveInCents",
  "active",
  "sortOrder"
]
```

Campos nullable:

```json
[
  "neighborhood",
  "estimatedMinutes",
  "minimumOrderInCents",
  "freeDeliveryAboveInCents"
]
```

Validacoes:

```json
{
  "storeId": "z.string().cuid()",
  "name": "z.string().trim().min(1)",
  "type": "z.enum(['FLAT', 'NEIGHBORHOOD'])",
  "neighborhood": "z.string().trim().min(1).nullable().optional()",
  "feeInCents": "z.number().int().min(0)",
  "estimatedMinutes": "z.number().int().min(0).nullable().optional()",
  "minimumOrderInCents": "z.number().int().min(0).nullable().optional()",
  "freeDeliveryAboveInCents": "z.number().int().min(0).nullable().optional()",
  "active": "z.boolean().default(true)",
  "sortOrder": "z.number().int().min(0).default(0)",
  "NEIGHBORHOOD": "neighborhood obrigatorio",
  "FLAT": "neighborhood nao permitido"
}
```

Status HTTP:

```json
{
  "201": "Created",
  "400": "Body invalido",
  "404": "Store not found",
  "401": "JWT invalido/ausente",
  "403": "Tenant/role sem acesso"
}
```

Schema Zod de origem: `createDeliveryFeeRuleSchema`

Controller: `createDeliveryFeeRuleController`

Service: `OnlineStoreSettingsService.createDeliveryRule`

Presenter: nenhum.

## PATCH /settings/delivery/rules/:id

Metodo: `PATCH`

Rota real registrada: `/settings/delivery/rules/:ruleId`

Query params: nenhum.

Path params:

```json
{
  "ruleId": "string cuid required"
}
```

Request body:

```json
{
  "name": "Centro atualizado",
  "type": "NEIGHBORHOOD",
  "neighborhood": "Centro",
  "feeInCents": 800,
  "estimatedMinutes": 55,
  "minimumOrderInCents": 2500,
  "freeDeliveryAboveInCents": 15000,
  "active": true,
  "sortOrder": 2
}
```

Request body minimo:

```json
{
  "feeInCents": 800
}
```

Response body:

```json
{
  "rule": {
    "id": "cmxxxxxxxxxxxxxxxxxxxxxxx",
    "organizationId": "cmra0xvea000rvwasonliufxu",
    "storeId": "cmra0xven000xvwashub9xwug",
    "name": "Centro atualizado",
    "type": "NEIGHBORHOOD",
    "neighborhood": "Centro",
    "feeInCents": 800,
    "estimatedMinutes": 55,
    "minimumOrderInCents": 2500,
    "freeDeliveryAboveInCents": 15000,
    "active": true,
    "sortOrder": 2,
    "createdAt": "2026-07-13T00:00:00.000Z",
    "updatedAt": "2026-07-13T00:00:00.000Z"
  }
}
```

Enums:

```json
{
  "type": ["FLAT", "NEIGHBORHOOD"]
}
```

Campos opcionais:

```json
[
  "name",
  "type",
  "neighborhood",
  "feeInCents",
  "estimatedMinutes",
  "minimumOrderInCents",
  "freeDeliveryAboveInCents",
  "active",
  "sortOrder"
]
```

Campos nullable:

```json
[
  "neighborhood",
  "estimatedMinutes",
  "minimumOrderInCents",
  "freeDeliveryAboveInCents"
]
```

Validacoes:

```json
{
  "ruleId": "z.string().cuid()",
  "name": "z.string().trim().min(1).optional()",
  "type": "z.enum(['FLAT', 'NEIGHBORHOOD']).optional()",
  "neighborhood": "z.string().trim().min(1).nullable().optional()",
  "feeInCents": "z.number().int().min(0).optional()",
  "estimatedMinutes": "z.number().int().min(0).nullable().optional()",
  "minimumOrderInCents": "z.number().int().min(0).nullable().optional()",
  "freeDeliveryAboveInCents": "z.number().int().min(0).nullable().optional()",
  "active": "z.boolean().optional()",
  "sortOrder": "z.number().int().min(0).optional()",
  "NEIGHBORHOOD with neighborhood null": "invalido"
}
```

Status HTTP:

```json
{
  "200": "OK",
  "400": "Body/path invalido",
  "404": "Delivery fee rule not found",
  "401": "JWT invalido/ausente",
  "403": "Tenant/role sem acesso"
}
```

Schema Zod de origem: `deliveryFeeRuleParamsSchema`, `updateDeliveryFeeRuleSchema`

Controller: `updateDeliveryFeeRuleController`

Service: `OnlineStoreSettingsService.updateDeliveryRule`

Presenter: nenhum.

## DELETE /settings/delivery/rules/:id

Metodo: `DELETE`

Rota real registrada: `/settings/delivery/rules/:ruleId`

Query params: nenhum.

Path params:

```json
{
  "ruleId": "string cuid required"
}
```

Request body: nenhum.

Response body:

```json
{
  "deleted": true
}
```

Enums: nenhum.

Campos opcionais: nenhum.

Campos nullable: nenhum.

Validacoes:

```json
{
  "ruleId": "z.string().cuid()"
}
```

Status HTTP:

```json
{
  "200": "OK",
  "400": "Path invalido",
  "404": "Delivery fee rule not found",
  "401": "JWT invalido/ausente",
  "403": "Tenant/role sem acesso"
}
```

Schema Zod de origem: `deliveryFeeRuleParamsSchema`

Controller: `deleteDeliveryFeeRuleController`

Service: `OnlineStoreSettingsService.deleteDeliveryRule`

Presenter: nenhum.

## UnifiedOrderDTO

Presenter: `mapOnlineOrderToUnifiedOrder` e `mapEventOrderToUnifiedOrder` em `src/modules/orders/presenters/unified-order-presenter.ts`

Shape:

```json
{
  "id": "order-id",
  "sourceType": "ONLINE",
  "origin": "ONLINE",
  "originLabel": "Online",
  "originIcon": "shopping-bag",
  "channel": "DIGITAL_MENU",
  "organizationId": "organization-id",
  "eventId": null,
  "eventName": null,
  "storeId": "store-id",
  "storeName": "Loja Exemplo",
  "orderNumber": 1,
  "status": "NEW",
  "rawStatus": "RECEIVED",
  "fulfillment": "DELIVERY",
  "fulfillmentDetails": {
    "type": "DELIVERY",
    "address": {
      "address": "Rua Exemplo",
      "number": "100",
      "neighborhood": "Centro",
      "complement": null,
      "reference": null
    },
    "deliveryFeeInCents": 500,
    "estimatedMinutes": 45,
    "deliveryRuleId": "delivery-rule-id"
  },
  "customer": {
    "id": null,
    "name": "Cliente Exemplo",
    "phone": "11999990000"
  },
  "delivery": {
    "address": "Rua Exemplo",
    "number": "100",
    "neighborhood": "Centro",
    "complement": null,
    "reference": null
  },
  "totals": {
    "subtotalInCents": 3000,
    "deliveryFeeInCents": 500,
    "totalInCents": 3500
  },
  "payment": {
    "status": "NOT_TRACKED",
    "method": "CASH",
    "paidAt": null,
    "transactionCount": 0
  },
  "items": [
    {
      "id": "item-id",
      "catalogProductId": "catalog-product-id",
      "productName": "Produto Exemplo",
      "quantity": 1,
      "unitPriceInCents": 3000,
      "totalInCents": 3000,
      "notes": null,
      "options": [
        {
          "groupName": "Borda",
          "optionName": "Vulcao",
          "priceDeltaInCents": 1500
        }
      ]
    }
  ],
  "printing": {
    "enabled": false,
    "jobsCount": 0,
    "pendingCount": 0,
    "errorCount": 0
  },
  "actionEndpoints": {
    "status": "/online-orders/order-id/status",
    "payment": null
  },
  "createdAt": "2026-07-13T00:00:00.000Z",
  "updatedAt": "2026-07-13T00:00:00.000Z"
}
```

Enums:

```json
{
  "sourceType": ["EVENT", "ONLINE"],
  "origin": ["ONLINE", "TOTEM", "EVENT", "POS", "COMANDA", "QR_MESA", "GARCOM_MOBILE", "API", "WHATSAPP"],
  "status": ["NEW", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED"],
  "fulfillment": ["ON_SITE", "DELIVERY", "PICKUP", "UNKNOWN"],
  "fulfillmentDetails.type": ["ON_SITE", "DELIVERY", "PICKUP", "COUNTER", "DINE_IN", "UNKNOWN"]
}
```

Campos opcionais:

```json
[
  "fulfillmentDetails"
]
```

Campos nullable:

```json
[
  "eventId",
  "eventName",
  "storeId",
  "storeName",
  "fulfillmentDetails.address",
  "fulfillmentDetails.deliveryFeeInCents",
  "fulfillmentDetails.estimatedMinutes",
  "fulfillmentDetails.deliveryRuleId",
  "customer.id",
  "customer.name",
  "customer.phone",
  "delivery",
  "delivery.complement",
  "delivery.reference",
  "totals.subtotalInCents",
  "totals.deliveryFeeInCents",
  "payment.status",
  "payment.method",
  "payment.paidAt",
  "actionEndpoints.payment",
  "items[].catalogProductId",
  "items[].notes"
]
```

Validacoes: DTO gerado por presenter; nao ha schema Zod especifico para `UnifiedOrderDTO`.

Status HTTP: depende do endpoint consumidor, principalmente `GET /orders/unified`.

Schema Zod de origem: nenhum para o DTO; filtros de `/orders/unified` ficam em `src/modules/orders/schemas/list-unified-orders-schema.ts`.

Controller: endpoint consumidor `listUnifiedOrdersController`.

Service: `ListUnifiedOrdersService`.

Presenter: `src/modules/orders/presenters/unified-order-presenter.ts`.
