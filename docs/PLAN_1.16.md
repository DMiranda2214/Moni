# Moni 1.16 — Metas, Lista de deseos, Calculadora, Inversiones, y Pensiones y cesantías

> **1.17:** el módulo de Pensiones y cesantías se retiró por decisión de producto (necesitaba demasiados parámetros y variables para dar un resultado confiable). La sección legal se conserva como referencia.

Estudio previo (mercado, legislación y técnica) y plan de implementación de los cinco módulos pedidos. Fecha del estudio: noviembre de 2026.

**Regla de siempre:** quien ya usa Moni solo ve cambios visuales. No se borra ni se reescribe ninguna pestaña, fila o celda. Las tablas y columnas nuevas entran por `SCHEMAS` y `MIGRACIONES_COLUMNAS`.

---

## 1. Estudio de mercado

| Producto | Qué hace bien | Qué le falta (oportunidad para Moni) |
|---|---|---|
| **YNAB** (EE. UU.) | Metas con fecha: calcula cuánto apartar este mes para llegar a tiempo. Si un mes no apartas, reparte lo que falta en los meses siguientes. | Inglés y suscripción paga. Sin la realidad colombiana (cesantías, pensión, 4x1000). |
| **Monarch / Copilot** | Metas ligadas a una cuenta. Gráfico de avance y proyección. Inversiones con precios automáticos. | De pago, solo EE. UU., y los datos no son de la persona. |
| **Nequi, Bancolombia, Daviplata** (Colombia) | "Metas" y "bolsillos" dentro de la cuenta, muy fáciles de usar. | Una meta vive en un solo banco: no hay plan por mes, ni lo ves en un presupuesto, ni comparas plan con lo real. |
| **Wallet, Spendee, Monefy** | Metas de ahorro con fecha y recordatorios. | El aporte es fijo. No conectan las metas con el presupuesto mensual. |
| **Listas de deseos** (Amazon, Giftster, Pinterest) | Lista por persona y ocasión, varias ideas y enlaces. | No saben cuánto piensas gastar ni cuánto llevas gastado. |
| **Simuladores** (Colpensiones, Porvenir, Protección, Superfinanciera, bancos) | Simulan un crédito o una pensión. | Cada uno está en un sitio distinto, y nada de lo calculado se guarda en tus finanzas. |
| **Seguimiento de inversiones** (Delta, Kubera, trii, Google Finance) | Precio en vivo y ganancia o pérdida. | Están aparte de tus cuentas y de tu patrimonio. Poco o ningún soporte para la BVC. |

**Lo que diferencia a Moni:**
- todo vive en la hoja de Google de la persona;
- el presupuesto mensual integra metas, servicios y deudas;
- las reglas colombianas vienen incluidas (cesantías, pensión, 4x1000, CDT).

**Conclusiones para el diseño:**
1. Una **meta** necesita un plan **por mes que se pueda editar**. Por ejemplo: diciembre en 0 porque llegan gastos, junio el doble porque llega la prima. Si un mes falta, Moni reparte lo que quedó pendiente entre los meses siguientes, como hace YNAB.
2. La **lista de deseos** sirve para pensar antes de comprar: para quién, cuánto quieres gastar y varias ideas. Registrar la compra es opcional.
3. Las **calculadoras** ganan valor si su resultado se puede **convertir en una meta**, por ejemplo con "Crear esta meta".
4. Las **inversiones** deben sumar al patrimonio neto y aceptar un **precio manual** cuando Google Finance no tiene el activo, que es lo común con las acciones de la BVC.
5. **Pensiones y cesantías** es un hueco claro en el mercado. Nadie lo integra con la nómina que la persona ya tiene registrada.

**Nombre del módulo de compras: "Lista de deseos".**
- Es una expresión que todos conocen (Amazon, tiendas en línea) y sirve igual para regalos ("para mi mamá") y para uno mismo ("skincare").
- Se descartaron:
  - "Lista de compras": en Colombia suena a mercado.
  - "Antojos": muy informal.
  - "Ideas de compra": es más largo.
- En la navegación aparece como **Lista de deseos**, con la descripción "Regalos y cosas que quieres comprar".

## 2. Información legal y técnica

### Salario mínimo y auxilio de transporte 2026
- **SMMLV 2026:** $1.750.905.
- **Auxilio de transporte 2026:** $249.095 (Decreto 1470 de 2025), para quienes ganan hasta 2 SMMLV.
- El Consejo de Estado suspendió provisionalmente el decreto del salario, y el Decreto 0159 de 2026 mantuvo el valor durante el año.
- **Cómo se usa en Moni:**
  - Las hojas nuevas traen estos valores por defecto.
  - En las hojas existentes **no se cambia** el SMMLV que la persona guardó; las calculadoras usan el de su hoja.

### Cesantías e intereses (Ley 50 de 1990, Ley 52 de 1975, CST arts. 249–253)
- **Cesantías** = (salario base × días trabajados) / 360.
- **Base de cálculo:**
  - Incluye el auxilio de transporte si el salario es de hasta 2 SMMLV.
  - Con salario variable, o si cambió en los últimos 3 meses, se usa el **promedio** del último año (o del tiempo trabajado si fue menos).
- **Intereses** = cesantías × días × 12 % / 360.
- **Fechas:**
  - Los intereses se pagan al trabajador a más tardar el **31 de enero**.
  - Las cesantías se consignan en el fondo a más tardar el **14 de febrero**.
  - Al terminar el contrato se pagan directamente al trabajador.
  - Desde 2026, la Ley 2466 de 2025 permite mensualizar el pago de los intereses.
- **Salario integral:** no genera cesantías.
- **Retiro parcial:** se permite para vivienda (compra, mejoras o abono a un crédito hipotecario) y para educación (del trabajador, su cónyuge o sus hijos).
- **Prima de servicios:** como complemento, (salario base × días del semestre) / 360, con la misma base que las cesantías.

### Pensión de vejez (Ley 100 de 1993, Ley 797 de 2003, Sentencia C-197 de 2023)
- **Edad:** 62 años los hombres y 57 las mujeres.
- **Semanas en Colpensiones (prima media, RPM):**
  - Hombres: 1.300.
  - Mujeres: 1.250 en 2026 y luego 25 menos cada año, hasta 1.000 en 2036 (C-197 de 2023).
- **Monto en Colpensiones:**
  - **IBL:** promedio actualizado de los últimos 10 años. Moni lo estima con el salario actual, en pesos de hoy.
  - **Tasa de reemplazo:** 65,5 − 0,5 × s, donde s es el IBL expresado en SMMLV. Esa base queda entre 55 % y 65 %.
  - Suma **1,5 puntos por cada 50 semanas** por encima de las mínimas, con tope del **80 %**.
  - La mesada no puede ser menor a 1 SMMLV ni mayor a 25 SMMLV. Se pagan **13 mesadas** al año.
- **Fondos privados (ahorro individual, RAIS):**
  - La pensión depende del saldo de la cuenta.
  - Con 1.150 semanas se tiene derecho a la **garantía de pensión mínima** (1 SMMLV).
  - Se puede pensionar antes de la edad si el capital alcanza para una pensión de al menos el 110 % del SMMLV.
  - Moni lo estima así: el saldo de hoy, más el 11,5 % del IBC que va a la cuenta, más la rentabilidad real que la persona escriba. Luego convierte el capital en una mesada según los años de vida esperados.
- **Cotización:**
  - **16 % del IBC:** 12 % lo paga el empleador y 4 % el trabajador.
  - **Independientes:** el IBC es el 40 % de sus ingresos y pagan todo el 16 %.
  - **Fondo de Solidaridad Pensional:** 1 % desde 4 SMMLV, y entre 16 y 20 SMMLV sube de a 0,2 puntos, hasta 2 % desde 20 SMMLV.

### Reforma pensional (Ley 2381 de 2024): todavía no rige
- Se presenta como **información** ("si entra en vigencia"); las cuentas principales usan la ley actual.
- **Estado:**
  - La Corte Constitucional avaló la mayor parte de la ley (Sentencia C-264 de 2026, del 25 de agosto de 2026) y devolvió nueve artículos al Congreso.
  - La fecha que se anuncia para su vigencia es el **1 de abril de 2027**, pero depende de esa corrección.
- **Lo principal:**
  - La cotización hasta **2,3 SMMLV** iría a Colpensiones y lo que pase de ahí, a un fondo privado (componente complementario).
  - Quienes tenían al 30 de junio de 2025 al menos **900 semanas (hombres)** o **750 (mujeres)** siguen con la Ley 100 (régimen de transición).
  - Las mujeres con hijos tendrían 50 semanas menos por cada hijo, hasta 3 hijos.

### Google Finance
- `GOOGLEFINANCE` **solo funciona como fórmula dentro de la hoja**, así que se usa el mismo mecanismo que ya existe para las tasas (`Tasas_Google`).
  - Moni crea una hoja auxiliar `Precios_Google` con una fórmula por activo, la lee después de `flush()` y guarda el precio.
- **Símbolos:**
  - Acciones y ETF: `NASDAQ:AAPL`, `NYSE:KO`, `NYSEARCA:VOO`.
  - Cripto: `CURRENCY:BTCUSD`, `CURRENCY:ETHUSD` (Google trata cada cripto como un par de monedas).
  - Acciones de la BVC (`BVC:ECOPETROL`): la cobertura no está garantizada; si Google no devuelve un precio, se usa el **precio manual**.
- La fórmula puede tardar unos segundos o mostrar `#N/A`. En ese caso se conserva el último precio y se avisa.
- **Actualización diaria:** el mismo disparador diario de las tasas (`actualizarTasasAuto`) también actualiza los precios, y queda un historial (uno por día) para los gráficos.

---

## 3. Plan de implementación

### 3.1 Metas de ahorro (reemplaza a "Regalos" en Planear)
- **Tabla nueva `Metas`** con estas columnas:
  - `ID_Meta`, `Nombre`, `Motivo` (Navidad · Viaje · Moto · Carro · Casa · Estudio · Emergencias · Tecnología · Otro).
  - `Monto_Objetivo`, `Ahorro_Inicial`, `Fecha_Inicio`, `Fecha_Fin`, `ID_Bolsillo`.
  - `Plan_Mensual`: texto JSON `{ "AAAA-MM": valor }`; vacío = reparto automático.
  - `Estado` (Activa · Pausada · Cumplida), `Notas`, `Activo`, `Orden`.
- **Ahorrado** = `Ahorro_Inicial` + lo **real** de los renglones del presupuesto de la meta (`Presupuesto_Mes.ID_Meta`) + los aportes directos (traslados con `Ref = "Meta <id>"`).
- **Usado:** son los gastos con esa misma referencia; se muestra aparte.
- **Plan por mes:**
  - **Automático:** lo que falta se reparte en partes iguales entre los meses que quedan.
  - **Personalizado:** la persona escribe cuánto aporta cada mes (puede ser 0).
  - **Al día:** si en un mes pasado aportó menos de lo planeado, Moni propone cuánto poner por mes desde ahora para llegar a tiempo.
- **Presupuesto:**
  - Como con las suscripciones, cada meta activa con bolsillo agrega un renglón `Fondo` con el plan de ese mes (`agregarMetasAlMes`, idempotente).
  - Se agrega al generar el mes y con el botón "Agregar suscripciones y metas".
  - El renglón se mantiene al día mientras no esté completo.
- **Pantalla Metas:**
  - Lista con barra de avance y "te faltan X · Y al mes".
  - Detalle con:
    - avance;
    - columnas de plan frente a aportado por mes;
    - línea de lo acumulado frente a la meta y la proyección;
    - calendario de aportes editable;
    - acciones *Aportar ahora* (traslado), *Usar el dinero* (gasto), *Marcar como cumplida*, *Editar*.
- **Los "Fondo" que ya existen** en la plantilla y las metas de las cuentas de ahorro (`Cuentas.Meta`) **no cambian**.

### 3.2 Lista de deseos (evolución de Regalos, mismos datos)
- **Se reutiliza la tabla `Regalos`**, con estas columnas nuevas:
  - `Para` (vacío = persona elegida; `Yo` = para mí);
  - `Categoria` (Regalo · Cuidado personal · Ropa · Tecnología · Hogar · Experiencia · Otro);
  - `Ocasion`, `Prioridad` (Alta · Media · Baja);
  - `Estado` (Idea · Decidido · Comprado · Descartado);
  - `Enlace`, `Fecha_Objetivo`, `Precio_Pagado` (comprado sin registrar el gasto).
- **Tabla nueva `Deseos_Ideas`:** `ID_Idea`, `ID_Regalo`, `Texto`, `Precio`, `Enlace`, `Elegida`, `Orden`. Es la lluvia de ideas de cada deseo.
- **Lo que ya tenían los regalos:**
  - Se ven igual: misma persona, idea, estimado y año.
  - "Registrar la compra" sigue disponible y es **opcional**.
  - Los gastos ya enlazados siguen contando como lo gastado.
  - El aviso de mover el dinero a la reserva de la tarjeta se mantiene.
- **Persona opcional:** sin persona, el deseo es "para mí".
- **Pantalla:** se filtra por año y por *Para quién* (Todos · Para mí · cada persona). Muestra totales de lo estimado y lo gastado, el gráfico por persona o categoría, y la lluvia de ideas en el detalle.

### 3.3 Calculadora (Planear → Herramientas)
Todo el cálculo ocurre en el navegador (`js_calculadora.html`) con funciones puras que se prueban en Node.
1. **Préstamo:** monto, plazo y tasa (EA, mensual o nominal), más seguros por cuota. Muestra la cuota, el total de intereses, el total pagado, el gráfico del saldo y la tabla de amortización.
2. **Ahorro en el tiempo:** lo que tienes hoy, el aporte mensual, la tasa EA y el plazo. Muestra el valor final y el gráfico de aportes frente a intereses.
3. **¿Cuánto debo ahorrar?:** meta, fecha y tasa. Muestra el aporte mensual y un botón **Crear esta meta**.
4. **CDT:** capital, tasa EA, plazo en días y retención (4 % de los intereses por defecto). Muestra el neto y lo que gana por mes.
5. **Convertir tasas:** EA ↔ mensual vencida ↔ nominal anual mes vencido.

### 3.4 Inversiones (Dinero → Inversiones)
- **Tablas nuevas:**
  - `Inversiones`: `ID_Inversion`, `Nombre`, `Tipo` (Acción · ETF · Cripto · Fondo · Bono · Otro), `Simbolo`, `Divisa`, `Precio_Manual`, `Fecha_Precio_Manual`, `Precio_Google`, `Fecha_Precio_Google`, `Notas`, `Activo`, `Orden`.
  - `Inversiones_Operaciones`: `ID_Operacion`, `ID_Inversion`, `Fecha`, `Tipo` (Compra · Venta · Dividendo), `Cantidad`, `Precio`, `Valor` (en pesos), `Comision`, `ID_Bolsillo`, `ID_Mov`, `Notas`, `Anulado`.
  - `Inversiones_Precios`: `Fecha`, `ID_Inversion`, `Precio`, `Divisa`, `Fuente`. Es el historial, uno por día.
- **Movimientos de dinero (opcionales, con bolsillo):**
  - Comprar → `Ajuste` con subtipo `Inversion_Compra`.
  - Vender → `Ajuste` con subtipo `Inversion_Venta`.
  - Ninguno de los dos cuenta como gasto o ingreso (se agregan a `SUBTIPOS_INVERSION`, como los CDT).
  - Un dividendo es un **ingreso** de la categoría con rol de rendimiento.
- **Valoración:**
  - Cantidad × precio (de Google o manual, el más reciente), convertido a pesos con la tasa de la moneda (`Config.Tasa_USD` y demás).
  - Costo con el método de **costo promedio**.
  - Ganancia sin realizar, ganancia realizada y dividendos.
- **Patrimonio:** lo invertido en Inicio y en Análisis suma las inversiones a los CDT.
- **Pantalla:**
  - Total invertido, valor de hoy y ganancia.
  - Distribución por tipo y la evolución del valor (desde el historial).
  - Por cada activo: operaciones y precio.
  - Botón **Actualizar precios** (Google Finance).

### 3.5 Pensiones y cesantías (Planear → Herramientas)
- Funciones puras en `js_pensiones.html`, probadas en Node. Toman el SMMLV y el auxilio de la hoja, y llenan el salario a partir de la nómina.
- **Cesantías:**
  - Entradas: salario o promedio, ¿salario integral?, fechas del periodo y días no remunerados.
  - Calcula si aplica el auxilio de transporte.
  - Resultado: cesantías, intereses y prima del semestre, con sus fechas límite. También qué se puede hacer con ellas (retiros) y una línea de tiempo del año.
- **Pensión:**
  - Entradas: sexo, fecha de nacimiento, semanas cotizadas, salario (IBC), si eres independiente, régimen (Colpensiones o fondo privado), saldo de la cuenta y rentabilidad (fondo privado), semanas por año que seguirás cotizando e hijos (solo para la sección de la reforma).
  - Resultados:
    - edad y fecha en que la cumples;
    - semanas requeridas (con la tabla de C-197) y semanas que faltan;
    - **fecha estimada de pensión**;
    - mesada estimada y tasa de reemplazo;
    - aporte mensual (el tuyo y el del empleador, más el FSP);
    - gráfico de semanas acumuladas frente a las requeridas.
  - Sección **"Si entra la reforma (Ley 2381)"**: si estás en el régimen de transición y cómo se repartiría tu cotización.
  - Los datos se guardan en `Config` (`Pension_*`) para no escribirlos otra vez.
- **Aviso:** son estimados informativos. Para el dato oficial, el simulador y la historia laboral de Colpensiones o del fondo.

### 3.6 Navegación
- **Planear → Cada mes:** Presupuesto · Nómina · Otros ingresos · Servicios y suscripciones · **Metas**.
- **Planear → Mirar el año:** Análisis · Vista anual · **Lista de deseos**.
- **Planear → Herramientas:** **Calculadora** · **Pensiones y cesantías**.
- **Dinero:** Bolsillos · Movimientos · Ahorro · CDT · **Inversiones**.
- La ruta `regalos` se conserva como alias de `deseos`.

### 3.7 Verificación
- Pruebas en Node:
  - metas: plan automático y personalizado, presupuesto idempotente, avance;
  - lista de deseos: datos viejos de regalos intactos, para mí, ideas;
  - inversiones: costo promedio, ventas, dividendos, precios de Google y precio manual, patrimonio;
  - calculadoras: cuota francesa, valor futuro, tasas;
  - pensiones y cesantías: casos con cifras conocidas;
  - migración desde la 1.10.0 con las tablas nuevas.
- `npm run verificar`.
- Playwright: todas las pantallas a 390 y 1280 px, más los flujos de cada módulo.
- Documentación: CHANGELOG, ESQUEMA, ARQUITECTURA y MANUAL. Versión **1.16.0**.

## Fuentes consultadas
- Reforma pensional, estado en 2026: [La FM](https://www.lafm.com.co/politica/corte-constitucional-aclara-el-futuro-de-la-reforma-pensional-el-debate-sigue-abierto-409630), [Asofondos](https://asofondos.org.co/comunicados/corte-constitucional-suspende-entrada-vigencia-reforma-pensional/), [Seguridad Social Colombia](https://seguridadsocialcolombia.com.co/la-corte-constitucional-avala-la-reforma-pensional-ley-2381-de-2024-claves-del-fallo/), [Porvenir](https://www.porvenir.com.co/porvenir-te-responde/reforma-pensional), [Abecé MinSalud](https://minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/VP/DOA/abece-reforma-pensional-ley-2381-de-2024.pdf), [Universidad del Rosario](https://urosario.edu.co/node/56491).
- Salario mínimo y auxilio 2026: [Decreto 1470 de 2025](https://normograma.mintic.gov.co/mintic/compilacion/docs/decreto_1470_2025.htm), [La República](https://www.larepublica.co/economia/mintrabajo-publico-decreto-transitorio-que-mantiene-minimo-de-1-75-millones-en-2026-4331878), [El País](https://www.elpais.com.co/economia/salario-minimo-2026-sin-auxilio-de-transporte-cuanto-queda-y-en-que-casos-no-se-paga-1108.html).
- Monto de pensión en Colpensiones: [Gerencie](https://www.gerencie.com/guia-pensiones/tasa-de-reemplazo), [El País](https://www.elpais.com.co/economia/pension-en-colpensiones-2026-asi-se-calcula-el-pago-mensual-segun-la-tasa-de-reemplazo-0930.html).
- Semanas de las mujeres: [C-197 de 2023 (Colpensiones)](https://normativa.colpensiones.gov.co/colpensiones/compilacion/docs/C-197_2023.htm), [Javeriana](https://www.javeriana.edu.co/pesquisa/reforma-pensional-enfoque-genero/).
- Cesantías: [Noticias RCN](https://www.noticiasrcn.com/economia/intereses-de-cesantias-en-2026-asi-puede-calcular-lo-que-recibira-en-enero-985569), [Siempre al día](https://siemprealdia.co/colombia/derecho-laboral/como-se-calculan-las-cesantias/), [Actualícese](https://actualicese.com/calculadora-de-cesantias-e-intereses-de-cesantias/).
- Google Finance: [Ayuda de Google](https://support.google.com/docs/answer/3093281?hl=ES-ES), [Spreadsheet Class](https://www.spreadsheetclass.com/?p=3884), [StockAnalysis (BVC: ECOPETROL)](https://stockanalysis.com/quote/bvc/ECOPETROL/company).
- Apps de finanzas: [La República](https://www.larepublica.co/finanzas/cuales-son-las-aplicaciones-que-ayudan-a-controlar-gastos-y-ahorrar-mejor-al-mes-4371175), [Infobae](https://www.infobae.com/economia/2022/08/28/finanzas-personales-5-aplicaciones-moviles-para-controlar-los-gastos-y-fijar-objetivos-de-ahorro/), [BBVA](https://www.bbva.com/es/salud-financiera/estas-son-las-nueve-apps-de-finanzas-que-ayudan-a-ahorrar/).
