let pyodide = null;

// =============================
// CARGA DE PYODIDE
// =============================
async function loadPy() {
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
    # Riesgo ahora calculado igual que FEFO
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
                info=(f"Tipo: {cel.get('tipo','')}<br>"
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
loadPy();

// =============================
// UTILIDADES
// =============================
function py(code){
  return pyodide.runPythonAsync(code);
}
function el(id){
  return document.getElementById(id);
}

// Vista del log
document.addEventListener("DOMContentLoaded", ()=>{
  if(el("output-log")){
    el("output-log").style.whiteSpace = "pre-wrap";
    el("output-log").style.overflowY = "auto";
  }
});

// =============================
// EVENTOS PRINCIPALES
// =============================
el("enter-btn").onclick = ()=>{
  el("landing").classList.add("hidden");
  el("app").classList.remove("hidden");
};

// MANUAL
el("openManual").onclick = ()=> el("manualModal").style.display="flex";
el("closeManual").onclick = ()=> el("manualModal").style.display="none";
window.onclick = (e)=>{ if(e.target===el("manualModal")) el("manualModal").style.display="none"; };

// =============================
// REGISTRO
// =============================
el("btn-registrar").onclick = async ()=>{

  let f = parseInt(el("inp-fila").value)-1;
  let c = parseInt(el("inp-col").value)-1;

  if(f<0||f>31||c<0||c>31){
    el("msg-registrar").textContent="Fila o columna fuera de rango";
    return;
  }

  let tipo = el("inp-tipo").value;
  let ubic = el("inp-ubic").value;
  let lote = el("inp-lote").value;
  let venc = el("inp-venc").value;
  let cond = el("inp-cond").value;

  let call = "registrar_medicamento(" +
    f + "," + c + "," +
    JSON.stringify(tipo) + "," +
    JSON.stringify(ubic) + "," +
    JSON.stringify(lote) + "," +
    JSON.stringify(venc) + "," +
    JSON.stringify(cond) + ")";

  let r = await py(call);
  el("msg-registrar").textContent = r;

  renderMatriz();
};

// =============================
// RELLENAR
// =============================
el("btn-rellenar").onclick = async ()=>{
  let r = await py("rellenar_ejemplo()");
  el("msg-registrar").textContent=r;
  renderMatriz();
};

// =============================
// MATRIZ
// =============================
async function renderMatriz(){
  let html = await py("matriz_html()");
  el("tabla-container").innerHTML = html;
}

el("btn-mostrar").onclick = async ()=> renderMatriz();

// =============================
// EXPORTAR
// =============================
el("btn-export").onclick = async()=>{
  let txt = await py("matriz_texto()");
  download("matriz.txt", txt);
};

function download(name, text){
  let a=document.createElement("a");
  a.href="data:text/plain;charset=utf-8," + encodeURIComponent(text);
  a.download=name;
  a.click();
}

// =============================
// OPERACIONES
// =============================

// CONSTRUIR A COMPLETA
el("btn-construir").onclick = async ()=>{
  const tipo = el("tipo-analizar").value;
  try {
    const data = await py("construir_A(" + JSON.stringify(tipo) + ")");
    const A = JSON.parse(data);

    const texto = A
      .map((fila,i)=> `Fila ${i+1}: ${fila.join(" ")}`)
      .join("\n");

    el("output-log").textContent =
      "Matriz A (1 = coincide tipo):\n\n" + texto;

  } catch(err){
    el("output-log").textContent="Error: "+err;
  }
};

// FEFO COMPLETO
el("btn-fefo").onclick = async ()=>{
  const tipo = el("tipo-analizar").value;
  try {
    const data = await py("fefo(" + JSON.stringify(tipo) + ")");
    const lista = JSON.parse(data);

    if(lista.length===0){
      el("output-log").textContent="No hay medicamentos de este tipo.";
      return;
    }

    const texto = lista
      .map(item =>
        `Fila ${item.fila}, Col ${item.col}\n` +
        `  Lote: ${item.lote}\n` +
        `  Vencimiento: ${item.venc}`
      )
      .join("\n\n");

    el("output-log").textContent =
      "Lista FEFO:\n\n" + texto;

  } catch(err){
    el("output-log").textContent="Error: "+err;
  }
};

// RIESGO COMPLETO
el("btn-riesgo").onclick = async ()=>{
  const tipo = el("tipo-analizar").value;
  try {
    const data = await py("fefo(" + JSON.stringify(tipo) + ")");
    const lista = JSON.parse(data);

    if(lista.length===0){
      el("output-log").textContent="No hay medicamentos de este tipo.";
      return;
    }

    const texto = lista
      .map((item,i)=>
        `${i+1}. Fila ${item.fila}, Col ${item.col} — Vencimiento: ${item.venc}`
      )
      .join("\n");

    el("output-log").textContent =
      "Lista de riesgo:\n\n" + texto;

  } catch(err){
    el("output-log").textContent="Error: "+err;
  }
};

// COMPARAR TIEMPOS
el("btn-compare").onclick = async () => {
  try {
    const tipo = el("tipo-analizar").value;

    const inicio = performance.now();

    await py("fefo(" + JSON.stringify(tipo) + ")");

    const fin = performance.now();

    const tiempo = (fin - inicio).toFixed(2);

    el("output-log").textContent =
      "Tiempo estimado de procesamiento para el tipo seleccionado: " + tiempo + " ms";

  } catch (err) {
    el("output-log").textContent = "Error: " + err;
  }
};

// =============================
// ESTADÍSTICAS
// =============================
el("btn-stats").onclick = async ()=>{
  try{
    const data = await py("estadisticas()");
    const d = JSON.parse(data);

    el("stats-area").innerHTML =
      "<strong>Total:</strong> " + d.total + "<br>" +
      "Analgésicos: " + d.tipos["Analgésico"] + "<br>" +
      "Antibióticos: " + d.tipos["Antibiótico"] + "<br>" +
      "Vitaminas: " + d.tipos["Vitamina"] + "<br>" +
      "Vacunas: " + d.tipos["Vacuna"] + "<br>" +
      "Antivirales: " + d.tipos["Antiviral"];

  }catch(err){
    el("stats-area").textContent="Error: "+err;
  }
};

// =============================
// RETIRAR
// =============================
el("btn-retirar").onclick = async ()=>{
  const tipo = el("tipo-retirar").value;
  const cant = parseInt(el("cant-retirar").value)||0;

  if(cant<=0){
    el("retirar-msg").textContent="Cantidad inválida";
    return;
  }

  try {
    const data = await py("retirar(" + JSON.stringify(tipo) + "," + cant + ")");
    const obj = JSON.parse(data);

    el("retirar-msg").textContent =
      "Se retiraron " + obj.retirados + " unidades.";

    await renderMatriz();

    const d = obj.stats;
    el("stats-area").innerHTML =
      "<strong>Total:</strong> " + d.total + "<br>" +
      "Analgésicos: " + d.tipos["Analgésico"] + "<br>" +
      "Antibióticos: " + d.tipos["Antibiótico"] + "<br>" +
      "Vitaminas: " + d.tipos["Vitamina"] + "<br>" +
      "Vacunas: " + d.tipos["Vacuna"] + "<br>" +
      "Antivirales: " + d.tipos["Antiviral"];

  }catch(err){
    el("retirar-msg").textContent="Error: "+err;
  }
};
