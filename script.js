let pyodide = null;
let READY = false;

// tiny helpers para obtener elementos
const $ = id => document.getElementById(id);
const els = {
  enterBtn: () => $('enter-btn'),
  landing: () => $('landing'),
  app: () => $('app'),
  openManual: () => $('openManual'),
  closeManual: () => $('closeManual'),
  // registro
  inpFila: () => $('inp-fila'),
  inpCol: () => $('inp-col'),
  inpTipo: () => $('inp-tipo'),
  inpUbic: () => $('inp-ubic'),
  inpLote: () => $('inp-lote'),
  inpVenc: () => $('inp-venc'),
  inpCond: () => $('inp-cond'),
  msgRegistrar: () => $('msg-registrar'),
  // operaciones
  tipoAnalizar: () => $('tipo-analizar'),
  btnConstruir: () => $('btn-construir'),
  btnFefo: () => $('btn-fefo'),
  btnRiesgo: () => $('btn-riesgo'),
  btnCompare: () => $('btn-compare'),
  btnMostrar: () => $('btn-mostrar'),
  btnExport: () => $('btn-export'),
  btnRellenar: () => $('btn-rellenar'),
  btnRegistrar: () => $('btn-registrar'),
  // derecha
  tablaContainer: () => $('tabla-container'),
  outputLog: () => $('output-log'),
  btnStats: () => $('btn-stats'),
  statsArea: () => $('stats-area'),
  tipoRetirar: () => $('tipo-retirar'),
  cantRetirar: () => $('cant-retirar'),
  btnRetirar: () => $('btn-retirar'),
  retirarMsg: () => $('retirar-msg')
};

// Carga Pyodide y define funciones Python
async function loadPy() {
  try {
    pyodide = await loadPyodide();
  } catch (e) {
    console.error("Error cargando Pyodide:", e);
    if (els.outputLog()) els.outputLog().textContent = "❌ Error cargando Pyodide: " + e;
    return;
  }

  const pyCode = `
import random, json
from datetime import datetime

# matriz 32x32 en memoria (cada celda: dict o None)
matriz = [[None for _ in range(32)] for _ in range(32)]

def registrar_medicamento(f,c,tipo,ubic,lote,venc,cond):
    # f,c deben ser 0-based
    if not (0 <= f < 32 and 0 <= c < 32):
        return "❌ Ubicación fuera de rango"
    # validar fecha
    try:
        if venc:
            datetime.strptime(venc, "%Y-%m-%d")
    except:
        return "❌ Fecha inválida (YYYY-MM-DD)"
    if matriz[f][c] is not None:
        return "⚠ Ya existe un medicamento en esa celda"
    matriz[f][c] = {"tipo":tipo,"ubic":ubic,"lote":lote,"venc":venc,"cond":cond}
    return "✔ Medicamento registrado"

def rellenar_ejemplo(n=50):
    meds = ["Analgésico","Antibiótico","Vitamina","Vacuna","Antiviral"]
    added = 0
    for _ in range(n):
        f=random.randint(0,31)
        c=random.randint(0,31)
        if matriz[f][c] is None:
            matriz[f][c] = {
                "tipo": random.choice(meds),
                "ubic": "Estante " + str(random.randint(1,5)),
                "lote": "L" + str(random.randint(100,999)),
                "venc": "202" + str(random.randint(4,6)) + "-0" + str(random.randint(1,9)) + "-15",
                "cond": "Seco"
            }
            added += 1
    return f"✔ {added} registros generados"

def estadisticas():
    tipos = {"Analgésico":0,"Antibiótico":0,"Vitamina":0,"Vacuna":0,"Antiviral":0}
    total = 0
    for i in range(32):
        for j in range(32):
            cel = matriz[i][j]
            if cel:
                total += 1
                t = cel.get("tipo")
                if t in tipos:
                    tipos[t] += 1
    return json.dumps({"total": total, "tipos": tipos})

def retirar(tipo, cantidad):
    retirados = 0
    # FEFO-like removal pero simple: ordenar por vencimiento asc y eliminar hasta cantidad
    items = []
    for i in range(32):
        for j in range(32):
            cel = matriz[i][j]
            if cel and cel.get("tipo")==tipo:
                venc = cel.get("venc") or "9999-12-31"
                try:
                    d = datetime.strptime(venc,"%Y-%m-%d")
                except:
                    d = datetime(9999,12,31)
                items.append((d,i,j))
    items.sort()  # por vencimiento asc, tiebreaker: fila/col por orden natural
    for _, i, j in items:
        if retirados >= cantidad:
            break
        if matriz[i][j] and matriz[i][j].get("tipo")==tipo:
            matriz[i][j] = None
            retirados += 1
    stats = json.loads(estadisticas())
    return json.dumps({"retirados": retirados, "stats": stats})

def construir_A(tipo):
    A = [[0]*32 for _ in range(32)]
    for i in range(32):
        for j in range(32):
            cel = matriz[i][j]
            if cel and cel.get("tipo")==tipo:
                A[i][j] = 1
    return json.dumps(A)

def fefo(tipo):
    arr = []
    for i in range(32):
        for j in range(32):
            cel = matriz[i][j]
            if cel and cel.get("tipo")==tipo:
                venc = cel.get("venc") or "9999-12-31"
                try:
                    d = datetime.strptime(venc,"%Y-%m-%d")
                except:
                    d = datetime(9999,12,31)
                arr.append((d, venc, i+1, j+1, cel.get("lote","")))
    arr.sort()
    if not arr:
        return "⚠ No hay medicamentos de ese tipo"
    # devolver líneas legibles
    lines = [f"{v} | lote:{l} | ({r},{c})" for (d,v,r,c,l) in arr]
    return "\\n".join(lines)

def riesgo(tipo):
    hoy = datetime.now()
    out = []
    for i in range(32):
        for j in range(32):
            cel = matriz[i][j]
            if cel and cel.get("tipo")==tipo:
                venc = cel.get("venc")
                if not venc:
                    continue
                try:
                    d = datetime.strptime(venc, "%Y-%m-%d")
                    dias = (d - hoy).days
                    if dias <= 60:
                        out.append(f"lote {cel.get('lote','')} vence en {dias} días en ({i+1},{j+1})")
                except:
                    pass
    return "\\n".join(out) if out else "Sin riesgos cercanos"

def matriz_texto():
    lines = []
    for i in range(32):
        row = []
        for j in range(32):
            cel = matriz[i][j]
            if cel:
                row.append(f\"{cel.get('tipo','')}|{cel.get('lote','')}|{cel.get('venc','')}\")
            else:
                row.append("-")
        lines.append(",".join(row))
    return "\\n".join(lines)

def matriz_html():
    h = "<table>"
    h += "<tr><th></th>"
    for col in range(32):
        h += f"<th>{col+1}</th>"
    h += "</tr>"
    for i in range(32):
        h += f"<tr><th>{i+1}</th>"
        for j in range(32):
            cel = matriz[i][j]
            if cel is None:
                clase = "tipo-vacio"
                texto = "-"
                info = "Vacío"
            else:
                tipo = (cel.get('tipo') or "").lower()
                if "analg" in tipo:
                    clase = "tipo-analgesico"
                elif "antib" in tipo:
                    clase = "tipo-antibiotico"
                elif "vit" in tipo:
                    clase = "tipo-vitamina"
                elif "vac" in tipo:
                    clase = "tipo-vacuna"
                elif "antiv" in tipo:
                    clase = "tipo-antiviral"
                else:
                    clase = "tipo-vacio"
                texto = cel.get('tipo','')
                info = (f\"Tipo: {cel.get('tipo','')}<br>Lote: {cel.get('lote','')}<br>Venc: {cel.get('venc','')}<br>Ubicación: {cel.get('ubic','')}<br>Cond: {cel.get('cond','')}\")
            h += f\"\"\"<td class='{clase}'>{texto}<div class='coord'>({i+1},{j+1})</div><div class='tooltip'>{info}</div></td>\"\"\"
        h += "</tr>"
    return h + "</table>"
`;
  // ejecutar en pyodide
  await pyodide.runPythonAsync(pyCode);
  READY = true;
  if (els.outputLog()) els.outputLog().textContent = "Pyodide listo ✓";
  enableUI(true);
}

// habilitar/deshabilitar botones mientras Pyodide carga
function enableUI(enabled) {
  const list = [
    els.btnConstruir(), els.btnFefo(), els.btnRiesgo(), els.btnCompare(),
    els.btnMostrar(), els.btnExport(), els.btnRellenar(), els.btnRegistrar(),
    els.btnStats(), els.btnRetirar()
  ];
  list.forEach(b => { if (b) b.disabled = !enabled; });
}

// ejecutar Python
function py(code) {
  if (!pyodide) return Promise.reject("Pyodide no cargado");
  return pyodide.runPythonAsync(code);
}

// inicializo UI y eventos
window.addEventListener("DOMContentLoaded", async () => {
  enableUI(false);
  if (els.outputLog()) els.outputLog().textContent = "Cargando Pyodide...";
  await loadPy();

  // Entrar
  if (els.enterBtn()) els.enterBtn().onclick = () => {
    els.landing().classList.add("hidden");
    els.app().classList.remove("hidden");
    feather.replace();
  };

  // Manual modal
  if (els.openManual()) els.openManual().onclick = () => {
    document.getElementById("manualModal").style.display = "flex";
    feather.replace();
  };
  if (els.closeManual()) els.closeManual().onclick = () => {
    document.getElementById("manualModal").style.display = "none";
  };
  window.onclick = (e) => { if (e.target === document.getElementById("manualModal")) document.getElementById("manualModal").style.display = "none"; };

  // Registrar
  if (els.btnRegistrar()) els.btnRegistrar().onclick = async () => {
    try {
      // convertir inputs 1..32 a 0-based
      const f = parseInt(els.inpFila().value) - 1;
      const c = parseInt(els.inpCol().value) - 1;
      const tipo = els.inpTipo().value || "";
      const ubic = els.inpUbic().value || "";
      const lote = els.inpLote().value || "";
      const venc = els.inpVenc().value || "";
      const cond = els.inpCond().value || "";
      const r = await py(`registrar_medicamento(${f},${c},"${tipo}","${ubic}","${lote}","${venc}","${cond}")`);
      els.msgRegistrar().textContent = r;
      await renderMatriz();
    } catch (e) {
      console.error(e);
      if (els.msgRegistrar()) els.msgRegistrar().textContent = "❌ Error al registrar";
    }
  };

  // rellenar ejemplo
  if (els.btnRellenar()) els.btnRellenar().onclick = async () => {
    const r = await py(`rellenar_ejemplo()`);
    if (els.msgRegistrar()) els.msgRegistrar().textContent = r;
    await renderMatriz();
  };

  // mostrar matriz
  if (els.btnMostrar()) els.btnMostrar().onclick = () => renderMatriz();

  // exportar
  if (els.btnExport()) els.btnExport().onclick = async () => {
    try {
      const txt = await py(`matriz_texto()`);
      download("matriz.txt", txt);
    } catch (e) {
      if (els.outputLog()) els.outputLog().textContent = "❌ Error exportando: " + e;
    }
  };

  // construir A
  if (els.btnConstruir()) els.btnConstruir().onclick = async () => {
    try {
      const tipo = els.tipoAnalizar().value;
      const A_json = await py(`construir_A("${tipo}")`);
      const A = JSON.parse(A_json);
      if (els.outputLog()) els.outputLog().textContent = "✓ Matriz A generada (ejemplo fila 1):\n" + JSON.stringify(A[0]);
    } catch (e) {
      if (els.outputLog()) els.outputLog().textContent = "❌ Error construir A: " + e;
    }
  };

  // FEFO
  if (els.btnFefo()) els.btnFefo().onclick = async () => {
    try {
      const tipo = els.tipoAnalizar().value;
      const r = await py(`fefo("${tipo}")`);
      if (els.outputLog()) els.outputLog().textContent = "✓ FEFO:\n" + r;
    } catch (e) {
      if (els.outputLog()) els.outputLog().textContent = "❌ Error FEFO: " + e;
    }
  };

  // RIESGO
  if (els.btnRiesgo()) els.btnRiesgo().onclick = async () => {
    try {
      const tipo = els.tipoAnalizar().value;
      const r = await py(`riesgo("${tipo}")`);
      if (els.outputLog()) els.outputLog().textContent = "⚠ Riesgo:\n" + r;
    } catch (e) {
      if (els.outputLog()) els.outputLog().textContent = "❌ Error Riesgo: " + e;
    }
  };

  // comparar tiempos (simulado)
  if (els.btnCompare()) els.btnCompare().onclick = () => {
    if (els.outputLog()) els.outputLog().textContent = "✓ Comparación de tiempos:\nReducción del tiempo promedio: 40% (simulado)";
  };

  // estadísticas
  if (els.btnStats()) els.btnStats().onclick = async () => {
    try {
      const r = await py(`estadisticas()`);
      const data = JSON.parse(r);
      if (els.statsArea()) els.statsArea().innerHTML = `
        <strong>Total registrados:</strong> ${data.total}<br><br>
        Analgésicos: ${data.tipos["Analgésico"]}<br>
        Antibióticos: ${data.tipos["Antibiótico"]}<br>
        Vitaminas: ${data.tipos["Vitamina"]}<br>
        Vacunas: ${data.tipos["Vacuna"]}<br>
        Antivirales: ${data.tipos["Antiviral"]}
      `;
    } catch (e) {
      if (els.outputLog()) els.outputLog().textContent = "❌ Error estadísticas: " + e;
    }
  };

  // retirar
  if (els.btnRetirar()) els.btnRetirar().onclick = async () => {
    try {
      const tipo = els.tipoRetirar().value;
      const cant = parseInt(els.cantRetirar().value) || 0;
      if (cant <= 0) { if (els.retirarMsg()) els.retirarMsg().textContent = "Cantidad inválida"; return; }
      const r = await py(`retirar("${tipo}", ${cant})`);
      const obj = JSON.parse(r);
      if (els.retirarMsg()) els.retirarMsg().textContent = `Se retiraron ${obj.retirados} unidades de ${tipo}`;
      await renderMatriz();
      // actualizar stats visualmente
      if (els.btnStats()) els.btnStats().click();
    } catch (e) {
      if (els.retirarMsg()) els.retirarMsg().textContent = "❌ Error retirar";
    }
  };
});

// renderizar tabla
async function renderMatriz(){
  try {
    const h = await py(`matriz_html()`);
    if (els.tablaContainer()) els.tablaContainer().innerHTML = h;
  } catch (e) {
    if (els.outputLog()) els.outputLog().textContent = "❌ Error renderizando matriz: " + e;
  }
}

// descarga
function download(name, text){
  const a = document.createElement('a');
  a.href = "data:text/plain;charset=utf-8," + encodeURIComponent(text);
  a.download = name;
  a.click();
}
