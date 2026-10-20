/**
 * La identidad de un usuario que entra por WhatsApp es SU NUMERO, no un
 * correo inventado.
 *
 * Contexto (2026-10-20): el dueño vio en el panel de admin la ficha
 *
 *   Roger Vasquez
 *   usr_wa_51922100389@whatsapp.yuddit.com   <- email INVENTADO
 *   51922100389 | San Isidro | activo | REF93168 | 10 pts
 *
 * El bot no tiene el email de la persona, asi que el sistema fabricaba uno
 * con el formato `<id de usuario>@whatsapp.yuddit.com`. Eso era PEOR que un
 * dato feo: contaminaba tres cosas
 *   1. el panel mostraba un correo que parece real pero no existe,
 *   2. las metricas de "correos verificados" contaban a usuarios de
 *      WhatsApp como pendientes de verificar un correo que nunca van a
 *      tener (tasa de conversion 0% con la audiencia activa),
 *   3. el "Borrar" del panel usaba ese correo falso como llave de limpieza.
 *
 * Que vigila:
 *  1. un usuario registrado por el bot NO tiene email en la base,
 *  2. el repositorio no fabrica correos de WhatsApp (guardia de codigo),
 *  3. el esquema permite que el email sea nulo (migracion aplicada),
 *  4. borrar (purgar) al usuario por telefono lo elimina de verdad.
 */
import { test, expect, describe } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { BASE, servidorOnline, login, ADMIN, post, get } from "./_helpers.ts";

const ROOT = path.resolve(import.meta.dir, "../..");
const REPO = fs.readFileSync(path.join(ROOT, "src/db/repo.ts"), "utf8");
const SCHEMA = fs.readFileSync(path.join(ROOT, "src/db/schema.ts"), "utf8");
const MODULO = fs.readFileSync(path.join(ROOT, "src/modules/usuarios.ts"), "utf8");
const PANEL = fs.readFileSync(
  path.join(ROOT, "src/components/gestion/views/UsuariosDomainView.tsx"),
  "utf8",
);
const LAYOUT = fs.readFileSync(
  path.join(ROOT, "src/components/gestion/GestionLayout.tsx"),
  "utf8",
);

const online = await servidorOnline();
const hayAdmin = Boolean(ADMIN.email && ADMIN.password);

let secuencia = 0;
function telefonoNuevo(): string {
  secuencia += 1;
  // Peru: +51 + 9 digitos. Con menos digitos el bot lo rechaza como
  // internacional y el testeria otro flujo.
  const base = String(Date.now() % 100000000).padStart(8, "0");
  return `+519${base.slice(0, 7)}${secuencia % 10}`;
}

function soloDigitos(v: string | null | undefined): string {
  return String(v || "").replace(/\D/g, "");
}

describe("Identidad de audiencia: el numero es la identidad (sin email inventado)", () => {
  test("G1: el repositorio NO fabrica correos de WhatsApp", () => {
    // La causa raiz: el fallback `<id>@whatsapp.yuddit.com`.
    expect(REPO).not.toContain("@whatsapp.yuddit.com");
  });

  test("G2: el panel se recarga desde el servidor al montar", () => {
    // El modulo de usuarios es un singleton que se construye AL IMPORTARLO,
    // antes de que exista sesion: su carga inicial da 401 y el panel queda
    // con la copia del navegador (que puede traer el correo inventado).
    // Sin esta recarga, el admin ve datos viejos aunque la base ya este
    // bien.
    // En el layout (cubre TODOS los sub-paneles que muestran audiencia:
    // general, analitica, comunicaciones) y en la vista de usuarios.
    expect(LAYOUT).toContain("usuariosModule.recargar()");
    expect(PANEL).toContain("usuariosModule.recargar()");
  });

  test("G3: el servidor manda sobre la copia local del navegador", () => {
    // La copia local (localStorage) puede traer el correo inventado de una
    // version anterior. Al cargar del servidor, el correo se pisa SIEMPRE
    // con el del servidor; y al leer la copia local, a los usuarios de
    // WhatsApp se les borra el correo.
    expect(MODULO).toContain("email: u.email || ''");
    expect(MODULO).toContain("esWhatsapp ? { ...u, email: '' } : u");
  });

  test("G4: el esquema permite que el email de audiencia sea nulo", () => {
    // `audience_users.email` era NOT NULL: por eso habia que inventar un
    // correo para poder guardar al usuario de WhatsApp.
    const i = SCHEMA.indexOf('const audienceUsers=pgTable("audience_users"');
    expect(i).toBeGreaterThan(-1);
    const tabla = SCHEMA.slice(i, i + 600);
    expect(tabla).toContain('email:text("email")');
    expect(tabla).not.toContain('email:text("email").notNull()');
  });

  test.skipIf(!online || !hayAdmin)(
    "G5: un usuario que entra por WhatsApp se guarda SIN email inventado",
    async () => {
      const token = await login(ADMIN.email, ADMIN.password);
      expect(token).toBeTruthy();

      const tel = telefonoNuevo();
      const res = await post(
        "/api/whatsapp/simulate-incoming",
        { telefono: tel, texto: "hola", pushName: "Prueba Identidad" },
        token,
      );
      expect(res.status).toBe(200);

      const lista = await get("/api/audience/users", token);
      expect(lista.status).toBe(200);
      const body: any = await lista.json();
      const usuarios: any[] = Array.isArray(body.users) ? body.users : [];

      const mio = usuarios.find((u: any) => soloDigitos(u.telefono) === soloDigitos(tel));
      expect(mio).toBeTruthy();
      // Sin correo inventado: ni el valor, ni el dominio.
      expect(mio.email === null || mio.email === undefined || mio.email === "").toBe(true);
      expect(String(mio.email || "")).not.toContain("whatsapp.yuddit.com");
      // Y el numero es lo que queda como identidad.
      expect(soloDigitos(mio.telefono)).toContain(soloDigitos(tel).slice(-9));
    },
  );

  test.skipIf(!online || !hayAdmin)(
    "G6: purgar al usuario por telefono lo borra de verdad",
    async () => {
      const token = await login(ADMIN.email, ADMIN.password);
      expect(token).toBeTruthy();

      const tel = telefonoNuevo();
      await post(
        "/api/whatsapp/simulate-incoming",
        { telefono: tel, texto: "hola", pushName: "Prueba Purga" },
        token,
      );

      const antes = await get("/api/audience/users", token);
      const bodyAntes: any = await antes.json();
      const usuariosAntes: any[] = Array.isArray(bodyAntes.users) ? bodyAntes.users : [];
      const mio = usuariosAntes.find((u: any) => soloDigitos(u.telefono) === soloDigitos(tel));
      expect(mio).toBeTruthy();

      // El bot guarda el id como `usr_wa_<telefono>`.
      const id = String(mio.id);
      expect(id.startsWith("usr_wa_")).toBe(true);

      const purga = await post(
        "/api/audience/purge-user",
        { id, telefono: soloDigitos(tel) },
        token,
      );
      expect(purga.status).toBe(200);

      const despues = await get("/api/audience/users", token);
      const bodyDespues: any = await despues.json();
      const usuariosDespues: any[] = Array.isArray(bodyDespues.users) ? bodyDespues.users : [];
      expect(usuariosDespues.find((u: any) => u.id === id)).toBeUndefined();
    },
  );
});
