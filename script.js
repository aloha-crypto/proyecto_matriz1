// script.js — versión estable y sin errores

let pyodide = null;
let loadPyPromise = null;

// =============================
// CARGA DE PYODIDE (y definiciones Python)
// =============================
async function loadPy() {
  // carga pyodide y define las funciones Python (matriz, registrar, etc.)
  pyodide = await loadPyodide();

  await pyodide.runPythonAsync(`
import random, json
from datetime import datetime

matriz = [[None for _ in range(32)] for _ in range(32)]

def registrar_medicamento(f,c,tipo,ubic,lote,venc,cond):
    if not (0 <= f < 32 and 0 <= c < 32):
        return "Ubicación fuera de rango"
    if venc:
        try:
            datetime.strptime(venc, "%Y-%m-%d")
        except:
            return "Fecha inválida"
    if matriz[f][c] != None:
        return "Ya existe un medicamento en esa celda"
    matriz[f][c] = {
        "tipo": tipo,
        "ubic": ubic,
        "lote": lote,
        "venc": venc,
        "cond": cond
    }
    return "Medicamento registrado"

def rellenar_ejemplo(n=50):
    meds = ["Analgésico","Antibiótico","Vitamina","Vacuna","Antiviral"]
    for _ in range(n):
        f=random.randint(0,31)
        c=random.randint(0,31)
        matriz[f][c]={
            "tipo":random.choice(meds),
            "ubic":"Estante "+str(random.randint(1,5)),
            "lote":"L"+str(random.randint(100,999)),
            "venc":"2025-0"+str(random.randint(1,9))+"-15",
            "cond":"Seco"
        }
    return "Registros generados"

def estadisticas():
    tipos = {"Analgésico":0,"Antibiótico":0,"Vitamina":0,"Vacuna":0,"Antiviral":0}
    total=0
    for i in range(32):
        for j in range(32):
            cel = matriz[i][j]
            if cel:
                total+=1
                t = cel.get("tipo","")
                if t in tipos:
                    tipos[t]+=1
    return json.dumps({"total": total, "tipos": tipos})

def retirar(tipo, cantidad):
    retirados=0
    for i in range(32):
        for j in range(32):
            if retirados>=cantidad:
                break
            cel=matriz[i][j]
            if cel and cel.get("tipo")==tipo:
                matriz[i][j]=None
                retirados+=1
        if retirados>=cantidad:
            break
    stats=json.loads(estadisticas())
    return json.dumps({"retirados":retirados, "stats":stats})

def construir_A(tipo):
    A=[]
    for i in range(32):
        fila=[]
        for j in range(32):
            cel=matriz[i][j]
            fila.append(1 if (cel and cel.get("tipo")==tipo) else 0)
        A.append(fila)
    return json.dumps(A)

def fefo(tipo):
    lista=[]
    for i in range(32):
        for j in range(32):
            cel=matriz[i][j]
            if cel and cel.get("tipo")==tipo:
                lista.append({
                    "fila": i+1,
                    "col": j+1,
                    "lote": cel.get("lote",""),
                    "venc": cel.get("venc","")
                })
    lista.sort(key=lambda x: x["venc"] if x["venc"] else "9999-99-99")
    return json.dumps(lista)

def riesgo(tipo):
    return fefo(tipo)

def matriz_texto():
    out=""
    for i in range(32):
        for j in range(32):
            cel=matriz[i][j]
            if cel:
                out+=f"({i+1},{j+1}) {cel.get('tipo','')} | Lote {cel.get('lote','')} | Vence {cel.get('venc','')}\\n"
            else:
                out+=f"({i+1},{j+1}) Vacío\\n"
    return out

def matriz_html():
    h="<table>"
    h+="<tr><th></th>"
    for col in range(32):
        h+=f"<th>{col+1}</th>"
    h+="</tr>"
    for i in range(32):
        h+=f"<tr><th>{i+1}</th>"
        for j in range(32):
            cel=matriz[i][j]
            if cel is None:
                clase="tipo-vacio"; texto="-"; info="Vacío"
            else:
                tipo=cel.get("tipo","").lower()
                if "analg" in tipo: clase="tipo-analgesico"
                elif "antib" in tipo: clase="tipo-antibiotico"
                elif "vit" in tipo: clase="tipo-vitamina"
                elif "vac" in tipo: clase="tipo-vacuna"
                elif "antiv" in tipo: clase="tipo-antiviral"
                else: clase="tipo-vacio"
                texto=cel.get("tipo","")
                info=(f"Tipo: {texto}<br>"
                      f"Lote: {cel.get('lote','')}<br>"
                      f"Venc: {cel.get('venc','')}<br>"
                      f"Ubicación: {cel.get('ubic','')}<br>"
                      f"Condiciones: {cel.get('cond','')}")
            h+=("<td class='%s'>%s"
                "<div class='coord'>(%d,%d)</div>"
                "<div class='tooltip'>%s</div></td>"
                % (clase,texto,i+1,j+1,info))
        h+="</tr>"
    return h+"</table>"
`);
}

// iniciar carga (promesa)
loadPyPromise = loadPy();

// =============================
// UTILIDADES JS
// =============================
async function py(code){
  // espera a que pyodide y defs estén listas
  try {
    await loadPyPromise;
    return await pyodide.runPythonAsync(code);
  } catch (err) {
    // propagar error para que quien llame lo capture
    throw err;
  }
}
function el(id){
  return document.getElementById(id);
}
function safeSetInner(id, html){
  const e = el(id);
  if(e) e.innerHTML = html;
}

// =============================
// INICIALIZACIÓN DE UI (cuando DOM listo)
// =============================
document.addEventListener("DOMContentLoaded", () => {

  // mejorar estilo del log si existe
  if(el("output-log")){
    el("output-log").style.whiteSpace = "pre-wrap";
    el("output-log").style.overflowY = "auto";
  }

  // iconos (si feather está cargado)
  if(typeof feather !== "undefined" && feather.replace) {
    feather.replace();
  }

  // BOTÓN ENTRAR
  if(el("enter-btn")){
    el("enter-btn").onclick = ()=>{
      el("landing").classList.add("hidden");
      el("app").classList.remove("hidden");
      if(typeof feather !== "undefined" && feather.replace) feather.replace();
    };
  }

  // MANUAL modal
  if(el("openManual")) el("openManual").onclick = ()=> el("manualModal").style.display="flex";
  if(el("closeManual")) el("closeManual").onclick = ()=> el("manualModal").style.display="none";
  window.onclick = (e)=>{ if(e.target === el("manualModal")) el("manualModal").style.display="none"; };

  // REGISTRAR
  if(el("btn-registrar")){
    el("btn-registrar").onclick = async ()=>{
      try {
        let f = parseInt(el("inp-fila").value)-1;
        let c = parseInt(el("inp-col").value)-1;

        if(isNaN(f) || isNaN(c) || f<0||f>31||c<0||c>31){
          if(el("msg-registrar")) el("msg-registrar").textContent="Fila o columna fuera de rango";
          return;
        }

        let tipo = el("inp-tipo").value || "";
        let ubic = el("inp-ubic").value || "";
        let lote = el("inp-lote").value || "";
        let venc = el("inp-venc").value || "";
        let cond = el("inp-cond").value || "";

        let call = "registrar_medicamento(" +
          f + "," + c + "," +
          JSON.stringify(tipo) + "," +
          JSON.stringify(ubic) + "," +
          JSON.stringify(lote) + "," +
          JSON.stringify(venc) + "," +
          JSON.stringify(cond) + ")";

        const r = await py(call);
        if(el("msg-registrar")) el("msg-registrar").textContent = r;
        await renderMatriz();
      } catch (err) {
        if(el("msg-registrar")) el("msg-registrar").textContent = "Error: " + err;
        console.error(err);
      }
    };
  }

  // RELLENAR
  if(el("btn-rellenar")){
    el("btn-rellenar").onclick = async ()=>{
      try {
        const r = await py("rellenar_ejemplo()");
        if(el("msg-registrar")) el("msg-registrar").textContent = r;
        await renderMatriz();
      } catch(err) {
        if(el("msg-registrar")) el("msg-registrar").textContent = "Error: " + err;
        console.error(err);
      }
    };
  }

  // MOSTRAR MATRIZ
  if(el("btn-mostrar")){
    el("btn-mostrar").onclick = async ()=> {
      try { await renderMatriz(); } catch(err){ console.error(err); }
    };
  }

  // EXPORTAR
  if(el("btn-export")){
    el("btn-export").onclick = async ()=>{
      try {
        const txt = await py("matriz_texto()");
        download("matriz.txt", txt);
      } catch(err){
        console.error(err);
        if(el("output-log")) el("output-log").textContent = "Error exportando: " + err;
      }
    };
  }

  // OPERACIONES: construir, fefo, riesgo, comparar
  if(el("btn-construir")){
    el("btn-construir").onclick = async ()=>{
      const tipo = el("tipo-analizar").value;
      try {
        const data = await py("construir_A(" + JSON.stringify(tipo) + ")");
        const A = JSON.parse(data);
        const texto = A.map((fila,i)=> `Fila ${i+1}: ${fila.join(" ")}`).join("\n");
        if(el("output-log")) el("output-log").textContent = "Matriz A completa (1 = coincide tipo):\n\n" + texto;
      } catch(err){
        if(el("output-log")) el("output-log").textContent="Error: "+err;
        console.error(err);
      }
    };
  }

  if(el("btn-fefo")){
    el("btn-fefo").onclick = async ()=>{
      const tipo = el("tipo-analizar").value;
      try {
        const data = await py("fefo(" + JSON.stringify(tipo) + ")");
        const lista = JSON.parse(data);
        if(lista.length===0){
          if(el("output-log")) el("output-log").textContent="No hay medicamentos de este tipo.";
          return;
        }
        const texto = lista.map(item =>
          `Fila ${item.fila}, Col ${item.col}\n  Lote: ${item.lote}\n  Vencimiento: ${item.venc}`
        ).join("\n\n");
        if(el("output-log")) el("output-log").textContent = "Lista FEFO completa (ordenada por vencimiento):\n\n" + texto;
      } catch(err){
        if(el("output-log")) el("output-log").textContent="Error: "+err;
        console.error(err);
      }
    };
  }

  if(el("btn-riesgo")){
    el("btn-riesgo").onclick = async ()=>{
      const tipo = el("tipo-analizar").value;
      try {
        const data = await py("fefo(" + JSON.stringify(tipo) + ")");
        const lista = JSON.parse(data);
        if(lista.length===0){
          if(el("output-log")) el("output-log").textContent="No hay medicamentos de este tipo.";
          return;
        }
        const texto = lista.map((item,i)=>
          `${i+1}. Fila ${item.fila}, Col ${item.col} — Vencimiento: ${item.venc}`
        ).join("\n");
        if(el("output-log")) el("output-log").textContent = "Lista completa de riesgo (ordenada por vencimiento):\n\n" + texto;
      } catch(err){
        if(el("output-log")) el("output-log").textContent="Error: "+err;
        console.error(err);
      }
    };
  }

  if(el("btn-compare")){
    el("btn-compare").onclick = async () => {
      try {
        const tipo = el("tipo-analizar").value;
        const inicio = performance.now();
        await py("fefo(" + JSON.stringify(tipo) + ")");
        const fin = performance.now();
        const tiempo = (fin - inicio).toFixed(2);
        if(el("output-log")) el("output-log").textContent = "Tiempo estimado de procesamiento: " + tiempo + " ms";
      } catch (err) {
        if(el("output-log")) el("output-log").textContent = "Error: " + err;
        console.error(err);
      }
    };
  }

  // ESTADÍSTICAS
  if(el("btn-stats")){
    el("btn-stats").onclick = async ()=>{
      try{
        const data = await py("estadisticas()");
        const d = JSON.parse(data);
        safeSetInner("stats-area",
          "<strong>Total:</strong> " + d.total + "<br>" +
          "Analgésicos: " + d.tipos["Analgésico"] + "<br>" +
          "Antibióticos: " + d.tipos["Antibiótico"] + "<br>" +
          "Vitaminas: " + d.tipos["Vitamina"] + "<br>" +
          "Vacunas: " + d.tipos["Vacuna"] + "<br>" +
          "Antivirales: " + d.tipos["Antiviral"]
        );
      }catch(err){
        if(el("stats-area")) el("stats-area").textContent="Error: "+err;
        console.error(err);
      }
    };
  }

  // RETIRAR
  if(el("btn-retirar")){
    el("btn-retirar").onclick = async ()=>{
      const tipo = el("tipo-retirar").value;
      const cant = parseInt(el("cant-retirar").value)||0;
      if(cant<=0){
        if(el("retirar-msg")) el("retirar-msg").textContent="Cantidad inválida";
        return;
      }
      try {
        const data = await py("retirar(" + JSON.stringify(tipo) + "," + cant + ")");
        const obj = JSON.parse(data);
        if(el("retirar-msg")) el("retirar-msg").textContent = "Se retiraron " + obj.retirados + " unidades.";
        await renderMatriz();
        const d = obj.stats;
        safeSetInner("stats-area",
          "<strong>Total:</strong> " + d.total + "<br>" +
          "Analgésicos: " + d.tipos["Analgésico"] + "<br>" +
          "Antibióticos: " + d.tipos["Antibiótico"] + "<br>" +
          "Vitaminas: " + d.tipos["Vitamina"] + "<br>" +
          "Vacunas: " + d.tipos["Vacuna"] + "<br>" +
          "Antivirales: " + d.tipos["Antiviral"]
        );
      } catch(err){
        if(el("retirar-msg")) el("retirar-msg").textContent="Error: "+err;
        console.error(err);
      }
    };
  }

  // CALCULO DE COSTO — botones y lógica
  // precios aproximados (S/)
  const precios = {
    "Analgésico": 8.50,
    "Antibiótico": 22.00,
    "Vitamina": 5.00,
    "Vacuna": 65.00,
    "Antiviral": 30.00
  };

  if(el("btn-costo")){
    el("btn-costo").onclick = () => {
      const tipo = el("tipo-retirar") ? el("tipo-retirar").value : null;
      const cant = parseInt(el("cant-retirar") ? el("cant-retirar").value : "0");
      if(!tipo || isNaN(cant) || cant <= 0){
        if(el("costo-msg")) el("costo-msg").innerHTML = "⚠ Ingrese una cantidad válida y seleccione un tipo";
        return;
      }
      const precio = precios[tipo] || 0;
      const total = precio * cant;
      if(el("costo-msg")) el("costo-msg").innerHTML = "Costo total estimado: <strong>S/ " + total.toFixed(2) + "</strong>";
    };
  }

}); // DOMContentLoaded end

// =============================
// RENDER MATRIZ (fuera de DOMContentLoaded para poder llamarlo)
// =============================
async function renderMatriz(){
  try {
    const html = await py("matriz_html()");
    if(el("tabla-container")) el("tabla-container").innerHTML = html;
  } catch(err){
    console.error("Error renderMatriz:", err);
    if(el("output-log")) el("output-log").textContent = "Error mostrando matriz: " + err;
  }
}

// =============================
// UTILS (descarga)
// =============================
function download(name, text){
  let a=document.createElement("a");
  a.href="data:text/plain;charset=utf-8," + encodeURIComponent(text);
  a.download=name;
  a.click();
}
