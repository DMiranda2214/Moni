# Manual de usuario

Moni funciona en el celular y en el computador. En el celular, abajo hay cuatro pestañas (**Inicio, Dinero, Planear y Deudas**) y, en el centro, el botón **+** para registrar un gasto, un ingreso, mover dinero o convertir divisas (también puedes repetir uno reciente). En tablet y computador las mismas áreas están en una **barra lateral** que se puede contraer, con el botón *Registrar* (atajo **N**) y una búsqueda para ir a cualquier pantalla, cuenta o bolsillo (**Ctrl K**). *Ajustes* y la *Guía de uso* están al pie de la barra lateral y, en el celular, en Ajustes.

- **Dinero:** Bolsillos, Movimientos, Ahorro y CDT.
- **Planear:** Presupuesto, Nómina, Otros ingresos, Servicios y suscripciones, Regalos y Vista anual.
- **Deudas:** tarjetas de crédito y créditos.
## 1. Primer uso

1. **Abre el enlace** de la app (guárdalo como favorito o *Agregar a pantalla de inicio*). Google te pedirá iniciar sesión.
2. **Autoriza a Moni.** Mientras la app no esté verificada por Google verás *"Google no ha verificado esta aplicación"*: es normal; elige **Configuración avanzada → Ir a Moni** y acepta los permisos (crear tu hoja en tu Drive, copias de seguridad y avisos en Calendar).
3. **Crea tu hoja.** En la bienvenida pulsa **Crear mi hoja** (Moni la crea en tu Drive y la deja lista). Si ya tenías una hoja de Moni —por ejemplo una compartida con tu pareja o una copia de seguridad— elige **Ya tengo una hoja de Moni** y pega su enlace.
4. **Sigue el asistente de configuración**, paso a paso, con una barra de progreso arriba: tu nombre (y color), tus bancos (con su rendimiento y su moneda), tus cuentas, tus bolsillos con su saldo inicial y, si quieres, tus tarjetas, tu nómina, otros ingresos, tus CDT, tu hogar, tus servicios y suscripciones, y si vinculas el dólar de Google Finance. Lo que ya agregaste se puede tocar para corregirlo. En los bancos, cuentas y bolsillos puedes usar **Guardar y agregar otro**. Si lo cierras con **Seguir más tarde**, en Inicio queda la lista de **Primeros pasos** con una fila **Continuar con el asistente**.
5. **Listo.** Desde **Inicio** ya puedes registrar tu primer gasto.

*(Solo en el entorno de pruebas)* ¿Quieres explorar antes de usar tus datos? **Ajustes → Datos de demostración → Crear**: verás información ficticia que se borra con un toque y no toca lo tuyo. En producción no existe.

## 2. Inicio
- **Primeros pasos** (hasta que termines de configurar) y, después, **Para tener en cuenta**: avisos de lo que falta o está desactualizado (ver sección 15).
- **Primeros pasos:** mientras falten, una tarjeta con tu avance y el siguiente paso; los pasos se agrupan en *Lo básico* y *Para sacarle más provecho*.
- **Saldo total** (tarjeta pastel): total, disponible, ahorro e invertido, con un ojo para ocultar las cifras.
- **Este mes:** lo que entró, lo gastado y lo que te queda, con el avance del presupuesto.
- **Accesos rápidos:** Mover dinero, Servicios, Movimientos y Ahorro (para gastos e ingresos está el botón **+**).
- **Tus cuentas:** saldo de cada una (toca para ver sus bolsillos).
- **Gráficos:** tu saldo de los últimos 6 meses y en qué gastaste este mes.
- **Otras monedas:** los saldos en dólares o euros, aparte, con su equivalente en pesos si anotaste la tasa.
- **Invertido:** el capital de tus CDT vigentes (no es dinero disponible).
- **Presupuesto del mes:** cuánto has gastado frente a lo planeado.
- **Por recibir:** nómina estimada, otros ingresos y CDT que vencen.
- **Próximos pagos:** extractos, cuotas, servicios y suscripciones de los próximos 14 días (o vencidos).
- **Últimos movimientos.**
- El botón **Registrar** siempre está a la vista.

## 3. Registrar un movimiento
Toca **Registrar** o un acceso rápido y elige:
- **Gasto:** valor, bolsillo, categoría (opcional), concepto y fecha. Puede enlazarse a un renglón del presupuesto.
- **Ingreso:** dinero que entra a un bolsillo.
- **Mover:** de un bolsillo a otro (los dos movimientos quedan ligados).

Al guardar verás un aviso con **Deshacer**. La fecha no puede ser futura. Para corregir un movimiento, ábrelo y **Editar** (los traslados y los pagos automáticos se anulan y se vuelven a registrar).

## 4. Bolsillos
Cada cuenta con sus bolsillos y saldos. Si en una cuenta con bolsillos queda dinero que no está en ninguno (por ejemplo, una nómina que aún no repartes), aparece como **Sin asignar**; con saldo en cero se oculta, pero siempre puedes elegirlo al registrar. En la cuenta puedes escribir un *Saldo inicial* que quede sin asignar, y activar o desactivar **Usar bolsillos** cuando los necesites. Toca un bolsillo para ver sus movimientos por mes, **Registrar**, **Mover dinero** o **Editar**. En la cuenta, **Cuadrar** compara con el saldo de tu banco: escribe lo que dice el banco; si hay diferencia, puedes dejar un **ajuste**.

### Dólares y otras monedas
- La moneda se elige **al crear el banco** (pesos, dólares o euros). Sus cuentas y bolsillos la heredan, y todo se muestra en esa moneda.
- Los saldos **no se mezclan**: el Total del Inicio es solo en pesos y, aparte, aparece **Otras monedas**. Si anotas cuánto vale el dólar en **Ajustes → Divisas** (o activas **Traerla sola de Google Finance**), se ve el equivalente en pesos. Es solo una referencia: cada banco cambia a su propio precio, así que los saldos y las conversiones nunca la usan.
- Para pasar dinero entre monedas (por ejemplo, comprar dólares) usa **Dinero → Bolsillos → Convertir divisas**: escribes **cuántos dólares compras o vendes** y **la tasa que te dio el banco por cada uno**; Moni calcula cuánto sale y cuánto llega. La TRM de referencia (si la anotaste) solo se muestra para comparar.
- Si el banco cobra **comisión aparte**, escríbela en el mismo panel y elige de qué bolsillo se cobra (origen o destino). Queda como un gasto de la categoría *Comisión bancaria*, dentro de la misma conversión: al deshacerla se deshace todo junto.
- Entre bolsillos de la misma moneda, **Mover dinero** funciona igual que siempre.
- Presupuesto, nómina, tarjetas, créditos, ahorro con deuda, suscripciones y regalos funcionan solo en pesos: no ofrecen bolsillos en otras monedas.

### Saldos iniciales
Se escriben al crear cada cuenta y bolsillo (en el asistente de primeros pasos o en Ajustes). Si algo no cuadra con tu banco, usa **Cuadrar** en la cuenta.

## 5. Presupuesto
1. **Plantilla:** Ajustes → Plantilla del presupuesto. Cada renglón tiene concepto, monto, tipo (Gasto, Cuota de un crédito, Ahorro, Fondo) y bolsillo.
2. **Generar** el mes: elige escenario (Normal, Contingencia…).
3. El **Real** se calcula solo desde tus movimientos enlazados al renglón. **Marca como pagado** cuando lo cubras: se abre una hoja donde confirmas **de qué bolsillo salió**, el valor y la fecha, y Moni registra el pago por ti (un gasto; una compra con tarjeta; el pago de la cuota de un crédito; o el traslado a tu ahorro o fondo). Si ya lo habías anotado en Movimientos, elige *¿Ya lo registraste?* y se **enlaza** sin duplicar. Al desmarcarlo, Moni pregunta si también anula esos pagos. Con el pago hecho se calcula el **ahorro** (plan − real).
4. Puedes agregar renglones sueltos del mes, editar o eliminar.
5. **Repartir la nómina en los bolsillos** (desde Nómina): mueve el dinero desde el bolsillo donde llegó hasta los bolsillos de destino del presupuesto. Los gastos y cuotas se agrupan por bolsillo; el ahorro y los fondos van renglón por renglón. Lo que ya está en el bolsillo de origen no se mueve, y si ya repartiste ese mes la app te pide confirmar antes de repetir.

## 6. Nómina
> **¿Ya recibiste la nómina antes de empezar con Moni?** Al registrarla, apaga **Sumar a mis saldos**: la nómina queda registrada (y cuenta como ingreso en el presupuesto y la vista anual) pero no cambia ningún saldo, porque ese dinero ya está en los que escribiste. Si te equivocas, anúlala y regístrala de nuevo.
>
> **¿La recibiste a fin de mes para el mes siguiente?** En *Cuenta en el presupuesto de* elige el mes siguiente: el ingreso suma en el presupuesto de ese mes, mientras tus saldos y el historial siguen con la fecha real. Si ya la registraste, en *Nómina recibida* toca **Cambiar** junto a ese mes; no mueve dinero.

**Planear → Nómina** abre el **estimado de lo que vas a recibir** en el próximo pago (como la hoja de estimado del Excel). Cada línea tiene una **casilla** para incluirla o no, y puedes cambiar los **días** (un mes incompleto, la prima, las vacaciones). El total se actualiza al instante. Con **Agregar un descuento o ingreso fijo** sumas cosas como una libranza, la medicina prepagada o un bono.

Escribe tu sueldo (toca la fila *Sueldo base* para cambiarlo) y agrega tus descuentos o ingresos fijos (libranza, medicina prepagada, un auxilio). Mira el cálculo (devengos, salud, pensión, FSP, prima de junio/diciembre, intereses de cesantías) y, con **Agregar algo de este mes**, suma lo que solo cuenta en ese pago: horas extras, un bono, el pago de cesantías, la prima o un descuento de la empresa. Después **Registra** lo que realmente te llegó, indicando el bolsillo. Ya no hay escenarios: es una sola nómina. Se paga **una vez al mes**. Los parámetros (SMMLV, porcentajes) están en Ajustes → Parámetros de nómina; **actualiza el SMMLV cada enero**.

## 7. Deudas
### Tarjetas de crédito
- **Agregar una compra:** desde **Registrar** (elige la tarjeta en *Con qué pagaste*) o desde la tarjeta. Si la compra está en un renglón de tu presupuesto, elígelo: **cuenta como gasto de ese renglón el día de la compra** y Moni aparta el dinero de su bolsillo a la **reserva** de la tarjeta. Si no está en el presupuesto, no se aparta nada: al pagar el extracto indicas de qué bolsillo sale.
- El **mes del extracto** se decide por el día de corte.
- **Pagar el extracto:** una sola acción, todo o nada: si a la reserva le falta, **eliges de qué bolsillo sale** lo que falta; luego se paga el total desde la reserva y se marcan el extracto y las compras como pagados. Se puede **deshacer**.
### Créditos de autopago
- Un crédito es un préstamo desde tu ahorro hacia ti (o a alguien): monto, plazo, tasa y cuenta de ahorro. Moni calcula la cuota (amortización francesa) y el cronograma antes de guardar.
- **Pagar cuota:** sale de un bolsillo y **vuelve al ahorro**.
- **Corregir una cuota ya pagada:** toca la cuota en la tabla de amortización y escribe lo que realmente pagaste ese mes (por ejemplo, con un abono extra que no anotaste). Moni rehace el cronograma con la misma cuota fija y tasa, así que el saldo y el plazo quedan como si siempre se hubiera pagado así. **No mueve dinero ni cambia tus saldos.**
- **Abonar más que la cuota:** baja el **plazo**; la cuota y la tasa no cambian. Si abonas más que el saldo, solo se cobra lo necesario.

## 8. Otros ingresos
**Planear → Otros ingresos**: lo que recibes además de la nómina (otro trabajo, arriendo, ventas, servicios). Para cada uno anotas el concepto, el monto, cada cuánto llega, la próxima fecha y **a qué cuenta llega**. Cuando llega, toca **Ya lo recibí** (puedes corregir el valor) y se suma a esa cuenta. Los próximos aparecen en **Por recibir**, en Inicio.

## 9. Ahorro
**Dinero → Ahorro.** Por cada cuenta de ahorro: saldo, meta, rendimientos y **deuda con el ahorro**.
- **Rendimiento estimado:** si configuraste la tasa de tu banco (Ajustes → Bancos: % EA y si paga cada día o cada mes), Moni calcula cuánto te rinde y lo que falta por registrar; **Registrar este rendimiento** lo anota (corrígelo si tu banco muestra otro valor).
- **Rendimiento:** interés (suma), retención y GMF (restan).
- **Sacar para gastos:** pasa dinero a un bolsillo y queda como algo por **reponer**.
- **Reponer:** devuelve dinero al ahorro y baja la deuda.

## 10. CDT
**Dinero → CDT.** Registra cada CDT con su banco, capital, tasa (% EA), fecha de inicio, plazo en días, cuándo paga los intereses y la retención que te aplica el banco. Si el dinero sale hoy de un bolsillo, activa *Descontar el capital de un bolsillo*; si ya lo tenías antes de usar Moni, déjalo apagado. El capital aparece como **Invertido** (no como disponible). En el detalle ves cuánto ganarás (bruto, retención y neto) y cuánto del plazo ha pasado, y puedes **Registrar intereses** (si los paga por periodos), **Cobrar** o **Cancelar antes de tiempo** (con la opción de **renovar**), **Editar** o **Anular**. Los vencimientos salen en *Por recibir* de Inicio y en Google Calendar.

## 11. Servicios y suscripciones
**Planear → Servicios y suscripciones** (o *Pagar servicios* en Inicio).
- Arriba: cuánto te cuestan **al mes y al año**.
- **Por pagar:** vencidas o en los próximos 7 días.
- Toca un cobro: **Registrar el pago** (desde un bolsillo o con una tarjeta), **Ir a pagar** (enlace), **Copiar código**, **Saltar este cobro** o **Editar**.
- Al pagar, el próximo cobro avanza un período y se mantiene el día. En un **servicio**, el valor guardado pasa a ser el último que pagaste.
- **Agregar:** botón **+**. Elige si es *Suscripción* (valor fijo) o *Servicio* (valor variable, con código y enlace opcionales), cada cuánto se cobra, el próximo cobro y con qué se paga.
- Abajo: **Códigos y enlaces de pago** de tus servicios públicos (Ajustes → Servicios públicos).

## 12. Regalos
**Planear → Regalos.** Lista por año: a quién, idea, estimado. **Registrar la compra** crea el gasto y suma al real. Hay resumen de estimado, gastado y comprados.

## 13. Vista anual y gráficos
**Planear → Vista anual:** mes a mes, ingreso, plan, real, ahorro, tarjetas y restante. Toca un mes para abrir su presupuesto.

### Gráficos
No hay una pantalla aparte de gráficos: **cada módulo trae los suyos**. Pasa el dedo o el cursor (o usa las flechas del teclado) para ver los valores exactos, y **Ver como tabla** muestra los mismos datos en texto.
- **Inicio:** tu saldo de los últimos 6 meses y en qué gastaste este mes.
- **Movimientos:** *En qué gastaste este mes*, por categoría.
- **Presupuesto:** *Plan frente a real* de los renglones más avanzados; los que se pasan dicen "excedido".
- **Nómina:** *A dónde va lo descontado* de tu devengado.
- **Servicios y suscripciones:** *Lo que más pesa al mes* (los pagos anuales o semestrales se reparten por mes).
- **Regalos:** lo gastado frente a lo estimado de cada persona.
- **CDT:** cuánto hay en cada uno y el avance de su plazo.
- **Deudas:** *Cupo usado* de cada tarjeta y *Avance de los créditos*; dentro de un crédito, cómo baja el saldo cuota a cuota.
- **Ahorro:** evolución del ahorro total y de cada cuenta, y avance hacia las metas.
- **Vista anual:** entró, planeado y real mes a mes.
- **Un bolsillo:** su saldo al cierre de cada mes.

## 14. Movimientos
**Dinero → Movimientos:** todo lo registrado, por mes, con **búsqueda** por concepto, bolsillo o categoría y la opción de ver anulados.

## 15. Avisos en Inicio
**Para tener en cuenta** te dice qué falta configurar o está desactualizado (salario mínimo, un CDT vencido, suscripciones que faltan en el presupuesto, la nómina, los recordatorios…). Toca **Resolver** para ir a donde se arregla; los que no son urgentes se pueden ocultar con **Ahora no** y volver a mostrar en *Ajustes → Avisos de Inicio*.

## 16. Ajustes

Menú **Ajustes** (desde *Más*):
- **Tú:** **Perfil** (nombre) y **Apariencia** (claro/oscuro/automático y color).
- **Dinero:** bancos (con su moneda y rendimiento), cuentas, bolsillos y tarjetas, y **Divisas** (tasa de referencia del dólar y el euro). Una cuenta puede **permitir bolsillos** (Nequi) o ser un solo saldo (débito). Nada se borra de golpe: se **desactiva** y se puede **reactivar**; si algo tiene saldo o depende de otra cosa, la app te dice por qué no se puede.
- **Presupuesto y nómina:** plantilla del presupuesto, escenarios del presupuesto, mi nómina, subsidios y parámetros de nómina.
- **Organización:** categorías, personas, hogares (inmuebles) y servicios públicos.
- **Mantenimiento:** *Avisos de Inicio* (volver a mostrar los ocultos), *Actualizar desde la hoja* (si editaste la hoja a mano), **Recordatorios**, **Mi cuenta**, **Respaldos**, **Registro de errores**, **Diagnóstico** y, solo en desarrollo, *Datos de demostración*.
- **Privacidad:** **Borrar todos mis datos**.

### Mi cuenta
De quién es la hoja: tu correo, un enlace a tu hoja (ábrela solo para consultar: editarla a mano puede dañar la app) y **Usar otra hoja**, que suelta la actual **sin borrarla** y apaga sus copias automáticas y recordatorios para empezar con otra o volver a una copia de seguridad.

### Recordatorios en Google Calendar
**Ajustes → Recordatorios.** Al activarlos, Moni crea un calendario llamado **Moni** y pone un evento por cada pago de los próximos 45 días: extractos de tarjeta, cuotas de crédito, suscripciones y servicios, vencimientos de CDT y, si lo dejas marcado, las fechas límite de prima y cesantías.
- Eliges la **hora** y con cuántos **días de anticipación** quieres el aviso (además del aviso del mismo día).
- Se actualiza **solo cada día** y unos segundos después de que registras o pagas algo; cuando pagas, el evento se va y aparece el del siguiente cobro. **Sincronizar ahora** lo hace al instante.
- Lo que tú agregues a mano en ese calendario no se toca. **Quitar de mi calendario** borra el calendario Moni completo.
- La primera vez Google te pedirá permiso para usar Calendar. Los eventos llevan el valor de cada pago: cuida con quién compartes ese calendario.

### Registro de errores
**Ajustes → Registro de errores** muestra lo que falló o se rechazó (con filtro Errores/Todo). Si algo no funciona, pulsa **Copiar el registro** y envíalo a quien administra la app. **Limpiar** lo vacía; tus datos no se tocan.

### Borrar todos mis datos
Para empezar de cero o dejar de usar la app: **Ajustes → Privacidad → Borrar todos mis datos**. La pantalla explica qué se borra y qué no; al pulsar el botón se abre una ventana que exige escribir **BORRAR** para habilitar el borrado.
- **Se borra:** bancos, cuentas, bolsillos, tarjetas, movimientos, presupuestos, nómina, créditos, regalos, suscripciones, CDT, tu nombre y tus preferencias. Se apagan las copias automáticas y los recordatorios, y se borra el calendario Moni.
- **No se borra:** las copias de **"Moni Respaldos"** en tu Drive (contienen tus datos; en la ventana puedes elegir mandarlas también a la papelera) ni los archivos que hayas guardado en Drive, como extractos en PDF.
- **No se puede deshacer.** Si dudas, crea antes un respaldo en **Ajustes → Respaldos**.
- Al terminar vuelves a ver la bienvenida.

## 17. Respaldos
**Ajustes → Respaldos:** crea una copia ahora o activa copias automáticas (cada N días, conservando las últimas N). Quedan en tu Drive, carpeta **Moni Respaldos**.

## 18. Consejos
- Registra el gasto **cuando lo haces**; es más fácil que recordar al final del día.
- Usa **Cuadrar** una vez por semana con cada cuenta.
- Si dudas de una cifra, abre el detalle del bolsillo: allí está cada movimiento.
- Si algo falla, mira **Ajustes → Diagnóstico** y la [guía de solución de problemas](OPERACION.md#problemas-frecuentes).
