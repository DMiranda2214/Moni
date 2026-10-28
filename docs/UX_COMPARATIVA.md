# Moni frente a otras apps de finanzas personales — evaluación de UX

> **Qué es esto y qué no es.** Es una **evaluación heurística de experto** (28/10/2026): comparo Moni con tres *familias* de apps de finanzas personales usando criterios de usabilidad conocidos (Nielsen, Apple HIG) y el conteo de pasos de las tareas diarias. **No son datos de usuarios.** Los puntajes son mi estimación y sirven para priorizar; la medición real sigue siendo la sesión de 30 minutos con la usuaria (PLAN §7.1-C). Comparo familias y no productos con cifras exactas para no afirmar detalles de terceros que no pude verificar hoy.

## Las tres familias de referencia

| Familia | Ejemplos típicos | Su fortaleza | Su costo |
|---|---|---|---|
| **A. Presupuesto por sobres** | YNAB y similares | Método claro: cada peso tiene un destino | Curva de aprendizaje; exige disciplina |
| **B. Agregadores con conexión bancaria** | Monarch, Fintonic, Copilot (estilo Mint) | Movimientos que llegan solos; panorama total | Dependen de conectar bancos (en Colombia la cobertura es limitada); menos control sobre reglas propias |
| **C. Registro manual rápido** | Spendee, Wallet, Money Manager | Registrar un gasto en segundos; muy visuales | Poco presupuesto real, nada de tarjetas/créditos a fondo |

**Dónde se ubica Moni:** híbrido de A y C, con lo que ninguna trae: **créditos de autopago**, **reserva por tarjeta**, **nómina colombiana** (salud, pensión, FSP, prima, cesantías) y todo en **tu propio Google Sheet**. Es un producto de **una persona y sus reglas**, no un producto masivo.

## Puntaje estimado (1 = flojo, 5 = muy bueno)

| Criterio | Moni hoy | A. Sobres | B. Agregador | C. Manual rápido | Comentario |
|---|:-:|:-:|:-:|:-:|---|
| Registrar un gasto (pasos) | **4** | 3 | 5 (llega solo) | 5 | Moni: Inicio → *Gasto* → valor y bolsillo → Guardar (≈4 interacciones). Botón *Registrar* siempre visible. Falta "repetir el último" y plantillas de gastos frecuentes |
| Ver cómo voy "de un vistazo" | **4** | 3 | 5 | 4 | Inicio con resumen, próximos pagos y presupuesto del mes; en PC ahora en dos columnas |
| Presupuesto mensual | **4** | 5 | 3 | 2 | Plantilla + real calculado + ahorro; muy completo, pero hay que *generar* el mes |
| Tarjetas y deudas | **5** | 2 | 3 | 1 | Diferencial de Moni: reserva, extracto atómico, cuotas francesas, autopago |
| Recordatorios de pagos | **3** | 2 | 3 | 2 | Próximos pagos en Inicio (tarjetas, cuotas, servicios y suscripciones); **sin notificaciones push ni correo** |
| Servicios y suscripciones | **4** | 2 | 4 | 3 | Nuevo: próximo cobro, costo mensual/anual, pagar con 1 toque, código y enlace de pago |
| Primer uso (onboarding) | **3** | 3 | 4 | 5 | Pasos guiados y datos de demostración; pero pide entender *cuenta vs bolsillo* |
| Claridad del vocabulario | **3** | 3 | 4 | 5 | "Bolsillo", "reserva", "escenario" necesitan ayuda en contexto (pendiente: glosario) |
| Navegación | **3** | 4 | 4 | 4 | 5 pestañas + Más; funciones sueltas dentro de Más. Pendiente de validar con la usuaria |
| Velocidad percibida | **3** | 4 | 4 | 5 | Esqueletos, avisos y sin recargas completas; el arranque en frío de Apps Script (1–3 s) es el techo. **Sin medir aún en el Sheet real** |
| Accesibilidad | **4** | 3 | 3 | 3 | Contraste AA verificado, objetivos de 44 px, lectores de pantalla, modo oscuro |
| Automatización de datos | **1** | 1 | 5 | 1 | Todo se registra a mano; es el mayor costo frente a la familia B |
| Control y privacidad | **5** | 3 | 2 | 3 | Datos en su Sheet; respaldos propios; sin terceros |

**Lectura global (estimación):** para *el uso para el que fue hecha* (una persona que quiere control fino de bolsillos, tarjetas, créditos y nómina), Moni está **por encima** de las alternativas A y C en profundidad y **cerca** en rapidez de registro. Frente a B pierde en comodidad por la **falta de conexión bancaria**, y eso no se arregla con diseño.

## Tareas cotidianas — pasos estimados

| Tarea | Moni | Referencia típica |
|---|---|---|
| Registrar un gasto | 4 | 3–4 (A/C), 0–1 (B) |
| Mover dinero entre bolsillos | 4 | 4 (A) |
| Pagar el extracto de una tarjeta | 3 (Deudas → tarjeta → Pagar) | 5+ en apps sin esta lógica |
| Pagar la luz con su código | **2** (Inicio → Pagar servicios → toque) | 3–5 |
| Saber cuánto cuestan las suscripciones | **1** (pantalla de Servicios y suscripciones) | 2–4 |
| Ver cuánto queda en un bolsillo | 2 | 2–3 |

## Dónde Moni es débil (y qué haría)

1. **Registro a mano** (1/5). Mitigar, no eliminar: *"repetir último movimiento"*, plantillas de gastos frecuentes y sugerencia del bolsillo según el concepto. Importar el extracto del banco (CSV) es el siguiente paso realista, ya que no hay conexión directa.
2. **Sin avisos fuera de la app** (3/5). Un disparador diario que envíe un correo con lo que vence en 3 días. Solo si la usuaria lo quiere.
3. **Vocabulario** (3/5). Glosario breve y ejemplos dentro de los campos; la sesión con la usuaria dirá qué palabras no entiende.
4. **Navegación** (3/5). No se rediseñó a propósito: primero observar. Hipótesis a validar: unir *Presupuesto* y *Nómina* en "Mes", y dejar *Más* solo para ajustes.
5. **Rendimiento real**. Medir con la tabla de Diagnóstico en el Sheet real y en el celular; es el dato que falta para puntuar bien este criterio.

## Cómo validarlo de verdad

Sesión de 30 minutos con la usuaria, pensando en voz alta, **5 tareas**: registrar un gasto, ver cuánto queda en un bolsillo, mover dinero, pagar una tarjeta, pagar un servicio. Medir: ¿lo logra?, ¿cuánto tarda?, ¿dónde duda? Comparar con los pasos de la tabla de arriba y repetir tras los ajustes. Una escala corta como la **SUS (10 preguntas)** al final da un número comparable en el tiempo.
