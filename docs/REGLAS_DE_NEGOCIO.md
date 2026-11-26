# Reglas de negocio

Cómo se calcula cada cosa. Las cifras de control son ejemplos ficticios y están cubiertas por pruebas automáticas.

## 1. Libro de movimientos y saldos
- Todo es un **movimiento** con signo: lo que entra es positivo y lo que sale, negativo.
- **Saldo de un bolsillo = saldo de apertura + suma de sus movimientos no anulados que afectan saldos.** Se puede consultar a una fecha.
- **Movimientos históricos** (`Afecta_Saldos = FALSE`): un gasto, un ingreso o un traslado entre bolsillos (las dos patas) que se anota con la casilla *Sumar a mis saldos* apagada. Sirve a quien empieza a usar Moni a mitad de mes (o más tarde) y quiere registrar lo que ya pasó sin mover dinero: **cuenta** en el resumen del mes, las categorías, *Entró y salió*, el presupuesto (real e ingresos del mes) y la vista anual, pero **no cambia ningún saldo**, ni el saldo al cierre de cada mes, ni los rendimientos del ahorro, ni el cuadre. Se puede cambiar después (editar el movimiento) y se ve con la marca *Histórico*. Solo vale para gastos e ingresos: un ajuste corrige un saldo, un traslado mueve dinero y una compra con tarjeta no es un movimiento de bolsillo. Los movimientos anteriores a esta opción siguen afectando saldos.
- Un **traslado** son dos movimientos que comparten `ID_Grupo` y suman cero.
- **Anular** marca el movimiento (o el grupo completo); no borra. Se puede restaurar si los bolsillos siguen activos.
- La fecha de un movimiento no puede ser futura. Las fechas se guardan como texto `AAAA-MM-DD`.
- **Cuadrar:** diferencia = saldo real del banco − saldo de Moni de esa cuenta; el ajuste opcional es un movimiento de tipo *Ajuste*.
- **Toda cuenta tiene un bolsillo interno** con su saldo propio. Si la cuenta usa bolsillos se llama **"Sin asignar"**: el dinero que no está en ningún bolsillo (una nómina sin repartir, una diferencia de *Cuadrar*, un saldo inicial sin destino). Si no los usa, ese bolsillo es toda la cuenta y lleva su nombre. Su saldo de apertura es el *Saldo inicial* de la cuenta.
- **Usar bolsillos** se puede activar o desactivar cuando se quiera: al activarlo, el saldo de la cuenta queda como *Sin asignar* y se pueden crear bolsillos; al desactivarlo, el dinero de todos los bolsillos se junta en el saldo interno (traslados que quedan en el historial) y los bolsillos se desactivan.
- *Sin asignar* se oculta de la lista de Bolsillos mientras esté en 0 y la cuenta tenga otros bolsillos, pero siempre se puede elegir al registrar un ingreso o un movimiento. Con el rendimiento *solo sobre bolsillos*, el dinero sin asignar no rinde (como el saldo de una cuenta sin bolsillos).

## 1 bis. Monedas (divisas)
- La **moneda se elige en el banco** (`COP`, `USD`, `EUR`, `GBP`, `CHF`, `CAD`, `AUD`, `JPY`, `CNY`, `MXN`, `BRL`, `CLP`, `PEN`, `ARS` o `UYU`: las más comunes del mercado, `DIVISAS_INFO`; pesos por defecto). Brokers e inversiones usan la misma lista. El yen y el peso chileno se muestran sin decimales. Sus cuentas y bolsillos la heredan y todo se muestra en esa moneda. No se puede cambiar la moneda de un banco que ya tiene cuentas: se crea otro banco.
- **Los saldos de monedas distintas nunca se suman.** El Total, el Disponible y el Ahorro de Inicio son en pesos; las demás monedas van aparte en *Otras monedas*, con su **equivalente en pesos** (saldo × tasa de referencia) solo si hay una tasa anotada.
- Un **traslado** solo se hace entre bolsillos de la **misma moneda**. Para pasar dinero entre monedas se usa la **conversión**.
- Presupuesto, nómina, tarjetas (en bancos en pesos), créditos de autopago, ahorro con deuda, suscripciones, servicios, metas y la lista de deseos **solo usan pesos**: el servidor rechaza un bolsillo en otra moneda y la pantalla no lo ofrece.
- **Conversión** (Mi dinero → Bolsillos → Convertir divisas): se escribe la **cantidad** de la moneda de afuera y la **tasa que dio el banco** por cada unidad; sale `cantidad × tasa` de un lado y llega la cantidad del otro. Son dos movimientos con el mismo `ID_Grupo` (`Subtipo = Conversion`) que **no suman cero** porque cada uno está en su moneda; la tasa implícita queda en las notas. La TRM de referencia **no interviene** (cada banco cambia a su precio): solo se muestra para comparar.
- **Comisión** del banco (opcional, se escribe cada vez): un **gasto aparte** (`Subtipo = Comision`, categoría *Comisión bancaria*, que se crea sola) cobrado del bolsillo de origen o del de destino, dentro del mismo `ID_Grupo`: anular o restaurar la conversión mueve también la comisión. Si la persona desactivó la categoría, la comisión queda sin categoría.
- Los totales de **entró** y **salió** (Movimientos, gráficos, vista anual) son de **una sola moneda** (pesos, o la del bolsillo o cuenta que se mira) y **no cuentan** los traslados ni las conversiones.
- **Tasa de referencia:** pesos por unidad de cada moneda. Se anota a mano o la trae Google Finance (hoja auxiliar `Tasas_Google`, una fórmula por moneda: `CURRENCY:<XXX>COP` y, si Google no tiene ese par, el cruce `<XXX>USD × USDCOP`; es la tasa del mercado, no la TRM oficial). Guarda fecha y fuente y **solo es informativa**. Se redondea a 2 decimales desde 100 pesos por unidad y a 4 por debajo (peso chileno, yen…).
  - Google actualiza el dólar, el euro y las monedas **en uso** (las de bancos, brokers e inversiones activos, `divisasEnUso_`) o que ya tienen tasa. Las filas `Tasa_<XXX>` de Config se crean al anotar la primera tasa de esa moneda.
  - Aviso en Inicio cuando una moneda en uso no tiene tasa (y la actualización automática está apagada).

## 2. Presupuesto
- **Plantilla** por escenario (uno es el base). **Generar** crea los renglones del mes; si el mes ya existe, reemplazarlo solo se permite si ningún renglón tiene movimientos.
- **Completo** es una marca manual: "este renglón ya no tendrá más movimientos". Al marcarla se pregunta si falta algún movimiento; "bastan los registrados" solo pone la marca (`marcarRenglonPagado`) y "agregar" abre el pago. Desmarcar solo reabre. `pagarRenglonMes` con `Completar: false` agrega un movimiento sin completar.
- **Agregar el pago** (al completar o desde el detalle) registra el pago de verdad (`pagarRenglonMes`): Gasto → movimiento de gasto desde el bolsillo elegido (o compra con tarjeta si el renglón se paga con tarjeta); Cuota con crédito → pago de la cuota; Ahorro, Fondo o cuota sin crédito → traslado desde el bolsillo elegido al de destino. Todo queda enlazado al renglón. Alternativa: enlazar un movimiento suelto del mes (o del anterior) para no duplicarlo. Desmarcar puede anular los pagos sencillos; los de cuotas de crédito y los repartos de nómina se deshacen desde su pantalla.
- **Real** de un renglón se **calcula** (no se escribe): un gasto enlazado suma; un ajuste enlazado resta; el lado de entrada de un traslado enlazado suma; y una **compra con tarjeta** enlazada suma el día de la compra (las de fuente *Del presupuesto* ya cuentan por su traslado a la reserva, así que no se cuentan dos veces; las *De otra persona* no cuentan).
- Una suscripción o servicio puede pertenecer a un **hogar** (`ID_Inmueble`): el mismo nombre se puede repetir en hogares distintos y, cuando hay varios hogares, el renglón se llama *Nombre · Hogar*.
- **Suscripciones y servicios dentro del presupuesto:** al generar un mes, cada suscripción o servicio que toca ese mes (según su periodicidad, contada desde su próximo cobro) entra como renglón de gasto, con su valor, su bolsillo o su tarjeta (`Presupuesto_Mes.ID_Suscripcion` los enlaza). Si el presupuesto del mes ya existe, la suscripción nueva o editada entra o se actualiza sola (mientras el renglón no esté pagado); el botón *Agregar* de Presupuesto cubre las que falten. Pagar la suscripción cuenta como lo real del renglón y lo deja pagado; deshacer el pago lo devuelve a pendiente. Un renglón de la plantilla con el mismo nombre que el *Renglón* de la suscripción cuenta como el suyo (no se duplica).
- Cada renglón puede recordar **con qué se paga** (`ID_Tarjeta`: su bolsillo, o una tarjeta). Al registrar un gasto de ese renglón, Moni propone ese medio.
- **Ahorro** de un renglón = Plan − Real, **solo si está pagado**. Resto (restante) = Plan − Real.
- **Ingresos del mes** = ingresos registrados en el mes; **Saldo** = ingresos − real.
- **Repartir la nómina:** un traslado por destino (gastos y cuotas agrupados por bolsillo; ahorro y fondos por renglón). Cada mes se reparte una vez salvo que se fuerce.

## 3. Nómina (una vez al mes)
- **Sin afectar saldos:** una nómina se puede registrar con `Afecta_Saldos = FALSE` (para quien ya tenía ese dinero en sus saldos iniciales). No crea movimiento ni pide bolsillo; queda con su detalle, cuenta como **ingreso** en el presupuesto y la vista anual, y no se puede repartir en bolsillos. Para cambiarla se anula y se vuelve a registrar.
- **Mes del presupuesto:** toda nómina (afecte saldos o no) cuenta como ingreso en el mes que se elige al registrarla (`Mes_Presupuesto`; por defecto, el mes que paga), y no en el de su fecha real: así una nómina recibida el 29 de octubre para noviembre suma en el presupuesto de noviembre. Los saldos y el historial siguen la fecha real. Su movimiento (si lo hay) no se cuenta además por fecha, para no sumarla dos veces. Se puede corregir después (`cambiarMesPresupuestoNomina`) sin tocar saldos. Las nóminas registradas antes de esta opción cuentan en el mes que pagan. Las anteriores a esta opción se tratan como que sí afectaron.
El estimado replica la hoja "Estimado nómina" del Excel original: cada línea tiene una casilla (se incluye o no) y los días que aplican.
- **Líneas:** sueldo básico (días × sueldo / 30), subsidios (salariales o no), prima (días × día base), vacaciones (días × día base), intereses de cesantías, salud, pensión, fondo de solidaridad y los **conceptos fijos** del escenario (libranza, bono…).
- **Por defecto:** el sueldo y los subsidios van incluidos; la prima, solo en junio y diciembre (15 días); las vacaciones, apagadas (0 días); los intereses de cesantías, en enero.
- **Día base** = (sueldo + subsidios salariales) / 30. **IBC** (lo que cotiza) = sueldo del período + subsidios salariales + vacaciones. La prima y las cesantías no cotizan.
- **Intereses de cesantías:** por tramos del año, cada uno = (sueldo × días / 360) × días × 12 % / 360. Con un solo sueldo todo el año da sueldo × 12 %. Si el sueldo cambió, `Cesantias_Dias_Actual` y `Cesantias_Sueldo_Anterior` (Parámetros de nómina) parten el año en dos tramos.
- **Mes que se muestra al abrir:** el del próximo pago: este mes si aún no se registró y no pasó `Nomina_Dia_Pago`; si no, el siguiente.
- Hay una sola nómina por persona: sueldo base más descuentos o ingresos fijos. Para cada pago se pueden sumar **conceptos adicionales solo de ese mes** (horas extras y bonos: ingresos, cotizan si son salariales; pago de cesantías o prima extra: prestaciones, no cotizan; descuentos de la empresa). No se guardan como fijos.
- Al registrar la nómina se guarda lo estimado con las casillas que dejaste, y el neto real puede ser distinto.
- Devengos: sueldo base y subsidios (salariales o no). Salud y pensión: 4 % del IBC cada una, con aporte redondeado a la centena superior (PILA).
- **FSP** (Fondo de Solidaridad Pensional): 1 % del IBC cuando el IBC llega a 4 SMMLV (`FSP_Umbral_SMMLV`).
- **Prima:** en junio y diciembre, IBC / 2. **Intereses de cesantías:** en enero, IBC × 12 % (`Tasa_Interes_Cesantias`). Se asume año completo (pendiente de confirmar para años parciales).
- Cifras de control (sueldo base 3.127.845): deducciones 250.400; neto 2.877.445; neto con prima 4.441.367,50; intereses de cesantías en enero 375.341,40.

## 4. Tarjetas de crédito
- El **mes del extracto** de una compra depende del día de corte: hasta el corte entra al extracto de ese mes; después, al siguiente.
- **El gasto cuenta el día de la compra**, en su renglón y su categoría, sin importar el medio de pago. Pagar el extracto **no es un gasto nuevo**: liquida la deuda y no cuenta en los gráficos.
- **Fuente** de una compra (se elige sola): con renglón, *Del presupuesto* (aparta ahora el dinero desde el bolsillo del renglón a la **reserva**); sin renglón, *Sin apartar ahora* (no mueve dinero). También *Apartar de otro bolsillo* y *De otra persona* (no cuenta como gasto tuyo).
- **Pagar el extracto** es atómico: si algo falla, todo se revierte. Suma las compras del mes, completa la reserva con el bolsillo que **indiques al pagar** (por defecto, el personal de la tarjeta), paga el total desde la reserva y marca extracto y compras como pagados. Si falta dinero y no hay de dónde sacarlo, la app lo dice y no hace nada. Anular el pago los reabre.
- No se agregan compras a un extracto ya pagado.
- **Abonos** (`Pagos_Tarjeta`, Tipo `Abono`): bajan la deuda de un corte y liberan cupo (cupo usado = compras sin pagar − abonos sin aplicar); no aparta dinero en la reserva. De la persona: gasto `Pago_TC` desde un bolsillo; de un tercero: sin movimiento. No pueden superar la deuda del corte ni quedar de más al anular una compra. Al pagar el extracto se aplican; al anular ese pago vuelven a quedar pendientes.
- **Aportes de terceros** al pagar un extracto (Tipo `Aporte`): no mueven bolsillos; lo que sale de la reserva (y, si falta, del bolsillo elegido) es el total − abonos − aportes. Anular el pago anula los aportes.
- **Regalo con tarjeta:** es una compra sin apartar dinero. Mientras esa compra esté sin pagar en un extracto, `regalosPendientesReserva_` pide mover el valor a la reserva de la tarjeta (desde el bolsillo planeado del regalo, si lo tiene) hasta que haya traslados manuales suficientes; es un aviso *importante* (no se puede ocultar).
- **Cupo disponible** = cupo − compras no pagadas.
- **Vista anual:** *TTCC* = compras con tarjeta **sin renglón**, en el mes de la compra; *Saldo* = ingreso − real − TTCC.

## 5. Créditos de autopago
- Te prestas desde una **cuenta de ahorro** (el desembolso sale del ahorro) y pagas con **amortización francesa**; cada cuota **vuelve al ahorro**.
- **Tasa:** la EA se convierte a periódica con la **equivalencia exacta** `(1 + EA)^(1/n) − 1` (n = 12 mensual, 24 quincenal) o con el método del Excel de referencia (`2·((1+EA)^(1/2) − 1)/n`), según `Credito_Metodo_Tasa`. Desde la 1.19 las instalaciones nuevas usan la exacta; quien ya tenía `Excel` lo conserva en sus créditos de autopago.
- **Créditos bancarios:** **siempre** usan la equivalencia exacta, que es la que usan los bancos. El método del Excel no es una tasa equivalente: 24 % EA daba 1,8925 % mensual, que en realidad es 25,2 % EA, y la cuota salía más alta que la del banco.
- **Bancarios de antes de la 1.19** (método `Excel`): un aviso en Inicio y en el crédito muestra la tasa y la cuota con la equivalencia exacta. *Recalcular cuotas* rehace solo las pendientes desde el saldo de hoy, con la **misma EA** y el mismo número de cuotas (`corregirTasaCredito` con `metodo: 'Exacta'`), y deja `Metodo_Tasa = Exacta`. *Dejar como está* solo quita el aviso. Lo pagado, los pagos y los saldos no cambian.
- **Cuota fija** y tasa fijas. Un **abono mayor que la cuota recalcula el plazo** (la última cuota se ajusta). Un abono mayor que el saldo cobra solo lo necesario.
- El **cronograma** es versionado: al recalcular por un pago nuevo, el anterior queda como *Reemplazada*.
- **Corregir una cuota pagada** (`editarPagoCredito`): se cambia el valor pagado de esa cuota (≥ cuota fija, sin pasar de lo que se debe) y el cronograma completo se **rehace** pagando de nuevo, en orden, todas las cuotas pagadas con sus valores, con la misma cuota fija y tasa. No toca movimientos ni saldos; si la cuota venía como pagada al crear el crédito, se crea su registro de pago sin movimiento. Si lo corregido haría que otro pago sobrepase la deuda, se rechaza con un mensaje y no cambia nada. El cronograma anterior se sustituye (no se conserva como *Reemplazada*).
- Cifras de control: 2.400.000 a 48 quincenas con tasa 0,4067404 % → 55.140,90; 1.000.000 a 12 cuotas con 0,8333333 % → 87.915,89; 500.000 a 10 cuotas con 1 % → 52.791,04.

## 6. Ahorro
- **Rendimiento por banco:** cada banco puede tener una tasa efectiva anual (`Rendimiento_EA`) y una forma de pago (`Rendimiento_Pago`: cada día o cada mes). Aplica a sus cuentas de tipo Ahorro. Además `Rendimiento_Base` indica sobre qué saldo se paga: `Todo` (por defecto) o `Bolsillos` (hay bancos que solo pagan sobre el dinero guardado en bolsillos; el saldo suelto de una cuenta sin bolsillos no rinde).
- **Estimación:** rinde cada día sobre el saldo con que empezó, a la tasa diaria (1 + EA)^(1/365) − 1. Si el banco paga a diario, lo ganado se suma al saldo día a día; si paga cada mes, se suma al cerrar el mes. Se calcula desde el último rendimiento registrado (o el inicio del mes) hasta ayer; "Registrar este rendimiento" lo anota (se puede corregir con el valor del banco). La retención y el GMF se siguen registrando a mano.
- **Retención** del CDT: en porcentaje (`Retencion_Pct`) o en pesos (`Retencion_Tipo = Valor`, `Retencion_Valor` = total del plazo). En pesos se convierte en el % equivalente sobre los intereses estimados, así los cobros periódicos la reparten en proporción; no puede superar los intereses. Al renovar se pasa a su % equivalente.
- Subtipos de movimiento: *Interes* (+), *Retencion* (−), *GMF* (−), *Para_Gastos* (retiro), *Reposicion*.
- **Deuda con el ahorro** = máx(0, Para_Gastos − Reposicion) + saldo de los créditos activos. El desembolso de un crédito no cuenta dos veces.
- **Si repones todo**, el saldo sería: saldo + deuda.

## 6 bis. Ingresos recurrentes
- Otro trabajo, arriendo, ventas, servicios… Cada uno tiene concepto, monto estimado, periodicidad, próxima fecha y la **cuenta (bolsillo) a la que llega**.
- "Ya lo recibí" registra un ingreso en ese bolsillo (con el valor real si fue otro), y el próximo cobro avanza un período conservando el día. Se puede saltar y deshacer.
- Salen en **Por recibir** de Inicio junto con la nómina estimada del próximo pago, a 14 días o atrasados.

## 7. Servicios y suscripciones
- Cada cobro guarda su **próximo cobro** y su **día**; al pagar avanza *N* meses según la periodicidad (1, 2, 3, 6 o 12) conservando el día (31 → 28 → 31).
- **Costo mensual** = valor / meses del período; **anual** = valor × 12 / meses.
- Se paga con **un** medio: un bolsillo (gasto) o una tarjeta (compra). El pago queda marcado `Suscripción <ID>`.
- Si el cobro tiene un **renglón del presupuesto** (`Renglon`, por nombre), el pago se enlaza al renglón del mes en que se paga; con tarjeta, además aparta el dinero del bolsillo del renglón. Sin renglón, con tarjeta no aparta nada.
- *Pronto* = vence en 7 días o menos; *vencida* = fecha pasada. Los próximos pagos de Inicio muestran los de 14 días.
- En un **servicio**, el valor pasa a ser el último pagado.

## 7 bis. CDT
- Un CDT es capital entregado a un banco (en pesos) por un **plazo** en días a una **tasa efectiva anual**. El vencimiento es la fecha de inicio más el plazo. El interés estimado es `capital × ((1 + EA)^(días/365) − 1)`; la **retención** es el porcentaje que la persona indica en cada CDT (no se fija en el código porque depende del producto y de la norma).
- Mientras está vigente, el capital **no es dinero disponible**: se muestra como **Invertido** (en Inicio y en la pantalla de CDT) y no suma al disponible ni al ahorro.
- **Uno que ya se tenía** antes de usar Moni no toca los saldos (ese dinero nunca estuvo en los bolsillos). **Uno nuevo** puede *descontar el capital* de un bolsillo: un ajuste `CDT_Apertura` negativo, anulable.
- **Cobrar** (o cancelar antes): el capital vuelve a un bolsillo (ajuste `CDT_Retorno`), los intereses entran como ingreso (`Interes`) y la retención sale como gasto (`Retencion`). Antes del vencimiento se sugiere solo el interés causado hasta ese día, y todo se puede corregir con lo que realmente entregó el banco. **Renovar** deja el capital invertido y crea otro CDT con las mismas condiciones desde esa fecha; solo llegan los intereses.
- Los que pagan **cada mes o cada trimestre** tienen un próximo pago: se registra con *Registrar intereses* y el siguiente se calcula solo (el último coincide con el vencimiento).
- Con cifras ya usadas (apertura descontada, intereses cobrados o cerrado) no se cambian capital, tasa, plazo, fechas ni banco: se anula y se crea de nuevo. Anular solo se puede sin intereses cobrados.
- Los vencimientos y pagos de intereses salen en *Por recibir* de Inicio y en los recordatorios de Google Calendar.

## 7 ter. Avisos de Inicio
- *Para tener en cuenta* lista lo que falta o está desactualizado, calculado desde el estado de la hoja (desaparece solo al resolverse). **Importantes** (salario mínimo de un año anterior, CDT vencidos, suscripciones que faltan en el presupuesto) no se ocultan. **Sugerencias** (nómina, suscripciones, recordatorios, tasa del dólar, rendimiento de las cuentas de ahorro) y **novedades** (CDT, hogares) se pueden ocultar con *Ahora no*; *Ajustes → Avisos de Inicio* las vuelve a mostrar.

## 7 quater. Fechas
- Las fechas se muestran y se escriben como **AAAA/MM/DD**. Por dentro se guardan como texto AAAA-MM-DD; el servidor acepta las dos formas de separar.

## 7 quinquies. Recordatorios en Google Calendar
- Con los recordatorios activos, Moni mantiene un calendario propio, **"Moni"**, con un evento por cada pago de los **próximos 45 días**: extractos de tarjeta por pagar (con lo que falta), cuotas de créditos, suscripciones y servicios, vencimientos y pagos de CDT y, si se deja marcado, las fechas límite de prima y cesantías.
- Cada evento suena **el mismo día** y **N días antes** (0 a 7), a la hora elegida (5 a 21, hora de Bogotá).
- La sincronización es **idempotente** y por clave (`tipo|id|fecha`): crea lo que falta, corrige lo que cambió y borra lo que ya no corresponde (por ejemplo, un pago ya hecho). Los eventos que la persona ponga a mano en ese calendario no se tocan. Corre cada día y unos segundos después de cada cambio.
- Los eventos llevan el valor de cada pago: el calendario es privado de la persona.

## 7 sexies. Gráficos
- **Análisis** (Analizar → Análisis) reúne el panorama en una sola llamada (`getAnalisis`); además, cada módulo trae los suyos (ver el manual). Los de Movimientos, Nómina, Servicios, Lista de deseos y CDT se calculan en la pantalla con lo que ya está cargado; los de Inicio y la Vista anual vienen de `getGraficos` y `getAnual`.
- **Entró** = movimientos positivos no anulados que no son traslado; **salió** = los negativos; **diferencia** = entró − salió. Las cifras del mes se comparan con el mes anterior (el color del cambio depende de si subir es bueno).
- **Saldo al cierre de un mes** = saldo de apertura + todos los movimientos (también traslados y conversiones) hasta el fin de ese mes, de los bolsillos de cuentas activas de esa moneda. El del mes actual coincide con el total de Inicio.
- **Gastos por categoría:** los del mes elegido, de mayor a menor; lo que no tiene categoría se nombra por su tipo (pago de tarjetas, cuotas de crédito, GMF…) o queda como *Sin categoría*. Se muestran las 7 mayores y "Otras".
- En cada módulo: *plan frente a real* (Presupuesto), *cupo usado* (Tarjetas) y *avance de pago* (Créditos), evolución y avance de meta (Ahorro), plan frente a aportes y acumulado (Metas), valor frente a costo (Inversiones), entró/planeado/real por mes (Vista anual) y saldo por mes (un bolsillo).

## 7 septies. Registro de errores
- Cada error de la API, del navegador y de los procesos automáticos se anota en la hoja (tabla `Log`, últimas 500 entradas) con función, mensaje, traza y versión. Un fallo de código es **Error**; una regla de negocio que rechazó algo ("Escribe tu nombre") es **Aviso**; los hechos importantes (borrado total) son **Info**.

## 8. Saldos iniciales
- Cada cuenta y bolsillo se crea con su **saldo inicial** (el punto de partida) en el asistente de primeros pasos; no hay un paso aparte de arranque. Después el saldo se calcula con los movimientos.
- Si Moni y el banco difieren, se corrige con el **cuadre** de la cuenta: deja un ajuste con fecha.

## 9. Datos de demostración
- Todos sus IDs empiezan por `demo-`. Borrarlos elimina **solo** esas filas (y el detalle de nómina huérfano). Solo existen en desarrollo.

## 10. Metas
- Una meta tiene **monto**, **fecha de inicio y final** (meses de la meta) y un **bolsillo** donde se guarda el dinero.
- **Ahorrado** = ahorro inicial + lo real de sus renglones del presupuesto + los aportes directos (traslados con `Ref = Meta <ID>` fuera de un renglón). **Usado** (gastos con esa `Ref`) se muestra aparte y no baja lo ahorrado.
- **Plan por mes:**
  - Los meses escritos a mano quedan fijos (pueden ser 0).
  - Los demás meses, de este en adelante, se reparten en partes iguales lo que **faltaba al empezar este mes**, redondeado hacia arriba a la centena. Así el plan del mes no cambia al aportar.
  - Los meses pasados muestran el plan de su renglón (o el reparto original).
  - Si todo el plan que queda está a mano y no alcanza, se informa cuánto queda por cubrir.
- **Estado:**
  - *Lograda*: lo ahorrado llega al monto.
  - *Vencida*: pasó la fecha y falta dinero.
  - *Atrasada*: lo aportado en los meses pasados está por debajo de su plan en más de 1.000 o del 5 %. En ese caso se sugiere lo que falta dividido entre los meses que quedan.
  - Además, la persona puede marcarla *En pausa* o *Cumplida*.
- **Presupuesto:** cada meta *Activa*, no lograda y con plan en el mes agrega un renglón **Fondo** hacia su bolsillo (`ID_Meta`). Se agrega al generar el mes, con *Agregar* del aviso, o al guardar la meta o su plan (para los meses que ya tienen presupuesto, de este en adelante). Mientras el renglón no esté completo, su plan y su bolsillo se mantienen al día. Si la meta se pausa o deja de tener plan ese mes, el renglón sin movimientos queda en 0.
- **Aportar** es un traslado al bolsillo de la meta (subtipo `Aporte_Meta`); si el mes tiene el renglón de la meta, cuenta como su real, una sola vez.

## 11. Lista de deseos
- Usa la tabla `Regalos`. Un deseo es **para mí** (`Para = Yo` o sin persona) o para una persona.
- **Lo gastado** = gastos y compras con tarjeta marcados `Regalo <ID>`; si no hay, el **precio pagado** anotado a mano (comprado sin registrar el gasto, sin mover saldos).
- **Comprado** si tiene algo gastado o su estado es *Comprado*. *Descartado* y *No aplica* no suman en los totales.
- **Totales** del año: lo estimado, lo gastado, la diferencia, para mí y para otros, por persona y por categoría.
- **Lluvia de ideas:** al elegir una idea, su texto y enlace pasan al deseo; su precio solo pasa al estimado si este estaba en 0. El deseo queda *Decidido*.
- Un deseo con gastos registrados no se puede quitar; al quitarlo se borran sus ideas.

## 12. Inversiones
- **Posición** con el método del **costo promedio**:
  - Una compra suma la cantidad y su costo (valor + comisión).
  - Una venta resta la cantidad y saca el costo en proporción. Ganancia realizada = valor − comisión − costo sacado.
  - Un dividendo suma a los dividendos.
  - No se puede vender más de lo que se tiene. Una compra no se puede anular si una venta posterior quedaría sin unidades.
- **Precio vigente:** el más reciente entre el de Google Finance, el manual y el de la última operación. El mismo día gana Google, luego el manual.
- **Valor** = cantidad × precio × tasa de la moneda del precio a pesos (`Config.Tasa_<divisa>`). Sin precio, o sin la tasa de su moneda, la inversión vale su costo y se avisa.
- **Dinero, solo si la operación tiene bolsillo:**
  - Una compra es un ajuste negativo (`Inversion_Compra`) y una venta uno positivo (`Inversion_Venta`). No son gasto ni ingreso.
  - Un dividendo es un **ingreso** (`Dividendo`), con la categoría de rendimientos.
  - Anular la operación anula su movimiento.
- **Google Finance:** la hoja auxiliar `Precios_Google` tiene una fórmula por inversión con símbolo y solo se reescribe si cambia el símbolo. La lectura guarda el precio y el historial (uno por día y fuente). La tarea diaria de la tasa del dólar también la actualiza.
- **Búsqueda:**
  - El catálogo de la app busca por nombre, símbolo o palabras (sin tildes).
  - *Buscar en Google Finance* prueba el texto tal cual y con `NASDAQ:`, `NYSE:`, `NYSEARCA:`, `BVC:` y como `CURRENCY:<texto>USD` (hoja auxiliar `Buscar_Google`). Deja uno por activo, el que tiene bolsa.
- **Brokers** (1.19). Un broker es como un banco para invertir:
  - **Disponible** (en la moneda del broker) = depósitos − retiros − compras (total + comisión) + ventas (total − comisión) + dividendos. No se guarda: se calcula con las operaciones.
  - Al crearlo se anota el disponible de hoy y al agregar una inversión, **cuántas tiene** y su precio promedio (opcional): quedan como `Sin_Efectivo` y no mueven dinero. *Ajustar disponible* y *Ajustar cantidad* anotan la diferencia con lo que muestra la plataforma, también sin mover dinero; quitar unidades así no es una venta (sale costo en proporción, sin ganancia).
  - **Comisión del broker** (1.20): cada broker puede tener una tarifa: un **porcentaje** del total de la operación (con una comisión **mínima** opcional, en su moneda), un **valor fijo** por operación (en su moneda o en pesos, convertido con las tasas de Divisas) o **ambos** (porcentaje + fijo). Comisión = máx(total × %, mínimo) + fijo (`comisionBroker_`). Al comprar o vender, Moni la propone y la persona la puede cambiar, escribiéndola como valor o como % del total. Si la operación llega sin comisión, el servidor usa la de la tarifa; si trae una (aunque sea 0), usa esa. El broker muestra lo pagado en comisiones (en pesos).
  - Las compras, ventas y dividendos de una inversión en un broker salen o entran del disponible, en su moneda, sin bolsillo. `Valor` y `Comision` se guardan en pesos con la tasa del día para el costo y la ganancia. Sin la tasa de la moneda del broker no se registran (se pide en Ajustes → Divisas).
  - *Depositar* y *Retirar* pueden mover dinero de un bolsillo (ajustes `Broker_Deposito` y `Broker_Retiro`, que no son gasto ni ingreso). Si el bolsillo está en otra moneda se anota cuánto salió o llegó en ella. No se retira más que el disponible.
  - **Valor del broker** = disponible + cantidad × precio de cada inversión (Google Finance o manual). En su moneda usa el precio directo si está en la misma moneda; en pesos, la tasa de Divisas.
  - Las inversiones de antes (sin broker) siguen como *Otras inversiones*, con su dinero en bolsillos, como siempre. Se pueden llevar a un broker editándolas: sus operaciones viejas no tocan el disponible.
- **Patrimonio:** lo invertido suma los CDT vigentes, el valor de las inversiones activas y el disponible de los brokers en pesos. El patrimonio de 12 meses usa el último precio conocido al cierre de cada mes y el disponible de cada broker a esa fecha.

## 13. Calculadora
- Todo se calcula en el navegador (`CALC` en `js_herramientas.html`, con pruebas).
- **Equivalencia de tasas** (ingeniería económica). Toda tasa pasa por la efectiva anual:
  - efectiva del periodo ↔ EA: `i_p = (1 + EA)^(1/n) − 1`, `EA = (1 + i_p)^n − 1` (n = 1, 2, 4 o 12 periodos al año);
  - nominal ↔ efectiva del periodo: `i_p = j / n` (NASV, NATV, NAMV, NATA, NAMA);
  - anticipada ↔ vencida: `i_v = i_a / (1 − i_a)`, `i_a = i_v / (1 + i_v)` (TA, MA, NATA, NAMA).
  - Cifras de control: 24 % EA = 1,8088 % MV = 21,7051 % NAMV; 12 % NATV = 3 % TV = 12,5509 % EA; 2 % MA = 2,0408 % MV = 27,4345 % EA.
- **Préstamo:** cuota fija `P·i / (1 − (1+i)^−n)` con la tasa efectiva mensual equivalente a la que se escribe, de cualquier tipo. Los seguros pueden ser un valor fijo por cuota, un % mensual sobre el saldo (seguro de vida deudor: baja con cada pago) o un % mensual sobre lo prestado. Los cobros al desembolso (estudio de crédito, comisión) se restan de lo recibido.
- **Costo efectivo anual:** la TIR mensual `r` que iguala lo recibido (monto − cobros al desembolso) con el valor presente de las cuotas con seguros, llevada a EA: `(1 + r)^12 − 1`. Sin seguros ni cobros es igual a la tasa EA.
- **Ahorro:** interés compuesto mensual a la tasa equivalente a la EA. Aporte al final de cada mes (anualidad vencida) o al inicio (anticipada: `F = A·((1+i)^n − 1)/i·(1+i)`).
- **¿Cuánto ahorrar?:** el aporte que, con lo que ya tienes y la rentabilidad, llega a la meta en los meses que quedan: `A = (M − S·(1+i)^n)·i / ((1+i)^n − 1)`, dividido entre `(1+i)` si se aparta al inicio del mes. *Crear esta meta* abre el formulario de Metas lleno.
- **CDT:** intereses = capital × ((1 + EA)^(días/base) − 1), con año de 365 días (o 360, el comercial). Si paga intereses cada mes o trimestre, cada pago es capital × ((1 + EA)^(días del periodo/base) − 1), sin reinvertir; lo que sobre del plazo se paga al final. Neto = intereses − retención.
- **Tasas:** muestra la tasa escrita en los 11 tipos (EA, efectivas semestral, trimestral y mensual, nominales vencidas y anticipadas).

