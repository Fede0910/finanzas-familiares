import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { supabase } from "./lib/supabase";

const initialPeople = ["Federico", "Mica", "Santy", "Compartido"];
const initialPaymentMethods = ["Banco", "Tarjeta", "Efectivo", "Mercado Pago", "Transferencia"];
const initialTypes = ["Ingreso", "Egreso", "Ahorro", "Inversión"];
const initialCategoryMap = {
  Ingreso: ["Sueldo", "Freelance", "Venta", "Otros ingresos"],
  Egreso: ["Supermercado", "Salud", "Salud mental", "Educación", "Transporte", "Servicios", "Alquiler", "Salidas", "Deuda"],
  Ahorro: ["Fondo de emergencia", "Ahorro USD", "Caja ahorro"],
  Inversión: ["FCI", "Acciones", "Cedears", "Cripto"],
};

function money(n, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(Number(n || 0));
}

function monthKey(dateString) {
  const d = new Date(dateString + "T00:00:00");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function convertFromArs(amountArs, currency, rate) {
  if (currency === "USD") return rate > 0 ? amountArs / rate : 0;
  return amountArs;
}

function convertToArs(amount, currency, rate) {
  if (currency === "USD") return Number(amount || 0) * Number(rate || 0);
  return Number(amount || 0);
}

function emptyMovement(today, paymentMethods, people, blueRate) {
  return {
    date: today,
    person: people.includes("Compartido") ? "Compartido" : people[0] || "",
    type: "",
    category: "",
    description: "",
    originalAmount: "",
    currency: "ARS",
    fxRate: blueRate || 1,
    paymentMethod: paymentMethods[0] || "",
  };
}

function App() {
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [blueRate, setBlueRate] = useState(1250);
  const [displayCurrency, setDisplayCurrency] = useState("ARS");
  const [movementFilters, setMovementFilters] = useState({ person: "all", type: "all", category: "all", month: currentMonth, currency: "all" });
  const [tab, setTab] = useState("cargar");

  const [movementForm, setMovementForm] = useState(
    emptyMovement(today, initialPaymentMethods, initialPeople, 1250)
  );

  useEffect(() => {
    async function fetchBlue() {
      try {
        const res = await fetch("https://dolarapi.com/v1/dolares/blue");
        if (!res.ok) return;
        const data = await res.json();
        const rate = Number(data?.venta || 0);
        if (rate > 0) setBlueRate(rate);
      } catch {}
    }
    fetchBlue();
  }, []);

  useEffect(() => {
    async function loadMovements() {
      setLoading(true);
      const { data, error } = await supabase
        .from("movements")
        .select("*")
        .order("movement_date", { ascending: false })
        .order("id", { ascending: false });

      if (!error && data) {
        setMovements(data.map((row) => ({
          id: row.id,
          date: row.movement_date,
          person: row.person,
          type: row.type,
          category: row.category,
          description: row.description || "",
          originalAmount: Number(row.original_amount || 0),
          currency: row.original_currency || "ARS",
          fxRate: Number(row.fx_rate || 1),
          amountArs: Number(row.amount_ars || 0),
          amountUsd: Number(row.amount_usd || 0),
          paymentMethod: row.payment_method || "",
        })));
      }
      setLoading(false);
    }

    loadMovements();
  }, []);

  const categoriesForMovementType = movementForm.type ? initialCategoryMap[movementForm.type] || [] : [];

  const formatAmount = (amountArs) => {
    const shown = convertFromArs(amountArs, displayCurrency, blueRate);
    return money(shown, displayCurrency);
  };

  const summary = useMemo(() => {
    const income = movements.filter((m) => m.type === "Ingreso").reduce((a, b) => a + b.amountArs, 0);
    const expenses = movements.filter((m) => m.type === "Egreso").reduce((a, b) => a + b.amountArs, 0);
    const savings = movements.filter((m) => m.type === "Ahorro").reduce((a, b) => a + b.amountArs, 0);
    const investments = movements.filter((m) => m.type === "Inversión").reduce((a, b) => a + b.amountArs, 0);
    const net = income - expenses - savings - investments;
    return { income, expenses, savings, investments, net };
  }, [movements]);

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (movementFilters.person !== "all" && m.person !== movementFilters.person) return false;
      if (movementFilters.type !== "all" && m.type !== movementFilters.type) return false;
      if (movementFilters.category !== "all" && m.category !== movementFilters.category) return false;
      if (movementFilters.currency !== "all" && m.currency !== movementFilters.currency) return false;
      if (movementFilters.month && monthKey(m.date) !== movementFilters.month) return false;
      return true;
    });
  }, [movements, movementFilters]);

  const addMovement = async () => {
    if (!movementForm.category || !movementForm.originalAmount || !movementForm.person || !movementForm.type) return;

    setSaving(true);
    setSaveMessage("");

    const resolvedRate = movementForm.currency === "USD" ? Number(blueRate || 1) : 1;
    const amountArs = convertToArs(movementForm.originalAmount, movementForm.currency, resolvedRate);
    const amountUsd = movementForm.currency === "USD"
      ? Number(movementForm.originalAmount || 0)
      : resolvedRate > 0 ? amountArs / resolvedRate : 0;

    const payload = {
      movement_date: movementForm.date,
      person: movementForm.person,
      type: movementForm.type,
      category: movementForm.category,
      description: movementForm.description || null,
      original_currency: movementForm.currency,
      original_amount: Number(movementForm.originalAmount || 0),
      fx_rate: resolvedRate,
      amount_ars: amountArs,
      amount_usd: amountUsd,
      payment_method: movementForm.paymentMethod || null,
      linked_debt_id: null,
      linked_budget_id: null,
    };

    const { data, error } = await supabase.from("movements").insert(payload).select().single();

    if (error) {
      setSaveMessage("No se pudo guardar en Supabase.");
      setSaving(false);
      return;
    }

    setMovements((prev) => [{
      id: data.id,
      date: data.movement_date,
      person: data.person,
      type: data.type,
      category: data.category,
      description: data.description || "",
      originalAmount: Number(data.original_amount || 0),
      currency: data.original_currency || "ARS",
      fxRate: Number(data.fx_rate || 1),
      amountArs: Number(data.amount_ars || 0),
      amountUsd: Number(data.amount_usd || 0),
      paymentMethod: data.payment_method || "",
    }, ...prev]);

    setMovementForm(emptyMovement(today, initialPaymentMethods, initialPeople, blueRate));
    setSaveMessage("Guardado en Supabase.");
    setSaving(false);
  };

  const cardStyle = {background:"#fff",border:"1px solid #e5e7eb",borderRadius:"16px",padding:"16px"};
  const inputStyle = {width:"100%",padding:"10px",border:"1px solid #d1d5db",borderRadius:"10px",background:"#fff"};
  const buttonStyle = {width:"100%",padding:"12px",border:"none",borderRadius:"12px",background:"#111827",color:"#fff",fontWeight:600,cursor:"pointer"};

  return (
    <div style={{minHeight:"100vh",background:"#f8fafc",padding:"12px"}}>
      <div style={{maxWidth:"1100px",margin:"0 auto",display:"grid",gap:"16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
          <div>
            <h1 style={{margin:0,fontSize:"32px"}}>Finanzas Familiares</h1>
            <div style={{color:"#475569"}}>Movements conectados con Supabase.</div>
          </div>
          <select value={displayCurrency} onChange={(e) => setDisplayCurrency(e.target.value)} style={{...inputStyle,width:"160px"}}>
            <option value="ARS">Ver en ARS</option>
            <option value="USD">Ver en USD</option>
          </select>
        </div>

        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          {["cargar","dashboard","datos"].map((name) => (
            <button key={name} onClick={() => setTab(name)} style={{padding:"10px 14px",borderRadius:"999px",border:"1px solid #d1d5db",background:tab===name?"#111827":"#fff",color:tab===name?"#fff":"#111827",cursor:"pointer"}}>
              {name.charAt(0).toUpperCase() + name.slice(1)}
            </button>
          ))}
        </div>

        {tab === "cargar" && (
          <div style={cardStyle}>
            <h2 style={{marginTop:0}}>Carga rápida</h2>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:"12px"}}>
              <div><LabelLike>Fecha</LabelLike><input type="date" value={movementForm.date} onChange={(e)=>setMovementForm({...movementForm,date:e.target.value})} style={inputStyle} /></div>
              <div><LabelLike>Persona</LabelLike><select value={movementForm.person} onChange={(e)=>setMovementForm({...movementForm,person:e.target.value})} style={inputStyle}>{initialPeople.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
              <div><LabelLike>Tipo</LabelLike><select value={movementForm.type} onChange={(e)=>setMovementForm({...movementForm,type:e.target.value,category:""})} style={inputStyle}><option value="">Seleccionar</option>{initialTypes.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
              <div><LabelLike>Categoría</LabelLike><select value={movementForm.category} onChange={(e)=>setMovementForm({...movementForm,category:e.target.value})} style={inputStyle} disabled={!movementForm.type}><option value="">Seleccionar</option>{categoriesForMovementType.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
              <div><LabelLike>Moneda</LabelLike><select value={movementForm.currency} onChange={(e)=>setMovementForm({...movementForm,currency:e.target.value})} style={inputStyle}><option value="ARS">Pesos</option><option value="USD">Dólar blue</option></select></div>
              <div><LabelLike>Importe original</LabelLike><input type="number" value={movementForm.originalAmount} onChange={(e)=>setMovementForm({...movementForm,originalAmount:e.target.value})} style={inputStyle} /></div>
              <div><LabelLike>Medio de pago</LabelLike><select value={movementForm.paymentMethod} onChange={(e)=>setMovementForm({...movementForm,paymentMethod:e.target.value})} style={inputStyle}>{initialPaymentMethods.map(m=><option key={m} value={m}>{m}</option>)}</select></div>
              <div><LabelLike>Descripción</LabelLike><input value={movementForm.description} onChange={(e)=>setMovementForm({...movementForm,description:e.target.value})} style={inputStyle} /></div>
            </div>
            <div style={{marginTop:"12px",padding:"12px",background:"#f8fafc",border:"1px solid #e5e7eb",borderRadius:"12px",fontSize:"14px"}}>
              Ahora sí se guarda en Supabase.
            </div>
            <div style={{marginTop:"12px"}}>
              <button onClick={addMovement} disabled={saving} style={buttonStyle}>{saving ? "Guardando..." : "Agregar movimiento"}</button>
            </div>
            {saveMessage && <div style={{marginTop:"10px",fontWeight:600}}>{saveMessage}</div>}
          </div>
        )}

        {tab === "dashboard" && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:"12px"}}>
            <StatCard title="Ingresos" value={formatAmount(summary.income)} />
            <StatCard title="Gastos" value={formatAmount(summary.expenses)} />
            <StatCard title="Ahorro" value={formatAmount(summary.savings)} />
            <StatCard title="Inversión" value={formatAmount(summary.investments)} />
            <StatCard title="Neto" value={formatAmount(summary.net)} />
          </div>
        )}

        {tab === "datos" && (
          <>
            <div style={cardStyle}>
              <h2 style={{marginTop:0}}>Filtros</h2>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:"12px"}}>
                <div><LabelLike>Mes</LabelLike><input type="month" value={movementFilters.month} onChange={(e)=>setMovementFilters({...movementFilters,month:e.target.value})} style={inputStyle} /></div>
                <div><LabelLike>Persona</LabelLike><select value={movementFilters.person} onChange={(e)=>setMovementFilters({...movementFilters,person:e.target.value})} style={inputStyle}><option value="all">Todas</option>{initialPeople.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
                <div><LabelLike>Tipo</LabelLike><select value={movementFilters.type} onChange={(e)=>setMovementFilters({...movementFilters,type:e.target.value})} style={inputStyle}><option value="all">Todos</option>{initialTypes.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
                <div><LabelLike>Categoría</LabelLike><select value={movementFilters.category} onChange={(e)=>setMovementFilters({...movementFilters,category:e.target.value})} style={inputStyle}><option value="all">Todas</option>{Object.values(initialCategoryMap).flat().map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                <div><LabelLike>Moneda</LabelLike><select value={movementFilters.currency} onChange={(e)=>setMovementFilters({...movementFilters,currency:e.target.value})} style={inputStyle}><option value="all">Todas</option><option value="ARS">ARS</option><option value="USD">USD</option></select></div>
              </div>
            </div>
            <div style={cardStyle}>
              <h2 style={{marginTop:0}}>Últimos movimientos</h2>
              {loading && <div style={{color:"#64748b"}}>Cargando desde Supabase...</div>}
              {!loading && filteredMovements.length === 0 && <div style={{color:"#64748b"}}>No hay movimientos para esos filtros.</div>}
              <div style={{display:"grid",gap:"10px"}}>
                {filteredMovements.map((m) => (
                  <div key={m.id} style={{border:"1px solid #e5e7eb",borderRadius:"14px",padding:"14px",background:"#fff",display:"flex",justifyContent:"space-between",gap:"12px",flexWrap:"wrap"}}>
                    <div>
                      <div style={{fontWeight:600}}>{m.category} · {m.description || "Sin detalle"}</div>
                      <div style={{fontSize:"14px",color:"#64748b"}}>{m.date} · {m.person} · {m.type} · {m.paymentMethod} · {m.currency}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontWeight:700,fontSize:"18px"}}>{formatAmount(m.amountArs)}</div>
                      <div style={{fontSize:"12px",color:"#64748b"}}>Original: {money(m.originalAmount, m.currency)} · TC: {m.fxRate}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LabelLike({ children }) {
  return <div style={{marginBottom:"6px",fontSize:"14px",fontWeight:600}}>{children}</div>;
}

function StatCard({ title, value }) {
  return (
    <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:"16px",padding:"16px"}}>
      <div style={{fontSize:"14px",color:"#64748b",marginBottom:"6px"}}>{title}</div>
      <div style={{fontWeight:700,fontSize:"24px"}}>{value}</div>
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
