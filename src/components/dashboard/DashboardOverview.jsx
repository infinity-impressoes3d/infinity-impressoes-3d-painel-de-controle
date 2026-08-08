import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Package, FolderTree, CreditCard, Plus, ArrowRight, Eye, CheckCircle2, AlertTriangle, Layers, ShoppingCart, MessageCircle, QrCode } from 'lucide-react'

export default function DashboardOverview({ setActiveTab, onOpenProductModal, onOpenCollectionModal }) {
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    totalCollections: 0,
    featuredCollections: 0,
    mpConnected: null,
    totalSales: 0,
    abandonedCount: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
    const handleLocalUpdate = () => fetchStats()
    window.addEventListener('orders-updated', handleLocalUpdate)
    return () => window.removeEventListener('orders-updated', handleLocalUpdate)
  }, [])

  const isPaidStatus = (status) => {
    if (!status) return false
    const s = String(status).trim().toLowerCase()
    return ['paid', 'shipped', 'approved', 'completed', 'succeeded', 'pago', 'entregue', 'aprovado'].includes(s)
  }

  const fetchStats = async () => {
    try {
      setLoading(true)
      const { data: products } = await supabase.from('products').select('id, active')
      const totalProducts = products?.length || 0
      const activeProducts = products?.filter((p) => p.active)?.length || 0

      const { data: collections } = await supabase.from('collections').select('id, is_featured_home')
      const totalCollections = collections?.length || 0
      const featuredCollections = collections?.filter((c) => c.is_featured_home)?.length || 0

      const { data: orders } = await supabase.from('orders').select('total_amount, status')
      const totalSales = orders
        ?.filter(o => isPaidStatus(o.status))
        ?.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0) || 0

      const abandonedCount = orders?.filter(o => String(o.status || '').toLowerCase() === 'abandoned')?.length || 0

      // Verifica status do Mercado Pago
      let mpConnected = false
      try {
        const { data: settings } = await supabase
          .from('store_settings')
          .select('mercadopago_public_key')
          .single()

        if (settings && settings.mercadopago_public_key) {
          mpConnected = true
        }
      } catch (err) {
        mpConnected = false
      }

      setStats({
        totalProducts,
        activeProducts,
        totalCollections,
        featuredCollections,
        mpConnected,
        totalSales,
        abandonedCount
      })
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Banner Boas-Vindas */}
      <div className="bg-gradient-to-r from-indigo-900/60 via-slate-900 to-slate-900 border border-indigo-500/20 rounded-2xl p-6 md:p-8 relative overflow-hidden">
        <div className="max-w-2xl relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold">
            <Layers className="w-3.5 h-3.5" />
            <span>Infinity 3D — Painel Administrativo</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Gerencie seus Produtos, Coleções & Vendas
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Cadastre modelos 3D, organize coleções e recupere checkouts abandonados via WhatsApp com 1 clique.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActiveTab('orders')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all"
            >
              <ShoppingCart className="w-4 h-4" /> Ver Vendas & Checkouts
            </button>
            <button
              onClick={onOpenProductModal}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium px-4 py-2.5 rounded-xl border border-slate-700 flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" /> Novo Produto
            </button>
          </div>
        </div>
      </div>

      {/* Grid de Cards Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card Vendas */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Faturamento</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
              R$
            </div>
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {loading ? '...' : `R$ ${stats.totalSales.toFixed(2).replace('.', ',')}`}
          </div>
          <button
            onClick={() => setActiveTab('orders')}
            className="text-xs text-emerald-400 hover:underline font-medium inline-flex items-center gap-1 mt-1"
          >
            Ver Histórico de Pedidos <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Card Checkouts Abandonados */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Abandonados</span>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {loading ? '...' : stats.abandonedCount}
          </div>
          <button
            onClick={() => setActiveTab('orders')}
            className="text-xs text-amber-400 hover:underline font-medium inline-flex items-center gap-1 mt-1"
          >
            Recuperar via WhatsApp <MessageCircle className="w-3 h-3" />
          </button>
        </div>

        {/* Card Produtos */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Produtos</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {loading ? '...' : stats.totalProducts}
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="text-emerald-400 font-semibold">{stats.activeProducts} ativos</span>
          </div>
        </div>

        {/* Card Mercado Pago Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Mercado Pago</span>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-2 mb-1">
            {stats.mpConnected === true ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-400 text-sm font-bold">
                <CheckCircle2 className="w-4 h-4" /> Conectado ✅
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-amber-400 text-sm font-bold">
                <AlertTriangle className="w-4 h-4" /> Não Conectado ⚠️
              </span>
            )}
          </div>
          <button
            onClick={() => setActiveTab('integrations')}
            className="text-xs text-sky-400 hover:underline font-medium inline-flex items-center gap-1 mt-1"
          >
            Gerenciar Mercado Pago <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
