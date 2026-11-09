# Reglas de negocio

Cómo se calcula cada cosa. Las cifras de control son ejemplos ficticios y están cubiertas por pruebas automáticas.

## 1. Libro de movimientos y saldos
- Todo es un **movimiento** con signo: lo que entra es positivo y lo que sale, negativo.
- **Saldo de un bolsillo = saldo de apertura + suma de sus movimientos no anulados.** Se puede consultar a una fecha.
- Un **traslado** son dos movimientos que comparten `ID_Grupo` y suman cero.
- **Anular** marca el movimiento (o el grupo completo); no borra. Se puede restaurar si los bolsillos siguen activos.
- La fecha de un movimiento no puede ser futura. Las fechas se guardan como texto `AAAA-MM-DD`.
- **Cuadrar:** diferencia = saldo real del banco − saldo de Moni de esa cuenta; el ajuste opcional es un movimiento de tipo *Ajuste*.
- Una cuenta que **no permite bolsillos** tiene un único bolsillo interno; su saldo de apertura vive solo en ese bolsillo.

## 1 bis. Monedas (divisas)
- La **moneda se elige en el banco** (`COP`, `USD` o `EUR`; pesos por defecto). Sus cuentas y bolsillos la heredan y todo se muestra en esa moneda. No se puede cambiar la moneda de un banco que ya tiene cuentas: se crea otro banco.
- **Los saldos de monedas distintas nunca se suman.** El Total, el Disponible y el Ahorro de Inicio son en pesos; las demás monedas van aparte en *Otras monedas*, con su **equivalente en pesos** (saldo × tasa de referencia) solo si hay una tasa anotada.
- Un **traslado** solo se hace entre bolsillos de la **misma moneda**. Para pasar dinero entre monedas se usa la **conversión**.
- Presupuesto, nómina, tarjetas (en bancos en pesos), créditos de autopago, ahorro con deuda, suscripciones, servicios y regalos **solo usan pesos**: el servidor rechaza un bolsillo en otra moneda y la pantalla no lo ofrece.
- **Conversión** (Bolsillos → Convertir divisas): se escribe la **cantidad** de la moneda de afuera y la **tasa que dio el banco** por cada unidad; sale `cantidad × tasa` de un lado y llega la cantidad del otro. Son dos movimientos con el mismo `ID_Grupo` (`Subtipo = Conversion`) que **no suman cero** porque cada uno está en su moneda; la tasa implícita queda en las notas. La TRM de referencia **no interviene** (cada banco cambia a su precio): solo se muestra para comparar.
- **Comisión** del banco (opcional, se escribe cada vez): un **gasto aparte** (`Subtipo = Comision`, categoría *Comisión bancaria*, que se crea sola) cobrado del bolsillo de origen o del de destino, dentro del mismo `ID_Grupo`: anular o restaurar la conversión mueve también la comisión. Si la persona desactivó la categoría, la comisión queda sin categoría.
- Los totales de **entró** y **salió** (Movimientos, gráficos, vista anual) son de **una sola moneda** (pesos, o la del bolsillo o cuenta que se mira) y **no cuentan** los traslados ni las conversiones.
- **Tasa de referencia:** se anota a mano o la trae Google Finance (hoja auxiliar `Tasas_Google`, `GOOGLEFINANCE("CURRENCY:USDCOP")`; es la tasa del mercado, no la TRM oficial). Guarda fecha y fuente y **solo es informativa**.

## 2. Presupuesto
- **Plantilla** por escenario (uno es el base). **Generar** crea los renglones del mes; si el mes ya existe, reemplazarlo solo se permite si ningún renglón tiene movimientos.
- **Real** de un renglón se **calcula** (no se escribe): un gasto enlazado suma; un ajuste enlazado resta; el lado de entrada de un traslado enlazado suma; y una **compra con tarjeta** enlazada suma el día de la compra (las de fuente *Del presupuesto* ya cuentan por su traslado a la reserva, así que no se cuentan dos veces; las *De otra persona* no cuentan).
- Una suscripción o servicio puede pertenecer a un **hogar** (`ID_Inmueble`): el mismo nombre se puede repetir en hogares distintos y, cuando hay varios hogares, el renglón se llama *Nombre · Hogar*.
- **Suscripciones y servicios dentro del presupuesto:** al generar un mes, cada suscripción o servicio que toca ese mes (según su periodicidad, contada desde su próximo cobro) entra como renglón de gasto, con su valor, su bolsillo o su tarjeta (`Presupuesto_Mes.ID_Suscripcion` los enlaza). Si el presupuesto del mes ya existe, la suscripción nueva o editada entra o se actualiza sola (mientras el renglón no esté pagado); el botón *Agregar* de Presupuesto cubre las que falten. Pagar la suscripción cuenta como lo real del renglón y lo deja pagado; deshacer el pago lo devuelve a pendiente. Un renglón de la plantilla con el mismo nombre que el *Renglón* de la suscripción cuenta como el suyo (no se duplica).
- Cada renglón puede recordar **con qué se paga** (`ID_Tarjeta`: su bolsillo, o una tarjeta). Al registrar un gasto de ese renglón, Moni propone ese medio.
- **Ahorro** de un renglón = Plan − Real, **solo si está pagado**. Resto (restante) = Plan − Real.
- **Ingresos del mes** = ingresos registrados en el mes; **Saldo** = ingresos − real.
- **Repartir la nómina:** un traslado por destino (gastos y cuotas agrupados por bolsillo; ahorro y fondos por renglón). Cada mes se reparte una vez salvo que se fuerce.

## 3. Nómina (una vez al mes)
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
- **Cupo disponible** = cupo − compras no pagadas.
- **Vista anual:** *TTCC* = compras con tarjeta **sin renglón**, en el mes de la compra; *Saldo* = ingreso − real − TTCC.

## 5. Créditos de autopago
- Te prestas desde una **cuenta de ahorro** (el desembolso sale del ahorro) y pagas con **amortización francesa**; cada cuota **vuelve al ahorro**.
- **Tasa:** la EA se convierte a periódica con el método del Excel (`2·((1+EA)^(1/2) − 1)/períodos`, quincenal o mensual) o con el método exacto, según `Credito_Metodo_Tasa`.
- **Cuota fija** y tasa fijas. Un **abono mayor que la cuota recalcula el plazo** (la última cuota se ajusta). Un abono mayor que el saldo cobra solo lo necesario.
- El **cronograma** es versionado: al recalcular, el anterior queda como *Reemplazada*.
- Cifras de control: 2.400.000 a 48 quincenas con tasa 0,4067404 % → 55.140,90; 1.000.000 a 12 cuotas con 0,8333333 % → 87.915,89; 500.000 a 10 cuotas con 1 % → 52.791,04.

## 6. Ahorro
- **Rendimiento por banco:** cada banco puede tener una tasa efectiva anual (`Rendimiento_EA`) y una forma de pago (`Rendimiento_Pago`: cada día o cada mes). Aplica a sus cuentas de tipo Ahorro. Además `Rendimiento_Base` indica sobre qué saldo se paga: `Todo` (por defecto) o `Bolsillos` (hay bancos que solo pagan sobre el dinero guardado en bolsillos; el saldo suelto de una cuenta sin bolsillos no rinde).
- **Estimación:** rinde cada día sobre el saldo con que empezó, a la tasa diaria (1 + EA)^(1/365) − 1. Si el banco paga a diario, lo ganado se suma al saldo día a día; si paga cada mes, se suma al cerrar el mes. Se calcula desde el último rendimiento registrado (o el inicio del mes) hasta ayer; "Registrar este rendimiento" lo anota (se puede corregir con el valor del banco). La retención y el GMF se siguen registrando a mano.
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
- **Entró** = movimientos positivos no anulados que no son traslado; **salió** = los negativos; **diferencia** = entró − salió. Las cifras del mes se comparan con el mes anterior (el color del cambio depende de si subir es bueno).
- **Saldo al cierre de un mes** = saldo de apertura + todos los movimientos (también traslados y conversiones) hasta el fin de ese mes, de los bolsillos de cuentas activas de esa moneda. El del mes actual coincide con el total de Inicio.
- **Gastos por categoría:** los del mes elegido, de mayor a menor; lo que no tiene categoría se nombra por su tipo (pago de tarjetas, cuotas de crédito, GMF…) o queda como *Sin categoría*. Se muestran las 7 mayores y "Otras".
- En cada módulo: *plan frente a real* (Presupuesto), *cupo usado* y *avance de pago* (Deudas), evolución y avance de meta (Ahorro), entró/planeado/real por mes (Vista anual) y saldo por mes (un bolsillo).

## 7 septies. Registro de errores
- Cada error de la API, del navegador y de los procesos automáticos se anota en la hoja (tabla `Log`, últimas 500 entradas) con función, mensaje, traza y versión. Un fallo de código es **Error**; una regla de negocio que rechazó algo ("Escribe tu nombre") es **Aviso**; los hechos importantes (borrado total) son **Info**.

## 8. Saldos iniciales
- Cada cuenta y bolsillo se crea con su **saldo inicial** (el punto de partida) en el asistente de primeros pasos; no hay un paso aparte de arranque. Después el saldo se calcula con los movimientos.
- Si Moni y el banco difieren, se corrige con el **cuadre** de la cuenta: deja un ajuste con fecha.

## 9. Datos de demostración
- Todos sus IDs empiezan por `demo-`. Borrarlos elimina **solo** esas filas (y el detalle de nómina huérfano). Solo existen en desarrollo.
