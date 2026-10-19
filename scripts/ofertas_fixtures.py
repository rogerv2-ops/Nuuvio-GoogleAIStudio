#!/usr/bin/env python3
"""
Siembra / limpia / verifica las fixtures de los tests de ofertas (T017/T025/T016).

Todo se hace contra la base de datos de produccion via `docker exec ... psql`
(nombre del contenedor y credenciales configurables por entorno). Las fixtures
usan ids `*_test_*` y telefonos con prefijo 519990000 para poder limpiarlas.

Subcomandos:
  seed        Inserta comercios/ofertas/pack de prueba (idempotente) y reinicia metricas.
  assert      Verifica en DB los efectos de los tests (facturables, saldo).
  cleanup     Borra fixtures, click_logs de prueba y restaura el estado.

Uso: OFERTAS_TEST_PREFIX=519990000 python3 scripts/ofertas_fixtures.py seed
"""
import json
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone

PG_CONTAINER = os.environ.get("PG_CONTAINER", "oa0t0nzguh49o1fim0juu5nj")
PG_USER = os.environ.get("SQL_USER", "nuuviopsg")
PG_DB = os.environ.get("SQL_DB", "nuuviopsg")
DOCKER = os.environ.get("DOCKER", "sudo -n docker")
PREFIX = os.environ.get("OFERTAS_TEST_PREFIX", "519990000")

OFF_CPC = "ofr_test_cpc"
OFF_NS = "ofr_test_ns"
OFF_LIKE = "ofr_test_like"
MER_CPC = "merch_test_cpc"
MER_NS = "merch_test_ns"
MER_LIKE = "merch_test_like"
PACK_CPC = "pack_test_cpc"
PACK_SALDO_INICIAL = 5
WSP = "+51999000999"

TEST_IDS = {
    "offers": [OFF_CPC, OFF_NS, OFF_LIKE],
    "merchants": [MER_CPC, MER_NS, MER_LIKE],
    "packs": [PACK_CPC],
}


def psql(sql: str, quiet: bool = True) -> str:
    args = DOCKER.split() + [
        "exec", PG_CONTAINER,
        "psql", "-U", PG_USER, "-d", PG_DB, "-tAc", sql,
    ]
    out = subprocess.run(args, capture_output=True, text=True)
    if out.returncode != 0:
        raise RuntimeError(f"psql fallo: {out.stderr.strip()}\nSQL: {sql[:200]}")
    return out.stdout.strip()


def get_setting(key: str, default):
    raw = psql(f"select value from app_settings where key='{key}'")
    return json.loads(raw) if raw else default


def set_setting(key: str, value):
    payload = json.dumps(value, ensure_ascii=False)
    psql(
        "update app_settings set value=$json$" + payload +
        "$json$, updated_at=now() where key='" + key + "'"
    )


def _future(days: int = 30) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


def _merchant(mid, nombre, distrito, categoria):
    return {
        "id": mid, "ruc": "20999999999", "nombreComercial": nombre,
        "razonSocial": nombre + " S.A.C.", "contactoNombre": "QA Bot",
        "telefono": WSP, "email": f"{mid}@test.local",
        "direccion": "Test 123", "distrito": distrito, "provincia": "Lima",
        "lat": -12.12, "lng": -77.03, "instagram": "@test",
        "categoria": categoria, "estado": "activo",
        "registradoEn": _future(-1), "validadoEn": _future(-1),
        "validadoPor": "QA",
    }


def _offer_sql(oid, comercio_id, titulo, distrito, categoria):
    cols = ("id,codigo_url,comercio_id,comercio_nombre,comercio_whatsapp,titulo,"
            "descripcion,tipo,precio_normal,precio_oferta,stock,categoria,distrito,"
            "provincia,lat,lng,imagenes,vence_en,estado,likes,vistas,clics,"
            "leads_calificados,creada_en")
    vals = (
        f"'{oid}','{oid}-slug','{comercio_id}','QA {comercio_id}','{WSP}',"
        f"'{titulo}','Oferta de prueba automatizada','producto',100,50,10,"
        f"'{categoria}','{distrito}','Lima',-12.12,-77.03,"
        f"'[\"https://test.local/cover.jpg\"]'::jsonb,'{_future()}'::text,"
        f"'activa',0,0,0,0,'{_future(-1)}'::text"
    )
    return (
        f"insert into offers ({cols}) values ({vals}) "
        f"on conflict (id) do update set titulo=excluded.titulo, "
        f"estado='activa', clics=0, leads_calificados=0, likes=0, "
        f"vence_en=excluded.vence_en, updated_at=now()"
    )


# El saldo de los packs vive en la tabla click_packs, NO en app_settings: al
# pasar el debito a SQL (T4 / punto 3 de la auditoria) el blob
# click_packs_list dejo de ser la fuente de verdad. Si estas fixtures lo
# escribieran ahi, la app no las veria y el assert del saldo nunca pasaria.
def _upsert_pack(saldo: int = PACK_SALDO_INICIAL) -> None:
    psql(
        "insert into click_packs (id, comercio_id, total_clics, saldo_clics, "
        "precio_unitario, monto_total, estado, comprado_en) values "
        f"('{PACK_CPC}', '{MER_CPC}', 100, {saldo}, 1.2, 120, 'activo', '{_future(-1)}') "
        "on conflict (id) do update set saldo_clics=excluded.saldo_clics, estado='activo'"
    )


def _pack_saldo() -> int:
    return int(psql(f"select saldo_clics from click_packs where id='{PACK_CPC}'") or "0")


def _delete_pack() -> None:
    psql(f"delete from click_packs where id='{PACK_CPC}'")


def seed():
    merchants = [m for m in get_setting("merchants_list", []) if m.get("id") not in TEST_IDS["merchants"]]
    merchants += [
        _merchant(MER_CPC, "QA CPC", "Miraflores", "Gastronomía y Café"),
        _merchant(MER_NS, "QA Sin Saldo", "Miraflores", "Gastronomía y Café"),
        _merchant(MER_LIKE, "QA Like", "San Isidro", "Moda y Calzado"),
    ]
    set_setting("merchants_list", merchants)

    _upsert_pack()

    psql(_offer_sql(OFF_CPC, MER_CPC, "QA CPC Oferta", "Miraflores", "Gastronomía y Café"))
    psql(_offer_sql(OFF_NS, MER_NS, "QA Sin Saldo Oferta", "Miraflores", "Gastronomía y Café"))
    psql(_offer_sql(OFF_LIKE, MER_LIKE, "QA Like Oferta", "San Isidro", "Moda y Calzado"))

    _reset()
    print(f"[seed] ok: {OFF_CPC} (pack {PACK_SALDO_INICIAL}), {OFF_NS}, {OFF_LIKE}")


def _reset():
    for off in TEST_IDS["offers"]:
        psql(f"update offers set clics=0, leads_calificados=0, likes=0 where id='{off}'")
    _upsert_pack()
    psql(f"delete from click_logs where usuario_telefono like '{PREFIX}%'")


def _count(sql: str) -> int:
    return int(psql(sql) or "0")


def assert_db():
    errs = []
    fac = _count(
        f"select count(*) from click_logs where oferta_id='{OFF_CPC}' "
        f"and facturable=true and usuario_telefono like '{PREFIX}%'"
    )
    nofac = _count(
        f"select count(*) from click_logs where oferta_id='{OFF_CPC}' "
        f"and facturable=false and usuario_telefono like '{PREFIX}%'"
    )
    saldo = _pack_saldo()
    leads = int(psql(f"select leads_calificados from offers where id='{OFF_CPC}'") or "0")

    if fac < 2:
        errs.append(f"se esperaban >=2 clics facturables de {OFF_CPC}, hay {fac}")
    if nofac < 1:
        errs.append(f"se esperaba >=1 clic no facturable de {OFF_CPC}, hay {nofac}")
    if saldo != PACK_SALDO_INICIAL - 2:
        errs.append(f"saldo del pack {PACK_CPC} esperado {PACK_SALDO_INICIAL - 2}, hay {saldo}")
    if leads < 2:
        errs.append(f"leads_calificados de {OFF_CPC} esperado >=2, hay {leads}")

    if errs:
        print("[assert] FALLOS:")
        for e in errs:
            print("  -", e)
        sys.exit(1)
    print(f"[assert] ok: facturables={fac}, no_facturables={nofac}, saldo={saldo}, leads={leads}")


def cleanup():
    psql(f"delete from click_logs where usuario_telefono like '{PREFIX}%'")
    ids = ",".join(f"'{x}'" for x in TEST_IDS["offers"])
    psql(f"delete from offers where id in ({ids})")
    lst = [x for x in get_setting("merchants_list", []) if x.get("id") not in TEST_IDS["merchants"]]
    set_setting("merchants_list", lst)
    _delete_pack()
    print("[cleanup] ok: fixtures, click_logs de prueba y pack eliminados")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "seed":
        seed()
    elif cmd == "assert":
        assert_db()
    elif cmd == "cleanup":
        cleanup()
    else:
        print(__doc__)
        sys.exit(2)
