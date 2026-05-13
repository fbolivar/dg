import type {
  Client, User, PracticeArea, Alert, LegalNote, Document,
  ContractReview, DueDiligenceProject, DueDiligenceFinding,
  Matter, MatterEvent, ComplianceDiagnostic, HRTicket
} from '@/shared/types'

export const PRACTICE_AREAS: PracticeArea[] = [
  { id: 'pa1', name: 'Derecho Laboral', code: 'LAB', description: 'Contratación, despidos, negociación colectiva', is_active: true },
  { id: 'pa2', name: 'Compliance y Regulatorio', code: 'COMP', description: 'SAGRILAFT, PTEE, habeas data', is_active: true },
  { id: 'pa3', name: 'Derecho Corporativo', code: 'CORP', description: 'Sociedades, M&A, gobierno corporativo', is_active: true },
  { id: 'pa4', name: 'Contratación Pública', code: 'CPUB', description: 'Licitaciones, contratos estatales', is_active: true },
  { id: 'pa5', name: 'Protección de Datos', code: 'DATA', description: 'Habeas data, Ley 1581', is_active: true },
  { id: 'pa6', name: 'Derecho Inmobiliario', code: 'INM', description: 'Propiedad raíz, arrendamientos', is_active: true },
]

export const USERS: User[] = [
  { id: 'u1', email: 'cgomez@dga.com', full_name: 'Carlos Gómez Vargas', role: 'socio', is_active: true, created_at: '2024-01-15' },
  { id: 'u2', email: 'amartin@dga.com', full_name: 'Ana Martínez Díaz', role: 'asociado', is_active: true, created_at: '2024-03-01' },
  { id: 'u3', email: 'jperez@dga.com', full_name: 'Juan Pérez Torres', role: 'asociado', is_active: true, created_at: '2024-02-10' },
  { id: 'u4', email: 'lrodriguez@dga.com', full_name: 'Laura Rodríguez Silva', role: 'admin', is_active: true, created_at: '2024-01-10' },
  { id: 'c1', email: 'legal@andinaretail.com', full_name: 'Director Legal Andina', role: 'cliente', client_id: 'cl1', is_active: true, created_at: '2024-04-01' },
  { id: 'c2', email: 'legal@bionova.com', full_name: 'Gerente Legal BioNova', role: 'cliente', client_id: 'cl2', is_active: true, created_at: '2024-04-15' },
]

export const CLIENTS: Client[] = [
  { id: 'cl1', name: 'Andina Retail S.A.S.', nit: '900.123.456-7', sector: 'Retail', contact_name: 'María Ospina', contact_email: 'legal@andinaretail.com', assigned_partner: 'u1', risk_level: 'medio', is_active: true, created_at: '2024-01-20', asuntos_activos: 3 },
  { id: 'cl2', name: 'BioNova Colombia S.A.', nit: '800.987.654-3', sector: 'Farmacéutico', contact_name: 'Roberto Henao', contact_email: 'legal@bionova.com', assigned_partner: 'u1', risk_level: 'alto', is_active: true, created_at: '2024-02-01', asuntos_activos: 5 },
  { id: 'cl3', name: 'Infraestructura Capital S.A.S.', nit: '901.234.567-8', sector: 'Construcción', contact_name: 'Felipe Morales', contact_email: 'legal@infracapital.com', assigned_partner: 'u1', risk_level: 'medio', is_active: true, created_at: '2024-02-15', asuntos_activos: 2 },
  { id: 'cl4', name: 'Global Franchise Group Colombia', nit: '800.654.321-9', sector: 'Franquicias', contact_name: 'Diana Castro', contact_email: 'legal@gfgcolombia.com', assigned_partner: 'u1', risk_level: 'bajo', is_active: true, created_at: '2024-03-01', asuntos_activos: 1 },
  { id: 'cl5', name: 'Servicios Industriales del Norte S.A.S.', nit: '901.876.543-2', sector: 'Industrial', contact_name: 'Andrés Vargas', contact_email: 'legal@sinorte.com', assigned_partner: 'u1', risk_level: 'alto', is_active: true, created_at: '2024-03-15', asuntos_activos: 4 },
]

export const ALERTS: Alert[] = [
  {
    id: 'a1', title: 'Nuevo criterio sobre procesos disciplinarios laborales — Circular Min. Trabajo 0042', source: 'Min. Trabajo', source_url: '#', published_at: '2026-05-10', practice_area_id: 'pa1', practice_area: PRACTICE_AREAS[0], impact_level: 'alto', status: 'nueva', assigned_to: 'u2',
    summary: 'El Ministerio del Trabajo emitió la Circular 0042 que establece nuevos criterios para el desarrollo de procesos disciplinarios en el sector privado, exigiendo garantías de defensa adicionales para el trabajador.',
    recommendation: 'Revisar los reglamentos internos de trabajo de todos los clientes con más de 50 empleados. Actualizar los formatos de descargos y citaciones a descargos para incluir el derecho a defensa técnica.',
    clients_affected: ['cl1', 'cl2', 'cl5'], created_at: '2026-05-11'
  },
  {
    id: 'a2', title: 'Actualización de obligaciones SAGRILAFT para sociedades comerciales — Supersociedades 2026', source: 'Supersociedades', source_url: '#', published_at: '2026-05-08', practice_area_id: 'pa2', practice_area: PRACTICE_AREAS[1], impact_level: 'crítico', status: 'en_análisis', assigned_to: 'u2',
    summary: 'Supersociedades actualizó los umbrales de activación del SAGRILAFT para el año 2026 y extendió las obligaciones a nuevos sectores económicos. Las sociedades deben reportar antes del 30 de junio.',
    recommendation: 'Verificar con urgencia los activos e ingresos de todos los clientes para determinar si superan los nuevos umbrales. Iniciar actualización de los programas SAGRILAFT para aquellos que ya estaban obligados.',
    clients_affected: ['cl1', 'cl2', 'cl3', 'cl4', 'cl5'], created_at: '2026-05-09'
  },
  {
    id: 'a3', title: 'Cambio relevante en tratamiento de datos personales para canales digitales — SIC Concepto 2026', source: 'SIC', source_url: '#', published_at: '2026-05-05', practice_area_id: 'pa5', practice_area: PRACTICE_AREAS[4], impact_level: 'alto', status: 'nueva', assigned_to: 'u3',
    summary: 'La SIC emitió concepto que exige actualización de avisos de privacidad para canales digitales e-commerce, incorporando derechos adicionales del titular según las nuevas guías de la autoridad.',
    recommendation: 'Actualizar las políticas de tratamiento de datos y avisos de privacidad en las plataformas digitales de los clientes del sector retail y franquicias.',
    clients_affected: ['cl1', 'cl4'], created_at: '2026-05-06'
  },
  {
    id: 'a4', title: 'Proyecto de decreto sobre contratación pública directa — Colombia Compra Eficiente', source: 'Colombia Compra Eficiente', source_url: '#', published_at: '2026-05-03', practice_area_id: 'pa4', practice_area: PRACTICE_AREAS[3], impact_level: 'medio', status: 'archivada', assigned_to: 'u2',
    summary: 'Colombia Compra Eficiente publicó para comentarios un proyecto de decreto que modifica los montos máximos para contratación directa y simplifica el proceso de selección abreviada.',
    recommendation: 'Monitorear la evolución del decreto y preparar análisis de impacto para clientes con contratos estatales.',
    clients_affected: ['cl3'], created_at: '2026-05-04'
  },
  {
    id: 'a5', title: 'Revisión de criterios UGPP sobre pagos no salariales — Oficio Técnico 2026', source: 'UGPP', source_url: '#', published_at: '2026-04-28', practice_area_id: 'pa1', practice_area: PRACTICE_AREAS[0], impact_level: 'alto', status: 'enviada_cliente', assigned_to: 'u3',
    summary: 'La UGPP precisó en oficio técnico los conceptos que constituyen salario para efectos parafiscales, afectando especialmente los beneficios extralegales y los bonos de productividad.',
    recommendation: 'Revisar la estructura salarial de los clientes industriales y farmacéuticos para verificar correcta calificación de pagos no salariales.',
    clients_affected: ['cl2', 'cl5'], created_at: '2026-04-29'
  },
  {
    id: 'a6', title: 'Sentencia C-218/26 — Corte Constitucional sobre fuero sindical', source: 'Corte Constitucional', source_url: '#', published_at: '2026-04-20', practice_area_id: 'pa1', practice_area: PRACTICE_AREAS[0], impact_level: 'crítico', status: 'en_análisis', assigned_to: 'u2',
    summary: 'La Corte Constitucional amplió el alcance del fuero sindical circunstancial a trabajadores en proceso de constitución de sindicato, generando mayor protección antes de la inscripción formal.',
    recommendation: 'Revisar procesos de terminación de contrato pendientes. Verificar si hay trabajadores en etapas previas de constitución sindical.',
    clients_affected: ['cl1', 'cl2', 'cl5'], created_at: '2026-04-21'
  },
]

export const LEGAL_NOTES: LegalNote[] = [
  {
    id: 'ln1', title: 'Alerta Laboral: Nuevos criterios para procesos disciplinarios', alert_id: 'a1', practice_area_id: 'pa1', practice_area: PRACTICE_AREAS[0], audience: 'área_legal', tone: 'técnico',
    content_draft: `# Alerta Legal N° 2026-LAB-001\n## Nuevos criterios para procesos disciplinarios laborales\n\n**Fuente:** Circular Min. Trabajo 0042 de 2026\n**Fecha:** 10 de mayo de 2026\n\n### Resumen\nEl Ministerio del Trabajo actualizó los criterios para el desarrollo de procesos disciplinarios laborales en el sector privado...\n\n### Impacto\n- Empresas con más de 50 empleados deben revisar sus reglamentos internos\n- Nuevas garantías de defensa técnica\n- Plazos procesales actualizados\n\n### Recomendación DG&A\nRecomendamos revisar los formatos internos y actualizar los procesos dentro de los 30 días siguientes.`,
    status: 'en_revisión', author_id: 'u2', reviewer_id: 'u1', created_at: '2026-05-11', updated_at: '2026-05-12'
  },
  {
    id: 'ln2', title: 'Alerta Crítica Compliance: Actualización SAGRILAFT 2026', alert_id: 'a2', practice_area_id: 'pa2', practice_area: PRACTICE_AREAS[1], audience: 'cumplimiento', tone: 'ejecutivo',
    content_draft: `# Alerta Crítica — SAGRILAFT 2026\n\nEstimados clientes,\n\nSupersociedades actualizó los umbrales de activación del SAGRILAFT para el año 2026...`,
    status: 'borrador_ia', author_id: 'u3', created_at: '2026-05-10', updated_at: '2026-05-10'
  },
  {
    id: 'ln3', title: 'Boletín: Tratamiento de datos en e-commerce', alert_id: 'a3', practice_area_id: 'pa5', practice_area: PRACTICE_AREAS[4], audience: 'gerencia_financiera', tone: 'preventivo',
    content_draft: `# Boletín Legal — Datos Personales en Canales Digitales\n\nLa SIC estableció nuevas exigencias para e-commerce...`,
    status: 'aprobado', author_id: 'u2', reviewer_id: 'u1', approved_by: 'u1', approved_at: '2026-05-08', created_at: '2026-05-07', updated_at: '2026-05-08'
  },
  {
    id: 'ln4', title: 'Circular UGPP: Revisión de pagos no salariales', alert_id: 'a5', practice_area_id: 'pa1', practice_area: PRACTICE_AREAS[0], audience: 'rrhh', tone: 'técnico',
    status: 'publicado', author_id: 'u3', reviewer_id: 'u1', approved_by: 'u1', approved_at: '2026-05-02', created_at: '2026-04-30', updated_at: '2026-05-02'
  },
]

export const DOCUMENTS: Document[] = [
  { id: 'd1', name: 'Contrato de distribución comercial — Andina Retail S.A.S.', type: 'distribucion', client_id: 'cl1', client: CLIENTS[0], practice_area_id: 'pa3', status: 'en_revisión', uploaded_by: 'c1', created_at: '2026-05-08' },
  { id: 'd2', name: 'Política de tratamiento de datos personales — BioNova Colombia', type: 'habeas_data', client_id: 'cl2', client: CLIENTS[1], practice_area_id: 'pa5', status: 'pendiente', uploaded_by: 'c2', created_at: '2026-05-09' },
  { id: 'd3', name: 'Manual SAGRILAFT 2025 — Global Franchise Group', type: 'sagrilaft', client_id: 'cl4', client: CLIENTS[3], practice_area_id: 'pa2', status: 'revisado', uploaded_by: 'u2', reviewed_by: 'u1', created_at: '2026-04-20' },
  { id: 'd4', name: 'Contrato laboral de dirección y confianza — Infraestructura Capital', type: 'contrato_laboral', client_id: 'cl3', client: CLIENTS[2], practice_area_id: 'pa1', status: 'aprobado', uploaded_by: 'u3', reviewed_by: 'u2', created_at: '2026-04-15' },
  { id: 'd5', name: 'Informe de due diligence societario — BioNova Colombia S.A.', type: 'societario', client_id: 'cl2', client: CLIENTS[1], practice_area_id: 'pa3', status: 'pendiente', uploaded_by: 'u2', created_at: '2026-05-01' },
  { id: 'd6', name: 'Acuerdo de Confidencialidad — Servicios Industriales del Norte', type: 'nda', client_id: 'cl5', client: CLIENTS[4], practice_area_id: 'pa3', status: 'pendiente', uploaded_by: 'u3', created_at: '2026-05-12' },
]

export const CONTRACT_REVIEWS: ContractReview[] = [
  {
    id: 'cr1', document_id: 'd1', document: DOCUMENTS[0],
    parties: 'Andina Retail S.A.S. (distribuidor exclusivo) y Productos Continental S.A. (proveedor)',
    object: 'Distribución exclusiva de la línea de productos Continental en la región Bogotá y Cundinamarca por un período de 3 años.',
    obligations: 'Andina: adquirir mínimo $5.000M COP anuales, mantener inventario mínimo de 60 días, reportes mensuales de ventas. Continental: suministro oportuno, soporte comercial, exclusividad territorial.',
    deadlines: 'Renovación automática anual salvo aviso 90 días antes. Mínimos de compra revisables cada 12 meses.',
    critical_dates: '30/06/2026: primer corte de revisión de mínimos. 30/09/2026: opción de renovación/terminación.',
    risks: [
      { clausula: 'Cláusula 8 — Exclusividad', riesgo: 'La cláusula de exclusividad no delimita el territorio con precisión, lo que podría generar conflictos con distribuidores de otras regiones', severidad: 'alto', recomendacion: 'Definir el territorio con coordenadas o listado de municipios', responsable: 'Andina Retail', estado: 'pendiente' },
      { clausula: 'Cláusula 12 — Penalidades', riesgo: 'Las penalidades por incumplimiento de mínimos son desproporcionadas (30% del mínimo anual) y podrían considerarse abusivas', severidad: 'medio', recomendacion: 'Negociar reducción al 10% y establecer cláusula de fuerza mayor', responsable: 'DG&A / Andina', estado: 'en_negociacion' },
      { clausula: 'Cláusula 15 — Terminación', riesgo: 'Falta cláusula de terminación por justa causa sin previo aviso en casos de incumplimiento grave', severidad: 'medio', recomendacion: 'Incluir causales de terminación inmediata', responsable: 'DG&A', estado: 'pendiente' },
      { clausula: 'Cláusula 18 — Propiedad intelectual', riesgo: 'No se establece con claridad la propiedad del material de merchandising desarrollado por Andina', severidad: 'bajo', recomendacion: 'Agregar cláusula de PI sobre materiales promocionales', responsable: 'Andina Retail', estado: 'pendiente' },
    ],
    omissions: '1. Falta cláusula de tratamiento de datos personales de los clientes finales. 2. No hay protocolo de devoluciones de producto. 3. Ausencia de mecanismo de resolución de conflictos (arbitraje vs. litigio).',
    recommendations: 'Renegociar las cláusulas 8, 12 y 15 antes de la firma definitiva. Agregar apéndice de tratamiento de datos. Considerar cláusula compromisoria.',
    client_questions: '¿Ha habido conflictos previos con distribuidores de otras regiones? ¿Continental tiene contratos similares con otros distribuidores que puedan crear competencia indirecta?',
    status: 'borrador_ia', created_at: '2026-05-09'
  },
]

export const DUE_DILIGENCE_PROJECTS: DueDiligenceProject[] = [
  {
    id: 'dd1', client_id: 'cl2', client: CLIENTS[1], name: 'Due Diligence Societario — Adquisición Laboratorios Bernal S.A.', type: 'mna', status: 'activo', lead_partner: 'u1', lead_user: USERS[0],
    risk_summary: 'Riesgo moderado-alto. Se identificaron contingencias laborales significativas y un proceso tributario en curso ante la DIAN.',
    created_at: '2026-04-15', updated_at: '2026-05-12', findings_count: 14, critical_count: 3
  },
  {
    id: 'dd2', client_id: 'cl3', client: CLIENTS[2], name: 'Due Diligence Inmobiliario — Lote Zona Industrial Yumbo', type: 'inmobiliario', status: 'en_pausa', lead_partner: 'u1',
    risk_summary: 'Pendiente respuesta de Catastro Departamental y verificación de cargas.',
    created_at: '2026-03-20', updated_at: '2026-04-30', findings_count: 6, critical_count: 1
  },
]

export const DUE_DILIGENCE_FINDINGS: DueDiligenceFinding[] = [
  { id: 'ddf1', project_id: 'dd1', category: 'laboral', title: 'Demandas laborales activas por prima extralegal no pagada', description: 'Se identificaron 12 demandas laborales activas ante el Juzgado 5 Laboral del Circuito por concepto de prima extralegal estipulada en contratos individuales firmados entre 2018-2020.', severity: 'alto', status: 'validado_asociado', assigned_to: 'u2', created_at: '2026-04-20' },
  { id: 'ddf2', project_id: 'dd1', category: 'tributario', title: 'Proceso de fiscalización DIAN — IVA 2022-2023', description: 'La DIAN tiene abierto proceso de fiscalización por IVA de los períodos 2022-2023. Valor discutido estimado: $850M COP.', severity: 'crítico', status: 'requiere_socio', assigned_to: 'u2', created_at: '2026-04-22' },
  { id: 'ddf3', project_id: 'dd1', category: 'societario', title: 'Accionistas minoritarios sin acuerdo de accionistas vigente', description: 'Existen 3 accionistas minoritarios (total 22%) sin acuerdo de accionistas vigente, lo que genera riesgo de bloqueo en decisiones.', severity: 'medio', status: 'pendiente', assigned_to: 'u3', created_at: '2026-04-25' },
  { id: 'ddf4', project_id: 'dd1', category: 'contratos', title: 'Contrato de suministro con vigencia indefinida sin cláusula de terminación', description: 'El principal contrato de suministro de materias primas tiene vigencia indefinida sin cláusula de terminación unilateral, lo que podría limitar la reestructuración post-adquisición.', severity: 'alto', status: 'en_informe', assigned_to: 'u2', created_at: '2026-04-28' },
  { id: 'ddf5', project_id: 'dd1', category: 'datos_personales', title: 'Ausencia de programa formal de protección de datos personales', description: 'No se encontró evidencia de política de tratamiento de datos registrada ante la SIC ni de responsable de protección de datos designado.', severity: 'crítico', status: 'validado_asociado', assigned_to: 'u3', created_at: '2026-05-01' },
  { id: 'ddf6', project_id: 'dd2', category: 'inmobiliario', title: 'Carga hipotecaria no revelada en folio de matrícula', description: 'El folio de matrícula inmobiliaria N° 375-15432 presenta carga hipotecaria en favor del Banco de Bogotá por $2.100M COP no revelada en la oferta inicial.', severity: 'crítico', status: 'requiere_socio', assigned_to: 'u2', created_at: '2026-04-10' },
]

export const MATTERS: Matter[] = [
  { id: 'm1', client_id: 'cl1', client: CLIENTS[0], practice_area_id: 'pa1', practice_area: PRACTICE_AREAS[0], title: 'Demanda laboral — Ospina vs. Andina Retail', type: 'litigio', jurisdiction: 'Juzgado 3 Laboral del Circuito de Bogotá', parties: 'Jorge Ospina Reyes vs. Andina Retail S.A.S.', process_state: 'Audiencia de trámite programada', estimated_risk: '$85M COP', success_probability: 70, next_action: 'Preparar alegatos de conclusión', next_deadline: '2026-06-15', status: 'activo', assigned_to: 'u3', assigned_user: USERS[2], created_at: '2025-11-10', updated_at: '2026-05-10' },
  { id: 'm2', client_id: 'cl2', client: CLIENTS[1], practice_area_id: 'pa2', practice_area: PRACTICE_AREAS[1], title: 'Implementación SAGRILAFT 2026 — BioNova', type: 'compliance', process_state: 'Etapa de diagnóstico completada', estimated_risk: 'Multa potencial $200M COP', next_action: 'Entregar manual actualizado', next_deadline: '2026-06-30', status: 'activo', assigned_to: 'u2', assigned_user: USERS[1], created_at: '2026-03-01', updated_at: '2026-05-08' },
  { id: 'm3', client_id: 'cl5', client: CLIENTS[4], practice_area_id: 'pa1', practice_area: PRACTICE_AREAS[0], title: 'Reestructuración de planta — Servicios Industriales del Norte', type: 'consultoría', process_state: 'Análisis de viabilidad jurídica', estimated_risk: 'Bajo — si se sigue el protocolo', success_probability: 90, next_action: 'Presentar plan de liquidación a la gerencia', next_deadline: '2026-05-30', status: 'activo', assigned_to: 'u2', assigned_user: USERS[1], created_at: '2026-04-10', updated_at: '2026-05-05' },
  { id: 'm4', client_id: 'cl3', client: CLIENTS[2], practice_area_id: 'pa6', practice_area: PRACTICE_AREAS[5], title: 'Revisión contratos arrendamiento — Infraestructura Capital', type: 'transaccional', process_state: 'Revisión de documentos', next_action: 'Enviar informe de hallazgos al cliente', next_deadline: '2026-05-25', status: 'activo', assigned_to: 'u3', assigned_user: USERS[2], created_at: '2026-04-20', updated_at: '2026-05-01' },
  { id: 'm5', client_id: 'cl4', client: CLIENTS[3], practice_area_id: 'pa3', practice_area: PRACTICE_AREAS[2], title: 'Constitución sociedad subsidiaria — Global Franchise', type: 'transaccional', process_state: 'Documentos en Cámara de Comercio', success_probability: 95, next_action: 'Retirar escritura registrada', next_deadline: '2026-05-20', status: 'activo', assigned_to: 'u2', assigned_user: USERS[1], created_at: '2026-05-01', updated_at: '2026-05-12' },
]

export const MATTER_EVENTS: MatterEvent[] = [
  { id: 'me1', matter_id: 'm1', event_date: '2025-11-10', event_type: 'Radicación de demanda', description: 'Se radica demanda laboral ante el Juzgado 3 Laboral del Circuito de Bogotá por despido sin justa causa y prestaciones sociales.', created_by: 'u3', created_at: '2025-11-10' },
  { id: 'me2', matter_id: 'm1', event_date: '2025-12-05', event_type: 'Notificación al demandado', description: 'Andina Retail S.A.S. notificada. Se remiten documentos al cliente para preparación de la contestación.', created_by: 'u3', created_at: '2025-12-05' },
  { id: 'me3', matter_id: 'm1', event_date: '2026-01-15', event_type: 'Contestación de demanda', description: 'Se presentó contestación de demanda con excepciones de mérito. Se aportaron pruebas documentales.', created_by: 'u3', created_at: '2026-01-15' },
  { id: 'me4', matter_id: 'm1', event_date: '2026-03-20', event_type: 'Audiencia de conciliación', description: 'Conciliación fallida. El demandante no aceptó la oferta de $45M COP. El proceso continúa.', created_by: 'u3', created_at: '2026-03-20' },
  { id: 'me5', matter_id: 'm1', event_date: '2026-05-10', event_type: 'Decreto de pruebas', description: 'El juzgado decretó pruebas testimoniales y documentales. Próxima audiencia el 15 de junio de 2026.', created_by: 'u3', created_at: '2026-05-10' },
]

export const COMPLIANCE_DIAGNOSTICS: ComplianceDiagnostic[] = [
  { id: 'cd1', client_id: 'cl2', client: CLIENTS[1], type: 'sagrilaft', implementation_status: 'en_progreso', completion_pct: 65, assigned_to: 'u2', last_review: '2026-04-30', created_at: '2026-01-15' },
  { id: 'cd2', client_id: 'cl4', client: CLIENTS[3], type: 'sagrilaft', implementation_status: 'completado', completion_pct: 100, assigned_to: 'u3', last_review: '2026-03-10', created_at: '2025-10-01' },
  { id: 'cd3', client_id: 'cl1', client: CLIENTS[0], type: 'habeas_data', implementation_status: 'en_progreso', completion_pct: 45, assigned_to: 'u3', last_review: '2026-04-15', created_at: '2026-02-01' },
  { id: 'cd4', client_id: 'cl5', client: CLIENTS[4], type: 'ptee', implementation_status: 'no_iniciado', completion_pct: 0, assigned_to: 'u2', created_at: '2026-05-01' },
  { id: 'cd5', client_id: 'cl2', client: CLIENTS[1], type: 'habeas_data', implementation_status: 'en_progreso', completion_pct: 30, assigned_to: 'u2', last_review: '2026-05-01', created_at: '2026-03-01' },
]

export const HR_TICKETS: HRTicket[] = [
  { id: 'hr1', client_id: 'cl1', client: CLIENTS[0], topic: 'Terminación de contrato', question: '¿Podemos terminar el contrato a término indefinido de un trabajador con más de 10 años de antigüedad que ha tenido bajo rendimiento crónico?', ai_response: 'Para terminar un contrato con justa causa por bajo rendimiento, es necesario seguir un proceso disciplinario formal que incluya: (1) citación a descargos, (2) presentación de cargos con evidencias documentadas, (3) valoración de descargos, (4) decisión sancionatoria con recursos. Dado que el trabajador tiene más de 10 años de antigüedad, el proceso debe ser especialmente riguroso...', status: 'respondido', sensitivity_flag: true, assigned_to: 'u2', created_at: '2026-05-09' },
  { id: 'hr2', client_id: 'cl5', client: CLIENTS[4], topic: 'Incapacidades médicas', question: '¿Cuál es el procedimiento para manejar un trabajador con incapacidades médicas repetitivas que superan los 180 días?', ai_response: 'Cuando las incapacidades médicas superan 180 días continuos o discontinuos, la normativa colombiana establece...', status: 'abierto', sensitivity_flag: false, assigned_to: 'u3', created_at: '2026-05-11' },
  { id: 'hr3', client_id: 'cl2', client: CLIENTS[1], topic: 'Negociación colectiva', question: '¿Tenemos obligación de negociar un pliego de peticiones presentado por un sindicato que representa menos del 10% de la plantilla?', status: 'en_revisión', sensitivity_flag: true, assigned_to: 'u1', created_at: '2026-05-12' },
]

export const DASHBOARD_STATS = {
  alertas_nuevas: ALERTS.filter(a => a.status === 'nueva').length,
  documentos_pendientes: DOCUMENTS.filter(d => d.status === 'pendiente').length,
  aprobaciones_pendientes: LEGAL_NOTES.filter(n => n.status === 'en_revisión').length,
  asuntos_activos: MATTERS.filter(m => m.status === 'activo').length,
  notas_borrador: LEGAL_NOTES.filter(n => n.status === 'borrador_ia').length,
  horas_ahorradas_estimadas: 47,
  clientes_activos: CLIENTS.filter(c => c.is_active).length,
}
