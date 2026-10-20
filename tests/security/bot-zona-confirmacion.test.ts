/**
 * Confirmacion de zona de un toque para usuarios que llegan desde el boton
 * de una oferta en la landing (flujo WhatsApp del bot).
 *
 * Reglas del dueño (2026-10-20):
 *  1. Usuario NUEVO que llega desde el enlace de una oferta: el bot confirma
 *     su zona con el distrito de LA OFERTA clickeada ("¿Estas cerca de X?")
 *     y, al confirmar, envia EL ENLACE firmado de ESA oferta (/c/:id).
 *  2. Registrado sin zona: se le pide confirumar su zona (comportamiento actual).
 *  3. Entrada directa por WhatsApp (sin oferta): la segunda consulta pide los
 *     datos que falten, tal como esta.
 *  4. Si los datos ya estan completos: flujo normal.
 *
 * Todos los casos corren contra el servidor real via simulate-incoming
 * (mismo pipeline que Baileys) con telefonos unicos por prueba.
 */
import { test, expect, describe } from "bun:test";
import { BASE, servidorOnline, login, ADMIN, post, get } from "./_helpers.ts";
import { construirMensajeContactoWhatsApp } from "../../src/utils/whatsappLinks.ts";

const online = await servidorOnline();
const hayAdmin = Boolean(ADMIN.email && ADMIN.password);

/** Telefonos unicos por corrida para no chocar con usuarios previos. */
let secuencia = 0;
function telefonoNuevo(): string {
  secuencia += 1;
  // +51 + 9XXXXXXXX (9 digitos, Peru). La marca temporal da la base, la
  // secuencia garantiza unicidad dentro de la misma corrida.
  const base = String(Date.now() % 100000000).padStart(8, "0");
  return `+519${base.slice(0, 7)}${secuencia % 10}`;
}

interface SimResult {
  ok: boolean;
  respuestas: Array<{ tipo: string; texto: string; boton: { texto: string; url: string } | null }>;
}

async function simular(token: string, telefono: string, texto: string): Promise<SimResult> {
  const r = await post("/api/whatsapp/simulate-incoming", { telefono, texto, pushName: "Prueba Contrato" }, token);
  expect(r.status).toBe(200);
  const j: any = await r.json();
  expect(j.ok).toBe(true);
  return j as SimResult;
}

describe.skipIf(!online || !hayAdmin)("Bot: confirmacion de zona de un toque (enlace de oferta)", () => {
  let token: string | null = null;
  let ofertaTest: any = null;

  test("preparacion: oferta de prueba con saldo para el offerante", async () => {
    token = await login(ADMIN.email, ADMIN.password);
    expect(token).toBeTruthy();

    // El embudo automatico siembra packs para merch_01/02/03 solo si la tabla
    // esta vacia; contra un snapshot con datos reales esos packs siguen ahi.
    // La oferta apunta a merch_01 que siempre tiene saldo sembrado o real.
    const res = await get("/api/ofertas", token);
    expect(res.status).toBe(200);
    const actuales: any[] = await res.json();
    const lista = Array.isArray(actuales) ? actuales : [];

    ofertaTest = {
      id: `of_test_zona_${Date.now()}`,
      titulo: "Bowl Test Confirmar Zona",
      descripcion: "Oferta creada por el test de confirmacion de zona.",
      comercioId: "merch_01",
      comercioNombre: "Prueba Contrato Zona",
      categoria: "gastronomia",
      precioNormal: 50,
      precioOferta: 25,
      distrito: "Miraflores",
      estado: "activa",
      venceEn: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
      likes: 0,
      comercioWhatsapp: "+51987654321",
    };

    const sync = await post("/api/ofertas/sync", { ofertas: [...lista, ofertaTest] }, token);
    expect(sync.status).toBe(200);
  });

  test("R1: nuevo usuario desde el enlace de una oferta -> confirma zona con el distrito de la oferta", async () => {
    const tel = telefonoNuevo();
    const res = await simular(token!, tel, construirMensajeContactoWhatsApp({ titulo: ofertaTest.titulo, ref: ofertaTest.id }));
    expect(res.respuestas.length).toBeGreaterThan(0);
    const texto = res.respuestas.map((a) => a.texto).join(" ");
    // Pregunta el distrito de la oferta (no la pregunta generica de datos).
    expect(texto).toContain(ofertaTest.distrito);
    expect(texto).toContain(ofertaTest.titulo);
    expect(texto).not.toContain("Nombre, Edad");
  });

  test("R2: tras confirmar (si) -> envia LA oferta con enlace firmado /c/:id", async () => {
    const tel = telefonoNuevo();
    await simular(token!, tel, construirMensajeContactoWhatsApp({ titulo: ofertaTest.titulo, ref: ofertaTest.id }));
    const res = await simular(token!, tel, "sí");
    const conBoton = res.respuestas.find((a) => a.tipo === "tarjeta_con_boton_cta");
    expect(conBoton).toBeTruthy();
    expect(conBoton!.texto).toContain(ofertaTest.titulo);
    expect(conBoton!.boton?.url).toContain(`/c/${ofertaTest.id}`);
    expect(conBoton!.boton?.url).toContain("s=");
  });

  test("R3: si responde otro distrito -> guarda ese distrito y envia LA oferta", async () => {
    const tel = telefonoNuevo();
    await simular(token!, tel, construirMensajeContactoWhatsApp({ titulo: ofertaTest.titulo, ref: ofertaTest.id }));
    const res = await simular(token!, tel, "yo estoy en San Miguel");
    const conBoton = res.respuestas.find((a) => a.tipo === "tarjeta_con_boton_cta");
    expect(conBoton).toBeTruthy();
    expect(conBoton!.texto).toContain(ofertaTest.titulo);
  });

  test("R4: si responde que no -> le pregunta su distrito como siempre", async () => {
    const tel = telefonoNuevo();
    await simular(token!, tel, construirMensajeContactoWhatsApp({ titulo: ofertaTest.titulo, ref: ofertaTest.id }));
    const res = await simular(token!, tel, "no");
    const texto = res.respuestas.map((a) => a.texto).join(" ");
    expect(texto).toContain("distrito");
    expect(texto).not.toContain(ofertaTest.titulo);
  });

  test("R5 (regresion): entrada directa por WhatsApp pide datos tal como estaba", async () => {
    const tel = telefonoNuevo();
    const res = await simular(token!, tel, "hola");
    const texto = res.respuestas.map((a) => a.texto).join(" ");
    expect(texto).toContain("Nombre");
    expect(texto).toContain("Distrito");
  });

  test("R6 (regresion): registrado con zona que clickea una oferta recibe LA oferta, no el mosaico", async () => {
    const tel = telefonoNuevo();
    await simular(token!, tel, "hola");
    await simular(token!, tel, "Carlos, 28, Miraflores");
    const res = await simular(token!, tel, construirMensajeContactoWhatsApp({ titulo: ofertaTest.titulo, ref: ofertaTest.id }));
    const conBoton = res.respuestas.find((a) => a.tipo === "tarjeta_con_boton_cta");
    expect(conBoton).toBeTruthy();
    expect(conBoton!.texto).toContain(ofertaTest.titulo);
    expect(conBoton!.boton?.url).toContain(`/c/${ofertaTest.id}`);
    // No puede caer al mosaico (una sola imagen con todas).
    expect(res.respuestas.some((a) => a.tipo === "imagen_con_caption")).toBe(false);
  });
});
