/**
 * Catálogos oficiales del SAT para CFDI 4.0
 * Estos catálogos deben mantenerse actualizados según la RMF vigente
 */

export interface CatalogoItem {
  clave: string
  descripcion: string
}

/**
 * Catálogo c_RegimenFiscal - Régimen Fiscal
 * Catálogo completo del SAT
 */
export const REGIMENES_FISCALES: CatalogoItem[] = [
  { clave: '601', descripcion: 'General de Ley Personas Morales' },
  { clave: '603', descripcion: 'Personas Físicas con Actividades Empresariales y Profesionales' },
  { clave: '605', descripcion: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { clave: '606', descripcion: 'Arrendamiento' },
  { clave: '608', descripcion: 'Demás ingresos' },
  { clave: '610', descripcion: 'Residentes en el Extranjero sin Establecimiento Permanente en México' },
  { clave: '611', descripcion: 'Ingresos por Dividendos (socios y accionistas)' },
  { clave: '612', descripcion: 'Personas Físicas con Actividades Empresariales y Profesionales' },
  { clave: '614', descripcion: 'Ingresos por intereses' },
  { clave: '615', descripcion: 'Régimen de los ingresos por obtención de premios' },
  { clave: '616', descripcion: 'Sin obligaciones fiscales' },
  { clave: '620', descripcion: 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos' },
  { clave: '621', descripcion: 'Incorporación Fiscal' },
  { clave: '622', descripcion: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
  { clave: '623', descripcion: 'Opcional para Grupos de Sociedades' },
  { clave: '624', descripcion: 'Coordinados' },
  { clave: '625', descripcion: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
  { clave: '626', descripcion: 'Régimen Simplificado de Confianza' },
]

/**
 * Catálogo c_UsoCFDI - Uso del CFDI
 */
export const USOS_CFDI: CatalogoItem[] = [
  { clave: 'G01', descripcion: 'Adquisición de mercancías' },
  { clave: 'G02', descripcion: 'Devoluciones, descuentos o bonificaciones' },
  { clave: 'G03', descripcion: 'Gastos en general' },
  { clave: 'I01', descripcion: 'Construcciones' },
  { clave: 'I02', descripcion: 'Mobilario y equipo de oficina por inversiones' },
  { clave: 'I03', descripcion: 'Equipo de transporte' },
  { clave: 'I04', descripcion: 'Equipo de computo y accesorios' },
  { clave: 'I05', descripcion: 'Dados, troqueles, moldes, matrices y herramental' },
  { clave: 'I06', descripcion: 'Comunicaciones telefónicas' },
  { clave: 'I07', descripcion: 'Comunicaciones satelitales' },
  { clave: 'I08', descripcion: 'Otra maquinaria y equipo' },
  { clave: 'D01', descripcion: 'Honorarios médicos, dentales y gastos hospitalarios' },
  { clave: 'D02', descripcion: 'Gastos médicos por incapacidad o discapacidad' },
  { clave: 'D03', descripcion: 'Gastos funerales' },
  { clave: 'D04', descripcion: 'Donativos' },
  { clave: 'D05', descripcion: 'Intereses reales efectivamente pagados por créditos hipotecarios (casa habitación)' },
  { clave: 'D06', descripcion: 'Aportaciones voluntarias al SAR' },
  { clave: 'D07', descripcion: 'Primas por seguros de gastos médicos' },
  { clave: 'D08', descripcion: 'Gastos de transportación escolar obligatoria' },
  { clave: 'D09', descripcion: 'Depósitos en cuentas para el ahorro, primas que tengan como base planes de pensiones' },
  { clave: 'D10', descripcion: 'Pagos por servicios educativos (colegiaturas)' },
  { clave: 'P01', descripcion: 'Por definir' },
  { clave: 'CP01', descripcion: 'Pagos' },
  { clave: 'CN01', descripcion: 'Nómina' },
  { clave: 'S01', descripcion: 'Sin efectos fiscales' },
]

/**
 * Catálogo c_ClaveProdServ - Clave de Producto o Servicio
 * Catálogo completo del SAT (se muestran las más comunes para restaurantes)
 */
export const CLAVES_PROD_SERV: CatalogoItem[] = [
  { clave: '50171600', descripcion: 'Servicios de restaurantes y bares' },
  { clave: '50201703', descripcion: 'Alimentos preparados' },
  { clave: '50201704', descripcion: 'Bebidas alcohólicas' },
  { clave: '50201705', descripcion: 'Bebidas no alcohólicas' },
  { clave: '50201706', descripcion: 'Postres y dulces' },
  { clave: '50201707', descripcion: 'Aperitivos y botanas' },
  { clave: '50201708', descripcion: 'Sopas y caldos' },
  { clave: '50201709', descripcion: 'Ensaladas' },
  { clave: '50201710', descripcion: 'Platos principales' },
  { clave: '50201711', descripcion: 'Platos vegetarianos' },
  { clave: '50201712', descripcion: 'Platos para niños' },
  { clave: '50201713', descripcion: 'Desayunos' },
  { clave: '50201714', descripcion: 'Comidas' },
  { clave: '50201715', descripcion: 'Cenas' },
  { clave: '50201716', descripcion: 'Buffets' },
  { clave: '50201717', descripcion: 'Menús del día' },
  { clave: '50201718', descripcion: 'Servicio de banquetes' },
  { clave: '50201719', descripcion: 'Servicio de catering' },
  { clave: '50201720', descripcion: 'Servicio a domicilio' },
]

/**
 * Catálogo c_ClaveUnidad - Clave de Unidad de Medida
 */
export const CLAVES_UNIDAD: CatalogoItem[] = [
  { clave: 'H87', descripcion: 'Pieza' },
  { clave: 'MTR', descripcion: 'Metro' },
  { clave: 'KGM', descripcion: 'Kilogramo' },
  { clave: 'LTR', descripcion: 'Litro' },
  { clave: 'GRM', descripcion: 'Gramo' },
  { clave: 'MLT', descripcion: 'Mililitro' },
  { clave: 'TNE', descripcion: 'Tonelada' },
  { clave: 'MTK', descripcion: 'Metro cuadrado' },
  { clave: 'MTQ', descripcion: 'Metro cúbico' },
  { clave: 'C62', descripcion: 'Unidad de servicio' },
  { clave: 'E48', descripcion: 'Unidad de servicio' },
  { clave: 'ACT', descripcion: 'Actividad' },
  { clave: 'C81', descripcion: 'Ración' },
  { clave: 'XBX', descripcion: 'Caja' },
]

/**
 * Catálogo c_FormaPago - Forma de Pago
 */
export const FORMAS_PAGO: CatalogoItem[] = [
  { clave: '01', descripcion: 'Efectivo' },
  { clave: '02', descripcion: 'Cheque nominativo' },
  { clave: '03', descripcion: 'Transferencia electrónica de fondos' },
  { clave: '04', descripcion: 'Tarjeta de crédito' },
  { clave: '05', descripcion: 'Monedero electrónico' },
  { clave: '06', descripcion: 'Dinero electrónico' },
  { clave: '08', descripcion: 'Vales de despensa' },
  { clave: '12', descripcion: 'Dación en pago' },
  { clave: '13', descripcion: 'Pago por subrogación' },
  { clave: '14', descripcion: 'Pago por consignación' },
  { clave: '15', descripcion: 'Condonación' },
  { clave: '17', descripcion: 'Compensación' },
  { clave: '23', descripcion: 'Novación' },
  { clave: '24', descripcion: 'Confusión' },
  { clave: '25', descripcion: 'Remisión de deuda' },
  { clave: '26', descripcion: 'Prescripción o caducidad' },
  { clave: '27', descripcion: 'A satisfacción del acreedor' },
  { clave: '28', descripcion: 'Tarjeta de débito' },
  { clave: '29', descripcion: 'Tarjeta de servicios' },
  { clave: '30', descripcion: 'Aplicación de anticipos' },
  { clave: '31', descripcion: 'Intermediario pagos' },
  { clave: '99', descripcion: 'Por definir' },
]

/**
 * Catálogo c_MetodoPago - Método de Pago
 */
export const METODOS_PAGO: CatalogoItem[] = [
  { clave: 'PUE', descripcion: 'Pago en una exhibición' },
  { clave: 'PPD', descripcion: 'Pago en parcialidades o diferido' },
]

/**
 * Catálogo de Periodicidad para Factura Global
 */
export const PERIODICIDADES: CatalogoItem[] = [
  { clave: '01', descripcion: 'Diario' },
  { clave: '02', descripcion: 'Semanal' },
  { clave: '03', descripcion: 'Quincenal' },
  { clave: '04', descripcion: 'Mensual' },
  { clave: '05', descripcion: 'Bimestral' },
]

/**
 * Tipos de Comprobante
 */
export const TIPOS_COMPROBANTE: CatalogoItem[] = [
  { clave: 'I', descripcion: 'Ingreso' },
  { clave: 'E', descripcion: 'Egreso' },
  { clave: 'T', descripcion: 'Traslado' },
  { clave: 'N', descripcion: 'Nómina' },
  { clave: 'P', descripcion: 'Pago' },
]

/**
 * Exportación
 */
export const EXPORTACION: CatalogoItem[] = [
  { clave: '01', descripcion: 'No aplica' },
  { clave: '02', descripcion: 'Definitiva' },
  { clave: '03', descripcion: 'Temporal' },
]

/**
 * Monedas comunes
 */
export const MONEDAS: CatalogoItem[] = [
  { clave: 'MXN', descripcion: 'Peso Mexicano' },
  { clave: 'USD', descripcion: 'Dólar Estadounidense' },
  { clave: 'EUR', descripcion: 'Euro' },
]

/**
 * Catálogo c_ObjetoImp - Objeto de Impuesto
 * Define si el concepto causa o no impuestos
 */
export const OBJETOS_IMP: CatalogoItem[] = [
  { clave: '01', descripcion: 'No objeto de impuesto' },
  { clave: '02', descripcion: 'Sí objeto de impuesto' },
  { clave: '03', descripcion: 'Sí objeto de impuesto pero no causa (exento)' },
  { clave: '04', descripcion: 'Sí objeto de impuesto pero exento' },
]

/**
 * Motivos de Cancelación SAT
 */
export const MOTIVOS_CANCELACION: CatalogoItem[] = [
  { clave: '01', descripcion: 'Comprobante emitido con errores con relación' },
  { clave: '02', descripcion: 'Comprobante emitido con errores sin relación' },
  { clave: '03', descripcion: 'No se llevó a cabo la operación' },
  { clave: '04', descripcion: 'Operación nominativa relacionada en factura global' },
]

/**
 * Helper para buscar un item en un catálogo
 */
export function buscarEnCatalogo(catalogo: CatalogoItem[], clave: string): CatalogoItem | undefined {
  return catalogo.find(item => item.clave === clave)
}

/**
 * Helper para obtener la descripción de una clave
 */
export function obtenerDescripcion(catalogo: CatalogoItem[], clave: string): string {
  const item = buscarEnCatalogo(catalogo, clave)
  return item?.descripcion || clave
}
