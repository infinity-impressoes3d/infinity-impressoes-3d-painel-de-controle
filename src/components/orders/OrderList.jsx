import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import ConfirmDeleteModal from '../common/ConfirmDeleteModal'
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
  ShieldCheck
} from 'lucide-react'

export default function OrderList() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeSubTab, setActiveSubTab] = useState('all')
  const [selectedOrder, setSelectedOrder] = useState(null)

  // Modal de confirmação de exclusão
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchOrders()

    const channel = supabase
      .channel('admin-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setOrders(data || [])
    } catch (err) {
      console.error('Erro ao buscar pedidos:', err.message)
    } finally {
      setLoading(false)
    }
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
      }
    } catch (err) {
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
    .filter(o => o.status === 'paid' || o.status === 'shipped')
    .reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0)

  const paidCount = orders.filter(o => o.status === 'paid' || o.status === 'shipped').length
  const abandonedCount = orders.filter(o => o.status === 'abandoned').length
  const abandonedTotal = orders
    .filter(o => o.status === 'abandoned')
    .reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0)

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      order.customer_email?.toLowerCase().includes(search.toLowerCase()) ||
      (order.customer_phone && order.customer_phone.includes(search)) ||
      (order.customer_cpf && order.customer_cpf.includes(search))

    const matchesSubTab = 
      activeSubTab === 'all' ||
      (activeSubTab === 'paid' && (order.status === 'paid' || order.status === 'shipped')) ||
      (activeSubTab === 'abandoned' && order.status === 'abandoned')

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
            Acompanhe dados completos dos clientes (Nome, E-mail, WhatsApp, Endereço e CPF).
          </p>
        </div>
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
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Ação Rápida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredOrders.map((order) => {
                  const itemsList = Array.isArray(order.items) ? order.items : []
                  const isAbandoned = order.status === 'abandoned'
                  const isPaid = order.status === 'paid' || order.status === 'shipped'
                  const addr = order.shipping_address || {}

                  return (
                    <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Cliente */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white text-sm flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-500" />
                          {order.customer_name}
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

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <select
                          value={order.status}
                          onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border bg-slate-950 focus:outline-none cursor-pointer ${
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
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-semibold text-indigo-400 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Endereço de Entrega Completo
                </h4>
                {selectedOrder.shipping_address && Object.keys(selectedOrder.shipping_address).length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 text-slate-300">
                    <div>
                      <span className="text-slate-500 block">Logradouro / Rua:</span>
                      <span className="font-medium text-white">{selectedOrder.shipping_address.street || selectedOrder.shipping_address.logradouro || 'Não informado'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Número:</span>
                      <span className="font-medium text-white">{selectedOrder.shipping_address.number || 'S/N'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Complemento:</span>
                      <span className="font-medium text-white">{selectedOrder.shipping_address.complement || 'Sem complemento'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Bairro:</span>
                      <span className="font-medium text-white">{selectedOrder.shipping_address.neighborhood || selectedOrder.shipping_address.bairro || 'Não informado'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Cidade / UF:</span>
                      <span className="font-medium text-white">{selectedOrder.shipping_address.city || selectedOrder.shipping_address.localidade || ''} - {selectedOrder.shipping_address.state || selectedOrder.shipping_address.uf || ''}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">CEP:</span>
                      <span className="font-mono text-indigo-300">{selectedOrder.shipping_address.cep || 'Não informado'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-500 italic py-1">Endereço ainda não preenchido pelo cliente.</div>
                )}
              </div>

              {/* Frete e Forma de Pagamento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <h4 className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] mb-1.5 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-slate-500" /> Método de Envio
                  </h4>
                  <div className="font-medium text-white">
                    {selectedOrder.shipping_method || 'Correios / Transportadora'}
                  </div>
                  {selectedOrder.shipping_cost > 0 && (
                    <div className="text-slate-400 mt-1">Frete: R$ {Number(selectedOrder.shipping_cost).toFixed(2).replace('.', ',')}</div>
                  )}
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <h4 className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] mb-1.5 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-slate-500" /> Forma de Pagamento
                  </h4>
                  <div className="font-medium text-white uppercase">
                    {selectedOrder.payment_method || 'Stripe (Cartão/PIX)'}
                  </div>
                </div>
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
    </div>
  )
}
