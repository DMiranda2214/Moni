# Plan: unir "Servicios del hogar" con "Suscripciones"

**Evaluación: sí conviene.** Hoy son dos cosas separadas que la persona percibe como una sola ("lo que pago cada mes"):

| Hoy | Problema |
|---|---|
| `Servicios_Publicos`: hogar, servicio, empresa, código de pago, enlace | Solo guarda datos de pago; no sabe cuánto cuesta ni cuándo vence |
| `Suscripciones`: nombre, tipo (suscripción o servicio), valor, periodicidad, próximo cobro, medio de pago, enlace | Para tener el código de un servicio hay que crear *también* el servicio público y enlazarlo |

Consecuencias: se escribe dos veces, el enlace de pago vive en dos sitios, el asistente tiene dos pasos casi iguales y una suscripción no sabía de qué hogar era.

## Propuesta
Un solo concepto, **"Servicios y suscripciones"**, con estos campos:
`Nombre · Tipo (suscripción / servicio) · Hogar (opcional) · Empresa · Código de pago · Enlace de pago (opcional) · Valor · Periodicidad · Próximo cobro · Con qué se paga`.

- Un servicio (luz, agua, internet) lleva hogar, empresa y código; una suscripción (Netflix) puede llevar hogar si se paga por separado en cada casa.
- El mismo nombre se puede repetir en hogares distintos (Netflix en mi casa y en la de mi mamá); en el presupuesto aparece como *Netflix · Casa de mamá*.
- El asistente pasa de dos pasos (servicios y suscripciones) a uno, después de *Hogar*.

## Qué hay que cambiar
1. **Esquema:** `Suscripciones` gana `ID_Inmueble` (ya añadido en 1.1), `Empresa` y `Codigo_Pago`. `Servicios_Publicos` deja de usarse, pero **la pestaña no se borra** (nada de datos perdidos).
2. **Migración automática al actualizar:** cada servicio público enlazado a una suscripción le pasa su hogar, empresa, código y enlace; los que no estaban enlazados se vuelven una suscripción de tipo *Servicio* con valor por definir (0) y próximo cobro el primer día del mes siguiente.
3. **Pagar:** un servicio con valor 0 pide el valor al pagar (ya lo hace con los servicios).
4. **Pantallas:** quitar *Servicios públicos* de Ajustes y de la guía; en la lista de suscripciones, agrupar por hogar y copiar el código desde ahí.
5. **Pruebas y documentos:** migración (enlazados, sin enlazar, repetible), asistente de un paso menos, textos del manual.

**Riesgo:** la migración. Se mitiga dejando la pestaña vieja intacta y haciendo la migración repetible (no duplica).
**Esfuerzo:** medio día, y conviene hacerlo como versión 1.2 una vez la 1.1 esté probada en producción.

## En esta versión (1.1) ya queda hecho lo que no estorba al plan
- `Suscripciones.ID_Inmueble` (hogar opcional) y nombres repetibles entre hogares.
- Enlace de pago opcional también en el asistente de servicios.
- *Hogar* va antes de *Servicios* y de *Suscripciones* en los primeros pasos.
