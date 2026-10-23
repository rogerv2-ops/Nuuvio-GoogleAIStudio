/**
 * Comercios: columnas de Kanban configurables y unicidad de datos.
 *
 * Dos reglas nacieron de un pedido del dueno (2026-10-23):
 *
 *  1. El Kanban debe poder AGREGAR y QUITAR columnas (antes eran 7 etapas
 *     hardcodeadas) y no se debe poder quitar una columna que todavia tiene
 *     comercios dentro: el comercio se perderia. Decision del dueno:
 *     "Bloquear hasta vaciarla".
 *
 *  2. RUC, correo y WhatsApp son UNICOS entre comercios. Antes solo se
 *     validaba el RUC: dos comercios podian compartir correo o WhatsApp, y
 *     el lead quedaba duplicado en la base.
 *
 * La parte de columnas se prueba contra la LOGICA del modulo (pura, sin
 * servidor). La unicidad se prueba contra el endpoint publico
 * `POST /api/comercios/registrar`, que es el camino real de "Unir mi comercio".
 */
import { test, expect, describe } from "bun:test";
import { comerciosModule } from "../../src/modules/comercios.ts";
import { BASE, servidorOnline, login, ADMIN, get, post } from "./_helpers.ts";

const online = await servidorOnline();

describe("Kanban: columnas configurables", () => {
  test("las columnas por defecto son las 7 historicas", () => {
    const cols = comerciosModule.listarColumnasKanban();
    const ids = cols.map(c => c.id);
    expect(ids).toEqual([
      "prospecto",
      "contactado",
      "registrado",
      "en_validacion",
      "activo",
      "en_riesgo",
      "perdido"
    ]);
    // La semantica operativa vive en el rol de la columna, no en el id.
    expect(cols.find(c => c.id === "activo")?.rol).toBe("activo");
    expect(cols.find(c => c.id === "perdido")?.rol).toBe("perdido");
  });

  test("agregar una columna la pone al final y le asigna rol nulo", () => {
    const titulo = `Prueba ${Date.now()}`;
    const res = comerciosModule.agregarColumnaKanban(titulo);
    expect(res.ok).toBe(true);
    expect(res.columna?.title).toBe(titulo);
    expect(res.columna?.rol ?? null).toBeNull();

    const cols = comerciosModule.listarColumnasKanban();
    expect(cols[cols.length - 1].id).toBe(res.columna!.id);

    // Limpieza para no ensuciar los demas tests del archivo.
    expect(comerciosModule.eliminarColumnaKanban(res.columna!.id).ok).toBe(true);
  });

  test("no permite dos columnas con el mismo titulo", () => {
    const titulo = `Duplicada ${Date.now()}`;
    const primera = comerciosModule.agregarColumnaKanban(titulo);
    expect(primera.ok).toBe(true);
    const segunda = comerciosModule.agregarColumnaKanban(titulo);
    expect(segunda.ok).toBe(false);
    expect(segunda.error).toContain("Ya existe una columna");
    comerciosModule.eliminarColumnaKanban(primera.columna!.id);
  });

  test("no permite un titulo vacio", () => {
    const res = comerciosModule.agregarColumnaKanban("   ");
    expect(res.ok).toBe(false);
  });

  test("BLOQUEA quitar una columna que todavia tiene comercios", () => {
    const col = comerciosModule.agregarColumnaKanban(`ConComercios ${Date.now()}`);
    expect(col.ok).toBe(true);
    const colId = col.columna!.id;

    const ts = Date.now().toString().slice(-6);
    const reg = comerciosModule.registrarProspecto({
      nombreComercial: `Comercio Bloqueo ${ts}`,
      telefono: `+519${ts}${ts}`,
      etapa: colId
    });
    expect(reg.ok).toBe(true);
    const comercioId = reg.comercio!.id;

    // Con un comercio adentro, la columna no se puede quitar.
    const bloqueado = comerciosModule.eliminarColumnaKanban(colId);
    expect(bloqueado.ok).toBe(false);
    expect(bloqueado.error).toContain("todavía tiene");

    // Al vaciarla (mover el comercio), se puede quitar.
    comerciosModule.actualizarEtapaKanban(comercioId, "prospecto");
    const libre = comerciosModule.eliminarColumnaKanban(colId);
    expect(libre.ok).toBe(true);
  });

  test("no permite eliminar una columna inexistente", () => {
    const res = comerciosModule.eliminarColumnaKanban("col_que_no_existe");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("no encontrada");
  });
});

describe.skipIf(!online)("Unicidad de RUC, correo y WhatsApp en el registro publico", () => {
  const ts = Date.now().toString().slice(-9);
  const rucBase = "20" + ts;
  const ruc2 = "20" + String(Number(ts) + 1).padStart(9, "0");
  const ruc3 = "20" + String(Number(ts) + 2).padStart(9, "0");
  const emailBase = `kanban-uniq-${ts}@example.com`;
  const email2 = `kanban-uniq-2-${ts}@example.com`;
  const email3 = `kanban-uniq-3-${ts}@example.com`;
  const telBase = "9" + ts.slice(0, 8);
  const tel2 = "8" + ts.slice(0, 8);
  const tel3 = "7" + ts.slice(0, 8);

  const registrar = (payload: Record<string, string>) =>
    post("/api/comercios/registrar", {
      nombreComercial: `Unicidad ${ts}`,
      contactoNombre: "Tester",
      distrito: "Miraflores",
      categoria: "Gastronomía y Café",
      ...payload
    });

  test("el primer registro con datos nuevos entra", async () => {
    const r = await registrar({ ruc: rucBase, email: emailBase, telefono: telBase });
    expect(r.status).toBe(200);
    const j: any = await r.json();
    expect(j.ok).toBe(true);
  });

  test("rechaza un RUC duplicado", async () => {
    const r = await registrar({ ruc: rucBase, email: email2, telefono: tel2 });
    expect(r.status).toBe(400);
    const j: any = await r.json();
    expect(j.error).toContain("RUC");
  });

  test("rechaza un correo duplicado", async () => {
    const r = await registrar({ ruc: ruc2, email: emailBase, telefono: tel3 });
    expect(r.status).toBe(400);
    const j: any = await r.json();
    expect(j.error).toContain("correo");
  });

  test("rechaza un WhatsApp duplicado aunque venga con otro formato (+51)", async () => {
    // Mismo numero que el primer registro, escrito con prefijo 51.
    const r = await registrar({ ruc: ruc3, email: email3, telefono: "51" + telBase });
    expect(r.status).toBe(400);
    const j: any = await r.json();
    expect(j.error).toContain("WhatsApp");
  });
});

describe.skipIf(!online)("Columnas del Kanban persistidas en la base", () => {
  test("GET /api/comercios devuelve las columnas y el sync las guarda", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    expect(token, "hacen falta VUUV_ADMIN_EMAIL / VUUV_ADMIN_PASSWORD").not.toBeNull();

    const leerEstado = async () => {
      const r = await get("/api/comercios", token);
      expect(r.status).toBe(200);
      const j: any = await r.json();
      return j;
    };

    const estado = await leerEstado();
    expect(Array.isArray(estado.kanbanColumns)).toBe(true);
    expect(estado.kanbanColumns.length).toBeGreaterThanOrEqual(7);

    const columnasOriginales = estado.kanbanColumns;
    const columnasDeComercios = (estado.kanban || []).map((k: any) => k.kanban);
    const titulo = `Persistida ${Date.now()}`;
    const columnaNueva = { id: `col_test_${Date.now()}`, title: titulo, subtitulo: "", color: "teal", rol: null };

    // Agregar la columna sincronizando el estado actual + la columna nueva.
    const sync = (columnas: unknown[]) =>
      post(
        "/api/comercios/sync",
        { comercios: estado.comercios, kanban: columnasDeComercios, columnas },
        token
      );

    const r1 = await sync([...columnasOriginales, columnaNueva]);
    expect(r1.status).toBe(200);

    const trasAgregar = await leerEstado();
    expect(trasAgregar.kanbanColumns.some((c: any) => c.id === columnaNueva.id)).toBe(true);

    // Restaurar: quitar la columna de prueba.
    const r2 = await sync(columnasOriginales);
    expect(r2.status).toBe(200);

    const trasRestaurar = await leerEstado();
    expect(trasRestaurar.kanbanColumns.some((c: any) => c.id === columnaNueva.id)).toBe(false);
  });

  test("mover un comercio de etapa persiste en la base", async () => {
    // El panel arrastra un comercio entre columnas y luego sincroniza. Si el
    // movimiento no se persiste, al recargar la pagina el comercio vuelve a su
    // columna vieja: el cambio se pierde.
    const token = await login(ADMIN.email, ADMIN.password);
    expect(token, "hacen falta VUUV_ADMIN_EMAIL / VUUV_ADMIN_PASSWORD").not.toBeNull();

    const marca = Date.now().toString().slice(-9);
    const ruc = "20" + marca;
    const rReg = await post("/api/comercios/registrar", {
      ruc,
      nombreComercial: `Mover ${marca}`,
      contactoNombre: "Tester",
      telefono: "9" + marca.slice(0, 8),
      email: `mover-${marca}@example.com`,
      distrito: "Miraflores",
      categoria: "Gastronomía y Café"
    });
    expect(rReg.status).toBe(200);

    const leer = async () => {
      const r = await get("/api/comercios", token);
      expect(r.status).toBe(200);
      return (await r.json()) as any;
    };

    const antes = await leer();
    const kanban = (antes.kanban || []).map((k: any) => k.kanban);
    const item = (antes.kanban || []).find((k: any) => k.comercio?.ruc === ruc);
    expect(item, "el comercio recien registrado debe estar en el kanban").toBeTruthy();
    expect(item.kanban.etapa).toBe("en_validacion");

    // El movimiento que hace el panel: cambiar la etapa y sincronizar todo.
    const movido = kanban.map((k: any) =>
      k.merchantId === item.kanban.merchantId ? { ...k, etapa: "contactado" } : k
    );
    const rSync = await post(
      "/api/comercios/sync",
      { comercios: antes.comercios, kanban: movido, columnas: antes.kanbanColumns },
      token
    );
    expect(rSync.status).toBe(200);

    const despues = await leer();
    const item2 = (despues.kanban || []).find((k: any) => k.comercio?.ruc === ruc);
    expect(item2?.kanban.etapa).toBe("contactado");
  });
});

/**
 * La unicidad tambien tiene que llegar al alta por WhatsApp.
 *
 * El flujo "soy un comercio" del bot llama a la MISMA validacion. Si el RUC
 * ya existe, el bot no puede contestar "Tu solicitud ha sido registrada": le
 * estaria mintiendo a un comerciante que espera una activacion que nunca va a
 * llegar (regla del repo: un camino que no abre, avisa).
 */
describe.skipIf(!online)("El bot avisa si el RUC del alta por WhatsApp ya existe", () => {
  let ipSecuencia = 0;
  // El rate limit de `simulate-incoming` es por IP (30/min): una IP por
  // mensaje deja el archivo independiente del resto de la suite.
  const ipPropia = () => `203.0.113.${200 + (ipSecuencia += 1)}`;

  async function simular(token: string, telefono: string, texto: string) {
    const r = await post(
      "/api/whatsapp/simulate-incoming",
      { telefono, texto, pushName: "Comercio Nuevo" },
      token,
      { "X-Forwarded-For": ipPropia() }
    );
    expect(r.status).toBe(200);
    const j: any = await r.json();
    const respuestas: Array<{ texto: string }> = j.respuestas || [];
    return respuestas.map(a => a.texto).join("\n");
  }

  test("rechaza el alta y lo dice cuando el RUC ya esta registrado", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    expect(token, "hacen falta VUUV_ADMIN_EMAIL / VUUV_ADMIN_PASSWORD").not.toBeNull();

    const marca = Date.now().toString().slice(-9);
    const ruc = "20" + marca;

    // Un comercio ya registrado con ese RUC (camino publico).
    const rPrev = await post("/api/comercios/registrar", {
      ruc,
      nombreComercial: `Duplicado ${marca}`,
      contactoNombre: "Tester",
      telefono: "9" + marca.slice(0, 8),
      email: `dup-${marca}@example.com`,
      distrito: "Miraflores",
      categoria: "Gastronomía y Café"
    });
    expect(rPrev.status).toBe(200);

    // Un comerciante NUEVO (telefono nuevo) se da de alta con ese mismo RUC.
    // El telefono tiene que ser un movil peruano valido: 51 + 9 digitos.
    const telefono = `+519${marca.slice(1, 9)}`;
    await simular(token!, telefono, "soy un comercio");
    const paso2 = await simular(token!, telefono, ruc);
    expect(paso2).toContain("Nombre Comercial");

    const paso3 = await simular(token!, telefono, "Tienda Duplicada - Miraflores");
    expect(paso3).toContain("No pudimos registrar tu comercio");
    expect(paso3).not.toContain("Tu solicitud ha sido registrada");
  });
});
