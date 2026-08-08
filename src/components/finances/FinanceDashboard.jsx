import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import FinanceModal from './FinanceModal'
import ConfirmDeleteModal from '../common/ConfirmDeleteModal'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  PieChart, 
  Tag, 
  Calendar,
  AlertCircle,
  CheckCircle2,
  Percent,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingCart,
  ShoppingBag,
  ExternalLink
} from 'lucide-react'

export default function FinanceDashboard() {
  const [finances, setFinances] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Filtros de Período / Data
  const [periodFilter, setPeriodFilter] = useState('all') // 'all', 'current_month', 'specific_month', '3_months', '6_months', '1_year'
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState(null)
  
  // Modal de confirmação de exclusão
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchFinancesAndOrders()

    const handleLocalUpdate = () => fetchFinancesAndOrders()
    window.addEventListener('orders-updated', handleLocalUpdate)

    // Supabase Realtime para escutar novos pedidos e atualizações financeiras
    const channel = supabase
      .channel('finance-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finances' }, () => fetchFinancesAndOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchFinancesAndOrders())
      .subscribe()

    return () => {
      window.removeEventListener('orders-updated', handleLocalUpdate)
      supabase.removeChannel(channel)
    }
  }, [])

  const isPaidStatus = (status) => {
    if (!status) return false
    const s = String(status).trim().toLowerCase()
    return ['paid', 'shipped', 'approved', 'completed', 'succeeded', 'pago', 'entregue', 'aprovado'].includes(s)
  }

  const fetchFinancesAndOrders = async () => {
    try {
      setLoading(true)
      
      // 1. Busca lançamentos da tabela de finanças
      const { data: finData, error: finError } = await supabase
        .from('finances')
        .select('*')
        .order('date', { ascending: false })

      if (finError) throw finError
      setFinances(finData || [])

      // 2. Busca pedidos da loja e filtra todos com status de pagamento confirmado
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (orderError) throw orderError
      
      const paidOrders = (orderData || []).filter(o => isPaidStatus(o.status))
      setOrders(paidOrders)

    } catch (err) {
      console.error('Erro ao buscar finanças e vendas:', err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return

    try {
      setDeleting(true)
      if (deleteTarget.isOrder) {
        const orderId = deleteTarget.id.replace('order-', '')
        const { error } = await supabase.from('orders').delete().eq('id', orderId)
        if (error) throw error
        setOrders(orders.filter(o => o.id !== orderId))
      } else {
        const { error } = await supabase.from('finances').delete().eq('id', deleteTarget.id)
        if (error) throw error
        setFinances(finances.filter(f => f.id !== deleteTarget.id))
      }
      setDeleteTarget(null)
    } catch (err) {
      alert('Erro ao excluir registro: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  const handleOpenModal = (transaction = null) => {
    setEditingTransaction(transaction)
    setIsModalOpen(true)
  }

  // Função auxiliar para verificar se uma data está dentro do período selecionado
  const isDateInSelectedPeriod = (itemDate) => {
    if (!itemDate || isNaN(itemDate.getTime())) return true
    if (periodFilter === 'all') return true

    const now = new Date()

    if (periodFilter === 'current_month') {
      return itemDate.getFullYear() === now.getFullYear() && itemDate.getMonth() === now.getMonth()
    }

    if (periodFilter === 'specific_month') {
      if (!selectedMonth) return true
      const [yearStr, monthStr] = selectedMonth.split('-')
      const targetYear = parseInt(yearStr, 10)
      const targetMonth = parseInt(monthStr, 10) - 1
      return itemDate.getFullYear() === targetYear && itemDate.getMonth() === targetMonth
    }

    if (periodFilter === '3_months') {
      const target = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
      return itemDate >= target
    }

    if (periodFilter === '6_months') {
      const target = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
      return itemDate >= target
    }

    if (periodFilter === '1_year') {
      const target = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      return itemDate >= target
    }

    return true
  }

  // Combina pedidos pagos da loja + lançamentos manuais de finanças em uma lista unificada
  const formattedOrderItems = orders.map(o => ({
    id: `order-${o.id}`,
    isOrder: true,
    title: `Venda Loja: Pedido de ${o.customer_name}`,
    description: `Itens: ${Array.isArray(o.items) ? o.items.map(i => `${i.name} (x${i.quantity || 1})`).join(', ') : 'Produto 3D'} | Pagamento: ${o.payment_method ? o.payment_method.toUpperCase() : 'PIX/Cartão'}`,
    category: 'Vendas Loja',
    amount: Number(o.total_amount || 0),
    type: 'income',
    date: o.created_at ? o.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
    rawDate: new Date(o.created_at || Date.now())
  }))

  const formattedFinanceItems = finances.map(f => ({
    ...f,
    isOrder: false,
    rawDate: new Date(f.date + 'T00:00:00')
  }))

  // Filtra itens pelo período escolhido pelo usuário
  const periodFilteredOrders = formattedOrderItems.filter(o => isDateInSelectedPeriod(o.rawDate))
  const periodFilteredFinances = formattedFinanceItems.filter(f => isDateInSelectedPeriod(f.rawDate))

  // CÁLCULOS DAS MÉTRICAS DO PERÍODO
  const totalVendasLoja = periodFilteredOrders.reduce((acc, curr) => acc + Number(curr.amount || 0), 0)

  const totalLucrosManuais = periodFilteredFinances
    .filter(f => f.type === 'income')
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0)

  const totalReceitas = totalVendasLoja + totalLucrosManuais

  const totalCustos = periodFilteredFinances
    .filter(f => f.type === 'expense')
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0)

  const saldoLiquido = totalReceitas - totalCustos
  const margemLucro = totalReceitas > 0 ? ((saldoLiquido / totalReceitas) * 100).toFixed(1) : '0.0'

  const allTransactions = [...periodFilteredOrders, ...periodFilteredFinances].sort((a, b) => b.rawDate - a.rawDate)

  const categories = Array.from(new Set(allTransactions.map(f => f.category).filter(Boolean)))

  const filteredTransactions = allTransactions.filter(f => {
    const matchesSearch = 
      f.title?.toLowerCase().includes(search.toLowerCase()) ||
      (f.description && f.description.toLowerCase().includes(search.toLowerCase()))

    let matchesType = true
    if (typeFilter === 'income') matchesType = f.type === 'income' && !f.isOrder
    else if (typeFilter === 'orders') matchesType = f.isOrder
    else if (typeFilter === 'expense') matchesType = f.type === 'expense'

    const matchesCategory = 
      categoryFilter === 'all' || f.category === categoryFilter

    return matchesSearch && matchesType && matchesCategory
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-emerald-400" /> Gestão Financeira & Lucros
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">
            Acompanhe o faturamento com vendas e despesas. Filtre os lucros por mês ou período.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleOpenModal(null)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" /> Novo Lucro (+)
          </button>
          <button
            onClick={() => handleOpenModal(null)}
            className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-rose-600/20 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" /> Novo Custo (-)
          </button>
        </div>
      </div>

      {/* Bar de Filtro por Período / Mês */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <Calendar className="w-4 h-4 text-emerald-400" />
          <span>Filtrar Lucros por Período:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setPeriodFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              periodFilter === 'all'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Todo o Período
          </button>

          <button
            onClick={() => setPeriodFilter('current_month')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              periodFilter === 'current_month'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Mês Atual
          </button>

          <button
            onClick={() => setPeriodFilter('3_months')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              periodFilter === '3_months'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Últimos 3 Meses
          </button>

          <button
            onClick={() => setPeriodFilter('6_months')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              periodFilter === '6_months'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Últimos 6 Meses
          </button>

          <button
            onClick={() => setPeriodFilter('1_year')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              periodFilter === '1_year'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            1 Ano
          </button>

          {/* Seletor de Mês Específico */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
            <button
              onClick={() => setPeriodFilter('specific_month')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                periodFilter === 'specific_month'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              Mês Específico:
            </button>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value)
                setPeriodFilter('specific_month')
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Grid de Cards Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Receitas */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Faturamento Total (+R$)</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            R$ {totalReceitas.toFixed(2).replace('.', ',')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
            <span>R$ {totalVendasLoja.toFixed(2).replace('.', ',')} em {orders.length} {orders.length === 1 ? 'venda paga' : 'vendas pagas'}</span>
          </div>
        </div>

        {/* Total Custos */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Custos & Despesas (-R$)</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-400">
            R$ {totalCustos.toFixed(2).replace('.', ',')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Filamentos, energia, embalagens e máquinas
          </div>
        </div>

        {/* Resultado Líquido */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Resultado Líquido Real</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
              saldoLiquido >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
            }`}>
              R$
            </div>
          </div>
          <div className={`text-2xl font-bold ${saldoLiquido >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            R$ {saldoLiquido.toFixed(2).replace('.', ',')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium flex items-center gap-1">
            {saldoLiquido >= 0 ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Lucro Líquido Garantido
              </span>
            ) : (
              <span className="text-rose-400 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Prejuízo no Período
              </span>
            )}
          </div>
        </div>

        {/* Margem de Lucro */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Margem de Lucro</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {margemLucro}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Retorno líquido sobre todas as vendas
          </div>
        </div>
      </div>

      {/* Bar de Filtros */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              typeFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Todas as Movimentações ({allTransactions.length})
          </button>

          <button
            onClick={() => setTypeFilter('orders')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              typeFilter === 'orders'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" /> 🛒 Vendas da Loja ({orders.length})
          </button>

          <button
            onClick={() => setTypeFilter('income')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              typeFilter === 'income'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" /> Lucros Manuais ({finances.filter(f => f.type === 'income').length})
          </button>

          <button
            onClick={() => setTypeFilter('expense')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              typeFilter === 'expense'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" /> Custos / Despesas ({finances.filter(f => f.type === 'expense').length})
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
          >
            <option value="all">Todas as Categorias</option>
            {categories.map((cat, idx) => (
              <option key={idx} value={cat}>{cat}</option>
            ))}
          </select>

          <div className="relative flex-1 md:w-56">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar lançamento..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Tabela Unificada de Movimentações */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Carregando balanço financeiro e vendas da loja...</span>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <PieChart className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-semibold text-slate-300">Nenhuma movimentação encontrada</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              As vendas concluídas da vitrine aparecem aqui automaticamente. Você também pode registrar custos de filamento e energia.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Movimentação / Origem</th>
                  <th className="py-3.5 px-4">Categoria</th>
                  <th className="py-3.5 px-4">Data</th>
                  <th className="py-3.5 px-4">Tipo</th>
                  <th className="py-3.5 px-4">Valor</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredTransactions.map((item) => {
                  const isIncome = item.type === 'income'
                  const isOrder = item.isOrder

                  return (
                    <tr key={item.id} className={`transition-colors ${isOrder ? 'bg-emerald-950/20 hover:bg-emerald-950/40' : 'hover:bg-slate-800/40'}`}>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white text-sm flex items-center gap-2">
                          {isOrder && <ShoppingCart className="w-4 h-4 text-emerald-400 shrink-0" />}
                          {item.title}
                        </div>
                        {item.description && (
                          <div className="text-xs text-slate-400 line-clamp-1">{item.description}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${
                          isOrder 
                            ? 'bg-emerald-950 border-emerald-800/60 text-emerald-300' 
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}>
                          {item.category || 'Outros'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {item.date ? new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                      </td>

                      <td className="py-3.5 px-4">
                        {isOrder ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                            <ShoppingCart className="w-3.5 h-3.5" /> Venda Loja 🛒
                          </span>
                        ) : isIncome ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            <TrendingUp className="w-3.5 h-3.5" /> Lucro (+)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 border border-rose-500/20 text-rose-400">
                            <TrendingDown className="w-3.5 h-3.5" /> Custo (-)
                          </span>
                        )}
                      </td>

                      <td className={`py-3.5 px-4 font-bold ${isIncome ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isIncome ? '+' : '-'} R$ {Number(item.amount).toFixed(2).replace('.', ',')}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenModal(item)}
                            title={isOrder ? "Editar Valor da Venda da Loja" : "Editar Lançamento"}
                            className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500 text-slate-300 hover:text-indigo-400 transition-all cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget({ id: item.id, title: item.title, isOrder: item.isOrder })}
                            title={isOrder ? "Excluir Registro da Venda" : "Excluir Lançamento"}
                            className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-rose-500 text-slate-300 hover:text-rose-400 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FinanceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        transaction={editingTransaction}
        onSave={fetchFinancesAndOrders}
      />

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Lançamento Financeiro"
        message={deleteTarget ? `Tem certeza que deseja excluir o lançamento "${deleteTarget.title}"? O cálculo do resultado líquido será atualizado.` : ''}
        loading={deleting}
      />
    </div>
  )
}
