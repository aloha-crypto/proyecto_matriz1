let pyodide = null;

// =====================================
// CARGA PYODIDE
// =====================================
async function loadPy() {
  pyodide = await loadPyodide();

  await pyodide.runPythonAsync(`
import random, json
from datetime import datetime

# MATRIZ PRINCIPAL 32×32
matriz = [[None for _ in range(32)] for _ in range(32)]

# MATRIZ DE PRECIOS B (vector columna de 5×1)
precios = {
    "Analgésico": 12.5,
    "Antibiótico": 18.0,
    "Vitamina": 9.0,
    "Vacuna": 25.0,
    "Antiviral": 30.0
}

def matriz_precios():
    B = [
        [precios["Analgésico"]],
        [precios["Antibiótico"]],
        [precios["Vitamina"]],
        [precios["Vacuna"]],
        [precios["Antiviral"]]
    ]
    return json.dumps(B)

# REGISTRAR
def registrar_medicamento(f,c,tipo,ubic,lote,venc,cond):
    if not (0 <= f < 32 and 0 <= c < 32):
        return "Ubicación fuera de rango"

    if venc:
        try:
            datetime.strptime(venc, "%Y-%m-%d")
        except:
            return "Fecha inválida"

    if matriz[f][c] != None:
        return "Ya existe un medicamento en esta celda"

    matriz[f][c] = {
        "tipo": tipo,
        "ubic": ubic,
        "lote": lote,
        "venc": venc,
        "cond": cond
    }
    return "Medicamento registrado"

# RELLENAR AUTOMÁTICO
def rellenar_ejemplo(n=50):
    meds=["Analgésico","Antibiótico","Vitamina","Vacuna","Antiviral"]
    for _ in range(n):
        f=random.randint(0,31)
        c=random.randint(0,31)
        matriz[f][c]={
            "tipo": random.choice(meds),
            "ubic": "Estante "+str(random.randint(1,5)),
            "lote": "L"+str(random.randint(100,999)),
            "venc": "2025-0"+str(random.randint(1,9))+"-15",
            "cond": "Seco"
        }
    return "Registros generados"

# ESTADÍSTICAS
def estadisticas():
    tipos={"Analgésico":0,"Antibiótico":0,"Vitamina":0,"Vacuna":0,"Antiviral":0}
    total=0
    for i in range(32):
        for j in range(32):
            cel=matriz[i][j]
            if cel:
                total+=1
                t=cel.get("tipo","")
                if t in tipos:
                    tipos[t]+=1
    return json.dumps({"total":total,"tipos":tipos})

# RETIRAR
def retirar(tipo,cantidad):
    retirados=0
    for i in range(32):
        for j in range(32):
            if retirados>=cantidad: break
            cel=matriz[i][j]
            if cel and cel.get("tipo")==tipo:
                matriz[i][j]=None
                retirados+=1
        if retirados>=cantidad: break

    stats=json.loads(estadisticas())
    return json.dumps({"retirados":retirados,"stats":stats})

# MATRIZ A
def construir_A(tipo):
    A=[]
    for i in range(32):
        fila=[]
        for j in range(32):
            cel=matriz[i][j]
            fila.append(1 if (cel and cel.get("tipo")==tipo) else 0)
        A.append(fila)
    return json.dumps(A)

# FEFO COMPLETO
def fefo(tipo):
    lista=[]
    for i in range(32):
        for j in range(32):
            cel=matriz[i][j]
            if cel and cel.get("tipo")==tipo:
                lista.append({
                    "fila":i+1,
                    "col":j+1,
                    "lote":cel.get("lote",""),
                    "venc":cel.get("venc","")
                })
    lista.sort(key=lambda x:x["venc"] if x["venc"] else "9999-99-99")
    return json.dumps(lista)

# RIESGO = FEFO COMPLETO
def riesgo(tipo):
    return fefo(tipo)

# MATRIZ PARA EXPORTACIÓN
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

# MATRIZ HTML
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
                clase="tipo-vacio"
                texto="-"
                info="Vacío"
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

# PRODUCTO MATRICIAL: Cᵀ × B
def calcular_costo(tipo, cantidad):
    C = [
        [cantidad if tipo=="Analgésico" else 0],
        [cantidad if tipo=="Antibiótico" else 0],
        [cantidad if tipo=="Vitamina" else 0],
        [cantidad if tipo=="Vacuna" else 0],
        [cantidad if tipo=="Antiviral" else 0]
    ]

    B = [
        [precios["Analgésico"]],
        [precios["Antibiótico"]],
        [precios["Vitamina"]],
        [precios["Vacuna"]],
        [precios["Antiviral"]]
    ]

    costo_total = 0
    for i in range(5):
        costo_total += C[i][0] * B[i][0]

    return json.dumps({
        "tipo": tipo,
        "cantidad": cantidad,
        "costo_total": costo_total
    })
`);
}
loadPy();

// =====================================
// UTILIDADES JS
// =====================================
function py(code){ return pyodide.runPythonAsync(code); }
function el(id){ return document.getElementById(id); }

document.addEventListener("DOMContentLoaded", ()=>{
  if(el("output-log")){
    el("output-log").style.whiteSpace="pre-wrap";
    el("output-log").style.overflowY="auto";
  }
});

// =====================================
// INTERFAZ
// =====================================
el("enter-btn").onclick = ()=>{
  el("landing").classList.add("hidden");
  el("app").classList.remove("hidden");
};

// MANUAL
el("openManual").onclick = ()=> el("manualModal").style.display="flex";
el("closeManual").onclick = ()=> el("manualModal").style.display="none";
window.onclick = (e)=>{ if(e.target===el("manualModal")) el("manualModal").style.display="none"; };

// =====================================
// REGISTRAR
// =====================================
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

  el("msg-registrar").textContent = await py(call);
  renderMatriz();
};

// =====================================
// RELLENAR
// =====================================
el("btn-rellenar").onclick = async ()=>{
  el("msg-registrar").textContent = await py("rellenar_ejemplo()");
  renderMatriz();
};

// =====================================
// MATRIZ
// =====================================
async function renderMatriz(){
  let html = await py("matriz_html()");
  el("tabla-container").innerHTML = html;
}
el("btn-mostrar").onclick = ()=> renderMatriz();

// =====================================
// EXPORTAR
// =====================================
el("btn-export").onclick = async ()=>{
  let txt = await py("matriz_texto()");
  download("matriz.txt", txt);
};

function download(name,text){
  let a=document.createElement("a");
  a.href="data:text/plain;charset=utf-8," + encodeURIComponent(text);
  a.download=name;
  a.click();
}

// =====================================
// OPERACIONES
// =====================================

// MATRIZ A
el("btn-construir").onclick = async ()=>{
  const tipo = el("tipo-analizar").value;
  const A = JSON.parse(await py("construir_A(" + JSON.stringify(tipo) + ")"));

  const texto = A.map((fila,i)=>`Fila ${i+1}: ${fila.join(" ")}`).join("\n");

  el("output-log").textContent =
    "Matriz A (1 = coincide el tipo):\n\n" + texto;
};

// FEFO
el("btn-fefo").onclick = async ()=>{
  const tipo = el("tipo-analizar").value;
  const lista = JSON.parse(await py("fefo(" + JSON.stringify(tipo) + ")"));

  if(lista.length===0){
    el("output-log").textContent="No hay medicamentos de este tipo.";
    return;
  }

  const texto = lista.map(x =>
    `Fila ${x.fila}, Col ${x.col}\n  Lote: ${x.lote}\n  Vencimiento: ${x.venc}`
  ).join("\n\n");

  el("output-log").textContent =
    "Lista FEFO:\n\n" + texto;
};

// RIESGO
el("btn-riesgo").onclick = async ()=>{
  const tipo = el("tipo-analizar").value;
  const lista = JSON.parse(await py("riesgo(" + JSON.stringify(tipo) + ")"));

  const texto = lista.map((x,i)=>
    `${i+1}. Fila ${x.fila}, Col ${x.col} — Vence: ${x.venc}`
  ).join("\n");

  el("output-log").textContent =
    "Lista de riesgos:\n\n" + texto;
};

// COMPARAR TIEMPOS
el("btn-compare").onclick = async ()=>{
  const tipo = el("tipo-analizar").value;

  const inicio = performance.now();
  await py("fefo(" + JSON.stringify(tipo) + ")");
  const fin = performance.now();

  el("output-log").textContent =
    "Tiempo aproximado de cálculo: " + (fin - inicio).toFixed(2) + " ms";
};

// =====================================
// ALGORITMO DE COSTOS
// =====================================
el("btn-costo").onclick = async ()=>{
  const tipo = el("tipo-analizar").value;
  const cantidad = parseInt(el("cantidad-costo").value);

  if(isNaN(cantidad) || cantidad<=0){
    el("output-log").textContent = "Cantidad inválida.";
    return;
  }

  const obj = JSON.parse(await py(
    "calcular_costo(" + JSON.stringify(tipo) + "," + cantidad + ")"
  ));

  el("output-log").textContent =
    "Tipo: " + obj.tipo +
    "\nCantidad: " + obj.cantidad +
    "\nCosto total: " + obj.costo_total;
};

// =====================================
// ESTADÍSTICAS
// =====================================
el("btn-stats").onclick = async ()=>{
  const d = JSON.parse(await py("estadisticas()"));

  el("stats-area").innerHTML =
    "<strong>Total:</strong> " + d.total + "<br>" +
    "Analgésicos: " + d.tipos["Analgésico"] + "<br>" +
    "Antibióticos: " + d.tipos["Antibiótico"] + "<br>" +
    "Vitaminas: " + d.tipos["Vitamina"] + "<br>" +
    "Vacunas: " + d.tipos["Vacuna"] + "<br>" +
    "Antivirales: " + d.tipos["Antiviral"];
};

// =====================================
// RETIRAR
// =====================================
el("btn-retirar").onclick = async ()=>{
  const tipo = el("tipo-retirar").value;
  const cant = parseInt(el("cant-retirar").value)||0;

  if(cant<=0){
    el("retirar-msg").textContent="Cantidad inválida";
    return;
  }

  const obj = JSON.parse(await py(
    "retirar(" + JSON.stringify(tipo) + "," + cant + ")"
  ));

  el("retirar-msg").textContent =
    "Se retiraron " + obj.retirados + " unidades.";

  renderMatriz();

  const d = obj.stats;
  el("stats-area").innerHTML =
    "<strong>Total:</strong> " + d.total + "<br>" +
    "Analgésicos: " + d.tipos["Analgésico"] + "<br>" +
    "Antibióticos: " + d.tipos["Antibiótico"] + "<br>" +
    "Vitaminas: " + d.tipos["Vitamina"] + "<br>" +
    "Vacunas: " + d.tipos["Vacuna"] + "<br>" +
    "Antivirales: " + d.tipos["Antiviral"];
};
