# Análisis: presupuesto del mes y compras con tarjeta de crédito

> Estado: **decidido e implementado** (30/10/2026). Decisiones: (1) el gasto con tarjeta cuenta en el **mes de la compra**; (2) cada renglón **recuerda su medio de pago habitual**; (3) una compra **sin renglón no aparta dinero**: al pagar el extracto se indica de qué bolsillo sale. Las reglas resultantes están en [REGLAS_DE_NEGOCIO](REGLAS_DE_NEGOCIO.md) (secciones 2, 4 y 7). El resto de este documento es el análisis que llevó a esa decisión.

## 1. El problema, con un ejemplo
Renglón del mes **Mercado: plan 400.000**, con su dinero en el bolsillo *Mercado* (la nómina ya lo repartió). Haces el mercado de 120.000 **con la tarjeta**.

| Cómo lo registras hoy | Qué pasa | ¿Es correcto? |
|---|---|---|
| Compra de tarjeta, fuente **Personal** (la opción por defecto) | No mueve dinero ni toca el renglón. Se paga después del extracto desde el bolsillo personal | ❌ *Mercado* sigue mostrando 0 gastado y **su bolsillo sigue con los 400.000**, aunque ya los comprometiste |
| Compra de tarjeta, fuente **Del presupuesto** + renglón | Se aparta 120.000 de *Mercado* a la reserva de la tarjeta; el renglón cuenta 120.000 | ✅ Es lo correcto, pero exige elegir fuente, renglón y bolsillo |
| Compra de tarjeta, fuente **Personal** pero eligiendo el renglón | Se guarda el renglón en la compra, **pero nada lo lee** | ❌ El renglón no se entera |
| Gasto normal desde el bolsillo *Mercado* | Cuenta en el renglón si eliges el renglón | ✅ |

## 2. Cómo funciona hoy (y dónde se rompe)
1. **El "real" de un renglón se calcula solo desde `Movimientos`** enlazados por `ID_Item_Ppto` (`realPorRenglon_`). Una compra de tarjeta **no es un movimiento**: vive en `Compras_TC`. Solo deja un movimiento cuando aparta dinero a la reserva (fuentes *Del presupuesto* o *Para guardar*).
2. `Compras_TC.ID_Item_Ppto` se guarda pero **ningún cálculo lo usa**.
3. **Los gráficos por categoría** también leen solo `Movimientos`. La categoría de una compra de tarjeta se pierde: el gasto aparece recién al pagar el extracto, como una sola barra "Pago de tarjetas".
4. **El gasto cae en el mes del pago, no en el de la compra** (con *Personal*): el presupuesto de octubre queda "limpio" y el de noviembre cargado.
5. **Mi módulo de suscripciones y servicios** repite el problema: al pagar con tarjeta crea una compra *Personal* sin renglón; al pagar desde un bolsillo crea un gasto **sin enlazarlo al renglón** de "Suscripciones" o "Servicios". El presupuesto no se entera de ninguno de los dos.
6. **No existe el concepto "medio de pago"** a nivel de renglón: cada vez hay que decidirlo a mano, y la opción por defecto (*Personal*) es justo la que no concilia con el presupuesto.

## 3. Qué debería pasar (el modelo correcto para este tipo de app)
Moni funciona con **sobres**: cada bolsillo guarda el dinero de un propósito. Comprar con tarjeta **no cambia a quién pertenece el dinero**, solo cuándo sale de la cuenta. Entonces:

- **El gasto pertenece al renglón y a la categoría el día de la compra**, sin importar el medio de pago.
- **El sobre se vacía ese día**: el dinero del renglón se aparta a la **reserva** de la tarjeta (queda guardado para pagar el extracto).
- **Pagar el extracto no es un gasto nuevo**: solo liquida la deuda con el dinero ya apartado. No debe contar dos veces ni ensuciar los gráficos.

Eso es exactamente lo que ya hace la fuente **Del presupuesto**. El problema es que es la menos accesible y no es la predeterminada.

## 4. Correcciones propuestas (de menor a mayor)
| # | Cambio | Qué arregla | Esfuerzo |
|---|---|---|---|
| **A** | **Un solo formulario de gasto con "¿con qué pagaste?"**: un bolsillo/cuenta **o** una tarjeta. Si es tarjeta y hay renglón, Moni usa automáticamente *Del presupuesto* y el bolsillo del renglón. Sin elegir fuente | Elimina la decisión que hoy rompe el presupuesto (1 y 6) | Medio |
| **B** | **El renglón recuerda cómo se paga** (bolsillo o tarjeta habitual). Mercado → "Tarjeta Visa" por defecto | Registrar un gasto de Mercado es: valor + listo | Bajo |
| **C** | **Contar las compras de tarjeta en el real del renglón y en las categorías** aunque no muevan dinero (lectura de `Compras_TC` con renglón/categoría) | Cierra el caso 3 y los gráficos (2, 3) | Medio |
| **D** | **Que el pago del extracto no cuente como gasto** en gráficos y totales (es liquidación) | Evita doble conteo y la barra "Pago de tarjetas" | Bajo |
| **E** | **Suscripciones y servicios enlazados al presupuesto**: cada cobro recuerda su renglón; al pagar, se enlaza al renglón del mes y, con tarjeta, aparta desde el bolsillo del renglón | Arregla mi módulo (5) | Bajo–medio |
| **F** | **Renglón con dos cifras**: "gastado (efectivo)" y "con tarjeta (pendiente de extracto)", y un aviso cuando el apartado en reserva no cubre lo comprado | Transparencia: se ve cuánto debes aún | Medio |
| **G** | **Cambiar el valor por defecto** de la fuente a *Del presupuesto* cuando hay renglón | Arreglo inmediato mientras llegan A–F | Mínimo |

## 5. Recomendación
Hacer **G + E + D** primero (poco esfuerzo, quitan los errores visibles), luego **A + B** (simplifican de verdad el registro, que es el objetivo del producto) y por último **C + F**.

**Decisiones que necesito de ti**
1. ¿El gasto con tarjeta debe contar en el **mes de la compra** (recomendado) o en el **mes del pago**?
2. ¿Quieres que cada renglón recuerde su **medio de pago habitual** (B)?
3. ¿Una compra con tarjeta **sin renglón** (por ejemplo, una salida) debe apartar dinero igual? Hoy depende de la fuente; propongo que no aparte nada y se paga del bolsillo personal al cierre.
