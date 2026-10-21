import { useState } from 'react'
import { Activity, ArrowRight, Check, CircleCheck, CircleX, Eye, Lightbulb, RotateCcw, Wrench } from 'lucide-react'
import { useTienda } from '../estado/tienda'
import { MODO_PROFESOR } from '../estado/almacen'
import { registrarEvidencia, type Progreso } from '../motor/progreso'
import { agregarPrueba, actuarLaboratorio, CAUSAS, cerrarLaboratorio, confirmarDiagnostico, evidenciaLaboratorio,
  hipotesisCompatibles, ID_LABORATORIO, nuevoLaboratorio, pilotosLaboratorio, RAZONES, reiniciarInvestigacion, reiniciarVerificacion, tableroLaboratorio, verificacionCompleta, type EstadoLaboratorio } from '../motor/laboratorio'
import { redDeDiagnostico } from '../motor/tableros'
import { DibujoLaboratorio } from './DibujoLaboratorio'
import './laboratorio.css'

export function Laboratorio({ unidadId }: { unidadId: string }) {
  const { progreso, cambiar } = useTienda()
  const s = progreso.laboratorios?.[ID_LABORATORIO]
  const [origen, setOrigen] = useState<string>()
  const [emisor, setEmisor] = useState('PC1')
  const [receptor, setReceptor] = useState('PC4')
  const [aviso, setAviso] = useState('')
  const guardar = (nuevo: EstadoLaboratorio, evidencia = false) => cambiar((p) => {
    let q: Progreso = { ...p, laboratorios: { ...p.laboratorios, [ID_LABORATORIO]: nuevo } }
    if (evidencia) q = registrarEvidencia(q, { fecha: nuevo.completado!, tipo: 'caso', unidadId, conceptos: ['top-arbol', 'top-estrella', 'nic'],
      actividad: `${ID_LABORATORIO}:${nuevo.variante}`, acierto: true, ayudas: nuevo.ayudas, detalle: evidenciaLaboratorio(nuevo) })
    return q
  })
  if (!s) return <section className="panel lab-presentacion">
    <span className="sobretitulo">Laboratorio · modelo conceptual</span><h2>Dos plantas, una avería</h2>
    <p>Investiga una red, explica qué pruebas sostienen tu diagnóstico, restablece el componente y comprueba el resultado. {MODO_PROFESOR ? 'Este perfil ficticio mantiene el avance en esta pestaña, sin guardarlo.' : 'El laboratorio guarda tu avance para retomarlo.'} La avería cambia al repetirlo.</p>
    <p className="ayuda">PC1–PC3 están en la planta baja (Switch A); PC4–PC5, en la alta (Switch B). El switch raíz une ambas. Si falla un switch de una planta, su rama pierde la comunicación. Si falla el raíz, cada planta puede comunicarse internamente. Si falla el cable de un PC, se aísla ese equipo.</p>
    <button className="btn principal" onClick={() => guardar(nuevoLaboratorio())}>Empezar el laboratorio <ArrowRight size={17} /></button>
    <p className="fuente">Temario Redes UD1, pág. 3; resumen págs. 3 y 7. Es una simulación; no modifica equipos reales ni acredita mantenimiento físico.</p>
  </section>
  const reparado = s.fase === 'verificar' || s.fase === 'completado'
  const puedeProbar = s.fase === 'investigar' || s.fase === 'verificar'
  const probar = (a: string, b: string) => {
    const nuevo = agregarPrueba(s, a, b)
    setAviso(nuevo === s ? 'Esa pareja ya está probada en esta fase o has usado las seis pruebas. Elige otra comparación.' : '')
    guardar(nuevo); setOrigen(undefined)
  }
  const dibujar = (id: string) => {
    if (!puedeProbar || !id.startsWith('PC')) return
    if (!origen) { setOrigen(id); return }
    if (origen === id) { setOrigen(undefined); return }
    probar(origen, id)
  }
  const fuentes = <small className="fuente">Temario Redes UD1, pág. 3; resumen págs. 3 y 7. Modelo con una sola avería: en equipos reales hacen falta comprobaciones adicionales.</small>
  return <section className="panel laboratorio">
    <header className="lab-cabecera"><div><span className="sobretitulo">{MODO_PROFESOR ? 'Laboratorio · perfil ficticio sin guardado' : 'Laboratorio · tu avance se conserva'}</span><h2>Dos plantas, una avería</h2></div><Activity size={28} aria-hidden /></header>
    <ol className="lab-fases" aria-label="Avance del laboratorio">{['Investigar y justificar', 'Actuar', 'Verificar'].map((nombre, i) => {
      const fase = ['investigar', 'actuar', 'verificar', 'completado'].indexOf(s.fase)
      return <li key={nombre} className={fase > i ? 'hecho' : fase === i ? 'actual' : ''} aria-current={fase === i ? 'step' : undefined}><span>{fase > i ? '✓' : i + 1}</span>{nombre}</li>
    })}</ol>
    <div className="lab-rejilla"><div className="lab-red">
      <p>Planta baja: PC1–PC3 · planta alta: PC4–PC5</p>
      <DibujoLaboratorio red={redDeDiagnostico(tableroLaboratorio(s.variante))} onPc={puedeProbar ? dibujar : undefined} origen={origen} ultima={s.pruebas.at(-1)} pilotos={s.pilotos || reparado ? pilotosLaboratorio(s) : undefined} />
      {puedeProbar && <p className="lab-instruccion" role="status">{origen ? `Ahora elige a quién intentará comunicarse ${origen}.` : 'Pulsa un PC que envía y después otro que recibe.'}</p>}
      {puedeProbar && <form className="lab-prueba-movil" onSubmit={(e) => { e.preventDefault(); probar(emisor, receptor) }}>
        <label>Desde<select value={emisor} onChange={(e) => setEmisor(e.target.value)}>{['PC1','PC2','PC3','PC4','PC5'].map((pc) => <option key={pc}>{pc}</option>)}</select></label>
        <label>Hacia<select value={receptor} onChange={(e) => setReceptor(e.target.value)}>{['PC1','PC2','PC3','PC4','PC5'].map((pc) => <option key={pc}>{pc}</option>)}</select></label>
        <button className="btn secundario" disabled={emisor === receptor}>Probar pareja</button>
        {emisor === receptor && <small>Elige dos PCs distintos.</small>}
      </form>}
      {aviso && s.fase !== 'investigar' && <p role="status" className="ayuda">{aviso}</p>}
      {s.fase === 'investigar' && <div className="fila-botones">
        <button className="btn secundario" disabled={s.pilotos} onClick={() => guardar({ ...s, pilotos: true })}><Eye size={16} /> Mirar pilotos</button>
        <button className="btn texto" disabled={s.ayudas > 0} onClick={() => guardar({ ...s, ayudas: 1 })}><Lightbulb size={16} /> Una pista</button>
      </div>}
      {s.ayudas > 0 && <p className="lab-pista">Compara una prueba dentro de cada planta y otra entre plantas. Los pilotos ayudan a distinguir un equipo aislado de una rama sin enlace.</p>}
    </div><aside className="lab-cuaderno" aria-label="Cuaderno de pruebas">
      <h3>Tu cuaderno de pruebas</h3>
      {s.pruebas.length === 0
        ? <p className="lab-cuaderno-vacio">Cada prueba se anotará aquí: qué PC envía, cuál recibe y si se comunican. Compara resultados antes de decidir.</p>
        : <ol>{s.pruebas.map((p, i) => {
          const ultima = i === s.pruebas.length - 1
          return <li key={i} className={`${p.ok ? 'ok' : 'ko'} ${ultima ? 'ultima' : ''}`} aria-current={ultima ? 'true' : undefined}>
            <span>{p.despues ? 'Después de actuar' : 'Antes de actuar'}{ultima && ' · última prueba'}</span>
            <b>{p.a} → {p.b}</b>
            <small className="lab-resultado">{p.ok ? <CircleCheck size={16} aria-hidden /> : <CircleX size={16} aria-hidden />}{p.ok ? 'Se comunican' : 'No se comunican'}</small>
          </li>
        })}</ol>}
      {s.fase === 'investigar' && <small>{6 - s.pruebas.filter((p) => !p.despues).length} pruebas disponibles. Puedes repetir tras actuar.</small>}
      {s.fase === 'investigar' && s.pruebas.length === 6 && <button className="btn secundario" onClick={() => { guardar(reiniciarInvestigacion(s)); setOrigen(undefined); setAviso('') }}><RotateCcw size={16} /> Repetir la investigación</button>}
    </aside></div>
    {s.fase === 'investigar' && <div className="lab-decision">
      <fieldset><legend>1. ¿Qué componente revisarías?</legend><div className="lab-opciones">{CAUSAS.map((c) => <button key={c.id} className={`opcion ${s.causa === c.id ? 'elegida' : ''}`} aria-pressed={s.causa === c.id} onClick={() => guardar({ ...s, causa: c.id })}>{c.etiqueta}</button>)}</div></fieldset>
      <fieldset><legend>2. ¿Qué comparación respalda tu decisión?</legend><div className="opciones">{Object.entries(RAZONES).map(([id, texto]) => <button key={id} className={`opcion ${s.justificacion === id ? 'elegida' : ''}`} aria-pressed={s.justificacion === id} onClick={() => guardar({ ...s, justificacion: id as EstadoLaboratorio['variante'] })}>{texto}</button>)}</div></fieldset>
      <p className="ayuda">Haz al menos dos pruebas distintas. Si aún hay varias causas posibles, busca una comparación que las distinga.</p>
      <button className="btn principal" disabled={s.pruebas.length < 2 || !s.causa || !s.justificacion} onClick={() => {
        const nuevo = confirmarDiagnostico(s); guardar(nuevo)
        setAviso(nuevo.fase === 'actuar' ? '' : !s.pruebas.some((p) => !p.ok) ? 'Antes de actuar, prueba una comunicación afectada por la avería. Necesitas compararla después.' : hipotesisCompatibles(s).length > 1 ? 'Tus pruebas todavía admiten varias causas. Compara otra pareja o mira los pilotos.' : 'El diagnóstico o su explicación no encajan con tus pruebas. Revísalos antes de actuar.')
      }}>Confirmar diagnóstico y evidencia <ArrowRight size={17} /></button>
      {aviso && <p role="status" className="lab-aviso">{aviso}</p>}
    </div>}
    {s.fase === 'actuar' && <div className="lab-cierre" role="status"><h3>El diagnóstico encaja con las pruebas</h3><p>{RAZONES[s.variante]}</p><p>En el modelo, restablece {CAUSAS.find((c) => c.id === s.causa)?.etiqueta}. Después comprueba la comunicación; actuar no cierra por sí solo el caso.</p><button className="btn principal" onClick={() => { guardar(actuarLaboratorio(s)); setOrigen(undefined) }}><Wrench size={17} /> Restablecer el componente en el modelo</button></div>}
    {s.fase === 'verificar' && <div className="lab-cierre"><h3>Comprueba el resultado de tu actuación</h3><p>Repite una pareja que antes fallaba y comprueba también comunicación entre plantas. Necesitas dos parejas distintas; mira cómo cambian los resultados.</p><div className="fila-botones"><button className="btn principal" disabled={!verificacionCompleta(s)} onClick={() => guardar(cerrarLaboratorio(s), true)}><Check size={17} /> Cerrar con la verificación</button><button className="btn texto" onClick={() => { guardar(reiniciarVerificacion(s)); setOrigen(undefined); setAviso('') }}><RotateCcw size={16} /> Repetir las pruebas de verificación</button></div></div>}
    {s.fase === 'completado' && <div className="lab-cierre bien" role="status"><h3>Diagnóstico, actuación y verificación completados</h3><p>Has relacionado las pruebas con una causa y comprobado la comunicación después de actuar{s.ayudas ? ' con una pista' : ' sin pistas'}. Esta muestra ya está en tu informe.</p><button className="btn secundario" onClick={() => { guardar(nuevoLaboratorio(s)); setOrigen(undefined); setAviso('') }}><RotateCcw size={17} /> Probar otra avería</button></div>}
    {fuentes}
  </section>
}
