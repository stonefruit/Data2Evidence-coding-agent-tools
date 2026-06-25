# Logto Auth And Token Lifetime

## Read When

- Work mentions Logto, OIDC, JWT expiry, access token TTL, token timeout, or `LOGTO__RESOURCE`.
- Long-running agentic or API workflows need a bearer token that will not expire mid-task.
- Debugging `401` responses that appear after a previously valid Logto token aged out.

## Summary

D2E's Logto access-token lifetime is configured on the Logto API resource, not in the custom JWT script. The durable setting is `LOGTO__RESOURCE.accessTokenTtl` in seconds; Logto persists it in the `logto.resources.access_token_ttl` database column.

## Facts

- The main D2E Logto resource has indicator `https://alp-default`.
- Durable local Docker config lives in `repos/Data2Evidence/docker-compose.yml` under `LOGTO__RESOURCE`, for example `{"name":"alp-default","indicator":"https://alp-default","accessTokenTtl":3600}`.
- Durable Helm config lives in `repos/Data2Evidence/charts/d2e-services/templates/d2e-deployment.yaml` under the same `LOGTO__RESOURCE` value.
- `repos/Data2Evidence/services/alp-logto/post-init/src/main.ts` reads `process.env.LOGTO__RESOURCE`, defaults `accessTokenTtl` to `3600`, and creates or updates the Logto resource. If the post-init job runs again, it can overwrite direct DB edits with the configured env value.
- In a running local stack, the persisted TTL is `logto.resources.access_token_ttl`. Check the main resource with:

```sh
docker exec d2e-minerva-postgres-1 psql -U postgres -d alp -c \
"select id, name, indicator, access_token_ttl, is_default from logto.resources where indicator = 'https://alp-default';"
```

- For a temporary local change, update the database directly, using seconds:

```sh
docker exec d2e-minerva-postgres-1 psql -U postgres -d alp -c \
"update logto.resources set access_token_ttl = 7200 where indicator = 'https://alp-default';"
```

- Existing JWTs keep their already minted `exp`; re-login or refresh after changing the TTL to get a token with the new lifetime.
- `LOGTO__RESOURCE_API` is the audience/resource identifier used by services. It does not set the timeout.
- `LOGTO__CUSTOM_JWT` adds or rewrites access-token claims via `configs/jwt-customizer/access-token`. It does not set the token lifetime.
- For long-running agentic work, increase `accessTokenTtl` before capturing the browser/API token, then capture a fresh token.

## Evidence

- Verified against `repos/Data2Evidence` commit `5968726ca9dcfc27701de47b24f7a4ef0305526e`.
- Verified by inspecting `repos/Data2Evidence/docker-compose.yml`, `repos/Data2Evidence/charts/d2e-services/templates/d2e-deployment.yaml`, and `repos/Data2Evidence/services/alp-logto/post-init/src/main.ts`.
- Verified in the local running stack by querying `information_schema.columns` for `logto.resources` and querying the `https://alp-default` resource. The app checkout had unrelated uncommitted changes outside the inspected Logto files during verification.

## Recheck When

- Logto is upgraded or its resource schema changes.
- `services/alp-logto/post-init/src/main.ts` or `LOGTO__RESOURCE` wiring changes.
- A task depends on exact token refresh behavior rather than access-token issuance lifetime.

## Related

- `skills/dev-functions/SKILL.md`
- `knowledge/functions.md`
