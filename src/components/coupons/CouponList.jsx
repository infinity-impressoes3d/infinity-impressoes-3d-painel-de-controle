import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import CouponModal from './CouponModal'
import ConfirmDeleteModal from '../common/ConfirmDeleteModal'
import { 
  Tag, 
  Plus, 
  Trash2, 
  Edit3, 
  Percent, 
  DollarSign, 
  Truck, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  Hash,
  ShoppingBag,
  Sparkles
} from 'lucide-react'

export default function CouponList() {
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState(null)

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchCoupons()

    // Realtime Supabase Subscription
    const channel = supabase
      .channel('coupons-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coupons' }, () => {
        fetchCoupons()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchCoupons = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setCoupons(data || [])
    } catch (err) {
      console.error('Erro ao carregar cupons:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (coupon) => {
    try {
      const newStatus = !coupon.active
      const { error } = await supabase
        .from('coupons')
        .update({ active: newStatus, updated_at: new Date().toISOString() })
        .eq('id', coupon.id)

      if (error) throw error

      setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, active: newStatus } : c))
    } catch (err) {
      console.error('Erro ao alternar status do cupom:', err)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', deleteTarget.id)

      if (error) throw error

      setCoupons(prev => prev.filter(c => c.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      console.error('Erro ao excluir cupom:', err)
    } finally {
      setDeleting(false)
    }
  }

  const handleOpenCreate = () => {
    setEditingCoupon(null)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (coupon) => {
    setEditingCoupon(coupon)
    setIsModalOpen(true)
  }

  // Helper formatting functions
  const formatDiscountDisplay = (coupon) => {
    if (coupon.type === 'percentage') {
      return `${parseFloat(coupon.value || 0)}% OFF`
    } else if (coupon.type === 'fixed') {
      return `R$ ${parseFloat(coupon.value || 0).toFixed(2).replace('.', ',')} OFF`
    } else if (coupon.type === 'free_shipping') {
      return 'Frete Grátis'
    }
    return 'Desconto'
  }

  const isExpired = (expiresAt) => {
    if (!expiresAt) return false
    return new Date(expiresAt) < new Date()
  }

  // Filtered list
  const filteredCoupons = coupons.filter(coupon => {
    const matchesSearch = coupon.code.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === 'all' || coupon.type === filterType
    return matchesSearch && matchesType
  })

  // Metrics
  const totalCoupons = coupons.length
  const activeCoupons = coupons.filter(c => c.active && !isExpired(c.expires_at)).length
  const totalUses = coupons.reduce((sum, c) => sum + (c.used_count || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header with Title and Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-inner">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Cupons de Desconto</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Crie códigos promocionais de porcentagem (ex: 50%), valores fixos (ex: R$ 10) ou frete grátis
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/20 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" /> Criar Novo Cupom
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">Total de Cupons</span>
            <div className="text-xl font-bold text-white mt-0.5">{totalCoupons}</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">Cupons Ativos na Loja</span>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">{activeCoupons}</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">Total de Utilizações</span>
            <div className="text-xl font-bold text-purple-400 mt-0.5">{totalUses}</div>
          </div>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por código do cupom..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              filterType === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Todos ({coupons.length})
          </button>
          <button
            onClick={() => setFilterType('percentage')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              filterType === 'percentage'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Porcentagem %
          </button>
          <button
            onClick={() => setFilterType('fixed')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              filterType === 'fixed'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Valor Fixo R$
          </button>
          <button
            onClick={() => setFilterType('free_shipping')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              filterType === 'free_shipping'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Frete Grátis
          </button>
        </div>
      </div>

      {/* Coupons Table / Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium">Carregando cupons promocionais...</span>
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-500 flex items-center justify-center mx-auto mb-3">
              <Tag className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-white">Nenhum cupom encontrado</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchTerm || filterType !== 'all'
                ? 'Nenhum cupom corresponde aos filtros aplicados.'
                : 'Crie seu primeiro cupom promocional para oferecer descontos na vitrine da Infinity 3D.'}
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Criar Cupom Agora
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4">Código do Cupom</th>
                  <th className="px-6 py-4">Tipo & Benefício</th>
                  <th className="px-6 py-4">Regras / Mínimo</th>
                  <th className="px-6 py-4">Usos / Limite</th>
                  <th className="px-6 py-4">Validade</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredCoupons.map((coupon) => {
                  const expired = isExpired(coupon.expires_at)
                  const isExhausted = coupon.max_uses !== null && coupon.used_count >= coupon.max_uses
                  const isAvailable = coupon.active && !expired && !isExhausted

                  return (
                    <tr key={coupon.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Código */}
                      <td className="px-6 py-4 font-mono font-bold text-sm text-white">
                        <div className="flex items-center gap-2.5">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-indigo-400 font-mono tracking-wider">
                            {coupon.code}
                          </span>
                        </div>
                      </td>

                      {/* Tipo & Benefício */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {coupon.type === 'percentage' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-semibold">
                              <Percent className="w-3.5 h-3.5" />
                              {formatDiscountDisplay(coupon)}
                            </span>
                          )}
                          {coupon.type === 'fixed' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold">
                              <DollarSign className="w-3.5 h-3.5" />
                              {formatDiscountDisplay(coupon)}
                            </span>
                          )}
                          {coupon.type === 'free_shipping' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold">
                              <Truck className="w-3.5 h-3.5" />
                              {formatDiscountDisplay(coupon)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Regras / Mínimo */}
                      <td className="px-6 py-4 text-slate-300">
                        {coupon.min_order_value > 0 ? (
                          <span>Mín. R$ {parseFloat(coupon.min_order_value).toFixed(2).replace('.', ',')}</span>
                        ) : (
                          <span className="text-slate-500">Sem pedido mínimo</span>
                        )}
                      </td>

                      {/* Usos / Limite */}
                      <td className="px-6 py-4">
                        <div className="text-slate-200 font-medium">
                          {coupon.used_count || 0} {coupon.max_uses ? `/ ${coupon.max_uses}` : 'usos'}
                        </div>
                        {coupon.max_uses && (
                          <div className="text-[10px] text-slate-500">
                            {isExhausted ? 'Esgotado' : `${coupon.max_uses - (coupon.used_count || 0)} restantes`}
                          </div>
                        )}
                      </td>

                      {/* Validade */}
                      <td className="px-6 py-4">
                        {coupon.expires_at ? (
                          <div>
                            <div className={`font-medium ${expired ? 'text-rose-400 line-through' : 'text-slate-300'}`}>
                              {new Date(coupon.expires_at).toLocaleDateString('pt-BR')}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {new Date(coupon.expires_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500">Sem expiração</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleActive(coupon)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                            isAvailable
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                              : expired
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : isExhausted
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            isAvailable ? 'bg-emerald-400 animate-pulse' : expired ? 'bg-rose-400' : isExhausted ? 'bg-amber-400' : 'bg-slate-500'
                          }`} />
                          {isAvailable ? 'Ativo' : expired ? 'Expirado' : isExhausted ? 'Esgotado' : 'Pausado'}
                        </button>
                      </td>

                      {/* Ações */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(coupon)}
                            title="Editar cupom"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(coupon)}
                            title="Excluir cupom"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
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

      {/* Modal de Criação / Edição de Cupom */}
      <CouponModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        coupon={editingCoupon}
        onSave={fetchCoupons}
      />

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        title="Excluir Cupom de Desconto"
        message={`Tem certeza que deseja excluir permanentemente o cupom "${deleteTarget?.code}"? Clientes não poderão mais utilizá-lo.`}
      />
    </div>
  )
}
