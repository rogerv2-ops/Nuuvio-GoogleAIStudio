# Flujo de Registro de Usuario y Página Protegida de Bienvenida a WhatsApp

Plan de implementación revisado para el embudo de registro de usuarios: corrección del Paso 2 informativo en el modal de registro y blindaje de la Página de Bienvenida para que únicamente muestre el enlace y botón a WhatsApp si el usuario proviene de un enlace de verificación válido con la palabra preescrita "Ofertas".

### User Review & Critical Decisions

> [!IMPORTANT]
> **Decisiones acordadas y consolidadas para esta revisión:**
> 1. **Paso 2 exacto en el modal de registro inicial:**  
>    *"Al confirmar tu correo serás llevado a la página de bienvenida con el enlace a nuestro WhatsApp y podrás pedir las ofertas cercanas a ti con solo enviar la palabra 'Ofertas'"*.
> 2. **Página de Bienvenida protegida (no pública):**  
>    - **Si NO viene de enlace de verificación válido (o acceso directo/manipulado):** Oculta por completo el botón de WhatsApp y muestra un mensaje alternativo indicando que se requiere verificar el correo primero o registrarse.
>    - **Si viene con verificación válida:** Muestra el mensaje de bienvenida oficial y el botón a WhatsApp con el mensaje preescrito `"Ofertas"`.
> 3. **Botón en modal inicial:** Sustituir el botón directo a WhatsApp por un botón para abrir o revisar la bandeja de correo (*"Abrir mi correo para confirmar"*), evitando que se eluda el paso de verificación por email.
> 4. **Texto preescrito de WhatsApp:** Exactamente `"Ofertas"`.

---

### 1. Overview & Core Concept

- **Problema**: 
  - El modal de registro sugería erróneamente un "segundo correo" para WhatsApp o mostraba un botón directo a WhatsApp que permitía eludir la verificación del correo electrónico.
  - La página o vista de bienvenida carecía de una regla estricta de protección: cualquier visitante podía acceder y ver el botón de WhatsApp sin haber validado su correo real.
- **Solución**:
  - Modal de registro con el flujo transparente de 2 pasos: Paso 1 (confirmar correo) y Paso 2 (llegar a la página de bienvenida con el enlace a WhatsApp listo para enviar "Ofertas").
  - Página de Bienvenida con validación estricta de token de verificación:
    - Estado no verificado: Oculta el botón de WhatsApp y muestra aviso de restricción con opción de registro o reenvío.
    - Estado verificado: Reconoce al usuario por su nombre y correo, muestra felicitaciones y despliega el botón destacado a WhatsApp con el enlace `wa.me/{numero}?text=Ofertas`.

---

### 2. User Experience & Visual Design

#### Flujo Paso a Paso:
1. **Registro Inicial del Usuario**:
   - Formulario limpio con Nombre, Apellido (opcional), Distrito y Correo Electrónico.
   - Envío asíncrono con generación de token de confirmación único y envío del correo con el enlace de verificación.
2. **Modal de Confirmación Inmediata ("¡Casi listo! Revisa tu correo")**:
   - **Paso 1**: *"Verifica tu correo con 1 solo clic"* — Abre el correo que te enviamos y toca el botón "Confirmar mi correo" para activar tu cuenta de inmediato.
   - **Paso 2**: *"Al confirmar tu correo serás llevado a la página de bienvenida con el enlace a nuestro WhatsApp y podrás pedir las ofertas cercanas a ti con solo enviar la palabra 'Ofertas'"*.
   - **Botón de Acción**: *"Abrir mi correo para confirmar"* (abre el cliente de correo predeterminado del dispositivo o webmail sugerido).
   - **Simulador de Entorno de Pruebas**: Enlace secundario discreto para QA local que permite emular el clic en el enlace del correo y abrir la página de bienvenida en estado verificado.
3. **Página de Bienvenida (Protegida)**:
   - **Estado A — Verificación Exitosa (Token Válido)**:
     - Título: *"¡Bienvenido a vuuy, [Nombre]!"* con badge verde de "Correo Verificado".
     - Mensaje: *"Tu cuenta ha sido activada con éxito. Ya puedes solicitar y recibir las mejores promociones y descuentos de comercios en tu zona."*
     - Botón principal de WhatsApp (verde esmeralda con icono de WhatsApp):
       - Texto: *"Abrir WhatsApp y enviar 'Ofertas'"*
       - Destino: `https://wa.me/{numero}?text=Ofertas`
     - Nota explicativa: *"Al pulsar el botón se abrirá WhatsApp con la palabra Ofertas preescrita. Solo debes enviarla para comenzar."*
   - **Estado B — Acceso Restringido (Sin Token o Token Inválido)**:
     - **El botón de WhatsApp no se renderiza bajo ninguna circunstancia.**
     - Icono de seguridad / candado suave en tonos ámbar/slate.
     - Título: *"Acceso restringido"*
     - Mensaje: *"Esta página está reservada para usuarios que han completado la confirmación de su correo electrónico. Si ya te registraste, por favor revisa tu bandeja de entrada o carpeta de spam y haz clic en el enlace de verificación."*
     - Botones de acción alternativos: *"Registrarme ahora"* y *"Volver al inicio"*.

---

### 3. Key Product Decisions & Trade-Offs

- **Protección estricta de la Página de Bienvenida**:
  - *Decisión*: No exponer el número o canal de WhatsApp en la página de bienvenida a visitas anónimas o directas. Si no hay token de validación vigente, la interfaz oculta cualquier botón o enlace a WhatsApp.
  - *Justificación*: Protege el canal de WhatsApp frente a números desconocidos o spam, asegura que cada usuario conectado tenga un correo real comprobado y previene registros ficticios.
- **Sustitución del botón en el modal inicial**:
  - *Decisión*: En lugar de un botón prematuro a WhatsApp en el modal inicial, se provee un botón para abrir el cliente de correo (`mailto:` o proveedores populares), alineando la expectativa del usuario con la acción requerida.
  - *Justificación*: Evita que el usuario salte el paso 1 sin haber confirmado su cuenta.
- **Texto preescrito uniforme ("Ofertas")**:
  - *Decisión*: Estandarizar estrictamente el parámetro `text=Ofertas` en la URL de WhatsApp y en toda la documentación para que el bot responda inmediatamente con las ofertas de la zona del usuario.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│ 1. Formulario de Registro                              │
│    - Captura nombre, correo, distrito                  │
│    - Genera token de verificación de un solo uso       │
│    - Despacha correo con enlace: /?verify_token=tok_x │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 2. Modal Informativo Post-Registro                     │
│    - Paso 1: Confirmar correo con 1 solo clic          │
│    - Paso 2: Mensaje exacto hacia página de bienvenida │
│    - Botón primario: "Abrir mi correo para confirmar"  │
└──────────────────────────┬─────────────────────────────┘
                           │
                Usuario hace clic en el enlace
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 3. Verificación de Token (Página de Bienvenida)        │
│    - Lee parámetro verify_token en la URL              │
│    - Valida existencia y estado del usuario            │
│                                                        │
│    ¿Token válido y confirmado?                         │
│         ├─ SÍ ──► Muestra Bienvenida y Activa Cuenta   │
│         │         [Botón Oficial WhatsApp: 'Ofertas']  │
│         │                                              │
│         └─ NO ──► Vista de Acceso Restringido          │
│                   [Botón WhatsApp estrictamente oculto]│
│                   [Mensaje: Revisa correo / Regístrate]│
└────────────────────────────────────────────────────────┘
```

#### Mapeo de Componentes y Estados:
- **Modal de Incorporación**: Actualiza las descripciones de los pasos, sustituye el botón de WhatsApp por la acción de revisar correo y sincroniza el simulador de activación.
- **Vista de Bienvenida Protegida**: Nuevo componente con renderizado condicional según el resultado de validación del token; aplica bloqueo estricto del botón de WhatsApp si no hay sesión verificada.
- **Controlador Web Principal**: Intercepta parámetros de URL (`verify_token` o ruta de bienvenida), ejecuta la validación del usuario y monta la vista correspondiente.
- **Servicio de Notificaciones y Enlaces**: Garantiza que las plantillas de email y los generadores de enlaces de WhatsApp utilicen el mensaje `"Ofertas"`.
