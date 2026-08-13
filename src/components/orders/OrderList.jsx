import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import ConfirmDeleteModal from '../common/ConfirmDeleteModal'
import OrderModal from './OrderModal'
import InstagramOrderCardModal from './InstagramOrderCardModal'
import { 
  ShoppingCart, 
  Search, 
  MessageCircle, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  User, 
  Phone, 
  Mail, 
  Eye, 
  Instagram,
  Trash2, 
  Filter,
  ExternalLink,
  ChevronRight,
  Sparkles,
  X,
  MapPin,
  Truck,
  CreditCard,
  FileText,
  ShieldCheck,
  Plus,
  Edit3
} from 'lucide-react'

export default function OrderList() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeSubTab, setActiveSubTab] = useState('all')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [instagramOrder, setInstagramOrder] = useState(null)

  // Modal de Criação / Edição Manual de Vendas
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)
  const [editingOrderModal, setEditingOrderModal] = useState(null)

  // Modal de confirmação de exclusão
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const getSafeAddress = (raw) => {
    if (!raw) return {}
    if (typeof raw === 'object') return raw
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') return parsed
      } catch (e) {}
      return { street: raw }
    }
    return {}
  }

  useEffect(() => {
    fetchOrders()

    // 1. Supabase Realtime Channel
    const channel = supabase
      .channel('admin-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders(true)
      })
      .subscribe()

    // 2. BroadcastChannel para sincronização instantânea entre abas
    let bc = null
    try {
      bc = new BroadcastChannel('infinity-orders-channel')
      bc.onmessage = () => {
        fetchOrders(true)
      }
    } catch (e) {}

    // 3. Polling automático leve a cada 3 segundos
    const interval = setInterval(() => {
      fetchOrders(true)
    }, 3000)

    // 4. Recarregar ao focar na aba
    const handleFocus = () => fetchOrders(true)
    const handleCustomUpdate = () => fetchOrders(true)

    window.addEventListener('focus', handleFocus)
    window.addEventListener('orders-updated', handleCustomUpdate)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
      if (bc) bc.close()
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('orders-updated', handleCustomUpdate)
    }
  }, [])

  const fetchOrders = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setOrders(data || [])
    } catch (err) {
      console.error('Erro ao buscar pedidos:', err.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const isPaidStatus = (status) => {
    if (!status) return false
    const s = String(status).trim().toLowerCase()
    return [
      'paid', 
      'shipped', 
      'approved', 
      'completed', 
      'succeeded', 
      'pago', 
      'entregue', 
      'aprovado',
      'pedido_concluido',
      'pedido concluído',
      'pedido concluido',
      'concluido',
      'concluído',
      'finalizado'
    ].includes(s)
  }

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o))

      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId)

      if (error) {
        fetchOrders()
        alert('Erro ao atualizar status: ' + error.message)
      } else {
        window.dispatchEvent(new Event('orders-updated'))
      }
    } catch (err) {
      fetchOrders()
    }
  }

  const getOrderDeliveryStatus = (order) => {
    if (!order) return 'imprimindo'
    if (order.status_entrega) return order.status_entrega
    if (order.comments && order.comments.includes('<!--DELIVERY:')) {
      const match = order.comments.match(/<!--DELIVERY:(imprimindo|a_caminho|entregue)-->/i)
      if (match && match[1]) return match[1]
    }
    return 'imprimindo'
  }

  const setOrderDeliveryTagInComments = (comments, newStatus) => {
    const cleanComments = (comments || '').replace(/<!--DELIVERY:[a-zA-Z_]+-->/g, '').trim()
    return cleanComments ? `${cleanComments}\n<!--DELIVERY:${newStatus}-->` : `<!--DELIVERY:${newStatus}-->`
  }

  const handleUpdateDeliveryStatus = async (orderId, newDeliveryStatus) => {
    try {
      const now = new Date().toISOString()
      const currentOrder = orders.find(o => o.id === orderId) || selectedOrder
      const updatedComments = setOrderDeliveryTagInComments(currentOrder?.comments, newDeliveryStatus)

      setOrders(orders.map(o => o.id === orderId ? { 
        ...o, 
        status_entrega: newDeliveryStatus, 
        comments: updatedComments,
        updated_at: now 
      } : o))

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ 
          ...selectedOrder, 
          status_entrega: newDeliveryStatus, 
          comments: updatedComments,
          updated_at: now 
        })
      }

      // Tenta atualizar a coluna status_entrega + comments + updated_at
      let { error } = await supabase
        .from('orders')
        .update({ 
          status_entrega: newDeliveryStatus, 
          comments: updatedComments,
          updated_at: now 
        })
        .eq('id', orderId)

      // Fallback gracioso: se a coluna status_entrega ainda não existir no Supabase, grava nos comments + updated_at
      if (error && error.message && error.message.includes('status_entrega')) {
        const fallback = await supabase
          .from('orders')
          .update({ 
            comments: updatedComments,
            updated_at: now 
          })
          .eq('id', orderId)
        error = fallback.error
      }

      if (error) {
        console.error('Erro ao atualizar status de entrega:', error)
        alert('Erro ao atualizar status de entrega: ' + error.message)
        fetchOrders()
      } else {
        window.dispatchEvent(new Event('orders-updated'))
      }
    } catch (err) {
      console.error('Erro:', err)
      fetchOrders()
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return

    try {
      setDeleting(true)
      const { error } = await supabase.from('orders').delete().eq('id', deleteTarget.id)

      if (error) throw error
      setOrders(orders.filter(o => o.id !== deleteTarget.id))
      if (selectedOrder?.id === deleteTarget.id) setSelectedOrder(null)
      setDeleteTarget(null)
      window.dispatchEvent(new Event('orders-updated'))
    } catch (err) {
      alert('Erro ao excluir pedido: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  const getWhatsAppLink = (phone, customerName, items, totalAmount) => {
    if (!phone) return '#'
    const cleanPhone = phone.replace(/\D/g, '')
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
    const firstItem = Array.isArray(items) && items.length > 0 ? items[0].name : 'seus produtos'

    const message = `Olá ${customerName}! 👋 Vi que você iniciou o pedido do item "*${firstItem}*" na Infinity 3D mas não concluiu. Ficou com alguma dúvida sobre o frete ou produto? Posso te ajudar a finalizar com um desconto especial!`

    return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
  }

  const totalFaturado = orders
    .filter(o => isPaidStatus(o.status))
    .reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0)

  const paidCount = orders.filter(o => isPaidStatus(o.status)).length
  const abandonedCount = orders.filter(o => String(o.status || '').toLowerCase() === 'abandoned').length
  const abandonedTotal = orders
    .filter(o => String(o.status || '').toLowerCase() === 'abandoned')
    .reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0)

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      order.customer_email?.toLowerCase().includes(search.toLowerCase()) ||
      (order.customer_phone && order.customer_phone.includes(search)) ||
      (order.customer_cpf && order.customer_cpf.includes(search))

    const matchesSubTab = 
      activeSubTab === 'all' ||
      (activeSubTab === 'paid' && isPaidStatus(order.status)) ||
      (activeSubTab === 'abandoned' && String(order.status || '').toLowerCase() === 'abandoned')

    return matchesSearch && matchesSubTab
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-emerald-400" /> Vendas & Checkouts Abandonados
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">
            Acompanhe dados completos dos clientes ou adicione novas vendas manualmente.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingOrderModal(null)
            setIsOrderModalOpen(true)
          }}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Nova Venda Manual (+)
        </button>
      </div>

      {/* Grid de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Faturamento Concluído</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
              R$
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            R$ {totalFaturado.toFixed(2).replace('.', ',')}
          </div>
          <div className="text-xs text-emerald-400 font-medium mt-1">
            {paidCount} {paidCount === 1 ? 'pedido pago' : 'pedidos pagos'}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Checkouts Abandonados</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {abandonedCount}
          </div>
          <div className="text-xs text-amber-400 font-medium mt-1">
            R$ {abandonedTotal.toFixed(2).replace('.', ',')} em vendas pendentes
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recuperação WhatsApp</span>
            <div className="w-9 h-9 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xs text-slate-300 leading-relaxed mt-1">
            Clique no botão <strong>"Recuperar"</strong> para abrir a conversa pronta no WhatsApp Web com todos os dados.
          </div>
        </div>
      </div>

      {/* Bar de Filtros */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          <button
            onClick={() => setActiveSubTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              activeSubTab === 'all'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Todos os Pedidos ({orders.length})
          </button>
          <button
            onClick={() => setActiveSubTab('paid')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeSubTab === 'paid'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Pagos ({paidCount})
          </button>
          <button
            onClick={() => setActiveSubTab('abandoned')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeSubTab === 'abandoned'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Abandonados ⚠️ ({abandonedCount})
          </button>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, e-mail, CPF..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Tabela de Pedidos */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Carregando histórico de vendas...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <ShoppingCart className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-semibold text-slate-300">Nenhum pedido encontrado</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Assim que os clientes iniciarem ou concluírem compras no site da vitrine, os registros aparecerão aqui com todos os dados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Cliente / CPF</th>
                  <th className="py-3.5 px-4">Contato / Endereço</th>
                  <th className="py-3.5 px-4">Itens</th>
                  <th className="py-3.5 px-4">Total</th>
                  <th className="py-3.5 px-4">Status / Entrega</th>
                  <th className="py-3.5 px-4 text-right">Ação Rápida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredOrders.map((order) => {
                  const itemsList = Array.isArray(order.items) ? order.items : []
                  const isAbandoned = order.status === 'abandoned'
                  const isPaid = order.status === 'paid' || order.status === 'shipped'
                  const addr = getSafeAddress(order.shipping_address)

                  return (
                    <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Cliente */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white text-sm flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-500" />
                          {order.customer_name && order.customer_name !== 'Cliente em Checkout' 
                            ? order.customer_name 
                            : (order.customer_email ? order.customer_email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Cliente em Checkout')}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-500" />
                          {order.customer_email}
                        </div>
                        {order.customer_cpf && (
                          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                            CPF: {order.customer_cpf}
                          </div>
                        )}
                      </td>

                      {/* Contato e Endereço Cidade/UF */}
                      <td className="py-3.5 px-4 text-xs">
                        {order.customer_phone ? (
                          <div className="font-mono text-slate-200 flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-emerald-400" />
                            {order.customer_phone}
                          </div>
                        ) : (
                          <span className="text-slate-500">Sem telefone</span>
                        )}
                        {(addr.city || addr.localidade) && (
                          <div className="text-slate-400 flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>{addr.city || addr.localidade} - {addr.state || addr.uf || ''}</span>
                          </div>
                        )}
                      </td>

                      {/* Itens */}
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-medium text-slate-200">
                          {itemsList.length > 0 ? itemsList[0].name : 'Produto Indefinido'}
                        </div>
                        {itemsList.length > 1 && (
                          <div className="text-[11px] text-slate-500">
                            + {itemsList.length - 1} outros itens
                          </div>
                        )}
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4 font-bold text-white">
                        R$ {Number(order.total_amount).toFixed(2).replace('.', ',')}
                      </td>

                      {/* Status Pagamento e Entrega */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1.5 min-w-[130px]">
                          {/* Status Pagamento */}
                          <select
                            value={order.status}
                            onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                            className={`px-2 py-1 rounded-lg text-xs font-semibold border bg-slate-950 focus:outline-none cursor-pointer ${
                              isPaid
                                ? 'text-emerald-400 border-emerald-500/30'
                                : isAbandoned
                                ? 'text-amber-400 border-amber-500/30'
                                : 'text-slate-400 border-slate-800'
                            }`}
                          >
                            <option value="abandoned">⚠️ Abandonado</option>
                            <option value="paid">✅ Pago</option>
                            <option value="shipped">🚚 Enviado</option>
                            <option value="cancelled">❌ Cancelado</option>
                          </select>

                          {/* Status Entrega (Exibido apenas para pedidos Pagos) */}
                          {isPaid && (
                            <select
                              value={getOrderDeliveryStatus(order)}
                              onChange={(e) => handleUpdateDeliveryStatus(order.id, e.target.value)}
                              className={`px-2 py-1 rounded-lg text-xs font-bold border bg-slate-950 focus:outline-none cursor-pointer ${
                                getOrderDeliveryStatus(order) === 'entregue'
                                  ? 'text-emerald-400 border-emerald-500/40'
                                  : getOrderDeliveryStatus(order) === 'a_caminho'
                                  ? 'text-sky-400 border-sky-500/40'
                                  : 'text-amber-300 border-amber-500/40'
                              }`}
                            >
                              <option value="imprimindo">🖨️ 1. Imprimindo</option>
                              <option value="a_caminho">🚚 2. A caminho</option>
                              <option value="entregue">🎉 3. Entregue</option>
                            </select>
                          )}
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {order.customer_phone && isAbandoned && (
                            <a
                              href={getWhatsAppLink(
                                order.customer_phone,
                                order.customer_name,
                                itemsList,
                                order.total_amount
                              )}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                            >
                              <MessageCircle className="w-4 h-4 fill-emerald-400 hover:fill-white" />
                              <span>Recuperar 💬</span>
                            </a>
                          )}

                          <button
                            onClick={() => setSelectedOrder(order)}
                            title="Ver Todos os Dados do Cliente e Endereço Completo"
                            className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500 text-slate-300 hover:text-indigo-400 transition-all"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setInstagramOrder(order)}
                            title="Gerar Card para Postar no Instagram / Stories"
                            className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-pink-500 text-slate-300 hover:text-pink-400 hover:bg-pink-950/20 transition-all"
                          >
                            <Instagram className="w-4 h-4 text-pink-400" />
                          </button>

                          <button
                            onClick={() => {
                              setEditingOrderModal(order)
                              setIsOrderModalOpen(true)
                            }}
                            title="Editar Dados da Venda"
                            className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-emerald-500 text-slate-300 hover:text-emerald-400 transition-all"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setDeleteTarget({ id: order.id, name: `Pedido de ${order.customer_name}` })}
                            title="Excluir Registro"
                            className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-rose-500 text-slate-300 hover:text-rose-400 transition-all"
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

      {/* Modal Completo de Detalhes do Pedido e Endereço */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-6 my-8">
            {/* Header Modal */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Detalhes do Pedido & Endereço Completo</h3>
                <span className="text-xs text-slate-500 font-mono">ID: {selectedOrder.id}</span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 space-y-6 text-xs">
              {/* Dados Pessoais do Cliente */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-semibold text-indigo-400 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Identificação do Cliente
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm pt-1">
                  <div>
                    <span className="text-slate-500 text-xs block">Nome Completo:</span>
                    <span className="font-semibold text-slate-100">{selectedOrder.customer_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs block">E-mail:</span>
                    <span className="font-semibold text-slate-100">{selectedOrder.customer_email}</span>
                  </div>
                  {selectedOrder.customer_phone && (
                    <div>
                      <span className="text-slate-500 text-xs block">WhatsApp / Telefone:</span>
                      <span className="font-semibold text-emerald-400 font-mono">{selectedOrder.customer_phone}</span>
                    </div>
                  )}
                  {selectedOrder.customer_cpf && (
                    <div>
                      <span className="text-slate-500 text-xs block">CPF / CNPJ:</span>
                      <span className="font-semibold text-slate-200 font-mono">{selectedOrder.customer_cpf}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Endereço de Entrega Completo */}
              {(() => {
                const modalAddr = getSafeAddress(selectedOrder.shipping_address);
                const hasAddr = modalAddr && Object.keys(modalAddr).length > 0 && (modalAddr.street || modalAddr.logradouro || modalAddr.city || modalAddr.localidade || modalAddr.cep || modalAddr.number || modalAddr.numero);
                return (
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <h4 className="font-semibold text-indigo-400 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> Endereço de Entrega Completo
                    </h4>
                    {hasAddr ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 text-slate-300">
                        <div>
                          <span className="text-slate-500 block">Logradouro / Rua:</span>
                          <span className="font-medium text-white">{modalAddr.street || modalAddr.logradouro || 'Não informado'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Número:</span>
                          <span className="font-medium text-white">{modalAddr.number || modalAddr.numero || 'S/N'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Complemento:</span>
                          <span className="font-medium text-white">{modalAddr.complement || modalAddr.complemento || 'Sem complemento'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Bairro:</span>
                          <span className="font-medium text-white">{modalAddr.neighborhood || modalAddr.bairro || 'Não informado'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Cidade / UF:</span>
                          <span className="font-medium text-white">{modalAddr.city || modalAddr.localidade || ''} {modalAddr.state || modalAddr.uf ? `- ${modalAddr.state || modalAddr.uf}` : ''}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">CEP:</span>
                          <span className="font-mono text-indigo-300">{modalAddr.cep || 'Não informado'}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-slate-500 italic py-1">Endereço ainda não preenchido pelo cliente.</div>
                    )}
                  </div>
                );
              })()}

              {/* Frete, Forma de Pagamento e Controles de Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <h4 className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] mb-1.5 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-slate-500" /> Método de Envio
                  </h4>
                  <div className="font-medium text-white text-xs">
                    {selectedOrder.shipping_method || 'Correios / Transportadora'}
                  </div>
                  {selectedOrder.shipping_cost > 0 && (
                    <div className="text-slate-400 text-xs mt-1">Frete: R$ {Number(selectedOrder.shipping_cost).toFixed(2).replace('.', ',')}</div>
                  )}
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <h4 className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] mb-1.5 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-slate-500" /> Forma de Pagamento
                  </h4>
                  <div className="font-medium text-white uppercase text-xs">
                    {selectedOrder.payment_method || 'Stripe (Cartão/PIX)'}
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-indigo-500/30">
                  <h4 className="font-semibold text-indigo-400 uppercase tracking-wider text-[10px] mb-1.5 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-indigo-400" /> Status da Venda / Pgto
                  </h4>
                  <select
                    value={selectedOrder.status || 'paid'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedOrder({ ...selectedOrder, status: val });
                      handleUpdateStatus(selectedOrder.id, val);
                    }}
                    className="w-full bg-slate-900 border border-indigo-500/40 rounded-lg px-2.5 py-1.5 text-xs text-indigo-300 font-bold focus:outline-none"
                  >
                    <option value="paid">✅ Pago (Confirmado)</option>
                    <option value="shipped">📦 Enviado / Entregue</option>
                    <option value="processing">⏳ Em Processamento</option>
                    <option value="abandoned">⚠️ Checkout Abandonado</option>
                    <option value="cancelled">❌ Cancelado</option>
                  </select>
                </div>

                {isPaidStatus(selectedOrder.status) ? (
                  <div className="bg-slate-950 p-4 rounded-xl border border-sky-500/30">
                    <h4 className="font-semibold text-sky-400 uppercase tracking-wider text-[10px] mb-1.5 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-sky-400" /> Status Entrega (Cliente)
                    </h4>
                    <select
                      value={getOrderDeliveryStatus(selectedOrder)}
                      onChange={(e) => handleUpdateDeliveryStatus(selectedOrder.id, e.target.value)}
                      className="w-full bg-slate-900 border border-sky-500/40 rounded-lg px-2.5 py-1.5 text-xs text-sky-300 font-bold focus:outline-none"
                    >
                      <option value="imprimindo">🖨️ 1. Imprimindo</option>
                      <option value="a_caminho">🚚 2. A caminho</option>
                      <option value="entregue">🎉 3. Entregue</option>
                    </select>
                  </div>
                ) : (
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Status Entrega</span>
                    <span className="text-xs text-slate-500 italic mt-1">Disponível apenas após pagamento confirmado</span>
                  </div>
                )}
              </div>

              {/* Lista de Produtos no Carrinho */}
              <div>
                <h4 className="font-semibold text-slate-300 mb-2 uppercase tracking-wider text-[10px]">Itens no Carrinho</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {Array.isArray(selectedOrder.items) && selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {item.image && (
                          <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg object-cover bg-slate-900" />
                        )}
                        <div>
                          <div className="font-semibold text-white">{item.name}</div>
                          {item.size && <div className="text-[11px] text-slate-400">Tamanho: {item.size}</div>}
                          <div className="text-[11px] text-slate-500">Qtd: {item.quantity || 1}</div>
                        </div>
                      </div>
                      <div className="font-bold text-slate-200">
                        R$ {Number(item.price || 0).toFixed(2).replace('.', ',')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Geral */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-sm">
                <span className="text-slate-400">Data: {new Date(selectedOrder.created_at).toLocaleString('pt-BR')}</span>
                <span className="text-lg font-bold text-white">
                  Total Geral: R$ {Number(selectedOrder.total_amount).toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-6 border-t border-slate-800 flex items-center justify-between">
              {selectedOrder.customer_phone && (
                <a
                  href={getWhatsAppLink(
                    selectedOrder.customer_phone,
                    selectedOrder.customer_name,
                    selectedOrder.items,
                    selectedOrder.total_amount
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all"
                >
                  <MessageCircle className="w-4 h-4 fill-white" />
                  Chamar no WhatsApp
                </a>
              )}
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Registro de Pedido"
        message={deleteTarget ? `Tem certeza que deseja excluir o registro do ${deleteTarget.name}?` : ''}
        loading={deleting}
      />

      {/* Modal de Criação / Edição de Vendas Manuais */}
      <OrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        order={editingOrderModal}
        onSave={fetchOrders}
      />

      {/* Modal de Card para Instagram */}
      <InstagramOrderCardModal
        isOpen={Boolean(instagramOrder)}
        onClose={() => setInstagramOrder(null)}
        order={instagramOrder}
      />
    </div>
  )
}
