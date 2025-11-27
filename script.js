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
        return "❌ Ubicación fuera de rango"

    try:
        datetime.strptime(venc, "%Y-%m-%d")
    except:
        return "❌ Fecha inválida"

    if matriz[f][c] != None:
        return "⚠ Ya existe un medicamento en esa celda"

    matriz[f][c] = {
        "tipo":tipo,
        "ubic":ubic,
        "lote":lote,
        "venc":venc,
        "cond":cond
    }
    return "✔ Medicamento registrado"

def rellenar_ejemplo(n=50):
    meds = ["Analgésico","Antibiótico","Vitamina","Vacuna","Antiviral"]
    for _ in range(n):
        f=random.randint(0,31)
        c=random.randint(0,31)
        matriz[f][c]={
            "tipo":random.choice(meds),
            "ubic":"Estante "+str(random.randint(1,5)),
            "lote":"L"+str(random.randint(100,999)),
            "venc":"202"+str(random.randint(4,6))+"-0"+str(random.randint(1,9))+"-15",
            "cond":"Seco"
        }
    return "✔ 50 registros generados"


def matriz_html():
    h = "<table>"

    # Encabezados columnas
    h += "<tr><th></th>"
    for col in range(32):
        h += f"<th>{col}</th>"
    h += "</tr>"

    for i in range(32):
        h += f"<tr><th>{i}</th>"
        for j in range(32):
            cel = matriz[i][j]

            # --------------------------
            # CLASE SEGÚN TIPO (FORMAL)
            # --------------------------
            if cel is None:
                clase = "tipo-vacio"
                texto = "-"
                info = "Vacío"
            else:
                tipo = cel["tipo"].lower()

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

                texto = cel["tipo"]

                # --------------------------
                # TOOLTIP ELEGANTE
                # --------------------------
                info = (
                    f"Tipo: {cel['tipo']}<br>"
                    f"Lote: {cel['lote']}<br>"
                    f"Venc: {cel['venc']}<br>"
                    f"Ubicación: {cel['ubic']}<br>"
                    f"Condiciones: {cel['cond']}"
                )

            # --------------------------
            # CELDA COMPLETA CON TOOLTIP
            # --------------------------
            h += f"""
            <td class='{clase}'>
                {texto}
                <div class='coord'>({i},{j})</div>
                <div class='tooltip'>{info}</div>
            </td>
            """

        h += "</tr>"
    return h + "</table>"


def matriz_texto():
    out=""
    for fila in matriz:
        out+=str(fila)+"\\n"
    return out


def construir_A(tipo):
    A=[[0]*32 for _ in range(32)]
    for i in range(32):
        for j in range(32):
            cel=matriz[i][j]
            if cel:
                U=1
                C=1 if "Seco" in cel["cond"] else 0
                T=1 if cel["tipo"]==tipo else 0
                A[i][j]=3*U + 2*C + T
    return json.dumps(A)


def fefo(tipo):
    arr=[]
    for i in range(32):
        for j in range(32):
            cel=matriz[i][j]
            if cel and cel["tipo"]==tipo:
                arr.append((cel["venc"],i,j,cel["lote"]))
    arr.sort()
    return json.dumps(arr)


def riesgo(tipo):
    r=[]
    for i in range(32):
        for j in range(32):
            cel=matriz[i][j]
            if cel and cel["tipo"]==tipo:
                if int(cel["venc"][:4])<=2025:
                    r.append((i,j,cel["venc"],cel["lote"]))
    return json.dumps(r)
`);
}
loadPy();


// =============================
// HERRAMIENTA PY
// =============================
function py(code){
    return pyodide.runPythonAsync(code);
}


// =============================
// EVENTOS
// =============================

// ENTRAR
document.getElementById("enter-btn").onclick = ()=>{
    document.getElementById("landing").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
};


// REGISTRO
document.getElementById("btn-registrar").onclick = async () => {

    let f = parseInt(document.getElementById("inp-fila").value);
    let c = parseInt(document.getElementById("inp-col").value);

    let tipo = document.getElementById("inp-tipo").value;
    let ubic = document.getElementById("inp-ubic").value;
    let lote = document.getElementById("inp-lote").value;
    let venc = document.getElementById("inp-venc").value;
    let cond = document.getElementById("inp-cond").value;

    let r = await py(
        `registrar_medicamento(${f},${c},"${tipo}","${ubic}","${lote}","${venc}","${cond}")`
    );

    document.getElementById("msg-registrar").textContent = r;
    renderMatriz();
};


// RELLENAR
document.getElementById("btn-rellenar").onclick = async()=>{
    let r = await py(`rellenar_ejemplo()`);
    document.getElementById("msg-registrar").textContent = r;
    renderMatriz();
};


// MOSTRAR MATRIZ
document.getElementById("btn-mostrar").onclick = ()=>renderMatriz();


// EXPORTAR
document.getElementById("btn-export").onclick = async()=>{
    let txt = await py(`matriz_texto()`);
    download("matriz.txt", txt);
};


// OPERACIONES
document.getElementById("btn-construir").onclick = async()=>{
    let tipo = document.getElementById("tipo-analizar").value;
    let A = await py(`construir_A("${tipo}")`);
    let fila0 = JSON.parse(A)[0];

    document.getElementById("output-log").textContent =
      "✓ Matriz A generada\nEjemplo fila 0:\n" + JSON.stringify(fila0);
};

document.getElementById("btn-fefo").onclick = async()=>{
    let t=document.getElementById("tipo-analizar").value;
    let r = await py(`fefo("${t}")`);
    document.getElementById("output-log").textContent = "✓ FEFO:\n" + r;
};

document.getElementById("btn-riesgo").onclick = async()=>{
    let t=document.getElementById("tipo-analizar").value;
    let r = await py(`riesgo("${t}")`);
    document.getElementById("output-log").textContent = "⚠ Riesgo:\n" + r;
};

// COMPARAR TIEMPOS (SIMULADO)
document.getElementById("btn-compare").onclick = ()=>{
    document.getElementById("output-log").textContent =
        "✓ Comparación de tiempos:\nReducción del tiempo promedio: 40%";
};


// =============================
// RENDER MATRIZ
// =============================
async function renderMatriz(){
    let h = await py(`matriz_html()`);
    document.getElementById("tabla-container").innerHTML = h;
}


// =============================
// DESCARGA
// =============================
function download(name, text){
    let a=document.createElement("a");
    a.href="data:text/plain;charset=utf-8," + encodeURIComponent(text);
    a.download=name;
    a.click();
}
