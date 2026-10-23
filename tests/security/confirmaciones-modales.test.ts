/**
 * Regla inquebrantable: ninguna confirmacion destructiva usa la ventana del
 * navegador (window.confirm / confirm). Todas pasan por ConfirmModal.
 *
 * Se vigilan los 8 sitios encontrados (todos en el panel de gestion / admin):
 * ConfiguracionDomainView, ProveedoresIaView, ComerciosDomainView,
 * RegistrationAuditLogTable, SeoMetadataEditor, WhatsAppConfigPanel,
 * y los importados en ConfirmModal. No hay ninguna en el panel de comercio.
 */
import fs from "node:fs";
import path from "node:path";
import { test, expect, describe } from "bun:test";

const ROOT = path.resolve(import.meta.dir, "../..");
const LEER = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");

const CONVERTIDOS: string[] = [
  "src/components/gestion/views/ConfiguracionDomainView.tsx",
  "src/components/gestion/views/ProveedoresIaView.tsx",
  "src/components/gestion/views/ComerciosDomainView.tsx",
  "src/components/gestion/components/RegistrationAuditLogTable.tsx",
  "src/components/SeoMetadataEditor.tsx",
  "src/components/WhatsAppConfigPanel.tsx",
  "src/components/common/ConfirmModal.tsx",
];

describe("Confirmaciones: ninguna ventana del navegador (window.confirm)", () => {
  test("App.tsx monta ConfirmModalHost", () => {
    const app = LEER("src/App.tsx");
    expect(app).toContain("ConfirmModalHost");
    expect(app.includes('import { ConfirmModalHost }')).toBe(true);
  });

  for (const archivo of CONVERTIDOS) {
    test(`${archivo}: usa confirmar y NO usa window.confirm`, () => {
      if (archivo === "src/components/common/ConfirmModal.tsx") {
        // Este archivo debe exportar `confirmar` y `ConfirmModalHost`.
        const src = LEER(archivo);
        expect(src).toContain("export function confirmar(");
        expect(src).toContain("export function ConfirmModalHost(");
        // No debe contener ninguna ventana del navegador (solo las referencias
        // al componente, no al metodo del navegador).
        expect(src).not.toContain("window.confirm(");
        return;
      }
      const src = LEER(archivo);
      // Cada archivo debe importar `confirmar`.
      expect(src).toContain("confirmar");
      // Ninguna debe contener la ventana del navegador.
      expect(src).not.toContain("window.confirm(");
      // `confirm` sin `window.`: asegurar que los llamados a `confirmar` no
      // son confundidos con la ventana.`confirm` sola no debe aparecer.
      const lineasConfirm = src.split("\n").filter((l) => /\bconfirm\b/.test(l));
      // Solo debe haber referencias a `confirmar` (el nombre del componente o la
      // funcion), `ConfirmModalHost`, o `textoConfirmar`, NUNCA `confirm(`.
      for (const linea of lineasConfirm) {
        expect(linea.includes("confirmar")).toBe(true);
      }
    });
  }
});

describe("Confirmar: contrato de fail-closed (nunca true sin ConfirmModalHost montado)", () => {
  test("confirmar antes de montar el host resuelve false, nunca true", async () => {
    // El modulo usa hostsMontados: antes de que ConfirmModalHost se monte,
    // cualquier llamada a confirmar debe ser rechazada, no aceptada. Esto
    // protege contra una accion destructiva que se ejecute antes de que el
    // modal aparezca (por ejemplo, un click accidental antes del render).
    const { confirmar } = await import("../../src/components/common/ConfirmModal");
    const res = await confirmar({ titulo: "Prueba", mensaje: "x" });
    expect(res).toBe(false);
  });
});
