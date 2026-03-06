# Platform Infrastructure

## Complete Workflow

### Preview

```
APP_ENV=preview pnpm dw infra tf.init
APP_ENV=preview pnpm dw infra tf.import # prompted for IDs
APP_ENV=preview pnpm dw infra tf.plan # verify zero drift
APP_ENV=preview pnpm dw infra tf.apply # only when adding new resources
APP_ENV=preview pnpm dw infra tf.state-rm <resource> # remove terraform state for resource
```

### Production

```
APP_ENV=production pnpm dw infra tf.init
APP_ENV=production pnpm dw infra tf.import
APP_ENV=production pnpm dw infra tf.plan
APP_ENV=production pnpm dw infra tf.apply
APP_ENV=preview pnpm dw infra tf.state-rm <resource>
```

### Get DNS Records IDs

```
doppler run --config prd -- sh -c '
  curl -s -X GET \
    "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" | jq ".result[] | {id, name, type, content}"
'
```
