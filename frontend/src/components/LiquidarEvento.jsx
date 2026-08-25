import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Calendar, Save, FileText, Upload, DollarSign, CheckCircle, Plus, X, Eye, EyeOff, Settings, Search, Download } from 'lucide-react';
import FileUploader from './FileUploader';
import MultiFileUploader from './MultiFileUploader';
import DescuentosResumenModal from './DescuentosResumenModal';
import Notification from './Notification';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function LiquidarEvento({ eventos, musicos, selectedEvento, setSelectedEvento, onPlanillaGuardada }) {
  const [datosMusicos, setDatosMusicos] = useState({});
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLiquidado, setIsLiquidado] = useState(false);
  const [liquidacionInfo, setLiquidacionInfo] = useState(null);
  const [musicosYaPagados, setMusicosYaPagados] = useState([]);
  
  const [columnasExtra, setColumnasExtra] = useState([]);
  const [showModalColumna, setShowModalColumna] = useState(false);
  const [nuevaColumna, setNuevaColumna] = useState({ nombre: '', monto: '', aplicarA: 'TODOS', seccion: 'TROMPETAS', musico_id: '' });

  const [pdfMultasFile, setPdfMultasFile] = useState(null);
  const [isPdfMultasProcessing, setIsPdfMultasProcessing] = useState(false);

  const [pdfAdelantosFile, setPdfAdelantosFile] = useState(null);
  const [isPdfAdelantosProcessing, setIsPdfAdelantosProcessing] = useState(false);

  const [notification, setNotification] = useState(null);
  const [clearMultasFile, setClearMultasFile] = useState(false);
  const [clearAdelantosFile, setClearAdelantosFile] = useState(false);

  // Estados para procesamiento batch de descuentos por sección
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [showResumenModal, setShowResumenModal] = useState(false);
  const [detalleMusicoModal, setDetalleMusicoModal] = useState(null);
  const [resultadosProcesamiento, setResultadosProcesamiento] = useState([]);
  const [totalGeneralDescuentos, setTotalGeneralDescuentos] = useState(0);
  const [showUploadPanel, setShowUploadPanel] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadWarnings, setUploadWarnings] = useState([]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const normalizeSection = (section) => {
    if (!section) return '';
    return section.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  };

  const sectionMatchesInstrument = (section, instrumento) => {
    if (!section) return true;
    const normalized = normalizeSection(section);
    const inst = instrumento?.toUpperCase() || '';
    if (!inst) return false;
    if (normalized.includes('TROMPETA')) return inst === 'TROMPETA';
    if (normalized.includes('CLARINETE')) return inst === 'CLARINETE';
    if (normalized.includes('SAXO') || normalized.includes('SAXOFON')) return inst === 'SAXOFON';
    if (normalized.includes('BARITONO')) return inst === 'BARITONO';
    if (normalized.includes('TROMBON')) return inst === 'TROMBON';
    if (normalized.includes('TUBA')) return inst === 'TUBA';
    if (normalized.includes('BOMBO')) return inst === 'BOMBO';
    if (normalized.includes('TAMBOR')) return inst === 'TAMBOR';
    if (normalized.includes('PLATILLOS')) return inst === 'PLATILLOS';
    if (normalized.includes('PERCUSION')) return inst === 'PERCUSION';
    if (normalized.includes('OTRO')) return !['TROMPETA', 'CLARINETE', 'SAXOFON', 'BARITONO', 'TROMBON', 'TUBA', 'BOMBO', 'TAMBOR', 'PLATILLOS', 'PERCUSION'].includes(inst);
    return true;
  };

  const inferSeccionFromFilename = (fileName) => {
    const normalized = normalizeSection(fileName);
    if (normalized.includes('TROMPETA')) return 'TROMPETA';
    if (normalized.includes('CLARINETE')) return 'CLARINETE';
    if (normalized.includes('SAXO') || normalized.includes('SAXOFON')) return 'SAXOFON';
    if (normalized.includes('BARITONO')) return 'BARITONO';
    if (normalized.includes('TROMBON')) return 'TROMBON';
    if (normalized.includes('TUBA')) return 'TUBA';
    if (normalized.includes('BOMBO')) return 'BOMBO';
    if (normalized.includes('TAMBOR')) return 'TAMBOR';
    if (normalized.includes('PLATILLOS')) return 'PLATILLOS';
    if (normalized.includes('PERCUSION')) return 'PERCUSION';
    return 'OTRO';
  };

  const [deudas, setDeudas] = useState([]);

  useEffect(() => {
    api.get('/deudas/')
      .then(res => setDeudas(res.data.filter(d => d.estado === 'PENDIENTE')))
      .catch(err => console.error("Error cargando deudas", err));
  }, []);

  const [musicosPagados, setMusicosPagados] = useState({});
  const [musicoSeleccionadoParaPago, setMusicoSeleccionadoParaPago] = useState(null);

  const getPersistKey = (eventoId) => `liquidacion_${eventoId}`;

  const restorePersistedState = (eventoId) => {
    if (!eventoId) return null;
    try {
      const persisted = window.localStorage.getItem(getPersistKey(eventoId));
      if (!persisted) return null;
      const parsed = JSON.parse(persisted);
      // Limpiar multas/adelantos del localStorage — siempre vienen frescos del API
      if (parsed && parsed.datosMusicos) {
        Object.keys(parsed.datosMusicos).forEach(id => {
          delete parsed.datosMusicos[id].multas;
          delete parsed.datosMusicos[id].adelantos;
        });
      }
      return parsed;
    } catch (err) {
      console.error('Error restaurando estado de liquidación', err);
      return null;
    }
  };


  const persistCurrentState = (eventoId, state) => {
    if (!eventoId) return;
    try {
      window.localStorage.setItem(getPersistKey(eventoId), JSON.stringify(state));
    } catch (err) {
      console.error('Error guardando estado de liquidación', err);
    }
  };

  useEffect(() => {
    if (!selectedEvento) {
      setDatosMusicos({});
      setMusicosPagados({});
      setColumnasExtra([]);
      return;
    }

    const initEvento = async (eventoId) => {
      // 1. Construir estado base con todos los musicos convocados
      const evento = eventos.find(e => e.id == eventoId);
      const convocadosIds = evento ? evento.convocados : [];
      const baseDatos = {};
      const pagadosInicial = {};

      musicos.filter(m => convocadosIds.includes(m.id)).forEach(musico => {
        baseDatos[musico.id] = { acordado: '', multas: '', adelantos: '' };
        pagadosInicial[musico.id] = false;
      });

      // 2. Recuperar datos persistidos (solo para acordado, columnas extra y estado pagado)
      //    NUNCA usamos el localStorage para multas/adelantos — esos vienen frescos del API
      const restored = restorePersistedState(eventoId);
      if (restored && restored.datosMusicos) {
        Object.keys(baseDatos).forEach(musicoId => {
          const persisted = restored.datosMusicos[musicoId];
          if (persisted) {
            // Solo restauramos 'acordado' y las columnas extra del localStorage
            baseDatos[musicoId].acordado = persisted.acordado || '';
            // Copiar columnas extra si existen
            Object.keys(persisted).forEach(key => {
              if (key !== 'acordado' && key !== 'multas' && key !== 'adelantos') {
                baseDatos[musicoId][key] = persisted[key];
              }
            });
          }
        });
        if (restored.musicosPagados) {
          Object.assign(pagadosInicial, restored.musicosPagados);
        }
        if (restored.columnasExtra) {
          setColumnasExtra(restored.columnasExtra);
        } else {
          setColumnasExtra([]);
        }
        if (restored.uploadWarnings) {
          setUploadWarnings(restored.uploadWarnings);
        } else {
          setUploadWarnings([]);
        }
      } else {
        setColumnasExtra([]);
        setUploadWarnings([]);
      }

      // 3. Establecer el estado base ANTES de llamar al API
      setDatosMusicos(baseDatos);
      setMusicosPagados(pagadosInicial);
      setPdfMultasFile(null);
      setPdfAdelantosFile(null);
      setIsLiquidado(false);
      setLiquidacionInfo(null);
      setMusicosYaPagados([]);

      // 4. Cargar datos frescos del API (multas y adelantos SIEMPRE desde el servidor)
      try {
        const [resLiquidacion, resGastos] = await Promise.all([
          api.get(`/eventos/${eventoId}/liquidacion/`),
          api.get(`/eventos/${eventoId}/resumen_gastos/`)
        ]);

        if (resLiquidacion.data.is_liquidado) {
          setIsLiquidado(true);
          setLiquidacionInfo({
            fecha: resLiquidacion.data.fecha_liquidacion,
            origen: resLiquidacion.data.origen,
            registradoPor: resLiquidacion.data.registrado_por
          });
          setMusicosYaPagados(resLiquidacion.data.musicos_pagados || []);
          
          // Poblar con los datos reales guardados en la liquidacion
          setDatosMusicos(prev => {
            const newDatos = { ...prev };
            resLiquidacion.data.detalles.forEach(d => {
               newDatos[d.musico_id] = {
                 acordado: parseFloat(d.acordado) > 0 ? Math.round(d.acordado).toString() : '',
                 multas: parseFloat(d.multas) > 0 ? Math.round(d.multas).toString() : '',
                 adelantos: parseFloat(d.adelantos) > 0 ? Math.round(d.adelantos).toString() : '',
                 fecha_pago: d.fecha_pago,
                 origen: d.origen,
                 registrado_por: d.registrado_por,
               };
            });
            return newDatos;
          });
          // No detenemos el flujo, permitimos que se cargue resumen_gastos para los no pagados
        }

        const resumen = resGastos.data;

        // El API devuelve musico_id como INTEGER, baseDatos usa musico.id (number)
        // Normalizamos comparando como string para evitar bugs de tipo
        setDatosMusicos(prev => {
          const newDatos = { ...prev };

          Object.entries(resumen).forEach(([musicoIdStr, datos]) => {
            // Buscar la key correcta en newDatos (puede ser number o string)
            // Intentar directamente con el valor del API y su version string
            const key = newDatos.hasOwnProperty(musicoIdStr)
              ? musicoIdStr
              : newDatos.hasOwnProperty(Number(musicoIdStr))
              ? Number(musicoIdStr)
              : null;

            if (key !== null) {
              // Si ya esta pagado en la bd, no sobreescribir con resumen
              if (resLiquidacion.data?.musicos_pagados?.includes(Number(key))) {
                 return;
              }

              const multasVal = parseFloat(datos.multas || 0);
              const adelantosVal = parseFloat(datos.adelantos || 0);
              newDatos[key] = {
                ...newDatos[key],
                // Solo actualizar si el valor del API es mayor a 0
                multas: multasVal > 0 ? Math.round(multasVal).toString() : (newDatos[key].multas || ''),
                adelantos: adelantosVal > 0 ? Math.round(adelantosVal).toString() : (newDatos[key].adelantos || ''),
              };
            }
          });

          return newDatos;
        });
      } catch (error) {
        console.error('Error cargando datos del evento:', error);
      }
    };

    initEvento(selectedEvento);
  }, [selectedEvento, eventos, musicos]);


  useEffect(() => {
    if (!selectedEvento) return;
    // Guardamos solo acordado y columnas extra — multas y adelantos siempre vienen del API
    const datosParaGuardar = {};
    Object.entries(datosMusicos).forEach(([musicoId, datos]) => {
      const { multas, adelantos, ...resto } = datos;
      datosParaGuardar[musicoId] = resto;
    });
    persistCurrentState(selectedEvento, {
      datosMusicos: datosParaGuardar,
      columnasExtra,
      uploadWarnings,
      musicosPagados
    });
  }, [selectedEvento, datosMusicos, columnasExtra, uploadWarnings, musicosPagados]);


  const [loadingIndividual, setLoadingIndividual] = useState(false);

  const handleAbrirModalPago = (musico) => {
      setMusicoSeleccionadoParaPago(musico);
  };

  const handleGuardarIndividual = async (musicoId) => {
      setLoadingIndividual(true);
      try {
          const deudasMusico = deudas.filter(d => d.musico == musicoId);
          const a = parseInt(datosMusicos[musicoId]?.acordado || 0);
          const m = parseInt(datosMusicos[musicoId]?.multas || 0);
          const ad = parseInt(datosMusicos[musicoId]?.adelantos || 0);
          
          if (a === 0 && m === 0 && ad === 0) {
              alert("Debes ingresar un monto Acordado, Adelanto o Descuento para guardar.");
              setLoadingIndividual(false);
              return;
          }

          const payload = {
              evento_id: selectedEvento,
              titulo: `Liquidación - ${eventos.find(e => e.id == selectedEvento)?.titulo}`,
              origen: 'FRONTEND',
              musicos: [{
                  musico_id: musicoId,
                  acordado: a,
                  multas: m,
                  adelantos: ad,
                  descuentos_extra: columnasExtra.map(col => ({
                      nombre: col.nombre,
                      monto: parseInt(datosMusicos[musicoId]?.[col.id] || 0)
                  })).filter(col => col.monto > 0),
                  deudas_saldadas: deudasMusico.map(d => d.id)
              }]
          };

          await api.post('/planillas/liquidar_directo/', payload);
          setMusicosYaPagados(prev => [...prev, musicoId]);
          setMusicosPagados(prev => ({ ...prev, [musicoId]: true }));
          setMusicoSeleccionadoParaPago(null);
          setNotification({ type: 'success', message: 'Pago guardado exitosamente.' });
      } catch(err) {
          console.error(err);
          alert("Error al guardar el pago: " + JSON.stringify(err.response?.data || err.message));
      } finally {
          setLoadingIndividual(false);
      }
  };

  const handleDesmarcarPago = (musicoId) => {
      setMusicosPagados(prev => ({ ...prev, [musicoId]: false }));
  };

  const handleInputChange = (musicoId, field, value) => {
     setDatosMusicos(prev => ({
        ...prev,
        [musicoId]: {
           ...prev[musicoId],
           [field]: value
        }
     }));
  };

  const sectionOptions = ['TROMPETAS', 'CLARINETES', 'SAXOS', 'BARITONOS', 'TROMBONES', 'TUBAS', 'PERCUSION', 'OTROS'];

  const handleAgregarColumna = () => {
    if (!nuevaColumna.nombre.trim()) return alert("El nombre del descuento es obligatorio");
    const monto = parseInt(nuevaColumna.monto || 0);
    if (!monto || monto <= 0) return alert("El monto debe ser un número entero mayor a 0");
    if (nuevaColumna.aplicarA === 'INDIVIDUAL' && !nuevaColumna.musico_id) return alert("Selecciona un músico individual");

    const newId = `desc_${Date.now()}`;
    setColumnasExtra([...columnasExtra, { id: newId, nombre: nuevaColumna.nombre.toUpperCase() }]);

    const newDatos = { ...datosMusicos };
    Object.keys(newDatos).forEach(musicoId => {
      const musico = musicos.find(m => m.id == musicoId);
      let aplicar = false;

      if (nuevaColumna.aplicarA === 'TODOS') {
        aplicar = true;
      } else if (nuevaColumna.aplicarA === 'SECCION' && musico) {
        aplicar = sectionMatchesInstrument(nuevaColumna.seccion, musico.instrumento);
      } else if (nuevaColumna.aplicarA === 'INDIVIDUAL') {
        aplicar = musicoId == nuevaColumna.musico_id;
      }

      newDatos[musicoId][newId] = aplicar ? monto.toString() : '';
    });

    setDatosMusicos(newDatos);
    setNuevaColumna({ nombre: '', monto: '', aplicarA: 'TODOS', seccion: 'TROMPETAS', musico_id: '' });
    setShowModalColumna(false);
  };

  const handleEliminarColumna = (colId) => {
      if (!window.confirm("¿Seguro que deseas eliminar esta columna de descuento?")) return;
      setColumnasExtra(columnasExtra.filter(c => c.id !== colId));
  };

  // ─── EXPORTAR PDF ─────────────────────────────────────────────────────────────
  const handleExportarPDF = () => {
    if (!selectedEvento) return;
    const eventoObj = eventos.find(e => e.id == selectedEvento);
    const eventoTitulo = eventoObj?.titulo || 'Evento';

    // Orden de secciones definido por el usuario
    const seccionesOrdenadas = [
      { titulo: 'TROMPETAS',           condition: m => m.instrumento === 'TROMPETA' },
      { titulo: 'SAXO Y CLARINETE',    condition: m => m.instrumento === 'CLARINETE' || m.instrumento === 'SAXOFON' },
      { titulo: 'BARÍTONOS',           condition: m => m.instrumento === 'BARITONO' },
      { titulo: 'TROMBONES',           condition: m => m.instrumento === 'TROMBON' },
      { titulo: 'TUBAS',               condition: m => m.instrumento === 'TUBA' },
      { titulo: 'PERCUSIÓN (BOMBO, TAMBOR Y PLATILLOS)',
        condition: m => ['BOMBO', 'TAMBOR', 'PLATILLOS', 'PERCUSION'].includes(m.instrumento) },
      { titulo: 'OTROS',
        condition: m => !['TROMPETA','CLARINETE','SAXOFON','BARITONO','TROMBON','TUBA','BOMBO','TAMBOR','PLATILLOS','PERCUSION'].includes(m.instrumento) },
    ];

    const convocadosIds = eventoObj ? eventoObj.convocados : [];
    const musicosConvocados = musicos.filter(m => convocadosIds.includes(m.id));

    // Determinar orientación según cantidad de columnas
    const totalCols = 4 + columnasExtra.length; // Músico + TOTAL + Desc Sección + extras + Adelanto + SALDO + Estado
    const orientation = totalCols > 6 ? 'landscape' : 'portrait';
    const pageWidth = orientation === 'landscape' ? 279.4 : 215.9; // mm
    const pageHeight = orientation === 'landscape' ? 215.9 : 279.4;

    const doc = new jsPDF({ orientation, unit: 'mm', format: 'letter' });

    // ── Encabezado ──────────────────────────────────────────────────────────────
    const marginX = 14;
    let cursorY = 14;

    // Título principal
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('REPORTE DE LIQUIDACIONES', pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 7;

    // Nombre del evento
    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);
    doc.text(eventoTitulo.toUpperCase(), pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 6;

    // Nombre de la banda
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(
      'BANDA DE MÚSICA INTERNACIONAL ESPECTACULAR MEJILLONES DE BOLIVIA ECO DE LOS ANDES',
      pageWidth / 2, cursorY, { align: 'center' }
    );
    cursorY += 5;

    // Línea separadora
    doc.setDrawColor(180, 180, 180);
    doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
    cursorY += 4;

    // Fecha de generación
    const ahora = new Date();
    const fechaStr = ahora.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const horaStr = ahora.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`Fecha de generación: ${fechaStr}  ${horaStr}`, marginX, cursorY);
    cursorY += 5;

    // ── Definir columnas de la tabla ─────────────────────────────────────────────
    const head = [
      [
        { content: 'N°',              styles: { halign: 'center', fontStyle: 'bold' } },
        { content: 'MÚSICO',          styles: { halign: 'left',   fontStyle: 'bold' } },
        { content: 'TOTAL (Bs.)',     styles: { halign: 'right',  fontStyle: 'bold' } },
        { content: 'DESC. SECCIÓN',   styles: { halign: 'right',  fontStyle: 'bold' } },
        ...columnasExtra.map(col => ({
          content: col.nombre,
          styles: { halign: 'right', fontStyle: 'bold' }
        })),
        { content: 'ADELANTO',        styles: { halign: 'right',  fontStyle: 'bold' } },
        { content: 'SALDO (Bs.)',     styles: { halign: 'right',  fontStyle: 'bold' } },
        { content: 'ESTADO',          styles: { halign: 'center', fontStyle: 'bold' } },
      ]
    ];

    // ── Construir filas ──────────────────────────────────────────────────────────
    const body = [];
    let totalGenAcordado = 0;
    let totalGenMultas   = 0;
    let totalGenExtras   = columnasExtra.map(() => 0);
    let totalGenAdelantos= 0;
    let totalGenSaldo    = 0;
    let numGlobal        = 1;

    seccionesOrdenadas.forEach(seccion => {
      const musicosSeccion = musicosConvocados.filter(seccion.condition);
      if (musicosSeccion.length === 0) return;

      // Fila de encabezado de sección
      const colCount = 4 + columnasExtra.length + 4; // N° + Músico + cols
      body.push([{
        content: seccion.titulo,
        colSpan: colCount,
        styles: {
          fillColor: [30, 30, 30],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'left',
          cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
        }
      }]);

      let subAcordado  = 0;
      let subMultas    = 0;
      let subExtras    = columnasExtra.map(() => 0);
      let subAdelantos = 0;
      let subSaldo     = 0;

      musicosSeccion.forEach(musico => {
        const d  = datosMusicos[musico.id] || {};
        const a  = parseInt(d.acordado  || 0);
        const m  = parseInt(d.multas    || 0);
        const ad = parseInt(d.adelantos || 0);
        let extras = 0;
        const extrasVals = columnasExtra.map(col => {
          const v = parseInt(d[col.id] || 0);
          extras += v;
          return v;
        });
        const saldo = a - m - ad - extras;
        const cancelado = musicosYaPagados.includes(musico.id) || musicosPagados[musico.id];

        subAcordado  += a;
        subMultas    += m;
        subAdelantos += ad;
        subSaldo     += saldo;
        subExtras     = subExtras.map((v, i) => v + extrasVals[i]);

        totalGenAcordado  += a;
        totalGenMultas    += m;
        totalGenAdelantos += ad;
        totalGenSaldo     += saldo;
        totalGenExtras     = totalGenExtras.map((v, i) => v + extrasVals[i]);

        body.push([
          { content: numGlobal++,                                      styles: { halign: 'center', fontSize: 7.5, textColor: [80,80,80] } },
          { content: `${musico.nombres} ${musico.apellidos}`,          styles: { halign: 'left',   fontSize: 7.5, fontStyle: 'bold' } },
          { content: a  > 0 ? a.toLocaleString('es-BO')  : '—',       styles: { halign: 'right',  fontSize: 7.5, textColor: [20,120,20] } },
          { content: m  > 0 ? m.toLocaleString('es-BO')  : '—',       styles: { halign: 'right',  fontSize: 7.5, textColor: [180,30,30] } },
          ...extrasVals.map(v => ({
            content: v > 0 ? v.toLocaleString('es-BO') : '—',
            styles:  { halign: 'right', fontSize: 7.5, textColor: [30,80,160] }
          })),
          { content: ad > 0 ? ad.toLocaleString('es-BO') : '—',       styles: { halign: 'right',  fontSize: 7.5, textColor: [180,100,0] } },
          { content: saldo.toLocaleString('es-BO'),
            styles: { halign: 'right', fontSize: 7.5, fontStyle: 'bold',
                      textColor: saldo >= 0 ? [20,120,20] : [180,30,30] } },
          { content: cancelado ? 'CANCELADO' : 'PENDIENTE',
            styles: { halign: 'center', fontSize: 7,
                      textColor: cancelado ? [20,120,20] : [180,100,0],
                      fontStyle: 'bold' } },
        ]);
      });

      // Subtotal de sección
      body.push([
        { content: '', styles: { fillColor: [235,235,235] } },
        { content: `SUBTOTAL ${seccion.titulo}`,
          styles: { halign: 'right', fontStyle: 'bold', fontSize: 7.5, fillColor: [235,235,235] } },
        { content: subAcordado.toLocaleString('es-BO'),
          styles: { halign: 'right', fontStyle: 'bold', fontSize: 7.5, fillColor: [235,235,235], textColor: [20,100,20] } },
        { content: subMultas > 0 ? subMultas.toLocaleString('es-BO') : '—',
          styles: { halign: 'right', fontStyle: 'bold', fontSize: 7.5, fillColor: [235,235,235], textColor: [160,20,20] } },
        ...subExtras.map(v => ({
          content: v > 0 ? v.toLocaleString('es-BO') : '—',
          styles: { halign: 'right', fontStyle: 'bold', fontSize: 7.5, fillColor: [235,235,235], textColor: [20,60,140] }
        })),
        { content: subAdelantos > 0 ? subAdelantos.toLocaleString('es-BO') : '—',
          styles: { halign: 'right', fontStyle: 'bold', fontSize: 7.5, fillColor: [235,235,235], textColor: [160,80,0] } },
        { content: subSaldo.toLocaleString('es-BO'),
          styles: { halign: 'right', fontStyle: 'bold', fontSize: 7.5, fillColor: [235,235,235],
                    textColor: subSaldo >= 0 ? [20,100,20] : [160,20,20] } },
        { content: '', styles: { fillColor: [235,235,235] } },
      ]);
    });

    // ── Fila GRAN TOTAL ──────────────────────────────────────────────────────────
    body.push([
      { content: '', styles: { fillColor: [20,20,20] } },
      { content: 'TOTAL GENERAL',
        styles: { halign: 'right', fontStyle: 'bold', fontSize: 8, fillColor: [20,20,20], textColor: [255,255,255] } },
      { content: totalGenAcordado.toLocaleString('es-BO'),
        styles: { halign: 'right', fontStyle: 'bold', fontSize: 8, fillColor: [20,20,20], textColor: [100,255,100] } },
      { content: totalGenMultas > 0 ? totalGenMultas.toLocaleString('es-BO') : '—',
        styles: { halign: 'right', fontStyle: 'bold', fontSize: 8, fillColor: [20,20,20], textColor: [255,120,120] } },
      ...totalGenExtras.map(v => ({
        content: v > 0 ? v.toLocaleString('es-BO') : '—',
        styles: { halign: 'right', fontStyle: 'bold', fontSize: 8, fillColor: [20,20,20], textColor: [120,180,255] }
      })),
      { content: totalGenAdelantos > 0 ? totalGenAdelantos.toLocaleString('es-BO') : '—',
        styles: { halign: 'right', fontStyle: 'bold', fontSize: 8, fillColor: [20,20,20], textColor: [255,180,80] } },
      { content: totalGenSaldo.toLocaleString('es-BO'),
        styles: { halign: 'right', fontStyle: 'bold', fontSize: 9, fillColor: [20,20,20], textColor: [255,255,255] } },
      { content: '', styles: { fillColor: [20,20,20] } },
    ]);

    // ── Calcular anchos de columna proporcionales ─────────────────────────────────
    const usableWidth = pageWidth - marginX * 2;
    const fixedCols   = { num: 7, musico: 48, total: 20, descSec: 22, adelanto: 20, saldo: 22, estado: 20 };
    const extraWidth  = columnasExtra.length > 0
      ? Math.min(20, (usableWidth - Object.values(fixedCols).reduce((a,b)=>a+b,0)) / columnasExtra.length)
      : 0;

    const columnStyles = {
      0: { cellWidth: fixedCols.num },
      1: { cellWidth: fixedCols.musico },
      2: { cellWidth: fixedCols.total },
      3: { cellWidth: fixedCols.descSec },
    };
    columnasExtra.forEach((_, i) => {
      columnStyles[4 + i] = { cellWidth: extraWidth };
    });
    const lastOffset = 4 + columnasExtra.length;
    columnStyles[lastOffset]     = { cellWidth: fixedCols.adelanto };
    columnStyles[lastOffset + 1] = { cellWidth: fixedCols.saldo };
    columnStyles[lastOffset + 2] = { cellWidth: fixedCols.estado };

    // ── Renderizar tabla ─────────────────────────────────────────────────────────
    autoTable(doc, {
      head,
      body,
      startY: cursorY,
      margin: { left: marginX, right: marginX },
      tableWidth: usableWidth,
      columnStyles,
      headStyles: {
        fillColor:  [40, 40, 40],
        textColor:  [255, 255, 255],
        fontSize:   7.5,
        fontStyle:  'bold',
        halign:     'center',
        cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
      },
      bodyStyles: {
        fontSize:    7.5,
        cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
        lineColor:   [220, 220, 220],
        lineWidth:   0.1,
      },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      didDrawPage: (data) => {
        // Pie de cada página: generado por y número de página
        const pageCount = doc.internal.getNumberOfPages();
        const currentPage = data.pageNumber;
        const pY = pageHeight - 8;

        // Usuario logueado
        const userData = localStorage.getItem('user');
        let userName = 'Sistema';
        try {
          if (userData) {
            const u = JSON.parse(userData);
            userName = u.nombre_completo || u.username || u.email || 'Sistema';
          }
        } catch {}

        doc.setFontSize(7);
        doc.setTextColor(130, 130, 130);
        doc.setFont('helvetica', 'italic');
        doc.text(`Generado por: ${userName}  |  ${fechaStr} ${horaStr}`, marginX, pY);
        doc.text(`Página ${currentPage} de ${pageCount}`, pageWidth - marginX, pY, { align: 'right' });

        // Línea de pie
        doc.setDrawColor(200, 200, 200);
        doc.line(marginX, pY - 3, pageWidth - marginX, pY - 3);
      },
    });

    // ── Guardar PDF ──────────────────────────────────────────────────────────────
    const nombreArchivo = `Liquidacion_${eventoTitulo.replace(/[^a-zA-Z0-9]/g, '_')}_${fechaStr.replace(/\//g, '-')}.pdf`;
    doc.save(nombreArchivo);
  };
  // ─────────────────────────────────────────────────────────────────────────────

  const handlePdfUpload = async (fileOrEvent, type) => {

    const isMultas = type === 'multas';
    let file = null;

    if (fileOrEvent && typeof fileOrEvent.preventDefault === 'function') {
      fileOrEvent.preventDefault();
      file = isMultas ? pdfMultasFile : pdfAdelantosFile;
    } else {
      file = fileOrEvent;
    }

    if (!file) {
      setNotification({
        type: 'error',
        message: `Selecciona un archivo PDF de ${isMultas ? 'multas' : 'adelantos'}`
      });
      return;
    }
    
    isMultas ? setIsPdfMultasProcessing(true) : setIsPdfAdelantosProcessing(true);
    setUploadWarnings([]);
    
    const formDataPdf = new FormData();
    formDataPdf.append('pdf_file', file);

    const endpoint = isMultas ? '/api/descuentos/procesar_pdf/' : '/api/adelantos/procesar_pdf/';
    const token = localStorage.getItem('access_token');
    if (!token) {
      setNotification({
        type: 'error',
        message: 'Debes iniciar sesión antes de procesar archivos.'
      });
      if (isMultas) setIsPdfMultasProcessing(false);
      else setIsPdfAdelantosProcessing(false);
      return;
    }

    try {
      const res = await api.post(endpoint, formDataPdf);
      
      // Validar si el backend procesó exitosamente
      if (!res.data.exitoso) {
        throw new Error(res.data.error || 'Error al procesar el archivo PDF');
      }

      // Validar que validados sea un array
      if (!Array.isArray(res.data.validados)) {
        throw new Error('Respuesta inválida del servidor');
      }

      const validos = res.data.validados.filter(v => v.valido);
      
      // Si no hay válidos, mostrar error
      if (validos.length === 0) {
        const noEncontrados = res.data.no_encontrados || [];
        const mensajeError = noEncontrados.length > 0 
          ? `No se encontraron músicos. Nombres no reconocidos: ${noEncontrados.join(', ')}`
          : 'No se extrajeron registros válidos del PDF';
        throw new Error(mensajeError);
      }
      
      const newDatos = { ...datosMusicos };
      let aplicados = 0;
      let noConvocados = 0;
      let noSeccion = 0;
      const warnings = [];

      validos.forEach(v => {
        const musico = musicos.find(m => m.id === v.musico_id);
        if (musico && v.seccion && !sectionMatchesInstrument(v.seccion, musico.instrumento)) {
          noSeccion++;
          warnings.push(`No se aplicó ${isMultas ? 'multa' : 'adelanto'} de ${v.monto} a ${musico.nombres} ${musico.apellidos} porque no pertenece a la sección ${v.seccion}.`);
          return;
        }

        if (newDatos[v.musico_id]) {
          const campo = isMultas ? 'multas' : 'adelantos';
          const valorActual = parseInt(newDatos[v.musico_id][campo] || 0);
          newDatos[v.musico_id][campo] = (valorActual + parseInt(v.monto)).toString();
          aplicados++;
        } else {
          noConvocados++;
          if (musico) {
            warnings.push(`No se aplicó ${isMultas ? 'multa' : 'adelanto'} de ${v.monto} a ${musico.nombres} ${musico.apellidos} porque no está convocado para este evento.`);
          } else {
            warnings.push(`No se aplicó ${isMultas ? 'multa' : 'adelanto'} de ${v.monto} porque el músico no está convocado o no se pudo identificar.`);
          }
        }
      });
      
      setDatosMusicos(newDatos);
      
      let message = `✅ Se aplicaron ${aplicados} ${isMultas ? 'multas' : 'adelantos'} correctamente`;
      if (noSeccion > 0) {
        message += ` | ⚠️ ${noSeccion} no aplicados (sección incorrecta)`;
      }
      if (noConvocados > 0) {
        message += ` | ⚠️ ${noConvocados} no aplicados (no convocados)`;
      }

      const allWarnings = [...warnings];
      if (res.data.no_encontrados?.length) {
        allWarnings.push(`No encontrados en BD: ${res.data.no_encontrados.join(', ')}`);
      }
      setUploadWarnings(allWarnings);

      setNotification({
        type: 'success',
        message: message
      });
      
      if (isMultas) {
        setPdfMultasFile(null);
        setClearMultasFile(true);
        setTimeout(() => setClearMultasFile(false), 100);
      } else {
        setPdfAdelantosFile(null);
        setClearAdelantosFile(true);
        setTimeout(() => setClearAdelantosFile(false), 100);
      }
      
    } catch (err) {
      setUploadWarnings([]);
      setNotification({
        type: 'error',
        message: `❌ ${err.response?.data?.error || err.message || 'Error al procesar archivo'}`
      });
    } finally {
      isMultas ? setIsPdfMultasProcessing(false) : setIsPdfAdelantosProcessing(false);
    }
  };

  const handleBatchDescuentosUpload = async (files) => {
    if (!files || files.length === 0) return;
    
    setIsProcessingBatch(true);
    setUploadWarnings([]);
    
    const resultados = [];
    let totalDescuentos = 0;
    const newDatos = { ...datosMusicos };
    const batchWarnings = [];
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = file.name.toLowerCase();
        const seccion = inferSeccionFromFilename(file.name);
        
        try {
          const formData = new FormData();
          formData.append('pdf_file', file);
          formData.append('guardar_en_seccion', 'true');
          formData.append('seccion', seccion);
          formData.append('observaciones', `Descuentos PDF de sección ${seccion} - ${file.name}`);
          
          const token = localStorage.getItem('access_token');
          if (!token) {
            setNotification({
              type: 'error',
              message: 'Debes iniciar sesión antes de procesar archivos.'
            });
            setIsProcessingBatch(false);
            return;
          }

          const res = await api.post('/descuentos/procesar_pdf/', formData);
          
          if (res.data.exitoso) {
            const validos = res.data.validados.filter(v => v.valido);
            let musicosAfectados = 0;
            let descuentosAplicados = 0;
            let totalDescuentosPorArchivo = 0;
            
            validos.forEach(v => {
              const musico = musicos.find(m => m.id === v.musico_id);
              const rowSection = v.seccion || seccion;
              if (musico && rowSection && !sectionMatchesInstrument(rowSection, musico.instrumento)) {
                batchWarnings.push(`En ${file.name}: ${musico.nombres} ${musico.apellidos} no recibió descuento porque no pertenece a la sección ${rowSection}.`);
                return;
              }

              if (newDatos[v.musico_id]) {
                const valorActual = parseInt(newDatos[v.musico_id].multas || 0);
                newDatos[v.musico_id].multas = (valorActual + parseInt(v.monto)).toString();
                totalDescuentos += parseInt(v.monto);
                totalDescuentosPorArchivo += parseInt(v.monto);
                musicosAfectados++;
                descuentosAplicados++;
              } else {
                if (musico) {
                  batchWarnings.push(`En ${file.name}: ${musico.nombres} ${musico.apellidos} no recibió descuento porque no está convocado para este evento.`);
                } else {
                  batchWarnings.push(`En ${file.name}: no se aplicó un descuento porque el músico no está convocado o no está registrado.`);
                }
              }
            });
            
            resultados.push({
              seccion,
              archivo: file.name,
              estado: 'exitoso',
              musicosAfectados,
              descuentosAplicados,
              totalDescuentos: totalDescuentosPorArchivo,
              descuentoSeccionId: res.data.descuento_seccion_id || null
            });
          } else {
            resultados.push({
              seccion,
              archivo: file.name,
              estado: 'error',
              musicosAfectados: 0,
              descuentosAplicados: 0,
              totalDescuentos: 0,
              errores: [res.data.error || 'Error desconocido']
            });
          }
        } catch (err) {
          resultados.push({
            seccion,
            archivo: file.name,
            estado: 'error',
            musicosAfectados: 0,
            descuentosAplicados: 0,
            totalDescuentos: 0,
            errores: [err.response?.data?.error || err.message]
          });
        }
      }
      
      setDatosMusicos(newDatos);
      setResultadosProcesamiento(resultados);
      setTotalGeneralDescuentos(totalDescuentos);
      setShowResumenModal(true);
      if (batchWarnings.length > 0) {
        setUploadWarnings(batchWarnings);
      } else {
        setUploadWarnings([]);
      }
      
      const exitosos = resultados.filter(r => r.estado === 'exitoso').length;
      const rechazados = batchWarnings.length;
      setNotification({
        type: 'success',
        message: `✅ Se procesaron ${exitosos} de ${files.length} secciones correctamente${rechazados > 0 ? ` · ${rechazados} descuentos no aplicados, revisa las advertencias` : ''}`
      });
      
    } catch (err) {
      setNotification({
        type: 'error',
        message: `❌ Error procesando archivos: ${err.message}`
      });
    } finally {
      setIsProcessingBatch(false);
    }
  };

  const handleDownloadPlantilla = async () => {
    try {
      const res = await api.get('/musicos/generar_plantilla_excel/', {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Plantilla_Multas_Adelantos.xlsx`);
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      alert("Error al generar la plantilla de Excel");
    }
  };

  const handleGuardar = async () => {
    if (!selectedEvento) return;
    if (!window.confirm("¿Estás seguro de consolidar y pagar este evento? Esta acción generará la planilla y el historial final.")) return;
    
    setLoading(true);

    const musicosAEnviar = Object.keys(datosMusicos).filter(id => !musicosYaPagados.includes(Number(id)));

    const payload = {
       evento_id: selectedEvento,
       titulo: `Liquidación - ${eventos.find(e => e.id == selectedEvento)?.titulo}`,
       origen: 'FRONTEND',
       musicos: musicosAEnviar.map(musicoId => {
           const deudasMusico = deudas.filter(d => d.musico == musicoId);
           return {
               musico_id: musicoId,
               acordado: parseInt(datosMusicos[musicoId].acordado || 0),
               multas: parseInt(datosMusicos[musicoId].multas || 0),
               adelantos: parseInt(datosMusicos[musicoId].adelantos || 0),
               descuentos_extra: columnasExtra.map(col => ({
                   nombre: col.nombre,
                   monto: parseInt(datosMusicos[musicoId][col.id] || 0)
               })).filter(d => d.monto > 0)
           };
       })
    };

    try {
       await api.post('/planillas/liquidar_directo/', payload);
       alert("Planilla liquidada y guardada exitosamente!");
       setSelectedEvento('');
       if (onPlanillaGuardada) onPlanillaGuardada();
    } catch (err) {
       alert("Error al guardar: " + JSON.stringify(err.response?.data || err.message));
    } finally {
       setLoading(false);
    }
  };

  const selectedEventoObj = eventos.find(e => e.id == selectedEvento);
  const convocadosIds = selectedEventoObj ? selectedEventoObj.convocados : [];
  const musicosList = musicos.filter(m => convocadosIds.includes(m.id));
  const lowerSearch = searchTerm.trim().toLowerCase();
  const filteredMusicosList = lowerSearch
    ? musicosList.filter(m => `${m.nombres} ${m.apellidos}`.toLowerCase().includes(lowerSearch))
    : musicosList;

  // Agrupamiento de músicos por sección
  const grupos = [
    { titulo: 'TROMPETAS', key: 'TROMPETA', condition: m => m.instrumento === 'TROMPETA' },
    { titulo: 'CLARINETES Y SAXOS', key: 'CLARISAXO', condition: m => m.instrumento === 'CLARINETE' || m.instrumento === 'SAXOFON' },
    { titulo: 'BARÍTONOS', key: 'BARITONO', condition: m => m.instrumento === 'BARITONO' },
    { titulo: 'TROMBONES', key: 'TROMBON', condition: m => m.instrumento === 'TROMBON' },
    { titulo: 'TUBAS', key: 'TUBA', condition: m => m.instrumento === 'TUBA' },
    { titulo: 'PERCUSIÓN', key: 'PERCUSION', condition: m => ['BOMBO', 'TAMBOR', 'PLATILLOS', 'PERCUSION'].includes(m.instrumento) },
    { titulo: 'OTROS', key: 'OTROS', condition: m => !['TROMPETA', 'CLARINETE', 'SAXOFON', 'BARITONO', 'TROMBON', 'TUBA', 'BOMBO', 'TAMBOR', 'PLATILLOS', 'PERCUSION'].includes(m.instrumento) }
  ];

  // Totales
  let totalAcordado = 0;
  let totalMultas = 0;
  let totalAdelantos = 0;
  let totalPagar = 0;
  const totalesExtra = {};
  const multasPorGrupo = {};
  grupos.forEach(g => multasPorGrupo[g.key] = 0);
  columnasExtra.forEach(col => totalesExtra[col.id] = 0);

  Object.keys(datosMusicos).forEach(id => {
      const musicoObj = musicos.find(m => m.id == id);
      const a = parseInt(datosMusicos[id].acordado || 0);
      const m = parseInt(datosMusicos[id].multas || 0);
      const ad = parseInt(datosMusicos[id].adelantos || 0);
      
      let extra = 0;
      columnasExtra.forEach(col => {
          const val = parseInt(datosMusicos[id][col.id] || 0);
          extra += val;
          totalesExtra[col.id] += val;
      });

      if (musicoObj && m > 0) {
          const grupoPertenece = grupos.find(g => g.condition(musicoObj));
          if (grupoPertenece) {
              multasPorGrupo[grupoPertenece.key] += m;
          }
      }

      totalAcordado += a;
      totalMultas += m;
      totalAdelantos += ad;
      totalPagar += (a - m - ad - extra);
  });

  return (
    <div className="">
      {selectedEvento && (
      <div className="space-y-4 animate-in fade-in duration-300">


           {/* Barra de Herramientas de Liquidación */}
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                 <div className="relative w-full sm:w-80">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <Search className="h-4 w-4 text-gray-400" />
                   </div>
                   <input
                     id="searchMusico"
                     value={searchTerm}
                     onChange={e => setSearchTerm(e.target.value)}
                     placeholder="Buscar músico por nombre..."
                     className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-4 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                   />
                 </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleExportarPDF}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-sm flex items-center gap-2 text-sm whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  <span>Exportar PDF</span>
                </button>
                <button 
                  onClick={() => setShowModalColumna(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-sm flex items-center gap-2 text-sm whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nuevo Descuento</span>
                </button>
              </div>
           </div>

           {uploadWarnings.length > 0 && (
                 <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-900">
                    <h3 className="font-bold text-yellow-900 text-sm mb-3">Advertencias de carga</h3>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {uploadWarnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                 </div>
           )}
            <div className="border border-gray-200 rounded-xl shadow-sm overflow-x-auto overflow-y-auto bg-white" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
               <table className="w-full min-w-full text-sm text-left table-fixed">
                  <thead className="bg-gray-800 text-white sticky top-0 z-20 shadow-md">
                     <tr>
                        <th className="px-4 py-4 font-bold border-b min-w-[200px] uppercase text-xs tracking-wider sticky left-0 top-0 bg-gray-800 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">Músico</th>
                        <th className="px-4 py-4 font-bold border-b text-right w-32 uppercase text-xs tracking-wider text-green-300">TOTAL</th>
                        <th className="px-4 py-4 font-bold border-b text-right w-28 text-red-300 uppercase text-xs tracking-wider">Descuento</th>
                        {columnasExtra.map(col => (
                            <th key={col.id} className="px-2 py-4 font-bold border-b text-right w-28 text-blue-200 uppercase text-xs tracking-wider">
                                <div className="flex items-center justify-end gap-2">
                                   <span className="whitespace-nowrap">- {col.nombre}</span>
                                   <button
                                      onClick={() => handleEliminarColumna(col.id)}
                                      className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-600 text-white hover:bg-red-700 transition-shadow shadow-lg"
                                      title="Eliminar descuento"
                                   >
                                      <X className="w-4 h-4" />
                                   </button>
                                </div>
                            </th>
                        ))}
                        <th className="px-4 py-4 font-bold border-b text-right w-28 text-orange-300 uppercase text-xs tracking-wider">Adelanto</th>
                        <th className="px-4 py-4 font-bold border-b text-right w-36 text-white uppercase text-xs tracking-wider">SALDO</th>
                        <th className="px-4 py-4 font-bold border-b text-center w-28 uppercase text-xs tracking-wider text-green-300">ACCIÓN</th>
                     </tr>
                  </thead>
                  
                  {filteredMusicosList.length > 0 ? (
                     grupos.map(grupo => {
                        const musicosGrupo = filteredMusicosList.filter(grupo.condition);
                        if (musicosGrupo.length === 0) return null;
                        
                        return (
                           <tbody key={grupo.key} className="divide-y divide-gray-100">
                              <tr>
                                 <td colSpan={6 + columnasExtra.length} className="bg-gray-100 px-4 py-2 font-black text-gray-700 border-y border-gray-200 sticky left-0">
                                    {grupo.titulo}
                                 </td>
                              </tr>
                              {musicosGrupo.map(musico => {
                                 const a = parseInt(datosMusicos[musico.id]?.acordado || 0);
                                 const m = parseInt(datosMusicos[musico.id]?.multas || 0);
                                 const ad = parseInt(datosMusicos[musico.id]?.adelantos || 0);
                                 
                                 let extraLocal = 0;
                                 columnasExtra.forEach(col => {
                                     extraLocal += parseInt(datosMusicos[musico.id]?.[col.id] || 0);
                                 });

                                 const final = a - m - ad - extraLocal;
                                 
                                 const isMusicoYaPagado = musicosYaPagados.includes(musico.id);
                                 const isPagado = isMusicoYaPagado || musicosPagados[musico.id];

                                 return (
                                 <React.Fragment key={musico.id}>
                                    <tr className={`transition-colors ${isPagado ? 'bg-green-50/50' : 'hover:bg-gray-50'}`}>
                                       <td className={`px-4 py-3 font-bold border-r border-gray-100 sticky left-0 z-10 ${isPagado ? 'bg-green-50 text-green-900' : 'bg-white text-gray-800'}`}>
                                           <div className="flex flex-col">
                                               <span>{musico.nombres} {musico.apellidos}</span>
                                               {deudas.filter(d => d.musico == musico.id).map(d => (
                                                   <span key={d.id} className="text-[10px] text-red-500 font-bold mt-0.5 leading-tight">Deuda: {d.motivo} (Bs. {d.saldo_restante})</span>
                                               ))}
                                           </div>
                                       </td>
                                       <td className="px-2 py-2">
                                          <input type="number" step="1" min="0" value={datosMusicos[musico.id]?.acordado || ''} onChange={e => handleInputChange(musico.id, 'acordado', e.target.value)} disabled={isPagado} className={`w-full text-right px-2 py-2 border rounded-lg outline-none font-bold ${isPagado ? 'bg-transparent border-transparent text-green-800' : 'border-green-200 focus:ring-2 focus:ring-green-500 bg-green-50/30'}`} placeholder="0" />
                                       </td>
                                       <td className="px-2 py-2">
                                          <input type="number" step="1" min="0" value={datosMusicos[musico.id]?.multas || ''} onChange={e => handleInputChange(musico.id, 'multas', e.target.value)} disabled={isPagado} className={`w-full text-right px-2 py-2 border rounded-lg outline-none font-bold ${isPagado ? 'bg-transparent border-transparent text-red-800' : 'border-red-200 focus:ring-2 focus:ring-red-500 text-red-600 bg-red-50/50'}`} placeholder="0" />
                                       </td>
                                       {columnasExtra.map(col => (
                                          <td key={col.id} className="px-2 py-2">
                                             <input type="number" step="1" min="0" value={datosMusicos[musico.id]?.[col.id] || ''} onChange={e => handleInputChange(musico.id, col.id, e.target.value)} disabled={isPagado} className={`w-full text-right px-2 py-2 border rounded-lg outline-none font-bold ${isPagado ? 'bg-transparent border-transparent text-blue-800' : 'border-blue-200 focus:ring-2 focus:ring-blue-500 text-blue-700 bg-blue-50/30'}`} placeholder="0" />
                                          </td>
                                       ))}
                                       <td className="px-2 py-2">
                                          <input type="number" step="1" min="0" value={datosMusicos[musico.id]?.adelantos || ''} onChange={e => handleInputChange(musico.id, 'adelantos', e.target.value)} disabled={isPagado} className={`w-full text-right px-2 py-2 border rounded-lg outline-none font-bold ${isPagado ? 'bg-transparent border-transparent text-orange-800' : 'border-orange-200 focus:ring-2 focus:ring-orange-500 text-orange-600 bg-orange-50/50'}`} placeholder="0" />
                                       </td>
                                       <td className={`px-4 py-3 text-right font-black text-lg ${final >= 0 ? (isPagado ? 'text-green-800' : 'text-green-700 bg-green-50/30') : (isPagado ? 'text-red-800' : 'text-red-600 bg-red-50/30')}`}>
                                          Bs. {final.toLocaleString('es-VE', { maximumFractionDigits: 0 })}
                                       </td>
                                       <td className="px-2 py-2 text-center">
                                           <button 
                                              onClick={() => {
                                                  if (isMusicoYaPagado) {
                                                      setDetalleMusicoModal(musico);
                                                  } else if (!isPagado) {
                                                      handleAbrirModalPago(musico);
                                                  }
                                              }} 
                                              disabled={isPagado && !isMusicoYaPagado}
                                              className={`w-full py-2 rounded-lg font-bold text-xs flex justify-center items-center gap-1 transition-all shadow-sm ${isMusicoYaPagado ? 'bg-green-100 text-green-700 hover:bg-green-200' : (isPagado ? 'bg-gray-100 text-gray-400' : 'bg-green-600 text-white hover:bg-green-700 hover:-translate-y-0.5')}`}
                                           >
                                              {isMusicoYaPagado ? <Eye className="w-4 h-4"/> : <CheckCircle className="w-4 h-4"/>}
                                              {isMusicoYaPagado ? 'Ver' : (isPagado ? 'Pagado' : 'Pagar')}
                                           </button>
                                       </td>
                                    </tr>
                                 </React.Fragment>
                              )})}
                           </tbody>
                        );
                     })
                  ) : (
                     <tbody>
                        <tr>
                           <td colSpan={6 + columnasExtra.length} className="px-4 py-8 text-center text-gray-500">
                              {searchTerm ? 'No se encontraron músicos con ese nombre.' : 'No hay músicos convocados para este evento.'}
                           </td>
                        </tr>
                     </tbody>
                  )}
                  {filteredMusicosList.length > 0 && (
                     <tfoot className="bg-gray-800 border-t-4 border-gray-400">
                        <tr>
                           <td className="px-4 py-4 font-black text-white text-right text-lg sticky left-0 bg-gray-800">TOTALES:</td>
                           <td className="px-4 py-4 font-black text-right text-green-300 text-lg">Bs. {totalAcordado.toLocaleString('es-VE', { maximumFractionDigits: 0 })}</td>
                           <td className="px-4 py-4 font-black text-right text-red-400 text-lg">
                               -Bs. {totalMultas.toLocaleString('es-VE', { maximumFractionDigits: 0 })}
                               {totalMultas > 0 && (
                                   <div className="mt-2 pt-2 border-t border-red-500/30 flex flex-col gap-1 text-xs font-medium text-red-200">
                                       {grupos.map(g => multasPorGrupo[g.key] > 0 ? (
                                           <span key={g.key} className="flex justify-between items-center whitespace-nowrap gap-2">
                                               <span>{g.titulo}:</span>
                                               <span className="font-bold">-Bs. {multasPorGrupo[g.key].toLocaleString('es-VE', { maximumFractionDigits: 0 })}</span>
                                           </span>
                                       ) : null)}
                                   </div>
                               )}
                           </td>
                           {columnasExtra.map(col => (
                              <td key={col.id} className="px-2 py-4 font-black text-right text-blue-300 text-lg align-top">-Bs. {totalesExtra[col.id].toLocaleString('es-VE', { maximumFractionDigits: 0 })}</td>
                           ))}
                           <td className="px-4 py-4 font-black text-right text-orange-400 text-lg align-top">-Bs. {totalAdelantos.toLocaleString('es-VE', { maximumFractionDigits: 0 })}</td>
                           <td className="px-4 py-4 font-black text-right text-white text-2xl align-top">Bs. {totalPagar.toLocaleString('es-VE', { maximumFractionDigits: 0 })}</td>
                           <td className="px-4 py-4 bg-gray-800"></td>
                        </tr>
                     </tfoot>
                  )}
               </table>
            </div>

            {musicosList.length > 0 && musicosYaPagados.length < musicosList.length && (
               <div className="flex justify-end pt-4 pb-12">
                  <button 
                     onClick={handleGuardar}
                     disabled={loading}
                     className="bg-green-600 hover:bg-green-700 text-white font-black py-4 px-10 rounded-xl flex items-center gap-3 transition-all disabled:opacity-50 shadow-lg transform hover:-translate-y-1 text-lg"
                  >
                     <CheckCircle className="w-6 h-6" />
                     {loading ? 'Guardando y Consolidando...' : 'Guardar y Consolidar Restantes'}
                  </button>
               </div>
            )}
         </div>
      )}

      {/* Modal Detalle de Pago */}
      {detalleMusicoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl animate-in fade-in zoom-in-95 p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-600" />
              Detalles del Pago
            </h3>
            
            {(() => {
                const musico = detalleMusicoModal;
                const d = datosMusicos[musico.id] || {};
                
                // Formatear fecha si existe
                let fechaFormateada = 'Desconocida';
                if (d.fecha_pago) {
                    fechaFormateada = new Date(d.fecha_pago).toLocaleString('es-BO');
                }
                
                // Calcular total Neto
                const sumExtras = columnasExtra.reduce((sum, col) => sum + parseFloat(d[col.id] || 0), 0);
                const neto = parseFloat(d.acordado || 0) - parseFloat(d.multas || 0) - parseFloat(d.adelantos || 0) - sumExtras;

                return (
                    <div className="space-y-4">
                        <div>
                            <p className="text-sm text-gray-500 uppercase font-bold tracking-wider">Músico</p>
                            <p className="font-bold text-lg text-gray-800">{musico.nombres} {musico.apellidos}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg">
                            <div>
                                <p className="text-xs text-gray-500 font-bold uppercase">Registrado Por</p>
                                <p className="font-semibold text-gray-700">{d.registrado_por || 'Desconocido'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-bold uppercase">Medio / Origen</p>
                                <p className="font-semibold text-gray-700">{d.origen || 'Desconocido'}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-xs text-gray-500 font-bold uppercase">Fecha y Hora</p>
                                <p className="font-semibold text-gray-700">{fechaFormateada}</p>
                            </div>
                        </div>

                        <div className="border border-gray-100 rounded-lg p-3 space-y-2">
                            <div className="flex justify-between items-center text-sm">
                                <span className="font-medium text-gray-600">Total Acordado:</span>
                                <span className="font-bold">Bs. {d.acordado || 0}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm text-red-600">
                                <span className="font-medium">Total Descuentos:</span>
                                <span className="font-bold">- Bs. {d.multas || 0}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm text-orange-600">
                                <span className="font-medium">Total Adelantos:</span>
                                <span className="font-bold">- Bs. {d.adelantos || 0}</span>
                            </div>
                            
                            {columnasExtra.map(col => (
                                parseFloat(d[col.id]) > 0 && (
                                    <div key={col.id} className="flex justify-between items-center text-sm text-blue-600">
                                        <span className="font-medium">{col.nombre}:</span>
                                        <span className="font-bold">- Bs. {d[col.id]}</span>
                                    </div>
                                )
                            ))}
                            
                            <div className="pt-2 border-t mt-2 flex justify-between items-center">
                                <span className="font-black text-gray-800">TOTAL CANCELADO:</span>
                                <span className="font-black text-xl text-green-700">Bs. {neto}</span>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button 
                                onClick={() => setDetalleMusicoModal(null)}
                                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                );
            })()}
          </div>
        </div>
      )}

      {/* Modal Nueva Columna */}
      {showModalColumna && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl animate-in fade-in zoom-in-95 p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Registrar Nuevo Descuento</h3>
            
            <div className="space-y-4">
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Nombre (Motivo)</label>
                  <input 
                     type="text" 
                     value={nuevaColumna.nombre} 
                     onChange={e => setNuevaColumna({...nuevaColumna, nombre: e.target.value})}
                     className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 uppercase mb-2"
                     placeholder="Ej: CAMISA, GORRA..."
                     autoFocus
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {['TELAS', 'CAMISAS', 'ZAPATOS', 'GUANTES', 'GORRAS', 'VARIOS'].map(sug => (
                      <button
                        key={sug}
                        onClick={() => setNuevaColumna({...nuevaColumna, nombre: sug})}
                        className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-full transition-colors border border-purple-200"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
               </div>
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Monto (Bs)</label>
                  <p className="text-[10px] text-gray-500 mb-1 leading-tight">Puedes dejarlo en 0 y ajustar el valor individualmente en la tabla luego.</p>
                  <input 
                     type="number" step="1" min="0" 
                     value={nuevaColumna.monto} 
                     onChange={e => setNuevaColumna({...nuevaColumna, monto: e.target.value})}
                     className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 font-bold"
                     placeholder="0"
                  />
               </div>

               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">¿A quién se aplica este descuento?</label>
                  <div className="flex gap-2 mb-3 bg-gray-100 p-1 rounded-lg">
                     <button onClick={() => setNuevaColumna({...nuevaColumna, aplicarA: 'SECCION'})} className={`flex-1 py-1.5 text-xs font-bold rounded-md ${nuevaColumna.aplicarA === 'SECCION' ? 'bg-white shadow text-purple-700' : 'text-gray-500'}`}>Por Sección</button>
                     <button onClick={() => setNuevaColumna({...nuevaColumna, aplicarA: 'INDIVIDUAL'})} className={`flex-1 py-1.5 text-xs font-bold rounded-md ${nuevaColumna.aplicarA === 'INDIVIDUAL' ? 'bg-white shadow text-purple-700' : 'text-gray-500'}`}>Individual</button>
                     <button onClick={() => setNuevaColumna({...nuevaColumna, aplicarA: 'TODOS'})} className={`flex-1 py-1.5 text-xs font-bold rounded-md ${nuevaColumna.aplicarA === 'TODOS' ? 'bg-white shadow text-purple-700' : 'text-gray-500'}`}>A Todos</button>
                  </div>

                  {nuevaColumna.aplicarA === 'SECCION' && (
                     <select value={nuevaColumna.seccion} onChange={e => setNuevaColumna({...nuevaColumna, seccion: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500">
                        {sectionOptions.map(s => <option key={s} value={s}>{s}</option>)}
                     </select>
                  )}

                  {nuevaColumna.aplicarA === 'INDIVIDUAL' && (
                     <select value={nuevaColumna.musico_id} onChange={e => setNuevaColumna({...nuevaColumna, musico_id: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500">
                        <option value="">-- Seleccionar Músico --</option>
                        {Object.keys(datosMusicos).map(musicoId => {
                           const musico = musicos.find(m => m.id == musicoId);
                           return musico ? <option key={musico.id} value={musico.id}>{musico.nombres} {musico.apellidos}</option> : null;
                        })}
                     </select>
                  )}
               </div>

               {nuevaColumna.nombre && (
                 <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm text-blue-800">
                   <strong>Vista previa:</strong> Se creará la columna <strong>"{nuevaColumna.nombre.toUpperCase()}"</strong> con un descuento de <strong>Bs. {nuevaColumna.monto || '0'}</strong> aplicado a 
                   {nuevaColumna.aplicarA === 'TODOS' ? ' todos los músicos.' : 
                    nuevaColumna.aplicarA === 'SECCION' ? ` la sección ${nuevaColumna.seccion}.` : 
                    nuevaColumna.musico_id ? ' un músico específico.' : ' un músico (seleccione uno).'}
                 </div>
               )}
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button 
                onClick={() => setShowModalColumna(false)}
                className="px-4 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleAgregarColumna}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Guardar Descuento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Pago */}
      {musicoSeleccionadoParaPago && (() => {
          const musico = musicoSeleccionadoParaPago;
          const a = parseInt(datosMusicos[musico.id]?.acordado || 0);
          const m = parseInt(datosMusicos[musico.id]?.multas || 0);
          const ad = parseInt(datosMusicos[musico.id]?.adelantos || 0);
          
          let extraLocal = 0;
          columnasExtra.forEach(col => {
              extraLocal += parseInt(datosMusicos[musico.id]?.[col.id] || 0);
          });

          const final = a - m - ad - extraLocal;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 overflow-hidden">
                <div className="bg-green-600 p-4 text-white flex justify-between items-center shrink-0">
                   <h3 className="text-xl font-black flex items-center gap-2">
                      <FileText className="w-6 h-6"/> Detalle de Pago
                   </h3>
                   <button onClick={() => setMusicoSeleccionadoParaPago(null)} className="text-green-100 hover:text-white transition-colors">
                      <X className="w-5 h-5"/>
                   </button>
                </div>
                
                <div className="p-6 overflow-y-auto">
                    <div className="text-center mb-6">
                       <h4 className="text-xl font-black text-gray-800 uppercase">{musico.nombres} {musico.apellidos}</h4>
                       <p className="text-sm text-gray-500 font-bold mt-1">{musico.instrumento}</p>
                    </div>

                    <div className="space-y-2 mb-6">
                        <div className="flex justify-between items-center bg-gray-50 p-2 rounded-xl border border-gray-100">
                           <span className="text-gray-600 font-bold text-sm">Sueldo</span>
                           <span className="text-gray-900 font-black text-base">Bs. {a.toLocaleString('es-VE', { maximumFractionDigits: 0 })}</span>
                        </div>
                        {m > 0 && (
                            <div className="flex justify-between items-center bg-red-50 p-2 rounded-xl border border-red-100">
                               <span className="text-red-600 font-bold text-sm">Multas y Sanciones</span>
                               <span className="text-red-700 font-black text-base">-Bs. {m.toLocaleString('es-VE', { maximumFractionDigits: 0 })}</span>
                            </div>
                        )}
                        {columnasExtra.map(col => {
                            const val = parseInt(datosMusicos[musico.id]?.[col.id] || 0);
                            return val > 0 ? (
                                <div key={col.id} className="flex justify-between items-center bg-blue-50 p-2 rounded-xl border border-blue-100">
                                   <span className="text-blue-600 font-bold text-sm uppercase">{col.nombre}</span>
                                   <span className="text-blue-700 font-black text-base">-Bs. {val.toLocaleString('es-VE', { maximumFractionDigits: 0 })}</span>
                                </div>
                            ) : null;
                        })}
                        {ad > 0 && (
                            <div className="flex justify-between items-center bg-orange-50 p-2 rounded-xl border border-orange-100">
                               <span className="text-orange-600 font-bold text-sm">Adelantos</span>
                               <span className="text-orange-700 font-black text-base">-Bs. {ad.toLocaleString('es-VE', { maximumFractionDigits: 0 })}</span>
                            </div>
                        )}

                    </div>

                    <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 text-center shadow-inner">
                        <p className="text-green-800 font-bold uppercase tracking-widest text-xs mb-1">Total a Entregar</p>
                        <p className="text-3xl font-black text-green-700">Bs. {final.toLocaleString('es-VE', { maximumFractionDigits: 0 })}</p>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3 shrink-0">
                   <button 
                      onClick={() => setMusicoSeleccionadoParaPago(null)}
                      className="flex-1 py-3 font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors text-sm"
                   >
                      Cancelar
                   </button>
                   <button 
                        onClick={() => handleGuardarIndividual(musico.id)}
                        disabled={loadingIndividual}
                        className="flex-[2] py-3 bg-green-600 hover:bg-green-700 text-white font-black rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 text-sm transform hover:-translate-y-0.5 disabled:opacity-50"
                     >
                        <CheckCircle className="w-5 h-5"/> {loadingIndividual ? 'Guardando...' : 'Guardar Pago'}
                     </button>
                </div>
              </div>
            </div>
          );
      })()}

      {/* Modal de Resumen de Descuentos por Sección */}
      <DescuentosResumenModal
        isOpen={showResumenModal}
        onClose={() => setShowResumenModal(false)}
        resultados={resultadosProcesamiento}
        totalGeneral={totalGeneralDescuentos}
      />

      {/* Sistema de Notificaciones */}
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}

