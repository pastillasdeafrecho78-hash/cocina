--
-- PostgreSQL database dump
--

\restrict LzXDL2eWE8BJglfWumgQeGfJ3WwQ8X4AD0C6US1amw3POBcNt3xHNL1anOJX88t

-- Dumped from database version 15.17 (Debian 15.17-1.pgdg13+1)
-- Dumped by pg_dump version 15.17 (Debian 15.17-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: DestinoItem; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."DestinoItem" AS ENUM (
    'COCINA',
    'BARRA'
);


ALTER TYPE public."DestinoItem" OWNER TO postgres;

--
-- Name: EstadoComanda; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."EstadoComanda" AS ENUM (
    'PENDIENTE',
    'EN_PREPARACION',
    'LISTO',
    'SERVIDO',
    'PAGADO',
    'CANCELADO'
);


ALTER TYPE public."EstadoComanda" OWNER TO postgres;

--
-- Name: EstadoItem; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."EstadoItem" AS ENUM (
    'PENDIENTE',
    'EN_PREPARACION',
    'LISTO',
    'ENTREGADO'
);


ALTER TYPE public."EstadoItem" OWNER TO postgres;

--
-- Name: EstadoMesa; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."EstadoMesa" AS ENUM (
    'LIBRE',
    'OCUPADA',
    'CUENTA_PEDIDA',
    'RESERVADA'
);


ALTER TYPE public."EstadoMesa" OWNER TO postgres;

--
-- Name: EstadoPago; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."EstadoPago" AS ENUM (
    'PENDIENTE',
    'COMPLETADO',
    'FALLIDO',
    'CANCELADO'
);


ALTER TYPE public."EstadoPago" OWNER TO postgres;

--
-- Name: Rol; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Rol" AS ENUM (
    'MESERO',
    'CAJERO',
    'COCINERO',
    'BARTENDER',
    'ADMIN',
    'GERENTE'
);


ALTER TYPE public."Rol" OWNER TO postgres;

--
-- Name: TipoCategoria; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TipoCategoria" AS ENUM (
    'COMIDA',
    'BEBIDA',
    'POSTRE',
    'ENTRADA'
);


ALTER TYPE public."TipoCategoria" OWNER TO postgres;

--
-- Name: TipoModificador; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TipoModificador" AS ENUM (
    'INGREDIENTE',
    'COCCION',
    'TAMANO',
    'EXTRAS'
);


ALTER TYPE public."TipoModificador" OWNER TO postgres;

--
-- Name: TipoPedido; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TipoPedido" AS ENUM (
    'EN_MESA',
    'PARA_LLEVAR',
    'A_DOMICILIO',
    'WHATSAPP'
);


ALTER TYPE public."TipoPedido" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Auditoria; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Auditoria" (
    id text NOT NULL,
    "usuarioId" text NOT NULL,
    accion text NOT NULL,
    entidad text,
    "entidadId" text,
    detalles jsonb,
    "fechaAccion" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Auditoria" OWNER TO postgres;

--
-- Name: Categoria; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Categoria" (
    id text NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    tipo public."TipoCategoria" NOT NULL,
    orden integer DEFAULT 0 NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Categoria" OWNER TO postgres;

--
-- Name: Cliente; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Cliente" (
    id text NOT NULL,
    nombre text NOT NULL,
    telefono text,
    direccion text,
    notas text,
    rfc text,
    "razonSocial" text,
    "regimenFiscal" text,
    "codigoPostal" text,
    "usoCFDI" text DEFAULT 'G03'::text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Cliente" OWNER TO postgres;

--
-- Name: Comanda; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Comanda" (
    id text NOT NULL,
    "numeroComanda" text NOT NULL,
    "mesaId" text,
    "clienteId" text,
    "tipoPedido" public."TipoPedido" DEFAULT 'EN_MESA'::public."TipoPedido" NOT NULL,
    estado public."EstadoComanda" DEFAULT 'PENDIENTE'::public."EstadoComanda" NOT NULL,
    total double precision NOT NULL,
    propina double precision DEFAULT 0,
    descuento double precision DEFAULT 0,
    observaciones text,
    "fechaCreacion" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "fechaCompletado" timestamp(3) without time zone,
    "fechaEntrega" timestamp(3) without time zone,
    "creadoPorId" text NOT NULL,
    "asignadoAId" text
);


ALTER TABLE public."Comanda" OWNER TO postgres;

--
-- Name: ComandaHistorial; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ComandaHistorial" (
    id text NOT NULL,
    "comandaId" text NOT NULL,
    accion text NOT NULL,
    descripcion text,
    "usuarioId" text,
    "fechaAccion" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."ComandaHistorial" OWNER TO postgres;

--
-- Name: ComandaItem; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ComandaItem" (
    id text NOT NULL,
    "comandaId" text NOT NULL,
    "productoId" text NOT NULL,
    cantidad integer DEFAULT 1 NOT NULL,
    "precioUnitario" double precision NOT NULL,
    subtotal double precision NOT NULL,
    notas text,
    estado public."EstadoItem" DEFAULT 'PENDIENTE'::public."EstadoItem" NOT NULL,
    destino public."DestinoItem" NOT NULL,
    "fechaPreparacion" timestamp(3) without time zone,
    "fechaListo" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ComandaItem" OWNER TO postgres;

--
-- Name: ComplementoPago; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ComplementoPago" (
    id text NOT NULL,
    "facturaId" text NOT NULL,
    "fechaPago" timestamp(3) without time zone NOT NULL,
    "formaPagoP" text NOT NULL,
    "monedaP" text DEFAULT 'MXN'::text NOT NULL,
    monto double precision NOT NULL,
    "numOperacion" text,
    "rfcEmisorCtaOrd" text,
    "nomBancoOrdExt" text,
    "rfcEmisorCtaBen" text,
    "ctaOrdenante" text,
    "ctaBeneficiario" text,
    "tipoCadPago" text,
    "certPago" text,
    "cadPago" text,
    "selloPago" text,
    "uuidDocumento" text,
    "serieDocumento" text,
    "folioDocumento" text,
    "monedaDR" text,
    "tipoCambioDR" double precision,
    "metodoPagoDR" text,
    "numParcialidad" integer,
    "impSaldoAnt" double precision,
    "impPagado" double precision,
    "impSaldoInsoluto" double precision,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ComplementoPago" OWNER TO postgres;

--
-- Name: ConfiguracionRestaurante; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ConfiguracionRestaurante" (
    id text NOT NULL,
    rfc text,
    nombre text,
    "regimenFiscal" text,
    "codigoPostal" text,
    calle text,
    "numeroExterior" text,
    "numeroInterior" text,
    colonia text,
    municipio text,
    estado text,
    pais text DEFAULT 'MEX'::text,
    "lugarExpedicionCp" text,
    "serieFactura" text DEFAULT 'A'::text,
    "folioInicial" integer DEFAULT 1,
    "folioActual" integer DEFAULT 1,
    "tipoComprobante" text DEFAULT 'I'::text,
    exportacion text DEFAULT '01'::text,
    moneda text DEFAULT 'MXN'::text,
    "tipoCambio" double precision,
    "preciosIncluyenIva" boolean DEFAULT false NOT NULL,
    "tasaIva16" double precision DEFAULT 0.16,
    "tasaIva0" double precision DEFAULT 0.0,
    "tasaIeps" double precision DEFAULT 0.0,
    "descuentosAntesImpuestos" boolean DEFAULT true NOT NULL,
    redondeo text DEFAULT 'redondeo'::text,
    "pacApiKey" text,
    "pacApiUrl" text DEFAULT 'https://api.facturacion.com/v1'::text,
    "pacModo" text DEFAULT 'pruebas'::text,
    "pacConfigurado" boolean DEFAULT false NOT NULL,
    "conektaPrivateKey" text,
    "conektaPublicKey" text,
    "conektaApiVersion" text DEFAULT '2.0'::text,
    "pagosConfigurado" boolean DEFAULT false NOT NULL,
    "csdCerPath" text,
    "csdKeyPath" text,
    "csdPassword" text,
    "csdVigente" boolean DEFAULT false NOT NULL,
    "csdFechaVencimiento" timestamp(3) without time zone,
    "facturaGlobalHabilitada" boolean DEFAULT true NOT NULL,
    "facturaGlobalRfcReceptor" text DEFAULT 'XAXX010101000'::text,
    "facturaGlobalNombreReceptor" text DEFAULT 'PÚBLICO EN GENERAL'::text,
    "facturaGlobalRegimenReceptor" text DEFAULT '616'::text,
    "facturaGlobalUsoCFDI" text DEFAULT 'S01'::text,
    "facturaGlobalPeriodicidad" text,
    "facturaGlobalMes" integer,
    "facturaGlobalAnio" integer,
    "facturaGlobalPoliticaNominativa" text DEFAULT 'emitir_sin_ajustar'::text,
    "webhookSecretConekta" text,
    "webhookUrl" text,
    "configuracionCompleta" boolean DEFAULT false NOT NULL,
    "configuradoPorId" text,
    "fechaConfiguracion" timestamp(3) without time zone,
    "tiempoAmarilloMinutos" integer DEFAULT 30,
    "tiempoRojoMinutos" integer DEFAULT 60,
    "propinaFacturar" boolean DEFAULT false NOT NULL,
    "propinaObjetoImp" text DEFAULT '02'::text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ConfiguracionRestaurante" OWNER TO postgres;

--
-- Name: CorteX; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."CorteX" (
    id text NOT NULL,
    "fechaHora" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "usuarioId" text NOT NULL,
    "totalVentas" double precision DEFAULT 0 NOT NULL,
    "totalEfectivo" double precision DEFAULT 0 NOT NULL,
    "totalTarjeta" double precision DEFAULT 0 NOT NULL,
    "totalOtros" double precision DEFAULT 0 NOT NULL,
    "numComandas" integer DEFAULT 0 NOT NULL,
    detalles jsonb
);


ALTER TABLE public."CorteX" OWNER TO postgres;

--
-- Name: CorteZ; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."CorteZ" (
    id text NOT NULL,
    "fechaHora" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "usuarioId" text NOT NULL,
    "totalVentas" double precision DEFAULT 0 NOT NULL,
    "totalEfectivo" double precision DEFAULT 0 NOT NULL,
    "totalTarjeta" double precision DEFAULT 0 NOT NULL,
    "totalOtros" double precision DEFAULT 0 NOT NULL,
    "numComandas" integer DEFAULT 0 NOT NULL,
    detalles jsonb
);


ALTER TABLE public."CorteZ" OWNER TO postgres;

--
-- Name: Factura; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Factura" (
    id text NOT NULL,
    "comandaId" text NOT NULL,
    "pagoId" text,
    uuid text NOT NULL,
    folio text,
    serie text,
    "fechaEmision" timestamp(3) without time zone NOT NULL,
    "emisorRfc" text NOT NULL,
    "receptorRfc" text,
    "receptorNombre" text NOT NULL,
    "usoCFDI" text NOT NULL,
    subtotal double precision NOT NULL,
    iva double precision NOT NULL,
    total double precision NOT NULL,
    "formaPago" text NOT NULL,
    "metodoPago" text NOT NULL,
    xml text NOT NULL,
    pdf text,
    "qrCode" text,
    estado text DEFAULT 'activa'::text NOT NULL,
    "motivoCancelacion" text,
    "uuidSustitucion" text,
    "fechaCancelacion" timestamp(3) without time zone,
    "detallesEmision" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Factura" OWNER TO postgres;

--
-- Name: FacturaConcepto; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."FacturaConcepto" (
    id text NOT NULL,
    "facturaId" text NOT NULL,
    "productoId" text,
    "claveProdServ" text NOT NULL,
    cantidad double precision NOT NULL,
    "claveUnidad" text NOT NULL,
    descripcion text NOT NULL,
    "valorUnitario" double precision NOT NULL,
    importe double precision NOT NULL,
    "objetoImp" text DEFAULT '02'::text NOT NULL,
    iva double precision DEFAULT 0 NOT NULL,
    "ivaTasa" double precision,
    ieps double precision DEFAULT 0,
    "iepsTasa" double precision,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."FacturaConcepto" OWNER TO postgres;

--
-- Name: ItemModificador; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ItemModificador" (
    id text NOT NULL,
    "comandaItemId" text NOT NULL,
    "modificadorId" text NOT NULL,
    "precioExtra" double precision DEFAULT 0 NOT NULL
);


ALTER TABLE public."ItemModificador" OWNER TO postgres;

--
-- Name: Mesa; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Mesa" (
    id text NOT NULL,
    numero integer NOT NULL,
    capacidad integer NOT NULL,
    estado public."EstadoMesa" DEFAULT 'LIBRE'::public."EstadoMesa" NOT NULL,
    ubicacion text,
    piso text,
    "posicionX" double precision,
    "posicionY" double precision,
    rotacion double precision DEFAULT 0,
    "plantaId" text,
    activa boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Mesa" OWNER TO postgres;

--
-- Name: Modificador; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Modificador" (
    id text NOT NULL,
    nombre text NOT NULL,
    tipo public."TipoModificador" NOT NULL,
    "precioExtra" double precision DEFAULT 0,
    activo boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Modificador" OWNER TO postgres;

--
-- Name: ModificadorCategoria; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ModificadorCategoria" (
    id text NOT NULL,
    "categoriaId" text NOT NULL,
    "modificadorId" text NOT NULL
);


ALTER TABLE public."ModificadorCategoria" OWNER TO postgres;

--
-- Name: ModificadorProducto; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ModificadorProducto" (
    id text NOT NULL,
    "productoId" text NOT NULL,
    "modificadorId" text NOT NULL
);


ALTER TABLE public."ModificadorProducto" OWNER TO postgres;

--
-- Name: Pago; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Pago" (
    id text NOT NULL,
    "comandaId" text NOT NULL,
    monto double precision NOT NULL,
    "metodoPago" text NOT NULL,
    procesador text DEFAULT 'conekta'::text NOT NULL,
    "procesadorId" text,
    estado public."EstadoPago" DEFAULT 'PENDIENTE'::public."EstadoPago" NOT NULL,
    comision double precision DEFAULT 0,
    referencia text,
    detalles jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Pago" OWNER TO postgres;

--
-- Name: PlantaRestaurante; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PlantaRestaurante" (
    id text NOT NULL,
    nombre text,
    vertices jsonb NOT NULL,
    edges jsonb,
    "cellSizeM" double precision DEFAULT 1.0 NOT NULL,
    "originX" double precision DEFAULT 0 NOT NULL,
    "originY" double precision DEFAULT 0 NOT NULL,
    "widthM" double precision,
    "heightM" double precision,
    activa boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."PlantaRestaurante" OWNER TO postgres;

--
-- Name: Producto; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Producto" (
    id text NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    precio double precision NOT NULL,
    "categoriaId" text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    "imagenUrl" text,
    "objetoImp" text DEFAULT '02'::text,
    "claveProdServ" text,
    "claveUnidad" text DEFAULT 'H87'::text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Producto" OWNER TO postgres;

--
-- Name: Usuario; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Usuario" (
    id text NOT NULL,
    email text NOT NULL,
    nombre text NOT NULL,
    apellido text NOT NULL,
    password text NOT NULL,
    rol public."Rol" NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    "ultimoAcceso" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Usuario" OWNER TO postgres;

--
-- Data for Name: Auditoria; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Auditoria" (id, "usuarioId", accion, entidad, "entidadId", detalles, "fechaAccion") FROM stdin;
cmmd6i78q0001ek9siy7723q2	cmmd6gy5m0000m4f4puqzfgqc	LOGIN	Usuario	cmmd6gy5m0000m4f4puqzfgqc	\N	2026-03-05 08:03:28.682
cmmd6ic6t0003ek9sax0ufrom	cmmd6gy5m0000m4f4puqzfgqc	LOGIN	Usuario	cmmd6gy5m0000m4f4puqzfgqc	\N	2026-03-05 08:03:35.094
cmmdp6csi00011u879w2b1pwb	cmmd6gy5m0000m4f4puqzfgqc	LOGIN	Usuario	cmmd6gy5m0000m4f4puqzfgqc	\N	2026-03-05 16:46:08.706
cmmdpe8en0007qov3ka7dfh3w	cmmd6gy5m0000m4f4puqzfgqc	CREAR_COMANDA	Comanda	cmmdpe8eh0001qov3lpmvbsia	\N	2026-03-05 16:52:16.272
\.


--
-- Data for Name: Categoria; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Categoria" (id, nombre, descripcion, tipo, orden, activa, "createdAt", "updatedAt") FROM stdin;
cmmd6gyjh000fm4f49586i5ml	Comida	\N	COMIDA	1	t	2026-03-05 08:02:30.749	2026-03-05 08:02:30.749
cmmd6gyjm000gm4f401ngu55j	Bebidas	\N	BEBIDA	2	t	2026-03-05 08:02:30.754	2026-03-05 08:02:30.754
cmmd6gyjn000hm4f4fz1eyfu8	Postres	\N	POSTRE	3	t	2026-03-05 08:02:30.756	2026-03-05 08:02:30.756
\.


--
-- Data for Name: Cliente; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Cliente" (id, nombre, telefono, direccion, notas, rfc, "razonSocial", "regimenFiscal", "codigoPostal", "usoCFDI", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Comanda; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Comanda" (id, "numeroComanda", "mesaId", "clienteId", "tipoPedido", estado, total, propina, descuento, observaciones, "fechaCreacion", "fechaCompletado", "fechaEntrega", "creadoPorId", "asignadoAId") FROM stdin;
cmmdpe8eh0001qov3lpmvbsia	COM-260305-0001	cmmd6gyj10005m4f4f01jnbht	\N	EN_MESA	PENDIENTE	80	0	0		2026-03-05 16:52:16.266	\N	\N	cmmd6gy5m0000m4f4puqzfgqc	\N
\.


--
-- Data for Name: ComandaHistorial; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ComandaHistorial" (id, "comandaId", accion, descripcion, "usuarioId", "fechaAccion") FROM stdin;
cmmdpe8ei0005qov330p9dtvm	cmmdpe8eh0001qov3lpmvbsia	CREADA	Comanda creada por Admin Sistema	cmmd6gy5m0000m4f4puqzfgqc	2026-03-05 16:52:16.266
\.


--
-- Data for Name: ComandaItem; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ComandaItem" (id, "comandaId", "productoId", cantidad, "precioUnitario", subtotal, notas, estado, destino, "fechaPreparacion", "fechaListo", "createdAt", "updatedAt") FROM stdin;
cmmdpe8eh0003qov3q4l8go8s	cmmdpe8eh0001qov3lpmvbsia	cmmd6gyjp000jm4f4rynibj4z	1	80	80		PENDIENTE	COCINA	\N	\N	2026-03-05 16:52:16.266	2026-03-05 16:52:16.266
\.


--
-- Data for Name: ComplementoPago; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ComplementoPago" (id, "facturaId", "fechaPago", "formaPagoP", "monedaP", monto, "numOperacion", "rfcEmisorCtaOrd", "nomBancoOrdExt", "rfcEmisorCtaBen", "ctaOrdenante", "ctaBeneficiario", "tipoCadPago", "certPago", "cadPago", "selloPago", "uuidDocumento", "serieDocumento", "folioDocumento", "monedaDR", "tipoCambioDR", "metodoPagoDR", "numParcialidad", "impSaldoAnt", "impPagado", "impSaldoInsoluto", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ConfiguracionRestaurante; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ConfiguracionRestaurante" (id, rfc, nombre, "regimenFiscal", "codigoPostal", calle, "numeroExterior", "numeroInterior", colonia, municipio, estado, pais, "lugarExpedicionCp", "serieFactura", "folioInicial", "folioActual", "tipoComprobante", exportacion, moneda, "tipoCambio", "preciosIncluyenIva", "tasaIva16", "tasaIva0", "tasaIeps", "descuentosAntesImpuestos", redondeo, "pacApiKey", "pacApiUrl", "pacModo", "pacConfigurado", "conektaPrivateKey", "conektaPublicKey", "conektaApiVersion", "pagosConfigurado", "csdCerPath", "csdKeyPath", "csdPassword", "csdVigente", "csdFechaVencimiento", "facturaGlobalHabilitada", "facturaGlobalRfcReceptor", "facturaGlobalNombreReceptor", "facturaGlobalRegimenReceptor", "facturaGlobalUsoCFDI", "facturaGlobalPeriodicidad", "facturaGlobalMes", "facturaGlobalAnio", "facturaGlobalPoliticaNominativa", "webhookSecretConekta", "webhookUrl", "configuracionCompleta", "configuradoPorId", "fechaConfiguracion", "tiempoAmarilloMinutos", "tiempoRojoMinutos", "propinaFacturar", "propinaObjetoImp", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: CorteX; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."CorteX" (id, "fechaHora", "usuarioId", "totalVentas", "totalEfectivo", "totalTarjeta", "totalOtros", "numComandas", detalles) FROM stdin;
\.


--
-- Data for Name: CorteZ; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."CorteZ" (id, "fechaHora", "usuarioId", "totalVentas", "totalEfectivo", "totalTarjeta", "totalOtros", "numComandas", detalles) FROM stdin;
\.


--
-- Data for Name: Factura; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Factura" (id, "comandaId", "pagoId", uuid, folio, serie, "fechaEmision", "emisorRfc", "receptorRfc", "receptorNombre", "usoCFDI", subtotal, iva, total, "formaPago", "metodoPago", xml, pdf, "qrCode", estado, "motivoCancelacion", "uuidSustitucion", "fechaCancelacion", "detallesEmision", "createdAt") FROM stdin;
\.


--
-- Data for Name: FacturaConcepto; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."FacturaConcepto" (id, "facturaId", "productoId", "claveProdServ", cantidad, "claveUnidad", descripcion, "valorUnitario", importe, "objetoImp", iva, "ivaTasa", ieps, "iepsTasa", "createdAt") FROM stdin;
\.


--
-- Data for Name: ItemModificador; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ItemModificador" (id, "comandaItemId", "modificadorId", "precioExtra") FROM stdin;
\.


--
-- Data for Name: Mesa; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Mesa" (id, numero, capacidad, estado, ubicacion, piso, "posicionX", "posicionY", rotacion, "plantaId", activa, "createdAt", "updatedAt") FROM stdin;
cmmd6gyis0003m4f461q059ht	1	4	LIBRE	Salón	\N	\N	\N	0	\N	t	2026-03-05 08:02:30.725	2026-03-05 08:02:30.725
cmmd6gyiz0004m4f434kaxk7s	2	4	LIBRE	Salón	\N	\N	\N	0	\N	t	2026-03-05 08:02:30.732	2026-03-05 08:02:30.732
cmmd6gyj30006m4f4oxg3g8nx	4	4	LIBRE	Salón	\N	\N	\N	0	\N	t	2026-03-05 08:02:30.735	2026-03-05 08:02:30.735
cmmd6gyj40007m4f4ofbczbbm	5	6	LIBRE	Salón	\N	\N	\N	0	\N	t	2026-03-05 08:02:30.737	2026-03-05 08:02:30.737
cmmd6gyj60008m4f4jz7lamu5	6	6	LIBRE	Salón	\N	\N	\N	0	\N	t	2026-03-05 08:02:30.738	2026-03-05 08:02:30.738
cmmd6gyj70009m4f4hp3whzy0	7	6	LIBRE	Terraza	\N	\N	\N	0	\N	t	2026-03-05 08:02:30.74	2026-03-05 08:02:30.74
cmmd6gyj9000am4f4suxnoc0m	8	6	LIBRE	Terraza	\N	\N	\N	0	\N	t	2026-03-05 08:02:30.741	2026-03-05 08:02:30.741
cmmd6gyja000bm4f4afqk95b4	9	8	LIBRE	Terraza	\N	\N	\N	0	\N	t	2026-03-05 08:02:30.743	2026-03-05 08:02:30.743
cmmd6gyjc000cm4f465xgytge	10	8	LIBRE	Terraza	\N	\N	\N	0	\N	t	2026-03-05 08:02:30.744	2026-03-05 08:02:30.744
cmmd6gyjd000dm4f47404fjro	11	8	LIBRE	Terraza	\N	\N	\N	0	\N	t	2026-03-05 08:02:30.745	2026-03-05 08:02:30.745
cmmd6gyje000em4f48ju9lo4p	12	8	LIBRE	Terraza	\N	\N	\N	0	\N	t	2026-03-05 08:02:30.746	2026-03-05 08:02:30.746
cmmd6gyj10005m4f4f01jnbht	3	4	OCUPADA	Salón	\N	\N	\N	0	\N	t	2026-03-05 08:02:30.733	2026-03-05 16:52:16.263
\.


--
-- Data for Name: Modificador; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Modificador" (id, nombre, tipo, "precioExtra", activo, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ModificadorCategoria; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ModificadorCategoria" (id, "categoriaId", "modificadorId") FROM stdin;
\.


--
-- Data for Name: ModificadorProducto; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ModificadorProducto" (id, "productoId", "modificadorId") FROM stdin;
\.


--
-- Data for Name: Pago; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Pago" (id, "comandaId", monto, "metodoPago", procesador, "procesadorId", estado, comision, referencia, detalles, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: PlantaRestaurante; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PlantaRestaurante" (id, nombre, vertices, edges, "cellSizeM", "originX", "originY", "widthM", "heightM", activa, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Producto; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Producto" (id, nombre, descripcion, precio, "categoriaId", activo, "imagenUrl", "objetoImp", "claveProdServ", "claveUnidad", "createdAt", "updatedAt") FROM stdin;
cmmd6gyjp000jm4f4rynibj4z	Tacos al Pastor	\N	80	cmmd6gyjh000fm4f49586i5ml	t	\N	02	\N	H87	2026-03-05 08:02:30.758	2026-03-05 08:02:30.758
cmmd6gyjr000lm4f4kcv5teih	Quesadillas	\N	70	cmmd6gyjh000fm4f49586i5ml	t	\N	02	\N	H87	2026-03-05 08:02:30.76	2026-03-05 08:02:30.76
cmmd6gyjt000nm4f44n6nezpc	Alambre	\N	120	cmmd6gyjh000fm4f49586i5ml	t	\N	02	\N	H87	2026-03-05 08:02:30.761	2026-03-05 08:02:30.761
cmmd6gyju000pm4f4wgot70cm	Coca Cola	\N	25	cmmd6gyjm000gm4f401ngu55j	t	\N	02	\N	H87	2026-03-05 08:02:30.763	2026-03-05 08:02:30.763
cmmd6gyjw000rm4f4b1iqdg5e	Agua Natural	\N	20	cmmd6gyjm000gm4f401ngu55j	t	\N	02	\N	H87	2026-03-05 08:02:30.764	2026-03-05 08:02:30.764
cmmd6gyjx000tm4f4juw52q2e	Flan	\N	45	cmmd6gyjn000hm4f4fz1eyfu8	t	\N	02	\N	H87	2026-03-05 08:02:30.766	2026-03-05 08:02:30.766
\.


--
-- Data for Name: Usuario; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Usuario" (id, email, nombre, apellido, password, rol, activo, "ultimoAcceso", "createdAt", "updatedAt") FROM stdin;
cmmd6gyc20001m4f483qjf2iq	mesero@restaurante.com	Juan	Mesero	$2a$12$f2quDqVOmvDgJlXgTxiLju6DrHss7FwQmbMj8MSvYL0kOt.ZZ7XAO	MESERO	t	\N	2026-03-05 08:02:30.483	2026-03-05 08:02:30.483
cmmd6gyih0002m4f4limcg052	cocinero@restaurante.com	Pedro	Cocinero	$2a$12$fNgQcjcbULr7mR2aip616ef2bEzUgtdqPVMPZ/YJMHgB5YjbQemmG	COCINERO	t	\N	2026-03-05 08:02:30.714	2026-03-05 08:02:30.714
cmmd6gy5m0000m4f4puqzfgqc	admin@restaurante.com	Admin	Sistema	$2a$12$cyOQ5dAcuHANtMrNWiOoRehx6oBYbFn8MSIhnucOFWddF7ftEaYYS	ADMIN	t	2026-03-05 16:46:08.69	2026-03-05 08:02:30.25	2026-03-05 16:46:08.691
\.


--
-- Name: Auditoria Auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Auditoria"
    ADD CONSTRAINT "Auditoria_pkey" PRIMARY KEY (id);


--
-- Name: Categoria Categoria_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Categoria"
    ADD CONSTRAINT "Categoria_pkey" PRIMARY KEY (id);


--
-- Name: Cliente Cliente_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Cliente"
    ADD CONSTRAINT "Cliente_pkey" PRIMARY KEY (id);


--
-- Name: ComandaHistorial ComandaHistorial_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ComandaHistorial"
    ADD CONSTRAINT "ComandaHistorial_pkey" PRIMARY KEY (id);


--
-- Name: ComandaItem ComandaItem_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ComandaItem"
    ADD CONSTRAINT "ComandaItem_pkey" PRIMARY KEY (id);


--
-- Name: Comanda Comanda_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Comanda"
    ADD CONSTRAINT "Comanda_pkey" PRIMARY KEY (id);


--
-- Name: ComplementoPago ComplementoPago_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ComplementoPago"
    ADD CONSTRAINT "ComplementoPago_pkey" PRIMARY KEY (id);


--
-- Name: ConfiguracionRestaurante ConfiguracionRestaurante_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ConfiguracionRestaurante"
    ADD CONSTRAINT "ConfiguracionRestaurante_pkey" PRIMARY KEY (id);


--
-- Name: CorteX CorteX_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CorteX"
    ADD CONSTRAINT "CorteX_pkey" PRIMARY KEY (id);


--
-- Name: CorteZ CorteZ_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CorteZ"
    ADD CONSTRAINT "CorteZ_pkey" PRIMARY KEY (id);


--
-- Name: FacturaConcepto FacturaConcepto_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FacturaConcepto"
    ADD CONSTRAINT "FacturaConcepto_pkey" PRIMARY KEY (id);


--
-- Name: Factura Factura_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Factura"
    ADD CONSTRAINT "Factura_pkey" PRIMARY KEY (id);


--
-- Name: ItemModificador ItemModificador_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ItemModificador"
    ADD CONSTRAINT "ItemModificador_pkey" PRIMARY KEY (id);


--
-- Name: Mesa Mesa_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Mesa"
    ADD CONSTRAINT "Mesa_pkey" PRIMARY KEY (id);


--
-- Name: ModificadorCategoria ModificadorCategoria_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ModificadorCategoria"
    ADD CONSTRAINT "ModificadorCategoria_pkey" PRIMARY KEY (id);


--
-- Name: ModificadorProducto ModificadorProducto_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ModificadorProducto"
    ADD CONSTRAINT "ModificadorProducto_pkey" PRIMARY KEY (id);


--
-- Name: Modificador Modificador_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Modificador"
    ADD CONSTRAINT "Modificador_pkey" PRIMARY KEY (id);


--
-- Name: Pago Pago_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Pago"
    ADD CONSTRAINT "Pago_pkey" PRIMARY KEY (id);


--
-- Name: PlantaRestaurante PlantaRestaurante_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlantaRestaurante"
    ADD CONSTRAINT "PlantaRestaurante_pkey" PRIMARY KEY (id);


--
-- Name: Producto Producto_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Producto"
    ADD CONSTRAINT "Producto_pkey" PRIMARY KEY (id);


--
-- Name: Usuario Usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Usuario"
    ADD CONSTRAINT "Usuario_pkey" PRIMARY KEY (id);


--
-- Name: Auditoria_fechaAccion_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Auditoria_fechaAccion_idx" ON public."Auditoria" USING btree ("fechaAccion");


--
-- Name: Auditoria_usuarioId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Auditoria_usuarioId_idx" ON public."Auditoria" USING btree ("usuarioId");


--
-- Name: Categoria_tipo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Categoria_tipo_idx" ON public."Categoria" USING btree (tipo);


--
-- Name: Cliente_rfc_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Cliente_rfc_idx" ON public."Cliente" USING btree (rfc);


--
-- Name: ComandaHistorial_comandaId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ComandaHistorial_comandaId_idx" ON public."ComandaHistorial" USING btree ("comandaId");


--
-- Name: ComandaHistorial_fechaAccion_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ComandaHistorial_fechaAccion_idx" ON public."ComandaHistorial" USING btree ("fechaAccion");


--
-- Name: ComandaItem_comandaId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ComandaItem_comandaId_idx" ON public."ComandaItem" USING btree ("comandaId");


--
-- Name: ComandaItem_destino_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ComandaItem_destino_idx" ON public."ComandaItem" USING btree (destino);


--
-- Name: ComandaItem_estado_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ComandaItem_estado_idx" ON public."ComandaItem" USING btree (estado);


--
-- Name: Comanda_estado_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Comanda_estado_idx" ON public."Comanda" USING btree (estado);


--
-- Name: Comanda_fechaCreacion_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Comanda_fechaCreacion_idx" ON public."Comanda" USING btree ("fechaCreacion");


--
-- Name: Comanda_mesaId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Comanda_mesaId_idx" ON public."Comanda" USING btree ("mesaId");


--
-- Name: Comanda_numeroComanda_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Comanda_numeroComanda_key" ON public."Comanda" USING btree ("numeroComanda");


--
-- Name: ComplementoPago_facturaId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ComplementoPago_facturaId_idx" ON public."ComplementoPago" USING btree ("facturaId");


--
-- Name: ComplementoPago_fechaPago_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ComplementoPago_fechaPago_idx" ON public."ComplementoPago" USING btree ("fechaPago");


--
-- Name: ComplementoPago_uuidDocumento_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ComplementoPago_uuidDocumento_idx" ON public."ComplementoPago" USING btree ("uuidDocumento");


--
-- Name: ConfiguracionRestaurante_rfc_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ConfiguracionRestaurante_rfc_idx" ON public."ConfiguracionRestaurante" USING btree (rfc);


--
-- Name: ConfiguracionRestaurante_rfc_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ConfiguracionRestaurante_rfc_key" ON public."ConfiguracionRestaurante" USING btree (rfc);


--
-- Name: CorteX_fechaHora_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "CorteX_fechaHora_idx" ON public."CorteX" USING btree ("fechaHora");


--
-- Name: CorteX_usuarioId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "CorteX_usuarioId_idx" ON public."CorteX" USING btree ("usuarioId");


--
-- Name: CorteZ_fechaHora_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "CorteZ_fechaHora_idx" ON public."CorteZ" USING btree ("fechaHora");


--
-- Name: CorteZ_usuarioId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "CorteZ_usuarioId_idx" ON public."CorteZ" USING btree ("usuarioId");


--
-- Name: FacturaConcepto_facturaId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "FacturaConcepto_facturaId_idx" ON public."FacturaConcepto" USING btree ("facturaId");


--
-- Name: FacturaConcepto_productoId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "FacturaConcepto_productoId_idx" ON public."FacturaConcepto" USING btree ("productoId");


--
-- Name: Factura_comandaId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Factura_comandaId_idx" ON public."Factura" USING btree ("comandaId");


--
-- Name: Factura_estado_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Factura_estado_idx" ON public."Factura" USING btree (estado);


--
-- Name: Factura_fechaEmision_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Factura_fechaEmision_idx" ON public."Factura" USING btree ("fechaEmision");


--
-- Name: Factura_pagoId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Factura_pagoId_key" ON public."Factura" USING btree ("pagoId");


--
-- Name: Factura_uuid_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Factura_uuid_idx" ON public."Factura" USING btree (uuid);


--
-- Name: Factura_uuid_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Factura_uuid_key" ON public."Factura" USING btree (uuid);


--
-- Name: ItemModificador_comandaItemId_modificadorId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ItemModificador_comandaItemId_modificadorId_key" ON public."ItemModificador" USING btree ("comandaItemId", "modificadorId");


--
-- Name: Mesa_numero_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Mesa_numero_key" ON public."Mesa" USING btree (numero);


--
-- Name: ModificadorCategoria_categoriaId_modificadorId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ModificadorCategoria_categoriaId_modificadorId_key" ON public."ModificadorCategoria" USING btree ("categoriaId", "modificadorId");


--
-- Name: ModificadorProducto_productoId_modificadorId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ModificadorProducto_productoId_modificadorId_key" ON public."ModificadorProducto" USING btree ("productoId", "modificadorId");


--
-- Name: Pago_comandaId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Pago_comandaId_idx" ON public."Pago" USING btree ("comandaId");


--
-- Name: Pago_estado_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Pago_estado_idx" ON public."Pago" USING btree (estado);


--
-- Name: Pago_procesadorId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Pago_procesadorId_idx" ON public."Pago" USING btree ("procesadorId");


--
-- Name: Producto_activo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Producto_activo_idx" ON public."Producto" USING btree (activo);


--
-- Name: Producto_categoriaId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Producto_categoriaId_idx" ON public."Producto" USING btree ("categoriaId");


--
-- Name: Usuario_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Usuario_email_key" ON public."Usuario" USING btree (email);


--
-- Name: Auditoria Auditoria_usuarioId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Auditoria"
    ADD CONSTRAINT "Auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ComandaHistorial ComandaHistorial_comandaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ComandaHistorial"
    ADD CONSTRAINT "ComandaHistorial_comandaId_fkey" FOREIGN KEY ("comandaId") REFERENCES public."Comanda"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ComandaHistorial ComandaHistorial_usuarioId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ComandaHistorial"
    ADD CONSTRAINT "ComandaHistorial_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ComandaItem ComandaItem_comandaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ComandaItem"
    ADD CONSTRAINT "ComandaItem_comandaId_fkey" FOREIGN KEY ("comandaId") REFERENCES public."Comanda"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ComandaItem ComandaItem_productoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ComandaItem"
    ADD CONSTRAINT "ComandaItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES public."Producto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Comanda Comanda_asignadoAId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Comanda"
    ADD CONSTRAINT "Comanda_asignadoAId_fkey" FOREIGN KEY ("asignadoAId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Comanda Comanda_clienteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Comanda"
    ADD CONSTRAINT "Comanda_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES public."Cliente"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Comanda Comanda_creadoPorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Comanda"
    ADD CONSTRAINT "Comanda_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Comanda Comanda_mesaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Comanda"
    ADD CONSTRAINT "Comanda_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES public."Mesa"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ComplementoPago ComplementoPago_facturaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ComplementoPago"
    ADD CONSTRAINT "ComplementoPago_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES public."Factura"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CorteX CorteX_usuarioId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CorteX"
    ADD CONSTRAINT "CorteX_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CorteZ CorteZ_usuarioId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CorteZ"
    ADD CONSTRAINT "CorteZ_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FacturaConcepto FacturaConcepto_facturaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FacturaConcepto"
    ADD CONSTRAINT "FacturaConcepto_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES public."Factura"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FacturaConcepto FacturaConcepto_productoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FacturaConcepto"
    ADD CONSTRAINT "FacturaConcepto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES public."Producto"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Factura Factura_comandaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Factura"
    ADD CONSTRAINT "Factura_comandaId_fkey" FOREIGN KEY ("comandaId") REFERENCES public."Comanda"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Factura Factura_pagoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Factura"
    ADD CONSTRAINT "Factura_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES public."Pago"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ItemModificador ItemModificador_comandaItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ItemModificador"
    ADD CONSTRAINT "ItemModificador_comandaItemId_fkey" FOREIGN KEY ("comandaItemId") REFERENCES public."ComandaItem"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ItemModificador ItemModificador_modificadorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ItemModificador"
    ADD CONSTRAINT "ItemModificador_modificadorId_fkey" FOREIGN KEY ("modificadorId") REFERENCES public."Modificador"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Mesa Mesa_plantaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Mesa"
    ADD CONSTRAINT "Mesa_plantaId_fkey" FOREIGN KEY ("plantaId") REFERENCES public."PlantaRestaurante"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ModificadorCategoria ModificadorCategoria_categoriaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ModificadorCategoria"
    ADD CONSTRAINT "ModificadorCategoria_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES public."Categoria"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ModificadorCategoria ModificadorCategoria_modificadorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ModificadorCategoria"
    ADD CONSTRAINT "ModificadorCategoria_modificadorId_fkey" FOREIGN KEY ("modificadorId") REFERENCES public."Modificador"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ModificadorProducto ModificadorProducto_modificadorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ModificadorProducto"
    ADD CONSTRAINT "ModificadorProducto_modificadorId_fkey" FOREIGN KEY ("modificadorId") REFERENCES public."Modificador"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ModificadorProducto ModificadorProducto_productoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ModificadorProducto"
    ADD CONSTRAINT "ModificadorProducto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES public."Producto"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Pago Pago_comandaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Pago"
    ADD CONSTRAINT "Pago_comandaId_fkey" FOREIGN KEY ("comandaId") REFERENCES public."Comanda"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Producto Producto_categoriaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Producto"
    ADD CONSTRAINT "Producto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES public."Categoria"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict LzXDL2eWE8BJglfWumgQeGfJ3WwQ8X4AD0C6US1amw3POBcNt3xHNL1anOJX88t

