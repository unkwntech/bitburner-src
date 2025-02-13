<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [bitburner](./bitburner.md) &gt; [NS](./bitburner.ns.md) &gt; [getPurchasedServerCost](./bitburner.ns.getpurchasedservercost.md)

## NS.getPurchasedServerCost() method

Get cost of purchasing a server.

**Signature:**

```typescript
getPurchasedServerCost(ram: number): number;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  ram | number | Amount of RAM of a potential purchased server, in GB. Must be a power of 2 (2, 4, 8, 16, etc.). Maximum value of 1048576 (2^20). |

**Returns:**

number

The cost to purchase a server with the specified amount of ram.

## Remarks

RAM cost: 0.25 GB

Returns the cost to purchase a server with the specified amount of ram.

## Example 1


```ts
// NS1:
for (i = 1; i <= 20; i++) {
    tprint(i + " -- " + getPurchasedServerCost(Math.pow(2, i)));
}
```

## Example 2


```ts
// NS2:
for (i = 1; i <= 20; i++) {
    ns.tprint(i + " -- " + ns.getPurchasedServerCost(Math.pow(2, i)));
}
```

