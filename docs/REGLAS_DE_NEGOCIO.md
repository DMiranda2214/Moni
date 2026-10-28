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

## 2. Presupuesto
- **Plantilla** por escenario (uno es el base). **Generar** crea los renglones del mes; si el mes ya existe, reemplazarlo solo se permite si ningún renglón tiene movimientos.
- **Real** de un renglón se **calcula** (no se escribe): un gasto enlazado suma; un ajuste enlazado resta; el lado de entrada de un traslado enlazado suma.
- **Ahorro** de un renglón = Plan − Real, **solo si está pagado**. Resto (restante) = Plan − Real.
- **Ingresos del mes** = ingresos registrados en el mes; **Saldo** = ingresos − real.
- **Repartir la nómina:** un traslado por destino (gastos y cuotas agrupados por bolsillo; ahorro y fondos por renglón). Cada mes se reparte una vez salvo que se fuerce.

## 3. Nómina (una vez al mes)
- Devengos: sueldo base y subsidios (salariales o no). Salud y pensión: 4 % del IBC cada una, con aporte redondeado a la centena superior (PILA).
- **FSP** (Fondo de Solidaridad Pensional): 1 % del IBC cuando el IBC llega a 4 SMMLV (`FSP_Umbral_SMMLV`).
- **Prima:** en junio y diciembre, IBC / 2. **Intereses de cesantías:** en enero, IBC × 12 % (`Tasa_Interes_Cesantias`). Se asume año completo (pendiente de confirmar para años parciales).
- Cifras de control (sueldo base 3.127.845): deducciones 250.400; neto 2.877.445; neto con prima 4.441.367,50; intereses de cesantías en enero 375.341,40.

## 4. Tarjetas de crédito
- El **mes del extracto** de una compra depende del día de corte: hasta el corte entra al extracto de ese mes; después, al siguiente.
- **Fuente** de una compra: *Personal* (no aparta nada ahora: al pagar el extracto, lo que falte en la reserva se completa desde el bolsillo personal de la tarjeta), *Presupuesto* (aparta ya desde el bolsillo del renglón), *Guardar* (aparta ya desde el bolsillo personal) u *Otro*. Las que apartan crean un traslado a la **reserva** de la tarjeta.
- **Pagar el extracto** es atómico: si algo falla, todo se revierte. Suma las compras del mes, completa la reserva desde el bolsillo personal si le falta, paga el total desde la reserva y marca extracto y compras como pagados. Si falta dinero y la tarjeta no tiene bolsillo personal, la app lo dice y no hace nada. Anular el pago los reabre.
- No se agregan compras a un extracto ya pagado.
- **Cupo disponible** = cupo − compras no pagadas.

## 5. Créditos de autopago
- Te prestas desde una **cuenta de ahorro** (el desembolso sale del ahorro) y pagas con **amortización francesa**; cada cuota **vuelve al ahorro**.
- **Tasa:** la EA se convierte a periódica con el método del Excel (`2·((1+EA)^(1/2) − 1)/períodos`, quincenal o mensual) o con el método exacto, según `Credito_Metodo_Tasa`.
- **Cuota fija** y tasa fijas. Un **abono mayor que la cuota recalcula el plazo** (la última cuota se ajusta). Un abono mayor que el saldo cobra solo lo necesario.
- El **cronograma** es versionado: al recalcular, el anterior queda como *Reemplazada*.
- Cifras de control: 2.400.000 a 48 quincenas con tasa 0,4067404 % → 55.140,90; 1.000.000 a 12 cuotas con 0,8333333 % → 87.915,89; 500.000 a 10 cuotas con 1 % → 52.791,04.

## 6. Ahorro
- Subtipos de movimiento: *Interes* (+), *Retencion* (−), *GMF* (−), *Para_Gastos* (retiro), *Reposicion*.
- **Deuda con el ahorro** = máx(0, Para_Gastos − Reposicion) + saldo de los créditos activos. El desembolso de un crédito no cuenta dos veces.
- **Si repones todo**, el saldo sería: saldo + deuda.

## 7. Servicios y suscripciones
- Cada cobro guarda su **próximo cobro** y su **día**; al pagar avanza *N* meses según la periodicidad (1, 2, 3, 6 o 12) conservando el día (31 → 28 → 31).
- **Costo mensual** = valor / meses del período; **anual** = valor × 12 / meses.
- Se paga con **un** medio: un bolsillo (gasto) o una tarjeta (compra, fuente *Personal*). El pago queda marcado `Suscripción <ID>`.
- *Pronto* = vence en 7 días o menos; *vencida* = fecha pasada. Los próximos pagos de Inicio muestran los de 14 días.
- En un **servicio**, el valor pasa a ser el último pagado.

## 8. Arranque
- Los saldos de apertura se pueden cambiar mientras `Arranque_Hecho` sea falso. **Empezar** exige: base creada, sin datos de demostración, aperturas cargadas y sin movimientos anteriores a la fecha de arranque.
- Archivar pruebas **anula** los movimientos anteriores a esa fecha.

## 9. Datos de demostración
- Todos sus IDs empiezan por `demo-`. Borrarlos elimina **solo** esas filas (y el detalle de nómina huérfano). Se pueden crear sobre datos reales mientras no haya empezado la operación.
