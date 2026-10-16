# Contrato: API de autenticación (`/api/auth/*`)

Todos los cuerpos son `application/json`. Respuestas con `ok: boolean`.
Errores: `{ "ok": false, "error": "<mensaje>" }`.

> Estado: implementado (US1). Este contrato es la referencia vinculante.

## `POST /api/auth/login` — público

**Request**
```json
{ "email": "usuario@dominio", "password": "secreto" }
```

**200**
```json
{
  "ok": true,
  "token": "<base64url(payload)>.<base64url(hmac)>",
  "sesion": {
    "usuarioId": "admin_master_01",
    "email": "usuario@dominio",
    "nombre": "Super Administrador",
    "rol": "admin",
    "merchantId": null,
    "exp": 1794770383568,
    "expiraEn": "2026-11-15T19:19:43.568Z"
  }
}
```

**400** faltan credenciales · **401** credenciales inválidas · **429** rate limit de login.

## `GET /api/auth/me` — requiere `Authorization: Bearer`

**200** `{ "ok": true, "sesion": { ...payload... } }` · **401** token ausente/inválido/expirado.

## `POST /api/auth/logout` — requiere Bearer

**200** `{ "ok": true }`. No-op en servidor (stateless); el cliente elimina el token.

## `GET /api/auth/users` — requiere rol `admin`

**200**
```json
{
  "ok": true,
  "users": [
    { "email": "...", "nombre": "...", "rol": "admin",
      "usuarioId": "...", "merchantId": null, "descripcion": "..." }
  ]
}
```
Nunca devuelve `passwordHash`/`passwordSalt`. **401** sin token · **403** no admin.

## `POST /api/auth/users` — requiere rol `admin`

**Request**
```json
{ "email": "...", "password": ">=6 chars", "nombre": "...",
  "rol": "admin|operador|comercio", "merchantId": "merch_01", "descripcion": "..." }
```
**200** `{ "ok": true, "mensaje": "Usuario registrado exitosamente." }`
· **400** faltan datos / clave < 6 · **409** correo duplicado · **401/403**.

## `POST /api/auth/password` — requiere rol `admin`

**Request** `{ "email": "...", "password": ">=6 chars" }`
**200** `{ "ok": true, "mensaje": "Contrasena actualizada correctamente." }`
· **400** clave < 6 · **404** usuario inexistente · **401/403**.

## Invariantes de seguridad

- `passwordHash`/`passwordSalt` nunca salen del servidor.
- El token es la única credencial que viaja; forjar `localStorage` no otorga
  permisos (el servidor valida la firma HMAC).
- `rol` se evalúa en el servidor para cada operación de gestión (FR-002).
