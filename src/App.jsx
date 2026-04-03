import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Wallet, CreditCard, PiggyBank, Target, TrendingUp, Database, Plus } from "lucide-react";
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

export default function App() {
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [people] = useState(initialPeople);
  const [paymentMethods] = useState(initialPaymentMethods);
  const [types] = useState(initialTypes);
  const [categoryMap] = useState(initialCategoryMap);

  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [blueRate, setBlueRate] = useState(1250);
  const [displayCurrency, setDisplayCurrency] = useState("ARS");
  const [movementFilters, setMovementFilters] = useState({ person: "all", type: "all", category: "all", month: currentMonth, currency: "all" });

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
      } catch {
      }
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
        const mapped = data.map((row) => ({
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
          linkedDebtId: row.linked_debt_id || "",
          linkedBudgetId: row.linked_budget_id || "",
        }));
        setMovements(mapped);
      }
      setLoading(false);
    }

    loadMovements();
  }, []);

  const categoriesForMovementType = movementForm.type ? categoryMap[movementForm.type] || [] : [];

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
      : resolvedRate > 0
        ? amountArs / resolvedRate
        : 0;

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

    const { data, error } = await supabase
      .from("movements")
      .insert(payload)
      .select()
      .single();

    if (error) {
      setSaveMessage("No se pudo guardar en Supabase.");
      setSaving(false);
      return;
    }

    const newMovement = {
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
      linkedDebtId: data.linked_debt_id || "",
      linkedBudgetId: data.linked_budget_id || "",
    };

    setMovements((prev) => [newMovement, ...prev]);
    setMovementForm(emptyMovement(today, paymentMethods, people, blueRate));
    setSaveMessage("Guardado en Supabase.");
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-3 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Finanzas Familiares</h1>
            <p className="text-slate-600 text-sm md:text-base">Movements ya conectados con Supabase.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full px-3 py-2 text-xs md:text-sm">Persistencia real</Badge>
            <Select value={displayCurrency} onValueChange={setDisplayCurrency}>
              <SelectTrigger className="w-[130px] rounded-xl bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ARS">Ver en ARS</SelectItem>
                <SelectItem value="USD">Ver en USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="cargar" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 rounded-2xl h-auto bg-white shadow-sm">
            <TabsTrigger value="cargar">Cargar</TabsTrigger>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="datos">Datos</TabsTrigger>
          </TabsList>

          <TabsContent value="cargar" className="space-y-4">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader><CardTitle className="text-xl">Carga rápida</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2"><Label>Fecha</Label><Input type="date" value={movementForm.date} onChange={(e) => setMovementForm({ ...movementForm, date: e.target.value })} /></div>
                <div className="space-y-2"><Label>Persona</Label><Select value={movementForm.person} onValueChange={(v) => setMovementForm({ ...movementForm, person: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{people.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Tipo</Label><Select value={movementForm.type} onValueChange={(v) => setMovementForm({ ...movementForm, type: v, category: "" })}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Categoría</Label><Select value={movementForm.category} onValueChange={(v) => setMovementForm({ ...movementForm, category: v })} disabled={!movementForm.type}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{categoriesForMovementType.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Moneda</Label><Select value={movementForm.currency} onValueChange={(v) => setMovementForm({ ...movementForm, currency: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ARS">Pesos</SelectItem><SelectItem value="USD">Dólar blue</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Importe original</Label><Input type="number" value={movementForm.originalAmount} onChange={(e) => setMovementForm({ ...movementForm, originalAmount: e.target.value })} placeholder="0" /></div>
                <div className="space-y-2"><Label>Medio de pago</Label><Select value={movementForm.paymentMethod} onValueChange={(v) => setMovementForm({ ...movementForm, paymentMethod: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{paymentMethods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2 md:col-span-2 xl:col-span-1"><Label>Descripción</Label><Input value={movementForm.description} onChange={(e) => setMovementForm({ ...movementForm, description: e.target.value })} placeholder="Detalle opcional" /></div>
                <div className="md:col-span-2 xl:col-span-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Ahora sí se guarda en Supabase. En el próximo paso conectamos tabla completa, exportación y saldos.</div>
                <div className="md:col-span-2 xl:col-span-4">
                  <Button className="w-full rounded-2xl h-11" onClick={addMovement} disabled={saving}>
                    <Plus className="mr-2 h-4 w-4" /> {saving ? "Guardando..." : "Agregar movimiento"}
                  </Button>
                </div>
                {saveMessage && <div className="md:col-span-2 xl:col-span-4 text-sm font-medium">{saveMessage}</div>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
              <Card className="rounded-2xl shadow-sm"><CardContent className="p-4 md:p-5"><div className="mb-2 flex items-center gap-2 text-slate-500 text-xs md:text-sm"><Wallet className="h-4 w-4" /> Ingresos</div><div className="text-lg md:text-2xl font-semibold">{formatAmount(summary.income)}</div></CardContent></Card>
              <Card className="rounded-2xl shadow-sm"><CardContent className="p-4 md:p-5"><div className="mb-2 flex items-center gap-2 text-slate-500 text-xs md:text-sm"><CreditCard className="h-4 w-4" /> Gastos</div><div className="text-lg md:text-2xl font-semibold">{formatAmount(summary.expenses)}</div></CardContent></Card>
              <Card className="rounded-2xl shadow-sm"><CardContent className="p-4 md:p-5"><div className="mb-2 flex items-center gap-2 text-slate-500 text-xs md:text-sm"><PiggyBank className="h-4 w-4" /> Ahorro</div><div className="text-lg md:text-2xl font-semibold">{formatAmount(summary.savings)}</div></CardContent></Card>
              <Card className="rounded-2xl shadow-sm"><CardContent className="p-4 md:p-5"><div className="mb-2 flex items-center gap-2 text-slate-500 text-xs md:text-sm"><Target className="h-4 w-4" /> Inversión</div><div className="text-lg md:text-2xl font-semibold">{formatAmount(summary.investments)}</div></CardContent></Card>
              <Card className="rounded-2xl shadow-sm"><CardContent className="p-4 md:p-5"><div className="mb-2 flex items-center gap-2 text-slate-500 text-xs md:text-sm"><TrendingUp className="h-4 w-4" /> Neto</div><div className="text-lg md:text-2xl font-semibold">{formatAmount(summary.net)}</div></CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="datos" className="space-y-4">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader><CardTitle className="text-xl flex items-center gap-2"><Database className="h-5 w-5" /> Datos ingresados</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-5">
                <div className="space-y-2"><Label>Mes</Label><Input type="month" value={movementFilters.month} onChange={(e) => setMovementFilters({ ...movementFilters, month: e.target.value })} /></div>
                <div className="space-y-2"><Label>Persona</Label><Select value={movementFilters.person} onValueChange={(v) => setMovementFilters({ ...movementFilters, person: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{people.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Tipo</Label><Select value={movementFilters.type} onValueChange={(v) => setMovementFilters({ ...movementFilters, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Categoría</Label><Select value={movementFilters.category} onValueChange={(v) => setMovementFilters({ ...movementFilters, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{Object.values(categoryMap).flat().map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Moneda</Label><Select value={movementFilters.currency} onValueChange={(v) => setMovementFilters({ ...movementFilters, currency: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="ARS">ARS</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-sm">
              <CardHeader><CardTitle className="text-xl">Últimos movimientos</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {loading && <div className="text-sm text-slate-500">Cargando desde Supabase...</div>}
                {!loading && filteredMovements.map((m) => (
                  <div key={m.id} className="flex flex-col gap-3 rounded-2xl border bg-white p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-medium">{m.category} · {m.description || "Sin detalle"}</div>
                      <div className="text-sm text-slate-500">{m.date} · {m.person} · {m.type} · {m.paymentMethod} · {m.currency}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">{formatAmount(m.amountArs)}</div>
                      <div className="text-xs text-slate-500">Original: {money(m.originalAmount, m.currency)} · TC: {m.fxRate}</div>
                    </div>
                  </div>
                ))}
                {!loading && filteredMovements.length === 0 && <div className="text-sm text-slate-500">No hay movimientos para esos filtros.</div>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
