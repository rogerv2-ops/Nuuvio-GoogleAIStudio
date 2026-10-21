/**
 * La cola de moderacion del panel tiene que VER las ofertas que publica un
 * comercio por WhatsApp.
 *
 * QUE PASABA (2026-10-21, medido)
 *
 * El bot crea la oferta en el SERVIDOR y queda en estado "en_validacion"
 * (esperando que el dueno la apruebe). Pero el panel armaba su catalogo desde
 * el localStorage del NAVEGADOR, no desde el servidor: la oferta nunca
 * llegaba al panel, la cola de moderacion salia vacia y nadie podia
 * aprobarla. O sea: el comercio publicaba, el bot le decia "exitosamente", y
 * la oferta no se publicaba nunca.
 *
 * ESTE TEST VIGILA
 *
 *  1. `GET /api/ofertas/gestion` (solo admin) devuelve el catalogo COMPLETO,
 *     incluidas las ofertas en validacion.
 *  2. La oferta en validacion NO aparece en el listado publico (una oferta sin
 *     aprobar no se muestra en la landing).
 *  3. El payload de gestion NO lleva el telefono del comercio (regla 2).
 *  4. Sin sesion, el endpoint responde 401 (no es una ruta publica).
 */
import { test, expect, describe } from "bun:test";
import { BASE, servidorOnline, login, ADMIN, post, get } from "./_helpers.ts";

const online = await servidorOnline();

describe.skipIf(!online)("Gestion de ofertas: la cola de moderacion ve lo que publica el bot", () => {
  test("una oferta en validacion aparece en gestion y NO en el listado publico", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    expect(token).toBeTruthy();

    // El catalogo se REEMPLAZA en cada sync y los archivos de test corren en
    // paralelo: se reintenta si otra sincronizacion se lleva la oferta.
    for (let intento = 1; intento <= 3; intento++) {
      const id = `of_test_mod_${Date.now()}_${intento}`;
      const creada = await post(
        "/api/ofertas/sync",
        {
          ofertas: [
            {
              id,
              codigoUrl: `test-mod-${intento}`,
              comercioId: "merch_01",
              comercioNombre: "Comercio de prueba",
              comercioWhatsapp: "+51987654321",
              titulo: "Oferta esperando revision",
              descripcion: "Oferta creada por un test",
              tipo: "descuento_porcentaje",
              precioNormal: "50",
              precioOferta: "30",
              stock: 10,
              categoria: "Gastronomia y Cafe",
              distrito: "Miraflores",
              provincia: "Lima",
              lat: "-12.12",
              lng: "-77.03",
              imagenes: [],
              venceEn: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
              estado: "en_validacion",
              likes: 0,
              vistas: 0,
              clics: 0,
              leadsCalificados: 0,
            },
          ],
        },
        token,
      );
      expect(creada.status).toBe(200);

      const gestion = await get("/api/ofertas/gestion", token);
      expect(gestion.status).toBe(200);
      const cuerpoGestion: any = await gestion.json();
      const listaGestion = cuerpoGestion?.ofertas || [];
      const enGestion = listaGestion.find((o: any) => o.id === id);
      if (!enGestion) continue; // otra sincronizacion se la llevo: se reintenta
      // 1) La cola de moderacion la ve.
      expect(enGestion.estado).toBe("en_validacion");
      // 2) El listado publico (la landing) NO la muestra: una oferta sin
      //    aprobar no se publica.
      const publica = await get("/api/ofertas", token);
      const cuerpoPublico: any = await publica.json();
      const listaPublica = cuerpoPublico?.ofertas || [];
      expect(listaPublica.find((o: any) => o.id === id)).toBeUndefined();
      // 3) El payload de gestion NO lleva el telefono del comercio (regla 2).
      expect(JSON.stringify(listaGestion)).not.toContain("51987654321");
      return;
    }
    throw new Error("la oferta de prueba no se pudo mantener en el catalogo (otra sincronizacion la borro)");
  });

  test("sin sesion, el catalogo de gestion no se puede leer", async () => {
    const res = await fetch(`${BASE}/api/ofertas/gestion`, { redirect: "manual" });
    expect([401, 403]).toContain(res.status);
  });
});
